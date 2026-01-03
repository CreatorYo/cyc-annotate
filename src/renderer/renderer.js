const { ipcRenderer } = require('electron')
const { initSelectTool } = require('./tools/selectTool.js')
const { initTextTool } = require('./tools/textTool.js')
const { initCommandMenu } = require('./tools/commandMenu.js')
const { initThemeManager, updateToolbarBackgroundColor } = require('./utils/themeManager.js')
const { initTooltips, hideAllTooltips } = require('./utils/tooltipManager.js')
const { initAudioContext, playSound } = require('./utils/soundEffects.js')
const { initStandbyManager } = require('./utils/standbyManager.js')
const { initShortcutManager } = require('./utils/shortcutManager.js')
const ToolbarPositionManager = require('./utils/toolbarPositionManager')

const canvas = document.getElementById('canvas')

const optimizedRendering = localStorage.getItem('optimized-rendering') === 'true'
const hardwareAcceleration = localStorage.getItem('hardware-acceleration') === 'true'
if (hardwareAcceleration) {
  canvas.style.willChange = 'contents'
  canvas.style.transform = 'translateZ(0)'
  canvas.style.backfaceVisibility = 'hidden'
}

const ctx = canvas.getContext('2d', {
  willReadFrequently: !optimizedRendering && !hardwareAcceleration,
  alpha: true
})

if (optimizedRendering) {
  ctx.imageSmoothingEnabled = false
  ctx.imageSmoothingQuality = 'low'
}

let previewCanvas = null
let previewCtx = null
let selectionCanvas = null
let selectionCtx = null

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  if (selectionCanvas) {
    selectionCanvas.width = canvas.width
    selectionCanvas.height = canvas.height
  }
  if (previewCanvas) {
    previewCanvas.width = canvas.width
    previewCanvas.height = canvas.height
  }
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

document.addEventListener('click', initAudioContext, { once: true })
document.addEventListener('mousedown', initAudioContext, { once: true })

let state = {
  drawing: false,
  enabled: true,
  standbyMode: false,
  toolBeforeStandby: null,
  tool: 'pencil',
  shapeType: 'rectangle',
  color: '#ef4444', 
  strokeSize: 4,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  hasDrawn: false,
  textInput: null,
  shapeStart: null,
  shapeEnd: null,
  shapeFillEnabled: false,
  elements: [],
  selectedElements: [],
  nextElementId: 1,
  isSelecting: false,
  selectionStart: null,
  selectionEnd: null,
  isDraggingSelection: false,
  dragOffset: null,
  isResizing: false,
  resizeHandle: null,
  resizeStartBounds: null,
  hoveredElementId: null,
  copiedElements: null,
  editingElementId: null,
  snapToObjectsEnabled: localStorage.getItem('snap-to-objects-enabled') === 'true'
}

canvas.style.pointerEvents = 'auto'

let lastX = 0
let lastY = 0

function createPreviewCanvas() {
  if (!previewCanvas) {
    previewCanvas = document.createElement('canvas')
    previewCanvas.width = canvas.width
    previewCanvas.height = canvas.height
    previewCanvas.style.position = 'absolute'
    previewCanvas.style.top = '0'
    previewCanvas.style.left = '0'
    previewCanvas.style.pointerEvents = 'none'
    previewCanvas.style.zIndex = '999'
    
    if (hardwareAcceleration) {
      previewCanvas.style.willChange = 'contents'
      previewCanvas.style.transform = 'translateZ(0)'
      previewCanvas.style.backfaceVisibility = 'hidden'
    }
    
    document.body.appendChild(previewCanvas)
    previewCtx = previewCanvas.getContext('2d', {
      willReadFrequently: !optimizedRendering && !hardwareAcceleration,
      alpha: true
    })
    
    if (optimizedRendering) {
      previewCtx.imageSmoothingEnabled = false
      previewCtx.imageSmoothingQuality = 'low'
    }
  }
}

