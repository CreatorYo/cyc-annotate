const { ipcRenderer } = require('electron')

let savedFilePath = null

function hexToRgb(hex) {
  const r = parseInt(hex.substr(1, 2), 16)
  const g = parseInt(hex.substr(3, 2), 16)
  const b = parseInt(hex.substr(5, 2), 16)
  return { r, g, b }
}

function setupButtons() {
  const viewBtn = document.getElementById('view-btn')
  const closeBtn = document.getElementById('close-btn')
  
  if (viewBtn) {
    viewBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (savedFilePath) {
        ipcRenderer.send('open-screenshot-file', savedFilePath)
        setTimeout(() => {
          ipcRenderer.send('close-notification')
        }, 200)
      }
    }
  }
  
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      ipcRenderer.send('close-notification')
    }
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      ipcRenderer.send('close-notification')
      ipcRenderer.send('notification-esc-pressed')
    }
  })
}

ipcRenderer.on('set-notification-data', (event, data) => {
  savedFilePath = data.filePath
  
  if (data.accentColor) {
    document.documentElement.style.setProperty('--accent-color', data.accentColor)
    const icon = document.querySelector('.notification-icon')
    if (icon) {
      icon.style.background = data.accentColor
    }
    const viewBtn = document.querySelector('.view-btn')
    if (viewBtn) {
      viewBtn.style.color = data.accentColor
      const rgb = hexToRgb(data.accentColor)
      viewBtn.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
    }
  }
  
  setupButtons()
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupButtons)
} else {
  setupButtons()
}
