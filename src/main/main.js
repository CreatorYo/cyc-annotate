const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, desktopCapturer, nativeImage, Notification, nativeTheme, systemPreferences, clipboard } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const dialogs = require('./utils/dialogs')

const iconPathIco = path.join(__dirname, '../../icon.ico')
const iconPathPng = path.join(__dirname, '../../icon.png')
const iconPath = fs.existsSync(iconPathIco) ? iconPathIco : iconPathPng

let win
let settingsWin
let onboardingWin = null
let captureOverlayWin = null
let notificationWin = null
let tray
let visible = false
let shortcut = 'Control+Shift+D'
let captureOverlayActive = false
let standbyModeEnabled = false
let standbyPollingInterval = null
let lastMouseOverToolbar = false
let toolbarBounds = null

function restoreMouseEvents() {
  if (win && !win.isDestroyed()) {
    if (standbyModeEnabled) {
      win.setIgnoreMouseEvents(true)
      startStandbyPolling()
    } else {
      win.setIgnoreMouseEvents(false)
      stopStandbyPolling()
    }
  }
}

function startStandbyPolling() {
  if (standbyPollingInterval) return
  
  const { screen } = require('electron')
  
  standbyPollingInterval = setInterval(() => {
    if (!win || win.isDestroyed() || !standbyModeEnabled) {
      stopStandbyPolling()
      return
    }
    
    if (!toolbarBounds) {
      // No toolbar bounds yet, keep ignoring mouse events
      win.setIgnoreMouseEvents(true)
      return
    }
    
    try {
      const cursorPoint = screen.getCursorScreenPoint()
      
      const padding = 15
      const isOverToolbar = 
        cursorPoint.x >= toolbarBounds.x - padding &&
        cursorPoint.x <= toolbarBounds.x + toolbarBounds.width + padding &&
        cursorPoint.y >= toolbarBounds.y - padding &&
        cursorPoint.y <= toolbarBounds.y + toolbarBounds.height + padding
      
      if (isOverToolbar !== lastMouseOverToolbar) {
        lastMouseOverToolbar = isOverToolbar
        if (isOverToolbar) {
          win.setIgnoreMouseEvents(false)
        } else {
          win.setIgnoreMouseEvents(true)
        }
      }
    } catch (e) {}
  }, 16)
}

function stopStandbyPolling() {
  if (standbyPollingInterval) {
    clearInterval(standbyPollingInterval)
    standbyPollingInterval = null
  }
  lastMouseOverToolbar = false
}

function disableDefaultShortcuts(window) {
  if (!window || window.isDestroyed()) return
  
  const isDev = !app.isPackaged
  
  window.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'f') {
      return
    }
    
    if (isDev) {
      return
    }
    
    if (input.control || input.meta) {
      if (input.key.toLowerCase() === 'r' && !input.shift) {
        event.preventDefault()
        return
      }
      if (input.key.toLowerCase() === 'r' && input.shift) {
        event.preventDefault()
        return
      }
      if (input.key.toLowerCase() === 'i' && input.shift) {
        event.preventDefault()
        return
      }
      if (input.key.toLowerCase() === 'j' && input.shift) {
        event.preventDefault()
        return
      }
      if (input.key.toLowerCase() === 'u') {
        event.preventDefault()
        return
      }
      if (input.key.toLowerCase() === 'c' && input.shift) {
        event.preventDefault()
        return
      }
    }
    if (input.key === 'F5') {
      event.preventDefault()
      return
    }
    if (input.key === 'F5' && (input.control || input.meta)) {
      event.preventDefault()
      return
    }
  })
}

function ensureAlwaysOnTop() {
  if (captureOverlayActive) {
    return
  }
  if (win && !win.isDestroyed()) {
    try {
      if (!win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    } catch (e) {
      try {
        win.setAlwaysOnTop(true)
      } catch (e2) {
      }
    }
  }
}

function getSetting(key, defaultValue) {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      const settings = JSON.parse(data)
      return settings[key] !== undefined ? settings[key] : defaultValue
    }
  } catch (e) {
  }
  return defaultValue
}

function setSetting(key, value) {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    let settings = {}
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      settings = JSON.parse(data)
    }
    if (value === null || value === undefined || value === '') {
      delete settings[key]
    } else {
      settings[key] = value
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch (e) {
  }
}

function manageStartupShortcut(enabled) {
  if (process.platform !== 'win32') return
  
  setImmediate(() => {
    try {
      const os = require('os')
      const { exec } = require('child_process')
      const startupFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
      
      if (!fs.existsSync(startupFolder)) {
        fs.mkdirSync(startupFolder, { recursive: true })
      }
      
      const shortcutPath = path.join(startupFolder, `${app.getName()}.lnk`)
      
      if (enabled) {
        const exePath = app.getPath('exe')
        const workingDir = path.dirname(exePath)
        
        const escapedShortcutPath = shortcutPath.replace(/'/g, "''").replace(/\\/g, '\\')
        const escapedExePath = exePath.replace(/'/g, "''").replace(/\\/g, '\\')
        const escapedWorkingDir = workingDir.replace(/'/g, "''").replace(/\\/g, '\\')
        
        const psScript = `$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${escapedShortcutPath}'); $Shortcut.TargetPath = '${escapedExePath}'; $Shortcut.WorkingDirectory = '${escapedWorkingDir}'; $Shortcut.Save()`
        
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'ignore' }, (error) => {
          if (error) {
            console.error('Error managing startup shortcut:', error)
          }
        })
      } else {
        if (fs.existsSync(shortcutPath)) {
          fs.unlink(shortcutPath, (error) => {
            if (error) {
              console.error('Error removing startup shortcut:', error)
            }
          })
        }
      }
    } catch (error) {
      console.error('Error managing startup shortcut:', error)
    }
  })
}

function createTray() {
  if (tray) {
    try {
      tray.destroy()
    } catch (e) {
    }
    tray = null
  }
  
  try {
    const trayIconPathIco = path.join(__dirname, '../../icon.ico')
    const trayIconPathPng = path.join(__dirname, '../../icon.png')
    const trayIconPath = fs.existsSync(trayIconPathIco) ? trayIconPathIco : trayIconPathPng
    if (fs.existsSync(trayIconPath)) {
      tray = new Tray(trayIconPath)
    } else {
      const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
      tray = new Tray(icon)
    }
    
    tray.setToolTip('CYC Annotate')

    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Settings', click: () => {
        if (settingsWin && !settingsWin.isDestroyed()) {
          if (settingsWin.isMinimized()) settingsWin.restore()
          settingsWin.focus()
        } else {
          ipcMain.emit('open-settings')
        }
      }},
      { label: 'Relaunch', click: async () => {
        if (win && !win.isDestroyed()) {
          try {
            const annotationsData = await win.webContents.executeJavaScript(`
              (function() {
                return JSON.stringify({
                  elements: state.elements,
                  nextElementId: state.nextElementId
                });
              })()
            `)
            if (annotationsData) {
              const tempPath = path.join(app.getPath('userData'), 'relaunch-annotations.json')
              fs.writeFileSync(tempPath, annotationsData, 'utf8')
            }
          } catch (e) {
            console.error('Error saving annotations for relaunch:', e)
          }
        }
        app.relaunch({ args: process.argv.slice(1).concat(['--restore-annotations']) })
        app.exit()
      }},
      { type: 'separator' },
      { label: 'Quit CYC Annotate', click: () => app.quit() }
    ]))

    tray.on('click', toggleOverlay)
  } catch (e) {
    console.warn('Could not create system tray:', e)
  }
}

