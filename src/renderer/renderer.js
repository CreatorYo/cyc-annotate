const { ipcRenderer, nativeTheme } = require('electron')

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

function resizeCanvas() {
canvas.width = window.innerWidth
canvas.height = window.innerHeight
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

let audioContext = null
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('AudioContext not available:', e)
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
  }
}

document.addEventListener('click', initAudioContext, { once: true })
document.addEventListener('mousedown', initAudioContext, { once: true })

function playSound(type) {
  const soundsEnabled = document.getElementById('sounds-enabled')?.checked !== false
  if (!soundsEnabled) return
  
  initAudioContext()
  if (!audioContext) return
  
  try {
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    
  if (type === 'trash') {
    
    const duration = 0.4
    const sampleRate = audioContext.sampleRate
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate

      const decay = Math.exp(-t * 6)

      const impact = Math.exp(-t * 30) * 0.4

      const rumble = Math.sin(2 * Math.PI * 80 * t) * 0.25 * decay

      const ring = Math.sin(2 * Math.PI * 200 * t) * 0.15 * decay

      const shimmer = Math.sin(2 * Math.PI * 800 * t) * 0.1 * Math.exp(-t * 15)

      const noise = (Math.random() * 2 - 1) * 0.15 * decay

      data[i] = (impact + rumble + ring + shimmer + noise) * decay
    }
    
    const source = audioContext.createBufferSource()
    const gainNode = audioContext.createGain()
    
    source.buffer = buffer
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)

    gainNode.gain.setValueAtTime(0.6, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
    
    source.start(audioContext.currentTime)
    source.stop(audioContext.currentTime + duration)
    } else if (type === 'pop') {
      
      const duration = 0.15
      const sampleRate = audioContext.sampleRate
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate

        const decay = Math.exp(-t * 25)

        const attack = Math.exp(-t * 50) * 0.6

        const popFreq = Math.sin(2 * Math.PI * 400 * t) * 0.4 * decay

        const crack = Math.sin(2 * Math.PI * 1200 * t) * 0.3 * Math.exp(-t * 40)

        const whoosh = Math.sin(2 * Math.PI * 150 * t) * 0.2 * decay

        const noise = (Math.random() * 2 - 1) * 0.15 * Math.exp(-t * 30)

        data[i] = (attack + popFreq + crack + whoosh + noise) * decay
      }
      
      const source = audioContext.createBufferSource()
      const gainNode = audioContext.createGain()
      
      source.buffer = buffer
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      gainNode.gain.setValueAtTime(0.7, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      source.start(audioContext.currentTime)
      source.stop(audioContext.currentTime + duration)
    } else if (type === 'undo' || type === 'redo') {
      const duration = 0.2
      const sampleRate = audioContext.sampleRate
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate

        const decay = Math.exp(-t * 20)

        const sweep = Math.sin(2 * Math.PI * (type === 'undo' ? 300 : 400) * t) * 0.5 * decay

        const whoosh = Math.sin(2 * Math.PI * 100 * t) * 0.3 * decay

        const highFreq = Math.sin(2 * Math.PI * 800 * t) * 0.2 * Math.exp(-t * 30)

        const noise = (Math.random() * 2 - 1) * 0.1 * decay

        data[i] = (sweep + whoosh + highFreq + noise) * decay
      }
      
      const source = audioContext.createBufferSource()
      const gainNode = audioContext.createGain()
      
      source.buffer = buffer
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      source.start(audioContext.currentTime)
      source.stop(audioContext.currentTime + duration)
    } else if (type === 'capture') {
      const duration = 0.25
      const sampleRate = audioContext.sampleRate
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate

        const decay = Math.exp(-t * 15)

        const click = Math.sin(2 * Math.PI * 600 * t) * 0.5 * Math.exp(-t * 40)

        const snap = Math.sin(2 * Math.PI * 1200 * t) * 0.4 * Math.exp(-t * 50)

        const lowFreq = Math.sin(2 * Math.PI * 200 * t) * 0.3 * decay

        const highFreq = Math.sin(2 * Math.PI * 1800 * t) * 0.2 * Math.exp(-t * 60)

        const noise = (Math.random() * 2 - 1) * 0.1 * Math.exp(-t * 35)

        data[i] = (click + snap + lowFreq + highFreq + noise) * decay
      }
      
      const source = audioContext.createBufferSource()
      const gainNode = audioContext.createGain()
      
      source.buffer = buffer
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      gainNode.gain.setValueAtTime(0.6, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      source.start(audioContext.currentTime)
      source.stop(audioContext.currentTime + duration)
    } else if (type === 'color') {
      const duration = 0.12
      const sampleRate = audioContext.sampleRate
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate

        const decay = Math.exp(-t * 30)

        const chime1 = Math.sin(2 * Math.PI * 600 * t) * 0.5 * decay
        const chime2 = Math.sin(2 * Math.PI * 900 * t) * 0.3 * decay

        const sparkle = Math.sin(2 * Math.PI * 1500 * t) * 0.2 * Math.exp(-t * 50)

        const warmth = Math.sin(2 * Math.PI * 300 * t) * 0.15 * decay

        data[i] = (chime1 + chime2 + sparkle + warmth) * decay
      }
      
      const source = audioContext.createBufferSource()
      const gainNode = audioContext.createGain()
      
      source.buffer = buffer
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      source.start(audioContext.currentTime)
      source.stop(audioContext.currentTime + duration)
    }
  } catch (e) {
    console.warn('Error playing sound:', e)
  }
}

let state = {
  drawing: false,
  enabled: true, 
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
  shapeEnd: null
}

canvas.style.pointerEvents = 'auto'

let lastX = 0
let lastY = 0
let previewCanvas = null
let previewCtx = null

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
    document.body.appendChild(previewCanvas)
    previewCtx = previewCanvas.getContext('2d')
  }
}

ctx.lineCap = 'round'
ctx.lineJoin = 'round'

