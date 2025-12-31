const { ipcRenderer } = require('electron')

const DEFAULT_ACCENT_COLOR = '#3bbbf6'
const DEFAULT_SHORTCUT = 'Control+Shift+D'

let osTheme = 'dark'

function getOSTheme() {
  return osTheme
}

function getEffectiveTheme(theme) {
  return theme === 'system' ? getOSTheme() : theme
}

ipcRenderer.invoke('get-os-theme').then(theme => {
  osTheme = theme
  const savedTheme = localStorage.getItem('theme') || 'system'
  if (savedTheme === 'system') {
    const effectiveTheme = getEffectiveTheme(savedTheme)
    document.body.setAttribute('data-theme', effectiveTheme)
  }
})

const savedTheme = localStorage.getItem('theme') || 'system'
const effectiveTheme = getEffectiveTheme(savedTheme)
document.body.setAttribute('data-theme', effectiveTheme)

function applyTheme(theme) {
  localStorage.setItem('theme', theme)
  
  const effectiveTheme = getEffectiveTheme(theme)
  document.body.setAttribute('data-theme', effectiveTheme)

  const themeToggle = document.querySelector('.theme-toggle')
  if (themeToggle) {
    themeToggle.setAttribute('data-active', theme)
  }

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active')
  })

  const themeBtn = document.querySelector(`.theme-btn[data-theme="${theme}"]`)
  if (themeBtn) {
    themeBtn.classList.add('active')
  }

  const isDark = effectiveTheme === 'dark'
  document.querySelectorAll('.theme-btn:not(.active)').forEach(btn => {
    btn.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)'
    const icon = btn.querySelector('.material-symbols-outlined')
    if (icon) {
      icon.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)'
    }
  })

  ipcRenderer.send('theme-changed', theme)
  
  updateToolbarBackgroundColor()
}

ipcRenderer.on('os-theme-changed', (event, effectiveTheme) => {
  osTheme = effectiveTheme
  const currentTheme = localStorage.getItem('theme') || 'system'
  if (currentTheme === 'system') {
    document.body.setAttribute('data-theme', effectiveTheme)
    const savedAccentColor = localStorage.getItem('accent-color') || '#3bbbf6'
    updateAccentColor(savedAccentColor)
    const isDark = effectiveTheme === 'dark'
    document.querySelectorAll('.theme-btn:not(.active)').forEach(btn => {
      btn.style.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)'
      const icon = btn.querySelector('.material-symbols-outlined')
      if (icon) {
        icon.style.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)'
      }
    })
  }
})

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme)
  })
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(savedTheme)
    updateThemeButtonColors()
  })
} else {
  applyTheme(savedTheme)
  updateThemeButtonColors()
}

function isLightColor(color) {
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

function updateToggleSwitchColor() {
  const currentAccentColor = localStorage.getItem('accent-color') || '#3bbbf6'
  const accentIsLight = isLightColor(currentAccentColor)
  
  const style = document.createElement('style')
  style.id = 'toggle-switch-dynamic-color'
  style.textContent = `
    .toggle-switch input[type="checkbox"]:checked + .toggle-label::after {
      background: ${accentIsLight ? '#000000' : '#ffffff'};
    }
  `

  const oldStyle = document.getElementById('toggle-switch-dynamic-color')
  if (oldStyle) {
    oldStyle.remove()
  }
  
  document.head.appendChild(style)
}

function updateButtonTextColor(button) {
  const currentAccentColor = localStorage.getItem('accent-color') || '#3bbbf6'
  const accentIsLight = isLightColor(currentAccentColor)
  const textColor = accentIsLight ? '#000000' : '#ffffff'
  
  button.style.color = textColor
  const icon = button.querySelector('.material-symbols-outlined')
  if (icon) {
    icon.style.color = textColor
  }
}

function updateLayoutButtonColors() {
  document.querySelectorAll('.layout-btn.active').forEach(btn => {
    updateButtonTextColor(btn)
  })
}

function updateThemeButtonColors() {
  document.querySelectorAll('.theme-btn.active').forEach(btn => {
    updateButtonTextColor(btn)
  })
}

updateToggleSwitchColor()

function normalizeHex(hex) {
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  }
  return hex
}

function getColorForPicker(color) {
  let normalized = normalizeHex(color)
  return normalized.length === 9 ? normalized.substring(0, 7) : normalized
}

function darkenTintColor(hexColor, theme) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hexColor.slice(i, i + 2), 16))
  const effectiveTheme = theme || document.body.getAttribute('data-theme') || 'dark'
  const isDark = effectiveTheme === 'dark'
  
  const [blendedR, blendedG, blendedB] = isDark
    ? [r, g, b].map(c => Math.floor(30 * 0.7 + (c * 0.25) * 0.3))
    : [r, g, b].map(c => Math.floor(255 * 0.85 + (c + (255 - c) * 0.7) * 0.15))
  
  return `#${[blendedR, blendedG, blendedB].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

function updateToolbarBackgroundColor() {
  const styleEl = document.getElementById('toolbar-bg-override')
  if (styleEl) styleEl.remove()
  
  const useAccentBg = localStorage.getItem('toolbar-accent-bg') === 'true'
  if (useAccentBg) {
    const tintedBg = darkenTintColor(
      localStorage.getItem('accent-color') || '#3bbbf6',
      getEffectiveTheme(localStorage.getItem('theme') || 'system')
    )
    const el = Object.assign(document.createElement('style'), {
      id: 'toolbar-bg-override',
      textContent: `:root, [data-theme="dark"], [data-theme="light"], body { --toolbar-bg: ${tintedBg} !important; }`
    })
    document.head.appendChild(el)
    ipcRenderer.send('toolbar-bg-changed', { enabled: true, color: tintedBg })
  } else {
    ipcRenderer.send('toolbar-bg-changed', { enabled: false, color: null })
  }
}

function updateAccentColor(color) {
  const normalizedColor = normalizeHex(color)
  document.documentElement.style.setProperty('--accent-color', normalizedColor)
  const r = parseInt(normalizedColor.substr(1, 2), 16)
  const g = parseInt(normalizedColor.substr(3, 2), 16)
  const b = parseInt(normalizedColor.substr(5, 2), 16)
  const hoverR = Math.max(0, r - 30)
  const hoverG = Math.max(0, g - 30)
  const hoverB = Math.max(0, b - 30)
  const hoverColor = `#${hoverR.toString(16).padStart(2, '0')}${hoverG.toString(16).padStart(2, '0')}${hoverB.toString(16).padStart(2, '0')}`
  document.documentElement.style.setProperty('--accent-hover', hoverColor)
  document.documentElement.style.setProperty('--accent-active-bg', `rgba(${r}, ${g}, ${b}, 0.15)`)
  document.documentElement.style.setProperty('--accent-active-shadow', `rgba(${r}, ${g}, ${b}, 0.3)`)
  
  const accentIsLight = isLightColor(normalizedColor)
  const buttonTextColor = accentIsLight ? '#000000' : '#ffffff'
  document.documentElement.style.setProperty('--accent-btn-text-color', buttonTextColor)
  
  localStorage.setItem('accent-color', normalizedColor)

  if (accentColorPicker) {
    accentColorPicker.value = getColorForPicker(normalizedColor)
  }

  updateLayoutButtonColors()
  updateThemeButtonColors()
  updateToggleSwitchColor()
  updateResetAccentVisibility()
  
  updateToolbarBackgroundColor()

  ipcRenderer.send('accent-color-changed', normalizedColor)
}

