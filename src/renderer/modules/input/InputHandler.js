const { state, createElement, saveState } = require('../core/AppState.js')
const CanvasManager = require('../core/CanvasManager.js')
const { findElementAt } = require('../utils/drawings/CollisionUtils.js')
const { drawArrow } = require('../utils/drawings/DrawingUtils.js')

let selectTool
let textTool
let stickyNoteTool
let redrawCanvas

const _cursorCache = {}
let _fontsReady = false
const _cursorCanvas = document.createElement('canvas')
const _cursorCanvasCtx = _cursorCanvas.getContext('2d')

document.fonts.ready.then(() => {
  _fontsReady = true
  for (const key in _cursorCache) delete _cursorCache[key]
  try { updateCursor() } catch (_) {}
})

function getCachedCursor(name, iconText, size, hotX, hotY) {
  if (!_cursorCache[name]) {
    _cursorCanvas.width = size
    _cursorCanvas.height = size
    _cursorCanvasCtx.clearRect(0, 0, size, size)
    _cursorCanvasCtx.font = `${size}px 'Material Symbols Outlined'`
    _cursorCanvasCtx.textBaseline = 'top'
    _cursorCanvasCtx.fillStyle = '#e8eaed'
    _cursorCanvasCtx.fillText(iconText, 0, 0)
    _cursorCache[name] = `url("${_cursorCanvas.toDataURL()}") ${hotX} ${hotY}, auto`
  }
  return _cursorCache[name]
}

let isDrawing = false
let drawFrame = null
let currentStroke = null
let currentStrokePoints = []
let lastX = 0
let lastY = 0
let elementsDeleted = false
let _sidebarEl = null
let _panFrame = null

function init(dependencies) {
  selectTool = dependencies.selectTool
  textTool = dependencies.textTool
  stickyNoteTool = dependencies.stickyNoteTool
  redrawCanvas = dependencies.redrawCanvas

  const canvas = CanvasManager.getCanvas()
  
  canvas.addEventListener('mousedown', startDrawing)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', stopDrawing)
  canvas.addEventListener('mouseout', stopDrawing)
  canvas.addEventListener('dblclick', handleDoubleClick)
  canvas.addEventListener('contextmenu', (e) => {
    if (state.tool === 'select') {
      e.preventDefault();
    }
  })
  
  document.addEventListener('click', (e) => {
    if (state.contextMenuElement && !state.contextMenuElement.contains(e.target)) {
      if (selectTool && selectTool.hideContextMenu) {
        selectTool.hideContextMenu();
      }
    }
  })
  
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !state.isSpacePressed) {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.contentEditable === 'true') {
        return;
      }
      state.isSpacePressed = true;
      updateCursor();
      e.preventDefault();
    }
  })
    
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      state.isSpacePressed = false;
      state.isPanning = false;
      updateCursor();
    }
  })
  canvas.addEventListener('wheel', (e) => {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - state.panX
    const y = e.clientY - rect.top - state.panY
    
    const element = findElementAt(x, y)
    if (element && element.type === 'stickyNote') {
      e.preventDefault()
      
      if (element.scrollOffset === undefined) element.scrollOffset = 0
      
      const scrollSpeed = 20
      const delta = e.deltaY > 0 ? scrollSpeed : -scrollSpeed
      
      element.scrollOffset += delta
      if (element.scrollOffset < 0) element.scrollOffset = 0
      
      redrawCanvas()
    }
  }, { passive: false })
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    startDrawing(e)
  })
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    draw(e)
  })
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault()
    stopDrawing()
  })

  window.addEventListener('focus', updateCursor)
  
  const textInput = document.getElementById('text-input')
  if (textInput) {
    let textInputFinished = false

    textInput.addEventListener('blur', () => {
      if (!textInputFinished) {
        setTimeout(() => {
          textTool.finishTextInput()
          textInputFinished = false
        }, 100)
      }
    })

    textInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault(); e.stopPropagation(); document.execCommand('bold', false, null); textTool.updateTextFormatting(); return
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault(); e.stopPropagation(); document.execCommand('italic', false, null); textTool.updateTextFormatting(); return
        } else if (e.key.toLowerCase() === 'u') {
          e.preventDefault(); e.stopPropagation(); document.execCommand('underline', false, null); textTool.updateTextFormatting(); return
        }
      }
      
      if (e.key === 'Enter') {
        if (e.shiftKey) return
        e.preventDefault(); e.stopPropagation()
        textInputFinished = true
        textTool.finishTextInput()
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        textInputFinished = true
        textTool.cancelTextInput()
      }
    })

    textInput.addEventListener('input', () => {
      textTool.updateTextFormatting()
      if (typeof dependencies.updateSelectionOnly === 'function') {
        dependencies.updateSelectionOnly()
      } else if (selectTool && typeof selectTool.updateSelection === 'function') {
        selectTool.updateSelection()
      } else {
        redrawCanvas()
      }
    })
  }

  const stickyInput = document.getElementById('sticky-note-input')
  if (stickyInput) {
    stickyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        stickyNoteTool.finishStickyNoteInput()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        stickyNoteTool.cancelStickyNoteInput()
      }
    })
  }
}