function saveState() {
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  state.history.push(imageData)
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
  const imageData = state.history[state.historyIndex]
  ctx.putImageData(imageData, 0, 0)
  checkIfHasDrawn()
  setTimeout(() => playSound('undo'), 10)
  updateUndoRedoButtons()
}

function redo() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++
    const imageData = state.history[state.historyIndex]
    ctx.putImageData(imageData, 0, 0)
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
  if (!state.enabled) return

  e.preventDefault()
  
  if (state.tool === 'text') {
    const coords = getCanvasCoordinates(e)
    
    const textInput = document.getElementById('text-input')
    if (textInput.style.display === 'block') {
      finishTextInput()
    }
    startTextInput(coords.x, coords.y)
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
  
  if (state.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.globalCompositeOperation = 'source-over'
  }
  
  ctx.beginPath()
  ctx.moveTo(coords.x, coords.y)
}

let isDrawing = false
let drawFrame = null

function draw(e) {
  if (!state.drawing || !state.enabled) return
  
  if (state.tool === 'shapes') {
    const coords = getCanvasCoordinates(e)
    state.shapeEnd = coords
    if (drawFrame) cancelAnimationFrame(drawFrame)
    drawFrame = requestAnimationFrame(() => drawShapePreview())
    return
  }
  
  const coords = getCanvasCoordinates(e)

  if (!isDrawing) {
    isDrawing = true
    drawFrame = requestAnimationFrame(() => {
      if (state.tool === 'pencil') {
        ctx.strokeStyle = state.color
        ctx.lineWidth = state.strokeSize
        ctx.globalAlpha = 1.0
      } else if (state.tool === 'marker') {
        ctx.strokeStyle = state.color
        ctx.lineWidth = state.strokeSize * 1.5
        ctx.globalAlpha = 0.6
      } else if (state.tool === 'eraser') {
        ctx.lineWidth = state.strokeSize * 2
        ctx.globalAlpha = 1.0
      }
      
      ctx.lineTo(coords.x, coords.y)
      ctx.stroke()
      
      lastX = coords.x
      lastY = coords.y
      state.hasDrawn = true
      isDrawing = false
    })
  }
}

function stopDrawing() {
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
      drawShapeFinal()
      clearPreview()
      saveState()
      state.hasDrawn = true
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
  
  if (state.shapeType === 'rectangle') {
    previewCtx.strokeRect(x, y, w, h)
  } else if (state.shapeType === 'circle') {
    const centerX = (state.shapeStart.x + state.shapeEnd.x) / 2
    const centerY = (state.shapeStart.y + state.shapeEnd.y) / 2
    const radius = Math.sqrt(w * w + h * h) / 2
    previewCtx.beginPath()
    previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    previewCtx.stroke()
  } else if (state.shapeType === 'line') {
    previewCtx.beginPath()
    previewCtx.moveTo(state.shapeStart.x, state.shapeStart.y)
    previewCtx.lineTo(state.shapeEnd.x, state.shapeEnd.y)
    previewCtx.stroke()
  } else if (state.shapeType === 'arrow') {
    drawArrow(previewCtx, state.shapeStart.x, state.shapeStart.y, state.shapeEnd.x, state.shapeEnd.y)
  }
}

function drawShapeFinal() {
  if (!state.shapeStart || !state.shapeEnd) return
  
  ctx.strokeStyle = state.color
  ctx.fillStyle = state.color
  ctx.lineWidth = state.strokeSize
  ctx.globalAlpha = 1.0
  
  const x = Math.min(state.shapeStart.x, state.shapeEnd.x)
  const y = Math.min(state.shapeStart.y, state.shapeEnd.y)
  const w = Math.abs(state.shapeEnd.x - state.shapeStart.x)
  const h = Math.abs(state.shapeEnd.y - state.shapeStart.y)
  
  if (state.shapeType === 'rectangle') {
    ctx.strokeRect(x, y, w, h)
  } else if (state.shapeType === 'circle') {
    const centerX = (state.shapeStart.x + state.shapeEnd.x) / 2
    const centerY = (state.shapeStart.y + state.shapeEnd.y) / 2
    const radius = Math.sqrt(w * w + h * h) / 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.stroke()
  } else if (state.shapeType === 'line') {
    ctx.beginPath()
    ctx.moveTo(state.shapeStart.x, state.shapeStart.y)
    ctx.lineTo(state.shapeEnd.x, state.shapeEnd.y)
    ctx.stroke()
  } else if (state.shapeType === 'arrow') {
    drawArrow(ctx, state.shapeStart.x, state.shapeStart.y, state.shapeEnd.x, state.shapeEnd.y)
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

function startTextInput(x, y) {
  const textInput = document.getElementById('text-input')
  const canvasRect = canvas.getBoundingClientRect()

  textInput.style.display = 'block'
  textInput.style.position = 'fixed'
  textInput.style.left = (canvasRect.left + x) + 'px'
  textInput.style.top = (canvasRect.top + y) + 'px'
  textInput.style.zIndex = '2000'
  textInput.textContent = ''
  textInput.innerHTML = ''

  state.textFormatting = {
    bold: false,
    italic: false,
    underline: false
  }

  setTimeout(() => {
    textInput.focus()
  }, 10)
  
  state.textInput = { x, y }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  lines.push(currentLine)
  return lines
}

function evaluateMathExpression(expression) {
  try {
    let cleaned = expression.trim()
    
    if (cleaned.endsWith('=')) {
      cleaned = cleaned.slice(0, -1).trim()
    }
    
    cleaned = cleaned.replace(/[xX×]/g, '*')
    
    cleaned = cleaned.replace(/\s/g, '')
    
    if (!/[+\-*/]/.test(cleaned)) return null
    if (!/[0-9]/.test(cleaned)) return null
    
    const allowedChars = /^[0-9+\-*/().]+$/
    if (!allowedChars.test(cleaned)) return null

    const result = Function('"use strict"; return (' + cleaned + ')')()

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result
    }
    return null
  } catch (e) {
    return null
  }
}

function parseFormattedText(element) {
  const segments = []
  
  function traverse(node, formatting = { bold: false, italic: false, underline: false }) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
      if (text) {
        segments.push({ text, formatting: { ...formatting } })
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase()
      const newFormatting = { ...formatting }
      
      if (tagName === 'b' || tagName === 'strong') {
        newFormatting.bold = true
      } else if (tagName === 'i' || tagName === 'em') {
        newFormatting.italic = true
      } else if (tagName === 'u') {
        newFormatting.underline = true
      }
      
      for (let child of node.childNodes) {
        traverse(child, newFormatting)
      }
    }
  }
  
  for (let child of element.childNodes) {
    traverse(child)
  }
  
  if (segments.length === 0) {
    segments.push({ text: element.textContent || '', formatting: { bold: false, italic: false, underline: false } })
  }
  
  const merged = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    
    if (merged.length > 0) {
      const last = merged[merged.length - 1]
      const formatMatch = last.formatting.bold === segment.formatting.bold &&
                         last.formatting.italic === segment.formatting.italic &&
                         last.formatting.underline === segment.formatting.underline
      
      if (formatMatch) {
        last.text += segment.text
      } else {
        merged.push({ text: segment.text, formatting: { ...segment.formatting } })
      }
    } else {
      merged.push({ text: segment.text, formatting: { ...segment.formatting } })
    }
  }
  
  return merged
}

