const { ipcRenderer } = require('electron')
const { DEFAULT_ACCENT_COLOR } = require('../../shared/constants.js')
const { initSelectTool } = require('../modules/tools/selectTool.js')
const { initTextTool } = require('../modules/tools/textTool.js')
const { initStickyNoteTool } = require('../modules/tools/stickyNoteTool.js')
const { initColorPickerTool } = require('../modules/tools/colorPicker.js')
const { initCommandMenu } = require('../modules/tools/commandMenu.js')
const { initThemeManager, applyTheme, updateToolbarBackgroundColor } = require('../modules/utils/managers/themeManager.js')
const { initTooltips, hideAllTooltips } = require('../modules/utils/managers/tooltipManager.js')
const { initAudioContext, playSound } = require('../modules/utils/audio/soundEffects.js')
const { initStandbyManager } = require('../modules/utils/managers/standbyManager.js')
const { initShortcutManager } = require('../modules/utils/events/shortcutManager.js')
const ToolbarPositionManager = require('../modules/utils/managers/toolbarPositionManager')
const { initWindowControls } = require('../../shared/window-controls.js')
const WidgetComponent = require('../modules/components/WidgetComponent.js')

WidgetComponent.init()

const isWhiteboard = window.location.pathname.includes('whiteboard.html')

const CanvasManager = require('../modules/core/CanvasManager.js')
CanvasManager.init(() => redrawCanvas())
const canvas = CanvasManager.getCanvas()
const ctx = CanvasManager.getCtx()
const optimizedRendering = CanvasManager.isOptimizedRendering()

document.addEventListener('click', initAudioContext, { once: true })
document.addEventListener('mousedown', initAudioContext, { once: true })

const { init: initInputHandler, updateCursor } = require('../modules/input/InputHandler.js')
const { state, createElement, saveState, undo, redo } = require('../modules/core/AppState.js')
const { drawArrow } = require('../modules/utils/drawings/DrawingUtils.js')
const { drawText, drawStickyNote } = require('../modules/utils/drawings/StickyNoteDrawingUtils.js')

canvas.style.pointerEvents = 'auto'

ctx.lineCap = 'round'
ctx.lineJoin = 'round'

