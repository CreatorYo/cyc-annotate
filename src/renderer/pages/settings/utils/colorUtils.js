function isLightColor(color) {
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

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

function updateAccentColorContrast(color) {
  const normalizedColor = normalizeHex(color)
  const accentIsLight = isLightColor(normalizedColor)
  const buttonTextColor = accentIsLight ? '#000000' : '#ffffff'
  document.documentElement.style.setProperty('--accent-btn-text-color', buttonTextColor)
  
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
}

module.exports = {
  isLightColor,
  normalizeHex,
  getColorForPicker,
  updateAccentColorContrast
}