function finishTextInput() {
  const textInput = document.getElementById('text-input')
  const textContent = textInput.textContent.trim()
  
  if (textContent && state.textInput) {
    
    updateTextFormatting()
    
    const textSolveEnabled = localStorage.getItem('text-solve-enabled') === 'true'
    
    let segments = parseFormattedText(textInput)
      
    if (textSolveEnabled && segments.length > 0) {
      const fullText = segments.map(s => s.text).join('')
      const result = evaluateMathExpression(fullText)
      if (result !== null) {
        const trimmedText = fullText.trim()
        if (trimmedText.endsWith('=')) {
          segments[segments.length - 1].text = `${trimmedText} ${result}`
        } else {
          segments.push({ text: ` = ${result}`, formatting: { bold: false, italic: false, underline: false } })
        }
      }
    }
    
    ctx.save()
    ctx.fillStyle = state.color
    const fontSize = Math.max(12, state.strokeSize * 4)
    ctx.textBaseline = 'top'
    ctx.globalAlpha = 1.0

    const maxWidth = Math.max(400, canvas.width * 0.8)
    const lineHeight = fontSize * 1.2
    let currentX = state.textInput.x
    let currentY = state.textInput.y
    
    const lines = []
    let currentLine = []
    let currentLineWidth = 0

    segments.forEach(segment => {
      const fontStyle = segment.formatting.italic ? 'italic' : 'normal'
      const fontWeight = segment.formatting.bold ? 'bold' : 'normal'
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
      
      const words = segment.text.trim().split(/\s+/).filter(w => w.length > 0)
      
      words.forEach(word => {
        const spaceBefore = currentLine.length > 0 ? ' ' : ''
        const testText = currentLine.length > 0 
          ? (currentLine.map(p => p.text).join(' ') + ' ' + word)
          : word
        const testWidth = ctx.measureText(testText).width
        
        if (testWidth > maxWidth && currentLine.length > 0) {
          lines.push([...currentLine])
          currentLine = [{ text: word, formatting: segment.formatting }]
        } else {
          currentLine.push({ text: word, formatting: segment.formatting })
        }
      })
    })
    
    if (currentLine.length > 0) {
      lines.push(currentLine)
    }

    lines.forEach((line, lineIndex) => {
      let x = currentX
      const y = state.textInput.y + (lineIndex * lineHeight)
      
      line.forEach((part, partIndex) => {
        const fontStyle = part.formatting.italic ? 'italic' : 'normal'
        const fontWeight = part.formatting.bold ? 'bold' : 'normal'
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        
        const space = partIndex > 0 ? ' ' : ''
        const text = space + part.text
        ctx.fillText(text, x, y)
        
        if (part.formatting.underline) {
          const textWidth = ctx.measureText(text).width
        ctx.strokeStyle = state.color
        ctx.lineWidth = Math.max(1, fontSize / 15)
        ctx.beginPath()
          ctx.moveTo(x, y + fontSize + 2)
          ctx.lineTo(x + textWidth, y + fontSize + 2)
        ctx.stroke()
      }
        
        x += ctx.measureText(text).width
      })
    })
    
    ctx.restore()
    saveState()
    state.hasDrawn = true
  }
  
  textInput.style.display = 'none'
  state.textInput = null
  if (state.textFormatting) {
    state.textFormatting = { bold: false, italic: false, underline: false }
  }
}

canvas.addEventListener('mousedown', startDrawing)
canvas.addEventListener('mousemove', draw)
canvas.addEventListener('mouseup', stopDrawing)
canvas.addEventListener('mouseout', stopDrawing)

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
      finishTextInput()
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
      updateTextFormatting()
      return
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault()
      e.stopPropagation()
      document.execCommand('italic', false, null)
      updateTextFormatting()
      return
    } else if (e.key.toLowerCase() === 'u') {
      e.preventDefault()
      e.stopPropagation()
      document.execCommand('underline', false, null)
      updateTextFormatting()
      return
    }
  }
  
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    textInputFinished = true
    finishTextInput()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    textInput.style.display = 'none'
    state.textInput = null
    textInputFinished = false
  }
})

function updateTextFormatting() {
  if (!state.textFormatting) {
    state.textFormatting = { bold: false, italic: false, underline: false }
  }
  
  state.textFormatting.bold = document.queryCommandState('bold')
  state.textFormatting.italic = document.queryCommandState('italic')
  state.textFormatting.underline = document.queryCommandState('underline')
}

