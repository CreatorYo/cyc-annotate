const { ipcRenderer } = require('electron')

let isSelecting = false
let startX = 0
let startY = 0
let selectionRect = null
let overlay = null

function init() {
  selectionRect = document.getElementById('selection-rect')
  overlay = document.getElementById('overlay')
  
  if (!selectionRect || !overlay) {
    setTimeout(init, 10)
    return
  }

  const accentColor = localStorage.getItem('accent-color') || '#3bbbf6'
  document.documentElement.style.setProperty('--accent-color', accentColor)

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
  
  Object.assign(selectionRect.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${absWidth}px`,
    height: `${absHeight}px`,
    display: 'block',
    boxShadow: absWidth > 0 && absHeight > 0 ? '0 0 0 9999px rgba(0, 0, 0, 0.5)' : 'none'
  })
  
  if (absWidth > 0 && absHeight > 0) {
    if (!overlay.classList.contains('hidden')) {
      overlay.style.display = 'none'
      overlay.classList.add('hidden')
    }
  } else if (overlay.classList.contains('hidden')) {
    overlay.style.display = 'block'
    overlay.classList.remove('hidden')
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
}

function handleMouseMove(e) {
  if (!isSelecting) return
  updateSelectionRect(startX, startY, e.clientX - startX, e.clientY - startY)
  e.preventDefault()
}

function handleMouseUp(e) {
  if (!isSelecting || e.button !== 0) return
  isSelecting = false
  document.body.classList.remove('selecting')
  
  const bounds = getSelectionBounds()
  if (bounds && bounds.width > 10 && bounds.height > 10) {
    ipcRenderer.send('capture-selection', bounds)
  } else {
    resetSelection()
  }
}

function selectEntireScreen() {
  const bounds = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
  updateSelectionRect(bounds.x, bounds.y, bounds.width, bounds.height)
  setTimeout(() => ipcRenderer.send('capture-selection', bounds), 100)
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

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    if (!isSelecting && !hasActiveSelection()) {
      ipcRenderer.send('cancel-capture')
    } else {
      resetSelection()
    }
    e.preventDefault()
  } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    selectEntireScreen()
  }
}

function hasActiveSelection() {
  if (!selectionRect || selectionRect.style.display === 'none') return false
  const rect = selectionRect.getBoundingClientRect()
  return rect.width > 10 && rect.height > 10
}

ipcRenderer.on('set-accent-color', (event, color) => {
  if (color) document.documentElement.style.setProperty('--accent-color', color)
})

ipcRenderer.on('select-all-screen', selectEntireScreen)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}