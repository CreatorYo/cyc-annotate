const { ipcRenderer } = require('electron') 
const { initSelectTool } = require('../modules/tools/selectTool.js')
const { initTextTool } = require('../modules/tools/textTool.js')
const { initStickyNoteTool } = require('../modules/tools/stickyNoteTool.js')
const { initColorPickerTool } = require('../modules/tools/colorPicker.js')
const { initCommandMenu } = require('../modules/tools/commandMenu.js')
const { initThemeManager, applyTheme } = require('../modules/utils/managers/themeManager.js')
const { initTooltips, hideAllTooltips } = require('../modules/utils/managers/tooltipManager.js')
const { initAudioContext, playSound } = require('../modules/utils/audio/soundEffects.js')
const { initStandbyManager } = require('../modules/utils/managers/standbyManager.js')
const { initShortcutManager } = require('../modules/utils/events/shortcutManager.js')
const ToolbarPositionManager = require('../modules/utils/managers/toolbarPositionManager')
const { initWindowControls } = require('../../shared/window-controls.js')
const WidgetComponent = require('../modules/components/WidgetComponent.js')
const CanvasManager = require('../modules/core/CanvasManager.js')
const { state, createElement, saveState } = require('../modules/core/AppState.js')
const { init: initInputHandler, updateCursor } = require('../modules/input/InputHandler.js')
const { getElementBounds, hitTest, findElementAt } = require('../modules/utils/drawings/CollisionUtils.js')
const { copySelectedElements, pasteElements, pasteImageFromClipboard } = require('../modules/tools/clipboardTool.js')
const { drawGrid } = require('../modules/core/GridRenderer.js')
const CanvasRenderer = require('../modules/core/CanvasRenderer.js')
const HistoryManager = require('../modules/core/HistoryManager.js')
const ToolbarController = require('../modules/ui/ToolbarController.js')
const MoreMenu = require('../modules/ui/MoreMenu.js')
const FeaturesShelf = require('../modules/ui/FeaturesShelf.js')
const CaptureManager = require('../modules/utils/features/CaptureManager.js')
const SettingsSync = require('../modules/utils/events/SettingsSync.js')

const isWhiteboard = window.location.pathname.includes('whiteboard.html')

WidgetComponent.init()
CanvasManager.init(() => CanvasRenderer.redrawCanvas())
const canvas = CanvasManager.getCanvas()
const ctx = CanvasManager.getCtx()

document.addEventListener('click', initAudioContext, { once: true })
document.addEventListener('mousedown', initAudioContext, { once: true })

window.drawGridOnBuffer = (targetCtx) => drawGrid(targetCtx)

const selectTool = initSelectTool(state, ctx, canvas, {
  getElementBounds,
  hitTest,
  findElementAt,
  redrawCanvas: () => CanvasRenderer.redrawCanvas(),
  updateSelectionOnly: () => CanvasRenderer.updateSelectionOnly(),
  saveState: () => HistoryManager.doSaveState(),
  playSound: (type) => playSound(type),
  getToolbarPositionManager: () => toolbarPositionManager
})

const textTool = initTextTool(state, canvas, {
  createElement,
  redrawCanvas: () => CanvasRenderer.redrawCanvas(),
  saveState: () => HistoryManager.doSaveState(),
  updateSelectionOnly: () => CanvasRenderer.updateSelectionOnly()
})

const stickyNoteTool = initStickyNoteTool(state, canvas, {
  createElement,
  redrawCanvas: () => CanvasRenderer.redrawCanvas(),
  saveState: () => HistoryManager.doSaveState()
})

const colorTool = initColorPickerTool({
  state,
  selectTool,
  textTool,
  stickyNoteTool,
  playSound,
  hideAllTooltips,
  closeAllPopups: () => ToolbarController.closeAllPopups(),
  redrawCanvas: () => CanvasRenderer.redrawCanvas(),
  saveState: () => HistoryManager.doSaveState()
})
const { setColor, initColorPicker, setInitialColorBorder, isLightColor } = colorTool