function drawGrid(targetCtx = ctx) {
  if (isWhiteboard) {
    if (state.whiteboardGridMode === 'none') return
  } else {
    if (!state.gridEnabled) return
  }
  
  targetCtx.save()
  
  const viewportX = -state.panX;
  const viewportY = -state.panY;
  const viewportWidth = canvas.width;
  const viewportHeight = canvas.height;

  if (isWhiteboard) {
    const isDark = state.whiteboardPageColor === '#1a1a1a';
    const customGridColor = state.whiteboardGridColor && state.whiteboardGridColor !== 'default' ? state.whiteboardGridColor : null;
    
    if (customGridColor) {
      targetCtx.strokeStyle = customGridColor + '40';
      targetCtx.fillStyle = customGridColor + '60';
    } else {
      targetCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)'
      targetCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    }
  } else {
    const isDark = document.body.getAttribute('data-theme') === 'dark'
    targetCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    targetCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
  }
  targetCtx.lineWidth = 1

  if (isWhiteboard && state.whiteboardGridMode === 'dotted') {
    const dotRadius = 2
    const startX = Math.floor(viewportX / state.gridSize) * state.gridSize;
    const endX = Math.ceil((viewportX + viewportWidth) / state.gridSize) * state.gridSize;
    const startY = Math.floor(viewportY / state.gridSize) * state.gridSize;
    const endY = Math.ceil((viewportY + viewportHeight) / state.gridSize) * state.gridSize;

    for (let x = startX; x <= endX; x += state.gridSize) {
      for (let y = startY; y <= endY; y += state.gridSize) {
        targetCtx.beginPath()
        targetCtx.arc(x, y, dotRadius, 0, Math.PI * 2)
        targetCtx.fill()
      }
    }
  } else if (isWhiteboard && state.whiteboardGridMode === 'isometric') {
    const spacing = state.gridSize;
    const tan30 = 0.57735;
    const verticalSpacing = spacing * 0.866 * 2;
    
    targetCtx.beginPath();
    
    const startX = Math.floor(viewportX / verticalSpacing) * verticalSpacing;
    const endX = Math.ceil((viewportX + viewportWidth) / verticalSpacing) * verticalSpacing;
    
    for (let x = startX; x <= endX; x += verticalSpacing) {
      targetCtx.moveTo(x, viewportY);
      targetCtx.lineTo(x, viewportY + viewportHeight);
    }
    
    const slantSpacing = spacing;
    
    const c1_min = viewportY - (viewportX + viewportWidth) * tan30;
    const c1_max = viewportY + viewportHeight - viewportX * tan30;
    const startY1 = Math.floor(c1_min / slantSpacing) * slantSpacing;
    const endY1 = Math.ceil(c1_max / slantSpacing) * slantSpacing;

    for (let y = startY1; y <= endY1; y += slantSpacing) {
      targetCtx.moveTo(viewportX, y + viewportX * tan30);
      targetCtx.lineTo(viewportX + viewportWidth, y + (viewportX + viewportWidth) * tan30);
    }
    
    const c2_min = viewportY + viewportX * tan30;
    const c2_max = viewportY + viewportHeight + (viewportX + viewportWidth) * tan30;
    const startY2 = Math.floor(c2_min / slantSpacing) * slantSpacing;
    const endY2 = Math.ceil(c2_max / slantSpacing) * slantSpacing;

    for (let y = startY2; y <= endY2; y += slantSpacing) {
      targetCtx.moveTo(viewportX, y - viewportX * tan30);
      targetCtx.lineTo(viewportX + viewportWidth, y - (viewportX + viewportWidth) * tan30);
    }
    targetCtx.stroke();
  } else if (isWhiteboard && state.whiteboardGridMode === 'graph') {
    const minorSpacing = state.gridSize / 5;
    
    const startX = Math.floor(viewportX / state.gridSize) * state.gridSize;
    const endX = Math.ceil((viewportX + viewportWidth) / state.gridSize) * state.gridSize;
    const startY = Math.floor(viewportY / state.gridSize) * state.gridSize;
    const endY = Math.ceil((viewportY + viewportHeight) / state.gridSize) * state.gridSize;

    targetCtx.save();
    targetCtx.globalAlpha *= 0.4;
    targetCtx.beginPath();
    for (let x = startX; x <= endX; x += minorSpacing) {
      targetCtx.moveTo(x, viewportY);
      targetCtx.lineTo(x, viewportY + viewportHeight);
    }
    for (let y = startY; y <= endY; y += minorSpacing) {
      targetCtx.moveTo(viewportX, y);
      targetCtx.lineTo(viewportX + viewportWidth, y);
    }
    targetCtx.stroke();
    targetCtx.restore();
    
    targetCtx.beginPath();
    targetCtx.lineWidth = 1.5;
    for (let x = startX; x <= endX; x += state.gridSize) {
      targetCtx.moveTo(x, viewportY);
      targetCtx.lineTo(x, viewportY + viewportHeight);
    }
    for (let y = startY; y <= endY; y += state.gridSize) {
      targetCtx.moveTo(viewportX, y);
      targetCtx.lineTo(viewportX + viewportWidth, y);
    }
    targetCtx.stroke();
  } else if (isWhiteboard && state.whiteboardGridMode === 'hexagonal') {
    const s = state.gridSize / 1.5;
    const h = s * Math.sqrt(3);
    
    const startX = Math.floor(viewportX / (s * 3)) * (s * 3);
    const endX = Math.ceil((viewportX + viewportWidth) / (s * 3)) * (s * 3) + s * 3;
    const startY = Math.floor(viewportY / h) * h;
    const endY = Math.ceil((viewportY + viewportHeight) / h) * h + h;

    targetCtx.beginPath();
    for (let y = startY; y < endY; y += h) {
      for (let x = startX; x < endX; x += s * 3) {
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const px = x + s * Math.cos(angle);
          const py = y + s * Math.sin(angle);
          if (i === 0) targetCtx.moveTo(px, py);
          else targetCtx.lineTo(px, py);
        }
        targetCtx.closePath();

        const ox = x + s * 1.5;
        const oy = y + h / 2;
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const px = ox + s * Math.cos(angle);
          const py = oy + s * Math.sin(angle);
          if (i === 0) targetCtx.moveTo(px, py);
          else targetCtx.lineTo(px, py);
        }
        targetCtx.closePath();
      }
    }
    targetCtx.stroke();
  } else {
    targetCtx.beginPath()
    
    const startX = Math.floor(viewportX / state.gridSize) * state.gridSize;
    const endX = Math.ceil((viewportX + viewportWidth) / state.gridSize) * state.gridSize;
    const startY = Math.floor(viewportY / state.gridSize) * state.gridSize;
    const endY = Math.ceil((viewportY + viewportHeight) / state.gridSize) * state.gridSize;

    if (!isWhiteboard || state.whiteboardGridMode === 'grid') {
      for (let x = startX; x <= endX; x += state.gridSize) {
        targetCtx.moveTo(x, viewportY)
        targetCtx.lineTo(x, viewportY + viewportHeight)
      }
    }

    if (!isWhiteboard || state.whiteboardGridMode === 'grid' || state.whiteboardGridMode === 'lines') {
      for (let y = startY; y <= endY; y += state.gridSize) {
        targetCtx.moveTo(viewportX, y)
        targetCtx.lineTo(viewportX + viewportWidth, y)
      }
    }
    
    targetCtx.stroke()
  }
  targetCtx.restore()
}

window.drawGridOnBuffer = (targetCtx) => drawGrid(targetCtx);

