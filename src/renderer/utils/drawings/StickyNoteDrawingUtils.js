function drawText(ctx, textElement) {
  const fontSize = textElement.fontSize || Math.max(12, (textElement.strokeSize || 4) * 4)
  ctx.textBaseline = 'top'
  
  if (textElement.segments && textElement.segments.length > 0) {
    const lineHeight = fontSize * 1.2
    const maxTextWidth = 2000
    const textYOffset = fontSize * 0.12
    let cursorX = textElement.x
    let cursorY = textElement.y + textYOffset
    
    textElement.segments.forEach((segment) => {
      const fontStyle = segment.formatting?.italic ? 'italic' : 'normal'
      const fontWeight = segment.formatting?.bold ? 'bold' : 'normal'
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
      ctx.fillStyle = segment.formatting?.color || textElement.color || '#000000'
      
      const lines = segment.text.split('\n')
      
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
          cursorX = textElement.x
          cursorY += lineHeight
        }
        
        const tokens = line.split(/(\s+)/)
        
        tokens.forEach(token => {
          if (token.length === 0) return
          
          const tokenWidth = ctx.measureText(token).width
          
          if (cursorX + tokenWidth > textElement.x + maxTextWidth && cursorX > textElement.x) {
            cursorX = textElement.x
            cursorY += lineHeight
            
            if (token.trim() === '') {
              return
            }
          }
          
          ctx.fillText(token, cursorX, cursorY)
          
          if (segment.formatting?.underline) {
            ctx.strokeStyle = segment.formatting?.color || textElement.color || '#000000'
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

function drawStickyNote(ctx, stickyNote, isLightColor) {
  const { x, y, text, font: fontName = 'comic-sans', color = '#ffffff', scrollOffset: rawScroll = 0 } = stickyNote
  const width = stickyNote.width || 280
  const height = stickyNote.height || 280

  ctx.save()
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetX = 5
  ctx.shadowOffsetY = 5

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, 12)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  ctx.strokeStyle = 'rgba(0,0,0,0.05)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = 'rgba(0,0,0,0.03)'
  ctx.beginPath()
  ctx.roundRect(x, y, width, 48, [12, 12, 0, 0])
  ctx.fill()

  const isLight = isLightColor(color)
  ctx.fillStyle = isLight ? '#1e293b' : '#ffffff'
  
  const fontSize = 20
  const lineHeight = Math.round(fontSize * 1.6)
  
  let fontFamily = "'Comic Sans MS', 'Comic Sans', cursive, sans-serif"
  if (fontName === 'monospace') fontFamily = "'Courier New', monospace"
  else if (fontName === 'opendyslexic') fontFamily = "'OpenDyslexicRegular', 'Comic Sans MS', sans-serif"
  
  ctx.textBaseline = 'top'
  
  const padding = 20
  const topPadding = 24
  const headerHeight = 48
  const maxWidth = width - (padding * 2)
  
  const cacheKey = `${text}|${maxWidth}|${fontName}|${fontSize}`
  if (stickyNote._lineCacheKey !== cacheKey) {
    const segments = parseHtmlToSegments(text)
    const lines = wrapSegmentsToLines(segments, maxWidth, ctx, fontSize, fontFamily)
    
    stickyNote._cachedLines = lines
    stickyNote._lineCacheKey = cacheKey
    stickyNote._totalTextHeight = lines.length * lineHeight
  }

  const lines = stickyNote._cachedLines
  const totalContentHeight = stickyNote._totalTextHeight
  const contentAreaHeight = height - headerHeight - topPadding - 16
  const maxScroll = Math.max(0, totalContentHeight - contentAreaHeight)
  
  const scrollOffset = Math.min(rawScroll, maxScroll)
  if (stickyNote.scrollOffset !== scrollOffset) stickyNote.scrollOffset = scrollOffset

  ctx.save()
  ctx.beginPath()
  ctx.rect(x + padding, y + headerHeight + topPadding - 4, maxWidth, contentAreaHeight + 8)
  ctx.clip()

  const scrollStartY = y + headerHeight + topPadding
  lines.forEach((line, lineIndex) => {
    const lineY = scrollStartY + (lineIndex * lineHeight) - scrollOffset
    if (lineY + lineHeight > scrollStartY - 10 && lineY < y + height) {
      let cursorX = x + padding
      
      line.segments.forEach(segment => {
        const fontStyle = segment.formatting?.italic ? 'italic' : 'normal'
        const fontWeight = segment.formatting?.bold ? 'bold' : 'normal'
        const textDecoration = segment.formatting?.underline ? 'underline' : 'none'
        const strikethrough = segment.formatting?.strikethrough
        
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
        ctx.fillStyle = isLight ? '#1e293b' : '#ffffff'
        
        const metrics = ctx.measureText(segment.text)
        ctx.fillText(segment.text, cursorX, lineY)
        
        if (textDecoration === 'underline') {
          ctx.strokeStyle = isLight ? '#1e293b' : '#ffffff'
          ctx.lineWidth = Math.max(1, fontSize / 15)
          ctx.beginPath()
          ctx.moveTo(cursorX, lineY + fontSize * 0.9)
          ctx.lineTo(cursorX + metrics.width, lineY + fontSize * 0.9)
          ctx.stroke()
        }
        
        if (strikethrough) {
          ctx.strokeStyle = isLight ? '#1e293b' : '#ffffff'
          ctx.lineWidth = Math.max(1, fontSize / 15)
          ctx.beginPath()
          ctx.moveTo(cursorX, lineY + fontSize * 0.5)
          ctx.lineTo(cursorX + metrics.width, lineY + fontSize * 0.5)
          ctx.stroke()
        }
        
        cursorX += metrics.width
      })
    }
  })
  ctx.restore() 

  if (totalContentHeight > contentAreaHeight) {
    const scrollbarWidth = 4
    const scrollbarPadding = 4
    const trackHeight = contentAreaHeight
    const thumbHeight = Math.max(20, (contentAreaHeight / totalContentHeight) * trackHeight)
    const scrollTrackX = x + width - scrollbarWidth - scrollbarPadding
    const scrollTrackY = y + headerHeight + topPadding
    const thumbY = (scrollOffset / maxScroll) * (trackHeight - thumbHeight)

    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'
    ctx.beginPath()
    ctx.roundRect(scrollTrackX, scrollTrackY + thumbY, scrollbarWidth, thumbHeight, 2)
    ctx.fill()
  }

  ctx.restore() 
}

let parserDiv = null
function parseHtmlToSegments(html) {
  if (!parserDiv) parserDiv = document.createElement('div')
  parserDiv.innerHTML = html
  
  const segments = []
  
  function processNode(node, formatting = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
      if (text.trim()) {
        segments.push({ text, formatting: { ...formatting } })
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const newFormatting = { ...formatting }
      
      switch (node.tagName.toLowerCase()) {
        case 'b':
        case 'strong':
          newFormatting.bold = true
          break
        case 'i':
        case 'em':
          newFormatting.italic = true
          break
        case 'u':
          newFormatting.underline = true
          break
        case 'strike':
        case 's':
          newFormatting.strikethrough = true
          break
        case 'ul':
        case 'ol':
        case 'li':
          if (node.tagName.toLowerCase() === 'li') {
            const parentTag = node.parentElement?.tagName.toLowerCase()
            const prefix = parentTag === 'ol' ? '• ' : '• ' 
            segments.push({ text: prefix, formatting: { ...newFormatting, bold: true } })
          }
          break
      }
      node.childNodes.forEach(child => processNode(child, newFormatting))
    }
  }
  
  parserDiv.childNodes.forEach(node => processNode(node))
  parserDiv.innerHTML = ''
  
  return segments
}

function wrapSegmentsToLines(segments, maxWidth, ctx, fontSize, fontFamily) {
  const lines = []
  let currentLine = { segments: [], width: 0 }
  
  segments.forEach(segment => {
    const fontStyle = segment.formatting?.italic ? 'italic' : 'normal'
    const fontWeight = segment.formatting?.bold ? 'bold' : 'normal'
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
    
    const tokens = segment.text.split(/(\s+)/)
    
    tokens.forEach(token => {
      if (token.length === 0) return
      
      const testSegment = { ...segment, text: token }
      const testWidth = ctx.measureText(token).width
      
      if (currentLine.width + testWidth > maxWidth && currentLine.segments.length > 0 && !token.match(/^\s+$/)) {
        lines.push(currentLine)
        currentLine = { segments: [], width: 0 }
      }
      
      currentLine.segments.push(testSegment)
      currentLine.width += testWidth
    })
  })
  
  if (currentLine.segments.length > 0) {
    lines.push(currentLine)
  }
  
  return lines
}

module.exports = {
  drawText,
  drawStickyNote
}
