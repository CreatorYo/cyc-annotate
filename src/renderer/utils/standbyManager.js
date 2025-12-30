const { ipcRenderer } = require('electron')

let deps = {}, active = false, savedTool = null, boundsInterval = null

function init(d) {
  deps = d
  ensureOff()
  setupEvents()
  return { isActive: () => active, enable: on, disable: off, toggle, shouldBlockAction: () => active, updateStandbyButtons }
}

function ensureOff() {
  active = false
  savedTool = null
  if (deps.state) { deps.state.standbyMode = false; deps.state.toolBeforeStandby = null }
  if (deps.canvas) deps.canvas.style.pointerEvents = 'auto'
  stopBounds()
  ipcRenderer.send('set-standby-mode', false)
  updateUI(false)
  setDisabled(false)
}

function off(sound = false) {
  if (!active) return
  active = false
  if (deps.state) { deps.state.standbyMode = false; deps.state.toolBeforeStandby = null }
  if (deps.canvas) deps.canvas.style.pointerEvents = 'auto'
  stopBounds()
  ipcRenderer.send('set-standby-mode', false)
  updateUI(false)
  setDisabled(false)
  if (savedTool && deps.setTool) { deps.setTool(savedTool); savedTool = null }
  if (sound) deps.playSound?.('standbyOff')
}

function on(sound = false) {
  if (active) return
  const { state, canvas, closeAllPopups, finishTextInput, playSound } = deps
  active = true
  savedTool = state.tool
  state.standbyMode = true
  state.toolBeforeStandby = state.tool
  document.querySelectorAll('[data-tool], .drawing-tool-option').forEach(b => b.classList.remove('active'))
  document.getElementById('pencil-btn')?.classList.remove('active')
  startBounds()
  ipcRenderer.send('set-standby-mode', true)
  if (canvas) canvas.style.pointerEvents = 'none'
  updateUI(true)
  setDisabled(true)
  closeAllPopups?.()
  const ti = document.getElementById('text-input')
  if (ti?.style.display === 'block') finishTextInput?.()
  if (sound) playSound?.('standbyOn')
}

function toggle() { active ? off(true) : on(true) }

function setupEvents() {
  const click = e => { e.stopPropagation(); toggle(); document.getElementById('more-menu-dropdown')?.classList.remove('show') }
  document.getElementById('standby-btn')?.addEventListener('click', click)
  document.getElementById('more-standby-btn')?.addEventListener('click', click)
  document.addEventListener('click', e => { if (active && e.target.closest('.standby-disabled')) { e.stopPropagation(); e.preventDefault() } }, true)
  ipcRenderer.on('disable-standby-mode', () => off())
}

function sendBounds() {
  const tb = document.getElementById('main-toolbar')
  if (!tb) return
  let { left: x, top: y, right: r, bottom: b } = tb.getBoundingClientRect()
  const expand = (el, check) => {
    if (!el || !check(el)) return
    const rect = el.getBoundingClientRect()
    x = Math.min(x, rect.left); y = Math.min(y, rect.top)
    r = Math.max(r, rect.right); b = Math.max(b, rect.bottom)
  }
  expand(document.getElementById('more-menu-dropdown'), e => e.classList.contains('show'))
  expand(document.getElementById('color-picker-popup'), e => e.style.display !== 'none')
  expand(document.getElementById('drawing-tools-dropdown'), e => e.classList.contains('show'))
  ipcRenderer.send('update-toolbar-bounds', { x: Math.round(screenX + x), y: Math.round(screenY + y), width: Math.round(r - x), height: Math.round(b - y) })
}

function startBounds() { if (!boundsInterval) { sendBounds(); boundsInterval = setInterval(sendBounds, 100) } }
function stopBounds() { if (boundsInterval) { clearInterval(boundsInterval); boundsInterval = null } }

function updateUI(on) {
  const sb = document.getElementById('standby-btn'), msb = document.getElementById('more-standby-btn'), tb = document.getElementById('main-toolbar')
  const icon = on ? 'play_circle' : 'pause_circle', text = on ? 'Resume' : 'Standby Mode', method = on ? 'add' : 'remove'
  sb?.classList[method]('active'); msb?.classList[method]('active'); tb?.classList[method]('standby-active')
  sb?.querySelector('.material-symbols-outlined')?.replaceChildren(document.createTextNode(icon))
  msb?.querySelector('.material-symbols-outlined')?.replaceChildren(document.createTextNode(icon))
  const t = msb?.querySelector('span:last-child'); if (t) t.textContent = text
}

function setDisabled(d) {
  const tb = document.getElementById('main-toolbar')
  if (!tb) return
  const skip = ['standby-btn', 'close-btn', 'hide-btn', 'capture-btn', 'more-menu-btn', 'menu-btn']
  const skipMore = ['more-standby-btn', 'more-hide-btn', 'more-menu-settings-btn']
  const apply = (el, excluded) => {
    if (excluded.includes(el.id)) return
    el.classList[d ? 'add' : 'remove']('standby-disabled')
    d ? el.setAttribute('data-standby-disabled', 'true') : el.removeAttribute('data-standby-disabled')
  }
  tb.querySelectorAll('.toolbar-btn').forEach(b => apply(b, skip))
  tb.querySelectorAll('.color-swatch').forEach(s => apply(s, []))
  document.querySelectorAll('.more-menu-item').forEach(i => apply(i, skipMore))
}

function updateStandbyButtons(inToolbar) {
  const sb = document.getElementById('standby-btn'), msb = document.getElementById('more-standby-btn')
  const clutter = localStorage.getItem('reduce-clutter') !== 'false'
  if (clutter) { if (sb) sb.style.display = inToolbar ? 'flex' : 'none'; if (msb) msb.style.display = inToolbar ? 'none' : 'flex' }
  else { if (sb) sb.style.display = 'flex'; if (msb) msb.style.display = 'none' }
}

module.exports = { initStandbyManager: init }