function redrawCanvas() {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1.0
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  
  ctx.save()
  ctx.translate(state.panX, state.panY)

  drawGrid()

  state.elements.forEach(element => {
    if (element) drawElement(element)
  })
  
  ctx.restore()
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
  
  if (element.rotation) {
    const bounds = getElementBounds(element, true)
    if (bounds) {
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + bounds.height / 2
      ctx.translate(centerX, centerY)
      ctx.rotate(element.rotation)
      ctx.translate(-centerX, -centerY)
    }
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
    drawText(ctx, element)
  } else if (element.type === 'stickyNote') {
    drawStickyNote(ctx, element, isLightColor)
  }
  
  ctx.restore()
}

const { getElementBounds, hitTest, findElementAt } = require('../modules/utils/drawings/CollisionUtils.js')

function updateSelectionOverlay() {
  const { selectionCtx, selectionCanvas } = CanvasManager.createSelectionCanvas()
  if (!selectionCtx) return
  
  selectionCtx.save()
  selectionCtx.setTransform(1, 0, 0, 1, 0, 0)
  selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height)
  selectionCtx.restore()
  
  selectionCtx.save()
  selectionCtx.translate(state.panX, state.panY)
  
  selectTool.drawSelectionIndicators(selectionCtx)
  
  if (state.tool === 'select' && state.isSelecting) {
    selectTool.drawSelectionBox(selectionCtx)
  }
  
  selectionCtx.restore()
  
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
  playSound: (type) => playSound(type),
  getToolbarPositionManager: () => toolbarPositionManager
})

const textTool = initTextTool(state, canvas, {
  createElement,
  redrawCanvas: () => redrawCanvas(),
  saveState: () => saveState(updateUndoRedoButtons),
  updateSelectionOnly: () => updateSelectionOnly()
})

const stickyNoteTool = initStickyNoteTool(state, canvas, {
  createElement,
  redrawCanvas: () => redrawCanvas(),
  saveState: () => saveState(updateUndoRedoButtons)
})

const colorTool = initColorPickerTool({
  state,
  selectTool,
  textTool,
  stickyNoteTool,
  playSound,
  hideAllTooltips,
  closeAllPopups,
  redrawCanvas: () => redrawCanvas()
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
  stickyNoteTool,
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

  if (tool !== 'sticky-note' && tool !== 'select') {
    const stickyContainer = document.getElementById('sticky-note-input-container')
    if (stickyContainer && stickyContainer.style.display === 'flex') {
      stickyNoteTool.finishStickyNoteInput()
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
  state.hasDrawn = state.elements.length > 0
}

saveState(updateUndoRedoButtons)

const { copySelectedElements, pasteElements } = require('../modules/tools/clipboardTool.js')

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

document.getElementById('sticky-note-btn').addEventListener('click', () => {
  const stickyBtn = document.getElementById('sticky-note-btn')
  if (state.tool === 'sticky-note' && stickyBtn.classList.contains('active')) {
    setTool('pencil')
  } else {
    setTool('sticky-note')
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
    document.getElementById('more-menu-dropdown'),
    document.getElementById('sticky-note-input-container'),
    document.getElementById('timer-settings-popup'),
    document.getElementById('clock-settings-popup')
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
  closeAllPopups()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  state.elements = []
  state.selectedElements = []
  state.nextElementId = 1
  state.history = []
  state.historyIndex = -1
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
  
  mainToolbar.addEventListener('mousedown', (e) => {
    ipcRenderer.send('focus-window')
    if (state.tool === 'text' && !e.target.closest('#text-input')) {
      e.preventDefault()
    }
  })
}

function updateToolbarMovingState() {
  const toolbarDraggingEnabled = localStorage.getItem('toolbar-dragging-enabled') !== 'false'
  if (toolbarDraggingEnabled) {
    mainToolbar.classList.remove('toolbar-moving-disabled')
  } else {
    mainToolbar.classList.add('toolbar-moving-disabled')
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

ipcRenderer.on('element-eraser-changed', (event, enabled) => {
  state.elementEraserEnabled = enabled
  localStorage.setItem('element-eraser-enabled', enabled)
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
    }).catch(err => {
      ipcRenderer.invoke('show-error-dialog', 'Directory Error', 'Failed to check if save directory exists', err.message)
    })
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
    }).catch(err => {
      ipcRenderer.invoke('show-error-dialog', 'Directory Error', 'Failed to check if save directory exists', err.message)
    })
  }
}, 5000)

window.updateReduceClutter = updateReduceClutter
function updateReduceClutter() {
  const getSetting = (key, def) => {
    const val = localStorage.getItem(key);
    return val === null ? def : val === 'true';
  };

  const config = {
    reduceClutter: getSetting('reduce-clutter', true),
    standbyInToolbar: getSetting('standby-in-toolbar', false),
    isWhiteboard: isWhiteboard,
    stickyInToolbar: state.stickyNoteInToolbar
  };

  const visibilityMap = {
    'undo-btn': !config.reduceClutter,
    'redo-btn': !config.reduceClutter,
    'hide-btn': !config.reduceClutter && !config.isWhiteboard,
    'menu-btn': !config.reduceClutter,
    'more-menu-btn': config.reduceClutter,
    'capture-btn': !config.isWhiteboard,
    'standby-btn': config.reduceClutter 
      ? (config.standbyInToolbar && !config.isWhiteboard)
      : !config.isWhiteboard,
    'more-standby-btn': !config.reduceClutter && !config.isWhiteboard ? false : (config.reduceClutter && !config.standbyInToolbar && !config.isWhiteboard),
    'sticky-note-btn': config.reduceClutter ? config.stickyInToolbar : true,
    'more-sticky-note-btn': config.reduceClutter ? !config.stickyInToolbar : false
  };

  Object.entries(visibilityMap).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? 'flex' : 'none';
  });
}