function destroyTray() {
  if (tray) {
    try {
      tray.destroy()
    } catch (e) {
    }
    tray = null
  }
}

function showOverlay() {
  if (!win || win.isDestroyed()) {
    console.warn('Window not available for show')
    return
  }

  if (visible) return

  visible = true

  try {
    const { screen } = require('electron')
    const cursorPoint = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPoint)
    const bounds = display.bounds

    win.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })

    ensureAlwaysOnTop()
    win.setOpacity(0) 
    win.show()
    standbyModeEnabled = false
    win.setIgnoreMouseEvents(false)
    
    let opacity = 0
    const fadeInterval = setInterval(() => {
      if (!win || win.isDestroyed()) {
        clearInterval(fadeInterval)
        return
      }
      opacity += 0.25
      if (opacity >= 1) {
        win.setOpacity(1)
        ensureAlwaysOnTop()
        clearInterval(fadeInterval)
      } else {
        win.setOpacity(opacity)
      }
    }, 8) 
  } catch (error) {
    console.error('Error showing window:', error)
    visible = false
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('draw-mode', true)
    win.webContents.send('disable-standby-mode')
  }
}

function hideOverlay() {
  if (!win || win.isDestroyed()) {
    return
  }

  if (!visible) return

  visible = false

  try {
    let opacity = 1
    const fadeInterval = setInterval(() => {
      if (!win || win.isDestroyed()) {
        clearInterval(fadeInterval)
        return
      }
      opacity -= 0.25
      if (opacity <= 0) {
        win.setOpacity(0)
        win.setIgnoreMouseEvents(true, { forward: true })
        win.hide()
        clearInterval(fadeInterval)
      } else {
        win.setOpacity(opacity)
      }
    }, 8) 
  } catch (error) {
    console.error('Error hiding window:', error)
    visible = true
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('draw-mode', false)
  }
}

function toggleOverlay() {
  if (!win || win.isDestroyed()) {
    console.warn('Window not available for toggle')
    return
  }

  if (visible) {
    hideOverlay()
  } else {
    showOverlay()
  }
}

function registerShortcut() {
  if (!shortcut) return
  
  try {
    if (globalShortcut.isRegistered(shortcut)) {
      globalShortcut.unregister(shortcut)
    } else {
      globalShortcut.unregisterAll()
    }
  } catch (e) {
    globalShortcut.unregisterAll()
  }

  const attemptRegister = (attempt = 0, maxAttempts = 10) => {
    if (attempt >= maxAttempts) {
      return false
    }

    try {
      const registered = globalShortcut.register(shortcut, () => {
        if (win && !win.isDestroyed()) {
          toggleOverlay()
        }
      })

      if (registered) {
        return true
      }

      setTimeout(() => attemptRegister(attempt + 1, maxAttempts), 100 * (attempt + 1))
      return false
    } catch (error) {
      setTimeout(() => attemptRegister(attempt + 1, maxAttempts), 100 * (attempt + 1))
      return false
    }
  }

  setTimeout(() => attemptRegister(), 50)
}

function showDesktopNotification(title, body, filePath) {
  if (notificationWin && !notificationWin.isDestroyed()) {
    notificationWin.close()
    notificationWin = null
  }

  const { screen } = require('electron')
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
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const thisNotificationWin = notificationWin

  thisNotificationWin.setIgnoreMouseEvents(false, { forward: false })
  thisNotificationWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  thisNotificationWin.setAlwaysOnTop(true, 'screen-saver', 1)
  
  thisNotificationWin.loadFile('src/notification/notification.html')
  
  disableDefaultShortcuts(thisNotificationWin)
  
  thisNotificationWin.webContents.once('did-finish-load', () => {
    if (thisNotificationWin && !thisNotificationWin.isDestroyed()) {
      const accentColor = getSetting('accent-color', '#3bbbf6')
      const currentTheme = getSetting('theme', 'system')
      if (currentTheme === 'system') {
        const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        thisNotificationWin.webContents.send('os-theme-changed', effectiveTheme)
      } else {
        thisNotificationWin.webContents.send('theme-changed', currentTheme)
      }
      thisNotificationWin.webContents.send('set-notification-data', {
        title: title,
        body: body,
        accentColor: accentColor,
        filePath: filePath
      })
      
      thisNotificationWin.show()
      
      let opacity = 0
      const fadeInInterval = setInterval(() => {
        if (!thisNotificationWin || thisNotificationWin.isDestroyed()) {
          clearInterval(fadeInInterval)
          return
        }
        opacity += 0.1
        if (opacity >= 1) {
          thisNotificationWin.setOpacity(1)
          clearInterval(fadeInInterval)
          
          setTimeout(() => {
            if (thisNotificationWin && !thisNotificationWin.isDestroyed()) {
              let fadeOpacity = 1
              const startTime = Date.now()
              const duration = 150
              
              const fadeOut = () => {
                if (!thisNotificationWin || thisNotificationWin.isDestroyed()) {
                  return
                }
                const elapsed = Date.now() - startTime
                fadeOpacity = Math.max(0, 1 - (elapsed / duration))
                
                if (fadeOpacity <= 0) {
                  thisNotificationWin.setOpacity(0)
                  thisNotificationWin.close()
                } else {
                  thisNotificationWin.setOpacity(fadeOpacity)
                  setTimeout(fadeOut, 5)
                }
              }
              fadeOut()
            }
          }, 3000)
        } else {
          thisNotificationWin.setOpacity(opacity)
        }
      }, 16)
    }
  })

  thisNotificationWin.on('closed', () => {
    if (notificationWin === thisNotificationWin) {
      notificationWin = null
    }
  })
}