CanvasRenderer.init({
  isLightColor,
  selectTool,
  updateShapeFillToggleState: () => ToolbarController.updateShapeFillToggleState()
})

HistoryManager.init({
  selectTool,
  redrawCanvas: () => CanvasRenderer.redrawCanvas(),
  playSound,
  canvas,
  ctx
})

ToolbarController.init({
  textTool,
  stickyNoteTool,
  selectTool,
  updateCursor,
  playSound,
  hideAllTooltips,
  closeAllPopups: () => ToolbarController.closeAllPopups()
})

ToolbarController.onShapeFillChanged(() => {
  CanvasRenderer.redrawCanvas()
  HistoryManager.doSaveState()
})

initInputHandler({
  selectTool,
  textTool,
  stickyNoteTool,
  redrawCanvas: () => CanvasRenderer.redrawCanvas(),
  updateSelectionOnly: () => CanvasRenderer.updateSelectionOnly()
})

setInitialColorBorder()
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initColorPicker, 200) 
  })
} else {
  setTimeout(initColorPicker, 200)
}

const handleCopy = () => copySelectedElements(state, playSound)
const handlePaste = () => pasteElements(state, () => CanvasRenderer.redrawCanvas(), saveState, playSound)
const handlePasteImage = () => pasteImageFromClipboard(state, () => CanvasRenderer.redrawCanvas(), () => HistoryManager.doSaveState(), playSound)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ToolbarController.setTool(state.tool) 
  })
} else {
  ToolbarController.setTool(state.tool) 
}

// Initial history set is now handled in HistoryManager.init
// saveState(HistoryManager.updateUndoRedoButtons)

document.getElementById('clear-btn').addEventListener('click', (e) => {
  e.stopPropagation()
  HistoryManager.clearCanvas(() => ToolbarController.closeAllPopups())
})

document.getElementById('undo-btn').addEventListener('click', () => HistoryManager.handleUndo())
document.getElementById('redo-btn').addEventListener('click', () => HistoryManager.handleRedo())

HistoryManager.updateUndoRedoButtons()

const mainToolbar = document.getElementById('main-toolbar')
let toolbarPositionManager

if (mainToolbar) {
  const storagePrefix = isWhiteboard ? 'wb-toolbar' : 'toolbar'
  const savedLayout = localStorage.getItem(`${storagePrefix}-layout`) || 'vertical'
  const savedVerticalPosition = localStorage.getItem('toolbar-position-vertical') || 'left'
  const savedHorizontalPosition = localStorage.getItem('toolbar-position-horizontal') || 'bottom'
  
  toolbarPositionManager = new ToolbarPositionManager(mainToolbar, {
    layout: savedLayout,
    verticalPosition: savedVerticalPosition,
    horizontalPosition: savedHorizontalPosition
  })
  
  mainToolbar.addEventListener('mousedown', (e) => {
    ipcRenderer.send('focus-window')
    if (state.tool === 'text' && !e.target.closest('#text-input')) {
      e.preventDefault()
    }
  })
}

function updateToolbarMovingState() {
  const toolbarDraggingEnabled = localStorage.getItem('toolbar-dragging-enabled') !== 'false'
  if (toolbarDraggingEnabled) {
    mainToolbar.classList.remove('toolbar-moving-disabled')
  } else {
    mainToolbar.classList.add('toolbar-moving-disabled')
  }
}

updateToolbarMovingState()

ipcRenderer.on('layout-changed', (event, layout) => {
  if (toolbarPositionManager) {
    toolbarPositionManager.setLayout(layout)
  }
})

ipcRenderer.on('vertical-position-changed', (event, position) => {
  if (toolbarPositionManager) {
    toolbarPositionManager.setVerticalPosition(position)
  }
})

