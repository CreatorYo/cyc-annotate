const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, desktopCapturer, nativeImage, dialog, Notification } = require('electron')
const fs = require('fs')
const path = require('path')

let win
let settingsWin
let onboardingWin = null
let captureOverlayWin = null
let notificationWin = null
let tray
let visible = false
let shortcut = 'Control+Shift+D'

function ensureAlwaysOnTop() {
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
    settings[key] = value
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch (e) {
  }
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
    const iconPath = path.join(__dirname, '../../icon.png')
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath)
    } else {
      const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
      tray = new Tray(icon)
    }
    
    tray.setToolTip('Annotate Tool')

    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Clear Canvas', click: () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('clear')
        }
      }},
      { label: 'Take Screenshot', click: () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('trigger-capture')
        }
      }},
      { type: 'separator' },
      { label: 'Settings', click: () => {
        if (settingsWin) {
          settingsWin.focus()
        } else {
          ipcMain.emit('open-settings')
        }
      }},
      { type: 'separator' },
      { label: 'Quit CYC Annotoate', click: () => app.quit() }
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

function toggleOverlay() {
  
  if (!win || win.isDestroyed()) {
    console.warn('Window not available for toggle')
    return
  }

  visible = !visible

  if (visible) {
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
  } else {
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
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('draw-mode', visible)
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  notificationWin.setIgnoreMouseEvents(false, { forward: false })
  notificationWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  notificationWin.setAlwaysOnTop(true, 'screen-saver', 1)
  
  notificationWin.loadFile('src/notification/notification.html')
  
  notificationWin.webContents.once('did-finish-load', () => {
    if (notificationWin && !notificationWin.isDestroyed()) {
      const accentColor = getSetting('accent-color', '#40E0D0')
      notificationWin.webContents.send('set-notification-data', {
        title: title,
        body: body,
        accentColor: accentColor,
        filePath: filePath
      })
      
      notificationWin.show()
      
      let opacity = 0
      const fadeInInterval = setInterval(() => {
        if (!notificationWin || notificationWin.isDestroyed()) {
          clearInterval(fadeInInterval)
          return
        }
        opacity += 0.1
        if (opacity >= 1) {
          notificationWin.setOpacity(1)
          clearInterval(fadeInInterval)
          
          setTimeout(() => {
            if (notificationWin && !notificationWin.isDestroyed()) {
              let fadeOpacity = 1
              const startTime = Date.now()
              const duration = 150
              
              const fadeOut = () => {
                if (!notificationWin || notificationWin.isDestroyed()) {
                  return
                }
                const elapsed = Date.now() - startTime
                fadeOpacity = Math.max(0, 1 - (elapsed / duration))
                
                if (fadeOpacity <= 0) {
                  notificationWin.setOpacity(0)
                  notificationWin.close()
                  notificationWin = null
                } else {
                  notificationWin.setOpacity(fadeOpacity)
                  setTimeout(fadeOut, 5)
                }
              }
              fadeOut()
            }
          }, 3000)
        } else {
          notificationWin.setOpacity(opacity)
        }
      }, 16)
    }
  })

  notificationWin.on('closed', () => {
    notificationWin = null
  })
}

function createOnboardingWindow() {
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    onboardingWin.focus()
    return
  }

  onboardingWin = new BrowserWindow({
    width: 800,
    height: 650,
    minWidth: 700,
    minHeight: 550,
    frame: true,
    title: 'Welcome to CYC Annotate',
    autoHideMenuBar: true,
    show: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  onboardingWin.loadFile('src/onboarding/onboarding.html')

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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('src/renderer/index.html')

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

  ipcMain.on('update-shortcut', (event, newShortcut) => {
    shortcut = newShortcut
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
    
    if (settingsWin) {
      settingsWin.focus()
      return
    }

    settingsWin = new BrowserWindow({
      width: 750,
      height: 700,
      minWidth: 600,
      minHeight: 550,
      frame: true,
      title: 'Settings - CYC Annotate',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    settingsWin.loadFile('src/settings/settings.html')

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
    })
  })

  ipcMain.on('theme-changed', (event, theme) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme-changed', theme)
    }
  })

  ipcMain.on('accent-color-changed', (event, color) => {
    setSetting('accent-color', color)
    if (win && !win.isDestroyed()) {
      win.webContents.send('accent-color-changed', color)
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
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true
    })
    setSetting('launch-on-startup', enabled)
  })

  ipcMain.on('screenshot-notification-changed', (event, enabled) => {
    setSetting('screenshot-notification', enabled)
  })

  ipcMain.on('reduce-clutter-changed', (event, enabled) => {
    setSetting('reduce-clutter', enabled)
    if (win && !win.isDestroyed()) {
      win.webContents.send('reduce-clutter-changed', enabled)
    }
  })

  ipcMain.on('auto-save-snapshots-changed', (event, enabled) => {
    setSetting('auto-save-snapshots', enabled)
  })

  ipcMain.on('save-directory-changed', (event, directoryPath) => {
    setSetting('save-directory-path', directoryPath)
  })

  ipcMain.handle('select-save-directory', async () => {
    if (!win || win.isDestroyed()) return { canceled: true }
    
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Save Directory',
      properties: ['openDirectory']
    })
    
    return result
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

      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(true, { forward: true })
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

      captureOverlayWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: true,
        show: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          backgroundThrottling: false
        }
      })

      captureOverlayWin.setIgnoreMouseEvents(false)
      
      captureOverlayWin.webContents.once('did-finish-load', () => {
        let accentColor = '#40E0D0'
        
        if (win && !win.isDestroyed()) {
          win.webContents.executeJavaScript('localStorage.getItem("accent-color")').then((color) => {
            if (color) {
              accentColor = color
            }
            if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
              captureOverlayWin.webContents.send('set-accent-color', accentColor)
            }
          }).catch(() => {
            if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
              captureOverlayWin.webContents.send('set-accent-color', accentColor)
            }
          })
        } else {
          if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
            captureOverlayWin.webContents.send('set-accent-color', accentColor)
          }
        }
      })
      
      captureOverlayWin.loadFile('src/capture/capture-overlay.html')
      captureOverlayWin.focus()
      captureOverlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      captureOverlayWin.on('closed', () => {
        if (win && !win.isDestroyed()) {
          win.setIgnoreMouseEvents(false)
        }
        captureOverlayWin = null
      })
    } catch (error) {
      console.error('Error opening capture overlay:', error)
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(false)
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

      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(false)
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
        win.setIgnoreMouseEvents(false)
        win.webContents.send('capture-selection-result', null)
      }
      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        captureOverlayWin.destroy()
        captureOverlayWin = null
      }
    }
  })

  ipcMain.on('cancel-capture', () => {
    if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
      captureOverlayWin.destroy()
      captureOverlayWin = null
    }
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(false)
      win.webContents.send('capture-cancelled')
    }
  })

  ipcMain.on('save-screenshot', async (event, dataURL, defaultFilename) => {
    try {
      if (!win || win.isDestroyed()) return

      const result = await dialog.showSaveDialog(win, {
        title: 'Save Screenshot',
        defaultPath: defaultFilename,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePath) {
        try {
          const img = nativeImage.createFromDataURL(dataURL)
          const buffer = img.toPNG()
          fs.writeFileSync(result.filePath, buffer)
          
          const showNotification = getSetting('screenshot-notification', true)
          if (showNotification && result.filePath) {
            setTimeout(() => {
              showDesktopNotification('Screenshot Saved', 'Screenshot saved successfully', result.filePath)
            }, 100)
          }
        } catch (error) {
          console.error('Error saving screenshot:', error)
          dialog.showErrorBox('Save Error', 'Failed to save screenshot. Please try again.')
        }
      }
      
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
  
  const savedAccentColor = getSetting('accent-color', '#40E0D0')
  if (savedAccentColor && win && !win.isDestroyed()) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.executeJavaScript(`localStorage.setItem('accent-color', '${savedAccentColor}')`)
    })
  }

  const showTrayIcon = getSetting('show-tray-icon', true)
  if (showTrayIcon) {
    createTray()
  } else {
    destroyTray()
  }
    
  const launchOnStartup = getSetting('launch-on-startup', false)
  app.setLoginItemSettings({
    openAtLogin: launchOnStartup,
    openAsHidden: true
  })

  registerShortcut()
  
  setTimeout(() => registerShortcut(), 500)
  setTimeout(() => registerShortcut(), 1000)
}

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
  } else {
    if (data.shortcut) {
      registerShortcut()
    }
    if (data.accentColor && win && !win.isDestroyed()) {
      win.webContents.executeJavaScript(`localStorage.setItem('accent-color', '${data.accentColor}')`)
    }
  }
})

app.whenReady().then(() => {
  const onboardingCompleted = getSetting('onboarding-completed', false)
  
  if (!onboardingCompleted) {
    createOnboardingWindow()
  } else {
    createMainWindow()
  }
})

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