const { ipcRenderer } = require('electron')
const { DEFAULT_ACCENT_COLOR } = require('../shared/constants.js')
const { initSelectTool } = require('./tools/selectTool.js')
const { initTextTool } = require('./tools/textTool.js')
const { initColorPickerTool } = require('./tools/colorPicker.js')
const { initCommandMenu } = require('./tools/commandMenu.js')
const { initThemeManager, updateToolbarBackgroundColor } = require('./utils/themeManager.js')
const { initTooltips, hideAllTooltips } = require('./utils/tooltipManager.js')
const { initAudioContext, playSound } = require('./utils/soundEffects.js')
const { initStandbyManager } = require('./utils/standbyManager.js')
const { initShortcutManager } = require('./utils/shortcutManager.js')
const ToolbarPositionManager = require('./utils/toolbarPositionManager')

const CanvasManager = require('./core/CanvasManager.js')
CanvasManager.init(() => redrawCanvas())
const canvas = CanvasManager.getCanvas()
const ctx = CanvasManager.getCtx()
const optimizedRendering = CanvasManager.isOptimizedRendering()

document.addEventListener('click', initAudioContext, { once: true })
document.addEventListener('mousedown', initAudioContext, { once: true })

const { init: initInputHandler, updateCursor } = require('./input/InputHandler.js')
const { state, createElement, saveState, undo, redo } = require('./core/AppState.js')
const { drawArrow } = require('./utils/DrawingUtils.js')

canvas.style.pointerEvents = 'auto'

ctx.lineCap = 'round'
ctx.lineJoin = 'round'

function redrawCanvas() {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1.0
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  
  if (optimizedRendering) {
    for (let i = 0; i < state.elements.length; i++) {
      const element = state.elements[i]
      if (element) {
        drawElement(element)
      }
    }
  } else {
    state.elements.forEach(element => {
      if (element) {
        drawElement(element)
      }
    })
  }
  
  updateSelectionOverlay()
}

function drawElement(element) {
  if (!element) return
  if (element.id === state.editingElementId) return
  
  ctx.save()
  
  ctx.globalCompositeOperation = 'source-over'
  ctx.setLineDash([])
  
  if (optimizedRendering && (element.type === 'stroke' || element.type === 'shape')) {
    ctx.imageSmoothingEnabled = false
  }
  
  if (element.type === 'stroke') {
    ctx.strokeStyle = element.color || '#000000'
    ctx.lineWidth = element.strokeSize || 4
    ctx.globalAlpha = element.alpha !== undefined ? element.alpha : 1.0
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = element.compositeOperation || 'source-over'
    
    ctx.beginPath()
    if (element.points && element.points.length > 0) {
      ctx.moveTo(element.points[0].x, element.points[0].y)
      for (let i = 1; i < element.points.length; i++) {
        ctx.lineTo(element.points[i].x, element.points[i].y)
      }
      ctx.stroke()
    }
  } else if (element.type === 'shape') {
    ctx.strokeStyle = element.color || '#000000'
    ctx.fillStyle = element.color || '#000000'
    ctx.lineWidth = element.strokeSize || 4
    ctx.globalAlpha = 1.0
    ctx.globalCompositeOperation = 'source-over'
    
    const x = Math.min(element.start.x, element.end.x)
    const y = Math.min(element.start.y, element.end.y)
    const w = Math.abs(element.end.x - element.start.x)
    const h = Math.abs(element.end.y - element.start.y)
    
    if (element.shapeType === 'rectangle') {
      if (element.filled) {
        ctx.fillRect(x, y, w, h)
      } else {
        ctx.strokeRect(x, y, w, h)
      }
    } else if (element.shapeType === 'circle') {
      const centerX = (element.start.x + element.end.x) / 2
      const centerY = (element.start.y + element.end.y) / 2
      const radius = Math.sqrt(w * w + h * h) / 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      if (element.filled) {
        ctx.fill()
      } else {
        ctx.stroke()
      }
    } else if (element.shapeType === 'line') {
      ctx.beginPath()
      ctx.moveTo(element.start.x, element.start.y)
      ctx.lineTo(element.end.x, element.end.y)
      ctx.stroke()
    } else if (element.shapeType === 'arrow') {
      drawArrow(ctx, element.start.x, element.start.y, element.end.x, element.end.y)
    }
  } else if (element.type === 'text') {
    ctx.fillStyle = element.color || '#000000'
    ctx.globalAlpha = 1.0
    ctx.globalCompositeOperation = 'source-over'
    
    const fontSize = element.fontSize || Math.max(12, (element.strokeSize || 4) * 4)
    ctx.textBaseline = 'top'
    
    if (element.segments && element.segments.length > 0) {
      const lineHeight = fontSize * 1.2
      const maxTextWidth = 2000
      const textYOffset = fontSize * 0.12
      let cursorX = element.x
      let cursorY = element.y + textYOffset
      
      element.segments.forEach((segment) => {
        const fontStyle = segment.formatting?.italic ? 'italic' : 'normal'
        const fontWeight = segment.formatting?.bold ? 'bold' : 'normal'
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        ctx.fillStyle = segment.formatting?.color || element.color || '#000000'
        
        const lines = segment.text.split('\n')
        
        lines.forEach((line, lineIndex) => {
          if (lineIndex > 0) {
            cursorX = element.x
            cursorY += lineHeight
          }
          
          const tokens = line.split(/(\s+)/)
          
          tokens.forEach(token => {
            if (token.length === 0) return
            
            const tokenWidth = ctx.measureText(token).width
            
            if (cursorX + tokenWidth > element.x + maxTextWidth && cursorX > element.x) {
              cursorX = element.x
              cursorY += lineHeight
              
              if (token.trim() === '') {
                return
              }
            }
            
            ctx.fillText(token, cursorX, cursorY)
            
            if (segment.formatting?.underline) {
              ctx.strokeStyle = segment.formatting?.color || element.color || '#000000'
              ctx.lineWidth = Math.max(1, fontSize / 15)
              ctx.beginPath()
              ctx.moveTo(cursorX, cursorY + fontSize * 0.9)
              ctx.lineTo(cursorX + tokenWidth, cursorY + fontSize * 0.9)
              ctx.stroke()
            }
            
            cursorX += tokenWidth
          })
        })
      })
    }
  }
  
  ctx.restore()
}

