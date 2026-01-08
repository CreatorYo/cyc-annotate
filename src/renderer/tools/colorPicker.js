function initColorPickerTool(deps) {
  const {
    state,
    selectTool,
    textTool,
    playSound,
    hideAllTooltips,
    closeAllPopups,
  } = deps

  let isCustomColorActive = false
  let customColorValue = null
  let currentH = 0, currentS = 1, currentV = 1

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  }

  function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  function rgbToHsv(r, g, b) {
    r /= 255, g /= 255, b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s, v = max
    const d = max - min
    s = max === 0 ? 0 : d / max
    if (max === min) {
      h = 0
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }
    return { h, s, v }
  }

  function hsvToRgb(h, s, v) {
    let r, g, b
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break
      case 1: r = q, g = v, b = p; break
      case 2: r = p, g = v, b = t; break
      case 3: r = p, g = q, b = v; break
      case 4: r = t, g = p, b = v; break
      case 5: r = v, g = p, b = q; break
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
  }

  function isLightColor(color) {
    const rgb = hexToRgb(color)
    if (!rgb) return false
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 > 0.5
  }

  function normalizeHex(hex) {
    if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
      return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    return hex
  }

  function updateThemeColors(color) {
    document.documentElement.style.setProperty('--selected-color', color)
    const rgb = hexToRgb(color)
    if (rgb) {
      document.documentElement.style.setProperty('--selected-color-shadow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`)
    }
  }

  function syncPickerWithColor(hex) {
    const rgb = hexToRgb(hex)
    if (rgb) {
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
      currentH = hsv.h
      currentS = hsv.s
      currentV = hsv.v
      updateCustomPickerUI()
    }
  }

  function updateCustomPickerUI() {
    const svPicker = document.getElementById('sv-picker')
    const svCursor = document.getElementById('sv-cursor')
    const hueCursor = document.getElementById('hue-cursor')
    const colorPreview = document.getElementById('color-preview')
    const hexInput = document.getElementById('hex-input')

    if (!svPicker || !svCursor || !hueCursor) return

    const baseRgb = hsvToRgb(currentH, 1, 1)
    svPicker.style.backgroundColor = `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`
    svCursor.style.left = (currentS * 100) + '%'
    svCursor.style.top = ((1 - currentV) * 100) + '%'
    hueCursor.style.left = (currentH * 100) + '%'

    const currentRgb = hsvToRgb(currentH, currentS, currentV)
    const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)

    if (colorPreview) colorPreview.style.backgroundColor = currentHex
    if (hexInput && document.activeElement !== hexInput) hexInput.value = currentHex

    setColor(currentHex, true)
  }

  function updateCustomColorButton(color) {
    const customBtn = document.getElementById('custom-color-btn')
    if (!customBtn || !color) return

    document.documentElement.style.setProperty('--custom-color-bg', color)
    customBtn.style.background = color
    customBtn.setAttribute('data-custom-color', color)

    const icon = customBtn.querySelector('.material-symbols-outlined')
    if (icon) {
      const iconColor = isLightColor(color) ? '#000000' : '#ffffff'
      icon.style.setProperty('color', iconColor, 'important')
    }
  }

  function setColor(color, isCustom = false) {
    const upperColor = color.toUpperCase()
    state.color = upperColor

    if (state.tool === 'select' && state.selectedElements.length > 0) {
      selectTool.updateSelectedColor(upperColor)
    }
    if (textTool) {
      textTool.updateCurrentTextColor(upperColor)
    }

    updateThemeColors(upperColor)

    document.querySelectorAll('.color-swatch, .color-option').forEach(el => {
      const elColor = el.dataset.color?.toUpperCase()
      const isActive = elColor === upperColor
      el.classList.toggle('active', isActive)
      if (isActive) el.style.setProperty('border-color', upperColor, 'important')
      else el.style.removeProperty('border-color')
    })

    const customBtn = document.getElementById('custom-color-btn')
    const customPickerPopup = document.getElementById('custom-color-picker')

    const isPreset = !!Array.from(document.querySelectorAll('.color-swatch[data-color], .color-option[data-color]'))
      .find(el => el.dataset.color.toUpperCase() === upperColor)

    if (isPreset && !isCustom) {
      isCustomColorActive = false
      customColorValue = null
      if (customBtn) customBtn.classList.remove('active')
    } else {
      isCustomColorActive = true
      customColorValue = upperColor
      if (customBtn) customBtn.classList.add('active')
    }

    if (isCustom) {
      updateCustomColorButton(upperColor)
    }

    if (!isCustom && customPickerPopup?.classList.contains('show')) {
      syncPickerWithColor(upperColor)
    }
  }

  function setInitialColorBorder() {
    const initialColor = state.color
    updateThemeColors(initialColor)

    const activeSwatch = document.querySelector(`.color-swatch[data-color="${initialColor}"]`)
    if (activeSwatch && !activeSwatch.classList.contains('custom-color')) {
      activeSwatch.classList.add('active')
      activeSwatch.style.setProperty('border-color', initialColor, 'important')
    }
  }

  function initCustomColorPicker() {
    const svContainer = document.querySelector('.sv-picker-container')
    const hueContainer = document.querySelector('.hue-picker-container')
    const hexInput = document.getElementById('hex-input')
    const customPickerPopup = document.getElementById('custom-color-picker')
    const eyedropperBtn = document.getElementById('eyedropper-btn')
    const dragHandle = document.getElementById('picker-drag-handle')

    let isDraggingSV = false, isDraggingHue = false

    async function handleEyeDropper() {
      if (!window.EyeDropper) return
      if (customPickerPopup) customPickerPopup.classList.remove('show')
      closeAllPopups()
      
      try {
        const result = await new EyeDropper().open()
        const hex = result.sRGBHex.toUpperCase()
        syncPickerWithColor(hex)
        setColor(hex, true)
        playSound('color')
      } catch (e) {
        if (customPickerPopup) customPickerPopup.classList.add('show')
      }
    }

    if (eyedropperBtn) eyedropperBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      handleEyeDropper()
    })

    const handleSVMouse = (e) => {
      const rect = svContainer.getBoundingClientRect()
      currentS = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      currentV = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      updateCustomPickerUI()
    }

    const handleHueMouse = (e) => {
      const rect = hueContainer.getBoundingClientRect()
      currentH = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      updateCustomPickerUI()
    }

    if (svContainer) svContainer.addEventListener('mousedown', (e) => { isDraggingSV = true; handleSVMouse(e) })
    if (hueContainer) hueContainer.addEventListener('mousedown', (e) => { isDraggingHue = true; handleHueMouse(e) })

    window.addEventListener('mousemove', (e) => {
      if (isDraggingSV) handleSVMouse(e)
      if (isDraggingHue) handleHueMouse(e)
    })
    window.addEventListener('mouseup', () => { isDraggingSV = false; isDraggingHue = false })

    if (hexInput) {
      hexInput.maxLength = 7
      hexInput.addEventListener('input', (e) => {
        let hex = e.target.value.trim()
        if (!hex.startsWith('#') && hex.length > 0) hex = '#' + hex
        if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
          const normalized = normalizeHex(hex)
          syncPickerWithColor(normalized)
          setColor(normalized.toUpperCase(), true)
        }
      })
      hexInput.addEventListener('blur', (e) => {
        const hex = e.target.value.trim()
        if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
          const normalized = normalizeHex(hex)
          e.target.value = normalized.toUpperCase()
          setColor(normalized.toUpperCase(), true)
        } else {
          e.target.value = state.color
        }
      })
      hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          hexInput.blur()
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          if (customPickerPopup) {
            customPickerPopup.style.transition = 'opacity 0.1s ease, transform 0.1s ease, visibility 0s linear 0.1s'
            customPickerPopup.classList.remove('show')
          }
        }
      })
    }

    let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0
    dragHandle?.addEventListener('mousedown', (e) => {
      isDragging = true
      const rect = customPickerPopup.getBoundingClientRect()
      const parentRect = customPickerPopup.offsetParent.getBoundingClientRect()
      initialLeft = rect.left - parentRect.left
      initialTop = rect.top - parentRect.top
      startX = e.clientX
      startY = e.clientY
      customPickerPopup.classList.add('dragged')
      customPickerPopup.style.cssText = `left: ${initialLeft}px; top: ${initialTop}px; transform: none; bottom: auto; right: auto; margin: 0;`
      e.preventDefault(); e.stopPropagation()
    })

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      const parentRect = customPickerPopup.offsetParent.getBoundingClientRect()
      const x = Math.max(-parentRect.left, Math.min(window.innerWidth - parentRect.left - customPickerPopup.offsetWidth, initialLeft + e.clientX - startX))
      const y = Math.max(-parentRect.top, Math.min(window.innerHeight - parentRect.top - customPickerPopup.offsetHeight, initialTop + e.clientY - startY))
      customPickerPopup.style.left = x + 'px'
      customPickerPopup.style.top = y + 'px'
    })
    window.addEventListener('mouseup', () => isDragging = false)
    dragHandle?.addEventListener('dblclick', () => {
      customPickerPopup.classList.remove('dragged')
      customPickerPopup.removeAttribute('style')
    })
  }

  function initColorPicker() {
    const customColorBtn = document.getElementById('custom-color-btn')
    const customColorPopup = document.getElementById('custom-color-popup')
    const openPickerBtn = document.getElementById('open-color-picker-btn')
    const customPickerPopup = document.getElementById('custom-color-picker')
    
    initCustomColorPicker()

    const openCustomPicker = () => {
      const wasOpen = customPickerPopup.classList.contains('show')
      if (wasOpen) customPickerPopup.style.transition = 'opacity 0.1s ease, transform 0.1s ease, visibility 0s linear 0.1s'
      closeAllPopups()
      if (!wasOpen) {
        syncPickerWithColor(isCustomColorActive ? (customColorValue || state.color) : state.color)
        customPickerPopup.style.transition = 'opacity 0.1s ease, transform 0.1s ease, visibility 0s'
        void customPickerPopup.offsetWidth
        customPickerPopup.classList.add('show')
      }
    }

    if (customColorBtn && customColorPopup) {
      customColorBtn.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault()
        const wasOpen = customColorPopup.classList.contains('show')
        hideAllTooltips(); closeAllPopups()
        if (!wasOpen) customColorPopup.classList.add('show')
      })
      customColorBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault(); hideAllTooltips(); openCustomPicker()
      })
    }
    if (openPickerBtn) openPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault(); openCustomPicker()
    })

    document.querySelectorAll('.color-option').forEach(option => {
      const color = option.dataset.color
      if (!color) return
      option.addEventListener('mouseenter', () => option.style.setProperty('border-color', color, 'important'))
      option.addEventListener('mouseleave', () => { if (!option.classList.contains('active')) option.style.removeProperty('border-color') })
      option.addEventListener('click', (e) => {
        e.stopPropagation()
        playSound('color'); setColor(color, false)
        localStorage.setItem('last-preset-color', color)
        updateCustomColorButton(color)
        if (customColorPopup) customColorPopup.classList.remove('show')
      })
    })

    document.querySelectorAll('.color-swatch[data-color]').forEach(swatch => {
      swatch.addEventListener('click', () => { playSound('color'); setColor(swatch.dataset.color, false) })
    })

    const normalizedInitial = state.color.toUpperCase()
    const isPreset = !!Array.from(document.querySelectorAll('.color-swatch[data-color], .color-option[data-color]'))
      .find(el => el.dataset.color.toUpperCase() === normalizedInitial)

    if (!isPreset) {
      isCustomColorActive = true
      customColorValue = normalizedInitial
      updateCustomColorButton(normalizedInitial)
    }
  }

  return { setColor, initColorPicker, setInitialColorBorder, isLightColor }
}

module.exports = { initColorPickerTool }