const { ipcRenderer } = require('electron')
const { updateDropdownMenu } = require('./dropdownMenu.js') 

let currentLayout = localStorage.getItem('toolbar-layout') || 'vertical'

function applyLayout(layout) {
  currentLayout = layout
  localStorage.setItem('toolbar-layout', layout)
  
  updateDropdownMenu('layout-dropdown', layout)

  if (window.updatePositionSettingsVisibility) {
    window.updatePositionSettingsVisibility()
  }

  ipcRenderer.send('layout-changed', layout)
}

function getCurrentLayout() {
  return currentLayout
}

function applyPosition(type, position) {
  if (type === 'vertical') {
    localStorage.setItem('toolbar-position-vertical', position)
  } else {
    localStorage.setItem('toolbar-position-horizontal', position)
  }
  
  updateDropdownMenu('position-dropdown', position)

  ipcRenderer.send(`${type}-position-changed`, position)
}

module.exports = {
  applyLayout,
  getCurrentLayout,
  applyPosition
}