const { getElementBounds, hitTest, findElementAt } = require('./utils/CollisionUtils.js')

function updateSelectionOverlay() {
  const { selectionCtx, selectionCanvas } = CanvasManager.createSelectionCanvas()
  if (!selectionCtx) return
  
  selectionCtx.save()
  selectionCtx.setTransform(1, 0, 0, 1, 0, 0)
  selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height)
  selectionCtx.restore()
  
  selectTool.drawSelectionIndicators(selectionCtx)
  
  if (state.tool === 'select' && state.isSelecting) {
    selectTool.drawSelectionBox(selectionCtx)
  }
  
  updateShapeFillToggleState()
}

function updateSelectionOnly() {
  updateSelectionOverlay()
}

const selectTool = initSelectTool(state, ctx, canvas, {
  getElementBounds,
  hitTest,
  findElementAt,
  redrawCanvas: () => redrawCanvas(),
  updateSelectionOnly: () => updateSelectionOnly(),
  saveState: () => saveState(updateUndoRedoButtons),
  playSound: (type) => playSound(type)
})

const textTool = initTextTool(state, canvas, {
  createElement,
  redrawCanvas: () => redrawCanvas(),
  saveState: () => saveState(updateUndoRedoButtons),
  updateSelectionOnly: () => updateSelectionOnly()
})

const colorTool = initColorPickerTool({
  state,
  selectTool,
  textTool,
  playSound,
  hideAllTooltips,
  closeAllPopups,
  DEFAULT_ACCENT_COLOR
})
const { setColor, initColorPicker, setInitialColorBorder, isLightColor } = colorTool

setInitialColorBorder()
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initColorPicker, 200) 
  })
} else {
  setTimeout(initColorPicker, 200)
}

initInputHandler({
  selectTool,
  textTool,
  redrawCanvas: () => redrawCanvas(),
  updateSelectionOnly: () => updateSelectionOnly(),
  playSound
})

function setTool(tool) {
  state.tool = tool

  if (tool !== 'text' && tool !== 'select') {
    const textInput = document.getElementById('text-input')
    if (textInput && textInput.style.display === 'block') {
      textTool.finishTextInput()
    }
  }
  
  if (tool !== 'select') {
    selectTool.clearSelection()
  }
  
  if (tool !== 'shapes') {
    state.shapeStart = null
    state.shapeEnd = null
    state.drawing = false
  }
  
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active')
  
  updateShapeFillToggleState()

  document.querySelectorAll('.drawing-tool-option').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.tool === tool) {
      btn.classList.add('active')
      
      const icon = document.getElementById('pencil-btn')?.querySelector('.material-symbols-outlined')
      if (icon) {
        if (tool === 'select') {
          icon.textContent = 'arrow_selector_tool'
        } else if (tool === 'pencil') {
          icon.textContent = 'edit'
        } else if (tool === 'marker') {
          icon.textContent = 'brush'
        }
      }
    }
  })

  if (tool === 'select' || tool === 'pencil' || tool === 'marker') {
    const pencilBtn = document.getElementById('pencil-btn')
    if (pencilBtn) {
      pencilBtn.classList.add('active')
    }
  }
  
  if (tool === 'shapes') {
    const shapesBtn = document.getElementById('shapes-btn')
    if (shapesBtn) {
      shapesBtn.classList.add('active')
    }
  }
  
  updateCursor()
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn')
  const redoBtn = document.getElementById('redo-btn')
  const moreUndoBtn = document.getElementById('more-undo-btn')
  const moreRedoBtn = document.getElementById('more-redo-btn')
  
  const canUndo = state.historyIndex > 0 && state.history.length > 0
  const canRedo = state.historyIndex < state.history.length - 1
  
  if (undoBtn) {
    if (canUndo) {
      undoBtn.classList.remove('disabled')
    } else {
      undoBtn.classList.add('disabled')
    }
  }
  
  if (redoBtn) {
    if (canRedo) {
      redoBtn.classList.remove('disabled')
    } else {
      redoBtn.classList.add('disabled')
    }
  }
  
  if (moreUndoBtn) {
    if (canUndo) {
      moreUndoBtn.classList.remove('disabled')
    } else {
      moreUndoBtn.classList.add('disabled')
    }
  }
  
  if (moreRedoBtn) {
    if (canRedo) {
      moreRedoBtn.classList.remove('disabled')
    } else {
      moreRedoBtn.classList.add('disabled')
    }
  }
}

