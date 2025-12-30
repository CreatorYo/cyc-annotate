const { ipcRenderer } = require('electron')

let osTheme = 'dark'

function getOSTheme() {
  return osTheme
}

function getEffectiveTheme(theme) {
  return theme === 'system' ? getOSTheme() : theme
}

function applyTheme(theme) {
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
  
  updateToolbarBackgroundColor()
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
  
  if (localStorage.getItem('toolbar-accent-bg') === 'true') {
    const tintedBg = darkenTintColor(
      localStorage.getItem('accent-color') || '#3bbbf6',
      getEffectiveTheme(localStorage.getItem('theme') || 'system')
    )
    const el = Object.assign(document.createElement('style'), {
      id: 'toolbar-bg-override',
      textContent: `:root, [data-theme="dark"], [data-theme="light"], body { --toolbar-bg: ${tintedBg} !important; }`
    })
    document.head.appendChild(el)
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
    const savedTheme = localStorage.getItem('theme') || 'system'
    if (savedTheme === 'system') {
      const effectiveTheme = getEffectiveTheme(savedTheme)
      document.body.setAttribute('data-theme', effectiveTheme)
    }
  })

  const savedTheme = localStorage.getItem('theme') || 'system'
  applyTheme(savedTheme)

  ipcRenderer.on('os-theme-changed', (event, effectiveTheme) => {
    osTheme = effectiveTheme
    const currentTheme = localStorage.getItem('theme') || 'system'
    if (currentTheme === 'system') {
      document.body.setAttribute('data-theme', effectiveTheme)
      updateToolbarBackgroundColor()
    }
  })

  ipcRenderer.on('theme-changed', (event, theme) => {
    applyTheme(theme)
    updateToolbarBackgroundColor()
  })

  updateToolbarBackgroundColor()
}

module.exports = {
  initThemeManager,
  applyTheme,
  getOSTheme,
  getEffectiveTheme,
  darkenTintColor,
  updateToolbarBackgroundColor
}