const accentColorPicker = document.getElementById('accent-color-picker')
const accentColorPreview = document.getElementById('accent-color-preview')
const accentColorHex = document.getElementById('accent-color-hex')
const resetAccentColorBtn = document.getElementById('reset-accent-color')
const syncWindowsAccentBtn = document.getElementById('sync-windows-accent')

const savedAccentColor = localStorage.getItem('accent-color') || '#40E0D0'
updateAccentColor(savedAccentColor)

function updateAccentColorPreview(color) {
  if (accentColorPreview) {
    accentColorPreview.style.background = color
  }
}

if (accentColorPicker) {
  accentColorPicker.value = savedAccentColor
  accentColorPicker.addEventListener('change', (e) => {
    const color = e.target.value
    updateAccentColor(color)
    updateAccentColorPreview(color)
    if (accentColorHex) accentColorHex.value = color
  })
}

if (accentColorPreview && accentColorPicker) {
  const syncPickerValue = () => {
    const currentColor = localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR
    const pickerColor = getColorForPicker(currentColor)
    accentColorPicker.value = pickerColor
  }
  
  accentColorPreview.addEventListener('click', () => {
    syncPickerValue()
    setTimeout(() => accentColorPicker.click(), 10)
  })
  
  accentColorPicker.addEventListener('focus', () => {
    syncPickerValue()
  })
}

updateAccentColorPreview(savedAccentColor)

if (accentColorHex) {
  accentColorHex.value = savedAccentColor
  accentColorHex.addEventListener('input', (e) => {
    const hex = e.target.value.trim()
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex)
      updateAccentColor(normalizedHex)
      updateAccentColorPreview(normalizedHex)
      if (accentColorPicker) accentColorPicker.value = normalizedHex
      e.target.value = normalizedHex
    }
  })
  accentColorHex.addEventListener('blur', (e) => {
    const hex = e.target.value.trim()
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex)
      e.target.value = normalizedHex
      updateAccentColor(normalizedHex)
      updateAccentColorPreview(normalizedHex)
      if (accentColorPicker) accentColorPicker.value = normalizedHex
    } else {
      e.target.value = savedAccentColor
    }
  })
  accentColorHex.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const hex = e.target.value.trim()
      if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
        const normalizedHex = normalizeHex(hex)
        updateAccentColor(normalizedHex)
        updateAccentColorPreview(normalizedHex)
        if (accentColorPicker) accentColorPicker.value = normalizedHex
        e.target.value = normalizedHex
      } else {
        e.target.value = savedAccentColor
      }
      e.target.blur()
    }
  })
}

function updateSyncState(enabled) {
  if (syncWindowsAccentBtn) {
    if (enabled) {
      syncWindowsAccentBtn.classList.add('active')
    } else {
      syncWindowsAccentBtn.classList.remove('active')
    }
  }
  
  if (accentColorHex) {
    accentColorHex.disabled = enabled
    if (enabled) {
      accentColorHex.style.opacity = '0.5'
      accentColorHex.style.cursor = 'not-allowed'
    } else {
      accentColorHex.style.opacity = ''
      accentColorHex.style.cursor = ''
    }
  }
  
  updateResetAccentVisibility()
  
  if (accentColorPicker) {
    accentColorPicker.disabled = enabled
    if (enabled) {
      accentColorPicker.style.pointerEvents = 'none'
    } else {
      accentColorPicker.style.pointerEvents = ''
    }
  }
  
  if (accentColorPreview) {
    if (enabled) {
      accentColorPreview.style.pointerEvents = 'none'
      accentColorPreview.style.cursor = 'not-allowed'
      accentColorPreview.style.opacity = '0.5'
    } else {
      accentColorPreview.style.removeProperty('pointer-events')
      accentColorPreview.style.removeProperty('cursor')
      accentColorPreview.style.removeProperty('opacity')
    }
  }
}

let syncWindowsEnabled = localStorage.getItem('sync-windows-accent') === 'true'
ipcRenderer.invoke('get-sync-windows-accent-state').then(enabled => {
  if (enabled !== null) {
    syncWindowsEnabled = enabled
    localStorage.setItem('sync-windows-accent', enabled ? 'true' : 'false')
    updateSyncState(enabled)
  }
})

