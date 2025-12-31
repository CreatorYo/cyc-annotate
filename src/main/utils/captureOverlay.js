const { BrowserWindow, Menu, screen, desktopCapturer } = require('electron')
const path = require('path')

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

function open() {
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
    
    const win = deps.getWin?.()
    const visible = deps.getVisible?.()
    
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
      const win = deps.getWin?.()
      if (win && !win.isDestroyed()) {
        win.webContents.executeJavaScript('localStorage.getItem("accent-color")')
          .then((color) => { if (color) accentColor = color })
          .catch(() => {})
      }
      if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
        captureOverlayWin.webContents.send('set-accent-color', accentColor)
      }
    })
    
    captureOverlayWin.loadFile(path.join(__dirname, '../../capture/capture-overlay.html'))
    
    deps.disableDefaultShortcuts?.(captureOverlayWin)
    
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
        click: () => close()
      }
    ])

    captureOverlayWin.webContents.on('context-menu', () => {
      captureContextMenu.popup()
    })

    captureOverlayWin.on('closed', () => {
      captureOverlayActive = false
      const win = deps.getWin?.()
      const visible = deps.getVisible?.()
      if (win && !win.isDestroyed()) {
        deps.restoreMouseEvents?.()
        deps.ensureAlwaysOnTop?.()
        if (!visible) win.show()
      }
      captureOverlayWin = null
    })
  } catch (error) {
    console.error('Error opening capture overlay:', error)
    captureOverlayActive = false
    const win = deps.getWin?.()
    if (win && !win.isDestroyed()) {
      deps.restoreMouseEvents?.()
      deps.ensureAlwaysOnTop?.()
    }
  }
}

function close() {
  if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
    captureOverlayWin.destroy()
    captureOverlayWin = null
  }
  captureOverlayActive = false
  const win = deps.getWin?.()
  const visible = deps.getVisible?.()
  if (win && !win.isDestroyed()) {
    deps.restoreMouseEvents?.()
    deps.ensureAlwaysOnTop?.()
    if (!visible) win.show()
    win.webContents.send('capture-cancelled')
  }
}

function destroy() {
  if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
    captureOverlayWin.destroy()
    captureOverlayWin = null
  }
}

async function captureSelection(bounds) {
  try {
    let overlayBoundsAtCapture = null
    if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
      overlayBoundsAtCapture = captureOverlayWin.getBounds()
      captureOverlayWin.destroy()
      captureOverlayWin = null
    }

    const win = deps.getWin?.()
    const visible = deps.getVisible?.()
        
    if (!overlayBoundsAtCapture || !bounds || bounds.width < 10 || bounds.height < 10) {
      captureOverlayActive = false
      if (win && !win.isDestroyed()) {
        deps.restoreMouseEvents?.()
        deps.ensureAlwaysOnTop?.()
        if (!visible) win.show()
        win.webContents.send('capture-selection-result', null)
      }
      return
    }
    
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
    
    captureOverlayActive = false

    if (win && !win.isDestroyed()) {
      deps.restoreMouseEvents?.()
      deps.ensureAlwaysOnTop?.()
      if (!visible) win.show()
    }

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
    
    if (!targetSource) targetSource = sources[0]
    
    const img = targetSource.thumbnail
    
    const cropped = img.crop({
      x: Math.max(0, Math.min(bounds.x, width - 1)),
      y: Math.max(0, Math.min(bounds.y, height - 1)),
      width: Math.min(bounds.width, width - Math.max(0, bounds.x)),
      height: Math.min(bounds.height, height - Math.max(0, bounds.y))
    })
    
    if (win && !win.isDestroyed()) {
      win.webContents.send('capture-selection-result', cropped.toDataURL(), bounds)
    }
  } catch (error) {
    console.error('Error capturing selection:', error)
    const win = deps.getWin?.()
    if (win && !win.isDestroyed()) {
      deps.restoreMouseEvents?.()
      win.webContents.send('capture-selection-result', null)
    }
    if (captureOverlayWin && !captureOverlayWin.isDestroyed()) {
      captureOverlayWin.destroy()
      captureOverlayWin = null
    }
    captureOverlayActive = false
    if (win && !win.isDestroyed()) {
      deps.ensureAlwaysOnTop?.()
    }
  }
}

module.exports = { init }
