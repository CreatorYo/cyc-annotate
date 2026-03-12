const { ipcRenderer } = require('electron')
const { DEFAULT_ACCENT_COLOR, DEFAULT_SHORTCUT } = require('../../../../shared/constants.js')
const { updateDropdownMenu } = require('./dropdownMenu.js')
const { updateToggleSwitchColor } = require('./toggleSwitch.js')
const { normalizeHex, getColorForPicker, updateAccentColorContrast } = require('./colorUtils.js')

function applyTheme(theme, notify = true) {
  localStorage.setItem('theme', theme)
  
  const effectiveTheme = theme === 'system' ? getOSTheme() : theme
  document.body.setAttribute('data-theme', effectiveTheme)

  updateDropdownMenu('theme-dropdown', theme)

  if (notify) {
    ipcRenderer.send('theme-changed', theme)
  }
  updateToolbarBackgroundColor()
}

function getOSTheme() {
  return window.osTheme
}

function getEffectiveTheme(theme) {
  return theme === 'system' ? getOSTheme() : theme
}

function updateToolbarBackgroundColor() {
  const styleEl = document.getElementById('toolbar-bg-override');
  if (styleEl) styleEl.remove();
  
  const useAccentBg = localStorage.getItem('toolbar-accent-bg') === 'true';
  if (useAccentBg) {
    const currentTheme = localStorage.getItem('theme') || 'system';
    const effectiveTheme = getEffectiveTheme(currentTheme);
    const tintedBg = darkenTintColor(
      localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR,
      effectiveTheme
    );
    
    const el = Object.assign(document.createElement('style'), {
      id: 'toolbar-bg-override',
      textContent: `body[data-theme="${effectiveTheme}"] { --toolbar-bg: ${tintedBg} !important; }`
    });
    document.head.appendChild(el);
    ipcRenderer.send('toolbar-bg-changed', { enabled: true, color: tintedBg });
  } else {
    ipcRenderer.send('toolbar-bg-changed', { enabled: false, color: null });
  }
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

function updateAccentColor(color) {
  const normalizedColor = normalizeHex(color)
  document.documentElement.style.setProperty('--accent-color', normalizedColor)
  
  updateAccentColorContrast(normalizedColor)
  localStorage.setItem('accent-color', normalizedColor)

  const accentColorPicker = document.getElementById('accent-color-picker')
  const accentColorHex = document.getElementById('accent-color-hex')
  const accentColorPreview = document.getElementById('accent-color-preview')

  if (accentColorPicker) accentColorPicker.value = getColorForPicker(normalizedColor)
  if (accentColorHex) accentColorHex.value = normalizedColor
  if (accentColorPreview) accentColorPreview.style.background = normalizedColor

  updateToggleSwitchColor()
  updateToolbarBackgroundColor()
  ipcRenderer.send('accent-color-changed', normalizedColor)
}

module.exports = {
  applyTheme,
  updateToolbarBackgroundColor,
  updateAccentColor,
  darkenTintColor,
  getEffectiveTheme
}