if (syncWindowsAccentBtn) {
  if (syncWindowsEnabled) {
    updateSyncState(true)
  } else {
    updateSyncState(false)
  }
  
  syncWindowsAccentBtn.addEventListener('click', async () => {
    const isCurrentlyActive = syncWindowsAccentBtn.classList.contains('active')
    
    if (isCurrentlyActive) {
      updateSyncState(false)
      localStorage.setItem('sync-windows-accent', 'false')
      ipcRenderer.send('toggle-windows-accent-sync', false)
      updateResetAccentVisibility()
    } else {
      try {
        const windowsColor = await ipcRenderer.invoke('get-windows-accent-color')
        if (windowsColor) {
          updateSyncState(true)
          localStorage.setItem('sync-windows-accent', 'true')
          ipcRenderer.send('toggle-windows-accent-sync', true)
          
          updateAccentColor(windowsColor)
          updateAccentColorPreview(windowsColor)
          if (accentColorPicker) accentColorPicker.value = windowsColor
          if (accentColorHex) accentColorHex.value = windowsColor
          updateResetAccentVisibility()
        } else {
          alert('Unable to get Windows accent colour. This feature is only available on Windows.')
        }
      } catch (error) {
        console.error('Error syncing Windows accent colour:', error)
        alert('Error syncing with Windows accent colour.')
      }
    }
  })
  
  ipcRenderer.on('windows-accent-color-changed', (event, windowsColor) => {
    const isSyncActive = syncWindowsAccentBtn.classList.contains('active') || localStorage.getItem('sync-windows-accent') === 'true'
    if (isSyncActive) {
      updateAccentColor(windowsColor)
      updateAccentColorPreview(windowsColor)
      if (accentColorPicker) accentColorPicker.value = windowsColor
      if (accentColorHex) accentColorHex.value = windowsColor
    }
  })
}

function updateResetAccentVisibility() {
  if (resetAccentColorBtn) {
    const isSyncEnabled = syncWindowsAccentBtn && syncWindowsAccentBtn.classList.contains('active')
    if (isSyncEnabled) {
      resetAccentColorBtn.style.display = 'none'
      return
    }
    
    const currentColor = normalizeHex(localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR)
    const defaultColor = normalizeHex(DEFAULT_ACCENT_COLOR)
    const isDefault = currentColor.toLowerCase() === defaultColor.toLowerCase()
    resetAccentColorBtn.style.display = isDefault ? 'none' : 'flex'
  }
}

if (resetAccentColorBtn) {
  resetAccentColorBtn.addEventListener('click', () => {
    updateAccentColor(DEFAULT_ACCENT_COLOR)
    updateAccentColorPreview(DEFAULT_ACCENT_COLOR)
    if (accentColorPicker) accentColorPicker.value = DEFAULT_ACCENT_COLOR
    if (accentColorHex) accentColorHex.value = DEFAULT_ACCENT_COLOR
  })
}

let currentLayout = localStorage.getItem('toolbar-layout') || 'vertical'

function applyLayout(layout) {
  currentLayout = layout
  localStorage.setItem('toolbar-layout', layout)
  
  const layoutToggle = document.querySelector('.layout-toggle')
  if (layoutToggle) {
    layoutToggle.setAttribute('data-active', layout)
  }
  
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  const activeBtn = document.querySelector(`[data-layout="${layout}"]`)
  if (activeBtn) {
    activeBtn.classList.add('active')
  }

  const effectiveTheme = getEffectiveTheme(localStorage.getItem('theme') || 'system')
  const isDark = effectiveTheme === 'dark'
  document.querySelectorAll('.layout-btn:not(.active)').forEach(btn => {
    btn.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)'
    const icon = btn.querySelector('.material-symbols-outlined')
    if (icon) {
      icon.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)'
    }
  })

  ipcRenderer.send('layout-changed', layout)
}

document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyLayout(btn.dataset.layout)
  })
})

applyLayout(currentLayout)

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

const shortcutInput = document.getElementById('shortcut-input')
const resetShortcutBtn = document.getElementById('reset-shortcut')
let isRecordingShortcut = false
let currentShortcut = localStorage.getItem('shortcut') || DEFAULT_SHORTCUT

function updateResetShortcutVisibility() {
  if (resetShortcutBtn) {
    const savedShortcut = localStorage.getItem('shortcut') || DEFAULT_SHORTCUT
    const isDefault = savedShortcut === DEFAULT_SHORTCUT
    resetShortcutBtn.style.display = isDefault ? 'none' : 'flex'
  }
}

const initialKeys = parseShortcut(currentShortcut)
if (shortcutInput) {
  shortcutInput.value = formatShortcut(initialKeys)
}

if (shortcutInput) {
  shortcutInput.addEventListener('click', () => {
    if (isRecordingShortcut) {
      
      isRecordingShortcut = false
      shortcutInput.classList.remove('recording')
      shortcutInput.value = formatShortcut(parseShortcut(currentShortcut))
      return
    }
    
    isRecordingShortcut = true
    shortcutInput.classList.add('recording')
    shortcutInput.value = 'Press keys...'
    shortcutInput.placeholder = 'Press keys...'
  })
}

document.addEventListener('click', (e) => {
  if (isRecordingShortcut && e.target !== shortcutInput && !shortcutInput.contains(e.target)) {
    isRecordingShortcut = false
    shortcutInput.classList.remove('recording')
    shortcutInput.value = formatShortcut(parseShortcut(currentShortcut))
  }
})

function toggleSettingsSearch() {
  if (sidebarSearchToggle && sidebarSearchContainer) {
    const isVisible = sidebarSearchContainer.style.display !== 'none'
    if (isVisible) {
      sidebarSearchContainer.style.display = 'none'
      sidebarSearchToggle.classList.remove('active')
      if (settingsSearch) {
        settingsSearch.value = ''
        performSearch('')
      }
    } else {
      sidebarSearchContainer.style.display = 'block'
      sidebarSearchToggle.classList.add('active')
      setTimeout(() => {
        if (settingsSearch) {
          settingsSearch.focus()
        }
      }, 100)
    }
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    e.stopPropagation()
    toggleSettingsSearch()
    return
  }
  
  if (!isRecordingShortcut) return
  
  e.preventDefault()
  e.stopPropagation()
  
  const keys = []
  if (e.ctrlKey) keys.push('Control')
  if (e.metaKey) keys.push('Meta')
  if (e.altKey) keys.push('Alt')
  if (e.shiftKey) keys.push('Shift')
  
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
    keys.push(e.key)
    
    const shortcutStr = keys.join('+')
    currentShortcut = shortcutStr
    if (shortcutInput) {
      shortcutInput.value = formatShortcut(keys)
      shortcutInput.classList.remove('recording')
    }
    isRecordingShortcut = false
    localStorage.setItem('shortcut', shortcutStr)
    updateResetShortcutVisibility()
    
    ipcRenderer.send('update-shortcut', shortcutStr)
  }
})

