const { ipcRenderer } = require('electron')

let savedFilePath = null
let osTheme = 'dark'

function applyTheme(theme) {
  if (theme === 'system') {
    document.body.setAttribute('data-theme', osTheme)
  } else {
    document.body.setAttribute('data-theme', theme)
  }
}

ipcRenderer.invoke('get-os-theme').then(theme => {
  osTheme = theme
  applyTheme('system')
})

ipcRenderer.on('os-theme-changed', (event, effectiveTheme) => {
  osTheme = effectiveTheme
  applyTheme('system')
})

ipcRenderer.on('theme-changed', (event, theme) => {
  applyTheme(theme)
})

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
  
  const titleEl = document.querySelector('.notification-title')
  const messageEl = document.querySelector('.notification-message')
  
  if (titleEl && data.title) {
    titleEl.textContent = data.title
  }
  
  if (messageEl && data.body) {
    messageEl.textContent = data.body
  }
  
  const viewBtn = document.querySelector('.view-btn')
  if (viewBtn) {
    if (savedFilePath) {
      viewBtn.style.display = 'flex'
    } else {
      viewBtn.style.display = 'none'
    }
  }
  
  if (data.accentColor) {
    const rgb = hexToRgb(data.accentColor)
    document.documentElement.style.setProperty('--accent-color', data.accentColor)
    document.documentElement.style.setProperty('--accent-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
  }
  
  setupButtons()
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupButtons)
} else {
  setupButtons()
}