function setTool(tool) {
  state.tool = tool

  if (tool !== 'text') {
    const textInput = document.getElementById('text-input')
    if (textInput && textInput.style.display === 'block') {
      finishTextInput()
    }
  }
  
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active')

  document.querySelectorAll('.drawing-tool-option').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.tool === tool) {
      btn.classList.add('active')
      
      const icon = pencilBtn?.querySelector('.material-symbols-outlined')
      if (icon) {
        if (tool === 'pencil') {
          icon.textContent = 'edit'
        } else if (tool === 'marker') {
          icon.textContent = 'brush'
        }
      }
    }
  })

  if (tool === 'pencil' || tool === 'marker') {
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
  } else {
    canvas.style.cursor = 'crosshair'
  }

}

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

document.addEventListener('keydown', (e) => {
  
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    return
  }

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'f':
        e.preventDefault()
        toggleSearch()
        break
      case 'z':
        if (e.shiftKey) {
          e.preventDefault()
          redo()
        } else {
          e.preventDefault()
          undo()
        }
        break
      case 'y':
        e.preventDefault()
        redo()
        break
      case ',':
      case ';':
        e.preventDefault()
        document.getElementById('menu-btn').click()
        break
    }
    return
  }

  switch (e.key.toLowerCase()) {
    case 'p':
      e.preventDefault()
      setTool('pencil')
      break
    case 'b':
      e.preventDefault()
      setTool('marker')
      break
    case 't':
      e.preventDefault()
      setTool('text')
      break
    case 's':
      e.preventDefault()
      
      const shapesBtn = document.getElementById('shapes-btn')
      if (shapesBtn) {
        hideAllTooltips()
        const shapesPopup = document.getElementById('shapes-popup')
        if (shapesPopup) {
          const wasOpen = shapesPopup.classList.contains('show')
          closeAllPopups()
          if (!wasOpen) {
            shapesPopup.classList.add('show')
          }
        }
        if (!shapesPopup.classList.contains('show')) {
          setTool('shapes')
        }
      }
      break
    case 'e':
      e.preventDefault()
      setTool('eraser')
      break
    case 'u':
      e.preventDefault()
      undo()
      break
    case 'r':
      e.preventDefault()
      redo()
      break
    case 'delete':
    case 'backspace':
      if (e.shiftKey) {
        e.preventDefault()
        clearCanvas()
      }
      break
    case 'h':
      e.preventDefault()
      document.getElementById('hide-btn').click()
      break
    case 'c':
      if (e.shiftKey) {
        e.preventDefault()
        document.getElementById('capture-btn').click()
      }
      break
    case 'escape':
      e.preventDefault()
      const searchOverlay = document.getElementById('search-overlay')
      if (searchOverlay && searchOverlay.style.display !== 'none') {
        closeSearch()
        return
      }
      const popups = [
        document.getElementById('stroke-popup'),
        document.getElementById('drawing-tools-popup'),
        document.getElementById('shapes-popup'),
        document.getElementById('custom-color-popup'),
        document.getElementById('more-menu-dropdown')
      ]
      
      let hasOpenPopup = false
      popups.forEach(popup => {
        if (popup && popup.classList.contains('show')) {
          hasOpenPopup = true
          popup.classList.remove('show')
        }
      })
      
      if (!hasOpenPopup) {
        ipcRenderer.send('close-notification')
        setTimeout(() => {
          document.getElementById('close-btn').click()
        }, 50)
      }
      break
    case '1':
    case '2':
    case '3':
    case '4':
      
      e.preventDefault()
      const sizes = { '1': 2, '2': 4, '3': 8, '4': 16 }
      const size = sizes[e.key]
      if (size) {
        state.strokeSize = size
        document.querySelectorAll('.stroke-option').forEach(btn => {
          btn.classList.remove('active')
          if (parseInt(btn.dataset.size) === size) {
            btn.classList.add('active')
          }
        })
        localStorage.setItem('stroke-size', size.toString())
      }
      break
    case 'q':
    case 'w':
    case 'g':
      
      e.preventDefault()
      const colorMap = { 'q': '#ef4444', 'w': '#3b82f6', 'g': '#10b981' }
      const color = colorMap[e.key]
      if (color) {
        setColor(color)
        playSound('color')
      }
      break
  }
})

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

document.querySelectorAll('.shape-option').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    state.shapeType = btn.dataset.shape
    setTool('shapes')
    document.querySelectorAll('.shape-option').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    shapesPopup.classList.remove('show')
  })
})

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

let pickrInstance = null

