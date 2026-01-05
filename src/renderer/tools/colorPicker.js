function initColorPickerTool(deps) {
  const { 
    state, 
    selectTool, 
    textTool, 
    playSound, 
    hideAllTooltips, 
    closeAllPopups,
    DEFAULT_ACCENT_COLOR 
  } = deps

  let isCustomColorActive = false
  let customColorValue = null

  function isLightColor(color) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  function updateCustomColorButton(color) {
    const customBtn = document.getElementById('custom-color-btn')
    if (customBtn && color) {
      document.documentElement.style.setProperty('--custom-color-bg', color)
      customBtn.removeAttribute('style')

      customBtn.style.setProperty('background-color', color, 'important')
      customBtn.style.setProperty('background', color, 'important')
      customBtn.style.backgroundColor = color
      customBtn.style.background = color

      customBtn.setAttribute('data-custom-color', color)

      const icon = customBtn.querySelector('.material-symbols-outlined')
      if (icon) {
        const theme = document.body.getAttribute('data-theme') || 'dark'
        let iconColor
        if (theme === 'light') {
          iconColor = isLightColor(color) ? '#000000' : '#ffffff'
        } else {
          iconColor = isLightColor(color) ? '#000000' : '#ffffff'
        }
        icon.style.color = iconColor
        icon.style.setProperty('color', iconColor, 'important')
      }

      void customBtn.offsetWidth
    }
  }

  function setColor(color, isCustom = false) {
    state.color = color

    if (state.tool === 'select' && state.selectedElements.length > 0) {
      selectTool.updateSelectedColor(color)
    }

    if (textTool) {
      textTool.updateCurrentTextColor(color)
    }

    document.documentElement.style.setProperty('--selected-color', color)
    
    const r = parseInt(color.substr(1, 2), 16)
    const g = parseInt(color.substr(3, 2), 16)
    const b = parseInt(color.substr(5, 2), 16)
    const shadowColor = `rgba(${r}, ${g}, ${b}, 0.3)`
    document.documentElement.style.setProperty('--selected-color-shadow', shadowColor)
    
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('active')
    })

    document.querySelectorAll('.color-option').forEach(option => {
      option.classList.remove('active')
    })

    const presetSwatch = document.querySelector(`.color-swatch[data-color="${color}"]`)
    const presetOption = document.querySelector(`.color-option[data-color="${color}"]`)
    
    if ((presetSwatch || presetOption) && !isCustom) {
      if (presetSwatch) {
        presetSwatch.classList.add('active')
        presetSwatch.style.setProperty('border-color', color, 'important')
      }
      if (presetOption) {
        presetOption.classList.add('active')
        presetOption.style.setProperty('border-color', color, 'important')
      }
      isCustomColorActive = false
      customColorValue = null
      
      if (presetOption) {
        localStorage.setItem('last-preset-color', color)
        localStorage.setItem('custom-color', color)
        localStorage.setItem('is-custom-color-active', 'false')
        updateCustomColorButton(color)
      }
    } else {
      isCustomColorActive = true
      customColorValue = color
      localStorage.setItem('custom-color', color)
      localStorage.setItem('is-custom-color-active', 'true')
      const customBtn = document.getElementById('custom-color-btn')
      if (customBtn) {
        customBtn.classList.add('active')
        updateCustomColorButton(color)
      }
    }
  }

  function setInitialColorBorder() {
    const initialColor = state.color
    const activeSwatch = document.querySelector(`.color-swatch[data-color="${initialColor}"]`)
    if (activeSwatch && !activeSwatch.classList.contains('custom-color')) {
      activeSwatch.classList.add('active')
      activeSwatch.style.setProperty('border-color', initialColor, 'important')
      
      document.documentElement.style.setProperty('--selected-color', initialColor)
      const r = parseInt(initialColor.substr(1, 2), 16)
      const g = parseInt(initialColor.substr(3, 2), 16)
      const b = parseInt(initialColor.substr(5, 2), 16)
      const shadowColor = `rgba(${r}, ${g}, ${b}, 0.3)`
      document.documentElement.style.setProperty('--selected-color-shadow', shadowColor)
    }
  }

  function initColorPicker() {
    const colorPickerInput = document.getElementById('color-picker-input')
    if (!colorPickerInput) {
      setTimeout(initColorPicker, 100)
      return
    }

    const colorToShow = (isCustomColorActive && customColorValue) ? customColorValue : state.color
    colorPickerInput.value = colorToShow

    colorPickerInput.addEventListener('change', (e) => {
      const hexColor = e.target.value
      localStorage.setItem('custom-color', hexColor)
      localStorage.setItem('is-custom-color-active', 'true')
      updateCustomColorButton(hexColor)
      setTimeout(() => updateCustomColorButton(hexColor), 10)
      setColor(hexColor, true)
      setTimeout(() => updateCustomColorButton(hexColor), 50)
      
      playSound('color')

      const accentColor = localStorage.getItem('accent-color') || DEFAULT_ACCENT_COLOR
      const isLight = isLightColor(accentColor)
      const textColor = isLight ? '#000000' : '#ffffff'
      document.documentElement.style.setProperty('--picker-btn-text-color', textColor)
      const pickerBtn = document.getElementById('open-color-picker-btn')
      if (pickerBtn) {
        pickerBtn.style.color = textColor
      }
    })

    const customColorBtn = document.getElementById('custom-color-btn')
    const customColorPopup = document.getElementById('custom-color-popup')
    const openColorPickerBtn = document.getElementById('open-color-picker-btn')
    
    if (customColorBtn && customColorPopup) {
      customColorBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        hideAllTooltips()
        
        const wasOpen = customColorPopup.classList.contains('show')
        closeAllPopups()
        if (!wasOpen) {
          customColorPopup.classList.add('show')
        }
      })

      if (openColorPickerBtn) {
        openColorPickerBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          e.preventDefault()
          
          customColorPopup.classList.remove('show')
          
          const colorToShow = (isCustomColorActive && customColorValue) ? customColorValue : state.color
          colorPickerInput.value = colorToShow
          
          colorPickerInput.click()
        })
      }
    }

    setTimeout(() => {
      document.querySelectorAll('.color-option').forEach(option => {
        const color = option.dataset.color

        if (color) {
          option.addEventListener('mouseenter', () => {
            option.style.setProperty('border-color', color, 'important')
          })
          
          option.addEventListener('mouseleave', () => {
            if (!option.classList.contains('active')) {
              option.style.removeProperty('border-color')
            }
          })
        }
        
        option.addEventListener('click', (e) => {
          e.stopPropagation()
          if (color) {
            playSound('color')
            setColor(color, false) 
            
            localStorage.setItem('last-preset-color', color)
            localStorage.setItem('custom-color', color)
            localStorage.setItem('is-custom-color-active', 'false')
            
            updateCustomColorButton(color)
            
            if (customColorPopup) {
              customColorPopup.classList.remove('show')
            }
          }
        })
      })
    }, 100)
  }

  const savedCustomColor = localStorage.getItem('custom-color')
  const isCustomActive = localStorage.getItem('is-custom-color-active') === 'true'

  if (savedCustomColor && isCustomActive) {
    isCustomColorActive = true
    customColorValue = savedCustomColor
    state.color = savedCustomColor
    updateCustomColorButton(savedCustomColor)
    const customBtn = document.getElementById('custom-color-btn')
    if (customBtn) {
      customBtn.classList.add('active')
    }
    setColor(savedCustomColor, true)
  } else {
    const initialColor = state.color
    const isPreset = document.querySelector(`.color-swatch[data-color="${initialColor}"]`) !== null || 
                     document.querySelector(`.color-option[data-color="${initialColor}"]`) !== null
    if (!isPreset) {
      isCustomColorActive = true
      customColorValue = initialColor
      updateCustomColorButton(initialColor)
    }
  }

  document.querySelectorAll('.color-swatch[data-color]').forEach(swatch => {
    swatch.addEventListener('click', () => {
      playSound('color')
      setColor(swatch.dataset.color, false) 
    })
  })

  return {
    setColor,
    initColorPicker,
    setInitialColorBorder,
    isLightColor
  }
}

module.exports = { initColorPickerTool }