ipcRenderer.on('horizontal-position-changed', (event, position) => {
  if (toolbarPositionManager) {
    toolbarPositionManager.setHorizontalPosition(position)
  }
})

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSettings()
} else {
  document.addEventListener('DOMContentLoaded', initSettings)
}

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

window.updateReduceClutter = updateReduceClutter
function updateReduceClutter() {
  const getSetting = (key, def) => {
    const val = localStorage.getItem(key);
    return val === null ? def : val === 'true';
  };

  const config = {
    reduceClutter: getSetting('reduce-clutter', true),
    standbyInToolbar: getSetting('standby-in-toolbar', false),
    isWhiteboard: isWhiteboard,
    stickyInToolbar: state.stickyNoteInToolbar
  };

  const visibilityMap = {
    'undo-btn': !config.reduceClutter,
    'redo-btn': !config.reduceClutter,
    'hide-btn': !config.reduceClutter && !config.isWhiteboard,
    'menu-btn': !config.reduceClutter,
    'more-menu-btn': config.reduceClutter,
    'capture-btn': !config.isWhiteboard,
    'standby-btn': config.reduceClutter 
      ? (config.standbyInToolbar && !config.isWhiteboard)
      : !config.isWhiteboard,
    'more-standby-btn': !config.reduceClutter && !config.isWhiteboard ? false : (config.reduceClutter && !config.standbyInToolbar && !config.isWhiteboard),
    'sticky-note-btn': config.reduceClutter ? config.stickyInToolbar : true,
    'more-sticky-note-btn': config.reduceClutter ? !config.stickyInToolbar : false
  };

  Object.entries(visibilityMap).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? 'flex' : 'none';
  });
}

updateReduceClutter()

initThemeManager()
initTooltips()

let standbyManager
if (!isWhiteboard) {
  standbyManager = initStandbyManager({
    state,
    canvas,
    setTool: (t) => ToolbarController.setTool(t),
    closeAllPopups: () => ToolbarController.closeAllPopups(),
    finishTextInput: () => textTool.finishTextInput(),
    playSound
  })
} else {
  standbyManager = {
    isActive: () => false,
    enable: () => {},
    disable: () => {},
    toggle: () => {},
    pause: () => {},
    resume: () => {},
    updateStandbyButtons: () => {},
    shouldBlockAction: () => false
  }
}

window.commandMenu = initCommandMenu({
  setTool: (t) => ToolbarController.setTool(t),
  setShape: (s) => ToolbarController.setShape(s),
  undo: () => HistoryManager.handleUndo(),
  redo: () => HistoryManager.handleRedo(),
  clearCanvas: () => HistoryManager.clearCanvas(() => ToolbarController.closeAllPopups()),
  standbyManager,
  triggerCapture: () => CaptureManager.triggerCapture(),
  playSound,
  applyTheme
})

const commandMenu = window.commandMenu

initShortcutManager({
  state,
  standbyManager,
  selectTool,
  setTool: (t) => ToolbarController.setTool(t),
  undo: () => HistoryManager.handleUndo(),
  redo: () => HistoryManager.handleRedo(),
  clearCanvas: () => HistoryManager.clearCanvas(() => ToolbarController.closeAllPopups()),
  copySelectedElements: handleCopy,
  pasteElements: handlePaste,
  pasteImageFromClipboard: handlePasteImage,
  toggleCommandMenu: () => commandMenu.toggleCommandMenu(),
  closeCommandMenu: () => commandMenu.closeCommandMenu(),
  setColor,
  setShape: (s) => ToolbarController.setShape(s),
  playSound,
  hideAllTooltips,
  closeAllPopups: () => ToolbarController.closeAllPopups(),
  applyTheme
})

CaptureManager.init({
  standbyManager,
  playSound
})