function createSelectionCanvas() {
  if (!selectionCanvas) {
    selectionCanvas = document.createElement('canvas')
    selectionCanvas.width = canvas.width
    selectionCanvas.height = canvas.height
    selectionCanvas.style.position = 'absolute'
    selectionCanvas.style.top = '0'
    selectionCanvas.style.left = '0'
    selectionCanvas.style.pointerEvents = 'none'
    selectionCanvas.style.zIndex = '999'
    
    if (hardwareAcceleration) {
      selectionCanvas.style.willChange = 'contents'
      selectionCanvas.style.transform = 'translateZ(0)'
      selectionCanvas.style.backfaceVisibility = 'hidden'
    }
    
    document.body.appendChild(selectionCanvas)
    selectionCtx = selectionCanvas.getContext('2d', {
      willReadFrequently: !optimizedRendering && !hardwareAcceleration,
      alpha: true
    })
    
    if (optimizedRendering) {
      selectionCtx.imageSmoothingEnabled = false
      selectionCtx.imageSmoothingQuality = 'low'
    }
  } else {
    selectionCanvas.width = canvas.width
    selectionCanvas.height = canvas.height
  }
}

ctx.lineCap = 'round'
ctx.lineJoin = 'round'

let currentStroke = null
let currentStrokePoints = []

function createElement(type, data) {
  const element = {
    id: state.nextElementId++,
    type: type,
    ...data,
    createdAt: Date.now()
  }
  state.elements.push(element)
  return element
}

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
      const maxTextWidth = canvas.width - element.x - 50
      
      const textYOffset = fontSize * 0.12
      let cursorX = element.x
      let cursorY = element.y + textYOffset
      
      element.segments.forEach((segment) => {
        const fontStyle = segment.formatting?.italic ? 'italic' : 'normal'
        const fontWeight = segment.formatting?.bold ? 'bold' : 'normal'
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        
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
              ctx.strokeStyle = element.color || '#000000'
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

function getElementBounds(element) {
  if (element.type === 'stroke' && element.points && element.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    element.points.forEach(p => {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    })
    const padding = element.strokeSize / 2 + 2
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    }
  } else if (element.type === 'shape') {
    const x = Math.min(element.start.x, element.end.x)
    const y = Math.min(element.start.y, element.end.y)
    const w = Math.abs(element.end.x - element.start.x)
    const h = Math.abs(element.end.y - element.start.y)
    
    if (element.shapeType === 'arrow') {
      const headlen = 15
      const padding = (element.strokeSize || 4) / 2 + 2
      return {
        x: x - padding,
        y: y - padding,
        width: w + padding * 2 + headlen,
        height: h + padding * 2 + headlen
      }
    }
    
    const padding = (element.strokeSize || 4) / 2 + 2
    return { 
      x: x - padding, 
      y: y - padding, 
      width: w + padding * 2, 
      height: h + padding * 2 
    }
  } else if (element.type === 'text') {
    const fontSize = element.fontSize || Math.max(12, element.strokeSize * 4)
    const lineHeight = fontSize * 1.2
    const maxTextWidth = canvas.width - element.x - 50
    
    let maxWidth = 0
    
    if (element.id === state.editingElementId) {
      const textInput = document.getElementById('text-input')
      if (textInput && textInput.style.display !== 'none') {
        const rect = textInput.getBoundingClientRect()
        const canvasRect = canvas.getBoundingClientRect()
        return {
          x: element.x,
          y: element.y,
          width: rect.width,
          height: rect.height
        }
      }
    }
    
    if (element.segments) {
      ctx.save()
      
      let cursorX = 0
      let currentLineY = 0
      
      element.segments.forEach(seg => {
        const fontStyle = seg.formatting?.italic ? 'italic' : 'normal'
        const fontWeight = seg.formatting?.bold ? 'bold' : 'normal'
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        
        const lines = seg.text.split('\n')
        
        lines.forEach((line, lineIndex) => {
          if (lineIndex > 0) {
            maxWidth = Math.max(maxWidth, cursorX)
            cursorX = 0
            currentLineY += lineHeight
          }
          
          const tokens = line.split(/(\s+)/)
          
          tokens.forEach(token => {
            if (token.length === 0) return
            
            const tokenWidth = ctx.measureText(token).width
            
            if (cursorX + tokenWidth > maxTextWidth && cursorX > 0) {
              maxWidth = Math.max(maxWidth, cursorX)
              cursorX = 0
              currentLineY += lineHeight
              
              if (token.trim() === '') return
            }
            
            cursorX += tokenWidth
            maxWidth = Math.max(maxWidth, cursorX)
          })
        })
      })
      
      let totalHeight = currentLineY + lineHeight
      
      ctx.restore()
      
      return {
        x: element.x - 5,
        y: element.y - 5,
        width: maxWidth + 10,
        height: totalHeight + 5
      }
    }
  }
  return null
}

function hitTest(x, y, element) {
  if (element.type === 'shape' && element.shapeType === 'circle') {
    const w = Math.abs(element.end.x - element.start.x)
    const h = Math.abs(element.end.y - element.start.y)
    const centerX = (element.start.x + element.end.x) / 2
    const centerY = (element.start.y + element.end.y) / 2
    const radius = Math.sqrt(w * w + h * h) / 2
    
    const dx = x - centerX
    const dy = y - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    return distance <= radius
  }
  
  if (element.type === 'shape' && (element.shapeType === 'line' || element.shapeType === 'arrow')) {
    const strokeSize = element.strokeSize || 4
    const threshold = strokeSize / 2 + 5
    
    const x1 = element.start.x
    const y1 = element.start.y
    const x2 = element.end.x
    const y2 = element.end.y
    
    const A = x - x1
    const B = y - y1
    const C = x2 - x1
    const D = y2 - y1
    
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    
    if (lenSq !== 0) {
      param = dot / lenSq
    }
    
    let xx, yy
    
    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }
    
    const dx = x - xx
    const dy = y - yy
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    return distance <= threshold
  }
  
  const bounds = getElementBounds(element)
  if (!bounds) return false
  
  return x >= bounds.x && x <= bounds.x + bounds.width &&
         y >= bounds.y && y <= bounds.y + bounds.height
}

