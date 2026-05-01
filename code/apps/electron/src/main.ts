import { app, BrowserWindow, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function waitForPort(port: number, proc: ChildProcess, timeout = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (proc.exitCode !== null) {
      throw new Error(`Process exited with code ${proc.exitCode} before port ${port} was ready`)
    }
    try {
      await fetch(`http://localhost:${port}/`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error(`Service on port ${port} did not start within ${timeout}ms`)
}

let backendProcess: ChildProcess | null = null
let frontendProcess: ChildProcess | null = null

function attachProcessHandlers(proc: ChildProcess, name: string): void {
  proc.stderr?.on('data', (d) => console.error(`[${name}]`, d.toString()))
  proc.on('error', (err) => {
    dialog.showErrorBox(`${name} failed to start`, err.message)
  })
  proc.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      dialog.showErrorBox(`${name} crashed`, `Exit code: ${code ?? 'unknown'}`)
    }
  })
}

async function startServices(backendPort: number, frontendPort: number): Promise<void> {
  const resources = getResourcesPath()

  // In dev, use the existing dev.db via the backend's own .env file
  // In production, use the app data directory
  const backendEnv: NodeJS.ProcessEnv = isDev
    ? { ...process.env, PORT: String(backendPort) }
    : (() => {
        const dataDir = getDataDir()
        const dbPath = path.join(dataDir, 'finance.db')
        return { ...process.env, PORT: String(backendPort), DATABASE_URL: `file:${dbPath}`, NODE_ENV: 'production' }
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
    const backendEntry = path.join(resources, 'backend', 'dist', 'main.js')
    const frontendEntry = path.join(resources, 'frontend', 'server.js')

    const prismaClient = path.join(resources, 'backend', 'node_modules', '.bin', 'prisma')
    const migrateProc = spawn(prismaClient, ['migrate', 'deploy'], {
      cwd: path.join(resources, 'backend'),
      env: backendEnv,
    })
    await new Promise<void>((resolve, reject) => {
      migrateProc.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`prisma migrate deploy failed with code ${code}`))
      )
      migrateProc.on('error', reject)
    })

    backendProcess = spawn('node', [backendEntry], { env: backendEnv })
    frontendProcess = spawn('node', [frontendEntry], { env: frontendEnv })
  }

  attachProcessHandlers(backendProcess, 'Backend')
  attachProcessHandlers(frontendProcess, 'Frontend')
}

function killServices(): void {
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

async function launch(): Promise<void> {
  const [backendPort, frontendPort] = await Promise.all([
    getPort({ port: 47151 }),
    getPort({ port: 47150 }),
  ])

  const splash = createSplashWindow()

  updateSplashStatus(splash, 'Starting backend…')
  await startServices(backendPort, frontendPort)

  updateSplashStatus(splash, 'Waiting for backend…')
  await waitForPort(backendPort, backendProcess!)

  updateSplashStatus(splash, 'Waiting for frontend…')
  await waitForPort(frontendPort, frontendProcess!)

  const mainWindow = await createMainWindow(frontendPort)

  splash.close()
  mainWindow.focus()
}

app.whenReady().then(async () => {
  try {
    await launch()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    dialog.showErrorBox('Failed to start Personal Finance', message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  killServices()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    launch().catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      dialog.showErrorBox('Failed to restart Personal Finance', message)
      app.quit()
    })
  }
})

app.on('before-quit', killServices)
