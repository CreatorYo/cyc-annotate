function hideAllTooltips() {
  document.querySelectorAll('.custom-tooltip').forEach(tooltip => {
    tooltip.classList.remove('show')
  })
}

function formatShortcut(shortcut) {
  const parts = shortcut.split('+')
  const formattedParts = []
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    
    if (part === 'Ctrl' || part === 'Shift' || part === 'Alt' || part === 'Meta' || part === 'Cmd') {
      formattedParts.push(part)
    } else if (part === 'Esc') {
      formattedParts.push('Esc')
    } else if (part.includes('-')) {
      formattedParts.push(part.replace('-', ' - '))
    } else if (part.length === 1) {
      formattedParts.push(part.toUpperCase())
    } else {
      formattedParts.push(part)
    }
  }

  return formattedParts.join(' + ')
}

function createTooltip(element) {
  const tooltipText = element.getAttribute('data-tooltip')
  const shortcut = element.getAttribute('data-shortcut')
  
  if (!tooltipText) return

  const existingTooltip = element.querySelector('.custom-tooltip')
  if (existingTooltip) {
    existingTooltip.remove()
  }
  
  const tooltip = document.createElement('div')
  tooltip.className = 'custom-tooltip'
  
  const textSpan = document.createElement('span')
  textSpan.className = 'tooltip-text'
  textSpan.textContent = tooltipText
  tooltip.appendChild(textSpan)
  
  if (shortcut) {
    const shortcutSpan = document.createElement('span')
    shortcutSpan.className = 'tooltip-shortcut'
    shortcutSpan.textContent = formatShortcut(shortcut)
    tooltip.appendChild(shortcutSpan)
  }
  
  element.appendChild(tooltip)
  
  let showTimeout
  let hideTimeout
  
  element.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout)
    showTimeout = setTimeout(() => {
      tooltip.classList.add('show')
    }, 300)
  })
  
  element.addEventListener('mouseleave', () => {
    clearTimeout(showTimeout)
    tooltip.classList.remove('show')
    hideAllTooltips()
  })
}

function initTooltips() {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      document.querySelectorAll('[data-tooltip]').forEach(createTooltip)
    }, 100)
  })

  setTimeout(() => {
    document.querySelectorAll('[data-tooltip]').forEach(createTooltip)
  }, 500)

  document.addEventListener('click', (e) => {
    if (e.target.closest('.stroke-popup, .drawing-tools-popup, .shapes-popup, .custom-color-popup')) {
      setTimeout(() => {
        document.querySelectorAll('.stroke-popup [data-tooltip], .drawing-tools-popup [data-tooltip], .shapes-popup [data-tooltip], .custom-color-popup [data-tooltip]').forEach(createTooltip)
      }, 50)
    }
  })
}

module.exports = {
  initTooltips,
  createTooltip,
  hideAllTooltips
}