function getCanvasCoordinates(e) {
  const canvas = CanvasManager.getCanvas()
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX || e.touches?.[0]?.clientX) - rect.left) - state.panX,
    y: ((e.clientY || e.touches?.[0]?.clientY) - rect.top) - state.panY
  }
}

function constrainToStraightLine(startX, startY, endX, endY) {
  const dx = Math.abs(endX - startX)
  const dy = Math.abs(endY - startY)
  if (dx < 5 && dy < 5) return { x: endX, y: endY }
  const ratio = dx > dy ? dy / dx : dx / dy
  if (ratio > 0.414) {
    const len = Math.max(dx, dy)
    return { x: startX + Math.sign(endX - startX) * len, y: startY + Math.sign(endY - startY) * len }
  }
  return dx > dy ? { x: endX, y: startY } : { x: startX, y: endY }
}


function clearPreview() {
  const { previewCtx, previewCanvas } = CanvasManager.createPreviewCanvas()
  if (previewCtx) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
  }
}

function drawShapePreview() {
  if (!state.shapeStart || !state.shapeEnd) return
  const { previewCtx, previewCanvas } = CanvasManager.createPreviewCanvas()
  if (!previewCtx) return

  previewCtx.save()
  previewCtx.setTransform(1, 0, 0, 1, 0, 0)
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
  previewCtx.translate(state.panX, state.panY)

  previewCtx.strokeStyle = state.color
  previewCtx.fillStyle = state.color
  previewCtx.lineWidth = state.strokeSize
  previewCtx.globalAlpha = 0.7
  
  const x = Math.min(state.shapeStart.x, state.shapeEnd.x)
  const y = Math.min(state.shapeStart.y, state.shapeEnd.y)
  const w = Math.abs(state.shapeEnd.x - state.shapeStart.x)
  const h = Math.abs(state.shapeEnd.y - state.shapeStart.y)
  
  const canFill = state.shapeType === 'rectangle' || state.shapeType === 'circle'
  const shouldFill = canFill && state.shapeFillEnabled
  
  if (state.shapeType === 'rectangle') {
    if (shouldFill) previewCtx.fillRect(x, y, w, h)
    else previewCtx.strokeRect(x, y, w, h)
  } else if (state.shapeType === 'circle') {
    const centerX = (state.shapeStart.x + state.shapeEnd.x) / 2
    const centerY = (state.shapeStart.y + state.shapeEnd.y) / 2
    const radius = Math.sqrt(w * w + h * h) / 2
    previewCtx.beginPath()
    previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    if (shouldFill) previewCtx.fill()
    else previewCtx.stroke()
  } else if (state.shapeType === 'line') {
    previewCtx.beginPath()
    previewCtx.moveTo(state.shapeStart.x, state.shapeStart.y)
    previewCtx.lineTo(state.shapeEnd.x, state.shapeEnd.y)
    previewCtx.stroke()
  } else if (state.shapeType === 'arrow') {
    drawArrow(previewCtx, state.shapeStart.x, state.shapeStart.y, state.shapeEnd.x, state.shapeEnd.y)
  }
  
  previewCtx.restore()
}

function checkForEraserHit(coords) {
  const element = findElementAt(coords.x, coords.y)
  if (element) {
    const index = state.elements.findIndex(e => e.id === element.id)
    if (index !== -1) {
      state.elements.splice(index, 1)
      
      const selIndex = state.selectedElements.indexOf(element.id)
      if (selIndex !== -1) {
        state.selectedElements.splice(selIndex, 1)
        if (selectTool && typeof selectTool.clearSelection === 'function') {
           selectTool.clearSelection() 
        }
      }
      
      redrawCanvas()
      elementsDeleted = true
    }
  }
}