if (resetShortcutBtn) {
  resetShortcutBtn.addEventListener('click', () => {
    currentShortcut = DEFAULT_SHORTCUT
    if (shortcutInput) shortcutInput.value = 'Ctrl+Shift+D'
    localStorage.setItem('shortcut', DEFAULT_SHORTCUT)
    updateResetShortcutVisibility()
    ipcRenderer.send('update-shortcut', DEFAULT_SHORTCUT)
  })
}

const soundsCheckbox = document.getElementById('sounds-enabled')
if (soundsCheckbox) {
  const soundsEnabled = localStorage.getItem('sounds-enabled')
  if (soundsEnabled !== null) {
    soundsCheckbox.checked = soundsEnabled === 'true'
  }
  
  soundsCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('sounds-enabled', e.target.checked)
    ipcRenderer.send('sounds-changed', e.target.checked)
  })
}

const textSolveCheckbox = document.getElementById('text-solve-enabled')
if (textSolveCheckbox) {
  const textSolveEnabled = localStorage.getItem('text-solve-enabled')
  if (textSolveEnabled !== null) {
    textSolveCheckbox.checked = textSolveEnabled === 'true'
  }
  
  textSolveCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('text-solve-enabled', e.target.checked)
  })
}

const showTrayIconCheckbox = document.getElementById('show-tray-icon')
if (showTrayIconCheckbox) {
  const showTrayIcon = localStorage.getItem('show-tray-icon')
  if (showTrayIcon !== null) {
    showTrayIconCheckbox.checked = showTrayIcon === 'true'
  } else {
    showTrayIconCheckbox.checked = true
  }
  
  showTrayIconCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('show-tray-icon', e.target.checked)
    ipcRenderer.send('toggle-tray-icon', e.target.checked)
  })
}

const toolbarAccentBgCheckbox = document.getElementById('toolbar-accent-bg-enabled')
if (toolbarAccentBgCheckbox) {
  const toolbarAccentBg = localStorage.getItem('toolbar-accent-bg')
  if (toolbarAccentBg !== null) {
    toolbarAccentBgCheckbox.checked = toolbarAccentBg === 'true'
  }
  
  toolbarAccentBgCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('toolbar-accent-bg', e.target.checked ? 'true' : 'false')
    updateToolbarBackgroundColor()
  })
  
  updateToolbarBackgroundColor()
}

const disableToolbarMovingCheckbox = document.getElementById('disable-toolbar-moving')
if (disableToolbarMovingCheckbox) {
  const disableToolbarMoving = localStorage.getItem('disable-toolbar-moving')
  if (disableToolbarMoving !== null) {
    disableToolbarMovingCheckbox.checked = disableToolbarMoving === 'true'
  }
  
  disableToolbarMovingCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('disable-toolbar-moving', e.target.checked ? 'true' : 'false')
    ipcRenderer.send('disable-toolbar-moving-changed', e.target.checked)
  })
}

const standbyInToolbarCheckbox = document.getElementById('standby-in-toolbar')
if (standbyInToolbarCheckbox) {
  const standbyInToolbar = localStorage.getItem('standby-in-toolbar')
  if (standbyInToolbar !== null) {
    standbyInToolbarCheckbox.checked = standbyInToolbar === 'true'
  } else {
    standbyInToolbarCheckbox.checked = false
  }
  
  standbyInToolbarCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('standby-in-toolbar', e.target.checked ? 'true' : 'false')
    ipcRenderer.send('standby-in-toolbar-changed', e.target.checked)
  })
}

const launchOnStartupCheckbox = document.getElementById('launch-on-startup')
if (launchOnStartupCheckbox) {
  const launchOnStartup = localStorage.getItem('launch-on-startup')
  if (launchOnStartup !== null) {
    launchOnStartupCheckbox.checked = launchOnStartup === 'true'
  }
  
  launchOnStartupCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('launch-on-startup', e.target.checked)
    ipcRenderer.send('set-auto-launch', e.target.checked)
  })
}

const screenshotNotificationCheckbox = document.getElementById('screenshot-notification')
if (screenshotNotificationCheckbox) {
  const screenshotNotification = localStorage.getItem('screenshot-notification')
  if (screenshotNotification !== null) {
    screenshotNotificationCheckbox.checked = screenshotNotification === 'true'
  } else {
    screenshotNotificationCheckbox.checked = true
  }
  
  screenshotNotificationCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('screenshot-notification', e.target.checked)
    ipcRenderer.send('screenshot-notification-changed', e.target.checked)
  })
}

const copySnapshotClipboardCheckbox = document.getElementById('copy-snapshot-clipboard')
if (copySnapshotClipboardCheckbox) {
  const copySnapshotClipboard = localStorage.getItem('copy-snapshot-clipboard')
  if (copySnapshotClipboard !== null) {
    copySnapshotClipboardCheckbox.checked = copySnapshotClipboard === 'true'
  } else {
    copySnapshotClipboardCheckbox.checked = false
  }
  
  copySnapshotClipboardCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('copy-snapshot-clipboard', e.target.checked)
    ipcRenderer.send('copy-snapshot-clipboard-changed', e.target.checked)
  })
}

const autoSaveSnapshotsCheckbox = document.getElementById('auto-save-snapshots')
const saveDirectoryWrapper = document.getElementById('save-directory-wrapper')
const saveDirectoryPath = document.getElementById('save-directory-path')
const selectSaveDirectoryBtn = document.getElementById('select-save-directory-btn')

