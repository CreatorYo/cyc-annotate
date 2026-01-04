const { DEFAULT_ACCENT_COLOR } = require('../../shared/constants.js')
const { BrowserWindow, screen, nativeTheme } = require('electron')
const path = require('path')

let notificationWin = null
let deps = {}

function init(dependencies) {
  deps = dependencies
  return { show, close, getWin: () => notificationWin }
}

function show(title, body, filePath) {
  if (notificationWin && !notificationWin.isDestroyed()) {
    notificationWin.close()
    notificationWin = null
  }
  
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const { x, y } = primaryDisplay.workArea
  
  notificationWin = new BrowserWindow({
    width: 380,
    height: 80,
    x: x + width - 400,
    y: y + height - 100,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    show: false,
    opacity: 0,
    icon: deps.iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  
  const thisWin = notificationWin
  
  thisWin.setIgnoreMouseEvents(false, { forward: false })
  thisWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  thisWin.setAlwaysOnTop(true, 'screen-saver', 1)
  
  thisWin.loadFile(path.join(__dirname, '../../notification/notification.html'))
  
  deps.disableDefaultShortcuts?.(thisWin)
  
  thisWin.webContents.once('did-finish-load', () => {
    if (!thisWin || thisWin.isDestroyed()) return
    
    const accentColor = deps.getSetting?.('accent-color', DEFAULT_ACCENT_COLOR) || DEFAULT_ACCENT_COLOR
    const currentTheme = deps.getSetting?.('theme', 'system') || 'system'
    
    if (currentTheme === 'system') {
      thisWin.webContents.send('os-theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
    } else {
      thisWin.webContents.send('theme-changed', currentTheme)
    }
    
    thisWin.webContents.send('set-notification-data', { title, body, accentColor, filePath })
    thisWin.show()
    
    let opacity = 0
    const fadeIn = setInterval(() => {
      if (!thisWin || thisWin.isDestroyed()) {
        clearInterval(fadeIn)
        return
      }
      opacity += 0.1
      if (opacity >= 1) {
        thisWin.setOpacity(1)
        clearInterval(fadeIn)
        
        setTimeout(() => {
          if (!thisWin || thisWin.isDestroyed()) return
          
          const startTime = Date.now()
          const duration = 150
          
          const fadeOut = () => {
            if (!thisWin || thisWin.isDestroyed()) return
            const elapsed = Date.now() - startTime
            const fadeOpacity = Math.max(0, 1 - (elapsed / duration))
            
            if (fadeOpacity <= 0) {
              thisWin.setOpacity(0)
              thisWin.close()
            } else {
              thisWin.setOpacity(fadeOpacity)
              setTimeout(fadeOut, 5)
            }
          }
          fadeOut()
        }, 3000)
      } else {
        thisWin.setOpacity(opacity)
      }
    }, 16)
  })
  
  thisWin.on('closed', () => {
    if (notificationWin === thisWin) notificationWin = null
  })
}

function close() {
  if (notificationWin && !notificationWin.isDestroyed()) {
    notificationWin.destroy()
    notificationWin = null
  }
}

module.exports = { init }