function findElementAt(x, y) {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const element = state.elements[i]
    if (hitTest(x, y, element)) {
      return element
    }
  }
  return null
}

function updateSelectionOverlay() {
  createSelectionCanvas()
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
  saveState: () => saveState(),
  playSound: (type) => playSound(type)
})

const textTool = initTextTool(state, canvas, {
  createElement,
  redrawCanvas: () => redrawCanvas(),
  saveState: () => saveState(),
  updateSelectionOnly: () => updateSelectionOnly()
})


function saveState() {
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }

  const elementState = {
    elements: JSON.parse(JSON.stringify(state.elements)),
    nextElementId: state.nextElementId
  }
  state.history.push(elementState)
  state.historyIndex++

  if (state.history.length > state.maxHistorySize) {
    state.history.shift()
    state.historyIndex--
  }
  
  updateUndoRedoButtons()
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

function undo() {
  if (state.historyIndex <= 0 || state.history.length === 0) {
    updateUndoRedoButtons()
    return
  }
  
  state.historyIndex--
  const elementState = state.history[state.historyIndex]
  if (elementState) {
    state.elements = JSON.parse(JSON.stringify(elementState.elements))
    state.nextElementId = elementState.nextElementId || state.nextElementId
    selectTool.clearSelection()

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    redrawCanvas()
  }
  checkIfHasDrawn()
  setTimeout(() => playSound('undo'), 10)
  updateUndoRedoButtons()
}

function redo() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++
    const elementState = state.history[state.historyIndex]
    if (elementState) {
      state.elements = JSON.parse(JSON.stringify(elementState.elements))
      state.nextElementId = elementState.nextElementId || state.nextElementId
      selectTool.clearSelection()

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      redrawCanvas()
    }
    checkIfHasDrawn()
    setTimeout(() => playSound('redo'), 10)
  }
  updateUndoRedoButtons()
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

saveState()

function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX || e.touches?.[0]?.clientX) - rect.left,
    y: (e.clientY || e.touches?.[0]?.clientY) - rect.top
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
    createPreviewCanvas()
    return
  }
  
  const coords = getCanvasCoordinates(e)
  state.drawing = true
  lastX = coords.x
  lastY = coords.y
  
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

let isDrawing = false
let drawFrame = null

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

