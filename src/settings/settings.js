const { ipcRenderer } = require('electron')

const savedTheme = localStorage.getItem('theme') || 'dark'
document.body.setAttribute('data-theme', savedTheme)

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active')
  })

  const themeBtn = document.querySelector(`.theme-btn[data-theme="${theme}"]`)
  if (themeBtn) {
    themeBtn.classList.add('active')
    
    themeBtn.style.background = 'var(--accent-color)'
    updateButtonTextColor(themeBtn)
  }

  document.querySelectorAll('.theme-btn:not(.active)').forEach(btn => {
    btn.style.background = 'transparent'
    const isDark = theme === 'dark'
    btn.style.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)'
    const icon = btn.querySelector('.material-symbols-outlined')
    if (icon) {
      icon.style.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)'
    }
  })

  ipcRenderer.send('theme-changed', theme)
}

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
  const currentAccentColor = localStorage.getItem('accent-color') || '#40E0D0'
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
  const currentAccentColor = localStorage.getItem('accent-color') || '#40E0D0'
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
  
  // Set button text color based on accent color contrast for accessibility
  const accentIsLight = isLightColor(normalizedColor)
  const buttonTextColor = accentIsLight ? '#000000' : '#ffffff'
  document.documentElement.style.setProperty('--accent-btn-text-color', buttonTextColor)
  
  localStorage.setItem('accent-color', normalizedColor)

  updateLayoutButtonColors()
  updateThemeButtonColors()
  updateToggleSwitchColor()

  ipcRenderer.send('accent-color-changed', normalizedColor)
}

const savedAccentColor = localStorage.getItem('accent-color') || '#40E0D0'
updateAccentColor(savedAccentColor)

const accentColorPicker = document.getElementById('accent-color-picker')
const accentColorPreview = document.getElementById('accent-color-preview')
const accentColorHex = document.getElementById('accent-color-hex')
const resetAccentColorBtn = document.getElementById('reset-accent-color')

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
  accentColorPreview.addEventListener('click', () => {
    accentColorPicker.focus()
    accentColorPicker.click()
  })
  
  accentColorPicker.addEventListener('focus', () => {
    accentColorPicker.click()
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

if (resetAccentColorBtn) {
  resetAccentColorBtn.addEventListener('click', () => {
    const defaultColor = '#40E0D0'
    updateAccentColor(defaultColor)
    updateAccentColorPreview(defaultColor)
    if (accentColorPicker) accentColorPicker.value = defaultColor
    if (accentColorHex) accentColorHex.value = defaultColor
  })
}

let currentLayout = localStorage.getItem('toolbar-layout') || 'vertical'

function applyLayout(layout) {
  currentLayout = layout
  localStorage.setItem('toolbar-layout', layout)
  
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  const activeBtn = document.querySelector(`[data-layout="${layout}"]`)
  if (activeBtn) {
    activeBtn.classList.add('active')
    updateButtonTextColor(activeBtn)
  }

  document.querySelectorAll('.layout-btn:not(.active)').forEach(btn => {
    const icon = btn.querySelector('.material-symbols-outlined')
    if (icon) {
      icon.style.color = ''
    }
    btn.style.color = ''
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
let currentShortcut = localStorage.getItem('shortcut') || 'Control+Shift+D'

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

document.addEventListener('keydown', (e) => {
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
    
    ipcRenderer.send('update-shortcut', shortcutStr)
  }
})

if (resetShortcutBtn) {
  resetShortcutBtn.addEventListener('click', () => {
    currentShortcut = 'Control+Shift+D'
    if (shortcutInput) shortcutInput.value = 'Ctrl+Shift+D'
    localStorage.setItem('shortcut', 'Control+Shift+D')
    ipcRenderer.send('update-shortcut', 'Control+Shift+D')
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
        if (directoryWarning) {
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

if (selectSaveDirectoryBtn) {
  selectSaveDirectoryBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('select-save-directory')
    if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      localStorage.setItem('save-directory-path', selectedPath)
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
if (reduceClutterCheckbox) {
  const reduceClutter = localStorage.getItem('reduce-clutter')
  if (reduceClutter !== null) {
    reduceClutterCheckbox.checked = reduceClutter === 'true'
  } else {
    reduceClutterCheckbox.checked = false
  }
  
  reduceClutterCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('reduce-clutter', e.target.checked)
    ipcRenderer.send('reduce-clutter-changed', e.target.checked)
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
  resetEverythingBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
      
      localStorage.clear()

      const defaultTheme = 'dark'
      const defaultAccentColor = '#40E0D0'
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
    
    if (autoSaveSnapshotsCheckbox) {
      autoSaveSnapshotsCheckbox.checked = false
      localStorage.setItem('auto-save-snapshots', false)
      ipcRenderer.send('auto-save-snapshots-changed', false)
      if (saveDirectoryWrapper) {
        saveDirectoryWrapper.style.display = 'none'
      }
      localStorage.removeItem('save-directory-path')
      if (saveDirectoryPath) {
        saveDirectoryPath.textContent = 'No directory selected'
      }
    }

    localStorage.removeItem('toolbar-x')
    localStorage.removeItem('toolbar-y')

    ipcRenderer.send('reset-everything')
    
    alert('All settings have been reset to defaults!')
  }
})
}

const settingsSearch = document.getElementById('settings-search')
const clearSearchBtn = document.getElementById('clear-search')
const noResults = document.getElementById('no-results')
const sidebarSearchToggle = document.getElementById('sidebar-search-toggle')
const sidebarSearchContainer = document.querySelector('.sidebar-search-container')

// Category navigation
const categoryTitles = {
  appearance: { title: 'Appearance', subtitle: 'Customize your app\'s look and feel' },
  toolbar: { title: 'Toolbar', subtitle: 'Configure toolbar layout and behavior' },
  shortcuts: { title: 'Shortcuts', subtitle: 'Manage keyboard shortcuts' },
  features: { title: 'Features', subtitle: 'Enable or disable app features' },
  system: { title: 'System', subtitle: 'System settings and preferences' },
  reset: { title: 'Reset', subtitle: 'Reset settings or view onboarding' },
  about: { title: 'About', subtitle: 'Application information and support' }
}

let currentCategory = 'appearance'

function showCategory(category) {
  currentCategory = category
  
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active')
    if (item.dataset.category === category) {
      item.classList.add('active')
    }
  })
  
  // Update title and subtitle
  const categoryTitle = document.getElementById('category-title')
  const categorySubtitle = document.getElementById('category-subtitle')
  if (categoryTitle && categorySubtitle && categoryTitles[category]) {
    categoryTitle.textContent = categoryTitles[category].title
    categorySubtitle.textContent = categoryTitles[category].subtitle
  }
  
  // Show/hide sections
  document.querySelectorAll('.settings-section').forEach(section => {
    if (section.dataset.category === category) {
      section.classList.add('active')
    } else {
      section.classList.remove('active')
    }
  })
  
  // Clear search when switching categories
  if (settingsSearch) {
    settingsSearch.value = ''
    performSearch('')
  }
}

// Initialize category navigation
function initCategoryNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category
      if (category) {
        showCategory(category)
      }
    })
  })
  
  // Show initial category
  showCategory(currentCategory)
}