updateReduceClutter()

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

  const moreStickyNoteBtn = document.getElementById('more-sticky-note-btn')
  if (moreStickyNoteBtn) {
    moreStickyNoteBtn.addEventListener('click', () => {
      setTool('sticky-note')
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

function initFeaturesShelf() {
  const openFeaturesBtn = document.getElementById('open-features-btn')
  const featuresShelfOverlay = document.getElementById('features-shelf-overlay')
  const closeFeaturesShelf = document.getElementById('close-features-shelf')
  const featuresShelfDone = document.getElementById('features-shelf-done')
  const featureWhiteboard = document.getElementById('feature-whiteboard')
  const moreMenuDropdown = document.getElementById('more-menu-dropdown')

  if (!openFeaturesBtn || !featuresShelfOverlay) return

  const toggleShelf = (show) => {
    if (show) {
      featuresShelfOverlay.style.display = 'flex'
      setTimeout(() => featuresShelfOverlay.classList.add('show'), 10)
      playSound('pop')
    } else {
      featuresShelfOverlay.classList.remove('show')
      setTimeout(() => featuresShelfOverlay.style.display = 'none', 400)
    }
  }

  openFeaturesBtn.addEventListener('click', () => {
    if (moreMenuDropdown) moreMenuDropdown.classList.remove('show')
    toggleShelf(true)
  })

  closeFeaturesShelf?.addEventListener('click', () => toggleShelf(false))
  featuresShelfDone?.addEventListener('click', () => toggleShelf(false))

  featuresShelfOverlay.addEventListener('click', (e) => {
    if (e.target === featuresShelfOverlay) toggleShelf(false)
  })

  featureWhiteboard?.addEventListener('click', () => {
    ipcRenderer.send('open-whiteboard')
    toggleShelf(false)
  })



  document.getElementById('feature-timer')?.addEventListener('click', () => {
    state.timerEnabled = !state.timerEnabled
    const card = document.querySelector('#feature-timer')
    card?.classList.toggle('active', state.timerEnabled)
    const timerWidget = document.getElementById('timer-widget')
    if (timerWidget) {
      timerWidget.style.display = state.timerEnabled ? 'flex' : 'none'
    }
    toggleShelf(false)
    playSound('pop')
  })

  document.getElementById('feature-clock')?.addEventListener('click', () => {
    state.clockEnabled = !state.clockEnabled
    const card = document.querySelector('#feature-clock')
    card?.classList.toggle('active', state.clockEnabled)
    const clockWidget = document.getElementById('clock-widget')
    if (clockWidget) {
      clockWidget.style.display = state.clockEnabled ? 'block' : 'none'
    }
    toggleShelf(false)
    playSound('pop')
  })

  const Dropdown = require('../modules/components/Dropdown.js')
  
  let clockStyle = localStorage.getItem('clock-style') || 'digital'
  let clockTimezone = localStorage.getItem('clock-timezone') || 'local'
  
  const clockSettingsBtn = document.getElementById('clock-settings-btn')
  const clockCloseBtn = document.getElementById('clock-close-btn')
  const clockSettingsPopup = document.getElementById('clock-settings-popup')
  const clockDigitalDisplay = document.getElementById('clock-digital-display')
  const clockAnalogDisplay = document.getElementById('clock-analog-display')
  const clockStyleBtns = document.querySelectorAll('.clock-style-btn')
  const clockTimezoneContainer = document.getElementById('clock-timezone-dropdown')

  const generateTimezoneOptions = () => {
    const common = [
      { value: 'local', label: 'Local Time', icon: 'home' },
      { value: 'UTC', label: 'UTC', icon: 'public' }
    ];
    
    const allTimezones = Intl.supportedValuesOf('timeZone');
    
    const formattedTimezones = allTimezones.map(tz => {
      const parts = tz.split('/');
      const city = (parts[parts.length - 1] || tz).replace(/_/g, ' ');
      
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'short'
        });
        const tzName = formatter.formatToParts(new Date()).find(p => p.type === 'timeZoneName').value;
        return { value: tz, label: `${city} (${tzName})` };
      } catch (e) {
        return { value: tz, label: city };
      }
    });

    formattedTimezones.sort((a, b) => a.label.localeCompare(b.label));
    
    return [...common, ...formattedTimezones];
  };

  const timezoneOptions = generateTimezoneOptions();

  let clockTimezoneDropdown = null
  if (clockTimezoneContainer) {
    clockTimezoneDropdown = new Dropdown({
      id: 'clock-tz-dropdown',
      options: timezoneOptions,
      defaultValue: clockTimezone,
      icon: 'schedule',
      searchable: true,
      searchPlaceholder: 'Search timezones...',
      onChange: (value) => {
        clockTimezone = value
        localStorage.setItem('clock-timezone', value)
        updateClockWidget()
        playSound('switch')
      }
    })
    clockTimezoneDropdown.render(clockTimezoneContainer)
  }

  function applyClockStyle(style) {
    clockStyle = style
    localStorage.setItem('clock-style', style)
    
    if (style === 'digital') {
      clockDigitalDisplay.style.display = 'flex'
      clockAnalogDisplay.style.display = 'none'
    } else {
      clockDigitalDisplay.style.display = 'none'
      clockAnalogDisplay.style.display = 'flex'
    }
    
    clockStyleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style)
    })
  }

  clockStyleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyClockStyle(btn.dataset.style)
      playSound('switch')
    })
  })

  if (clockSettingsBtn) {
    clockSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      
      if (!clockSettingsPopup?.classList.contains('show')) {
        const widget = document.getElementById('clock-widget')
        if (widget) {
          const rect = widget.getBoundingClientRect()
          const popupHeight = 60
          const dropdownHeight = 220
          const totalHeight = popupHeight + dropdownHeight
          
          const spaceBelow = window.innerHeight - rect.bottom
          const spaceAbove = rect.top
          
          if (spaceBelow < totalHeight && spaceAbove > spaceBelow) {
            clockSettingsPopup.classList.add('flip')
            const dropdown = clockSettingsPopup.querySelector('.app-dropdown')
            if (dropdown) dropdown.classList.add('flip')
          } else {
            clockSettingsPopup.classList.remove('flip')
            const dropdown = clockSettingsPopup.querySelector('.app-dropdown')
            if (dropdown) dropdown.classList.remove('flip')
          }
        }
      }
      
      clockSettingsPopup?.classList.toggle('show')
    })
  }

  if (clockCloseBtn) {
    clockCloseBtn.addEventListener('click', () => {
      state.clockEnabled = false
      const clockWidget = document.getElementById('clock-widget')
      if (clockWidget) clockWidget.style.display = 'none'
      const card = document.querySelector('#feature-clock')
      card?.classList.remove('active')
      playSound('pop')
    })
  }

  document.addEventListener('click', (e) => {
    if (clockSettingsPopup?.classList.contains('show')) {
      if (!clockSettingsPopup.contains(e.target) && e.target !== clockSettingsBtn) {
        clockSettingsPopup.classList.remove('show')
      }
    }
  })

  applyClockStyle(clockStyle)

  function updateClockWidget() {
    let now = new Date()
    
    if (clockTimezone !== 'local') {
      try {
        const options = { timeZone: clockTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        const formatter = new Intl.DateTimeFormat('en-GB', options)
        const parts = formatter.formatToParts(now)
        const hours = parseInt(parts.find(p => p.type === 'hour').value)
        const minutes = parseInt(parts.find(p => p.type === 'minute').value)
        const seconds = parseInt(parts.find(p => p.type === 'second').value)
        
        const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: clockTimezone, weekday: 'short' })
        const dayOfWeek = dayFormatter.format(now).toUpperCase()
        
        const hoursEl = document.getElementById('clock-hours')
        const minutesEl = document.getElementById('clock-minutes')
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0')
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0')
        
        updateAnalogHands(hours, minutes, seconds)
        updateAnalogInfo(hours, minutes, dayOfWeek)
      } catch (e) {
        updateClockLocal(now)
      }
    } else {
      updateClockLocal(now)
    }
  }

  function updateClockLocal(now) {
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const seconds = now.getSeconds()
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayOfWeek = days[now.getDay()]
    
    const hoursEl = document.getElementById('clock-hours')
    const minutesEl = document.getElementById('clock-minutes')
    if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0')
    if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0')
    
    updateAnalogHands(hours, minutes, seconds)
    updateAnalogInfo(hours, minutes, dayOfWeek)
  }

  function updateAnalogInfo(hours, minutes, dayOfWeek) {
    const dayEl = document.getElementById('analog-clock-day')
    const timeEl = document.getElementById('analog-clock-time')
    const periodEl = document.getElementById('analog-clock-period')
    
    if (dayEl) dayEl.textContent = dayOfWeek
    if (timeEl) {
      const hour12 = hours % 12 || 12
      timeEl.textContent = `${hour12}:${minutes.toString().padStart(2, '0')}`
    }
    if (periodEl) periodEl.textContent = hours >= 12 ? 'PM' : 'AM'
  }

  function updateAnalogHands(hours, minutes, seconds) {
    const hourHand = document.getElementById('analog-hour-hand')
    const minuteHand = document.getElementById('analog-minute-hand')
    const secondHand = document.getElementById('analog-second-hand')
    
    if (hourHand && minuteHand && secondHand) {
      const hourDeg = (hours % 12) * 30 + minutes * 0.5
      const minuteDeg = minutes * 6 + seconds * 0.1
      const secondDeg = seconds * 6
      
      hourHand.style.transform = `rotate(${hourDeg}deg)`
      minuteHand.style.transform = `rotate(${minuteDeg}deg)`
      secondHand.style.transform = `rotate(${secondDeg}deg)`
    }
  }

  setInterval(updateClockWidget, 1000)
  updateClockWidget()

  let timerHours = 0
  let timerMinutes = 5
  let timerSecondsVal = 0
  let timerInterval = null
  let timerRunning = false
  let timerStartTotal = 0
  let timerEndAction = localStorage.getItem('timer-end-action') || 'overlay'

  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 150

  function updateTimerProgress() {
    const progressBar = document.getElementById('timer-progress-bar')
    if (!progressBar) return
    
    const currentTotal = timerHours * 3600 + timerMinutes * 60 + timerSecondsVal
    
    if (timerStartTotal > 0) {
      const progress = currentTotal / timerStartTotal
      const offset = TIMER_CIRCUMFERENCE * (1 - progress)
      progressBar.style.strokeDashoffset = offset
    } else {
      progressBar.style.strokeDashoffset = 0
    }
  }

  function updateTimerDisplay() {
    const hoursEl = document.getElementById('timer-hours')
    const minutesEl = document.getElementById('timer-minutes')
    const secondsEl = document.getElementById('timer-seconds')
    if (hoursEl) hoursEl.value = timerHours.toString().padStart(2, '0')
    if (minutesEl) minutesEl.value = timerMinutes.toString().padStart(2, '0')
    if (secondsEl) secondsEl.value = timerSecondsVal.toString().padStart(2, '0')
    
    const btns = document.querySelectorAll('.timer-adjust-btn')
    btns.forEach(btn => {
      const action = btn.dataset.action
      let disabled = timerRunning
      
      if (!disabled) {
        if (action === 'hours-up' && timerHours >= 23) disabled = true
        if (action === 'hours-down' && timerHours <= 0) disabled = true
        if (action === 'minutes-up' && timerMinutes >= 59) disabled = true
        if (action === 'minutes-down' && timerMinutes <= 0) disabled = true
        if (action === 'seconds-up' && timerSecondsVal >= 59) disabled = true
        if (action === 'seconds-down' && timerSecondsVal <= 0) disabled = true
      }
      
      btn.classList.toggle('disabled', disabled)
      btn.disabled = disabled
    })

    updateTimerProgress()
  }

  function setupTimerInput(inputEl, getter, setter, max) {
    if (!inputEl) return
    
    inputEl.addEventListener('focus', () => {
      if (timerRunning) return
      inputEl.select()
    })
    
    inputEl.addEventListener('blur', () => {
      if (timerRunning) return
      let val = parseInt(inputEl.value, 10)
      if (isNaN(val) || val < 0) val = 0
      if (val > max) val = max
      setter(val)
      timerStartTotal = 0
      updateTimerDisplay()
    })
    
    inputEl.addEventListener('keydown', (e) => {
      if (timerRunning) return
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        inputEl.blur()
        return
      }
      if (!/^\d$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault()
      }
    })
  }
  
  setupTimerInput(document.getElementById('timer-hours'), 
    () => timerHours, 
    (v) => { timerHours = v }, 
    23
  )
  setupTimerInput(document.getElementById('timer-minutes'), 
    () => timerMinutes, 
    (v) => { timerMinutes = v }, 
    59
  )
  setupTimerInput(document.getElementById('timer-seconds'), 
    () => timerSecondsVal, 
    (v) => { timerSecondsVal = v }, 
    59
  )

  let holdInterval = null
  let holdTimeout = null
  
  function performAction(action) {
    if (action === 'hours-up') timerHours = Math.min(23, timerHours + 1)
    if (action === 'hours-down') timerHours = Math.max(0, timerHours - 1)
    if (action === 'minutes-up') timerMinutes = Math.min(59, timerMinutes + 1)
    if (action === 'minutes-down') timerMinutes = Math.max(0, timerMinutes - 1)
    if (action === 'seconds-up') timerSecondsVal = Math.min(59, timerSecondsVal + 1)
    if (action === 'seconds-down') timerSecondsVal = Math.max(0, timerSecondsVal - 1)
    timerStartTotal = 0
    updateTimerDisplay()
  }
  
  function stopHold() {
    if (holdTimeout) {
      clearTimeout(holdTimeout)
      holdTimeout = null
    }
    if (holdInterval) {
      clearInterval(holdInterval)
      holdInterval = null
    }
  }

  document.querySelectorAll('.timer-adjust-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (timerRunning) return
      performAction(btn.dataset.action)
    })
    
    btn.addEventListener('mousedown', (e) => {
      if (timerRunning) return
      const action = btn.dataset.action
      
      holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => {
          performAction(action)
        }, 80)
      }, 400)
    })
    
    btn.addEventListener('mouseup', stopHold)
    btn.addEventListener('mouseleave', stopHold)
  })

  document.getElementById('timer-play')?.addEventListener('click', () => {
    const timerWidget = document.getElementById('timer-widget')
    
    if (timerRunning) {
      clearInterval(timerInterval)
      timerInterval = null
      timerRunning = false
      timerWidget?.classList.remove('running')
      document.querySelector('#timer-play .material-symbols-outlined').textContent = 'play_arrow'
      updateTimerDisplay() 
    } else {
      const currentTotal = timerHours * 3600 + timerMinutes * 60 + timerSecondsVal
      if (currentTotal === 0) return
      
      if (timerStartTotal === 0) {
        timerStartTotal = currentTotal
      }
      
      timerRunning = true
      timerWidget?.classList.add('running')
      document.querySelector('#timer-play .material-symbols-outlined').textContent = 'pause'
      updateTimerDisplay()
      timerInterval = setInterval(() => {
        const totalSeconds = timerHours * 3600 + timerMinutes * 60 + timerSecondsVal
        if (totalSeconds > 0) {
          const newTotal = totalSeconds - 1
          timerHours = Math.floor(newTotal / 3600)
          timerMinutes = Math.floor((newTotal % 3600) / 60)
          timerSecondsVal = newTotal % 60
          updateTimerDisplay()
        } else {
          clearInterval(timerInterval)
          timerInterval = null
          timerRunning = false
          timerStartTotal = 0
          timerWidget?.classList.remove('running')
          document.querySelector('#timer-play .material-symbols-outlined').textContent = 'play_arrow'
          playSound('timerAlarm')
          updateTimerDisplay()
          if (timerEndAction === 'overlay') {
            showTimesUpOverlay()
          }
        }
      }, 1000)
    }
  })

  let confettiAnimationId = null
  
  function showTimesUpOverlay() {
    const overlay = document.getElementById('times-up-overlay')
    const canvas = document.getElementById('confetti-canvas')
    if (!overlay || !canvas) return
    
    overlay.style.display = 'flex'
    
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const confettiColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43']
    const confettiPieces = []
    
    for (let i = 0; i < 150; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 10 + 5,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5
      })
    }
    
    function animateConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      confettiPieces.forEach(piece => {
        ctx.save()
        ctx.translate(piece.x, piece.y)
        ctx.rotate(piece.rotation * Math.PI / 180)
        ctx.fillStyle = piece.color
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6)
        ctx.restore()
        
        piece.y += piece.speedY
        piece.x += piece.speedX
        piece.rotation += piece.rotationSpeed
        
        if (piece.y > canvas.height + 20) {
          piece.y = -20
          piece.x = Math.random() * canvas.width
        }
      })
      
      confettiAnimationId = requestAnimationFrame(animateConfetti)
    }
    
    animateConfetti()
  }
  
  function hideTimesUpOverlay() {
    const overlay = document.getElementById('times-up-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId)
      confettiAnimationId = null
    }
  }
  
  document.getElementById('times-up-dismiss')?.addEventListener('click', hideTimesUpOverlay)

  document.getElementById('timer-reset')?.addEventListener('click', () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    timerRunning = false
    timerHours = 0
    timerMinutes = 5
    timerSecondsVal = 0
    timerStartTotal = 0
    const timerWidget = document.getElementById('timer-widget')
    timerWidget?.classList.remove('running')
    document.querySelector('#timer-play .material-symbols-outlined').textContent = 'play_arrow'
    updateTimerDisplay()
  })

  document.getElementById('timer-close')?.addEventListener('click', () => {
    state.timerEnabled = false
    const timerWidget = document.getElementById('timer-widget')
    if (timerWidget) {
      timerWidget.style.display = 'none'
    }
    const card = document.querySelector('#feature-timer')
    card?.classList.remove('active')
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
      timerRunning = false
    }
  })

  function makeDraggable(element) {
    if (!element) return
    let isDragging = false
    let offsetX = 0
    let offsetY = 0
    let hasBeenDragged = false

    element.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return
      
      const rect = element.getBoundingClientRect()
      
      if (!hasBeenDragged) {
        element.style.transform = 'none'
        element.style.left = `${rect.left}px`
        element.style.top = `${rect.top}px`
        hasBeenDragged = true
      }
      
      isDragging = true
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
      element.style.cursor = 'grabbing'
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      
      const rect = element.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      
      let newX = e.clientX - offsetX
      let newY = e.clientY - offsetY
      
      const minVisible = 50
      newX = Math.max(-width + minVisible, Math.min(window.innerWidth - minVisible, newX))
      newY = Math.max(0, Math.min(window.innerHeight - minVisible, newY))
      
      element.style.left = `${newX}px`
      element.style.top = `${newY}px`
    })

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false
        element.style.cursor = 'move'
      }
    })
  }

  makeDraggable(document.getElementById('timer-widget'))
  makeDraggable(document.getElementById('clock-widget'))

  const timerSettingsBtn = document.getElementById('timer-settings-btn')
  const timerSettingsPopup = document.getElementById('timer-settings-popup')
  const timerEndActionBtns = document.querySelectorAll('.timer-end-action-btn')

  if (timerSettingsBtn && timerSettingsPopup) {
    timerSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      timerSettingsPopup.classList.toggle('show')
    })

    document.addEventListener('click', (e) => {
      if (!timerSettingsPopup.contains(e.target) && e.target !== timerSettingsBtn) {
        timerSettingsPopup.classList.remove('show')
      }
    })
  }

  function applyTimerEndAction(action) {
    timerEndAction = action
    localStorage.setItem('timer-end-action', action)
    timerEndActionBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === action)
    })
  }

  timerEndActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyTimerEndAction(btn.dataset.action)
      playSound('switch')
    })
  })

  applyTimerEndAction(timerEndAction)
  updateTimerDisplay()

}

