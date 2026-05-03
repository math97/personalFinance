import { app, BrowserWindow, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import net from 'net'
import path from 'path'
import fs from 'fs'
import getPort from 'get-port'
import { createSplashWindow, updateSplashStatus } from './splash'

const isDev = !app.isPackaged

function getResourcesPath(): string {
  return isDev
    ? path.join(__dirname, '..', '..', '..') // code/ root in dev
    : process.resourcesPath
}

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'Ember')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}


async function waitForPort(port: number, proc: ChildProcess, timeout = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (proc.exitCode !== null) {
      throw new Error(`Process exited with code ${proc.exitCode} before port ${port} was ready`)
    }
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1')
      socket.once('connect', () => { socket.destroy(); resolve(true) })
      socket.once('error', () => resolve(false))
    })
    if (open) return
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Service on port ${port} did not start within ${timeout}ms`)
}

let backendProcess: ChildProcess | null = null
let frontendProcess: ChildProcess | null = null
let activeFrontendPort: number | null = null
let isShuttingDown = false

function attachProcessHandlers(proc: ChildProcess, name: string): void {
  proc.stderr?.on('data', (d) => console.error(`[${name}]`, d.toString()))
  proc.on('error', (err) => {
    if (!isShuttingDown) dialog.showErrorBox(`${name} failed to start`, err.message)
  })
  proc.on('exit', (code, signal) => {
    console.log(`[${name}] exited with code ${code}, signal ${signal}`)
    const isSigterm = signal === 'SIGTERM' || signal === 'SIGKILL' || code === 143 || code === 137
    if (!isShuttingDown && code !== 0 && !isSigterm) {
      const logPath = path.join(app.getPath('userData'), 'Ember', 'ember.log')
      dialog.showErrorBox(`${name} crashed`, `Exit code: ${code ?? 'unknown'}\n\nSee log: ${logPath}`)
    }
  })
}

async function startServices(backendPort: number, frontendPort: number): Promise<void> {
  const resources = getResourcesPath()
  console.log('Resources path:', resources)

  // In dev, use the existing dev.db via the backend's own .env file
  // In production, use the app data directory
  const backendEnv: NodeJS.ProcessEnv = isDev
    ? { ...process.env, PORT: String(backendPort) }
    : (() => {
        const dataDir = getDataDir()
        const dbPath = path.join(dataDir, 'finance.db')
        return {
          ...process.env,
          PORT: String(backendPort),
          DATABASE_URL: `file:${dbPath}`,
          NODE_ENV: 'production',
          AI_PROVIDER: 'openrouter',
          AI_API_KEY: '',
          AI_MODEL: 'google/gemini-3-flash-preview',
        }
      })()

  const frontendEnv = {
    ...process.env,
    PORT: String(frontendPort),
    BACKEND_PORT: String(backendPort),
    HOSTNAME: '127.0.0.1',
  }

  if (isDev) {
    backendProcess = spawn('npm', ['run', 'start:dev'], {
      cwd: path.join(resources, 'apps', 'backend'),
      env: backendEnv,
      shell: true,
    })
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(resources, 'apps', 'frontend'),
      env: { ...frontendEnv, PORT: String(frontendPort) },
      shell: true,
    })
  } else {
    const backendEntry = path.join(resources, 'backend', 'dist', 'src', 'main.js')
    const frontendEntry = path.join(resources, 'frontend', 'apps', 'frontend', 'server.js')

    // Use Electron's own bundled Node runtime — no external Node.js installation required
    const nodeBin = process.execPath
    const nodeEnv = { ELECTRON_RUN_AS_NODE: '1' }

    const logDir = getDataDir()
    const logStream = fs.createWriteStream(path.join(logDir, 'ember.log'), { flags: 'a' })
    const log = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}\n`
      process.stdout.write(line)
      logStream.write(line)
    }

    const spawnLogged = (bin: string, args: string[], opts: Parameters<typeof spawn>[2] & { env?: NodeJS.ProcessEnv }) => {
      const proc = spawn(bin, args, { ...opts, env: { ...nodeEnv, ...opts?.env }, stdio: ['ignore', 'pipe', 'pipe'] })
      proc.stdout?.on('data', (d: Buffer) => logStream.write(d))
      proc.stderr?.on('data', (d: Buffer) => logStream.write(d))
      return proc
    }

    // Run migrations before starting the backend so the SQLite schema is up to date
    const prismaCliJs = path.join(resources, 'backend', 'node_modules', 'prisma', 'build', 'index.js')
    log(`Running prisma migrate deploy (execPath: ${nodeBin}, prisma: ${prismaCliJs})`)
    await new Promise<void>((resolve, reject) => {
      const migrateProc = spawnLogged(nodeBin, [prismaCliJs, 'migrate', 'deploy'], {
        cwd: path.join(resources, 'backend'),
        env: backendEnv,
      })
      migrateProc.on('error', reject)
      migrateProc.on('exit', (code) => {
        log(`prisma migrate deploy exited with code ${code}`)
        if (code === 0) resolve()
        else reject(new Error(`prisma migrate deploy exited with code ${code}`))
      })
    })

    log(`Starting backend: ${backendEntry}`)
    backendProcess = spawnLogged(nodeBin, [backendEntry], { env: backendEnv })
    backendProcess.on('error', (err) => log(`Backend error: ${err.message}`))

    log(`Starting frontend: ${frontendEntry}`)
    frontendProcess = spawnLogged(nodeBin, [frontendEntry], { env: frontendEnv })
    frontendProcess.on('error', (err) => log(`Frontend error: ${err.message}`))
  }

  attachProcessHandlers(backendProcess, 'Backend')
  attachProcessHandlers(frontendProcess, 'Frontend')
}

