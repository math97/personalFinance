import { BrowserWindow } from 'electron'
import path from 'path'

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
    },
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))
  return splash
}

export function updateSplashStatus(splash: BrowserWindow, msg: string): void {
  if (!splash.isDestroyed()) {
    splash.webContents.send('splash:status', msg)
  }
}
