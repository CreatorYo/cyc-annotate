const { screen } = require('electron')

let deps = {}
let standbyPollingInterval = null
let lastMouseOverToolbar = false

function init(dependencies) {
  deps = dependencies
  return { 
    restoreMouseEvents, 
    ensureAlwaysOnTop, 
    disableDefaultShortcuts,
    startStandbyPolling,
    stopStandbyPolling
  }
}

function restoreMouseEvents() {
  const win = deps.getWin?.()
  const standbyModeEnabled = deps.getStandbyMode?.()
  
  if (win && !win.isDestroyed()) {
    if (standbyModeEnabled) {
      // Use polling instead of forward: true to avoid mouse jitter on Windows
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
  
  standbyPollingInterval = setInterval(() => {
    const win = deps.getWin?.()
    const standbyModeEnabled = deps.getStandbyMode?.()
    
    if (!win || win.isDestroyed() || !standbyModeEnabled) {
      stopStandbyPolling()
      return
    }
    
    try {
      const cursorPoint = screen.getCursorScreenPoint()
      const winBounds = win.getBounds()
      
      // Check if cursor is within the window bounds (toolbar area)
      const padding = 5
      const isOverWindow = 
        cursorPoint.x >= winBounds.x - padding &&
        cursorPoint.x <= winBounds.x + winBounds.width + padding &&
        cursorPoint.y >= winBounds.y - padding &&
        cursorPoint.y <= winBounds.y + winBounds.height + padding
      
      // Only update if state changed to avoid unnecessary calls
      if (isOverWindow !== lastMouseOverToolbar) {
        lastMouseOverToolbar = isOverWindow
        if (isOverWindow) {
          win.setIgnoreMouseEvents(false)
        } else {
          win.setIgnoreMouseEvents(true)
        }
      }
    } catch (e) {
      // Ignore errors during polling
    }
  }, 50) // Poll every 50ms - smooth without being heavy
}

function stopStandbyPolling() {
  if (standbyPollingInterval) {
    clearInterval(standbyPollingInterval)
    standbyPollingInterval = null
  }
  lastMouseOverToolbar = false
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