SettingsSync.init({
  updateReduceClutter,
  initMoreMenu: () => MoreMenu.init({
    handleUndo: () => HistoryManager.handleUndo(),
    handleRedo: () => HistoryManager.handleRedo(),
    hideAllTooltips,
    closeAllPopups: () => ToolbarController.closeAllPopups(),
    setTool: (t) => ToolbarController.setTool(t)
  }),
  initFeaturesShelf: () => FeaturesShelf.init({
    playSound,
    setTool: (t) => ToolbarController.setTool(t)
  }),
  updateToolbarMovingState,
  standbyManager
})

SettingsSync.initSounds()

let canvasVisible = true
const hideBtn = document.getElementById('hide-btn')
if (hideBtn) {
  hideBtn.addEventListener('click', () => {
    canvasVisible = !canvasVisible
    canvas.style.opacity = canvasVisible ? '1' : '0'
    canvas.style.pointerEvents = canvasVisible ? 'auto' : 'none'
    
    const sCanvas = CanvasManager.getSelectionCanvas()
    if (sCanvas) {
      sCanvas.style.opacity = canvasVisible ? '1' : '0'
    }
    const pCanvas = CanvasManager.getPreviewCanvas()
    if (pCanvas) {
      pCanvas.style.opacity = canvasVisible ? '1' : '0'
    }

    const icon = document.querySelector('#hide-btn .material-symbols-outlined')
    const moreIcon = document.querySelector('#more-hide-btn .material-symbols-outlined')
    if (icon) icon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    if (moreIcon) moreIcon.textContent = canvasVisible ? 'visibility_off' : 'visibility'
    
    const soundType = canvasVisible ? 'visibilityOn' : 'visibilityOff'
    playSound(soundType)
  })
}

ipcRenderer.on('close-toolbar-on-esc', () => {
  const closeBtnEl = document.getElementById('close-btn')
  if (closeBtnEl) {
    closeBtnEl.click()
  }
})

const closeBtn = document.getElementById('close-btn')
if (closeBtn) {
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    e.preventDefault()
    
    standbyManager.disable(false)
    
    const isWB = document.body.classList.contains('whiteboard-mode')
    if (isWB) {
      if (state.saveCurrentBoard) {
        await state.saveCurrentBoard()
      }
      ipcRenderer.send('window-close')
    } else {
      ipcRenderer.send('hide-window')
    }
  })
}

ipcRenderer.on('clear', () => HistoryManager.clearCanvas(() => ToolbarController.closeAllPopups()))
ipcRenderer.on('draw-mode', (_, enabled) => {
  if (enabled) {
    initAudioContext()
    setTimeout(() => {
      playSound('pop')
    }, 50)
  }
  state.enabled = enabled
  canvas.style.pointerEvents = enabled ? 'auto' : 'none'
})

ipcRenderer.on('restore-annotations', (_, data) => {
  if (data && data.elements && Array.isArray(data.elements)) {
    state.elements = data.elements.map(el => ({ ...el, _dirty: true }))
    state.nextElementId = data.nextElementId || (data.elements.length + 1)
    state.hasDrawn = data.elements.length > 0
    
    // Set restored elements as the base state (index 0)
    const { cloneElements } = require('../modules/core/AppState.js')
    state.history = [{
      elements: cloneElements(state.elements),
      nextElementId: state.nextElementId
    }]
    state.historyIndex = 0
    state.initialStateSaved = true
    
    CanvasRenderer.redrawCanvas()
    HistoryManager.updateUndoRedoButtons()
  }
})

ipcRenderer.on('screenshot-saved', () => {
})

const { initWhiteboardMode } = require('../modules/utils/features/whiteboardManager.js')

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initWhiteboardMode({
      state,
      redrawCanvas: () => CanvasRenderer.redrawCanvas(),
      initWindowControls,
      updateCursor,
      playSound
    })
  })
} else {
  initWhiteboardMode({
    state,
    redrawCanvas: () => CanvasRenderer.redrawCanvas(),
    initWindowControls,
    updateCursor,
    playSound
  })
}