const { ipcRenderer } = require('electron')
const { DEFAULT_ACCENT_COLOR, DEFAULT_SHORTCUT } = require('../../shared/constants.js')
const { applyTheme, updateAccentColor, updateToolbarBackgroundColor } = require('./ThemeManager.js')

async function resetEverything() {
  const confirmed = await ipcRenderer.invoke('show-reset-confirmation')
  if (confirmed) {
    
    localStorage.clear()

    const defaultTheme = 'system'
    const defaultAccentColor = DEFAULT_ACCENT_COLOR
    const defaultLayout = 'vertical'
    const defaultVerticalPosition = 'left'
    const defaultHorizontalPosition = 'bottom'
    const defaultShortcut = DEFAULT_SHORTCUT
    const defaultSounds = true

    applyTheme(defaultTheme)
    updateAccentColor(defaultAccentColor)
    
    if (window.applyLayout) window.applyLayout(defaultLayout)
    if (window.applyPosition) {
      window.applyPosition('vertical', defaultVerticalPosition)
      window.applyPosition('horizontal', defaultHorizontalPosition)
    }

    const shortcutInput = document.getElementById('shortcut-input')
    if (shortcutInput) shortcutInput.value = 'Ctrl+Shift+D'
    localStorage.setItem('shortcut', defaultShortcut)
    ipcRenderer.send('update-shortcut', defaultShortcut)

    resetCheckbox('sounds-enabled', defaultSounds, 'sounds-changed')
    resetCheckbox('text-solve-enabled', false)
    resetCheckbox('snap-to-objects-enabled', false, 'snap-to-objects-changed')
    resetCheckbox('show-tray-icon', true, 'toggle-tray-icon')
    resetCheckbox('launch-on-startup', false, 'set-auto-launch')
    resetCheckbox('screenshot-notification', true, 'screenshot-notification-changed')
    resetCheckbox('copy-snapshot-clipboard', false, 'copy-snapshot-clipboard-changed')
    resetCheckbox('reduce-clutter', true, 'reduce-clutter-changed') 
    
    resetCheckbox('auto-save-snapshots', false, 'auto-save-snapshots-changed')
    const saveDirectoryWrapper = document.getElementById('save-directory-wrapper')
    if (saveDirectoryWrapper) saveDirectoryWrapper.style.display = 'none'
    localStorage.removeItem('save-directory-path')
    ipcRenderer.send('save-directory-changed', null)
    
    const saveDirectoryPath = document.getElementById('save-directory-path')
    if (saveDirectoryPath) {
      saveDirectoryPath.textContent = 'No directory selected'
      saveDirectoryPath.classList.remove('has-directory')
    }

    resetCheckbox('toolbar-accent-bg-enabled', false)
    updateToolbarBackgroundColor()

    resetCheckbox('disable-toolbar-moving', true, 'disable-toolbar-moving-changed')
    resetCheckbox('standby-in-toolbar', false, 'standby-in-toolbar-changed')
    
    localStorage.setItem('sync-windows-accent', 'false')
    ipcRenderer.send('toggle-windows-accent-sync', false)
    
    resetCheckbox('optimized-rendering', false, 'optimized-rendering-changed')
    resetCheckbox('hardware-acceleration', false, 'hardware-acceleration-changed')

    localStorage.removeItem('toolbar-x')
    localStorage.removeItem('toolbar-y')

    ipcRenderer.send('reset-everything')
    ipcRenderer.send('reset-all-dismissed-dialogs')
    
    await ipcRenderer.invoke('show-settings-reset-dialog')
  }
}

function resetCheckbox(id, value, ipcChannel = null) {
  const checkbox = document.getElementById(id)
  if (checkbox) {
    checkbox.checked = value
    localStorage.setItem(id.replace('-enabled', ''), value)
    
    let storageKey = id
    if (id === 'reduce-clutter-enabled') storageKey = 'reduce-clutter'
    if (id === 'toolbar-accent-bg-enabled') storageKey = 'toolbar-accent-bg'
    
    localStorage.setItem(storageKey, value)
    
    if (ipcChannel) {
      ipcRenderer.send(ipcChannel, value)
    }
  }
}

module.exports = {
  resetEverything
}