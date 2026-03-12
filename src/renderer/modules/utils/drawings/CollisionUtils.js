const { state } = require('../../core/AppState.js')
const CanvasManager = require('../../core/CanvasManager.js')

function rotatePoint(px, py, cx, cy, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + (dx * cos - dy * sin),
    y: cy + (dx * sin + dy * cos)
  }
}

function getElementBounds(element, returnUnrotated = false) {
  if (!element._dirty) {
    if (returnUnrotated && element._cachedUnrotatedBounds) return element._cachedUnrotatedBounds
    if (!returnUnrotated && element._cachedBounds) return element._cachedBounds
  }

  const ctx = CanvasManager.getCtx()
  let unrotatedBounds = null

  if (element.type === 'stroke' && element.points && element.points.length > 0) {
    let minX = element.points[0].x, minY = element.points[0].y, maxX = minX, maxY = minY
    for (let i = 1; i < element.points.length; i++) {
      const p = element.points[i]
      if (p.x < minX) minX = p.x; else if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; else if (p.y > maxY) maxY = p.y
    }
    const padding = (element.strokeSize / 2) + 2
    unrotatedBounds = { x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 }
  } else if (element.type === 'shape') {
    const x = Math.min(element.start.x, element.end.x)
    const y = Math.min(element.start.y, element.end.y)
    const w = Math.abs(element.end.x - element.start.x)
    const h = Math.abs(element.end.y - element.start.y)
    const padding = (element.strokeSize || 4) / 2 + 2
    unrotatedBounds = { x: x - padding, y: y - padding, width: w + padding * 2, height: h + padding * 2 }
  } else if (element.type === 'text') {
    const fontSize = element.fontSize || Math.max(12, (element.strokeSize || 4) * 4)
    const lineHeight = fontSize * 1.2
    
    if (element.id === state.editingElementId) {
      const textInput = document.getElementById('text-input')
      if (textInput?.style.display !== 'none') {
        const rect = textInput.getBoundingClientRect()
        const canvasRect = CanvasManager.getCanvas().getBoundingClientRect()
        unrotatedBounds = {
          x: rect.left - canvasRect.left - state.panX,
          y: rect.top - canvasRect.top - state.panY,
          width: rect.width,
          height: rect.height
        }
      }
    }
    
    if (!unrotatedBounds && element.segments) {
      ctx.save()
      const fontSize = element.fontSize || Math.max(12, (element.strokeSize || 4) * 4)
      const lineHeight = fontSize * 1.2
      const maxTextWidth = 2000
      let maxWidth = 0
      let cursorX = 0
      let currentLineY = 0
      
      element.segments.forEach(seg => {
        const fontStyle = seg.formatting?.italic ? 'italic' : 'normal'
        const fontWeight = seg.formatting?.bold ? 'bold' : 'normal'
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        
        const lines = seg.text.split('\n')
        lines.forEach((line, i) => {
          if (i > 0) {
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
            }
            cursorX += tokenWidth
            maxWidth = Math.max(maxWidth, cursorX)
          })
        })
      })
      
      unrotatedBounds = { 
        x: element.x - 5, 
        y: element.y - 5, 
        width: maxWidth + 10, 
        height: currentLineY + lineHeight + 5 
      }
      ctx.restore()
    }
  } else if (element.type === 'stickyNote') {
    unrotatedBounds = { x: element.x, y: element.y, width: element.width || 280, height: element.height || 280 }
  }

  if (!unrotatedBounds) return null
  
  element._cachedUnrotatedBounds = unrotatedBounds
  
  let finalBounds = unrotatedBounds
  if (element.rotation) {
    const cx = unrotatedBounds.x + unrotatedBounds.width / 2
    const cy = unrotatedBounds.y + unrotatedBounds.height / 2
    const corners = [
      rotatePoint(unrotatedBounds.x, unrotatedBounds.y, cx, cy, element.rotation),
      rotatePoint(unrotatedBounds.x + unrotatedBounds.width, unrotatedBounds.y, cx, cy, element.rotation),
      rotatePoint(unrotatedBounds.x, unrotatedBounds.y + unrotatedBounds.height, cx, cy, element.rotation),
      rotatePoint(unrotatedBounds.x + unrotatedBounds.width, unrotatedBounds.y + unrotatedBounds.height, cx, cy, element.rotation)
    ]
    let minX = corners[0].x, minY = corners[0].y, maxX = minX, maxY = minY
    for (let i = 1; i < 4; i++) {
      const p = corners[i]
      if (p.x < minX) minX = p.x; else if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; else if (p.y > maxY) maxY = p.y
    }
    finalBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  element._cachedBounds = finalBounds
  element._dirty = false
  return returnUnrotated ? unrotatedBounds : finalBounds
}

function hitTest(x, y, element) {
  let testX = x, testY = y

  if (element.rotation) {
    const unrotated = getElementBounds(element, true)
    if (unrotated) {
      const cx = unrotated.x + unrotated.width / 2
      const cy = unrotated.y + unrotated.height / 2
      const rotatedCoord = rotatePoint(x, y, cx, cy, -element.rotation)
      testX = rotatedCoord.x
      testY = rotatedCoord.y
    }
  }

  if (element.type === 'shape' && element.shapeType === 'circle') {
    const w = Math.abs(element.end.x - element.start.x)
    const h = Math.abs(element.end.y - element.start.y)
    const centerX = (element.start.x + element.end.x) / 2
    const centerY = (element.start.y + element.end.y) / 2
    const radius = Math.sqrt(w * w + h * h) / 2
    
    const dx = testX - centerX
    const dy = testY - centerY
    return Math.sqrt(dx * dx + dy * dy) <= radius
  }
  
  if (element.type === 'shape' && (element.shapeType === 'line' || element.shapeType === 'arrow')) {
    const strokeSize = element.strokeSize || 4
    const threshold = strokeSize / 2 + 5
    const x1 = element.start.x, y1 = element.start.y, x2 = element.end.x, y2 = element.end.y
    const A = testX - x1, B = testY - y1, C = x2 - x1, D = y2 - y1
    const dot = A * C + B * D, lenSq = C * C + D * D
    let param = lenSq !== 0 ? dot / lenSq : -1
    let xx, yy
    if (param < 0) { xx = x1; yy = y1 }
    else if (param > 1) { xx = x2; yy = y2 }
    else { xx = x1 + param * C; yy = y1 + param * D }
    return Math.sqrt((testX - xx) ** 2 + (testY - yy) ** 2) <= threshold
  }
  
  const bounds = getElementBounds({ ...element, rotation: 0 })
  if (!bounds) return false
  return testX >= bounds.x && testX <= bounds.x + bounds.width &&
         testY >= bounds.y && testY <= bounds.y + bounds.height
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

module.exports = {
  getElementBounds,
  hitTest,
  findElementAt
}