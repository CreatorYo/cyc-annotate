const { ipcRenderer } = require('electron')
const { DEFAULT_SHORTCUT } = require('../../shared/constants.js')

function formatShortcut(keys) {
  return keys.map(k => {
    if (k === 'Control') return 'Ctrl'
    if (k === 'Meta') return 'Cmd'
    return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()
  }).join('+')
}

function parseShortcut(str) {
  return str.split('+').map(k => k.trim())
}

function updateResetShortcutVisibility() {
  const resetShortcutBtn = document.getElementById('reset-shortcut')
  if (resetShortcutBtn) {
    const savedShortcut = localStorage.getItem('shortcut') || DEFAULT_SHORTCUT
    const isDefault = savedShortcut === DEFAULT_SHORTCUT
    resetShortcutBtn.style.display = isDefault ? 'none' : 'flex'
  }
}

module.exports = {
  formatShortcut,
  parseShortcut,
  updateResetShortcutVisibility
}