function createOnboardingWindow() {
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    onboardingWin.focus()
    return
  }

  onboardingWin = new BrowserWindow({
    width: 700,
    height: 550,
    minWidth: 700,
    maxWidth: 700,
    minHeight: 550,
    maxHeight: 550,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    resizable: false,
    maximizable: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  onboardingWin.loadFile('src/onboarding/onboarding.html')

  disableDefaultShortcuts(onboardingWin)

  onboardingWin.webContents.once('did-finish-load', () => {
    if (onboardingWin && !onboardingWin.isDestroyed()) {
      const currentTheme = getSetting('theme', 'system')
      if (currentTheme === 'system') {
        const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        onboardingWin.webContents.send('os-theme-changed', effectiveTheme)
      } else {
        onboardingWin.webContents.send('theme-changed', currentTheme)
      }
      
      const currentAccentColor = getSetting('accent-color', '#3bbbf6')
      onboardingWin.webContents.send('accent-color-changed', currentAccentColor)
    }
  })

  onboardingWin.once('ready-to-show', () => {
    onboardingWin.show()
    onboardingWin.focus()
  })

  onboardingWin.on('closed', () => {
    onboardingWin = null
  })
}

function createMainWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    backgroundColor: '#00000000', 
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true, 
    opacity: 0,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('src/renderer/index.html')

  standbyModeEnabled = false

  disableDefaultShortcuts(win)

  win.webContents.once('did-finish-load', () => {
    const currentTheme = getSetting('theme', 'system')
    if (currentTheme === 'system') {
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      win.webContents.send('os-theme-changed', effectiveTheme)
    } else {
      win.webContents.send('theme-changed', currentTheme)
    }
    
    if (process.argv.includes('--restore-annotations')) {
      const tempPath = path.join(app.getPath('userData'), 'relaunch-annotations.json')
      try {
        if (fs.existsSync(tempPath)) {
          const annotationsData = fs.readFileSync(tempPath, 'utf8')
          const parsed = JSON.parse(annotationsData)
          if (parsed && parsed.elements && parsed.elements.length > 0) {
            win.webContents.send('restore-annotations', parsed)
          }
          fs.unlinkSync(tempPath)
        }
      } catch (e) {
        console.error('Error restoring annotations:', e)
        try { fs.unlinkSync(tempPath) } catch (unlinkErr) {}
      }
      setTimeout(() => {
        showOverlay()
      }, 100)
    }
  })

  win.once('ready-to-show', () => {
    ensureAlwaysOnTop()
  })

  win.on('closed', () => {
    win = null
  })

  ipcMain.on('close-window', () => {
    if (win) {
      win.close()
    }
  })

  ipcMain.on('hide-window', () => {
    if (win) {
      visible = false
      
      let opacity = 1
      const fadeInterval = setInterval(() => {
        opacity -= 0.25
        if (opacity <= 0) {
          win.setOpacity(0)
          win.setIgnoreMouseEvents(true, { forward: true })
          win.hide()
          clearInterval(fadeInterval)
        } else {
          win.setOpacity(opacity)
        }
      }, 8) 
      if (win && !win.isDestroyed()) {
      win.webContents.send('draw-mode', false)
      }
    }
  })

  ipcMain.on('focus-window', () => {
    if (win && !win.isDestroyed()) {
      win.focus()
    }
  })

  ipcMain.on('update-shortcut', (event, newShortcut) => {
    shortcut = newShortcut
    setSetting('shortcut', newShortcut)
    registerShortcut()
  })

  app.on('browser-window-focus', () => {
    ensureAlwaysOnTop()
    registerShortcut()
  })

  app.on('browser-window-blur', () => {
    setTimeout(() => {
      ensureAlwaysOnTop()
      registerShortcut()
    }, 100)
  })

  win.on('show', () => {
    ensureAlwaysOnTop()
    registerShortcut()
  })

  win.on('focus', () => {
    ensureAlwaysOnTop()
    registerShortcut()
  })

  win.on('blur', () => {
    setTimeout(() => {
      ensureAlwaysOnTop()
      registerShortcut()
    }, 100)
  })

  setInterval(() => {
    if (win && !win.isDestroyed()) {
      ensureAlwaysOnTop()
      if (shortcut && !globalShortcut.isRegistered(shortcut)) {
        registerShortcut()
      }
    }
  }, 2000)

  setInterval(() => {
    if (win && !win.isDestroyed() && visible) {
      ensureAlwaysOnTop()
    }
  }, 1000) 

  ipcMain.on('open-settings', () => {
    if (win && !win.isDestroyed() && visible) {
      visible = false
      win.setOpacity(0)
      win.setIgnoreMouseEvents(true, { forward: true })
      win.hide()
      if (win && !win.isDestroyed()) {
      win.webContents.send('draw-mode', false)
      }
    }
    
    if (settingsWin && !settingsWin.isDestroyed()) {
      if (settingsWin.isMinimized()) settingsWin.restore()
      settingsWin.focus()
      return
    }

    settingsWin = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 550,
      frame: false,
      autoHideMenuBar: true,
      show: false,
      icon: iconPath,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    settingsWin.loadFile('src/settings/settings.html')

    disableDefaultShortcuts(settingsWin)

    settingsWin.webContents.once('did-finish-load', () => {
      if (settingsWin && !settingsWin.isDestroyed()) {
        const currentTheme = getSetting('theme', 'system')
        if (currentTheme === 'system') {
          const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
          settingsWin.webContents.send('os-theme-changed', effectiveTheme)
        } else {
          settingsWin.webContents.send('theme-changed', currentTheme)
        }
      }
    })

    settingsWin.once('ready-to-show', () => {
      settingsWin.show()
      settingsWin.focus()
      if (settingsWin && !settingsWin.isDestroyed()) {
        const showTrayIcon = getSetting('show-tray-icon', true)
        const launchOnStartup = getSetting('launch-on-startup', false)
        settingsWin.webContents.send('sync-system-settings', {
          showTrayIcon,
          launchOnStartup
        })
      }
    })

    settingsWin.on('closed', () => {
      settingsWin = null
      if (win && !win.isDestroyed()) {
        const standbyInToolbar = getSetting('standby-in-toolbar', true)
        const reduceClutter = getSetting('reduce-clutter', true)
        win.webContents.send('sync-toolbar-settings', { standbyInToolbar, reduceClutter })
      }
    })
  })

  ipcMain.on('window-minimize', (event) => {
    const senderId = event.sender.id
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderId) {
      settingsWin.minimize()
    } else if (onboardingWin && !onboardingWin.isDestroyed() && onboardingWin.webContents.id === senderId) {
      onboardingWin.minimize()
    }
  })

  ipcMain.on('window-maximize', (event) => {
    const senderId = event.sender.id
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderId) {
      if (settingsWin.isMaximized()) {
        settingsWin.unmaximize()
      } else {
        settingsWin.maximize()
      }
    }
  })

  ipcMain.on('window-close', (event) => {
    const senderId = event.sender.id
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderId) {
      settingsWin.close()
    } else if (onboardingWin && !onboardingWin.isDestroyed() && onboardingWin.webContents.id === senderId) {
      onboardingWin.close()
    }
  })

  ipcMain.on('theme-changed', (event, theme) => {
    if (theme === 'system') {
      nativeTheme.themeSource = 'system'
    } else if (theme === 'light') {
      nativeTheme.themeSource = 'light'
    } else if (theme === 'dark') {
      nativeTheme.themeSource = 'dark'
    }
    
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme-changed', theme)
    }
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('theme-changed', theme)
    }
    if (notificationWin && !notificationWin.isDestroyed()) {
      notificationWin.webContents.send('theme-changed', theme)
    }
  })

  ipcMain.handle('get-os-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  nativeTheme.on('updated', () => {
    const currentTheme = getSetting('theme', 'system')
    if (currentTheme === 'system') {
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      if (win && !win.isDestroyed()) {
        win.webContents.send('os-theme-changed', effectiveTheme)
      }
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.webContents.send('os-theme-changed', effectiveTheme)
      }
      if (onboardingWin && !onboardingWin.isDestroyed()) {
        onboardingWin.webContents.send('os-theme-changed', effectiveTheme)
      }
      if (notificationWin && !notificationWin.isDestroyed()) {
        notificationWin.webContents.send('os-theme-changed', effectiveTheme)
      }
    }
  })

  ipcMain.on('accent-color-changed', (event, color) => {
    setSetting('accent-color', color)
    if (win && !win.isDestroyed()) {
      win.webContents.send('accent-color-changed', color)
    }
    if (onboardingWin && !onboardingWin.isDestroyed()) {
      onboardingWin.webContents.send('accent-color-changed', color)
    }
  })


  ipcMain.on('layout-changed', (event, layout) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('layout-changed', layout)
    }
  })

  ipcMain.on('sounds-changed', (event, enabled) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('sounds-changed', enabled)
    }
  })

  ipcMain.on('show-onboarding', () => {
    createOnboardingWindow()
  })

  ipcMain.on('reset-everything', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('reset-everything')
    }
  })

  ipcMain.on('toggle-tray-icon', (event, show) => {
    if (show) {
      if (!tray) {
        createTray()
      }
    } else {
      destroyTray()
    }
    setSetting('show-tray-icon', show)
  })

  ipcMain.on('set-auto-launch', (event, enabled) => {
    if (process.platform === 'win32') {
      manageStartupShortcut(enabled)
    } else if (process.platform === 'darwin') {
      const settings = {
        openAtLogin: enabled,
        openAsHidden: true
      }
      app.setLoginItemSettings(settings)
    }
    setSetting('launch-on-startup', enabled)
  })

  ipcMain.on('screenshot-notification-changed', (event, enabled) => {
    setSetting('screenshot-notification', enabled)
  })

  ipcMain.on('copy-snapshot-clipboard-changed', (event, enabled) => {
    setSetting('copy-snapshot-clipboard', enabled)
  })