function initColorPicker() {
  
  if (typeof Pickr === 'undefined') {
    setTimeout(initColorPicker, 100)
    return
  }
  
  const colorPickerInput = document.getElementById('color-picker-input')
  if (!colorPickerInput) {
    setTimeout(initColorPicker, 100)
    return
  }

  pickrInstance = Pickr.create({
    el: colorPickerInput,
    theme: 'nano',
    default: state.color,
    inline: false, 
    swatches: [
      '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#06b6d4', '#ffffff',
      '#000000', '#64748b', '#f97316', '#14b8a6'
    ],
    components: {
      preview: false, 
      opacity: false,
      hue: true,
      interaction: {
        hex: true,
        rgba: true,
        hsla: true,
        hsva: true,
        cmyk: false,
        input: true,
        clear: false,
        save: true
      }
    },
    i18n: {
      'btn:save': 'Apply',
      'btn:cancel': 'Cancel'
    }
  })

  if (pickrInstance && pickrInstance.root) {
    pickrInstance.root.style.display = 'none'
  }

  let originalColorBeforePicker = null

  pickrInstance.on('change', (color) => {
    state.color = color.toHEXA().toString()
    
  })

  pickrInstance.on('save', (color) => {
    if (color) {
      const hexColor = color.toHEXA().toString()
      localStorage.setItem('custom-color', hexColor)
      localStorage.setItem('is-custom-color-active', 'true')
      updateCustomColorButton(hexColor)
      setTimeout(() => updateCustomColorButton(hexColor), 10)
      setColor(hexColor, true)
      setTimeout(() => updateCustomColorButton(hexColor), 50)

      const accentColor = localStorage.getItem('accent-color') || '#3bbbf6'
      const isLight = isLightColor(accentColor)
      const textColor = isLight ? '#000000' : '#ffffff'
      document.documentElement.style.setProperty('--picker-btn-text-color', textColor)
      const pickerBtn = document.getElementById('open-color-picker-btn')
      if (pickerBtn) {
        pickerBtn.style.color = textColor
      }
      pickrInstance.hide()
    }
  })

  pickrInstance.on('cancel', () => {
    if (originalColorBeforePicker !== null) {
      state.color = originalColorBeforePicker
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
        
        if (pickrInstance) {
          
          originalColorBeforePicker = state.color;
          
          const colorToShow = (isCustomColorActive && customColorValue) ? customColorValue : state.color
          pickrInstance.setColor(colorToShow)
          
          if (pickrInstance.root) {
            pickrInstance.root.style.display = 'block'
          }
          pickrInstance.show()
        }
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

  if (pickrInstance) {
    pickrInstance.on('hide', () => {
      if (pickrInstance && pickrInstance.root) {
        pickrInstance.root.style.display = 'none'
      }
    })
  }
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
  state.hasDrawn = false
  saveState()
  updateUndoRedoButtons()
  
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

function hideAllTooltips() {
  document.querySelectorAll('.custom-tooltip').forEach(tooltip => {
    tooltip.classList.remove('show')
  })
}

const mainToolbar = document.getElementById('main-toolbar')
let isDragging = false
let currentLayout = localStorage.getItem('toolbar-layout') || 'vertical'

function applyLayout(layout) {
  currentLayout = layout
  mainToolbar.classList.remove('toolbar-vertical', 'toolbar-horizontal')
  mainToolbar.classList.add(`toolbar-${layout}`)
  localStorage.setItem('toolbar-layout', layout)

  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`[data-layout="${layout}"]`)?.classList.add('active')

  resetToolbarPosition()
}

function saveToolbarPosition() {
  
  const rect = mainToolbar.getBoundingClientRect()
  if (currentLayout === 'vertical') {
    
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    localStorage.setItem('toolbar-x', centerX)
    localStorage.setItem('toolbar-y', centerY)
  } else {
    
    const centerX = rect.left + rect.width / 2
    const bottomY = window.innerHeight - rect.bottom
    localStorage.setItem('toolbar-x', centerX)
    localStorage.setItem('toolbar-y', bottomY)
  }
}

function resetToolbarPosition() {
  if (currentLayout === 'vertical') {
    mainToolbar.style.left = '20px'
    mainToolbar.style.top = '50%'
    mainToolbar.style.transform = 'translateY(-50%)'
    mainToolbar.style.bottom = 'auto'
    mainToolbar.style.right = 'auto'
  } else {
    mainToolbar.style.bottom = '20px'
    mainToolbar.style.left = '50%'
    mainToolbar.style.transform = 'translateX(-50%)'
    mainToolbar.style.top = 'auto'
    mainToolbar.style.right = 'auto'
  }
  
  setTimeout(() => {
    saveToolbarPosition()
  }, 10)
}

mainToolbar.addEventListener('dblclick', (e) => {
  
  const clickedButton = e.target.closest('button')
  const clickedColor = e.target.closest('.color-swatch')
  const clickedWrapper = e.target.closest('.stroke-thickness-wrapper, .shapes-wrapper, .drawing-tools-wrapper, .custom-color-wrapper')
  const clickedPopup = e.target.closest('.stroke-popup, .shapes-popup, .drawing-tools-popup, .custom-color-popup')
  const clickedOption = e.target.closest('.stroke-option, .shape-option, .drawing-tool-option, .color-option')
  const clickedGroup = e.target.closest('.toolbar-group, .color-palette')
  
  if (clickedButton || clickedColor || clickedWrapper || clickedPopup || clickedOption || clickedGroup) {
    return
  }
  
  e.stopPropagation()
  resetToolbarPosition()
})

applyLayout(currentLayout)

document.querySelectorAll('.layout-btn').forEach(btn => {
  if (btn.dataset.layout === currentLayout) {
    btn.classList.add('active')
  } else {
    btn.classList.remove('active')
  }
})

document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyLayout(btn.dataset.layout)
  })
})

let dragStartPos = { x: 0, y: 0 }
let toolbarStartPos = { x: 0, y: 0 }

