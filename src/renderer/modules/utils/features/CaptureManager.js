const { ipcRenderer } = require('electron')
const CanvasManager = require('../../core/CanvasManager.js')
const { state } = require('../../core/AppState.js')

let _standbyManager = null
let _playSound = null

let toolbarWasVisible = false
let standbyWasActive = false
let commandMenuWasVisible = false

function init(deps) {
  _standbyManager = deps.standbyManager
  _playSound = deps.playSound

  const captureBtn = document.getElementById('capture-btn')
  if (captureBtn) {
    captureBtn.addEventListener('click', triggerCapture)
  }

  ipcRenderer.on('trigger-capture', triggerCapture)
  ipcRenderer.on('capture-cancelled', restoreCaptureState)
  ipcRenderer.on('capture-selection-result', handleCaptureResult)
}

function restoreCaptureState() {
  const canvas = CanvasManager.getCanvas()
  const toolbar = document.getElementById('main-toolbar')
  if (toolbar && toolbarWasVisible) {
    toolbar.style.display = ''
  }

  if (standbyWasActive) {
    _standbyManager.resume()
  }

  if (commandMenuWasVisible && window.commandMenu) {
    window.commandMenu.toggleCommandMenu()
    commandMenuWasVisible = false
  }

  state.enabled = true
  canvas.style.pointerEvents = standbyWasActive ? 'none' : 'auto'
  
  toolbarWasVisible = false
  standbyWasActive = false
}

async function triggerCapture() {
  const canvas = CanvasManager.getCanvas()
  try {
    const toolbar = document.getElementById('main-toolbar')
    toolbarWasVisible = toolbar && toolbar.style.display !== 'none'
    standbyWasActive = state.standbyMode
    if (toolbar && toolbarWasVisible) {
      toolbar.style.display = 'none'
    }

    const commandMenuOverlay = document.getElementById('command-menu-overlay')
    commandMenuWasVisible = commandMenuOverlay && (commandMenuOverlay.style.display === 'flex' || commandMenuOverlay.classList.contains('show'))
    
    if (commandMenuWasVisible && window.commandMenu) {
      window.commandMenu.closeCommandMenu()
    }

    state.enabled = false
    canvas.style.pointerEvents = 'none'
    
    if (standbyWasActive) {
      _standbyManager.pause()
    }

    ipcRenderer.invoke('open-capture-overlay').catch(async (error) => {
      await ipcRenderer.invoke('show-error-dialog', 'Capture Error', 'Failed to open capture overlay', error.message || 'Please try again.')
      restoreCaptureState()
    })
  } catch (error) {
    await ipcRenderer.invoke('show-error-dialog', 'Capture Error', 'Failed to open capture overlay', error.message || 'Please try again.')
    restoreCaptureState()
  }
}

function handleCaptureResult(event, desktopDataURL, bounds) {
  const canvas = CanvasManager.getCanvas()
  
  if (!desktopDataURL || !bounds) {
    alert('Failed to capture selection. Please try again.')
    return
  }

  restoreCaptureState(false)

  _playSound('capture')

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
        tempCanvas.width = 0
        tempCanvas.height = 0
        sourceCanvas.width = 0
        sourceCanvas.height = 0
        ipcRenderer.send('save-screenshot', dataURL, `annotation-${Date.now()}.png`)
      }
      annotationImage.onerror = () => {
        restoreCaptureState()
      }
      annotationImage.src = annotationImg
    } catch (error) {
      await ipcRenderer.invoke('show-error-dialog', 'Processing Error', 'Error processing capture', error.message)
      restoreCaptureState()
    }
  }
  desktopImg.onerror = () => {
    alert('Failed to load desktop screenshot. Please try again.')
    restoreCaptureState()
  }
  desktopImg.src = desktopDataURL
}

module.exports = {
  init,
  triggerCapture,
  restoreCaptureState
}
