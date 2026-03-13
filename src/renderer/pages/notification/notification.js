const { ipcRenderer } = require('electron')

class AppNotification {
  static show(container, { title, message, filePath = null, duration = 4000 }) {
    if (!container) return

    const notif = document.createElement('div')
    notif.className = 'notification-toast'
    
    notif.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">
          <span class="material-symbols-outlined">check</span>
        </div>
        <div class="notification-text">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
        </div>
      </div>
      <div class="notification-actions">
        ${filePath ? `<button class="notification-btn view-btn">View</button>` : ''}
        <button class="notification-btn close-btn">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    `

    const closeHandler = (instant = false) => {
      if (instant) {
        notif.remove()
      } else {
        notif.classList.add('fade-out')
        setTimeout(() => notif.remove(), 250)
      }
    }

    const closeBtn = notif.querySelector('.close-btn')
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation()
        closeHandler(true)
      }
    }

    if (filePath) {
      const viewBtn = notif.querySelector('.view-btn')
      if (viewBtn) {
        viewBtn.onclick = (e) => {
          e.stopPropagation()
          ipcRenderer.send('open-screenshot-file', filePath)
          closeHandler(true)
        }
      }
    }

    container.appendChild(notif)

    if (duration > 0) {
      setTimeout(() => {
        if (notif.parentElement) closeHandler()
      }, duration)
    }

    return notif
  }

  static initWindow() {
    let savedFilePath = null
    let osTheme = 'dark'

    const applyTheme = (theme) => {
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

    const setupButtons = () => {
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
    }

    ipcRenderer.on('set-notification-data', (event, data) => {
      savedFilePath = data.filePath
      const titleEl = document.querySelector('.notification-title')
      const messageEl = document.querySelector('.notification-message')
      
      if (titleEl && data.title) titleEl.textContent = data.title
      if (messageEl && data.body) messageEl.textContent = data.body
      
      const viewBtn = document.querySelector('.view-btn')
      if (viewBtn) viewBtn.style.display = savedFilePath ? 'flex' : 'none'
      
      if (data.accentColor) {
        const hexToRgb = (hex) => {
          const r = parseInt(hex.substr(1, 2), 16)
          const g = parseInt(hex.substr(3, 2), 16)
          const b = parseInt(hex.substr(5, 2), 16)
          return { r, g, b }
        }
        const rgb = hexToRgb(data.accentColor)
        document.documentElement.style.setProperty('--accent-color', data.accentColor)
        document.documentElement.style.setProperty('--accent-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
      }
      
      setupButtons()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ipcRenderer.send('close-notification')
      }
    })

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupButtons)
    } else {
      setupButtons()
    }
  }
}

window.AppNotification = AppNotification;
if (typeof module !== 'undefined') {
  module.exports = AppNotification
}