ipcMain.on('optimized-rendering-changed', (event, enabled) => {
  setSetting('optimized-rendering', enabled)
})

ipcMain.on('hardware-acceleration-changed', (event, enabled) => {
  setSetting('hardware-acceleration', enabled)
})

ipcMain.handle('show-relaunch-dialog', async (event, settingName) => {
  return await dialogs.showRelaunchDialog(settingsWin, settingName)
})

  ipcMain.on('reduce-clutter-changed', (event, enabled) => {
    setSetting('reduce-clutter', enabled)
    if (win && !win.isDestroyed()) {
      win.webContents.send('reduce-clutter-changed', enabled)
    }
  })

  ipcMain.on('disable-toolbar-moving-changed', (event, enabled) => {
    setSetting('disable-toolbar-moving', enabled)
    if (win && !win.isDestroyed()) {
      win.webContents.send('disable-toolbar-moving-changed', enabled)
    }
  })

  ipcMain.on('standby-in-toolbar-changed', (event, enabled) => {
    setSetting('standby-in-toolbar', enabled)
    if (win && !win.isDestroyed()) {
      win.webContents.send('standby-in-toolbar-changed', enabled)
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('standby-in-toolbar-changed', enabled)
        }
      }, 100)
    }
  })

  ipcMain.on('set-standby-mode', (event, enabled) => {
    standbyModeEnabled = enabled
    if (win && !win.isDestroyed()) {
      if (enabled) {
        win.setIgnoreMouseEvents(true)
        startStandbyPolling()
      } else {
        win.setIgnoreMouseEvents(false)
        stopStandbyPolling()
        toolbarBounds = null
      }
    }
  })

  ipcMain.on('update-toolbar-bounds', (event, bounds) => {
    toolbarBounds = bounds
  })

  ipcMain.on('toolbar-bg-changed', (event, data) => {
    setSetting('toolbar-accent-bg', data.enabled)
    if (win && !win.isDestroyed()) {
      win.webContents.send('toolbar-bg-changed', data)
    }
  })

  ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

