let deps = {}

function init(dependencies) {
  deps = dependencies
  return { restoreMouseEvents, ensureAlwaysOnTop, disableDefaultShortcuts }
}

function restoreMouseEvents() {
  const win = deps.getWin?.()
  const standbyModeEnabled = deps.getStandbyMode?.()
  
  if (win && !win.isDestroyed()) {
    if (standbyModeEnabled) {
      win.setIgnoreMouseEvents(true, { forward: true })
    } else {
      win.setIgnoreMouseEvents(false)
    }
  }
}

function ensureAlwaysOnTop() {
  const win = deps.getWin?.()
  const captureOverlayActive = deps.getCaptureOverlayActive?.()
  
  if (captureOverlayActive) return
  
  if (win && !win.isDestroyed()) {
    try {
      if (!win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    } catch (e) {
      try {
        win.setAlwaysOnTop(true)
      } catch (e2) {}
    }
  }
}

function disableDefaultShortcuts(window) {
  if (!window || window.isDestroyed()) return
  
  const isDev = deps.isDev ?? false
  
  window.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'f') return
    if (isDev) return
    
    const key = input.key.toLowerCase()
    const ctrl = input.control || input.meta
    
    if (ctrl) {
      if (key === 'r' || (key === 'i' && input.shift) || (key === 'j' && input.shift) || key === 'u' || (key === 'c' && input.shift)) {
        event.preventDefault()
        return
      }
    }
    
    if (input.key === 'F5') {
      event.preventDefault()
    }
  })
}

module.exports = { init }