function handleUndo() {
  if (state.historyIndex > 0) {
    undo(
      () => { 
        selectTool.clearSelection()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        redrawCanvas()
        checkIfHasDrawn()
        playSound('undo')
      },
      updateUndoRedoButtons
    )
  }
}

function handleRedo() {
  if (state.historyIndex < state.history.length - 1) {
    redo(
      () => {
        selectTool.clearSelection()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        redrawCanvas()
        checkIfHasDrawn()
        playSound('redo')
      },
      updateUndoRedoButtons
    )
  }
}

function checkIfHasDrawn() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      state.hasDrawn = true
      return
    }
  }
  state.hasDrawn = false
}

saveState(updateUndoRedoButtons)

const { copySelectedElements, pasteElements } = require('./tools/clipboardTool.js')

const handleCopy = () => copySelectedElements(state, playSound)
const handlePaste = () => pasteElements(state, redrawCanvas, saveState, playSound)

const drawingToolsPopup = document.getElementById('drawing-tools-popup')
const pencilBtn = document.getElementById('pencil-btn')

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTool(state.tool) 
  })
} else {
  setTool(state.tool) 
}

if (pencilBtn) {
  pencilBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    hideAllTooltips()
    if (drawingToolsPopup) {
      const wasOpen = drawingToolsPopup.classList.contains('show')
      closeAllPopups()
      if (!wasOpen) {
        drawingToolsPopup.classList.add('show')
      }
    }
  })

  pencilBtn.addEventListener('dblclick', (e) => {
    e.stopPropagation()
    e.preventDefault()
    setTool('pencil')
    if (drawingToolsPopup) {
      drawingToolsPopup.classList.remove('show')
    }
  })
}

document.querySelectorAll('.drawing-tool-option').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const tool = btn.dataset.tool
    setTool(tool)
    if (drawingToolsPopup) {
      drawingToolsPopup.classList.remove('show')
    }
  })
})

document.getElementById('text-btn').addEventListener('click', () => {
  const textBtn = document.getElementById('text-btn')
  if (state.tool === 'text' && textBtn.classList.contains('active')) {
    setTool('pencil')
  } else {
    setTool('text')
  }
})
document.getElementById('eraser-btn').addEventListener('click', () => setTool('eraser'))

const shapesBtn = document.getElementById('shapes-btn')
const shapesPopup = document.getElementById('shapes-popup')

shapesBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  hideAllTooltips()
  const wasOpen = shapesPopup.classList.contains('show')
  closeAllPopups()
  if (!wasOpen) {
    shapesPopup.classList.add('show')
  }
})

document.querySelectorAll('.shape-option[data-shape]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const tooltip = btn.querySelector('.custom-tooltip')
    if (tooltip) {
      tooltip.classList.remove('show')
    }
    state.shapeType = btn.dataset.shape
    setTool('shapes')
    setActiveShape(state.shapeType)
    shapesPopup.classList.remove('show')
  })
})

function setActiveShape(shapeType) {
  document.querySelectorAll('.shape-option[data-shape]').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.shape === shapeType) {
      btn.classList.add('active')
    }
  })
}

function setShape(shape) {
  state.shapeType = shape
  setTool('shapes')
  setActiveShape(shape)
  const shapesPopup = document.getElementById('shapes-popup')
  if (shapesPopup) {
    shapesPopup.classList.remove('show')
  }
}

function updateSelectedShapeFill(fillState) {
  if (state.selectedElements.length === 0) return
  
  const fillableShapes = ['rectangle', 'circle']
  let hasChanges = false
  
  for (const elementId of state.selectedElements) {
    const element = state.elements.find(e => e.id === elementId)
    if (element && element.type === 'shape' && fillableShapes.includes(element.shapeType)) {
      element.filled = fillState
      hasChanges = true
    }
  }
  
  if (hasChanges) {
    redrawCanvas()
    saveState()
  }
}

function updateShapeFillToggleState() {
  const shapeFillToggle = document.getElementById('shape-fill-toggle')
  if (!shapeFillToggle) return
  
  if (state.tool === 'select' && state.selectedElements.length > 0) {
    const fillableShapes = ['rectangle', 'circle']
    const selectedShapes = state.selectedElements
      .map(id => state.elements.find(e => e.id === id))
      .filter(e => e && e.type === 'shape' && fillableShapes.includes(e.shapeType))
    
    if (selectedShapes.length > 0) {
      const allFilled = selectedShapes.every(s => s.filled === true)
      const allUnfilled = selectedShapes.every(s => s.filled === false)
      
      if (allFilled) {
        shapeFillToggle.classList.add('active')
      } else if (allUnfilled) {
        shapeFillToggle.classList.remove('active')
      } else {
      }
      return
    }
  }
  
  shapeFillToggle.classList.toggle('active', state.shapeFillEnabled)
}

