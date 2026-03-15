const { state } = require('../core/AppState.js')

let _handleUndo = null
let _handleRedo = null
let _hideAllTooltips = null
let _closeAllPopups = null
let _setTool = null

function init(deps) {
  _handleUndo = deps.handleUndo
  _handleRedo = deps.handleRedo
  _hideAllTooltips = deps.hideAllTooltips
  _closeAllPopups = deps.closeAllPopups
  _setTool = deps.setTool
  initMoreMenu()
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
    _hideAllTooltips()
    const isVisible = moreMenuDropdown.classList.contains('show')
    if (isVisible) {
      moreMenuDropdown.classList.remove('show')
    } else {
      _closeAllPopups()
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
      if (moreUndoBtn.classList.contains('disabled')) return
      _handleUndo()
      moreMenuDropdown.classList.remove('show')
    })
  }
  
  if (moreRedoBtn) {
    moreRedoBtn.addEventListener('click', () => {
      if (moreRedoBtn.classList.contains('disabled')) return
      _handleRedo()
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

  const moreStickyNoteBtn = document.getElementById('more-sticky-note-btn')
  if (moreStickyNoteBtn) {
    moreStickyNoteBtn.addEventListener('click', () => {
      if (moreStickyNoteBtn.classList.contains('disabled')) return
      _setTool('sticky-note')
      moreMenuDropdown.classList.remove('show')
    })
  }
}

module.exports = {
  init
}