if (autoSaveSnapshotsCheckbox) {
  const autoSaveSnapshots = localStorage.getItem('auto-save-snapshots')
  if (autoSaveSnapshots !== null) {
    autoSaveSnapshotsCheckbox.checked = autoSaveSnapshots === 'true'
  } else {
    autoSaveSnapshotsCheckbox.checked = false
  }
  
  if (autoSaveSnapshotsCheckbox.checked && saveDirectoryWrapper) {
    saveDirectoryWrapper.style.display = 'block'
  }
  
  function checkDirectoryExists(directoryPath) {
    if (!directoryPath) return
    
    ipcRenderer.invoke('check-directory-exists', directoryPath).then(exists => {
      const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
      const directoryWarning = document.getElementById('directory-warning')
      
      if (!exists && autoSaveEnabled) {
        const warningDismissed = sessionStorage.getItem('directory-warning-dismissed') === 'true'
        if (directoryWarning && !warningDismissed) {
          directoryWarning.style.display = 'flex'
        }
        
        if (saveDirectoryPath) {
          saveDirectoryPath.textContent = directoryPath + ' (Directory not found)'
          saveDirectoryPath.style.color = '#ff6b6b'
          saveDirectoryPath.style.opacity = '1'
        }
        
        ipcRenderer.send('update-settings-badge', true)
      } else {
        if (directoryWarning) {
          directoryWarning.style.display = 'none'
        }
        
        if (exists) {
          sessionStorage.removeItem('directory-warning-dismissed')
        }
        
      if (saveDirectoryPath) {
        if (exists) {
          saveDirectoryPath.textContent = directoryPath
          saveDirectoryPath.style.color = ''
          saveDirectoryPath.style.opacity = ''
        } else {
          saveDirectoryPath.textContent = directoryPath + ' (Directory not found)'
          saveDirectoryPath.style.color = '#ff6b6b'
          saveDirectoryPath.style.opacity = '1'
        }
      }
      
      ipcRenderer.send('update-settings-badge', !exists && autoSaveEnabled)
      }
    })
  }
  
  let directoryCheckInterval = null
  
  const savedDirectory = localStorage.getItem('save-directory-path')
  if (savedDirectory && saveDirectoryPath) {
    saveDirectoryPath.textContent = savedDirectory
    if (autoSaveSnapshotsCheckbox && autoSaveSnapshotsCheckbox.checked) {
      checkDirectoryExists(savedDirectory)
      
      directoryCheckInterval = setInterval(() => {
        const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
        const currentDir = localStorage.getItem('save-directory-path')
        if (autoSaveEnabled && currentDir) {
          checkDirectoryExists(currentDir)
        } else {
          clearInterval(directoryCheckInterval)
          directoryCheckInterval = null
        }
      }, 3000)
    }
  }
  
  autoSaveSnapshotsCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('auto-save-snapshots', e.target.checked)
    ipcRenderer.send('auto-save-snapshots-changed', e.target.checked)
    
    if (saveDirectoryWrapper) {
      saveDirectoryWrapper.style.display = e.target.checked ? 'block' : 'none'
    }
    
    if (e.target.checked) {
      const savedDir = localStorage.getItem('save-directory-path')
      if (savedDir) {
        checkDirectoryExists(savedDir)
        if (!directoryCheckInterval) {
          directoryCheckInterval = setInterval(() => {
            const autoSaveEnabled = localStorage.getItem('auto-save-snapshots') === 'true'
            const currentDir = localStorage.getItem('save-directory-path')
            if (autoSaveEnabled && currentDir) {
              checkDirectoryExists(currentDir)
            } else {
              clearInterval(directoryCheckInterval)
              directoryCheckInterval = null
            }
          }, 3000)
        }
      }
    } else {
      if (directoryCheckInterval) {
        clearInterval(directoryCheckInterval)
        directoryCheckInterval = null
      }
      const directoryWarning = document.getElementById('directory-warning')
      if (directoryWarning) {
        directoryWarning.style.display = 'none'
      }
      ipcRenderer.send('update-settings-badge', false)
    }
  })
}

const closeDirectoryWarningBtn = document.getElementById('close-directory-warning')
if (closeDirectoryWarningBtn) {
  closeDirectoryWarningBtn.addEventListener('click', () => {
    const directoryWarning = document.getElementById('directory-warning')
    if (directoryWarning) {
      directoryWarning.style.display = 'none'
      sessionStorage.setItem('directory-warning-dismissed', 'true')
    }
  })
}

if (selectSaveDirectoryBtn) {
  selectSaveDirectoryBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('select-save-directory')
    if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      localStorage.setItem('save-directory-path', selectedPath)
      sessionStorage.removeItem('directory-warning-dismissed')
      if (saveDirectoryPath) {
        saveDirectoryPath.textContent = selectedPath
        saveDirectoryPath.style.color = ''
        saveDirectoryPath.style.opacity = ''
      }
      ipcRenderer.send('save-directory-changed', selectedPath)
      
      checkDirectoryExists(selectedPath)
    }
  })
}

ipcRenderer.on('sync-system-settings', (event, settings) => {
  if (settings) {
    if (showTrayIconCheckbox) {
      showTrayIconCheckbox.checked = settings.showTrayIcon !== false
      localStorage.setItem('show-tray-icon', settings.showTrayIcon !== false)
    }
    if (launchOnStartupCheckbox) {
      launchOnStartupCheckbox.checked = settings.launchOnStartup === true
      localStorage.setItem('launch-on-startup', settings.launchOnStartup === true)
    }
  }
})

function initToggleLabelClick() {
  document.querySelectorAll('.setting-row').forEach(row => {
    const labelWrapper = row.querySelector('.setting-label-wrapper[data-toggle-for]')
    if (labelWrapper) {
      row.addEventListener('click', (e) => {
        
        if (e.target.closest('.toggle-switch')) {
          return
        }
        const checkboxId = labelWrapper.getAttribute('data-toggle-for')
        const checkbox = document.getElementById(checkboxId)
        if (checkbox) {
          checkbox.click()
        }
      })
    }
  })
}

const reduceClutterCheckbox = document.getElementById('reduce-clutter-enabled')
const standbyInToolbarWrapper = document.getElementById('standby-in-toolbar-wrapper')

function updateStandbySubSettingVisibility() {
  if (standbyInToolbarWrapper && reduceClutterCheckbox) {
    standbyInToolbarWrapper.style.display = reduceClutterCheckbox.checked ? 'block' : 'none'
  }
}