function draw(e) {
  if (!state.enabled || state.standbyMode) return
  
  let coords = getCanvasCoordinates(e)
  
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
        
        createPreviewCanvas()
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
      const shapeElement = createElement('shape', {
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

function drawShapePreview() {
  if (!previewCtx || !state.shapeStart || !state.shapeEnd) return
  
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
    if (shouldFill) {
      previewCtx.fillRect(x, y, w, h)
    } else {
      previewCtx.strokeRect(x, y, w, h)
    }
  } else if (state.shapeType === 'circle') {
    const centerX = (state.shapeStart.x + state.shapeEnd.x) / 2
    const centerY = (state.shapeStart.y + state.shapeEnd.y) / 2
    const radius = Math.sqrt(w * w + h * h) / 2
    previewCtx.beginPath()
    previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    if (shouldFill) {
      previewCtx.fill()
    } else {
      previewCtx.stroke()
    }
  } else if (state.shapeType === 'line') {
    previewCtx.beginPath()
    previewCtx.moveTo(state.shapeStart.x, state.shapeStart.y)
    previewCtx.lineTo(state.shapeEnd.x, state.shapeEnd.y)
    previewCtx.stroke()
  } else if (state.shapeType === 'arrow') {
    drawArrow(previewCtx, state.shapeStart.x, state.shapeStart.y, state.shapeEnd.x, state.shapeEnd.y)
  }
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
  if (previewCtx) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
  }
}

function copySelectedElements() {
  if (state.selectedElements.length === 0) return
  
  const elementsToCopy = state.elements.filter(e => state.selectedElements.includes(e.id))
  if (elementsToCopy.length > 0) {
    state.copiedElements = JSON.parse(JSON.stringify(elementsToCopy))
    playSound('copy')
  }
}

const DUPLICATE_WARNING_THRESHOLD = 10

async function pasteElements() {
  if (!state.copiedElements || state.copiedElements.length === 0) return
  
  if (state.copiedElements.length >= DUPLICATE_WARNING_THRESHOLD) {
    const confirmed = await ipcRenderer.invoke('show-duplicate-warning', state.copiedElements.length)
    if (!confirmed) return
  }
  
  const offsetX = 50
  const offsetY = 50
  
  state.selectedElements = []
  
  state.copiedElements.forEach(copiedElement => {
    const newElement = JSON.parse(JSON.stringify(copiedElement))
    newElement.id = state.nextElementId++
    
    if (newElement.type === 'stroke' && newElement.points) {
      newElement.points.forEach(p => {
        p.x += offsetX
        p.y += offsetY
      })
    } else if (newElement.type === 'shape') {
      newElement.start.x += offsetX
      newElement.start.y += offsetY
      newElement.end.x += offsetX
      newElement.end.y += offsetY
    } else if (newElement.type === 'text') {
      newElement.x += offsetX
      newElement.y += offsetY
    }
    
    state.elements.push(newElement)
    state.selectedElements.push(newElement.id)
  })
  
  redrawCanvas()
  saveState()
  playSound('paste')
}

canvas.addEventListener('mousedown', startDrawing)
canvas.addEventListener('mousemove', draw)
canvas.addEventListener('mouseup', stopDrawing)
canvas.addEventListener('mouseout', stopDrawing)

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

const textInput = document.getElementById('text-input')
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
      e.preventDefault()
      e.stopPropagation()
      document.execCommand('bold', false, null)
      textTool.updateTextFormatting()
      return
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault()
      e.stopPropagation()
      document.execCommand('italic', false, null)
      textTool.updateTextFormatting()
      return
    } else if (e.key.toLowerCase() === 'u') {
      e.preventDefault()
      e.stopPropagation()
      document.execCommand('underline', false, null)
      textTool.updateTextFormatting()
      return
    }
  }
  
  if (e.key === 'Enter') {
    if (e.shiftKey) return
    e.preventDefault()
    e.stopPropagation()
    textInputFinished = true
    textTool.finishTextInput()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    textInput.style.display = 'none'
    state.textInput = null
    textInputFinished = false
  }
})