const shapeFillToggle = document.getElementById('shape-fill-toggle')
if (shapeFillToggle) {
  const savedFillState = localStorage.getItem('shape-fill-enabled')
  if (savedFillState !== null) {
    state.shapeFillEnabled = savedFillState === 'true'
    shapeFillToggle.classList.toggle('active', state.shapeFillEnabled)
  }
  
  shapeFillToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    
    if (state.tool === 'select' && state.selectedElements.length > 0) {
      const fillableShapes = ['rectangle', 'circle']
      const selectedShapes = state.selectedElements
        .map(id => state.elements.find(e => e.id === id))
        .filter(e => e && e.type === 'shape' && fillableShapes.includes(e.shapeType))
      
      if (selectedShapes.length > 0) {
        const currentFillState = selectedShapes[0].filled
        updateSelectedShapeFill(!currentFillState)
        updateShapeFillToggleState()
        return
      }
    }
    
    state.shapeFillEnabled = !state.shapeFillEnabled
    shapeFillToggle.classList.toggle('active', state.shapeFillEnabled)
    localStorage.setItem('shape-fill-enabled', state.shapeFillEnabled.toString())
  })
}

document.addEventListener('click', (e) => {
  const shapesWrapper = document.querySelector('.shapes-wrapper')
  if (shapesWrapper && !shapesWrapper.contains(e.target)) {
    if (shapesPopup) {
      shapesPopup.classList.remove('show')
    }
  }
  
  const strokeThicknessWrapper = document.querySelector('.stroke-thickness-wrapper')
  if (strokeThicknessWrapper && !strokeThicknessWrapper.contains(e.target)) {
    const strokePopup = document.getElementById('stroke-popup')
    if (strokePopup) {
      strokePopup.classList.remove('show')
    }
  }
  
  const drawingToolsWrapper = document.querySelector('.drawing-tools-wrapper')
  if (drawingToolsWrapper?.contains(e.target) === false) {
    if (drawingToolsPopup) {
      drawingToolsPopup.classList.remove('show')
    }
  }
  
  const customColorWrapper = document.querySelector('.custom-color-wrapper')
  if (customColorWrapper && !customColorWrapper.contains(e.target)) {
    const customColorPopup = document.getElementById('custom-color-popup')
    if (customColorPopup) {
      customColorPopup.classList.remove('show')
    }
  }
})

function closeAllPopups() {
  const popups = [
    document.getElementById('stroke-popup'),
    document.getElementById('drawing-tools-popup'),
    document.getElementById('shapes-popup'),
    document.getElementById('custom-color-popup'),
    document.getElementById('more-menu-dropdown')
  ]
  popups.forEach(popup => {
    if (popup) {
      popup.classList.remove('show')
    }
  })
}

function setStrokeSize(size) {
  state.strokeSize = size
  
  if (state.selectedElements.length > 0) {
    selectTool.updateSelectedStrokeSize(size)
  }
  
  document.querySelectorAll('.stroke-option').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`.stroke-option[data-size="${size}"]`)?.classList.add('active')
  
  const popup = document.getElementById('stroke-popup')
  popup.classList.remove('show')
}

const strokeThicknessBtn = document.getElementById('stroke-thickness-btn')
const strokePopup = document.getElementById('stroke-popup')

strokeThicknessBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  hideAllTooltips()
  const wasOpen = strokePopup.classList.contains('show')
  closeAllPopups()
  if (!wasOpen) {
    strokePopup.classList.add('show')
  }
})

document.querySelectorAll('.stroke-option').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    setStrokeSize(parseInt(btn.dataset.size))
  })
})

setStrokeSize(2)

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  state.elements = []
  state.selectedElements = []
  state.nextElementId = 1
  state.hasDrawn = false
  saveState(updateUndoRedoButtons)
  updateUndoRedoButtons()
  redrawCanvas()
  
  setTimeout(() => {
    playSound('trash')
  }, 10)
}

document.getElementById('clear-btn').addEventListener('click', (e) => {
  e.stopPropagation()
  clearCanvas()
})

document.getElementById('undo-btn').addEventListener('click', handleUndo)
document.getElementById('redo-btn').addEventListener('click', handleRedo)

updateUndoRedoButtons()

const mainToolbar = document.getElementById('main-toolbar')
let toolbarPositionManager

if (mainToolbar) {
  const savedLayout = localStorage.getItem('toolbar-layout') || 'vertical'
  const savedVerticalPosition = localStorage.getItem('toolbar-position-vertical') || 'left'
  const savedHorizontalPosition = localStorage.getItem('toolbar-position-horizontal') || 'bottom'
  
  toolbarPositionManager = new ToolbarPositionManager(mainToolbar, {
    layout: savedLayout,
    verticalPosition: savedVerticalPosition,
    horizontalPosition: savedHorizontalPosition
  })
  
  toolbarPositionManager.setLayout(savedLayout)
  
  mainToolbar.addEventListener('mousedown', (e) => {
    ipcRenderer.send('focus-window')
    if (state.tool === 'text' && !e.target.closest('#text-input')) {
      e.preventDefault()
    }
  })
}

