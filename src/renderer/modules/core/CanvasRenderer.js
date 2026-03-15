const CanvasManager = require('./CanvasManager.js')
const { state } = require('./AppState.js')
const { drawGrid } = require('./GridRenderer.js')
const { drawArrow } = require('../utils/drawings/DrawingUtils.js')
const { drawText, drawStickyNote } = require('../utils/drawings/StickyNoteDrawingUtils.js')
const { getElementBounds } = require('../utils/drawings/CollisionUtils.js')
const { getImageCache } = require('../tools/clipboardTool.js')

let _isLightColor = null
let _selectTool = null
let _updateShapeFillToggleState = null
let _rafId = null
let _redrawScheduled = false

function init(deps) {
  _isLightColor = deps.isLightColor
  _selectTool = deps.selectTool
  _updateShapeFillToggleState = deps.updateShapeFillToggleState
}

function scheduleRedraw() {
  if (_redrawScheduled) return
  _redrawScheduled = true
  _rafId = requestAnimationFrame(() => {
    _redrawScheduled = false
    redrawCanvas()
  })
}

function redrawCanvas() {
  const canvas = CanvasManager.getCanvas()
  const ctx = CanvasManager.getCtx()
  const optimizedRendering = CanvasManager.isOptimizedRendering()
  
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1.0
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  
  ctx.save()
  ctx.translate(state.panX, state.panY)

  drawGrid()

  const elements = state.elements
  const editingId = state.editingElementId
  for (let i = 0, len = elements.length; i < len; i++) {
    const element = elements[i]
    if (element && element.id !== editingId) {
      drawElement(ctx, element, optimizedRendering)
    }
  }
  
  ctx.restore()
  updateSelectionOverlay()
}

function drawElement(ctx, element, optimizedRendering) {
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
  
  const type = element.type
  if (type === 'stroke') {
    drawStroke(ctx, element)
  } else if (type === 'shape') {
    drawShape(ctx, element)
  } else if (type === 'text') {
    drawText(ctx, element)
  } else if (type === 'stickyNote') {
    drawStickyNote(ctx, element, _isLightColor)
  } else if (type === 'image') {
    drawImageElement(ctx, element)
  }
  
  ctx.restore()
}

function drawStroke(ctx, element) {
  ctx.strokeStyle = element.color || '#000000'
  ctx.lineWidth = element.strokeSize || 4
  ctx.globalAlpha = element.alpha !== undefined ? element.alpha : 1.0
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalCompositeOperation = element.compositeOperation || 'source-over'
  
  const points = element.points
  if (points && points.length > 0) {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1, len = points.length; i < len; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()
  }
}

function drawShape(ctx, element) {
  ctx.strokeStyle = element.color || '#000000'
  ctx.fillStyle = element.color || '#000000'
  ctx.lineWidth = element.strokeSize || 4
  ctx.globalAlpha = 1.0
  ctx.globalCompositeOperation = 'source-over'
  
  const x = Math.min(element.start.x, element.end.x)
  const y = Math.min(element.start.y, element.end.y)
  const w = Math.abs(element.end.x - element.start.x)
  const h = Math.abs(element.end.y - element.start.y)
  
  const shapeType = element.shapeType
  if (shapeType === 'rectangle') {
    if (element.filled) {
      ctx.fillRect(x, y, w, h)
    } else {
      ctx.strokeRect(x, y, w, h)
    }
  } else if (shapeType === 'circle') {
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
  } else if (shapeType === 'line') {
    ctx.beginPath()
    ctx.moveTo(element.start.x, element.start.y)
    ctx.lineTo(element.end.x, element.end.y)
    ctx.stroke()
  } else if (shapeType === 'arrow') {
    drawArrow(ctx, element.start.x, element.start.y, element.end.x, element.end.y)
  }
}

function drawImageElement(ctx, element) {
  const cache = getImageCache()
  let img = cache.get(element.id)
  
  if (!img) {
    img = new Image()
    img.src = element.src
    cache.set(element.id, img)
    img.addEventListener('load', () => scheduleRedraw(), { once: true })
  }
  
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, element.x, element.y, element.width, element.height)
  } else {
    ctx.save()
    ctx.strokeStyle = '#888'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(element.x, element.y, element.width, element.height)
    ctx.restore()
  }
}

function updateSelectionOverlay() {
  const { selectionCtx, selectionCanvas } = CanvasManager.createSelectionCanvas()
  if (!selectionCtx) return
  
  selectionCtx.save()
  selectionCtx.setTransform(1, 0, 0, 1, 0, 0)
  selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height)
  selectionCtx.restore()
  
  selectionCtx.save()
  selectionCtx.translate(state.panX, state.panY)
  
  if (_selectTool) {
    _selectTool.drawSelectionIndicators(selectionCtx)
    
    if (state.tool === 'select' && state.isSelecting) {
      _selectTool.drawSelectionBox(selectionCtx)
    }
  }
  
  selectionCtx.restore()
  
  if (_updateShapeFillToggleState) {
    _updateShapeFillToggleState()
  }
}

function updateSelectionOnly() {
  updateSelectionOverlay()
}

function cancelScheduledRedraw() {
  if (_rafId) {
    cancelAnimationFrame(_rafId)
    _rafId = null
    _redrawScheduled = false
  }
}

module.exports = {
  init,
  redrawCanvas,
  scheduleRedraw,
  updateSelectionOverlay,
  updateSelectionOnly,
  drawElement,
  cancelScheduledRedraw
}
