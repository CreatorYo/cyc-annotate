function isLightColor(color) {
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
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
  
  updateAllSegmentedControls()
}

function updateButtonTextColor(button) {
  button.style.color = ''
  const icon = button.querySelector('.material-symbols-outlined')
  if (icon) {
    icon.style.color = ''
  }
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

function updateSegmentedControl(containerId, value) {
  const container = document.getElementById(containerId)
  if (!container) return

  const buttons = Array.from(container.querySelectorAll('.control-btn'))
  const activeIndex = buttons.findIndex(btn => btn.dataset.value === value || btn.dataset.position === value)
  
  if (activeIndex !== -1) {
    container.setAttribute('data-active-index', activeIndex)
    buttons.forEach((btn, index) => {
      btn.classList.toggle('active', index === activeIndex)
      updateButtonTextColor(btn)
    })
  }
}

function updateAllSegmentedControls() {
  document.querySelectorAll('.segmented-control .control-btn.active').forEach(btn => {
    updateButtonTextColor(btn)
  })
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

function updatePositionToggle(layout, currentPosition) {
  const positionToggle = document.getElementById('position-toggle')
  if (!positionToggle) return

  const positionConfig = {
    vertical: {
      label: 'Vertical Position',
      description: 'Choose which side to place the vertical toolbar',
      positions: [
        { value: 'left', icon: 'align_horizontal_left', text: 'Left' },
        { value: 'right', icon: 'align_horizontal_right', text: 'Right' }
      ]
    },
    horizontal: {
      label: 'Horizontal Position',
      description: 'Choose which side to place the horizontal toolbar',
      positions: [
        { value: 'bottom', icon: 'align_vertical_bottom', text: 'Bottom' },
        { value: 'top', icon: 'align_vertical_top', text: 'Top' }
      ]
    }
  }

  const config = positionConfig[layout]
  if (!config) return

  const positionLabel = document.getElementById('position-label')
  const positionDescription = document.getElementById('position-description')
  
  if (positionLabel) positionLabel.textContent = config.label
  if (positionDescription) positionDescription.textContent = config.description

  positionToggle.innerHTML = config.positions.map(pos => `
    <button class="control-btn" data-value="${pos.value}" title="${pos.text}">
      <span class="material-symbols-outlined">${pos.icon}</span>
      <span>${pos.text}</span>
    </button>
  `).join('')

  updateSegmentedControl('position-toggle', currentPosition)

  positionToggle.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const position = btn.dataset.value
      const type = layout === 'vertical' ? 'vertical' : 'horizontal'
      if (typeof window.applyPosition === 'function') {
        window.applyPosition(type, position)
      }
    })
  })
}

module.exports = {
  isLightColor,
  updateButtonTextColor,
  updateAccentColorContrast,
  updateToggleSwitchColor,
  updateSegmentedControl,
  updateAllSegmentedControls,
  normalizeHex,
  getColorForPicker,
  updatePositionToggle
}