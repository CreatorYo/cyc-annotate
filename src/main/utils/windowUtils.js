const { screen } = require('electron')

let deps = {}
let pollingInterval = null
let lastOverToolbar = false
let toolbarBounds = null
let postCapture = false

function init(dependencies) {
  deps = dependencies
  return { restoreMouseEvents, ensureAlwaysOnTop, disableDefaultShortcuts, startStandbyPolling, stopStandbyPolling, setToolbarBounds: b => { toolbarBounds = b } }
}

function isOverToolbar() {
  if (!toolbarBounds) return false
  const p = screen.getCursorScreenPoint()
  const pad = 25
  return p.x >= toolbarBounds.x - pad && p.x <= toolbarBounds.x + toolbarBounds.width + pad &&
         p.y >= toolbarBounds.y - pad && p.y <= toolbarBounds.y + toolbarBounds.height + pad
}

function restoreMouseEvents() {
  const win = deps.getWin?.()
  if (deps.getCaptureOverlayActive?.() || !win || win.isDestroyed()) return
  
  stopStandbyPolling(false)
  try { win.setIgnoreMouseEvents(false) } catch (e) {}
  
  if (!deps.getStandbyMode?.()) return
  
  postCapture = true
  setTimeout(() => {
    postCapture = false
    if (!deps.getStandbyMode?.() || deps.getCaptureOverlayActive?.()) return
    if (!win || win.isDestroyed()) return
    
    lastOverToolbar = isOverToolbar()
    if (!lastOverToolbar) try { win.setIgnoreMouseEvents(true, { forward: true }) } catch (e) {}
    startStandbyPolling()
  }, 50)
}

function startStandbyPolling() {
  if (pollingInterval || postCapture) return
  lastOverToolbar = false
  
  pollingInterval = setInterval(() => {
    const win = deps.getWin?.()
    if (!win || win.isDestroyed() || !deps.getStandbyMode?.()) { stopStandbyPolling(); return }
    if (deps.getCaptureOverlayActive?.() || postCapture) return
    
    const over = isOverToolbar()
    if (over !== lastOverToolbar) {
      lastOverToolbar = over
      try { win.setIgnoreMouseEvents(!over, over ? undefined : { forward: true }) } catch (e) {}
    }
  }, 32)
}

function stopStandbyPolling(clearBounds = true) {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
  lastOverToolbar = false
  if (clearBounds) toolbarBounds = null
}

function ensureAlwaysOnTop() {
  const win = deps.getWin?.()
  if (deps.getCaptureOverlayActive?.() || !win || win.isDestroyed()) return
  try { if (!win.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver', 1) } 
  catch (e) { try { win.setAlwaysOnTop(true) } catch (e2) {} }
}

function disableDefaultShortcuts(window) {
  if (!window || window.isDestroyed()) return
  const isDev = deps.isDev ?? false
  
  window.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'f') return
    if (isDev) return
    const key = input.key.toLowerCase(), ctrl = input.control || input.meta
    if (ctrl && (key === 'r' || (key === 'i' && input.shift) || (key === 'j' && input.shift) || key === 'u' || (key === 'c' && input.shift))) { event.preventDefault(); return }
    if (input.key === 'F5') event.preventDefault()
  })
}

module.exports = { init }