function startDrawing(e) {
  if (!state.enabled || state.standbyMode) return

  if (!_sidebarEl) _sidebarEl = document.getElementById('wb-sidebar')
  if (_sidebarEl && _sidebarEl.classList.contains('open')) {
    const screenX = e.clientX || e.touches?.[0]?.clientX;
    const screenY = e.clientY || e.touches?.[0]?.clientY;
    
    if (screenX < 340 || screenY < 60 || screenY > (window.innerHeight - 20)) {
        return;
    }
  }

  if (state.isSpacePressed) {
    state.isPanning = true;
    lastX = e.clientX || e.touches?.[0]?.clientX;
    lastY = e.clientY || e.touches?.[0]?.clientY;
    updateCursor();
    return;
  }

  e.preventDefault()
  
  const textInput = document.getElementById('text-input')
  if (textInput && textInput.style.display === 'block') {
    textTool.finishTextInput()
  }

  const stickyContainer = document.getElementById('sticky-note-input-container')
  if (stickyContainer && stickyContainer.style.display === 'flex') {
    stickyNoteTool.finishStickyNoteInput()
    if (state.tool === 'sticky-note') return
  }
  
  if (state.tool === 'select') {
    const coords = getCanvasCoordinates(e)
    if (selectTool.handleSelectStart(e, coords)) {
      return
    }
  }
  
  if (state.tool === 'text') {
    const coords = getCanvasCoordinates(e)
    textTool.startTextInput(coords.x, coords.y)
    return
  }
  
  if (state.tool === 'sticky-note') {
    const coords = getCanvasCoordinates(e)
    stickyNoteTool.startStickyNoteInput(coords.x, coords.y)
    return
  }
  
  if (state.tool === 'shapes') {
    const coords = getCanvasCoordinates(e)
    state.shapeStart = coords
    state.drawing = true
    CanvasManager.createPreviewCanvas()
    return
  }
  
  const coords = getCanvasCoordinates(e)
  state.drawing = true
  lastX = coords.x
  lastY = coords.y
  elementsDeleted = false
  
  const ctx = CanvasManager.getCtx()

  if (state.tool === 'pencil' || state.tool === 'marker' || state.tool === 'highlighter' || (state.tool === 'eraser' && !state.elementEraserEnabled)) {
    let strokeSize = state.strokeSize
    let alpha = 1.0
    let compositeOp = 'source-over'
    let color = state.color

    if (state.tool === 'eraser') {
      strokeSize = state.strokeSize * 2
      color = 'rgba(0,0,0,1)'
      compositeOp = 'destination-out'
    } else if (state.tool === 'marker') {
      strokeSize = state.strokeSize * 1.5
    } else if (state.tool === 'highlighter') {
      strokeSize = state.strokeSize * 3
      alpha = 0.35
    }

    currentStroke = {
      type: 'stroke',
      tool: state.tool,
      color: color,
      strokeSize: strokeSize,
      alpha: alpha,
      compositeOperation: compositeOp,
      points: [{ x: coords.x, y: coords.y }]
    }
    currentStrokePoints = [{ x: coords.x, y: coords.y }]
  }
  
  if (state.tool === 'eraser' && state.elementEraserEnabled) {
    checkForEraserHit(coords)
  }
  
  if (state.tool === 'eraser' && !state.elementEraserEnabled) {
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.beginPath()
  ctx.moveTo(coords.x, coords.y)
}

function draw(e) {
  if (!state.enabled || state.standbyMode) return
  
  if (state.isPanning) {
    const currentX = e.clientX || e.touches?.[0]?.clientX;
    const currentY = e.clientY || e.touches?.[0]?.clientY;
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    
    state.panX += dx;
    state.panY += dy;
    
    if (state.selectionStart) {
      state.selectionStart.x -= dx;
      state.selectionStart.y -= dy;
    }
    if (state.shapeStart) {
      state.shapeStart.x -= dx;
      state.shapeStart.y -= dy;
    }
    if (state.dragOffset) {
      state.dragOffset.x -= dx;
      state.dragOffset.y -= dy;
    }
    
    lastX = currentX;
    lastY = currentY;
    
    if (textTool && textTool.updateInputPosition) textTool.updateInputPosition();
    if (stickyNoteTool && stickyNoteTool.updateStickyNotePosition) stickyNoteTool.updateStickyNotePosition();

    if (!_panFrame) {
      _panFrame = requestAnimationFrame(() => {
        redrawCanvas();
        _panFrame = null;
      });
    }
    return;
  }

  let coords = getCanvasCoordinates(e)
  const canvas = CanvasManager.getCanvas()
  const ctx = CanvasManager.getCtx()

  if (!_sidebarEl) _sidebarEl = document.getElementById('wb-sidebar')
  if (_sidebarEl && _sidebarEl.classList.contains('open')) {
    const screenX = e.clientX || e.touches?.[0]?.clientX;
    const screenY = e.clientY || e.touches?.[0]?.clientY;
    
    if (screenX < 340 || screenY < 60 || screenY > (window.innerHeight - 20)) {
      canvas.style.cursor = 'default';
      if (!state.drawing) return; 
    } else if (!state.drawing) {
      updateCursor(); 
    }
  } else if (!state.drawing) {
      if (canvas.style.cursor === 'default' && state.tool !== 'select') {
          updateCursor();
      }
  }
  
  if (state.tool === 'select') {
    const cursor = selectTool.getCursorForSelect(coords)
    if (cursor) canvas.style.cursor = cursor
    
    if (selectTool.handleSelectDraw(coords)) {
      return
    }
  }
  
  if (!state.drawing) return
  
  if (state.tool === 'shapes') {
    if (e.shiftKey && state.shapeStart) {
      const isSquare = state.shapeType === 'rectangle' || state.shapeType === 'circle'
      if (isSquare) {
        const size = Math.max(Math.abs(coords.x - state.shapeStart.x), Math.abs(coords.y - state.shapeStart.y))
        state.shapeEnd = { x: state.shapeStart.x + Math.sign(coords.x - state.shapeStart.x) * size, y: state.shapeStart.y + Math.sign(coords.y - state.shapeStart.y) * size }
      } else {
        state.shapeEnd = constrainToStraightLine(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y)
      }
    } else {
      state.shapeEnd = coords
    }
    if (drawFrame) cancelAnimationFrame(drawFrame)
    drawFrame = requestAnimationFrame(() => drawShapePreview())
    return
  }
  
  if (!isDrawing) {
    isDrawing = true
    drawFrame = requestAnimationFrame(() => {
      if (state.tool === 'pencil' || state.tool === 'marker' || state.tool === 'highlighter') {
        if (e.shiftKey && currentStrokePoints.length > 0) {
          const start = currentStrokePoints[0];
          const constrained = constrainToStraightLine(start.x, start.y, coords.x, coords.y);
          currentStrokePoints = [start, constrained];
        } else {
          currentStrokePoints.push({ x: coords.x, y: coords.y })
        }
        
        const { previewCtx, previewCanvas } = CanvasManager.createPreviewCanvas()
        previewCtx.save()
        previewCtx.setTransform(1, 0, 0, 1, 0, 0)
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
        previewCtx.translate(state.panX, state.panY)

        previewCtx.strokeStyle = state.color
        previewCtx.lineWidth = state.tool === 'highlighter' ? state.strokeSize * 3 : (state.tool === 'marker' ? state.strokeSize * 1.5 : state.strokeSize)
        previewCtx.globalAlpha = state.tool === 'highlighter' ? 0.35 : 1.0
        previewCtx.lineCap = 'round'
        previewCtx.lineJoin = 'round'
        previewCtx.beginPath()
        if (currentStrokePoints.length > 0) {
          previewCtx.moveTo(currentStrokePoints[0].x, currentStrokePoints[0].y)
          for (let i = 1; i < currentStrokePoints.length; i++) {
            previewCtx.lineTo(currentStrokePoints[i].x, currentStrokePoints[i].y)
          }
          previewCtx.stroke()
        }
        previewCtx.restore()
      } else if (state.tool === 'eraser' && currentStrokePoints && !state.elementEraserEnabled) {
        currentStrokePoints.push({ x: coords.x, y: coords.y })
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineWidth = state.strokeSize * 2
        ctx.globalAlpha = 1.0
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(lastX, lastY)
        ctx.lineTo(coords.x, coords.y)
        ctx.stroke()
        ctx.globalCompositeOperation = 'source-over'
      } else if (state.tool === 'eraser' && state.elementEraserEnabled) {
        checkForEraserHit(coords)
      }
      
      lastX = coords.x
      lastY = coords.y
      state.hasDrawn = true
      isDrawing = false
    })
  }
}

function stopDrawing() {
  const ctx = CanvasManager.getCtx()
  
  if (state.isPanning) {
    state.isPanning = false;
    updateCursor();
    return;
  }

  if (state.tool === 'select') {
    selectTool.handleSelectStop()
    state.shapeStart = null
    state.shapeEnd = null
    return
  }
  
  if (state.drawing) {
    if (drawFrame) {
      cancelAnimationFrame(drawFrame)
      drawFrame = null
    }
    isDrawing = false

    if (state.tool === 'eraser' && !state.elementEraserEnabled) {
      ctx.globalCompositeOperation = 'source-over'
    }
    
    if (state.tool === 'shapes' && state.shapeStart && state.shapeEnd) {
      const dx = Math.abs(state.shapeEnd.x - state.shapeStart.x)
      const dy = Math.abs(state.shapeEnd.y - state.shapeStart.y)
      
      if (dx > 1 || dy > 1) {
        const canFill = state.shapeType === 'rectangle' || state.shapeType === 'circle'
        createElement('shape', {
          shapeType: state.shapeType,
          start: { ...state.shapeStart },
          end: { ...state.shapeEnd },
          color: state.color,
          strokeSize: state.strokeSize,
          filled: canFill && state.shapeFillEnabled
        })
        clearPreview()
        redrawCanvas()
        saveState()
        state.hasDrawn = true
      } else {
        clearPreview()
      }
    } else if (state.tool === 'pencil' || state.tool === 'marker' || state.tool === 'highlighter' || (state.tool === 'eraser' && !state.elementEraserEnabled)) {
      if (currentStroke && currentStrokePoints.length > 1) {
        currentStroke.points = [...currentStrokePoints]
        createElement('stroke', currentStroke)
        clearPreview()
        redrawCanvas()
        saveState()
        state.hasDrawn = true
      } else {
        clearPreview()
      }
      currentStroke = null
      currentStrokePoints = []
    } else if (state.tool === 'eraser' && state.elementEraserEnabled) {
      if (elementsDeleted) {
        saveState()
        state.hasDrawn = true
        elementsDeleted = false
      }
    } else if (state.tool !== 'text') {
      saveState()
    }
    state.drawing = false
    state.shapeStart = null
    state.shapeEnd = null
  }
}


function handleDoubleClick(e) {
  if (state.tool !== 'select') return
  
  const coords = getCanvasCoordinates(e)
  
  const resizeHandle = selectTool.getResizeHandleAt(coords.x, coords.y)
  if (resizeHandle === 'rotation') {
    selectTool.resetRotation()
    return
  }

  const clickedElement = findElementAt(coords.x, coords.y)
  
  if (clickedElement && clickedElement.type === 'text') {
    if (!state.selectedElements.includes(clickedElement.id)) {
      selectTool.clearSelection()
      selectTool.selectElement(clickedElement.id)
    }
    
    textTool.editTextElement(clickedElement)
  } else if (clickedElement && clickedElement.type === 'stickyNote') {
    if (!state.selectedElements.includes(clickedElement.id)) {
      selectTool.clearSelection()
      selectTool.selectElement(clickedElement.id)
    }
    
    stickyNoteTool.editStickyNote(clickedElement)
  }
}

function updateCursor() {
  const canvas = CanvasManager.getCanvas()
  const tool = state.tool
  
  if (state.drawing || state.isDraggingSelection || state.isResizing || state.isSelecting) {
    return
  }
  
  if (tool === 'pencil') {
    canvas.style.cursor = getCachedCursor('pencil', 'edit', 24, 2, 22)
  } else if (tool === 'marker') {
    canvas.style.cursor = getCachedCursor('marker', 'brush', 24, 2, 22)
  } else if (tool === 'highlighter') {
    canvas.style.cursor = getCachedCursor('highlighter', 'ink_highlighter', 24, 2, 22)
  } else if (tool === 'eraser') {
    canvas.style.cursor = getCachedCursor('eraser', 'ink_eraser', 24, 12, 12)
  } else if (tool === 'text') {
    canvas.style.cursor = 'text'
  } else if (tool === 'sticky-note') {
    canvas.style.cursor = 'cell'
  } else if (tool === 'select') {
    canvas.style.cursor = 'default'
  } else {
    canvas.style.cursor = 'crosshair'
  }

  if (state.isSpacePressed) {
    canvas.style.cursor = state.isPanning ? 'grabbing' : 'grab'
  }
}

module.exports = {
  init,
  updateCursor
}