function getWindowsVersion() {
  if (process.platform !== 'win32') {
    return null
  }
  
  try {
    const { execSync } = require('child_process')
    
    let buildNumber = 0
    try {
      const regQueryBuild = 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v CurrentBuild'
      const resultBuild = execSync(regQueryBuild, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const matchBuild = resultBuild.match(/CurrentBuild\s+REG_SZ\s+(\d+)/)
      if (matchBuild) {
        buildNumber = parseInt(matchBuild[1])
      }
    } catch (e) {
      try {
        const regQueryBuildAlt = 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v CurrentBuildNumber'
        const resultBuildAlt = execSync(regQueryBuildAlt, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const matchBuildAlt = resultBuildAlt.match(/CurrentBuildNumber\s+REG_SZ\s+(\d+)/)
        if (matchBuildAlt) {
          buildNumber = parseInt(matchBuildAlt[1])
        }
      } catch (e2) {
        const release = os.release()
        const parts = release.split('.')
        if (parts.length >= 2) {
          buildNumber = parseInt(parts[2]) || 0
        }
      }
    }
    
    let versionName = 'Windows'
    if (buildNumber >= 22000) {
      versionName = 'Windows 11'
    } else if (buildNumber >= 10240) {
      versionName = 'Windows 10'
    } else if (buildNumber >= 9200) {
      versionName = 'Windows 8.1'
    } else if (buildNumber >= 7600) {
      versionName = 'Windows 7'
    }
    
    let buildVersion = ''
    try {
      const regQuery = 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v DisplayVersion'
      const result = execSync(regQuery, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const match = result.match(/DisplayVersion\s+REG_SZ\s+(.+)/)
      if (match) {
        buildVersion = match[1].trim()
      }
    } catch (e) {
      try {
        const regQueryRelease = 'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ReleaseId'
        const resultRelease = execSync(regQueryRelease, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const matchRelease = resultRelease.match(/ReleaseId\s+REG_SZ\s+(.+)/)
        if (matchRelease) {
          buildVersion = matchRelease[1].trim()
        }
      } catch (e2) {
      }
    }
    
    if (buildVersion) {
      return `${versionName} (${buildVersion})`
    } else {
      return versionName
    }
  } catch (error) {
    console.error('Error getting Windows version:', error)
    const release = os.release()
    const parts = release.split('.')
    if (parts.length >= 2) {
      const buildNum = parseInt(parts[2]) || 0
      if (buildNum >= 22000) {
        return 'Windows 11'
      } else if (buildNum >= 10240) {
        return 'Windows 10'
      }
    }
    return 'Windows'
  }
}

ipcMain.handle('get-system-info', () => {
  const systemInfo = {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  }
  
  if (process.platform === 'win32') {
    systemInfo.osVersion = getWindowsVersion()
  } else if (process.platform === 'darwin') {
    systemInfo.osVersion = `macOS ${os.release()}`
  } else {
    systemInfo.osVersion = `${process.platform} ${os.release()}`
  }
  
  return systemInfo
})

ipcMain.handle('show-system-details-dialog', async () => {
  const systemInfo = {
    version: app.getVersion(),
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    osVersion: process.platform === 'win32' ? getWindowsVersion() : 
               process.platform === 'darwin' ? `macOS ${os.release()}` : 
               `${process.platform} ${os.release()}`
  }
  await dialogs.showSystemDetailsDialog(settingsWin, systemInfo)
})

ipcMain.handle('show-reset-confirmation', async (event) => {
  return await dialogs.showResetConfirmation(settingsWin)
})

ipcMain.handle('show-settings-reset-dialog', async () => {
  await dialogs.showSettingsResetDialog(settingsWin)
})

ipcMain.handle('show-duplicate-warning', async (event, elementCount) => {
  const dismissedDialogs = getSetting('dismissed-dialogs', {})
  if (dismissedDialogs['duplicate-warning']) {
    return true
  }
  
  const result = await dialogs.showDuplicateWarning(win, elementCount)
  
  if (result.dontShowAgain && result.confirmed) {
    dismissedDialogs['duplicate-warning'] = true
    setSetting('dismissed-dialogs', dismissedDialogs)
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('dismissed-dialogs-updated')
    }
  }
  
  return result.confirmed
})

ipcMain.handle('get-dismissed-dialogs', () => {
  return getSetting('dismissed-dialogs', {})
})

ipcMain.on('reset-dismissed-dialog', (event, dialogId) => {
  const dismissedDialogs = getSetting('dismissed-dialogs', {})
  delete dismissedDialogs[dialogId]
  setSetting('dismissed-dialogs', dismissedDialogs)
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('dismissed-dialogs-updated')
  }
})

ipcMain.on('reset-all-dismissed-dialogs', () => {
  setSetting('dismissed-dialogs', {})
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('dismissed-dialogs-updated')
  }
})

ipcMain.on('auto-save-snapshots-changed', (event, enabled) => {
    setSetting('auto-save-snapshots', enabled)
    if (win && !win.isDestroyed()) {
      win.webContents.send('auto-save-snapshots-changed', enabled)
    }
  })

  ipcMain.on('save-directory-changed', (event, directoryPath) => {
    if (!directoryPath || directoryPath.trim() === '') {
      setSetting('save-directory-path', null)
    } else {
      setSetting('save-directory-path', directoryPath)
    }
  })

  ipcMain.handle('select-save-directory', async () => {
    return await dialogs.selectSaveDirectory(win)
  })

  ipcMain.handle('check-directory-exists', async (event, directoryPath) => {
    if (!directoryPath) return false
    try {
      if (fs.existsSync(directoryPath)) {
        const stats = fs.statSync(directoryPath)
        return stats.isDirectory()
      }
      return false
    } catch (error) {
      return false
    }
  })

  ipcMain.on('close-notification', () => {
    if (notificationWin && !notificationWin.isDestroyed()) {
      notificationWin.close()
      notificationWin = null
    }
  })

  ipcMain.on('open-screenshot-file', async (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      const { shell } = require('electron')
      try {
        await shell.openPath(filePath)
      } catch (error) {
        console.error('Error opening file:', error)
      }
    }
  })

  ipcMain.on('get-system-settings', (event) => {
    event.returnValue = {
      standbyInToolbar: getSetting('standby-in-toolbar', true),
      showTrayIcon: getSetting('show-tray-icon', true),
      launchOnStartup: getSetting('launch-on-startup', false)
    }
  })

  ipcMain.handle('capture-desktop', async () => {
    try {
      const { screen } = require('electron')
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size
      
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      })
      
      if (sources.length > 0) {
        
        const primarySource = sources.find(source => source.id.includes('screen:0')) || sources[0]
        return primarySource.thumbnail.toDataURL()
      }
      return null
    } catch (error) {
      console.error('Error capturing desktop:', error)
      return null
    }
  })

  ipcMain.handle('open-capture-overlay', () => {
    try {
      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        captureOverlayWin.focus()
        return
      }

      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        captureOverlayWin.destroy()
      }
      captureOverlayWin = null

      captureOverlayActive = true
      
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(true, { forward: false })
        win.setAlwaysOnTop(false)
        setTimeout(() => {
          if (win && !win.isDestroyed() && captureOverlayWin && !captureOverlayWin.isDestroyed()) {
            captureOverlayWin.moveTop()
            try {
              captureOverlayWin.setAlwaysOnTop(true, 'screen-saver', 1)
            } catch (e) {
              captureOverlayWin.setAlwaysOnTop(true)
            }
          }
        }, 50)
      }

      const { screen } = require('electron')
      
      let targetDisplay = screen.getPrimaryDisplay()
      
      if (win && !win.isDestroyed()) {
        const winBounds = win.getBounds()
        const displays = screen.getAllDisplays()
        
        for (const display of displays) {
          const bounds = display.bounds
          if (winBounds.x >= bounds.x && winBounds.x < bounds.x + bounds.width &&
              winBounds.y >= bounds.y && winBounds.y < bounds.y + bounds.height) {
            targetDisplay = display
            break
          }
        }
      }

      const bounds = targetDisplay.bounds
      const size = targetDisplay.size

      captureOverlayWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: size.width,
        height: size.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          backgroundThrottling: false
        }
      })

      try {
        captureOverlayWin.setAlwaysOnTop(true, 'screen-saver', 1)
      } catch (e) {
        captureOverlayWin.setAlwaysOnTop(true)
      }

      captureOverlayWin.setIgnoreMouseEvents(false)
      
      captureOverlayWin.webContents.once('did-finish-load', () => {
        let accentColor = '#3bbbf6'
        if (win && !win.isDestroyed()) {
          win.webContents.executeJavaScript('localStorage.getItem("accent-color")')
            .then((color) => { if (color) accentColor = color })
            .catch(() => {})
        }
        if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
          captureOverlayWin.webContents.send('set-accent-color', accentColor)
        }
      })
      
      captureOverlayWin.loadFile('src/capture/capture-overlay.html')
      
      disableDefaultShortcuts(captureOverlayWin)
      
      captureOverlayWin.once('ready-to-show', () => {
        const currentDisplay = screen.getDisplayMatching(captureOverlayWin.getBounds())
        captureOverlayWin.setBounds({
          x: currentDisplay.bounds.x,
          y: currentDisplay.bounds.y,
          width: currentDisplay.size.width,
          height: currentDisplay.size.height
        })
        captureOverlayWin.show()
        captureOverlayWin.focus()
        captureOverlayWin.moveTop()
        try {
          captureOverlayWin.setAlwaysOnTop(true, 'screen-saver', 1)
        } catch (e) {
          captureOverlayWin.setAlwaysOnTop(true)
        }
      })
      
      captureOverlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      const captureContextMenu = Menu.buildFromTemplate([
        { 
          label: 'Select All', 
          click: () => {
            if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
              captureOverlayWin.webContents.send('select-all-screen')
            }
          }
        },
        { type: 'separator' },
        { 
          label: 'Cancel', 
          click: () => {
            if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
              captureOverlayWin.destroy()
              captureOverlayWin = null
            }
            captureOverlayActive = false
            if (win && !win.isDestroyed()) {
              restoreMouseEvents()
              ensureAlwaysOnTop()
              if (!visible) {
                win.show()
              }
              win.webContents.send('capture-cancelled')
            }
          }
        }
      ])

      captureOverlayWin.webContents.on('context-menu', (e, params) => {
        captureContextMenu.popup()
      })

      captureOverlayWin.on('closed', () => {
        captureOverlayActive = false
        if (win && !win.isDestroyed()) {
          restoreMouseEvents()
          ensureAlwaysOnTop()
          if (!visible) {
            win.show()
          }
        }
        captureOverlayWin = null
      })
    } catch (error) {
      console.error('Error opening capture overlay:', error)
      captureOverlayActive = false
      if (win && !win.isDestroyed()) {
        restoreMouseEvents()
        ensureAlwaysOnTop()
      }
    }
  })

  ipcMain.on('capture-selection', async (event, bounds) => {
    let overlayBounds = null
    
    try {
      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        overlayBounds = captureOverlayWin.getBounds()
        captureOverlayWin.destroy()
        captureOverlayWin = null
      }

      captureOverlayActive = false
      if (win && !win.isDestroyed()) {
        restoreMouseEvents()
        ensureAlwaysOnTop()
        if (!visible) {
          win.show()
        }
      }

      if (!overlayBounds || !bounds || bounds.width < 10 || bounds.height < 10) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('capture-selection-result', null)
        }
        return
      }
      
      const { screen } = require('electron')
      
      let targetDisplay = screen.getPrimaryDisplay()
      
      if (win && !win.isDestroyed()) {
        const winBounds = win.getBounds()
        const displays = screen.getAllDisplays()
        
        for (const display of displays) {
          const displayBounds = display.bounds
          if (winBounds.x >= displayBounds.x && winBounds.x < displayBounds.x + displayBounds.width &&
              winBounds.y >= displayBounds.y && winBounds.y < displayBounds.y + displayBounds.height) {
            targetDisplay = display
            break
          }
        }
      }

      const displayBounds = targetDisplay.bounds
      const { width, height } = targetDisplay.size
      
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      })
      
      if (sources.length === 0) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('capture-selection-result', null)
        }
        return
      }

      let targetSource = null
      const displayId = targetDisplay.id
      
      for (const source of sources) {
        if (source.display_id === displayId || 
            (displayId === screen.getPrimaryDisplay().id && source.id.includes('screen:0'))) {
          targetSource = source
          break
        }
      }
      
      if (!targetSource) {
        targetSource = sources[0]
      }
      
      const img = targetSource.thumbnail
      
      const relativeX = bounds.x - overlayBounds.x
      const relativeY = bounds.y - overlayBounds.y
      
      const cropped = img.crop({
        x: Math.max(0, Math.min(relativeX, width - 1)),
        y: Math.max(0, Math.min(relativeY, height - 1)),
        width: Math.min(bounds.width, width - Math.max(0, relativeX)),
        height: Math.min(bounds.height, height - Math.max(0, relativeY))
      })
      
      if (win && !win.isDestroyed()) {
        win.webContents.send('capture-selection-result', cropped.toDataURL(), bounds)
      }
    } catch (error) {
      console.error('Error capturing selection:', error)
      if (win && !win.isDestroyed()) {
        restoreMouseEvents()
        win.webContents.send('capture-selection-result', null)
      }
      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        captureOverlayWin.destroy()
        captureOverlayWin = null
      }
      captureOverlayActive = false
      if (win && !win.isDestroyed()) {
        ensureAlwaysOnTop()
      }
    }
  })

  ipcMain.on('cancel-capture', () => {
    if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
      captureOverlayWin.destroy()
      captureOverlayWin = null
    }
      captureOverlayActive = false
      if (win && !win.isDestroyed()) {
        restoreMouseEvents()
        ensureAlwaysOnTop()
        if (!visible) {
          win.show()
        }
        win.webContents.send('capture-cancelled')
      }
  })

  ipcMain.on('save-screenshot', async (event, dataURL, defaultFilename) => {
    try {
      if (!win || win.isDestroyed()) return

      const copyToClipboard = getSetting('copy-snapshot-clipboard', false)
      const autoSaveEnabled = getSetting('auto-save-snapshots', false)
      const saveDirectory = getSetting('save-directory-path', null)
      const hasValidDirectory = saveDirectory?.trim() && fs.existsSync(saveDirectory)
      
      let savedFilePath = null
      let clipboardCopied = false
      const img = nativeImage.createFromDataURL(dataURL)
      
      if (copyToClipboard) {
        try {
          clipboard.writeImage(img)
          clipboardCopied = true
        } catch (error) {
          console.error('Error copying to clipboard:', error)
        }
      }

      if (autoSaveEnabled && hasValidDirectory) {
        try {
          const buffer = img.toPNG()
          savedFilePath = path.join(saveDirectory, `annotation-${Date.now()}.png`)
          fs.writeFileSync(savedFilePath, buffer)
        } catch (error) {
          console.error('Error auto-saving screenshot:', error)
          dialogs.showErrorBox('Auto-Save Error', 'Failed to auto-save screenshot. Please check your save directory settings.')
        }
      }

      if (!savedFilePath && (autoSaveEnabled ? !hasValidDirectory : !copyToClipboard)) {
        const result = await dialogs.showSaveScreenshotDialog(win, defaultFilename)

        if (!result.canceled && result.filePath) {
          try {
            fs.writeFileSync(result.filePath, img.toPNG())
            savedFilePath = result.filePath
          } catch (error) {
            console.error('Error saving screenshot:', error)
            dialogs.showErrorBox('Save Error', 'Failed to save screenshot. Please try again.')
          }
        }
      }
      
      const showNotification = getSetting('screenshot-notification', true)
      
      setTimeout(() => {
        if (clipboardCopied && savedFilePath) {
          showDesktopNotification('Screenshot Saved & Copied', 'Saved and copied to clipboard', savedFilePath)
        } else if (clipboardCopied) {
          if (showNotification) {
            showDesktopNotification('Screenshot Copied', 'Copied to clipboard', null)
          }
        } else if (savedFilePath) {
          if (showNotification) {
            showDesktopNotification('Screenshot Saved', 'Screenshot saved successfully', savedFilePath)
          }
        }
      }, 100)
      
      if (win && !win.isDestroyed()) {
        win.webContents.send('screenshot-saved')
      }
    } catch (error) {
      console.error('Error showing save dialog:', error)
      if (win && !win.isDestroyed()) {
        win.webContents.send('screenshot-saved')
      }
    }
  })

  const savedShortcut = getSetting('shortcut', 'Control+Shift+D')
  if (savedShortcut) {
    shortcut = savedShortcut
  }
  
  const savedAccentColor = getSetting('accent-color', '#3bbbf6')
  if (savedAccentColor && win && !win.isDestroyed()) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.executeJavaScript(`localStorage.setItem('accent-color', '${savedAccentColor}')`)
      win.webContents.send('accent-color-changed', savedAccentColor)
    })
  }

  const showTrayIcon = getSetting('show-tray-icon', true)
  if (showTrayIcon) {
    createTray()
  } else {
    destroyTray()
  }
    
  const launchOnStartup = getSetting('launch-on-startup', false)
  if (process.platform === 'win32') {
    manageStartupShortcut(launchOnStartup)
  } else if (process.platform === 'darwin') {
    const settings = {
      openAtLogin: launchOnStartup,
      openAsHidden: true
    }
    app.setLoginItemSettings(settings)
  }

  registerShortcut()
  
  setTimeout(() => registerShortcut(), 500)
  setTimeout(() => registerShortcut(), 1000)
}

