const { state } = require('../core/AppState.js')
const CanvasManager = require('../core/CanvasManager.js')

function getElementBounds(element) {
  const ctx = CanvasManager.getCtx()

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
    const maxTextWidth = 2000
    
    let maxWidth = 0
    
    if (element.id === state.editingElementId) {
      const textInput = document.getElementById('text-input')
      if (textInput && textInput.style.display !== 'none') {
        const rect = textInput.getBoundingClientRect()
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

module.exports = {
  getElementBounds,
  hitTest,
  findElementAt
}