textInput.addEventListener('input', () => {
  if (state.editingElementId) {
    updateSelectionOverlay()
  }
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
      
      const icon = pencilBtn?.querySelector('.material-symbols-outlined')
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
  
  if (tool === 'select') {
  }
  
  updateCursor()
}

function updateCursor() {
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

window.addEventListener('focus', updateCursor)

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

function isLightColor(color) {
  
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

function updateCustomColorButton(color) {
  const customBtn = document.getElementById('custom-color-btn')
  if (customBtn && color) {
    
    document.documentElement.style.setProperty('--custom-color-bg', color)

    customBtn.removeAttribute('style')

    customBtn.style.setProperty('background-color', color, 'important')
    customBtn.style.setProperty('background', color, 'important')
    customBtn.style.backgroundColor = color
    customBtn.style.background = color

    customBtn.setAttribute('data-custom-color', color)

    const icon = customBtn.querySelector('.material-symbols-outlined')
    if (icon) {
      const theme = document.body.getAttribute('data-theme') || 'dark'
      
      let iconColor
      if (theme === 'light') {
        iconColor = isLightColor(color) ? '#000000' : '#ffffff'
      } else {
        
        iconColor = isLightColor(color) ? '#000000' : '#ffffff'
      }
      icon.style.color = iconColor
      icon.style.setProperty('color', iconColor, 'important')
    }

    void customBtn.offsetWidth
  }
}

let isCustomColorActive = false
let customColorValue = null

function setColor(color, isCustom = false) {
  state.color = color

  if (state.tool === 'select' && state.selectedElements.length > 0) {
    selectTool.updateSelectedColor(color)
  }

  document.documentElement.style.setProperty('--selected-color', color)
  
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)
  const shadowColor = `rgba(${r}, ${g}, ${b}, 0.3)`
  document.documentElement.style.setProperty('--selected-color-shadow', shadowColor)
  
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.remove('active')
  })

  document.querySelectorAll('.color-option').forEach(option => {
    option.classList.remove('active')
  })

  const presetSwatch = document.querySelector(`.color-swatch[data-color="${color}"]`)
  const presetOption = document.querySelector(`.color-option[data-color="${color}"]`)
  
  if ((presetSwatch || presetOption) && !isCustom) {
    
    if (presetSwatch) {
      presetSwatch.classList.add('active')
      presetSwatch.style.setProperty('border-color', color, 'important')
    }
    if (presetOption) {
      presetOption.classList.add('active')
      presetOption.style.setProperty('border-color', color, 'important')
    }
    isCustomColorActive = false
    customColorValue = null
    
    if (presetOption) {
      localStorage.setItem('last-preset-color', color)
      
      localStorage.setItem('custom-color', color)
      localStorage.setItem('is-custom-color-active', 'false')
      updateCustomColorButton(color)
    }
    
  } else {
    isCustomColorActive = true
    customColorValue = color
    localStorage.setItem('custom-color', color)
    localStorage.setItem('is-custom-color-active', 'true')
    const customBtn = document.getElementById('custom-color-btn')
    if (customBtn) {
      customBtn.classList.add('active')
      updateCustomColorButton(color)
    }
  }
}

const savedCustomColor = localStorage.getItem('custom-color')
const isCustomActive = localStorage.getItem('is-custom-color-active') === 'true'

if (savedCustomColor && isCustomActive) {
  isCustomColorActive = true
  customColorValue = savedCustomColor
  state.color = savedCustomColor
  updateCustomColorButton(savedCustomColor)
  const customBtn = document.getElementById('custom-color-btn')
  if (customBtn) {
    customBtn.classList.add('active')
  }
  setColor(savedCustomColor, true)
} else {
  
  const initialColor = state.color
  const isPreset = document.querySelector(`.color-swatch[data-color="${initialColor}"]`) !== null || 
                   document.querySelector(`.color-option[data-color="${initialColor}"]`) !== null
  if (!isPreset) {
    isCustomColorActive = true
    customColorValue = initialColor
    updateCustomColorButton(initialColor)
  }
}

document.querySelectorAll('.color-swatch[data-color]').forEach(swatch => {
  swatch.addEventListener('click', () => {
    playSound('color')
    setColor(swatch.dataset.color, false) 
  })
})

function setInitialColorBorder() {
  const initialColor = state.color
  const activeSwatch = document.querySelector(`.color-swatch[data-color="${initialColor}"]`)
  if (activeSwatch && !activeSwatch.classList.contains('custom-color')) {
    activeSwatch.classList.add('active')
    activeSwatch.style.setProperty('border-color', initialColor, 'important')
    
    document.documentElement.style.setProperty('--selected-color', initialColor)
    const r = parseInt(initialColor.substr(1, 2), 16)
    const g = parseInt(initialColor.substr(3, 2), 16)
    const b = parseInt(initialColor.substr(5, 2), 16)
    const shadowColor = `rgba(${r}, ${g}, ${b}, 0.3)`
    document.documentElement.style.setProperty('--selected-color-shadow', shadowColor)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setInitialColorBorder)
} else {
  setInitialColorBorder()
}

