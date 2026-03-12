function updateDropdownMenuUI(dropdownId, value) {
  const dropdown = document.getElementById(dropdownId)
  if (!dropdown) return

  const items = dropdown.querySelectorAll('.dropdown-menu-item')
  let selectedItem = null

  items.forEach(item => {
    if (item.dataset.value === value) {
      item.classList.add('selected')
      selectedItem = item
    } else {
      item.classList.remove('selected')
    }
  })

  if (selectedItem) {
    const trigger = dropdown.querySelector('.dropdown-menu-trigger')
    const triggerIcon = trigger.querySelector('.trigger-content .material-symbols-outlined')
    const triggerText = trigger.querySelector('.trigger-content span:not(.material-symbols-outlined)')
    
    const iconSpan = selectedItem.querySelector('.material-symbols-outlined')
    const textSpan = selectedItem.querySelector('span:not(.material-symbols-outlined)')
    
    if (triggerIcon && iconSpan) triggerIcon.textContent = iconSpan.textContent
    if (triggerText && textSpan) triggerText.textContent = textSpan.textContent
  }
}

function updateDropdownMenu(dropdownId, value) {
  updateDropdownMenuUI(dropdownId, value)
}

function updatePositionToggle(layout, currentPosition) {
  const dropdownMenu = document.getElementById('position-dropdown-menu')
  if (!dropdownMenu) return

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

  dropdownMenu.innerHTML = config.positions.map(pos => `
    <div class="dropdown-menu-item" data-value="${pos.value}">
      <span class="material-symbols-outlined">${pos.icon}</span>
      <span>${pos.text}</span>
    </div>
  `).join('')

  updateDropdownMenu('position-dropdown', currentPosition)

  dropdownMenu.querySelectorAll('.dropdown-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = layout === 'vertical' ? 'vertical' : 'horizontal'
      const value = item.dataset.value
      if (typeof window.applyPosition === 'function') {
        window.applyPosition(type, value)
      }
      const dropdown = document.getElementById('position-dropdown')
      if (dropdown) dropdown.classList.remove('open')
    })
  })
}

module.exports = {
  updateDropdownMenu,
  updatePositionToggle
}