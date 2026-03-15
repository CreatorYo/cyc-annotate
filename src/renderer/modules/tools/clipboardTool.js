const { ipcRenderer, clipboard } = require('electron')
const CanvasManager = require('../core/CanvasManager.js')

const DUPLICATE_WARNING_THRESHOLD = 10
const _imageCache = new Map()

function copySelectedElements(state, playSound) {
  if (state.selectedElements.length === 0) return
  
  const elementsToCopy = state.elements.filter(e => state.selectedElements.includes(e.id))
  if (elementsToCopy.length > 0) {
    state.copiedElements = JSON.parse(JSON.stringify(elementsToCopy))
    playSound('copy')
  }
}

async function pasteElements(state, redrawCanvas, saveState, playSound) {
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
    } else if (newElement.type === 'image') {
      newElement.x += offsetX
      newElement.y += offsetY
    } else if (newElement.type === 'stickyNote') {
      newElement.x += offsetX
      newElement.y += offsetY
    }
    
    newElement._dirty = true
    
    if (newElement.type === 'image' && newElement.src) {
      const htmlImg = new Image()
      htmlImg.src = newElement.src
      _imageCache.set(newElement.id, htmlImg)
    }
    
    state.elements.push(newElement)
    state.selectedElements.push(newElement.id)
  })
  
  const imgPromises = state.selectedElements
    .map(id => _imageCache.get(id))
    .filter(img => img && !img.complete)
    .map(img => new Promise(r => img.addEventListener('load', r, { once: true })))
  
  if (imgPromises.length > 0) {
    await Promise.all(imgPromises)
  }
  
  redrawCanvas()
  saveState()
  playSound('paste')
}

async function pasteImageFromClipboard(state, redrawCanvas, saveState, playSound) {
  const img = clipboard.readImage()
  if (img.isEmpty()) return false

  const dataURL = img.toDataURL()
  const size = img.getSize()
  if (!size.width || !size.height) return false

  const canvas = CanvasManager.getCanvas()
  const maxW = canvas.width * 0.6
  const maxH = canvas.height * 0.6
  let w = size.width
  let h = size.height

  if (w > maxW || h > maxH) {
    const scale = Math.min(maxW / w, maxH / h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const x = (canvas.width / 2 - w / 2) - state.panX
  const y = (canvas.height / 2 - h / 2) - state.panY

  const element = {
    id: state.nextElementId++,
    type: 'image',
    x, y,
    width: w,
    height: h,
    src: dataURL,
    createdAt: Date.now(),
    _dirty: true
  }

  const htmlImg = new Image()
  htmlImg.src = dataURL
  _imageCache.set(element.id, htmlImg)

  state.elements.push(element)
  state.hasDrawn = true
  state.selectedElements = [element.id]

  if (!htmlImg.complete) {
    await new Promise(r => htmlImg.addEventListener('load', r, { once: true }))
  }
  redrawCanvas()
  saveState()
  playSound('paste')
  return true
}

function getImageCache() {
  return _imageCache
}

module.exports = {
  copySelectedElements,
  pasteElements,
  pasteImageFromClipboard,
  getImageCache
}