function initColorPicker() {
  const colorPickerInput = document.getElementById('color-picker-input')
  if (!colorPickerInput) {
    setTimeout(initColorPicker, 100)
    return
  }

  const colorToShow = (isCustomColorActive && customColorValue) ? customColorValue : state.color
  colorPickerInput.value = colorToShow

  colorPickerInput.addEventListener('change', (e) => {
    const hexColor = e.target.value
    localStorage.setItem('custom-color', hexColor)
    localStorage.setItem('is-custom-color-active', 'true')
    updateCustomColorButton(hexColor)
    setTimeout(() => updateCustomColorButton(hexColor), 10)
    setColor(hexColor, true)
    setTimeout(() => updateCustomColorButton(hexColor), 50)
    
    playSound('color')

    const accentColor = localStorage.getItem('accent-color') || '#3bbbf6'
    const isLight = isLightColor(accentColor)
    const textColor = isLight ? '#000000' : '#ffffff'
    document.documentElement.style.setProperty('--picker-btn-text-color', textColor)
    const pickerBtn = document.getElementById('open-color-picker-btn')
    if (pickerBtn) {
      pickerBtn.style.color = textColor
    }
  })

  const customColorBtn = document.getElementById('custom-color-btn')
  const customColorPopup = document.getElementById('custom-color-popup')
  const openColorPickerBtn = document.getElementById('open-color-picker-btn')
  
  if (customColorBtn && customColorPopup) {
    customColorBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      hideAllTooltips()
      
      const wasOpen = customColorPopup.classList.contains('show')
      closeAllPopups()
      if (!wasOpen) {
        customColorPopup.classList.add('show')
      }
    })

    if (openColorPickerBtn) {
      openColorPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        
        customColorPopup.classList.remove('show')
        
        const colorToShow = (isCustomColorActive && customColorValue) ? customColorValue : state.color
        colorPickerInput.value = colorToShow
        
        colorPickerInput.click()
      })
    }
  }

  setTimeout(() => {
    document.querySelectorAll('.color-option').forEach(option => {
      const color = option.dataset.color

      if (color) {
        option.addEventListener('mouseenter', () => {
          option.style.setProperty('border-color', color, 'important')
        })
        
        option.addEventListener('mouseleave', () => {
          if (!option.classList.contains('active')) {
            option.style.removeProperty('border-color')
          }
        })
      }
      
      option.addEventListener('click', (e) => {
        e.stopPropagation()
        if (color) {
          playSound('color')
          setColor(color, false) 
          
          localStorage.setItem('last-preset-color', color)
          localStorage.setItem('custom-color', color)
          localStorage.setItem('is-custom-color-active', 'false')
          
          updateCustomColorButton(color)
          
          if (customColorPopup) {
            customColorPopup.classList.remove('show')
          }
        }
      })
    })
  }, 100)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initColorPicker, 200) 
  })
} else {
  setTimeout(initColorPicker, 200)
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  state.elements = []
  state.selectedElements = []
  state.nextElementId = 1
  state.hasDrawn = false
  saveState()
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

document.getElementById('undo-btn').addEventListener('click', undo)
document.getElementById('redo-btn').addEventListener('click', redo)

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
  
  mainToolbar.addEventListener('mousedown', () => {
    ipcRenderer.send('focus-window')
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
    })
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
      undo()
      moreMenuDropdown.classList.remove('show')
    })
  }
  
  if (moreRedoBtn) {
    moreRedoBtn.addEventListener('click', () => {
      redo()
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
    if (previewCanvas) {
      previewCanvas.style.willChange = 'contents'
      previewCanvas.style.transform = 'translateZ(0)'
      previewCanvas.style.backfaceVisibility = 'hidden'
    }
    if (selectionCanvas) {
      selectionCanvas.style.willChange = 'contents'
      selectionCanvas.style.transform = 'translateZ(0)'
      selectionCanvas.style.backfaceVisibility = 'hidden'
    }
  } else {
    canvas.style.willChange = ''
    canvas.style.transform = ''
    canvas.style.backfaceVisibility = ''
    if (previewCanvas) {
      previewCanvas.style.willChange = ''
      previewCanvas.style.transform = ''
      previewCanvas.style.backfaceVisibility = ''
    }
    if (selectionCanvas) {
      selectionCanvas.style.willChange = ''
      selectionCanvas.style.transform = ''
      selectionCanvas.style.backfaceVisibility = ''
    }
  }
})

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
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)
  
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

