const { ipcRenderer } = require('electron')
const { updateAccentColorContrast } = require('../../../pages/settings/utils/colorUtils.js')

const { DEFAULT_ACCENT_COLOR } = require('../../../../shared/constants.js')

let osTheme = 'dark'

function getOSTheme() {
  return osTheme
}

function getEffectiveTheme(theme) {
  return theme === 'system' ? getOSTheme() : theme
}

function applyTheme(theme, notify = true) {
  localStorage.setItem('theme', theme)
  
  const effectiveTheme = getEffectiveTheme(theme)
  document.body.setAttribute('data-theme', effectiveTheme)
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  const themeBtn = document.querySelector(`[data-theme="${theme}"]`)
  if (themeBtn) {
    themeBtn.classList.add('active')
  }

  const themeDropdown = document.getElementById('theme-dropdown')
  if (themeDropdown) {
    try {
      const { updateDropdownMenu } = require('../../../pages/settings/utils/dropdownMenu.js')
      updateDropdownMenu('theme-dropdown', theme)
    } catch (e) {
      ipcRenderer.invoke('show-error-dialog', 'UI Error', 'Failed to update theme dropdown menu', e.message)
    }
  }

  if (notify) {
    ipcRenderer.send('theme-changed', theme)
  }
  
  updateToolbarBackgroundColor()
}

function darkenTintColor(hexColor, theme) {
  let r, g, b;
  if (hexColor.length === 4) {
    r = parseInt(hexColor[1] + hexColor[1], 16);
    g = parseInt(hexColor[2] + hexColor[2], 16);
    b = parseInt(hexColor[3] + hexColor[3], 16);
  } else {
    r = parseInt(hexColor.slice(1, 3), 16);
    g = parseInt(hexColor.slice(3, 5), 16);
    b = parseInt(hexColor.slice(5, 7), 16);
  }

  const effectiveTheme = theme || document.body.getAttribute('data-theme') || 'dark';
  const isDark = effectiveTheme === 'dark';
  
  const [blendedR, blendedG, blendedB] = isDark
    ? [r, g, b].map(c => Math.floor(30 * 0.7 + (c * 0.25) * 0.3))
    : [r, g, b].map(c => Math.floor(255 * 0.85 + (c + (255 - c) * 0.7) * 0.15));
  
  return `#${[blendedR, blendedG, blendedB].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}

function updateToolbarBackgroundColor() {
  const styleEl = document.getElementById('toolbar-bg-override');
  if (styleEl) styleEl.remove();
  
  if (localStorage.getItem('toolbar-accent-bg') === 'true') {
    const currentTheme = localStorage.getItem('theme') || 'system';
    const effectiveTheme = getEffectiveTheme(currentTheme);
    const tintedBg = darkenTintColor(
      localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR,
      effectiveTheme
    );
    
    const el = Object.assign(document.createElement('style'), {
      id: 'toolbar-bg-override',
      textContent: `
        body[data-theme="${effectiveTheme}"] { 
          --toolbar-bg: ${tintedBg} !important; 
          --wb-bg: ${tintedBg} !important;
          --shelf-bg: ${tintedBg} !important;
          --panel-bg: ${tintedBg} !important;
          --dropdown-bg: ${tintedBg} !important;
          --widget-add-btn-bg: ${tintedBg} !important;
        }
      `
    });
    document.head.appendChild(el);
  }
}

function initThemeManager() {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme)
    })
  })

  ipcRenderer.invoke('get-os-theme').then(theme => {
    osTheme = theme
    window.osTheme = theme
    const savedTheme = localStorage.getItem('theme') || 'system'
    if (savedTheme === 'system') {
      const effectiveTheme = getEffectiveTheme(savedTheme)
      document.body.setAttribute('data-theme', effectiveTheme)
      updateToolbarBackgroundColor()
    }
  })

  let savedTheme = localStorage.getItem('theme') || 'system'
  if (savedTheme === 'undefined' || !['system', 'light', 'dark'].includes(savedTheme)) {
    savedTheme = 'system'
    localStorage.setItem('theme', 'system')
  }
  applyTheme(savedTheme)

  ipcRenderer.on('os-theme-changed', (event, effectiveTheme) => {
    osTheme = effectiveTheme
    window.osTheme = effectiveTheme
    const currentTheme = localStorage.getItem('theme') || 'system'
    if (currentTheme === 'system') {
      document.body.setAttribute('data-theme', effectiveTheme)
      updateToolbarBackgroundColor()
    }
  })

  ipcRenderer.on('theme-changed', (event, theme) => {
    applyTheme(theme, false)
  })

  ipcRenderer.on('accent-color-changed', (event, color) => {
    updateAccentColor(color)
  })

  ipcRenderer.on('windows-accent-color-changed', (event, color) => {
    updateAccentColor(color)
  })

  ipcRenderer.on('toolbar-accent-bg-changed', (event, enabled) => {
    localStorage.setItem('toolbar-accent-bg', enabled ? 'true' : 'false')
    updateToolbarBackgroundColor()
  })

  const savedAccentColor = localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR
  updateAccentColor(savedAccentColor)

  updateToolbarBackgroundColor()
}

function updateAccentColor(color, notify = false) {
  if (!color) return
  const normalizedColor = color.startsWith('#') ? color : `#${color}`
  localStorage.setItem('accent-color', normalizedColor)
  
  document.documentElement.style.setProperty('--accent-color', normalizedColor)
  
  let r, g, b;
  if (normalizedColor.length === 4) {
    r = parseInt(normalizedColor[1] + normalizedColor[1], 16);
    g = parseInt(normalizedColor[2] + normalizedColor[2], 16);
    b = parseInt(normalizedColor[3] + normalizedColor[3], 16);
  } else {
    r = parseInt(normalizedColor.slice(1, 3), 16);
    g = parseInt(normalizedColor.slice(3, 5), 16);
    b = parseInt(normalizedColor.slice(5, 7), 16);
  }
  document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`)
  
  updateAccentColorContrast(normalizedColor)
  
  const isLight = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
  const textColor = isLight ? '#000000' : '#ffffff'
  document.documentElement.style.setProperty('--picker-btn-text-color', textColor)
  document.documentElement.style.setProperty('--accent-text', textColor)
  document.documentElement.style.setProperty('--accent-btn-text-color', textColor)
  
  const accentColorPicker = document.getElementById('accent-color-picker')
  const accentColorHex = document.getElementById('accent-color-hex')
  const accentColorPreview = document.getElementById('accent-color-preview')
  const pickerBtn = document.getElementById('open-color-picker-btn')

  if (accentColorPicker) {
    const { getColorForPicker } = require('../../../pages/settings/utils/colorUtils.js');
    accentColorPicker.value = getColorForPicker(normalizedColor);
  }
  if (accentColorHex) accentColorHex.value = normalizedColor;
  if (accentColorPreview) accentColorPreview.style.background = normalizedColor
  if (pickerBtn) pickerBtn.style.color = textColor

  updateToolbarBackgroundColor()

  if (notify) {
    ipcRenderer.send('accent-color-changed', normalizedColor)
  }
}

module.exports = {
  initThemeManager,
  applyTheme,
  updateAccentColor,
  getOSTheme,
  getEffectiveTheme,
  darkenTintColor,
  updateToolbarBackgroundColor
}