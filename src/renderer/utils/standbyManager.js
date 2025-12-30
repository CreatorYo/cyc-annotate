const { ipcRenderer } = require('electron')

let initialized = false
let standbyState = {
  isActive: false,
  toolBeforeStandby: null
}

let dependencies = {
  state: null,
  canvas: null,
  setTool: null,
  closeAllPopups: null,
  finishTextInput: null,
  playSound: null
}

function initStandbyManager(deps) {
  if (initialized) return getAPI()
  
  dependencies = { ...dependencies, ...deps }
  initialized = true
  
  ensureStandbyOff()
  
  setupEventListeners()
  setupToolbarHover()
  
  return getAPI()
}

function ensureStandbyOff() {
  const { state, canvas } = dependencies
  
  standbyState.isActive = false
  standbyState.toolBeforeStandby = null
  
  if (state) {
    state.standbyMode = false
    state.toolBeforeStandby = null
  }
  
  if (canvas) {
    canvas.style.pointerEvents = 'auto'
  }
  
  stopBoundsUpdates()
  ipcRenderer.send('set-standby-mode', false)
  
  updateUI(false)
  
  setToolbarDisabled(false)
}

function setupEventListeners() {
  const standbyBtn = document.getElementById('standby-btn')
  const moreStandbyBtn = document.getElementById('more-standby-btn')
  
  if (standbyBtn) {
    standbyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggle()
    })
  }
  
  if (moreStandbyBtn) {
    moreStandbyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggle()
      const moreMenu = document.getElementById('more-menu-dropdown')
      if (moreMenu) moreMenu.classList.remove('show')
    })
  }
  
  document.addEventListener('click', (e) => {
    if (!standbyState.isActive) return
    
    const target = e.target.closest('.standby-disabled')
    if (target) {
      e.stopPropagation()
      e.preventDefault()
    }
  }, true)
  
  ipcRenderer.on('disable-standby-mode', () => {
    disable()
  })
}

let isMouseOverToolbar = false
let boundsUpdateInterval = null