mainToolbar.addEventListener('mousedown', (e) => {
  
  const clickedButton = e.target.closest('button')
  const clickedColor = e.target.closest('.color-swatch')
  const clickedWrapper = e.target.closest('.stroke-thickness-wrapper, .shapes-wrapper')
  const clickedPopup = e.target.closest('.stroke-popup, .shapes-popup')
  const clickedOption = e.target.closest('.stroke-option, .shape-option')
  const clickedGroup = e.target.closest('.toolbar-group, .color-palette')
  
  if (clickedButton || clickedColor || clickedWrapper || clickedPopup || clickedOption || clickedGroup) {
    return
  }

  isDragging = true
  mainToolbar.classList.add('dragging')
  const rect = mainToolbar.getBoundingClientRect()
  dragStartPos.x = e.clientX
  dragStartPos.y = e.clientY
  
  if (currentLayout === 'vertical') {
    toolbarStartPos.x = rect.left
    toolbarStartPos.y = rect.top + rect.height / 2
  } else {
    toolbarStartPos.x = rect.left + rect.width / 2
    toolbarStartPos.y = window.innerHeight - rect.bottom
  }
  
  e.preventDefault()
  e.stopPropagation()
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  
  const deltaX = e.clientX - dragStartPos.x
  const deltaY = e.clientY - dragStartPos.y
  
  if (currentLayout === 'vertical') {
    let newX = toolbarStartPos.x + deltaX
    let newY = toolbarStartPos.y + deltaY

    const toolbarHalfWidth = mainToolbar.offsetWidth / 2
    const toolbarHalfHeight = mainToolbar.offsetHeight / 2
    
    newX = Math.max(toolbarHalfWidth, Math.min(newX, window.innerWidth - toolbarHalfWidth))
    newY = Math.max(toolbarHalfHeight, Math.min(newY, window.innerHeight - toolbarHalfHeight))
    
    mainToolbar.style.left = newX + 'px'
    mainToolbar.style.top = newY + 'px'
    mainToolbar.style.transform = 'translate(-50%, -50%)'
    mainToolbar.style.bottom = 'auto'
    mainToolbar.style.right = 'auto'
  } else {
    let newX = toolbarStartPos.x + deltaX
    let newY = toolbarStartPos.y - deltaY

    const toolbarHalfWidth = mainToolbar.offsetWidth / 2
    const toolbarHeight = mainToolbar.offsetHeight
    
    newX = Math.max(toolbarHalfWidth, Math.min(newX, window.innerWidth - toolbarHalfWidth))
    newY = Math.max(0, Math.min(newY, window.innerHeight - toolbarHeight))
    
    mainToolbar.style.left = newX + 'px'
    mainToolbar.style.bottom = newY + 'px'
    mainToolbar.style.transform = 'translateX(-50%)'
    mainToolbar.style.top = 'auto'
    mainToolbar.style.right = 'auto'
  }
})

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false
    mainToolbar.classList.remove('dragging')

    saveToolbarPosition()
    
    updateDropdownPositioning()
  }
})

function updateDropdownPositioning() {
  const rect = mainToolbar.getBoundingClientRect()
  
  if (currentLayout === 'vertical') {
    const toolbarCenterX = rect.left + rect.width / 2
    const isOnRightSide = toolbarCenterX > window.innerWidth / 2
    
    if (isOnRightSide) {
      mainToolbar.classList.add('toolbar-right-side')
    } else {
      mainToolbar.classList.remove('toolbar-right-side')
    }
    
    mainToolbar.classList.remove('toolbar-top-side')
  } else {
    const toolbarCenterY = rect.top + rect.height / 2
    const isOnTop = toolbarCenterY < window.innerHeight / 2
    
    if (isOnTop) {
      mainToolbar.classList.add('toolbar-top-side')
    } else {
      mainToolbar.classList.remove('toolbar-top-side')
    }
    
    mainToolbar.classList.remove('toolbar-right-side')
  }
}

updateDropdownPositioning()
window.addEventListener('resize', updateDropdownPositioning)

function loadToolbarPosition() {
  const savedX = localStorage.getItem('toolbar-x')
  const savedY = localStorage.getItem('toolbar-y')

  const defaultX = currentLayout === 'vertical' ? 60 : window.innerWidth / 2
  const defaultY = currentLayout === 'vertical' ? window.innerHeight / 2 : 20
  
  if (savedX !== null && savedY !== null) {
    const x = parseFloat(savedX)
    const y = parseFloat(savedY)

    const toolbarHalfWidth = mainToolbar.offsetWidth / 2
    const toolbarHalfHeight = mainToolbar.offsetHeight / 2
    
    if (x >= toolbarHalfWidth && x <= window.innerWidth - toolbarHalfWidth && 
        y >= toolbarHalfHeight && y <= window.innerHeight - toolbarHalfHeight) {
      if (currentLayout === 'vertical') {
        mainToolbar.style.left = x + 'px'
        mainToolbar.style.top = y + 'px'
        mainToolbar.style.transform = 'translate(-50%, -50%)'
        mainToolbar.style.bottom = 'auto'
        mainToolbar.style.right = 'auto'
      } else {
        mainToolbar.style.left = x + 'px'
        mainToolbar.style.bottom = y + 'px'
        mainToolbar.style.transform = 'translateX(-50%)'
        mainToolbar.style.top = 'auto'
        mainToolbar.style.right = 'auto'
      }
      return
    }
  }

  if (currentLayout === 'vertical') {
    mainToolbar.style.left = defaultX + 'px'
    mainToolbar.style.top = defaultY + 'px'
    mainToolbar.style.transform = 'translate(-50%, -50%)'
    mainToolbar.style.bottom = 'auto'
    mainToolbar.style.right = 'auto'
  } else {
    mainToolbar.style.left = defaultX + 'px'
    mainToolbar.style.bottom = defaultY + 'px'
    mainToolbar.style.transform = 'translateX(-50%)'
    mainToolbar.style.top = 'auto'
    mainToolbar.style.right = 'auto'
  }

  setTimeout(() => {
    updateDropdownPositioning()
  }, 100)
}

loadToolbarPosition()

window.addEventListener('load', () => {
  setTimeout(() => {
    updateDropdownPositioning()
  }, 200)
})

window.addEventListener('resize', () => {
  const rect = mainToolbar.getBoundingClientRect()
  if (rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
    loadToolbarPosition()
  }
})

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
  const undoBtn = document.getElementById('undo-btn')
  const redoBtn = document.getElementById('redo-btn')
  const hideBtn = document.getElementById('hide-btn')
  const menuBtn = document.getElementById('menu-btn')
  const moreMenuBtn = document.getElementById('more-menu-btn')
  const moreMenuDropdown = document.getElementById('more-menu-dropdown')
  
  if (reduceClutter) {
    if (undoBtn) undoBtn.style.display = 'none'
    if (redoBtn) redoBtn.style.display = 'none'
    if (hideBtn) hideBtn.style.display = 'none'
    if (menuBtn) menuBtn.style.display = 'none'
    
    if (moreMenuBtn) moreMenuBtn.style.display = 'flex'
  } else {
    if (undoBtn) undoBtn.style.display = 'flex'
    if (redoBtn) redoBtn.style.display = 'flex'
    if (hideBtn) hideBtn.style.display = 'flex'
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

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  updateReduceClutter()
  initMoreMenu()
} else {
  document.addEventListener('DOMContentLoaded', () => {
    updateReduceClutter()
    initMoreMenu()
  })
}

