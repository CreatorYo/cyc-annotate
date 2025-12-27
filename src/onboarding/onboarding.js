const { ipcRenderer } = require('electron')

let currentStep = 0
let currentShortcut = 'Control+Shift+D'
let currentColor = '#40E0D0'
let isRecordingShortcut = false
let pressedKeys = []

function formatShortcut(keys) {
  return keys.map(k => {
    if (k === 'Control') return 'Ctrl'
    if (k === 'Meta') return 'Cmd'
    return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()
  }).join(' + ')
}

function parseShortcut(str) {
  return str.split('+').map(k => k.trim())
}

function updateProgress() {
  document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
    indicator.classList.remove('active', 'completed')
    if (index < currentStep) {
      indicator.classList.add('completed')
    } else if (index === currentStep) {
      indicator.classList.add('active')
    }
  })
}

function updateBottomNav() {
  const backBtn = document.getElementById('bottom-back-btn')
  const nextBtn = document.getElementById('bottom-next-btn')
  
  if (currentStep === 0) {
    backBtn.style.display = 'none'
    nextBtn.textContent = 'Get Started'
  } else if (currentStep === 3) {
    backBtn.style.display = 'flex'
    nextBtn.textContent = 'Finish'
  } else {
    backBtn.style.display = 'flex'
    nextBtn.textContent = 'Next'
  }
}

function showStep(step) {
  document.querySelectorAll('.onboarding-step').forEach(s => {
    s.classList.remove('active')
  })
  const stepElement = document.querySelector(`.onboarding-step[data-step="${step}"]`)
  if (stepElement) {
    stepElement.classList.add('active')
  }
  currentStep = step
  updateProgress()
  updateBottomNav()
}

function nextStep() {
  if (currentStep < 3) {
    showStep(currentStep + 1)
  }
}

function prevStep() {
  if (currentStep > 0) {
    showStep(currentStep - 1)
  }
}

const bottomBackBtn = document.getElementById('bottom-back-btn')
const bottomNextBtn = document.getElementById('bottom-next-btn')

if (bottomBackBtn) {
  bottomBackBtn.addEventListener('click', () => {
    prevStep()
  })
}

if (bottomNextBtn) {
  bottomNextBtn.addEventListener('click', () => {
    if (currentStep === 3) {
      finishOnboarding()
    } else {
      nextStep()
    }
  })
}

const shortcutInput = document.getElementById('shortcut-input')
const resetShortcutBtn = document.getElementById('reset-shortcut-btn')

if (shortcutInput) {
  shortcutInput.value = formatShortcut(parseShortcut(currentShortcut))
  
  shortcutInput.addEventListener('focus', () => {
    isRecordingShortcut = true
    pressedKeys = []
    shortcutInput.placeholder = 'Press your shortcut keys...'
    shortcutInput.value = ''
  })

  shortcutInput.addEventListener('blur', () => {
    isRecordingShortcut = false
    if (shortcutInput.value === '') {
      shortcutInput.value = formatShortcut(parseShortcut(currentShortcut))
    }
  })

  shortcutInput.addEventListener('keydown', (e) => {
    if (!isRecordingShortcut) return
    
    e.preventDefault()
    e.stopPropagation()

    const key = e.key
    if (key === 'Escape') {
      isRecordingShortcut = false
      shortcutInput.value = formatShortcut(parseShortcut(currentShortcut))
      shortcutInput.blur()
      return
    }

    if (key === 'Backspace' || key === 'Delete') {
      pressedKeys = []
      shortcutInput.value = ''
      return
    }

    if (!pressedKeys.includes(key)) {
      if (e.ctrlKey && !pressedKeys.includes('Control')) {
        pressedKeys.push('Control')
      }
      if (e.metaKey && !pressedKeys.includes('Meta')) {
        pressedKeys.push('Meta')
      }
      if (e.shiftKey && !pressedKeys.includes('Shift')) {
        pressedKeys.push('Shift')
      }
      if (e.altKey && !pressedKeys.includes('Alt')) {
        pressedKeys.push('Alt')
      }
      
      if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
        pressedKeys.push(key.toUpperCase())
      } else if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(key)) {
        pressedKeys.push(key)
      }
    }

    if (pressedKeys.length > 0) {
      const shortcutStr = pressedKeys.join('+')
      shortcutInput.value = formatShortcut(pressedKeys)
      currentShortcut = shortcutStr
    }
  })
}

if (resetShortcutBtn) {
  resetShortcutBtn.addEventListener('click', () => {
    currentShortcut = 'Control+Shift+D'
    const keys = parseShortcut(currentShortcut)
    shortcutInput.value = formatShortcut(keys)
  })
}

const colorPicker = document.getElementById('color-picker')
const colorHex = document.getElementById('color-hex')
const colorPreview = document.getElementById('color-preview')
const resetColorBtn = document.getElementById('reset-color-btn')

function normalizeHex(hex) {
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  }
  return hex
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  const r = parseInt(normalized.substr(1, 2), 16)
  const g = parseInt(normalized.substr(3, 2), 16)
  const b = parseInt(normalized.substr(5, 2), 16)
  return { r, g, b }
}

function updateColor(color) {
  currentColor = color
  if (colorPreview) {
    colorPreview.style.background = color
  }
  if (colorPicker) {
    colorPicker.value = color
  }
  if (colorHex) {
    colorHex.value = color
  }
  
  const rgb = hexToRgb(color)
  const hoverR = Math.max(0, rgb.r - 30)
  const hoverG = Math.max(0, rgb.g - 30)
  const hoverB = Math.max(0, rgb.b - 30)
  const hoverColor = `rgb(${hoverR}, ${hoverG}, ${hoverB})`
  
  document.documentElement.style.setProperty('--accent-color', color)
  document.documentElement.style.setProperty('--accent-hover', hoverColor)
}

if (colorPicker) {
  colorPicker.addEventListener('input', (e) => {
    updateColor(e.target.value)
  })
}

if (colorHex) {
  colorHex.addEventListener('input', (e) => {
    const hex = e.target.value.trim()
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex)
      updateColor(normalizedHex)
      if (colorPicker) colorPicker.value = normalizedHex
      e.target.value = normalizedHex
    }
  })

  colorHex.addEventListener('blur', (e) => {
    const hex = e.target.value.trim()
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex)
      e.target.value = normalizedHex
      updateColor(normalizedHex)
      if (colorPicker) colorPicker.value = normalizedHex
    } else {
      e.target.value = currentColor
    }
  })
}

if (colorPreview) {
  colorPreview.addEventListener('click', () => {
    if (colorPicker) colorPicker.click()
  })
}

document.querySelectorAll('.color-preset').forEach(preset => {
  preset.addEventListener('click', () => {
    const color = preset.getAttribute('data-color')
    updateColor(color)
  })
})

if (resetColorBtn) {
  resetColorBtn.addEventListener('click', () => {
    updateColor('#40E0D0')
  })
}

function finishOnboarding() {
  try {
    ipcRenderer.send('onboarding-complete', {
      shortcut: currentShortcut,
      accentColor: currentColor
    })
  } catch (error) {
    console.error('Error finishing onboarding:', error)
  }
}

updateProgress()
updateColor(currentColor)
updateBottomNav()

