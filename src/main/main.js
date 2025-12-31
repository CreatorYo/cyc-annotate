const { app, BrowserWindow, Menu, ipcMain, desktopCapturer, nativeImage, Notification, nativeTheme, systemPreferences, clipboard } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const dialogs = require('./utils/dialogs')
const { init: initSystemTray } = require('./utils/systemTray')
const { init: initWindowUtils } = require('./utils/windowUtils')
const { getWindowsVersion, getWindowsAccentColor, getOsVersion } = require('./utils/windowsCompat')
const { init: initShortcuts } = require('./utils/shortcuts')
const { init: initNotificationHandler } = require('./utils/notificationHandler')
const startupFeature = require('./utils/startupfeature')
const { init: initCaptureOverlay } = require('./utils/captureOverlay')

const iconPathIco = path.join(__dirname, '../../icon.ico')
const iconPathPng = path.join(__dirname, '../../icon.png')
const iconPath = fs.existsSync(iconPathIco) ? iconPathIco : iconPathPng

let win
let settingsWin
let onboardingWin = null
let systemTray = null
let windowUtils = null
let shortcuts = null
let notificationHandler = null
let captureOverlay = null
let visible = false
let shortcut = 'Control+Shift+D'
let standbyModeEnabled = false

function initWindowUtilsModule() {
  windowUtils = initWindowUtils({
    getWin: () => win,
    getStandbyMode: () => standbyModeEnabled,
    getCaptureOverlayActive: () => captureOverlay?.isActive() || false,
    isDev: !app.isPackaged
  })
}

function initShortcutsModule() {
  shortcuts = initShortcuts({
    onShortcutPressed: () => {
      if (win && !win.isDestroyed()) toggleOverlay()
    }
  })
  shortcuts.setShortcut(shortcut)
}

function initNotificationHandlerModule() {
  notificationHandler = initNotificationHandler({
    iconPath,
    getSetting,
    disableDefaultShortcuts
  })
}

function initCaptureOverlayModule() {
  captureOverlay = initCaptureOverlay({
    getWin: () => win,
    getVisible: () => visible,
    restoreMouseEvents,
    ensureAlwaysOnTop,
    disableDefaultShortcuts
  })
}

function restoreMouseEvents() {
  if (!windowUtils) initWindowUtilsModule()
  windowUtils.restoreMouseEvents()
}

function disableDefaultShortcuts(window) {
  if (!windowUtils) initWindowUtilsModule()
  windowUtils.disableDefaultShortcuts(window)
}

function ensureAlwaysOnTop() {
  if (!windowUtils) initWindowUtilsModule()
  windowUtils.ensureAlwaysOnTop()
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


async function saveAnnotationsForRelaunch() {
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
}

function initTray() {
  systemTray = initSystemTray({
    app,
    getWin: () => win,
    getSettingsWin: () => settingsWin,
    toggleOverlay,
    saveAnnotationsForRelaunch
  })
}

function createTray() {
  if (!systemTray) initTray()
  systemTray.create()
}

function destroyTray() {
  systemTray?.destroy()
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
  if (!shortcuts) initShortcutsModule()
  shortcuts.setShortcut(shortcut)
  shortcuts.register()
}

function showDesktopNotification(title, body, filePath) {
  if (!notificationHandler) initNotificationHandlerModule()
  notificationHandler.show(title, body, filePath)
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
      if (shortcuts && !shortcuts.isRegistered()) {
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
    const nWin = notificationHandler?.getWin()
    if (nWin && !nWin.isDestroyed()) {
      nWin.webContents.send('theme-changed', theme)
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
      const nWin = notificationHandler?.getWin()
      if (nWin && !nWin.isDestroyed()) {
        nWin.webContents.send('os-theme-changed', effectiveTheme)
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
      if (!systemTray?.get()) {
        createTray()
      }
    } else {
      destroyTray()
    }
    setSetting('show-tray-icon', show)
  })

  ipcMain.on('set-auto-launch', (event, enabled) => {
    startupFeature.setEnabled(enabled)
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
    // Use restoreMouseEvents which now uses polling instead of forward: true
    // This avoids mouse jitter on Windows
    restoreMouseEvents()
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

ipcMain.handle('get-system-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  osVersion: getOsVersion()
}))

ipcMain.handle('show-system-details-dialog', async () => {
  const systemInfo = {
    version: app.getVersion(),
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    osVersion: getOsVersion()
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
    notificationHandler?.close()
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
    if (!captureOverlay) initCaptureOverlayModule()
    captureOverlay.open()
  })

  ipcMain.on('capture-selection', async (event, bounds) => {
    if (!captureOverlay) initCaptureOverlayModule()
    await captureOverlay.captureSelection(bounds)
  })

  ipcMain.on('cancel-capture', () => {
    captureOverlay?.close()
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
  startupFeature.applyStartupSetting(launchOnStartup)

  registerShortcut()
  
  setTimeout(() => registerShortcut(), 500)
  setTimeout(() => registerShortcut(), 1000)
}

ipcMain.handle('get-windows-accent-color', () => getWindowsAccentColor())

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
  if (shortcuts) shortcuts.unregisterAll()
  captureOverlay?.destroy()
  notificationHandler?.close()
})