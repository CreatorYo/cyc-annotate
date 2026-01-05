const { app, BrowserWindow, nativeTheme, systemPreferences } = require('electron')
const fs = require('fs')
const path = require('path')
const dialogs = require('./utils/dialogs')
const { init: initSystemTray } = require('./utils/systemTray')
const { init: initWindowUtils } = require('./utils/windowUtils')
const { getWindowsAccentColor, getOsVersion } = require('./utils/windowsCompat')
const { init: initShortcuts } = require('./utils/shortcuts')
const { init: initNotificationHandler } = require('./utils/notificationHandler')
const startupFeature = require('./utils/startupfeature')
const { init: initCaptureOverlay } = require('./utils/captureOverlay')
const { init: initIpc } = require('./ipc')
const { DEFAULT_ACCENT_COLOR, DEFAULT_SHORTCUT } = require('../shared/constants.js')

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
let shortcut = DEFAULT_SHORTCUT
let standbyModeEnabled = false
let windowsAccentSyncEnabled = false

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
    getSetting,
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
  } catch (e) {}
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
  } catch (e) {}
}

function createSettingsWindow() {
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
      contextIsolation: false,
      autoplayPolicy: 'no-user-gesture-required'
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
      const standbyInToolbar = getSetting('standby-in-toolbar', false)
      const reduceClutter = getSetting('reduce-clutter', true)
      win.webContents.send('sync-toolbar-settings', { standbyInToolbar, reduceClutter })
    }
  })
}

initIpc({
  app,
  getWin: () => win,
  getSettingsWin: () => settingsWin,
  getOnboardingWin: () => onboardingWin,
  getVisible: () => visible,
  setVisible: (v) => { visible = v },
  getShortcut: () => shortcut,
  setShortcut: (s) => { shortcut = s },
  getStandbyMode: () => standbyModeEnabled,
  setStandbyMode: (v) => { standbyModeEnabled = v },
  getSetting,
  setSetting,
  registerShortcut,
  showOverlay,
  hideOverlay,
  createMainWindow,
  createOnboardingWindow,
  createSettingsWindow,
  restoreMouseEvents,
  showDesktopNotification,
  getSystemTray: () => systemTray,
  createTray,
  destroyTray,
  getWindowUtils: () => windowUtils,
  getCaptureOverlay: () => captureOverlay,
  initCaptureOverlayModule,
  getNotificationHandler: () => notificationHandler,
  dialogs,
  startupFeature,
  getOsVersion,
  getWindowsAccentColor,
  getWindowsAccentSyncEnabled: () => windowsAccentSyncEnabled,
  setWindowsAccentSyncEnabled: (v) => { windowsAccentSyncEnabled = v }
})

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
      dialogs.showErrorDialog(win, 'Save Error', 'Failed to save annotations for relaunch', e.message)
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
    dialogs.showWarningDialog(null, 'Window Error', 'Window not available for show')
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
    dialogs.showErrorDialog(win, 'Window Error', 'Failed to show window', error.message)
    visible = false
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('draw-mode', true)
    win.webContents.send('disable-standby-mode')
  }
}

function hideOverlay() {
  if (!win || win.isDestroyed()) return
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
    dialogs.showErrorDialog(win, 'Window Error', 'Failed to hide window', error.message)
    visible = true
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('draw-mode', false)
  }
}

function toggleOverlay() {
  if (!win || win.isDestroyed()) {
    dialogs.showWarningDialog(null, 'Window Error', 'Window not available for toggle')
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
      contextIsolation: false,
      autoplayPolicy: 'no-user-gesture-required'
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
      
      const currentAccentColor = getSetting('accent-color', DEFAULT_ACCENT_COLOR)
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
      contextIsolation: false,
      autoplayPolicy: 'no-user-gesture-required'
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
        dialogs.showErrorDialog(win, 'Restore Error', 'Failed to restore annotations', e.message)
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

  const savedShortcut = getSetting('shortcut', DEFAULT_SHORTCUT)
  if (savedShortcut) {
    shortcut = savedShortcut
  }
  
  const savedAccentColor = getSetting('accent-color', DEFAULT_ACCENT_COLOR)
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

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const currentShortcut = shortcut || getSetting('shortcut', DEFAULT_SHORTCUT)
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
      } catch (e) {}
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
  if (win === null) return
  ensureAlwaysOnTop()
  registerShortcut()
})

app.on('will-quit', () => {
  if (shortcuts) shortcuts.unregisterAll()
  if (captureOverlay) captureOverlay.destroy()
  if (notificationHandler) notificationHandler.close()
})