ipcRenderer.on('reduce-clutter-changed', (event, enabled) => {
  localStorage.setItem('reduce-clutter', enabled ? 'true' : 'false')
  updateReduceClutter()
})

ipcRenderer.on('theme-changed', (event, theme) => {
  applyTheme(theme)
  updateToolbarBackgroundColor()
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

ipcRenderer.on('layout-changed', (event, layout) => {
  applyLayout(layout)
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

let osTheme = 'dark'

function getOSTheme() {
  return osTheme
}

function getEffectiveTheme(theme) {
  return theme === 'system' ? getOSTheme() : theme
}

function applyTheme(theme) {
  localStorage.setItem('theme', theme)
  
  const effectiveTheme = getEffectiveTheme(theme)
  document.body.setAttribute('data-theme', effectiveTheme)
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  const themeBtn = document.querySelector(`[data-theme="${theme}"]`)
  if (themeBtn) {
    themeBtn.classList.add('active')
  }
  
  updateToolbarBackgroundColor()
}

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme)
  })
})

ipcRenderer.invoke('get-os-theme').then(theme => {
  osTheme = theme
  const savedTheme = localStorage.getItem('theme') || 'system'
  if (savedTheme === 'system') {
    const effectiveTheme = getEffectiveTheme(savedTheme)
    document.body.setAttribute('data-theme', effectiveTheme)
  }
})

const savedTheme = localStorage.getItem('theme') || 'system'
applyTheme(savedTheme)

ipcRenderer.on('os-theme-changed', (event, effectiveTheme) => {
  osTheme = effectiveTheme
  const currentTheme = localStorage.getItem('theme') || 'system'
  if (currentTheme === 'system') {
    document.body.setAttribute('data-theme', effectiveTheme)
    updateToolbarBackgroundColor()
  }
})

