const { BrowserWindow, ipcMain, screen, desktopCapturer, nativeImage, Menu } = require('electron')
const path = require('path')
const dialogs = require('./dialogs')

let captureOverlayWin = null
let captureOverlayActive = false
let deps = {}

function init(dependencies) {
  deps = dependencies
  return { 
    open, 
    close, 
    destroy,
    captureSelection,
    isActive: () => captureOverlayActive,
    getWin: () => captureOverlayWin
  }
}

function getCurrentDisplay() {
  const win = deps.getWin?.()
  if (!win || win.isDestroyed()) return screen.getPrimaryDisplay()
  
  const winBounds = win.getBounds()
  return screen.getDisplayMatching(winBounds)
}

function setupAlwaysOnTop(targetWin) {
  try {
    targetWin.setAlwaysOnTop(true, 'screen-saver', 1)
  } catch (e) {
    targetWin.setAlwaysOnTop(true)
  }
}

function open() {
  try {
    if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
      captureOverlayWin.focus()
      return
    }

    captureOverlayActive = true
    const mainWin = deps.getWin?.()
    
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.setIgnoreMouseEvents(true, { forward: false })
      mainWin.setAlwaysOnTop(false)
    }

    const targetDisplay = getCurrentDisplay()
    const { bounds, size } = targetDisplay

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

    setupAlwaysOnTop(captureOverlayWin)
    captureOverlayWin.setIgnoreMouseEvents(false)
    
    captureOverlayWin.webContents.once('did-finish-load', () => {
      const accentColor = deps.getSetting?.('accent-color', '#3bbbf6')
      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        captureOverlayWin.webContents.send('set-accent-color', accentColor)
      }
    })
    
    captureOverlayWin.loadFile(path.join(__dirname, '../../capture/capture-overlay.html'))
    deps.disableDefaultShortcuts?.(captureOverlayWin)
    
    captureOverlayWin.once('ready-to-show', () => {
      if (!captureOverlayWin || captureOverlayWin.isDestroyed()) return
      const currentDisplay = screen.getDisplayMatching(captureOverlayWin.getBounds())
      captureOverlayWin.setBounds(currentDisplay.bounds)
      captureOverlayWin.show()
      captureOverlayWin.focus()
      captureOverlayWin.moveTop()
      setupAlwaysOnTop(captureOverlayWin)
    })
    
    captureOverlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    const captureContextMenu = Menu.buildFromTemplate([
      { label: 'Select All', click: () => captureOverlayWin?.webContents.send('select-all-screen') },
      { type: 'separator' },
      { label: 'Cancel', click: () => close() }
    ])

    captureOverlayWin.webContents.on('context-menu', () => captureContextMenu.popup())

    captureOverlayWin.on('closed', () => {
      captureOverlayActive = false
      cleanupMainWin()
      captureOverlayWin = null
    })
  } catch (error) {
    dialogs.showErrorDialog(null, 'Capture Overlay Error', 'Error opening capture overlay', error.message)
    captureOverlayActive = false
    cleanupMainWin()
  }
}

function cleanupMainWin(cancelled = false) {
  const win = deps.getWin?.()
  if (win && !win.isDestroyed()) {
    deps.restoreMouseEvents?.()
    deps.ensureAlwaysOnTop?.()
    const visible = deps.getVisible?.()
    if (!visible) win.show()
    if (cancelled) win.webContents.send('capture-cancelled')
  }
}

function close() {
  if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
    captureOverlayWin.destroy()
    captureOverlayWin = null
  }
  captureOverlayActive = false
  cleanupMainWin(true)
}

function destroy() {
  if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
    captureOverlayWin.destroy()
    captureOverlayWin = null
  }
}

async function captureSelection(bounds) {
  try {
    if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
      captureOverlayWin.destroy()
      captureOverlayWin = null
    }

    const win = deps.getWin?.()
    if (!bounds || bounds.width < 10 || bounds.height < 10) {
      captureOverlayActive = false
      cleanupMainWin()
      win?.webContents.send('capture-selection-result', null)
      return
    }
    
    const targetDisplay = getCurrentDisplay()
    const { width, height } = targetDisplay.size
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    })
    
    captureOverlayActive = false
    cleanupMainWin()

    if (sources.length === 0) {
      win?.webContents.send('capture-selection-result', null)
      return
    }

    const displayId = targetDisplay.id
    const targetSource = sources.find(s => s.display_id === String(displayId)) || 
                       sources.find(s => s.id.includes('screen:0')) || 
                       sources[0]
    
    const img = targetSource.thumbnail
    const cropped = img.crop({
      x: Math.max(0, Math.min(bounds.x, width - 1)),
      y: Math.max(0, Math.min(bounds.y, height - 1)),
      width: Math.min(bounds.width, width - Math.max(0, bounds.x)),
      height: Math.min(bounds.height, height - Math.max(0, bounds.y))
    })
    
    win?.webContents.send('capture-selection-result', cropped.toDataURL(), bounds)
  } catch (error) {
    dialogs.showErrorDialog(null, 'Capture Error', 'Error capturing selection', error.message)
    cleanupMainWin()
    const win = deps.getWin?.()
    win?.webContents.send('capture-selection-result', null)
    captureOverlayActive = false
  }
}

module.exports = { init }