if (reduceClutterCheckbox) {
  const reduceClutter = localStorage.getItem('reduce-clutter')
  if (reduceClutter !== null) {
    reduceClutterCheckbox.checked = reduceClutter === 'true'
  } else {
    reduceClutterCheckbox.checked = true
  }
  
  updateStandbySubSettingVisibility()
  
  reduceClutterCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('reduce-clutter', e.target.checked ? 'true' : 'false')
    ipcRenderer.send('reduce-clutter-changed', e.target.checked)
    updateStandbySubSettingVisibility()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToggleLabelClick)
} else {
  initToggleLabelClick()
}

const showOnboardingBtn = document.getElementById('show-onboarding-btn')
if (showOnboardingBtn) {
  showOnboardingBtn.addEventListener('click', () => {
    ipcRenderer.send('show-onboarding')
  })
}

const resetEverythingBtn = document.getElementById('reset-everything-btn')
if (resetEverythingBtn) {
  resetEverythingBtn.addEventListener('click', async () => {
    const confirmed = await ipcRenderer.invoke('show-reset-confirmation')
    if (confirmed) {
      
      localStorage.clear()

      const defaultTheme = 'system'
      const defaultAccentColor = '#3bbbf6'
      const defaultLayout = 'vertical'
      const defaultShortcut = 'Control+Shift+D'
      const defaultSounds = true

      applyTheme(defaultTheme)
      updateAccentColor(defaultAccentColor)
      applyLayout(defaultLayout)

      if (accentColorPicker) accentColorPicker.value = defaultAccentColor
      if (accentColorHex) accentColorHex.value = defaultAccentColor
      updateAccentColorPreview(defaultAccentColor)

      currentShortcut = defaultShortcut
      if (shortcutInput) shortcutInput.value = 'Ctrl+D'
      localStorage.setItem('shortcut', defaultShortcut)
      ipcRenderer.send('update-shortcut', defaultShortcut)

      if (soundsCheckbox) {
        soundsCheckbox.checked = defaultSounds
        localStorage.setItem('sounds-enabled', defaultSounds)
        ipcRenderer.send('sounds-changed', defaultSounds)
      }

      if (textSolveCheckbox) {
        textSolveCheckbox.checked = false
        localStorage.setItem('text-solve-enabled', false)
      }

      if (showTrayIconCheckbox) {
        showTrayIconCheckbox.checked = true
        localStorage.setItem('show-tray-icon', true)
        ipcRenderer.send('toggle-tray-icon', true)
      }

      if (launchOnStartupCheckbox) {
        launchOnStartupCheckbox.checked = false
        localStorage.setItem('launch-on-startup', false)
        ipcRenderer.send('set-auto-launch', false)
      }

      if (screenshotNotificationCheckbox) {
        screenshotNotificationCheckbox.checked = true
      localStorage.setItem('screenshot-notification', true)
      ipcRenderer.send('screenshot-notification-changed', true)
    }
    
    if (copySnapshotClipboardCheckbox) {
      copySnapshotClipboardCheckbox.checked = false
      localStorage.setItem('copy-snapshot-clipboard', false)
      ipcRenderer.send('copy-snapshot-clipboard-changed', false)
    }
    
    if (reduceClutterCheckbox) {
      reduceClutterCheckbox.checked = true
      localStorage.setItem('reduce-clutter', 'true')
      ipcRenderer.send('reduce-clutter-changed', true)
    }
    
    if (autoSaveSnapshotsCheckbox) {
      autoSaveSnapshotsCheckbox.checked = false
      localStorage.setItem('auto-save-snapshots', false)
      ipcRenderer.send('auto-save-snapshots-changed', false)
      if (saveDirectoryWrapper) {
        saveDirectoryWrapper.style.display = 'none'
      }
      localStorage.removeItem('save-directory-path')
      ipcRenderer.send('save-directory-changed', null)
      if (saveDirectoryPath) {
        saveDirectoryPath.textContent = 'No directory selected'
      }
    }

    if (toolbarAccentBgCheckbox) {
      toolbarAccentBgCheckbox.checked = false
      localStorage.setItem('toolbar-accent-bg', 'false')
      updateToolbarBackgroundColor()
    }
    
    if (disableToolbarMovingCheckbox) {
      disableToolbarMovingCheckbox.checked = false
      localStorage.setItem('disable-toolbar-moving', 'false')
      ipcRenderer.send('disable-toolbar-moving-changed', false)
    }
    
    if (standbyInToolbarCheckbox) {
      standbyInToolbarCheckbox.checked = false
      localStorage.setItem('standby-in-toolbar', 'false')
      ipcRenderer.send('standby-in-toolbar-changed', false)
    }

    if (syncWindowsAccentBtn) {
      syncWindowsAccentBtn.classList.remove('active')
      localStorage.setItem('sync-windows-accent', 'false')
      ipcRenderer.send('toggle-windows-accent-sync', false)
    }

    if (optimizedRenderingCheckbox) {
      optimizedRenderingCheckbox.checked = false
      localStorage.setItem('optimized-rendering', 'false')
      ipcRenderer.send('optimized-rendering-changed', false)
    }

    if (hardwareAccelerationCheckbox) {
      hardwareAccelerationCheckbox.checked = false
      localStorage.setItem('hardware-acceleration', 'false')
      ipcRenderer.send('hardware-acceleration-changed', false)
    }

    localStorage.removeItem('toolbar-x')
    localStorage.removeItem('toolbar-y')

    ipcRenderer.send('reset-everything')
    
    ipcRenderer.send('reset-all-dismissed-dialogs')
    loadDismissedDialogs()
    
    await ipcRenderer.invoke('show-settings-reset-dialog')
  }
})
}

const DIALOG_INFO = {
  'duplicate-warning': {
    name: 'Duplicate Many Elements',
    description: 'Warning when duplicating a large number of elements',
    icon: 'content_copy'
  }
}

const dismissedDialogsToggle = document.getElementById('dismissed-dialogs-toggle')
const dismissedDialogsContent = document.getElementById('dismissed-dialogs-content')
const dismissedDialogsList = document.getElementById('dismissed-dialogs-list')
const dismissedCount = document.getElementById('dismissed-count')