function updateToolbarMovingState() {
  const disableToolbarMoving = localStorage.getItem('disable-toolbar-moving') !== 'false'
  if (disableToolbarMoving) {
    mainToolbar.classList.add('toolbar-moving-disabled')
  } else {
    mainToolbar.classList.remove('toolbar-moving-disabled')
  }
}

updateToolbarMovingState()

ipcRenderer.on('layout-changed', (event, layout) => {
  if (toolbarPositionManager) {
    toolbarPositionManager.setLayout(layout)
  }
})

ipcRenderer.on('vertical-position-changed', (event, position) => {
  if (toolbarPositionManager) {
    toolbarPositionManager.setVerticalPosition(position)
  }
})

ipcRenderer.on('horizontal-position-changed', (event, position) => {
  if (toolbarPositionManager) {
    toolbarPositionManager.setHorizontalPosition(position)
  }
})

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSettings()
} else {
  document.addEventListener('DOMContentLoaded', initSettings)
}

function initSettings() {
  const menuBtn = document.getElementById('menu-btn')
  if (!menuBtn) return

  menuBtn.addEventListener('click', function openSettings(e) {
    e.stopPropagation()
    e.preventDefault()
    ipcRenderer.send('open-settings')
    playSound('pop')
  }, true)
}

function updateSettingsBadge(show) {
  const settingsBadge = document.getElementById('settings-badge')
  const moreSettingsBadge = document.getElementById('more-settings-badge')
  
  if (settingsBadge) {
    settingsBadge.style.display = show ? 'flex' : 'none'
  }
  if (moreSettingsBadge) {
    moreSettingsBadge.style.display = show ? 'flex' : 'none'
  }
}

ipcRenderer.on('update-settings-badge', (event, show) => {
  updateSettingsBadge(show)
})

function checkSettingsBadge() {
  const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
  const saveDirectory = localStorage.getItem('save-directory-path')
  
  if (autoSaveEnabled && saveDirectory) {
    ipcRenderer.invoke('check-directory-exists', saveDirectory).then(exists => {
      updateSettingsBadge(!exists)
    }).catch(err => console.error('Failed to check directory:', err))
  } else {
    updateSettingsBadge(false)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkSettingsBadge, 500)
  })
} else {
  setTimeout(checkSettingsBadge, 500)
}

setInterval(() => {
  const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
  const saveDirectory = localStorage.getItem('save-directory-path')
  
  if (autoSaveEnabled && saveDirectory) {
    ipcRenderer.invoke('check-directory-exists', saveDirectory).then(exists => {
      updateSettingsBadge(!exists)
    }).catch(err => console.error('Failed to check directory:', err))
  }
}, 5000)

function updateReduceClutter() {
  const reduceClutterValue = localStorage.getItem('reduce-clutter')
  const reduceClutter = reduceClutterValue === null ? true : reduceClutterValue === 'true'
  const standbyInToolbarValue = localStorage.getItem('standby-in-toolbar')
  const standbyInToolbar = standbyInToolbarValue === null ? false : standbyInToolbarValue === 'true'
  
  const undoBtn = document.getElementById('undo-btn')
  const redoBtn = document.getElementById('redo-btn')
  const hideBtn = document.getElementById('hide-btn')
  const standbyBtnEl = document.getElementById('standby-btn')
  const moreStandbyBtnEl = document.getElementById('more-standby-btn')
  const menuBtn = document.getElementById('menu-btn')
  const moreMenuBtn = document.getElementById('more-menu-btn')
  const moreMenuDropdown = document.getElementById('more-menu-dropdown')
  
  if (reduceClutter) {
    if (undoBtn) undoBtn.style.display = 'none'
    if (redoBtn) redoBtn.style.display = 'none'
    if (hideBtn) hideBtn.style.display = 'none'
    if (standbyBtnEl) standbyBtnEl.style.display = standbyInToolbar ? 'flex' : 'none'
    if (moreStandbyBtnEl) moreStandbyBtnEl.style.display = standbyInToolbar ? 'none' : 'flex'
    if (menuBtn) menuBtn.style.display = 'none'
    
    if (moreMenuBtn) moreMenuBtn.style.display = 'flex'
  } else {
    if (undoBtn) undoBtn.style.display = 'flex'
    if (redoBtn) redoBtn.style.display = 'flex'
    if (hideBtn) hideBtn.style.display = 'flex'
    if (standbyBtnEl) standbyBtnEl.style.display = 'flex'
    if (moreStandbyBtnEl) moreStandbyBtnEl.style.display = 'none'
    if (menuBtn) menuBtn.style.display = 'flex'
    
    if (moreMenuBtn) moreMenuBtn.style.display = 'none'
    if (moreMenuDropdown) moreMenuDropdown.classList.remove('show')
  }
}

