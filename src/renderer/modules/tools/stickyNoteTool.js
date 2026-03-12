const { ipcRenderer } = require('electron')

function initStickyNoteTool(state, canvas, helpers) {
  const { createElement, redrawCanvas, saveState } = helpers
  let editingBackup = null;

  const container = document.getElementById('sticky-note-input-container')
  const input = document.getElementById('sticky-note-input')
  const palette = document.getElementById('sticky-color-palette')
  const menuBtn = document.getElementById('sticky-color-menu-btn')
  const header = container?.querySelector('.sticky-note-header')
  const closeBtn = document.getElementById('close-sticky-btn')
  const colorBtns = container?.querySelectorAll('.sticky-color-btn')
  const formatBtns = container?.querySelectorAll('.sticky-format-btn')

  if (menuBtn) {
    menuBtn.onclick = (e) => {
      e.stopPropagation()
      palette.classList.toggle('show')
      menuBtn.classList.toggle('active')
    }
  }

  if (colorBtns) {
    colorBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation()
        const color = btn.dataset.color
        updateActiveNoteColor(color)
        
        if (palette) palette.classList.remove('show')
        if (menuBtn) menuBtn.classList.remove('active')
        input.focus()
      }
    })
  }
  function updateFormattingState() {
    if (!formatBtns) return
    formatBtns.forEach(btn => {
      const format = btn.dataset.format
      if (format === 'bold' || format === 'italic' || format === 'underline') {
        const isActive = document.queryCommandState(format)
        btn.classList.toggle('active', isActive)
      } else if (format === 'strikethrough') {
        const isActive = document.queryCommandState('strikeThrough')
        btn.classList.toggle('active', isActive)
      } else if (format === 'bullet') {
        const isActive = document.queryCommandState('insertUnorderedList')
        btn.classList.toggle('active', isActive)
      } else if (format === 'numbered') {
        const isActive = document.queryCommandState('insertOrderedList')
        btn.classList.toggle('active', isActive)
      }
    })
  }

  if (input) {
    input.addEventListener('keyup', updateFormattingState)
    input.addEventListener('mouseup', updateFormattingState)
    input.addEventListener('input', updateFormattingState)
    input.addEventListener('focus', updateFormattingState)
  }

  if (formatBtns) {
    formatBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation()
        const format = btn.dataset.format
        
        if (format === 'bullet') {
          document.execCommand('insertUnorderedList', false, null)
        } else if (format === 'numbered') {
          document.execCommand('insertOrderedList', false, null)
        } else {
          document.execCommand(format, false, null)
        }
        input.focus()
        updateFormattingState()
      }
    })
  }

  const fontMenuBtn = document.getElementById('sticky-font-menu-btn')
  const fontDropdown = document.getElementById('sticky-font-dropdown')
  const fontOptions = document.querySelectorAll('.sticky-font-option')

  if (fontMenuBtn && fontDropdown) {
    fontMenuBtn.onclick = (e) => {
      e.stopPropagation()
      
      if (fontDropdown.classList.contains('show')) {
        fontDropdown.classList.remove('show')
        fontMenuBtn.classList.remove('active')
      } else {
        const rect = fontMenuBtn.getBoundingClientRect()
        
        fontDropdown.style.left = rect.left + 'px'
        fontDropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px' 
        fontDropdown.style.top = 'auto'
        
        fontDropdown.classList.add('show')
        fontMenuBtn.classList.add('active')
      }
    }
  }

  if (fontOptions) {
    fontOptions.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation()
        const font = btn.dataset.font
        
        if (font === 'monospace') {
          input.style.fontFamily = "'Courier New', monospace"
        } else if (font === 'opendyslexic') {
          input.style.fontFamily = "'OpenDyslexicRegular', 'Comic Sans MS', sans-serif"
        } else {
          input.style.fontFamily = "'Comic Sans MS', 'Comic Sans', cursive, sans-serif"
        }
        
        fontOptions.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        
        if (fontDropdown) fontDropdown.classList.remove('show')
        if (fontMenuBtn) fontMenuBtn.classList.remove('active')
        input.focus()
        
        if (state.stickyNoteInput) state.stickyNoteInput.font = font
        
        if (state.editingElementId) {
          const element = state.elements.find(e => e.id === state.editingElementId)
          if (element) {
            element.font = font
            element._dirty = true
            redrawCanvas()
          }
        }
      }
    })
  }

  window.addEventListener('click', (e) => {
    if (fontDropdown && fontDropdown.classList.contains('show')) {
      if (!e.target.closest('.sticky-font-wrapper')) {
        fontDropdown.classList.remove('show')
        if (fontMenuBtn) fontMenuBtn.classList.remove('active')
      }
    }
  })

  if (header) {
    let isDragging = false
    let startX, startY

    header.onmousedown = (e) => {
      if (e.target.closest('.sticky-note-menu-wrapper') || e.target.closest('.sticky-close-btn')) return
      isDragging = true
      startX = e.clientX - container.offsetLeft
      startY = e.clientY - container.offsetTop
      e.preventDefault()
    }

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        let x = e.clientX - startX
        let y = e.clientY - startY

        const rect = container.getBoundingClientRect()
        x = Math.max(0, Math.min(x, window.innerWidth - rect.width))
        y = Math.max(0, Math.min(y, window.innerHeight - rect.height))

        container.style.left = x + 'px'
        container.style.top = y + 'px'
        redrawCanvas()
      }
    })

    window.addEventListener('mouseup', () => {
      isDragging = false
    })
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      finishStickyNoteInput()
    }
  }

  function getThemePastelColor() {
    const accentColor = localStorage.getItem('accent-color') || '#3bbbf6'
    if (accentColor.startsWith('#')) {
      const r = parseInt(accentColor.slice(1, 3), 16)
      const g = parseInt(accentColor.slice(3, 5), 16)
      const b = parseInt(accentColor.slice(5, 7), 16)
      
      const pr = Math.floor(r + (255 - r) * 0.82)
      const pg = Math.floor(g + (255 - g) * 0.82)
      const pb = Math.floor(b + (255 - b) * 0.82)
      
      return `#${pr.toString(16).padStart(2, '0')}${pg.toString(16).padStart(2, '0')}${pb.toString(16).padStart(2, '0')}`
    }
    return '#f8fafc'
  }

  function updateDynamicColors() {
    const dynamicColor = getThemePastelColor()
    const dynamicBtn = container?.querySelector('.theme-color-dynamic')
    if (dynamicBtn) {
      dynamicBtn.dataset.color = dynamicColor
      dynamicBtn.style.backgroundColor = dynamicColor
      
      if (dynamicBtn.classList.contains('active')) {
        container.style.backgroundColor = dynamicColor
        if (state.stickyNoteInput) state.stickyNoteInput.color = dynamicColor
        updateFormattingIconContrast(dynamicColor)
        
        if (state.editingElementId) {
          const element = state.elements.find(e => e.id === state.editingElementId)
          if (element) {
            element.color = dynamicColor
            element._dirty = true
            redrawCanvas()
          }
        }
      }
    }
  }

  function startStickyNoteInput(x, y) {
    const canvasRect = canvas.getBoundingClientRect()
    const defaultColor = getThemePastelColor()

    container.style.display = 'flex'
    container.style.left = (canvasRect.left + x + state.panX - 150) + 'px'
    container.style.top = (canvasRect.top + y + state.panY - 20) + 'px'
    container.style.backgroundColor = defaultColor
    
    updateFormattingIconContrast(defaultColor)
    
    input.innerHTML = ''
    palette.classList.remove('show')
    menuBtn.classList.remove('active')
    
    input.style.fontFamily = "'Comic Sans MS', 'Comic Sans', cursive, sans-serif"
    const fontOptions = document.querySelectorAll('.sticky-font-option')
    if (fontOptions) {
      fontOptions.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === 'comic-sans')
      })
    }
    const fontDropdown = document.getElementById('sticky-font-dropdown')
    const fontMenuBtn = document.getElementById('sticky-font-menu-btn')
    if (fontDropdown) fontDropdown.classList.remove('show')
    if (fontMenuBtn) fontMenuBtn.classList.remove('active')
    
    colorBtns.forEach(btn => {
      btn.classList.remove('active')
      if (btn.classList.contains('theme-color-dynamic')) {
        btn.dataset.color = defaultColor
        btn.style.backgroundColor = defaultColor
        btn.classList.add('active')
      }
    })
    
    setTimeout(() => {
      input.focus()
    }, 10)
    
    state.stickyNoteInput = { x, y, color: defaultColor, font: 'comic-sans' }
    state.editingElementId = null
  }

  function finishStickyNoteInput() {
    if (!container || container.style.display === 'none') return
    
    palette.classList.remove('show')
    menuBtn.classList.remove('active')
    
    const textContent = input.innerHTML.trim()
    const rect = container.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    
    const x = rect.left - canvasRect.left - state.panX
    const y = rect.top - canvasRect.top - state.panY
    const width = rect.width
    const height = rect.height
    const color = container.style.backgroundColor || '#ffffff'

    if (state.editingElementId) {
      const element = state.elements.find(e => e.id === state.editingElementId)
      if (element && element.type === 'stickyNote') {
        if (textContent) {
          element.text = textContent
          element.color = color
          element.font = state.stickyNoteInput?.font || element.font || 'comic-sans'
          element.x = x
          element.y = y
          element._dirty = true
          state.editingElementId = null
          editingBackup = null
          redrawCanvas()
          saveState()
        } else {
          state.elements = state.elements.filter(e => e.id !== state.editingElementId)
          state.selectedElements = state.selectedElements.filter(id => id !== state.editingElementId)
          state.editingElementId = null
          editingBackup = null
          redrawCanvas()
          saveState()
        }
        container.style.display = 'none'
        state.stickyNoteInput = null
        return
      }
    }
    
    if (textContent) {
      createElement('stickyNote', {
        x: x,
        y: y,
        width: width,
        height: height,
        color: color,
        font: state.stickyNoteInput?.font || 'comic-sans',
        text: textContent
      })
      
      redrawCanvas()
      saveState()
      state.hasDrawn = true
    }
    
    editingBackup = null
    container.style.display = 'none'
    state.stickyNoteInput = null
    state.editingElementId = null
  }

  function cancelStickyNoteInput() {
    if (container) {
      container.style.display = 'none'
      if (palette) palette.classList.remove('show')
      if (menuBtn) menuBtn.classList.remove('active')
    }

    if (state.editingElementId && editingBackup) {
      const element = state.elements.find(e => e.id === state.editingElementId)
      if (element) {
        element.text = editingBackup.text
        element.color = editingBackup.color
        element.x = editingBackup.x
        element.y = editingBackup.y
      }
    }

    editingBackup = null
    state.stickyNoteInput = null
    state.editingElementId = null
    redrawCanvas()
  }

  function isLightColor(color) {
    if (!color) return false;
    
    let r, g, b;
    if (typeof color === 'string' && color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        return false;
      }
    } else {
      const hex = color.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
      }
    }
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;

    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return brightness > 0.5;
  }

  function updateFormattingIconContrast(backgroundColor) {
    const formatBtns = container?.querySelectorAll('.sticky-format-btn')
    const menuIcon = document.getElementById('sticky-color-menu-btn')?.querySelector('.material-symbols-outlined')
    const closeIcon = document.getElementById('close-sticky-btn')?.querySelector('.material-symbols-outlined')
    
    const fontDropdown = document.getElementById('sticky-font-dropdown')
    const colorPalette = document.getElementById('sticky-color-palette')
    
    const isLight = isLightColor(backgroundColor)
    const iconColor = isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)'
    const textColor = isLight ? '#1e293b' : '#ffffff'
    
    if (container) {
      container.classList.toggle('light-note', isLight)
      container.classList.toggle('dark-note', !isLight)
    }

    if (menuIcon) menuIcon.style.color = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)'
    if (closeIcon) closeIcon.style.color = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)'
    if (input) input.style.color = textColor

    const tint = isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.2)'
    const bgStyle = `linear-gradient(${tint}, ${tint}), ${backgroundColor}`
    
    if (fontDropdown) {
      fontDropdown.style.background = bgStyle
      fontDropdown.style.backdropFilter = 'blur(12px)'
      fontDropdown.classList.toggle('light-note', isLight)
      fontDropdown.classList.toggle('dark-note', !isLight)
      fontDropdown.style.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
      
      fontDropdown.querySelectorAll('.sticky-font-option').forEach(opt => {
        opt.style.color = textColor
        const hoverColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'
        opt.onmouseenter = () => opt.style.background = hoverColor
        opt.onmouseleave = () => opt.style.background = 'transparent'
      })
    }
    
    if (colorPalette) {
      colorPalette.style.background = bgStyle
      colorPalette.style.backdropFilter = 'blur(12px)'
      colorPalette.style.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
    }

    formatBtns?.forEach(btn => {
      const icon = btn.querySelector('.material-symbols-outlined')
      if (icon) {
        icon.style.color = iconColor
      }
    })
  }

  function updateActiveNoteColor(color) {
    if (!container || container.style.display === 'none') return
    
    container.style.backgroundColor = color
    if (state.stickyNoteInput) state.stickyNoteInput.color = color
    
    updateFormattingIconContrast(color)
    
    colorBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color)
    })

    if (state.editingElementId) {
      const element = state.elements.find(e => e.id === state.editingElementId)
      if (element) {
        element.color = color
        element._dirty = true
        redrawCanvas()
      }
    }
  }

  function editStickyNote(element) {
    editingBackup = JSON.parse(JSON.stringify(element))
    if (!container || !input) return
    
    const canvasRect = canvas.getBoundingClientRect()
    container.style.display = 'flex'
    container.style.left = (canvasRect.left + element.x + state.panX) + 'px'
    container.style.top = (canvasRect.top + element.y + state.panY) + 'px'
    container.style.width = (element.width || 280) + 'px'
    container.style.height = (element.height || 280) + 'px'
    container.style.backgroundColor = element.color
    
    updateFormattingIconContrast(element.color)
    
    input.innerHTML = element.text
    palette.classList.remove('show')
    menuBtn.classList.remove('active')
    
    const defaultColor = getThemePastelColor()
    colorBtns.forEach(btn => {
      btn.classList.remove('active')
      if (btn.classList.contains('theme-color-dynamic')) {
        btn.dataset.color = defaultColor
        btn.style.backgroundColor = defaultColor
      }
      if (btn.dataset.color === element.color) btn.classList.add('active')
    })
    
    const font = element.font || 'comic-sans'
    if (font === 'monospace') {
      input.style.fontFamily = "'Courier New', monospace"
    } else if (font === 'opendyslexic') {
      input.style.fontFamily = "'OpenDyslexicRegular', 'Comic Sans MS', sans-serif"
    } else {
      input.style.fontFamily = "'Comic Sans MS', 'Comic Sans', cursive, sans-serif"
    }
    
    const fontOptions = document.querySelectorAll('.sticky-font-option')
    if (fontOptions) {
      fontOptions.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === font)
      })
    }

    state.editingElementId = element.id
    state.stickyNoteInput = { x: element.x, y: element.y, color: element.color, font: font }
    
    setTimeout(() => {
      input.focus()
      updateFormattingState()
    }, 10)
    
    redrawCanvas()
  }

  return {
    startStickyNoteInput,
    finishStickyNoteInput,
    cancelStickyNoteInput,
    editStickyNote,
    updateDynamicColors,
    updateActiveNoteColor,
    updateStickyNotePosition: () => {
      if (container && container.style.display !== 'none' && state.stickyNoteInput) {
        const canvasRect = canvas.getBoundingClientRect()
        container.style.left = (canvasRect.left + state.stickyNoteInput.x + state.panX) + 'px'
        container.style.top = (canvasRect.top + state.stickyNoteInput.y + state.panY) + 'px'
      }
    }
  }
}

module.exports = { initStickyNoteTool }