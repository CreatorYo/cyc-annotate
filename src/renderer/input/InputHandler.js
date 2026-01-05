const { state, createElement, saveState } = require('../core/AppState.js')
const CanvasManager = require('../core/CanvasManager.js')
const {findElementAt } = require('../utils/CollisionUtils.js')

let selectTool
let textTool
let redrawCanvas
let playSound

let isDrawing = false
let drawFrame = null
let currentStroke = null
let currentStrokePoints = []
let lastX = 0
let lastY = 0

function init(dependencies) {
  selectTool = dependencies.selectTool
  textTool = dependencies.textTool
  redrawCanvas = dependencies.redrawCanvas
  playSound = dependencies.playSound

  const canvas = CanvasManager.getCanvas()
  
  canvas.addEventListener('mousedown', startDrawing)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', stopDrawing)
  canvas.addEventListener('mouseout', stopDrawing)
  canvas.addEventListener('dblclick', handleDoubleClick)
  
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
}

function getCanvasCoordinates(e) {
  const canvas = CanvasManager.getCanvas()
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX || e.touches?.[0]?.clientX) - rect.left,
    y: (e.clientY || e.touches?.[0]?.clientY) - rect.top
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

function drawArrow(ctx, x1, y1, x2, y2) {
  const headlen = 15
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
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

  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
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
}

function startDrawing(e) {
  if (!state.enabled || state.standbyMode) return

  e.preventDefault()
  
  const textInput = document.getElementById('text-input')
  if (textInput && textInput.style.display === 'block') {
    textTool.finishTextInput()
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
  
  const ctx = CanvasManager.getCtx()

  if (state.tool === 'pencil' || state.tool === 'marker') {
    currentStroke = {
      type: 'stroke',
      tool: state.tool,
      color: state.color,
      strokeSize: state.tool === 'marker' ? state.strokeSize * 1.5 : state.strokeSize,
      alpha: 1.0,
      compositeOperation: 'source-over',
      points: [{ x: coords.x, y: coords.y }]
    }
    currentStrokePoints = [{ x: coords.x, y: coords.y }]
  }
  
  if (state.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }
}

function draw(e) {
  if (!state.enabled || state.standbyMode) return
  
  let coords = getCanvasCoordinates(e)
  const canvas = CanvasManager.getCanvas()
  const ctx = CanvasManager.getCtx()
  
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
      if (state.tool === 'pencil' || state.tool === 'marker') {
        currentStrokePoints.push({ x: coords.x, y: coords.y })
        
        const { previewCtx, previewCanvas } = CanvasManager.createPreviewCanvas()
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
        previewCtx.strokeStyle = state.color
        previewCtx.lineWidth = state.tool === 'marker' ? state.strokeSize * 1.5 : state.strokeSize
        previewCtx.globalAlpha = 1.0
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
      } else if (state.tool === 'eraser') {
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

    if (state.tool === 'eraser') {
      ctx.globalCompositeOperation = 'source-over'
    }
    
    if (state.tool === 'shapes' && state.shapeStart && state.shapeEnd) {
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
    } else if (state.tool === 'pencil' || state.tool === 'marker') {
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
  const clickedElement = findElementAt(coords.x, coords.y)
  
  if (clickedElement && clickedElement.type === 'text') {
    if (!state.selectedElements.includes(clickedElement.id)) {
      selectTool.clearSelection()
      selectTool.selectElement(clickedElement.id)
    }
    
    textTool.editTextElement(clickedElement)
  }
}

function updateCursor() {
  const canvas = CanvasManager.getCanvas()
  const tool = state.tool
  
  if (state.drawing || state.isDraggingSelection || state.isResizing || state.isSelecting) {
    return
  }
  
  if (tool === 'pencil') {
    const pencilCursor = 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
        <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-128l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
      </svg>
    `)
    canvas.style.cursor = `url("${pencilCursor}") 2 22, auto`
  } else if (tool === 'marker') {
    const markerCursor = 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
        <path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 23-5.5 42T220-202q5 2 10 2h10Zm230-160L360-470l358-358q11-11 27.5-11.5T774-828l54 54q12 12 12 28t-12 28L470-360Zm-190 80Z"/>
      </svg>
    `)
    canvas.style.cursor = `url("${markerCursor}") 2 22, auto`
  } else if (tool === 'eraser') {
    const eraseCursor = 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed">
        <path d="M690-240h190v80H610l80-80Zm-500 80-85-85q-23-23-23.5-57t22.5-58l440-456q23-24 56.5-24t56.5 23l199 199q23 23 23 57t-23 57L520-160H190Zm296-80 314-322-198-198-442 456 64 64h262Zm-6-240Z"/>
      </svg>
    `)
    canvas.style.cursor = `url("${eraseCursor}") 12 12, auto`
  } else if (tool === 'text') {
    canvas.style.cursor = 'text'
  } else if (tool === 'select') {
    canvas.style.cursor = 'default'
  } else {
    canvas.style.cursor = 'crosshair'
  }
}

module.exports = {
  init,
  updateCursor
}
