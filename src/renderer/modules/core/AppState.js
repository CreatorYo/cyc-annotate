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
  initialStateSaved: false,
  maxHistorySize: 50,
  _historyListener: null,
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

function setHistoryListener(cb) {
  state._historyListener = cb
}

function notifyHistoryChange() {
  if (state._historyListener) state._historyListener()
}

function cloneElements(elements) {
  const result = new Array(elements.length)
  for (let i = 0, len = elements.length; i < len; i++) {
    const el = elements[i]
    if (!el) continue
    const clone = { ...el }
    
    // Deep clone points array
    if (el.points) {
      const pLen = el.points.length
      const pClone = new Array(pLen)
      for (let j = 0; j < pLen; j++) {
        pClone[j] = { x: el.points[j].x, y: el.points[j].y }
      }
      clone.points = pClone
    }
    
    // Clone coordinate objects
    if (el.start) clone.start = { x: el.start.x, y: el.start.y }
    if (el.end) clone.end = { x: el.end.x, y: el.end.y }
    if (el.x1 != null) clone.x1 = el.x1
    if (el.y1 != null) clone.y1 = el.y1
    if (el.x2 != null) clone.x2 = el.x2
    if (el.y2 != null) clone.y2 = el.y2
    if (el.x != null) clone.x = el.x
    if (el.y != null) clone.y = el.y
    if (el.width != null) clone.width = el.width
    if (el.height != null) clone.height = el.height
    
    // Deep clone text segments
    if (el.segments) {
      clone.segments = el.segments.map(s => ({
        text: s.text,
        formatting: s.formatting ? { ...s.formatting } : undefined
      }))
    }
    
    // Clean up temporary rendering flags
    delete clone._dirty
    delete clone._initialPoints
    delete clone._initialStart
    delete clone._initialEnd
    delete clone._initialPos
    delete clone._initialFontSize
    delete clone._initialBounds
    delete clone._initialSize
    delete clone._baseRotation
    
    result[i] = clone
  }
  return result
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
  // Ensure initial empty state is saved if history is empty
  if (!state.initialStateSaved || state.history.length === 0) {
    state.history = [{
      elements: [], // Initial state is truly empty
      nextElementId: 1
    }]
    state.historyIndex = 0
    state.initialStateSaved = true
  }

  // If we've undone and then perform a new action, truncate the redo history
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }

  const elementState = {
    elements: cloneElements(state.elements),
    nextElementId: state.nextElementId
  }

  state.history.push(elementState)
  state.historyIndex++

  // Handle max history size
  if (state.history.length > state.maxHistorySize) {
    state.history.shift()
    state.historyIndex--
  }

  if (updateUndoRedoCallback) {
    updateUndoRedoCallback()
  }
  
  notifyHistoryChange()
  state.saveStatus = 'unsaved'
  if (state.triggerInstantSave) state.triggerInstantSave()
}

function undo(redrawCallback, updateUndoRedoCallback) {
  if (state.historyIndex > 0) {
    state.historyIndex--
    const historyState = state.history[state.historyIndex]
    state.elements = cloneElements(historyState.elements)
    state.nextElementId = historyState.nextElementId
    state.selectedElements = []
    
    if (redrawCallback) redrawCallback()
    if (updateUndoRedoCallback) updateUndoRedoCallback()
    
    notifyHistoryChange()
    state.saveStatus = 'unsaved'
    if (state.triggerInstantSave) state.triggerInstantSave()
  }
}

function redo(redrawCallback, updateUndoRedoCallback) {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++
    const historyState = state.history[state.historyIndex]
    state.elements = cloneElements(historyState.elements)
    state.nextElementId = historyState.nextElementId
    state.selectedElements = []
    
    if (redrawCallback) redrawCallback()
    if (updateUndoRedoCallback) updateUndoRedoCallback()
    
    notifyHistoryChange()
    state.saveStatus = 'unsaved'
    if (state.triggerInstantSave) state.triggerInstantSave()
  }
}

function initHistory(updateUndoRedoCallback) {
  if (state.history.length === 0) {
    const elementState = {
      elements: cloneElements(state.elements),
      nextElementId: state.nextElementId
    }
    state.history.push(elementState)
    state.historyIndex = 0
    state.initialStateSaved = true
    if (updateUndoRedoCallback) updateUndoRedoCallback()
    notifyHistoryChange()
  } else if (updateUndoRedoCallback) {
    updateUndoRedoCallback()
  }
}

module.exports = {
  state,
  createElement,
  saveState,
  undo,
  redo,
  initHistory,
  setHistoryListener,
  cloneElements
}