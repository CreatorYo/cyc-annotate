let canvas, ctx
let previewCanvas, previewCtx
let selectionCanvas, selectionCtx
let optimizedRendering = false
let hardwareAcceleration = false
let resizeCallback = null

function init(onResize) {
  canvas = document.getElementById('canvas')
  resizeCallback = onResize
  optimizedRendering = localStorage.getItem('optimized-rendering') === 'true'
  hardwareAcceleration = localStorage.getItem('hardware-acceleration') === 'true'

  if (hardwareAcceleration) {
    canvas.style.willChange = 'contents'
    canvas.style.transform = 'translateZ(0)'
    canvas.style.backfaceVisibility = 'hidden'
  }
  
  canvas.style.pointerEvents = 'auto'

  ctx = canvas.getContext('2d', {
    willReadFrequently: !optimizedRendering && !hardwareAcceleration,
    alpha: true
  })

  if (optimizedRendering) {
    ctx.imageSmoothingEnabled = false
    ctx.imageSmoothingQuality = 'low'
  }
  
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  resizeCanvas()
  window.addEventListener('resize', () => {
    resizeCanvas()
    if (resizeCallback) resizeCallback()
  })
}

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
  return { previewCanvas, previewCtx }
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
  return { selectionCanvas, selectionCtx }
}

module.exports = {
  init,
  getCanvas: () => canvas,
  getCtx: () => ctx,
  createPreviewCanvas,
  getPreviewCanvas: () => previewCanvas,
  getPreviewCtx: () => previewCtx,
  createSelectionCanvas,
  getSelectionCanvas: () => selectionCanvas,
  getSelectionCtx: () => selectionCtx,
  isOptimizedRendering: () => optimizedRendering,
  isHardwareAcceleration: () => hardwareAcceleration
}