if (dismissedDialogsToggle) {
  dismissedDialogsToggle.addEventListener('click', () => {
    dismissedDialogsToggle.classList.toggle('expanded')
    dismissedDialogsContent.classList.toggle('expanded')
  })
}

async function loadDismissedDialogs() {
  try {
    const dismissedDialogs = await ipcRenderer.invoke('get-dismissed-dialogs')
    const dialogIds = Object.keys(dismissedDialogs || {}).filter(id => dismissedDialogs[id])
    
    if (dismissedCount) {
      dismissedCount.textContent = dialogIds.length > 0 ? dialogIds.length : ''
    }
    
    if (dismissedDialogsList) {
      if (dialogIds.length === 0) {
        dismissedDialogsList.innerHTML = `
          <div class="no-dismissed-dialogs">
            <span class="material-symbols-outlined">check_circle</span>
            <span>All dialogs are enabled</span>
          </div>
        `
      } else {
        dismissedDialogsList.innerHTML = dialogIds.map(id => {
          const info = DIALOG_INFO[id] || { name: id, description: '', icon: 'info' }
          return `
            <div class="dismissed-dialog-item" data-dialog-id="${id}">
              <div class="dismissed-dialog-icon">
                <span class="material-symbols-outlined">${info.icon}</span>
              </div>
              <div class="dismissed-dialog-info">
                <span class="dismissed-dialog-name">${info.name}</span>
                <span class="dismissed-dialog-desc">${info.description}</span>
              </div>
              <button class="restore-dialog-btn" data-dialog-id="${id}" title="Re-enable this dialog">
                <span class="material-symbols-outlined">visibility</span>
              </button>
            </div>
          `
        }).join('')
        
        dismissedDialogsList.querySelectorAll('.restore-dialog-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const dialogId = btn.dataset.dialogId
            ipcRenderer.send('reset-dismissed-dialog', dialogId)
            await loadDismissedDialogs()
          })
        })
      }
    }
  } catch (e) {
    console.warn('Could not load dismissed dialogs:', e)
  }
}

ipcRenderer.on('dismissed-dialogs-updated', () => {
  loadDismissedDialogs()
})

setTimeout(() => loadDismissedDialogs(), 100)

const settingsSearch = document.getElementById('settings-search')
const clearSearchBtn = document.getElementById('clear-search')
const noResults = document.getElementById('no-results')
const sidebarSearchToggle = document.getElementById('sidebar-search-toggle')
const sidebarSearchContainer = document.querySelector('.sidebar-search-container')

const categoryTitles = {
  appearance: { title: 'Appearance', subtitle: 'Customise your app\'s look and feel' },
  toolbar: { title: 'Toolbar', subtitle: 'Configure toolbar layout and display options' },
  shortcuts: { title: 'Shortcuts', subtitle: 'Manage keyboard shortcuts' },
  behavior: { title: 'Behavior', subtitle: 'Customise how the app behaves and responds' },
  system: { title: 'System', subtitle: 'System integration and startup options' },
  labs: { title: 'Labs', subtitle: 'Experimental features and advanced options' },
  reset: { title: 'Reset', subtitle: 'Reset settings or view onboarding' },
  about: { title: 'About', subtitle: 'Application information and support' }
}

let currentCategory = localStorage.getItem('settings-category') || 'appearance'

function showCategory(category) {
  currentCategory = category
  localStorage.setItem('settings-category', category)
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active')
    if (item.dataset.category === category) {
      item.classList.add('active')
    }
  })
  
  const categoryTitle = document.getElementById('category-title')
  const categorySubtitle = document.getElementById('category-subtitle')
  if (categoryTitle && categorySubtitle && categoryTitles[category]) {
    categoryTitle.textContent = categoryTitles[category].title
    categorySubtitle.textContent = categoryTitles[category].subtitle
  }
  
  document.querySelectorAll('.settings-section').forEach(section => {
    if (section.dataset.category === category) {
      section.classList.add('active')
    } else {
      section.classList.remove('active')
    }
  })
  
  if (settingsSearch) {
    settingsSearch.value = ''
    performSearch('')
  }
}

function initCategoryNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category
      if (category) {
        showCategory(category)
      }
    })
  })
  
  showCategory(currentCategory)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoryNavigation)
} else {
  initCategoryNavigation()
}

function performSearch(query) {
  const searchTerm = query.toLowerCase().trim()
  const sections = document.querySelectorAll('.settings-section')
  const settingItems = document.querySelectorAll('.setting-item')
  let hasResults = false

  if (searchTerm === '') {
    sections.forEach(section => {
      if (section.dataset.category === currentCategory) {
        section.classList.add('active')
      } else {
        section.classList.remove('active')
      }
      section.classList.remove('hidden')
    })
    settingItems.forEach(item => {
      item.classList.remove('hidden')
    })
    noResults.style.display = 'none'
    clearSearchBtn.style.display = 'none'
    return
  }

  clearSearchBtn.style.display = 'flex'

  sections.forEach(section => {
    const sectionData = section.getAttribute('data-section') || ''
    const category = section.getAttribute('data-category') || ''
    const categoryTitle = categoryTitles[category]?.title.toLowerCase() || ''
    const sectionMatches = categoryTitle.includes(searchTerm) || sectionData.includes(searchTerm)
    
    let sectionHasVisibleItems = false
    
    section.querySelectorAll('.setting-item').forEach(item => {
      const label = item.querySelector('label')?.textContent.toLowerCase() || ''
      const description = item.querySelector('.setting-description')?.textContent.toLowerCase() || ''
      const keywords = item.getAttribute('data-keywords')?.toLowerCase() || ''
      
      const itemMatches = label.includes(searchTerm) || 
                         description.includes(searchTerm) || 
                         keywords.includes(searchTerm) ||
                         sectionMatches
      
      if (itemMatches) {
        item.classList.remove('hidden')
        sectionHasVisibleItems = true
        hasResults = true
      } else {
        item.classList.add('hidden')
      }
    })
    
    if (sectionHasVisibleItems || sectionMatches) {
      section.classList.add('active')
      section.classList.remove('hidden')
    } else {
      section.classList.remove('active')
      section.classList.add('hidden')
    }
  })

  if (hasResults) {
    noResults.style.display = 'none'
  } else {
    noResults.style.display = 'flex'
  }
}