// Initialize when DOM is ready
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
    // Show current category section
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

  // When searching, show all sections that match
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

// Toggle sidebar search
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

// Update check functionality
const checkUpdateBtn = document.getElementById('check-update-btn')
const updateStatusText = document.getElementById('update-status-text')

let updateDownloaded = false

if (checkUpdateBtn && updateStatusText) {
  checkUpdateBtn.addEventListener('click', async () => {
    checkUpdateBtn.disabled = true
    checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span><span>Checking...</span>'
    updateStatusText.textContent = 'Checking for updates...'
    
    try {
      const result = await ipcRenderer.invoke('check-for-updates')
      if (!result.success) {
        updateStatusText.textContent = `Error: ${result.error || 'Failed to check for updates'}`
        checkUpdateBtn.disabled = false
        checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update</span><span>Check for Update</span>'
      }
    } catch (error) {
      updateStatusText.textContent = `Error: ${error.message || 'Failed to check for updates'}`
      checkUpdateBtn.disabled = false
      checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update</span><span>Check for Update</span>'
    }
  })
}

// Listen for update status from main process
ipcRenderer.on('update-status', (event, { status, message, data }) => {
  if (!updateStatusText || !checkUpdateBtn) return
  
  updateStatusText.textContent = message
  
  switch (status) {
    case 'checking':
      checkUpdateBtn.disabled = true
      checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span><span>Checking...</span>'
      break
      
    case 'available':
      checkUpdateBtn.disabled = false
      checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">download</span><span>Download Update</span>'
      checkUpdateBtn.onclick = async () => {
        checkUpdateBtn.disabled = true
        checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span><span>Downloading...</span>'
        updateStatusText.textContent = 'Downloading update...'
        try {
          await ipcRenderer.invoke('download-update')
        } catch (error) {
          updateStatusText.textContent = `Download failed: ${error.message}`
          checkUpdateBtn.disabled = false
          checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">download</span><span>Download Update</span>'
        }
      }
      break
      
    case 'not-available':
      checkUpdateBtn.disabled = false
      checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Up to Date</span>'
      setTimeout(() => {
        checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update</span><span>Check for Update</span>'
        checkUpdateBtn.onclick = async () => {
          checkUpdateBtn.disabled = true
          checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span><span>Checking...</span>'
          updateStatusText.textContent = 'Checking for updates...'
          try {
            await ipcRenderer.invoke('check-for-updates')
          } catch (error) {
            updateStatusText.textContent = `Error: ${error.message || 'Failed to check for updates'}`
            checkUpdateBtn.disabled = false
            checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update</span><span>Check for Update</span>'
          }
        }
      }, 3000)
      break
      
    case 'error':
      checkUpdateBtn.disabled = false
      checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">error</span><span>Retry</span>'
      checkUpdateBtn.onclick = async () => {
        checkUpdateBtn.disabled = true
        checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span><span>Checking...</span>'
        updateStatusText.textContent = 'Checking for updates...'
        try {
          await ipcRenderer.invoke('check-for-updates')
        } catch (error) {
          updateStatusText.textContent = `Error: ${error.message || 'Failed to check for updates'}`
          checkUpdateBtn.disabled = false
          checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update</span><span>Check for Update</span>'
        }
      }
      break
      
    case 'download-progress':
      if (data) {
        const percent = Math.round(data.percent || 0)
        updateStatusText.textContent = `Downloading: ${percent}%`
      }
      break
      
    case 'downloaded':
      updateDownloaded = true
      checkUpdateBtn.disabled = false
      checkUpdateBtn.innerHTML = '<span class="material-symbols-outlined">restart_alt</span><span>Restart to Install</span>'
      checkUpdateBtn.onclick = async () => {
        if (confirm('The update will be installed when you restart the app. Restart now?')) {
          try {
            await ipcRenderer.invoke('install-update')
          } catch (error) {
            updateStatusText.textContent = `Installation failed: ${error.message}`
          }
        }
      }
      break
  }
})