function getWindowsAccentColor() {
  if (process.platform === 'win32') {
    try {
      if (systemPreferences.getAccentColor) {
        const accentColor = systemPreferences.getAccentColor()
        return `#${accentColor}`
      }
    } catch (error) {
      console.error('Error getting Windows accent color via systemPreferences:', error)
    }
    
    try {
      const { execSync } = require('child_process')
      const regQuery = 'reg query "HKCU\\Software\\Microsoft\\Windows\\DWM" /v ColorizationColor'
      const result = execSync(regQuery, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      
      const match = result.match(/0x([0-9a-fA-F]{8})/i)
      if (match) {
        const dwordValue = parseInt(match[1], 16)
        const b = (dwordValue >> 16) & 0xFF
        const g = (dwordValue >> 8) & 0xFF
        const r = dwordValue & 0xFF
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        return hexColor
      }
    } catch (regError) {
      console.error('Error reading accent color from registry:', regError)
    }
    
    return null
  }
  return null
}

ipcMain.handle('get-windows-accent-color', () => {
  return getWindowsAccentColor()
})

let windowsAccentSyncEnabled = false

ipcMain.on('toggle-windows-accent-sync', (event, enabled) => {
  windowsAccentSyncEnabled = enabled
  setSetting('sync-windows-accent-auto', enabled)
})

ipcMain.handle('get-sync-windows-accent-state', () => {
  return windowsAccentSyncEnabled || getSetting('sync-windows-accent-auto', false)
})

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    const syncEnabled = getSetting('sync-windows-accent-auto', false)
    windowsAccentSyncEnabled = syncEnabled
    
    if (systemPreferences.on) {
      systemPreferences.on('accent-color-changed', () => {
        if (windowsAccentSyncEnabled) {
          const newColor = getWindowsAccentColor()
          if (newColor) {
            setSetting('accent-color', newColor)
            if (win && !win.isDestroyed()) {
              win.webContents.send('accent-color-changed', newColor)
              win.webContents.send('windows-accent-color-changed', newColor)
            }
            if (settingsWin && !settingsWin.isDestroyed()) {
              settingsWin.webContents.send('accent-color-changed', newColor)
              settingsWin.webContents.send('windows-accent-color-changed', newColor)
            }
            if (onboardingWin && !onboardingWin.isDestroyed()) {
              onboardingWin.webContents.send('accent-color-changed', newColor)
              onboardingWin.webContents.send('windows-accent-color-changed', newColor)
            }
          }
        }
      })
    }
  }
})