if (sidebarSearchToggle && sidebarSearchContainer) {
  sidebarSearchToggle.addEventListener('click', () => {
    const isVisible = sidebarSearchContainer.style.display !== 'none'
    if (isVisible) {
      sidebarSearchContainer.style.display = 'none'
      sidebarSearchToggle.classList.remove('active')
      if (settingsSearch) {
        settingsSearch.value = ''
        performSearch('')
      }
    } else {
      sidebarSearchContainer.style.display = 'block'
      sidebarSearchToggle.classList.add('active')
      setTimeout(() => {
        if (settingsSearch) {
          settingsSearch.focus()
        }
      }, 100)
    }
  })
}

if (settingsSearch) {
  settingsSearch.addEventListener('input', (e) => {
    performSearch(e.target.value)
    if (clearSearchBtn) {
      clearSearchBtn.style.display = e.target.value.trim() ? 'flex' : 'none'
    }
  })

  settingsSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      settingsSearch.value = ''
      performSearch('')
      if (clearSearchBtn) clearSearchBtn.style.display = 'none'
      if (sidebarSearchToggle && sidebarSearchContainer) {
        sidebarSearchContainer.style.display = 'none'
        sidebarSearchToggle.classList.remove('active')
      }
      settingsSearch.blur()
    }
  })
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    if (settingsSearch) {
      settingsSearch.value = ''
      performSearch('')
      clearSearchBtn.style.display = 'none'
      settingsSearch.focus()
    }
  })
}

async function initReportIssueButton() {
  try {
    const systemInfo = await ipcRenderer.invoke('get-system-info')
    cachedSystemInfo = systemInfo
    const versionEl = document.getElementById('about-version')
    const reportBtn = document.getElementById('report-issue-btn')
    
    if (versionEl) {
      versionEl.textContent = `Version ${systemInfo.version}`
    }
    
    if (reportBtn) {
      const subject = encodeURIComponent(`Bug Report - CYC Annotate v${systemInfo.version}`)
      const body = encodeURIComponent(`Please describe the issue you're experiencing:




---
System Information:
- App Version: ${systemInfo.version}
${systemInfo.osVersion ? `- Operating System: ${systemInfo.osVersion}` : `- Platform: ${systemInfo.platform}`}
- Architecture: ${systemInfo.arch}
- Electron Version: ${systemInfo.electronVersion}
- Chrome Version: ${systemInfo.chromeVersion}
- Node Version: ${systemInfo.nodeVersion}`)
      
      reportBtn.href = `mailto:help@creatoryogames.com?subject=${subject}&body=${body}`
    }
  } catch (error) {
    console.error('Error initializing report issue button:', error)
  }
}

function initViewDetailsButton() {
  const viewDetailsBtn = document.getElementById('view-details-btn')
  
  if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener('click', () => {
      ipcRenderer.invoke('show-system-details-dialog')
    })
  }
}

const optimizedRenderingCheckbox = document.getElementById('optimized-rendering')
if (optimizedRenderingCheckbox) {
  const optimizedRendering = localStorage.getItem('optimized-rendering')
  const initialOptimizedRendering = optimizedRendering === 'true'
  if (optimizedRendering !== null) {
    optimizedRenderingCheckbox.checked = initialOptimizedRendering
  }
  
  optimizedRenderingCheckbox.addEventListener('change', async (e) => {
    const newValue = e.target.checked
    
    if (newValue !== initialOptimizedRendering) {
      localStorage.setItem('optimized-rendering', newValue)
      localStorage.setItem('settings-category', 'labs')
      ipcRenderer.send('optimized-rendering-changed', newValue)
      
      const shouldRelaunch = await ipcRenderer.invoke('show-relaunch-dialog', 'optimized-rendering')
      if (shouldRelaunch) {
      }
    } else {
      localStorage.setItem('optimized-rendering', newValue)
      ipcRenderer.send('optimized-rendering-changed', newValue)
    }
  })
}

const hardwareAccelerationCheckbox = document.getElementById('hardware-acceleration')
if (hardwareAccelerationCheckbox) {
  const hardwareAcceleration = localStorage.getItem('hardware-acceleration')
  const initialHardwareAcceleration = hardwareAcceleration === 'true'
  if (hardwareAcceleration !== null) {
    hardwareAccelerationCheckbox.checked = initialHardwareAcceleration
  }
  
  hardwareAccelerationCheckbox.addEventListener('change', async (e) => {
    const newValue = e.target.checked
    
    if (newValue !== initialHardwareAcceleration) {
      localStorage.setItem('hardware-acceleration', newValue)
      localStorage.setItem('settings-category', 'labs')
      ipcRenderer.send('hardware-acceleration-changed', newValue)
      
      const shouldRelaunch = await ipcRenderer.invoke('show-relaunch-dialog', 'hardware-acceleration')
      if (shouldRelaunch) {
      }
    } else {
      localStorage.setItem('hardware-acceleration', newValue)
      ipcRenderer.send('hardware-acceleration-changed', newValue)
    }
  })
}

function initInfoTooltips() {
  const tooltip = document.createElement('div')
  tooltip.className = 'info-tooltip'
  document.body.appendChild(tooltip)

  document.querySelectorAll('.info-icon[data-tooltip]').forEach(icon => {
    icon.addEventListener('mouseenter', () => {
      tooltip.textContent = icon.dataset.tooltip
      tooltip.classList.add('visible')
      const rect = icon.getBoundingClientRect()
      tooltip.style.left = `${rect.left + rect.width / 2}px`
      tooltip.style.top = `${rect.top - 8}px`
    })
    icon.addEventListener('mouseleave', () => tooltip.classList.remove('visible'))
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initReportIssueButton()
    initViewDetailsButton()
    updateResetAccentVisibility()
    updateResetShortcutVisibility()
    initInfoTooltips()
  })
} else {
  initReportIssueButton()
  initViewDetailsButton()
  updateResetAccentVisibility()
  updateResetShortcutVisibility()
  initInfoTooltips()
}

const { initWindowControls } = require('../shared/window-controls.js')
initWindowControls({ showMinimize: true, showMaximize: true, showClose: true })