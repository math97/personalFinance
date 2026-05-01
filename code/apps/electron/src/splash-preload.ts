import { ipcRenderer } from 'electron'

ipcRenderer.on('splash:status', (_event, msg: string) => {
  const el = document.getElementById('status')
  if (el) el.textContent = msg
})