function darkenTintColor(hexColor, theme) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hexColor.slice(i, i + 2), 16))
  const effectiveTheme = theme || document.body.getAttribute('data-theme') || 'dark'
  const isDark = effectiveTheme === 'dark'
  
  const [blendedR, blendedG, blendedB] = isDark
    ? [r, g, b].map(c => Math.floor(30 * 0.7 + (c * 0.25) * 0.3))
    : [r, g, b].map(c => Math.floor(255 * 0.85 + (c + (255 - c) * 0.7) * 0.15))
  
  return `#${[blendedR, blendedG, blendedB].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

function updateToolbarBackgroundColor() {
  const styleEl = document.getElementById('toolbar-bg-override')
  if (styleEl) styleEl.remove()
  
  if (localStorage.getItem('toolbar-accent-bg') === 'true') {
    const tintedBg = darkenTintColor(
      localStorage.getItem('accent-color') || '#3bbbf6',
      getEffectiveTheme(localStorage.getItem('theme') || 'system')
    )
    const el = Object.assign(document.createElement('style'), {
      id: 'toolbar-bg-override',
      textContent: `:root, [data-theme="dark"], [data-theme="light"], body { --toolbar-bg: ${tintedBg} !important; }`
    })
    document.head.appendChild(el)
  }
}

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

function createTooltip(element) {
  const tooltipText = element.getAttribute('data-tooltip')
  const shortcut = element.getAttribute('data-shortcut')
  
  if (!tooltipText) return

  const existingTooltip = element.querySelector('.custom-tooltip')
  if (existingTooltip) {
    existingTooltip.remove()
  }
  
  const tooltip = document.createElement('div')
  tooltip.className = 'custom-tooltip'
  
  const textSpan = document.createElement('span')
  textSpan.className = 'tooltip-text'
  textSpan.textContent = tooltipText
  
  tooltip.appendChild(textSpan)
  
  if (shortcut) {
    const shortcutSpan = document.createElement('span')
    shortcutSpan.className = 'tooltip-shortcut'
    
    let displayShortcut = shortcut

    const parts = displayShortcut.split('+')
    const formattedParts = []
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (part === 'Ctrl' || part === 'Shift' || part === 'Alt' || part === 'Meta' || part === 'Cmd') {
        formattedParts.push(part)
      } else if (part === 'Esc') {
        formattedParts.push('Esc')
      } else if (part.includes('-')) {
        
        formattedParts.push(part.replace('-', ' - '))
      } else if (part.length === 1) {
        
        formattedParts.push(part.toUpperCase())
      } else {
        
        formattedParts.push(part)
      }
    }

    displayShortcut = formattedParts.join(' + ')
    
    shortcutSpan.textContent = displayShortcut
    tooltip.appendChild(shortcutSpan)
  }
  
  element.appendChild(tooltip)
  
  let showTimeout
  let hideTimeout
  
  element.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout)
    showTimeout = setTimeout(() => {
      tooltip.classList.add('show')
    }, 300) 
  })
  
  element.addEventListener('mouseleave', () => {
    clearTimeout(showTimeout)
    tooltip.classList.remove('show')
  })
}

document.addEventListener('DOMContentLoaded', () => {
  
  setTimeout(() => {
    document.querySelectorAll('[data-tooltip]').forEach(createTooltip)
  }, 100)
})

setTimeout(() => {
  document.querySelectorAll('[data-tooltip]').forEach(createTooltip)
}, 500)

document.addEventListener('click', (e) => {
  if (e.target.closest('.stroke-popup, .drawing-tools-popup, .shapes-popup, .custom-color-popup')) {
    setTimeout(() => {
      document.querySelectorAll('.stroke-popup [data-tooltip], .drawing-tools-popup [data-tooltip], .shapes-popup [data-tooltip], .custom-color-popup [data-tooltip]').forEach(createTooltip)
    }, 50)
  }
})

let canvasVisible = true
const hideBtn = document.getElementById('hide-btn')
if (hideBtn) {
  hideBtn.addEventListener('click', () => {
    canvasVisible = !canvasVisible
    canvas.style.opacity = canvasVisible ? '1' : '0'
    canvas.style.pointerEvents = canvasVisible ? 'auto' : 'none'
    
    const icon = document.querySelector('#hide-btn .material-symbols-outlined')
    const moreIcon = document.querySelector('#more-hide-btn .material-symbols-outlined')
    if (icon) icon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    if (moreIcon) moreIcon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
  })
}

let toolbarWasVisible = false

function triggerCapture() {
  try {
    const toolbar = document.getElementById('main-toolbar')
    toolbarWasVisible = toolbar && toolbar.style.display !== 'none'
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = 'none'
    }

    state.enabled = false
    canvas.style.pointerEvents = 'none'

    ipcRenderer.invoke('open-capture-overlay').catch((error) => {
      console.error('Error opening capture overlay:', error)
      alert('Failed to open capture overlay. Please try again.')
      const toolbar = document.getElementById('main-toolbar')
      if (toolbar && toolbarWasVisible) {
        toolbar.style.display = ''
      }
      state.enabled = true
      canvas.style.pointerEvents = 'auto'
    })
  } catch (error) {
    console.error('Error opening capture overlay:', error)
    alert('Failed to open capture overlay. Please try again.')
    const toolbar = document.getElementById('main-toolbar')
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = ''
    }
    state.enabled = true
    canvas.style.pointerEvents = 'auto'
  }
}

document.getElementById('capture-btn').addEventListener('click', triggerCapture)

ipcRenderer.on('trigger-capture', triggerCapture)

ipcRenderer.on('capture-selection-result', (event, desktopDataURL, bounds) => {
  const toolbar = document.getElementById('main-toolbar')
  
  if (!desktopDataURL || !bounds) {
    alert('Failed to capture selection. Please try again.')
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = ''
    }
    toolbarWasVisible = false
    state.enabled = true
    canvas.style.pointerEvents = 'auto'
    return
  }

  if (toolbar && toolbarWasVisible) {
    toolbar.style.display = ''
  }

  playSound('capture')
  
  state.enabled = true
  canvas.style.pointerEvents = 'auto'

  const desktopImg = new Image()
  desktopImg.onload = () => {
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
      console.error('Error processing capture:', error)
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
  toolbarWasVisible = false
  state.enabled = true
  canvas.style.pointerEvents = 'auto'
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
    
    ipcRenderer.send('hide-window')
  })
}

function formatShortcut(keys) {
  return keys.map(k => {
    if (k === 'Control') return 'Ctrl'
    if (k === 'Meta') return 'Cmd'
    return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()
  }).join('+')
}

function parseShortcut(str) {
  return str.split('+').map(k => k.trim())
}

const shortcutInput = document.getElementById('shortcut-input')
const resetShortcutBtn = document.getElementById('reset-shortcut')
let isRecordingShortcut = false
let currentShortcut = localStorage.getItem('shortcut') || 'Control+Shift+D'

const initialKeys = parseShortcut(currentShortcut)
shortcutInput.value = formatShortcut(initialKeys)

shortcutInput.addEventListener('click', () => {
  if (isRecordingShortcut) return
  
  isRecordingShortcut = true
  shortcutInput.classList.add('recording')
  shortcutInput.value = 'Press keys...'
  shortcutInput.placeholder = 'Press keys...'
})

document.addEventListener('keydown', (e) => {
  if (!isRecordingShortcut) return
  
  e.preventDefault()
  e.stopPropagation()
  
  const keys = []
  if (e.ctrlKey) keys.push('Control')
  if (e.metaKey) keys.push('Meta')
  if (e.altKey) keys.push('Alt')
  if (e.shiftKey) keys.push('Shift')
  
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
    keys.push(e.key)
    
    const shortcutStr = keys.join('+')
    currentShortcut = shortcutStr
    shortcutInput.value = formatShortcut(keys)
    shortcutInput.classList.remove('recording')
    isRecordingShortcut = false
    localStorage.setItem('shortcut', shortcutStr)
    
    ipcRenderer.send('update-shortcut', shortcutStr)
  }
})

resetShortcutBtn.addEventListener('click', () => {
  currentShortcut = 'Control+Shift+D'
  shortcutInput.value = 'Ctrl+Shift+D'
  localStorage.setItem('shortcut', 'Control+Shift+D')
  ipcRenderer.send('update-shortcut', 'Control+Shift+D')
})

function toggleSearch() {
  const searchOverlay = document.getElementById('search-overlay')
  const searchInput = document.getElementById('search-input')
  
  if (!searchOverlay || !searchInput) return
  
  if (searchOverlay.style.display === 'none' || !searchOverlay.style.display) {
    searchOverlay.style.display = 'flex'
    setTimeout(() => {
      searchInput.focus()
    }, 100)
  } else {
    closeSearch()
  }
}

function closeSearch() {
  const searchOverlay = document.getElementById('search-overlay')
  const searchInput = document.getElementById('search-input')
  
  if (searchOverlay) {
    searchOverlay.style.display = 'none'
  }
  if (searchInput) {
    searchInput.value = ''
  }
}

const searchInput = document.getElementById('search-input')
const closeSearchBtn = document.getElementById('close-search')

if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch()
    }
  })
}

if (closeSearchBtn) {
  closeSearchBtn.addEventListener('click', closeSearch)
}

ipcRenderer.on('clear', clearCanvas)
ipcRenderer.on('draw-mode', (_, enabled) => {
  if (enabled) {
    setTimeout(() => playSound('pop'), 200)
  }
  state.enabled = enabled
  canvas.style.pointerEvents = enabled ? 'auto' : 'none'
})