const { state, saveState, undo, redo, initHistory, setHistoryListener } = require('./AppState.js')

let _selectTool = null
let _redrawCanvas = null
let _checkIfHasDrawn = null
let _playSound = null
let _canvas = null
let _ctx = null

function init(deps) {
  _selectTool = deps.selectTool
  _redrawCanvas = deps.redrawCanvas
  _playSound = deps.playSound
  _canvas = deps.canvas
  _ctx = deps.ctx
  
  setHistoryListener(updateUndoRedoButtons)
  
  initHistory(updateUndoRedoButtons)
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn')
  const redoBtn = document.getElementById('redo-btn')
  const moreUndoBtn = document.getElementById('more-undo-btn')
  const moreRedoBtn = document.getElementById('more-redo-btn')
  
  const canUndo = state.historyIndex > 0 && state.history.length > 0
  const canRedo = state.historyIndex < state.history.length - 1
  
  if (undoBtn) {
    undoBtn.classList.toggle('disabled', !canUndo)
  }
  
  if (redoBtn) {
    redoBtn.classList.toggle('disabled', !canRedo)
  }
  
  if (moreUndoBtn) {
    moreUndoBtn.classList.toggle('disabled', !canUndo)
  }
  
  if (moreRedoBtn) {
    moreRedoBtn.classList.toggle('disabled', !canRedo)
  }
}

function handleUndo() {
  if (state.historyIndex > 0) {
    undo(
      () => { 
        _selectTool.clearSelection()
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height)
        _redrawCanvas()
        checkIfHasDrawn()
        _playSound('undo')
      },
      updateUndoRedoButtons
    )
  }
}

function handleRedo() {
  if (state.historyIndex < state.history.length - 1) {
    redo(
      () => {
        _selectTool.clearSelection()
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height)
        _redrawCanvas()
        checkIfHasDrawn()
        _playSound('redo')
      },
      updateUndoRedoButtons
    )
  }
}

function checkIfHasDrawn() {
  state.hasDrawn = state.elements.length > 0
}

function doSaveState() {
  saveState(updateUndoRedoButtons)
}

function clearCanvas(closeAllPopups) {
  if (closeAllPopups) closeAllPopups()
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height)
  
  state.elements = []
  state.selectedElements = []
  state.hasDrawn = false
  
  saveState(updateUndoRedoButtons)
  
  _redrawCanvas()
  
  setTimeout(() => {
    _playSound?.('trash')
  }, 10)
}

module.exports = {
  init,
  updateUndoRedoButtons,
  handleUndo,
  handleRedo,
  checkIfHasDrawn,
  doSaveState,
  clearCanvas
}
