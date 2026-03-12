const { ipcRenderer } = require('electron')

let isTestComplete = false

ipcRenderer.on('set-theme', (event, data) => {
  const theme = typeof data === 'string' ? data : data.theme
  const accentColor = typeof data === 'object' ? data.accentColor : null

  document.body.parentElement.setAttribute('data-theme', theme)
  if (accentColor) {
    document.documentElement.style.setProperty('--accent-color', accentColor)
  }
})

ipcRenderer.on('update-test-progress', (event, data) => {
  document.getElementById('soundName').textContent = data.soundName
  document.getElementById('progressFill').style.width = data.progress + '%'
  document.getElementById('soundCounter').textContent = data.current + ' / ' + data.total
})

ipcRenderer.on('test-complete', () => {
  isTestComplete = true
  document.getElementById('soundName').textContent = 'Complete!'
  document.getElementById('progressFill').style.width = '100%'
  setTimeout(() => {
    window.close()
  }, 1000)
})

document.getElementById('closeBtn').addEventListener('click', () => {
  window.close()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close()
  }
})

window.addEventListener('beforeunload', () => {
  if (!isTestComplete) {
    ipcRenderer.send('stop-sound-test')
  }
})