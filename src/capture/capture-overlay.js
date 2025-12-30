const { ipcRenderer } = require('electron')

let isSelecting = false
let startX = 0
let startY = 0
let selectionRect = null
let overlay = null

function hexToRgb(hex) {
  const r = parseInt(hex.substr(1, 2), 16)
  const g = parseInt(hex.substr(3, 2), 16)
  const b = parseInt(hex.substr(5, 2), 16)
  return { r, g, b }
}

function applyAccentColor(color) {
  try {
    const accentColor = color || localStorage.getItem('accent-color') || '#3bbbf6'
    const rgb = hexToRgb(accentColor)
    const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
    
    document.documentElement.style.setProperty('--accent-color', accentColor)
    document.documentElement.style.setProperty('--accent-bg', bgColor)
    
    if (selectionRect) {
      selectionRect.style.borderColor = accentColor
      selectionRect.style.backgroundColor = 'transparent'
    }
    
    if (overlay) {
      overlay.style.background = 'rgba(0, 0, 0, 0.5)'
    }
  } catch (e) {
    console.warn('Could not apply accent color:', e)
  }
}

function init() {
  selectionRect = document.getElementById('selection-rect')
  overlay = document.getElementById('overlay')
  
  if (!selectionRect || !overlay) {
    setTimeout(init, 10)
    return
  }

  applyAccentColor()

  const updateCursorClass = () => {
    if (isSelecting) {
      document.body.classList.add('selecting')
    } else {
      document.body.classList.remove('selecting')
    }
  }
  
  updateCursorClass()
  
  document.addEventListener('mousemove', (e) => {
    updateCursorClass()
  }, { passive: true, capture: true })
  
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keydown', handleKeyDown)
}

function updateSelectionRect(x, y, width, height) {
  if (!selectionRect || !overlay) return
  
  const left = Math.min(x, x + width)
  const top = Math.min(y, y + height)
  const absWidth = Math.abs(width)
  const absHeight = Math.abs(height)
  
  selectionRect.style.left = left + 'px'
  selectionRect.style.top = top + 'px'
  selectionRect.style.width = absWidth + 'px'
  selectionRect.style.height = absHeight + 'px'
  selectionRect.style.display = 'block'
  
  if (absWidth > 0 && absHeight > 0) {
    selectionRect.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.5)'
    if (!overlay.classList.contains('hidden')) {
      overlay.style.display = 'none'
      overlay.classList.add('hidden')
    }
  } else {
    selectionRect.style.boxShadow = 'none'
    if (overlay.classList.contains('hidden')) {
      overlay.style.display = 'block'
      overlay.classList.remove('hidden')
    }
  }
}

function getSelectionBounds() {
  if (!selectionRect) return null
  
  const rect = selectionRect.getBoundingClientRect()
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

function handleMouseDown(e) {
  if (e.button !== 0) return
  
  isSelecting = true
  startX = e.clientX
  startY = e.clientY
  
  document.body.classList.add('selecting')
  
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.style.display = 'none'
    overlay.classList.add('hidden')
  }
  
  updateSelectionRect(startX, startY, 0, 0)
  
  e.preventDefault()
  e.stopPropagation()
}

function handleMouseMove(e) {
  if (!isSelecting) return
  
  const width = e.clientX - startX
  const height = e.clientY - startY
  
  updateSelectionRect(startX, startY, width, height)
  
  e.preventDefault()
  e.stopPropagation()
}

function handleMouseUp(e) {
  if (!isSelecting || e.button !== 0) return
  
  isSelecting = false
  
  document.body.classList.remove('selecting')
  
  const bounds = getSelectionBounds()
  
  if (bounds && bounds.width > 10 && bounds.height > 10) {
    ipcRenderer.send('capture-selection', bounds)
  } else {
    if (selectionRect) {
      selectionRect.style.display = 'none'
      selectionRect.style.boxShadow = 'none'
    }
    if (overlay && overlay.classList.contains('hidden')) {
      overlay.style.display = 'block'
      overlay.classList.remove('hidden')
    }
  }
  
  e.preventDefault()
  e.stopPropagation()
}

function selectEntireScreen() {
  if (!selectionRect) return
  
  const bounds = {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight
  }
  
  updateSelectionRect(bounds.x, bounds.y, bounds.width, bounds.height)
  
  setTimeout(() => {
    ipcRenderer.send('capture-selection', bounds)
  }, 100)
}

function resetSelection() {
  isSelecting = false
  
  document.body.classList.remove('selecting')
  
  if (selectionRect) {
    selectionRect.style.display = 'none'
    selectionRect.style.boxShadow = 'none'
  }
  
  if (overlay && overlay.classList.contains('hidden')) {
    overlay.style.display = 'block'
    overlay.classList.remove('hidden')
  }
}

function hasActiveSelection() {
  if (!selectionRect) return false
  const isVisible = selectionRect.style.display !== 'none'
  if (!isVisible) return false
  
  const rect = selectionRect.getBoundingClientRect()
  return rect.width > 10 && rect.height > 10
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    if (!isSelecting && !hasActiveSelection()) {
      ipcRenderer.send('cancel-capture')
    } else {
      resetSelection()
    }
    e.preventDefault()
    e.stopPropagation()
  } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    e.stopPropagation()
    selectEntireScreen()
  }
}

ipcRenderer.on('set-accent-color', (event, color) => {
  applyAccentColor(color)
})

ipcRenderer.on('select-all-screen', () => {
  selectEntireScreen()
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}