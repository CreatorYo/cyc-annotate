const state = { 
  drawing: false,
  enabled: true,
  standbyMode: false,
  toolBeforeStandby: null,
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
  shapeEnd: null,
  shapeFillEnabled: false,
  elements: [],
  selectedElements: [],
  nextElementId: 1,
  isSelecting: false,
  selectionStart: null,
  selectionEnd: null,
  isDraggingSelection: false,
  dragOffset: null,
  isResizing: false,
  isRotating: false,
  resizeHandle: null,
  resizeStartBounds: null,
  hoveredElementId: null,
  copiedElements: null,
  rotationStartAngle: 0,
  initialRotation: 0,
  editingElementId: null,
  snapToObjectsEnabled: localStorage.getItem('snap-to-objects-enabled') === 'true',
  elementEraserEnabled: localStorage.getItem('element-eraser-enabled') !== 'false',
  stickyNoteInToolbar: localStorage.getItem('sticky-note-in-toolbar') === 'true',
  gridEnabled: false,
  gridSize: 50,
  timerEnabled: false,
  clockEnabled: false,
  whiteboardPageColor: localStorage.getItem('last-wb-page-color') || '#fffacd',
  whiteboardGridMode: 'none',
  pickingWhiteboardColor: false,
  currentBoardId: null,
  currentBoardTitle: 'Untitled Whiteboard',
  saveStatus: 'saved',
  panX: 0,
  panY: 0,
  isPanning: false,
  isSpacePressed: false
}

function createElement(type, data) {
  const element = {
    id: state.nextElementId++,
    type: type,
    ...data,
    createdAt: Date.now(),
    _dirty: true
  }
  state.elements.push(element)
  return element
}

function saveState(updateUndoRedoCallback) {
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }

  const elementState = {
    elements: structuredClone(state.elements),
    nextElementId: state.nextElementId
  }
  state.history.push(elementState)
  state.historyIndex++

  if (state.history.length > state.maxHistorySize) {
    state.history.shift()
    state.historyIndex--
  }
  
  if (updateUndoRedoCallback) {
    updateUndoRedoCallback()
  }
  state.saveStatus = 'unsaved'
  if (state.triggerInstantSave) state.triggerInstantSave()
}

function undo(redrawCallback, updateUndoRedoCallback) {
  if (state.historyIndex > 0) {
    state.historyIndex--
    const historyState = state.history[state.historyIndex]
    state.elements = structuredClone(historyState.elements)
    state.nextElementId = historyState.nextElementId
    state.selectedElements = []
    if (redrawCallback) redrawCallback()
    if (updateUndoRedoCallback) updateUndoRedoCallback()
    state.saveStatus = 'unsaved'
    if (state.triggerInstantSave) state.triggerInstantSave()
  }
}

function redo(redrawCallback, updateUndoRedoCallback) {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++
    const historyState = state.history[state.historyIndex]
    state.elements = structuredClone(historyState.elements)
    state.nextElementId = historyState.nextElementId
    state.selectedElements = []
    if (redrawCallback) redrawCallback()
    if (updateUndoRedoCallback) updateUndoRedoCallback()
    state.saveStatus = 'unsaved'
    if (state.triggerInstantSave) state.triggerInstantSave()
  }
}

module.exports = {
  state,
  createElement,
  saveState,
  undo,
  redo
}