ipcMain.on('onboarding-complete', (event, data) => {
  if (data.shortcut) {
    shortcut = data.shortcut
    setSetting('shortcut', data.shortcut)
  }
  if (data.accentColor) {
    setSetting('accent-color', data.accentColor)
  }
  setSetting('onboarding-completed', true)
  
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    onboardingWin.close()
  }
  
  if (!win || win.isDestroyed()) {
    createMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          showOverlay()
        }, 100)
      })
    }
  } else {
    if (data.shortcut) {
      registerShortcut()
    }
    if (data.accentColor && win && !win.isDestroyed()) {
      win.webContents.executeJavaScript(`localStorage.setItem('accent-color', '${data.accentColor}')`)
      win.webContents.send('accent-color-changed', data.accentColor)
    }
    showOverlay()
  }
})

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const currentShortcut = shortcut || getSetting('shortcut', 'Control+Shift+D')
    const formattedShortcut = currentShortcut
      .replace(/Control/g, 'Ctrl')
      .replace(/Meta/g, 'Cmd')
      .split('+')
      .map(k => k.charAt(0).toUpperCase() + k.slice(1).toLowerCase())
      .join('+')
    
    dialogs.showSecondInstanceWarning(formattedShortcut)
    
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.focus()
    } else if (settingsWin && !settingsWin.isDestroyed()) {
      if (settingsWin.isMinimized()) settingsWin.restore()
      settingsWin.focus()
    } else if (onboardingWin && !onboardingWin.isDestroyed()) {
      if (onboardingWin.isMinimized()) onboardingWin.restore()
      onboardingWin.focus()
    } else {
      const onboardingCompleted = getSetting('onboarding-completed', false)
      if (!onboardingCompleted) {
        createOnboardingWindow()
      } else {
        createMainWindow()
      }
    }
  })

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('creatoryocreations.cycannotate')
    }
    
    const savedTheme = getSetting('theme', 'system')
    if (savedTheme === 'system') {
      nativeTheme.themeSource = 'system'
    } else if (savedTheme === 'light') {
      nativeTheme.themeSource = 'light'
    } else if (savedTheme === 'dark') {
      nativeTheme.themeSource = 'dark'
    } else {
      nativeTheme.themeSource = 'system'
    }
    
    if (!process.argv.includes('--restore-annotations')) {
      const tempPath = path.join(app.getPath('userData'), 'relaunch-annotations.json')
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath)
        }
      } catch (e) {
      }
    }
    
    const onboardingCompleted = getSetting('onboarding-completed', false)
    
    if (!onboardingCompleted) {
      createOnboardingWindow()
    } else {
      createMainWindow()
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    return
  }
  ensureAlwaysOnTop()
  registerShortcut()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
    captureOverlayWin.destroy()
    captureOverlayWin = null
  }
  if (notificationWin && !notificationWin.isDestroyed()) {
    notificationWin.destroy()
    notificationWin = null
  }
})