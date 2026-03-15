const { state } = require('../core/AppState.js')

let _textTool = null
let _stickyNoteTool = null
let _selectTool = null
let _updateCursor = null
let _playSound = null
let _hideAllTooltips = null
let _closeAllPopups = null

function init(deps) {
  _textTool = deps.textTool
  _stickyNoteTool = deps.stickyNoteTool
  _selectTool = deps.selectTool
  _updateCursor = deps.updateCursor
  _playSound = deps.playSound
  _hideAllTooltips = deps.hideAllTooltips
  _closeAllPopups = deps.closeAllPopups

  bindToolButtons()
  bindStrokeControls()
  bindShapeFillToggle()
  bindPopupDismissals()
}

function setTool(tool) {
  state.tool = tool

  if (tool !== 'text' && tool !== 'select') {
    const textInput = document.getElementById('text-input')
    if (textInput && textInput.style.display === 'block') {
      _textTool.finishTextInput()
    }
  }

  if (tool !== 'sticky-note' && tool !== 'select') {
    const stickyContainer = document.getElementById('sticky-note-input-container')
    if (stickyContainer && stickyContainer.style.display === 'flex') {
      _stickyNoteTool.finishStickyNoteInput()
    }
  }
  
  if (tool !== 'select') {
    _selectTool.clearSelection()
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
      
      const icon = document.getElementById('pencil-btn')?.querySelector('.material-symbols-outlined')
      if (icon) {
        if (tool === 'select') {
          icon.textContent = 'arrow_selector_tool'
        } else if (tool === 'pencil') {
          icon.textContent = 'edit'
        } else if (tool === 'marker') {
          icon.textContent = 'brush'
        } else if (tool === 'highlighter') {
          icon.textContent = 'ink_highlighter'
        }
      }
    }
  })

  if (tool === 'select' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter') {
    const pencilBtn = document.getElementById('pencil-btn')
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
  
  _updateCursor()
}

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

function setStrokeSize(size) {
  state.strokeSize = size
  
  if (state.selectedElements.length > 0) {
    _selectTool.updateSelectedStrokeSize(size)
  }
  
  document.querySelectorAll('.stroke-option').forEach(btn => {
    btn.classList.remove('active')
  })
  document.querySelector(`.stroke-option[data-size="${size}"]`)?.classList.add('active')
  
  const popup = document.getElementById('stroke-popup')
  if (popup) popup.classList.remove('show')
}

function closeAllPopups() {
  const popups = [
    document.getElementById('stroke-popup'),
    document.getElementById('drawing-tools-popup'),
    document.getElementById('shapes-popup'),
    document.getElementById('custom-color-popup'),
    document.getElementById('more-menu-dropdown'),
    document.getElementById('sticky-note-input-container'),
    document.getElementById('timer-settings-popup'),
    document.getElementById('clock-settings-popup')
  ]
  popups.forEach(popup => {
    if (popup) {
      popup.classList.remove('show')
    }
  })
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
  
  return hasChanges
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
      }
      return
    }
  }
  
  shapeFillToggle.classList.toggle('active', state.shapeFillEnabled)
}

function bindToolButtons() {
  const drawingToolsPopup = document.getElementById('drawing-tools-popup')
  const pencilBtn = document.getElementById('pencil-btn')

  if (pencilBtn) {
    pencilBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      _hideAllTooltips()
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
      _playSound('pop')
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
      _playSound('pop')
    })
  })

  const textBtn = document.getElementById('text-btn')
  if (textBtn) {
    textBtn.addEventListener('click', () => {
      if (state.tool === 'text' && textBtn.classList.contains('active')) {
        setTool('pencil')
      } else {
        setTool('text')
      }
      _playSound('pop')
    })
  }

  const stickyNoteBtn = document.getElementById('sticky-note-btn')
  if (stickyNoteBtn) {
    stickyNoteBtn.addEventListener('click', () => {
      if (state.tool === 'sticky-note' && stickyNoteBtn.classList.contains('active')) {
        setTool('pencil')
      } else {
        setTool('sticky-note')
      }
      _playSound('pop')
    })
  }

  const eraserBtn = document.getElementById('eraser-btn')
  if (eraserBtn) {
    eraserBtn.addEventListener('click', () => {
      setTool('eraser')
      _playSound('pop')
    })
  }

  const shapesBtn = document.getElementById('shapes-btn')
  const shapesPopup = document.getElementById('shapes-popup')

  if (shapesBtn) {
    shapesBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      _hideAllTooltips()
      const wasOpen = shapesPopup.classList.contains('show')
      closeAllPopups()
      if (!wasOpen) {
        shapesPopup.classList.add('show')
      }
    })
  }

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
      if (shapesPopup) shapesPopup.classList.remove('show')
      _playSound('pop')
    })
  })
}

function bindStrokeControls() {
  const strokeThicknessBtn = document.getElementById('stroke-thickness-btn')
  const strokePopup = document.getElementById('stroke-popup')

  if (strokeThicknessBtn) {
    strokeThicknessBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      _hideAllTooltips()
      const wasOpen = strokePopup.classList.contains('show')
      closeAllPopups()
      if (!wasOpen) {
        strokePopup.classList.add('show')
      }
    })
  }

  document.querySelectorAll('.stroke-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      setStrokeSize(parseInt(btn.dataset.size))
      _playSound('pop')
    })
  })

  setStrokeSize(2)
}

function bindShapeFillToggle() {
  const shapeFillToggle = document.getElementById('shape-fill-toggle')
  if (!shapeFillToggle) return

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
        const hasChanges = updateSelectedShapeFill(!currentFillState)
        if (hasChanges && _onShapeFillChanged) {
          _onShapeFillChanged()
        }
        updateShapeFillToggleState()
        return
      }
    }
    
    state.shapeFillEnabled = !state.shapeFillEnabled
    shapeFillToggle.classList.toggle('active', state.shapeFillEnabled)
    localStorage.setItem('shape-fill-enabled', state.shapeFillEnabled.toString())
  })
}

let _onShapeFillChanged = null

function onShapeFillChanged(callback) {
  _onShapeFillChanged = callback
}

function bindPopupDismissals() {
  document.addEventListener('click', (e) => {
    const shapesWrapper = document.querySelector('.shapes-wrapper')
    if (shapesWrapper && !shapesWrapper.contains(e.target)) {
      const shapesPopup = document.getElementById('shapes-popup')
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
      const drawingToolsPopup = document.getElementById('drawing-tools-popup')
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
}

module.exports = {
  init,
  setTool,
  setShape,
  setStrokeSize,
  closeAllPopups,
  updateShapeFillToggleState,
  updateSelectedShapeFill,
  onShapeFillChanged
}
