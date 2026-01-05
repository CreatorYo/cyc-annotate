const { ipcRenderer } = require('electron')

const DUPLICATE_WARNING_THRESHOLD = 10

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
    }
    
    state.elements.push(newElement)
    state.selectedElements.push(newElement.id)
  })
  
  redrawCanvas()
  saveState()
  playSound('paste')
}

module.exports = {
  copySelectedElements,
  pasteElements
}