function initMoreMenu() {
  const moreMenuBtn = document.getElementById('more-menu-btn')
  const moreMenuDropdown = document.getElementById('more-menu-dropdown')
  const moreUndoBtn = document.getElementById('more-undo-btn')
  const moreRedoBtn = document.getElementById('more-redo-btn')
  const moreHideBtn = document.getElementById('more-hide-btn')
  const moreMenuSettingsBtn = document.getElementById('more-menu-settings-btn')
  
  if (!moreMenuBtn || !moreMenuDropdown) return
  
  moreMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    hideAllTooltips()
    const isVisible = moreMenuDropdown.classList.contains('show')
    if (isVisible) {
      moreMenuDropdown.classList.remove('show')
    } else {
      closeAllPopups()
      moreMenuDropdown.classList.add('show')
    }
  })
  
  document.addEventListener('click', (e) => {
    if (!moreMenuDropdown.contains(e.target) && e.target !== moreMenuBtn && !moreMenuBtn.contains(e.target)) {
      moreMenuDropdown.classList.remove('show')
    }
  })
  
  if (moreUndoBtn) {
    moreUndoBtn.addEventListener('click', () => {
      handleUndo()
      moreMenuDropdown.classList.remove('show')
    })
  }
  
  if (moreRedoBtn) {
    moreRedoBtn.addEventListener('click', () => {
      handleRedo()
      moreMenuDropdown.classList.remove('show')
    })
  }
  
  if (moreHideBtn) {
    moreHideBtn.addEventListener('click', () => {
      document.getElementById('hide-btn').click()
      moreMenuDropdown.classList.remove('show')
    })
  }
  
  if (moreMenuSettingsBtn) {
    moreMenuSettingsBtn.addEventListener('click', () => {
      document.getElementById('menu-btn').click()
      moreMenuDropdown.classList.remove('show')
    })
  }
  
  function updateMoreMenuButtons() {
    const canUndo = state.historyIndex > 0 && state.history.length > 0
    const canRedo = state.historyIndex < state.history.length - 1
    
    if (moreUndoBtn) {
      if (canUndo) {
        moreUndoBtn.classList.remove('disabled')
      } else {
        moreUndoBtn.classList.add('disabled')
      }
    }
    
    if (moreRedoBtn) {
      if (canRedo) {
        moreRedoBtn.classList.remove('disabled')
      } else {
        moreRedoBtn.classList.add('disabled')
      }
    }
  }
  
  updateMoreMenuButtons()
}

function syncSettingsFromMain() {
  try {
    const settings = ipcRenderer.sendSync('get-system-settings')
    if (settings) {
      if (settings.standbyInToolbar !== undefined) {
        localStorage.setItem('standby-in-toolbar', settings.standbyInToolbar ? 'true' : 'false')
      }
    }
  } catch (e) {
  }
  updateReduceClutter()
  initMoreMenu()
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  syncSettingsFromMain()
} else {
  document.addEventListener('DOMContentLoaded', () => {
    syncSettingsFromMain()
  })
}

ipcRenderer.on('reduce-clutter-changed', (event, enabled) => {
  localStorage.setItem('reduce-clutter', enabled ? 'true' : 'false')
  setTimeout(() => updateReduceClutter(), 0)
})

ipcRenderer.on('disable-toolbar-moving-changed', (event, enabled) => {
  localStorage.setItem('disable-toolbar-moving', enabled ? 'true' : 'false')
  updateToolbarMovingState()
})

ipcRenderer.on('standby-in-toolbar-changed', (event, enabled) => {
  localStorage.setItem('standby-in-toolbar', enabled ? 'true' : 'false')
  standbyManager.updateStandbyButtons(enabled)
})

ipcRenderer.on('sync-toolbar-settings', (event, settings) => {
  if (settings.standbyInToolbar !== undefined) {
    localStorage.setItem('standby-in-toolbar', settings.standbyInToolbar ? 'true' : 'false')
  }
  if (settings.reduceClutter !== undefined) {
    localStorage.setItem('reduce-clutter', settings.reduceClutter ? 'true' : 'false')
  }
  updateReduceClutter()
})

ipcRenderer.on('hardware-acceleration-changed', (event, enabled) => {
  localStorage.setItem('hardware-acceleration', enabled ? 'true' : 'false')
  if (enabled) {
    canvas.style.willChange = 'contents'
    canvas.style.transform = 'translateZ(0)'
    canvas.style.backfaceVisibility = 'hidden'
    const pCanvas = CanvasManager.getPreviewCanvas()
    if (pCanvas) {
      pCanvas.style.willChange = 'contents'
      pCanvas.style.transform = 'translateZ(0)'
      pCanvas.style.backfaceVisibility = 'hidden'
    }
    const sCanvas = CanvasManager.getSelectionCanvas()
    if (sCanvas) {
      sCanvas.style.willChange = 'contents'
      sCanvas.style.transform = 'translateZ(0)'
      sCanvas.style.backfaceVisibility = 'hidden'
    }
  } else {
    canvas.style.willChange = ''
    canvas.style.transform = ''
    canvas.style.backfaceVisibility = ''
    const pCanvas = CanvasManager.getPreviewCanvas()
    if (pCanvas) {
      pCanvas.style.willChange = ''
      pCanvas.style.transform = ''
      pCanvas.style.backfaceVisibility = ''
    }
    const sCanvas = CanvasManager.getSelectionCanvas()
    if (sCanvas) {
      sCanvas.style.willChange = ''
      sCanvas.style.transform = ''
      sCanvas.style.backfaceVisibility = ''
    }
  }
});