function killServices(): void {
  isShuttingDown = true
  for (const [proc, name] of [[backendProcess, 'backend'], [frontendProcess, 'frontend']] as const) {
    if (!proc) continue
    proc.kill('SIGTERM')
    const timer = setTimeout(() => {
      if (proc.exitCode === null) {
        console.warn(`[${name}] did not exit after SIGTERM, sending SIGKILL`)
        proc.kill('SIGKILL')
      }
    }, 3000)
    proc.once('exit', () => clearTimeout(timer))
  }
}

async function createMainWindow(frontendPort: number): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  await win.loadURL(`http://localhost:${frontendPort}`)
  win.show()
  return win
}

async function requirePort(port: number): Promise<number> {
  const available = await getPort({ port })
  if (available !== port) {
    throw new Error(
      `Port ${port} is already in use by another application. Please free port ${port} and reopen Ember.`
    )
  }
  return port
}

async function launch(): Promise<void> {
  const [backendPort, frontendPort] = isDev
    ? await Promise.all([getPort({ port: 47151 }), getPort({ port: 47150 })])
    : await Promise.all([requirePort(3001), getPort({ port: 47150 })])
  activeFrontendPort = frontendPort

  const splash = createSplashWindow()

  updateSplashStatus(splash, 'Preparing database…')
  await startServices(backendPort, frontendPort)

  updateSplashStatus(splash, 'Waiting for backend…')
  await waitForPort(backendPort, backendProcess!)

  updateSplashStatus(splash, 'Waiting for frontend…')
  await waitForPort(frontendPort, frontendProcess!)

  const mainWindow = await createMainWindow(frontendPort)

  splash.close()
  mainWindow.focus()
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      await launch()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dialog.showErrorBox('Failed to start Personal Finance', message)
      app.quit()
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    killServices()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (activeFrontendPort !== null && backendProcess !== null && frontendProcess !== null) {
      // Services are still running — just reopen the window
      createMainWindow(activeFrontendPort).catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        dialog.showErrorBox('Failed to reopen window', message)
      })
    } else {
      launch().catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        dialog.showErrorBox('Failed to restart Ember', message)
        app.quit()
      })
    }
  }
})

app.on('before-quit', killServices)