function sendToolbarBounds() {
  const toolbar = document.getElementById('main-toolbar')
  if (!toolbar) return
  
  const rect = toolbar.getBoundingClientRect()
  ipcRenderer.send('update-toolbar-bounds', {
    x: Math.round(window.screenX + rect.left),
    y: Math.round(window.screenY + rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  })
}

function startBoundsUpdates() {
  if (boundsUpdateInterval) return
  sendToolbarBounds()
  boundsUpdateInterval = setInterval(sendToolbarBounds, 100)
}

function stopBoundsUpdates() {
  if (boundsUpdateInterval) {
    clearInterval(boundsUpdateInterval)
    boundsUpdateInterval = null
  }
}

function setupToolbarHover() {
  const mainToolbar = document.getElementById('main-toolbar')
  
  if (mainToolbar) {
    mainToolbar.addEventListener('mouseenter', () => {
      isMouseOverToolbar = true
    })
    
    mainToolbar.addEventListener('mouseleave', () => {
      isMouseOverToolbar = false
    })
  }
}

function isActive() {
  return standbyState.isActive
}

function enable(withSound = false) {
  if (standbyState.isActive) return
  
  const { state, canvas, closeAllPopups, finishTextInput, playSound } = dependencies
  
  standbyState.isActive = true
  standbyState.toolBeforeStandby = state.tool
  state.standbyMode = true
  state.toolBeforeStandby = state.tool
  
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelectorAll('.drawing-tool-option').forEach(btn => {
    btn.classList.remove('active')
  })
  const pencilBtn = document.getElementById('pencil-btn')
  if (pencilBtn) pencilBtn.classList.remove('active')
  
  startBoundsUpdates()
  ipcRenderer.send('set-standby-mode', true)
  
  if (canvas) canvas.style.pointerEvents = 'none'
  
  updateUI(true)
  
  setToolbarDisabled(true)
  
  if (closeAllPopups) closeAllPopups()
  
  const textInput = document.getElementById('text-input')
  if (textInput && textInput.style.display === 'block' && finishTextInput) {
    finishTextInput()
  }
  
  if (withSound && playSound) playSound('standbyOn')
}

function disable(withSound = false) {
  if (!standbyState.isActive) return
  
  const { state, canvas, setTool, playSound } = dependencies
  
  standbyState.isActive = false
  state.standbyMode = false
  
  stopBoundsUpdates()
  ipcRenderer.send('set-standby-mode', false)
  
  if (canvas) canvas.style.pointerEvents = 'auto'
  
  updateUI(false)
  
  setToolbarDisabled(false)
  
  if (standbyState.toolBeforeStandby && setTool) {
    setTool(standbyState.toolBeforeStandby)
    standbyState.toolBeforeStandby = null
    state.toolBeforeStandby = null
  }
  
  if (withSound && playSound) playSound('standbyOff')
}

function toggle() {
  if (standbyState.isActive) {
    disable(true)
  } else {
    enable(true)
  }
}

function updateUI(active) {
  const standbyBtn = document.getElementById('standby-btn')
  const moreStandbyBtn = document.getElementById('more-standby-btn')
  const mainToolbar = document.getElementById('main-toolbar')
  
  if (active) {
    if (standbyBtn) standbyBtn.classList.add('active')
    if (moreStandbyBtn) moreStandbyBtn.classList.add('active')
    if (mainToolbar) mainToolbar.classList.add('standby-active')
    
    const icon = standbyBtn?.querySelector('.material-symbols-outlined')
    const moreIcon = moreStandbyBtn?.querySelector('.material-symbols-outlined')
    if (icon) icon.textContent = 'play_circle'
    if (moreIcon) moreIcon.textContent = 'play_circle'
    
    const moreStandbyText = moreStandbyBtn?.querySelector('span:last-child')
    if (moreStandbyText) moreStandbyText.textContent = 'Resume'
  } else {
    if (standbyBtn) standbyBtn.classList.remove('active')
    if (moreStandbyBtn) moreStandbyBtn.classList.remove('active')
    if (mainToolbar) mainToolbar.classList.remove('standby-active')
    
    const icon = standbyBtn?.querySelector('.material-symbols-outlined')
    const moreIcon = moreStandbyBtn?.querySelector('.material-symbols-outlined')
    if (icon) icon.textContent = 'pause_circle'
    if (moreIcon) moreIcon.textContent = 'pause_circle'
    
    const moreStandbyText = moreStandbyBtn?.querySelector('span:last-child')
    if (moreStandbyText) moreStandbyText.textContent = 'Standby Mode'
  }
}

function setToolbarDisabled(disabled) {
  const mainToolbar = document.getElementById('main-toolbar')
  if (!mainToolbar) return
  
  const allButtons = mainToolbar.querySelectorAll('.toolbar-btn')
  const excludedIds = ['standby-btn', 'close-btn', 'hide-btn', 'capture-btn', 'more-menu-btn', 'menu-btn']
  
  allButtons.forEach(btn => {
    if (!excludedIds.includes(btn.id)) {
      if (disabled) {
        btn.classList.add('standby-disabled')
        btn.setAttribute('data-standby-disabled', 'true')
      } else {
        btn.classList.remove('standby-disabled')
        btn.removeAttribute('data-standby-disabled')
      }
    }
  })
  
  const colorSwatches = mainToolbar.querySelectorAll('.color-swatch')
  colorSwatches.forEach(swatch => {
    if (disabled) {
      swatch.classList.add('standby-disabled')
      swatch.setAttribute('data-standby-disabled', 'true')
    } else {
      swatch.classList.remove('standby-disabled')
      swatch.removeAttribute('data-standby-disabled')
    }
  })
  
  const moreMenuItems = document.querySelectorAll('.more-menu-item')
  const excludedMoreIds = ['more-standby-btn', 'more-hide-btn', 'more-menu-settings-btn']
  
  moreMenuItems.forEach(item => {
    if (!excludedMoreIds.includes(item.id)) {
      if (disabled) {
        item.classList.add('standby-disabled')
        item.setAttribute('data-standby-disabled', 'true')
      } else {
        item.classList.remove('standby-disabled')
        item.removeAttribute('data-standby-disabled')
      }
    }
  })
}

function shouldBlockAction() {
  return standbyState.isActive
}

function updateStandbyButtons(standbyInToolbar) {
  const standbyBtnEl = document.getElementById('standby-btn')
  const moreStandbyBtnEl = document.getElementById('more-standby-btn')
  const reduceClutterValue = localStorage.getItem('reduce-clutter')
  const reduceClutter = reduceClutterValue === null ? true : reduceClutterValue === 'true'
  
  if (reduceClutter) {
    if (standbyBtnEl) standbyBtnEl.style.display = standbyInToolbar ? 'flex' : 'none'
    if (moreStandbyBtnEl) moreStandbyBtnEl.style.display = standbyInToolbar ? 'none' : 'flex'
  } else {
    if (standbyBtnEl) standbyBtnEl.style.display = 'flex'
    if (moreStandbyBtnEl) moreStandbyBtnEl.style.display = 'none'
  }
}

function getAPI() {
  return {
    isActive,
    enable,
    disable,
    toggle,
    shouldBlockAction,
    updateStandbyButtons
  }
}

module.exports = { initStandbyManager }