function syncSettingsFromMain() {
  try {
    const settings = ipcRenderer.sendSync('get-system-settings')
    if (settings) {
      if (settings.standbyInToolbar !== undefined) {
        localStorage.setItem('standby-in-toolbar', settings.standbyInToolbar ? 'true' : 'false')
      }
      if (settings.stickyNoteInToolbar !== undefined) {
        state.stickyNoteInToolbar = settings.stickyNoteInToolbar
        localStorage.setItem('sticky-note-in-toolbar', state.stickyNoteInToolbar ? 'true' : 'false')
      }
    }
  } catch (e) {
  }
  updateReduceClutter()
  initMoreMenu()
  initFeaturesShelf()
}


ipcRenderer.on('sticky-note-in-toolbar-changed', (event, enabled) => {
  state.stickyNoteInToolbar = enabled
  localStorage.setItem('sticky-note-in-toolbar', enabled ? 'true' : 'false')
  updateReduceClutter()
})


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

ipcRenderer.on('toolbar-dragging-changed', (event, enabled) => {
  localStorage.setItem('toolbar-dragging-enabled', enabled ? 'true' : 'false')
  updateToolbarMovingState()
})

ipcRenderer.on('standby-in-toolbar-changed', (event, enabled) => {
  localStorage.setItem('standby-in-toolbar', enabled ? 'true' : 'false')
  updateReduceClutter()
  if (typeof standbyManager !== 'undefined') {
    standbyManager.updateStandbyButtons(enabled)
  }
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

initTooltips()

let standbyManager
if (!isWhiteboard) {
  standbyManager = initStandbyManager({
    state,
    canvas,
    setTool,
    closeAllPopups,
    finishTextInput: () => textTool.finishTextInput(),
    playSound
  })
} else {
  standbyManager = {
    isActive: () => false,
    enable: () => {},
    disable: () => {},
    toggle: () => {},
    pause: () => {},
    resume: () => {},
    updateStandbyButtons: () => {},
    shouldBlockAction: () => false
  }
}

window.commandMenu = initCommandMenu({
  setTool,
  setShape,
  undo: handleUndo,
  redo: handleRedo,
  clearCanvas,
  standbyManager,
  triggerCapture,
  playSound,
  applyTheme
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
  closeAllPopups,
  applyTheme
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
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    e.preventDefault()
    
    standbyManager.disable(false)
    
    const isWhiteboard = document.body.classList.contains('whiteboard-mode')
    if (isWhiteboard) {
      if (state.saveCurrentBoard) {
        await state.saveCurrentBoard()
      }
      ipcRenderer.send('window-close')
    } else {
      ipcRenderer.send('hide-window')
    }
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
    state.elements = data.elements.map(el => ({ ...el, _dirty: true }))
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
  if (e.key === 'reduce-clutter' || e.key === 'standby-in-toolbar') {
    updateReduceClutter()
  }
  if (e.key === 'accent-color') {
    applyAccentColor(e.newValue)
  }
  if (e.key === 'toolbar-accent-bg') {
    updateToolbarBackgroundColor()
  }
})

const { initWhiteboardMode } = require('../modules/utils/features/whiteboardManager.js')

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initWhiteboardMode({
      state,
      redrawCanvas,
      initWindowControls
    })
  })
} else {
  initWhiteboardMode({
    state,
    redrawCanvas,
    initWindowControls
  })
}