const savedAccentColor = localStorage.getItem('accent-color') || '#3bbbf6'
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
  undo,
  redo,
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
  undo,
  redo,
  clearCanvas,
  copySelectedElements,
  pasteElements,
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
    
    if (selectionCanvas) {
      selectionCanvas.style.opacity = canvasVisible ? '1' : '0'
    }
    if (previewCanvas) {
      previewCanvas.style.opacity = canvasVisible ? '1' : '0'
    }

    const icon = document.querySelector('#hide-btn .material-symbols-outlined')
    const moreIcon = document.querySelector('#more-hide-btn .material-symbols-outlined')
    if (icon) icon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    if (moreIcon) moreIcon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    
    const soundType = canvasVisible ? 'visibilityOff' : 'visibilityOn'
    setTimeout(() => playSound(soundType), 10)
  })
}

let toolbarWasVisible = false
let standbyWasActive = false

async function triggerCapture() {
  try {
    const toolbar = document.getElementById('main-toolbar')
    toolbarWasVisible = toolbar && toolbar.style.display !== 'none'
    standbyWasActive = state.standbyMode
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = 'none'
    }

    state.enabled = false
    canvas.style.pointerEvents = 'none'
    
    if (standbyWasActive) {
      standbyManager.pause()
    }

    ipcRenderer.invoke('open-capture-overlay').catch(async (error) => {
      await ipcRenderer.invoke('show-error-dialog', 'Capture Error', 'Failed to open capture overlay', error.message || 'Please try again.')
      const toolbar = document.getElementById('main-toolbar')
      if (toolbar && toolbarWasVisible) {
        toolbar.style.display = ''
      }
      if (standbyWasActive) {
        standbyManager.resume()
      }
      state.enabled = true
      canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
      standbyWasActive = false
    })
  } catch (error) {
    await ipcRenderer.invoke('show-error-dialog', 'Capture Error', 'Failed to open capture overlay', error.message || 'Please try again.')
    const toolbar = document.getElementById('main-toolbar')
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = ''
    }
    if (standbyWasActive) {
      standbyManager.resume()
    }
    state.enabled = true
    canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
    standbyWasActive = false
  }
}

document.getElementById('capture-btn').addEventListener('click', triggerCapture)

ipcRenderer.on('trigger-capture', triggerCapture)

ipcRenderer.on('capture-cancelled', () => {
  const toolbar = document.getElementById('main-toolbar')
  if (toolbar && toolbarWasVisible) {
    toolbar.style.display = ''
  }
  if (standbyWasActive) {
    standbyManager.resume()
  }
  state.enabled = true
  canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
  standbyWasActive = false
})

ipcRenderer.on('capture-selection-result', (event, desktopDataURL, bounds) => {
  const toolbar = document.getElementById('main-toolbar')
  
  if (!desktopDataURL || !bounds) {
    alert('Failed to capture selection. Please try again.')
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = ''
    }
    if (standbyWasActive) {
      standbyManager.resume()
    }
    toolbarWasVisible = false
    state.enabled = true
    canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
    standbyWasActive = false
    return
  }

  if (toolbar && toolbarWasVisible) {
    toolbar.style.display = ''
  }

  playSound('capture')
  
  if (standbyWasActive) {
    standbyManager.resume()
  }
  
  state.enabled = true
  canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
  standbyWasActive = false

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
        toolbarWasVisible = false
      }
      annotationImage.src = annotationImg
    } catch (error) {
      await ipcRenderer.invoke('show-error-dialog', 'Processing Error', 'Error processing capture', error.message)
      toolbarWasVisible = false
    }
  }
  desktopImg.onerror = () => {
    alert('Failed to load desktop screenshot. Please try again.')
    toolbarWasVisible = false
  }
  desktopImg.src = desktopDataURL
})

ipcRenderer.on('capture-cancelled', () => {
  const toolbar = document.getElementById('main-toolbar')
  if (toolbar && toolbarWasVisible) {
    toolbar.style.display = ''
  }
  if (standbyWasActive) {
    standbyManager.resume()
  }
  toolbarWasVisible = false
  state.enabled = true
  canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
  standbyWasActive = false
})

ipcRenderer.on('screenshot-saved', () => {
  toolbarWasVisible = false
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
    setTimeout(() => playSound('pop'), 200)
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