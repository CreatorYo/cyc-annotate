const { isLightColor } = require('./colorUtils.js')

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

module.exports = {
  updateToggleSwitchColor
}
