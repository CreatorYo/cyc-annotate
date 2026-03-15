const { ipcRenderer } = require('electron')
const CanvasManager = require('../../core/CanvasManager.js')
const { state } = require('../../core/AppState.js')
const { updateAccentColor, updateToolbarBackgroundColor } = require('../managers/themeManager.js')

const isWhiteboard = window.location.pathname.includes('whiteboard.html')

let _updateReduceClutter = null
let _initMoreMenu = null
let _initFeaturesShelf = null
let _updateToolbarMovingState = null
let _standbyManager = null

function init(deps) {
  _updateReduceClutter = deps.updateReduceClutter
  _initMoreMenu = deps.initMoreMenu
  _initFeaturesShelf = deps.initFeaturesShelf
  _updateToolbarMovingState = deps.updateToolbarMovingState
  _standbyManager = deps.standbyManager

  bindIpcListeners()
  bindStorageListener()
  bindSettingsBadge()

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    syncSettingsFromMain()
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      syncSettingsFromMain()
    })
  }
}

function syncSettingsFromMain() {
  try {
    const settings = ipcRenderer.sendSync('get-all-settings');
    if (settings) {
      Object.keys(settings).forEach(key => {
        let value = settings[key];
        if (typeof value === 'boolean') value = value.toString();
        localStorage.setItem(key, value);
        
        if (key === 'sticky-note-in-toolbar') state.stickyNoteInToolbar = settings[key];
        if (key === 'snap-to-objects-enabled') state.snapToObjectsEnabled = settings[key];
      });
    }
  } catch (e) {
  }
  _updateReduceClutter()
  _initMoreMenu()
  _initFeaturesShelf()
}

function bindIpcListeners() {
  const canvas = CanvasManager.getCanvas()

  ipcRenderer.on('reduce-clutter-changed', (event, enabled) => {
    localStorage.setItem('reduce-clutter', enabled ? 'true' : 'false')
    setTimeout(() => _updateReduceClutter(), 0)
  })

  ipcRenderer.on('toolbar-dragging-changed', (event, enabled) => {
    localStorage.setItem('toolbar-dragging-enabled', enabled ? 'true' : 'false')
    _updateToolbarMovingState()
  })

  ipcRenderer.on('standby-in-toolbar-changed', (event, enabled) => {
    localStorage.setItem('standby-in-toolbar', enabled ? 'true' : 'false')
    _updateReduceClutter()
    if (_standbyManager) {
      _standbyManager.updateStandbyButtons(enabled)
    }
  })

  ipcRenderer.on('sync-toolbar-settings', (event, settings) => {
    if (!settings) return;
    
    Object.keys(settings).forEach(key => {
      let value = settings[key];
      if (typeof value === 'boolean') value = value.toString();
      localStorage.setItem(key, value);
      
      if (key === 'snap-to-objects-enabled') {
        state.snapToObjectsEnabled = settings[key];
      }
    });

    _updateReduceClutter();
    
    if (_standbyManager) {
      const standbyInToolbar = localStorage.getItem('standby-in-toolbar') === 'true';
      _standbyManager.updateStandbyButtons(standbyInToolbar);
    }
  });

  ipcRenderer.on('hardware-acceleration-changed', (event, enabled) => {
    localStorage.setItem('hardware-acceleration', enabled ? 'true' : 'false')
    const applyHA = (el, on) => {
      if (!el) return
      el.style.willChange = on ? 'contents' : ''
      el.style.transform = on ? 'translateZ(0)' : ''
      el.style.backfaceVisibility = on ? 'hidden' : ''
    }
    applyHA(canvas, enabled)
    applyHA(CanvasManager.getPreviewCanvas(), enabled)
    applyHA(CanvasManager.getSelectionCanvas(), enabled)
  })

  ipcRenderer.on('sounds-changed', (event, enabled) => {
    const soundsCheckbox = document.getElementById('sounds-enabled')
    if (soundsCheckbox) {
      soundsCheckbox.checked = enabled
    }
  })

  ipcRenderer.on('sticky-note-in-toolbar-changed', (event, enabled) => {
    state.stickyNoteInToolbar = enabled
    localStorage.setItem('sticky-note-in-toolbar', enabled ? 'true' : 'false')
    _updateReduceClutter()
  })

  ipcRenderer.on('element-eraser-changed', (event, enabled) => {
    state.elementEraserEnabled = enabled
    localStorage.setItem('element-eraser-enabled', enabled)
  })
}

function bindStorageListener() {
  window.addEventListener('storage', (e) => {
    const isTrue = e.newValue === 'true';
    const isFalse = e.newValue === 'false';
    
    if (e.key === 'snap-to-objects-enabled') {
      state.snapToObjectsEnabled = isTrue;
    }
    if (e.key === 'element-eraser-enabled') {
      state.elementEraserEnabled = !isFalse;
    }
    if (e.key === 'reduce-clutter' || e.key === 'standby-in-toolbar' || e.key === 'sticky-note-in-toolbar') {
      if (e.key === 'sticky-note-in-toolbar') state.stickyNoteInToolbar = isTrue;
      _updateReduceClutter();
    }
    if (e.key === 'accent-color') {
      updateAccentColor(e.newValue);
    }
    if (e.key === 'toolbar-accent-bg') {
      updateToolbarBackgroundColor();
    }
  });
}

function updateSettingsBadge(show) {
  const settingsBadge = document.getElementById('settings-badge')
  const moreSettingsBadge = document.getElementById('more-settings-badge')
  
  if (settingsBadge) {
    settingsBadge.style.display = show ? 'flex' : 'none'
  }
  if (moreSettingsBadge) {
    moreSettingsBadge.style.display = show ? 'flex' : 'none'
  }
}

function checkSettingsBadge() {
  const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
  const saveDirectory = localStorage.getItem('save-directory-path')
  
  if (autoSaveEnabled && saveDirectory) {
    ipcRenderer.invoke('check-directory-exists', saveDirectory).then(exists => {
      updateSettingsBadge(!exists)
    }).catch(err => {
      ipcRenderer.invoke('show-error-dialog', 'Directory Error', 'Failed to check if save directory exists', err.message)
    })
  } else {
    updateSettingsBadge(false)
  }
}

function bindSettingsBadge() {
  ipcRenderer.on('update-settings-badge', (event, show) => {
    updateSettingsBadge(show)
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkSettingsBadge, 500)
    })
  } else {
    setTimeout(checkSettingsBadge, 500)
  }

  setInterval(() => {
    const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
    const saveDirectory = localStorage.getItem('save-directory-path')
    
    if (autoSaveEnabled && saveDirectory) {
      ipcRenderer.invoke('check-directory-exists', saveDirectory).then(exists => {
        updateSettingsBadge(!exists)
      }).catch(err => {
        ipcRenderer.invoke('show-error-dialog', 'Directory Error', 'Failed to check if save directory exists', err.message)
      })
    }
  }, 30000)
}

function initSoundsSetting() {
  const soundsCheckbox = document.getElementById('sounds-enabled')
  if (soundsCheckbox) {
    const soundsEnabled = localStorage.getItem('sounds-enabled')
    if (soundsEnabled !== null) {
      soundsCheckbox.checked = soundsEnabled === 'true'
    }
    
    soundsCheckbox.addEventListener('change', (e) => {
      localStorage.setItem('sounds-enabled', e.target.checked)
    })
  }
}

function initSounds() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSoundsSetting)
  } else {
    initSoundsSetting()
  }
}

module.exports = {
  init,
  initSounds,
  updateSettingsBadge
}