ipcRenderer.on('accent-color-changed', (event, color) => {
  updateAccentColor(color)
})

ipcRenderer.on('toolbar-bg-changed', (event, data) => {
  localStorage.setItem('toolbar-accent-bg', data.enabled ? 'true' : 'false')
  updateToolbarBackgroundColor()
})

ipcRenderer.on('windows-accent-color-changed', (event, color) => {
  updateAccentColor(color)
})

ipcRenderer.on('sounds-changed', (event, enabled) => {
  const soundsCheckbox = document.getElementById('sounds-enabled')
  if (soundsCheckbox) {
    soundsCheckbox.checked = enabled
  }
})

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSettings()
} else {
  document.addEventListener('DOMContentLoaded', initSettings)
}

function initSoundsSetting() {
  const soundsCheckbox = document.getElementById('sounds-enabled')
  if (soundsCheckbox) {
    const soundsEnabled = localStorage.getItem('sounds-enabled')
    if (soundsEnabled !== null) {
      soundsCheckbox.checked = soundsEnabled === 'true'
    }
    
    soundsCheckbox.addEventListener('change', (e) => {
      localStorage.setItem('sounds-enabled', e.target.checked)
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSoundsSetting)
} else {
  initSoundsSetting()
}

initThemeManager()

function updateAccentColor(color) {
  document.documentElement.style.setProperty('--accent-color', color)
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`)
  
  const hoverR = Math.max(0, r - 30)
  const hoverG = Math.max(0, g - 30)
  const hoverB = Math.max(0, b - 30)
  const hoverColor = `#${hoverR.toString(16).padStart(2, '0')}${hoverG.toString(16).padStart(2, '0')}${hoverB.toString(16).padStart(2, '0')}`
  document.documentElement.style.setProperty('--accent-hover', hoverColor)
  
  document.documentElement.style.setProperty('--accent-active-bg', `rgba(${r}, ${g}, ${b}, 0.15)`)
  document.documentElement.style.setProperty('--accent-active-shadow', `rgba(${r}, ${g}, ${b}, 0.3)`)
  
  const isLight = isLightColor(color)
  const textColor = isLight ? '#000000' : '#ffffff'
  document.documentElement.style.setProperty('--picker-btn-text-color', textColor)
  document.documentElement.style.setProperty('--accent-text', textColor)

  const pickerBtn = document.getElementById('open-color-picker-btn')
  if (pickerBtn) {
    pickerBtn.style.color = textColor
  }
  
  localStorage.setItem('accent-color', color)
  
  updateToolbarBackgroundColor()
}

const savedAccentColor = localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR
updateAccentColor(savedAccentColor)

updateToolbarBackgroundColor()

initTooltips()

const standbyManager = initStandbyManager({
  state,
  canvas,
  setTool,
  closeAllPopups,
  finishTextInput: () => textTool.finishTextInput(),
  playSound
})

window.commandMenu = initCommandMenu({
  setTool,
  setShape,
  undo: handleUndo,
  redo: handleRedo,
  clearCanvas,
  standbyManager,
  triggerCapture,
  playSound
})

const commandMenu = window.commandMenu

initShortcutManager({
  state,
  standbyManager,
  selectTool,
  setTool,
  undo: handleUndo,
  redo: handleRedo,
  clearCanvas,
  copySelectedElements: handleCopy,
  pasteElements: handlePaste,
  toggleCommandMenu: () => commandMenu.toggleCommandMenu(),
  closeCommandMenu: () => commandMenu.closeCommandMenu(),
  setColor,
  setShape,
  playSound,
  hideAllTooltips,
  closeAllPopups
})

let canvasVisible = true
const hideBtn = document.getElementById('hide-btn')
if (hideBtn) {
  hideBtn.addEventListener('click', () => {
    canvasVisible = !canvasVisible
    canvas.style.opacity = canvasVisible ? '1' : '0'
    canvas.style.pointerEvents = canvasVisible ? 'auto' : 'none'
    
    const sCanvas = CanvasManager.getSelectionCanvas()
    if (sCanvas) {
      sCanvas.style.opacity = canvasVisible ? '1' : '0'
    }
    const pCanvas = CanvasManager.getPreviewCanvas()
    if (pCanvas) {
      pCanvas.style.opacity = canvasVisible ? '1' : '0'
    }

    const icon = document.querySelector('#hide-btn .material-symbols-outlined')
    const moreIcon = document.querySelector('#more-hide-btn .material-symbols-outlined')
    if (icon) icon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    if (moreIcon) moreIcon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    
    const soundType = canvasVisible ? 'visibilityOn' : 'visibilityOff'
    playSound(soundType)
  })
}

let toolbarWasVisible = false
let standbyWasActive = false
let commandMenuWasVisible = false

function restoreCaptureState() {
  const toolbar = document.getElementById('main-toolbar')
  if (toolbar && toolbarWasVisible) {
    toolbar.style.display = ''
  }

  if (standbyWasActive) {
    standbyManager.resume()
  }

  if (commandMenuWasVisible && window.commandMenu) {
    window.commandMenu.toggleCommandMenu()
    commandMenuWasVisible = false
  }

  state.enabled = true
  canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
  
  toolbarWasVisible = false
  standbyWasActive = false
}

async function triggerCapture() {
  try {
    const toolbar = document.getElementById('main-toolbar')
    toolbarWasVisible = toolbar && toolbar.style.display !== 'none'
    standbyWasActive = state.standbyMode
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = 'none'
    }

    const commandMenuOverlay = document.getElementById('command-menu-overlay')
    commandMenuWasVisible = commandMenuOverlay && (commandMenuOverlay.style.display === 'flex' || commandMenuOverlay.classList.contains('show'))
    
    if (commandMenuWasVisible && window.commandMenu) {
      window.commandMenu.closeCommandMenu()
    }

    state.enabled = false
    canvas.style.pointerEvents = 'none'
    
    if (standbyWasActive) {
      standbyManager.pause()
    }

    ipcRenderer.invoke('open-capture-overlay').catch(async (error) => {
      await ipcRenderer.invoke('show-error-dialog', 'Capture Error', 'Failed to open capture overlay', error.message || 'Please try again.')
      restoreCaptureState()
    })
  } catch (error) {
    await ipcRenderer.invoke('show-error-dialog', 'Capture Error', 'Failed to open capture overlay', error.message || 'Please try again.')
    restoreCaptureState()
  }
}

document.getElementById('capture-btn').addEventListener('click', triggerCapture)

ipcRenderer.on('trigger-capture', triggerCapture)

ipcRenderer.on('capture-cancelled', restoreCaptureState)

ipcRenderer.on('capture-selection-result', (event, desktopDataURL, bounds) => {
  
  if (!desktopDataURL || !bounds) {
    alert('Failed to capture selection. Please try again.')
    return
  }

  restoreCaptureState(false)

  playSound('capture')

  const desktopImg = new Image()
  desktopImg.onload = async () => {
    try {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = bounds.width
      tempCanvas.height = bounds.height
      const tempCtx = tempCanvas.getContext('2d')

      tempCtx.drawImage(desktopImg, 0, 0, bounds.width, bounds.height)

      const canvasRect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / canvasRect.width
      const scaleY = canvas.height / canvasRect.height

      const canvasX = (bounds.x - canvasRect.left) * scaleX
      const canvasY = (bounds.y - canvasRect.top) * scaleY
      const canvasWidth = bounds.width * scaleX
      const canvasHeight = bounds.height * scaleY

      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = canvas.width
      sourceCanvas.height = canvas.height
      const sourceCtx = sourceCanvas.getContext('2d')
      sourceCtx.drawImage(canvas, 0, 0)

      const annotationImg = sourceCanvas.toDataURL()
      const annotationImage = new Image()
      annotationImage.onload = () => {
        tempCtx.drawImage(annotationImage, canvasX, canvasY, canvasWidth, canvasHeight)

        const dataURL = tempCanvas.toDataURL('image/png')
        ipcRenderer.send('save-screenshot', dataURL, `annotation-${Date.now()}.png`)
      }
      annotationImage.onerror = () => {
        restoreCaptureState()
      }
      annotationImage.src = annotationImg
    } catch (error) {
      await ipcRenderer.invoke('show-error-dialog', 'Processing Error', 'Error processing capture', error.message)
      restoreCaptureState()
    }
  }
  desktopImg.onerror = () => {
    alert('Failed to load desktop screenshot. Please try again.')
    restoreCaptureState()
  }
  desktopImg.src = desktopDataURL
})

ipcRenderer.on('screenshot-saved', () => {
})

ipcRenderer.on('close-toolbar-on-esc', () => {
  const closeBtn = document.getElementById('close-btn')
  if (closeBtn) {
    closeBtn.click()
  }
})

const closeBtn = document.getElementById('close-btn')
if (closeBtn) {
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    
    standbyManager.disable(false)
    
    ipcRenderer.send('hide-window')
  })
}

ipcRenderer.on('clear', clearCanvas)
ipcRenderer.on('draw-mode', (_, enabled) => {
  if (enabled) {
    initAudioContext()
    setTimeout(() => {
      playSound('pop')
    }, 50)
  }
  state.enabled = enabled
  canvas.style.pointerEvents = enabled ? 'auto' : 'none'
})

ipcRenderer.on('restore-annotations', (_, data) => {
  if (data && data.elements && Array.isArray(data.elements)) {
    state.elements = data.elements
    state.nextElementId = data.nextElementId || (data.elements.length + 1)
    state.hasDrawn = data.elements.length > 0
    state.history = []
    state.historyIndex = -1
    saveState()
    redrawCanvas()
    updateUndoRedoButtons()
  }
})

window.addEventListener('storage', (e) => {
  if (e.key === 'snap-to-objects-enabled') {
    state.snapToObjectsEnabled = e.newValue === 'true'
  }
})