const { ipcRenderer } = require('electron')

function init(deps) {
  const {
    state,
    standbyManager,
    selectTool,
    setTool,
    undo,
    redo,
    clearCanvas,
    copySelectedElements,
    pasteElements,
    toggleCommandMenu,
    closeCommandMenu,
    setColor,
    setShape,
    playSound,
    hideAllTooltips,
    closeAllPopups
  } = deps

  document.addEventListener('keydown', (e) => {
    const isUndoRedo = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'x')
    if (e.repeat && !isUndoRedo) return
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      const isCommandMenuShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'
      if (!isCommandMenuShortcut) return
    }

    if (standbyManager.isActive()) {
      const key = e.key.toLowerCase()
      const isAllowed = 
        key === ' ' || 
        key === 'escape' || 
        key === 'h' ||
        key === ',' ||
        key === ';' ||
        (e.shiftKey && key === 'c')
      
      if (!isAllowed) {
        return
      }
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'f':
          e.preventDefault()
          toggleCommandMenu()
          break
        case 'c':
          if (state.selectedElements.length > 0) {
            e.preventDefault()
            copySelectedElements()
          }
          break
        case 'v':
          if (state.copiedElements && state.copiedElements.length > 0) {
            e.preventDefault()
            pasteElements()
          }
          break
        case 'z':
          if (e.shiftKey) {
            e.preventDefault()
            redo()
          } else {
            e.preventDefault()
            undo()
          }
          break
        case 'y':
          e.preventDefault()
          redo()
          break
        case 'a':
          if (state.tool === 'select') {
            e.preventDefault()
            selectTool.selectAllElements()
          }
          break
        case ',':
        case ';':
          e.preventDefault()
          document.getElementById('menu-btn').click()
          break
        case 'h':
          e.preventDefault()
          document.getElementById('hide-btn').click()
          break
      }
      return
    }

    const shapesPopup = document.getElementById('shapes-popup');
    const isShapesActive = state.tool === 'shapes' || (shapesPopup && shapesPopup.classList.contains('show'));
    const isSelectWithShapes = state.tool === 'select' && state.selectedElements.length > 0 && 
      state.selectedElements.some(id => {
        const element = state.elements.find(e => e.id === id);
        return element && element.type === 'shape' && 
          (element.shapeType === 'rectangle' || element.shapeType === 'circle');
      });
    
    if (isShapesActive || isSelectWithShapes) {
      const key = e.key.toLowerCase();
      if (key === 'r') {
        e.preventDefault();
        setShape('rectangle');
        return;
      } else if (key === 'c' && !e.shiftKey) {
        e.preventDefault();
        setShape('circle');
        return;
      } else if (key === 'a') {
        e.preventDefault();
        setShape('arrow');
        return;
      } else if (key === 'l') {
        e.preventDefault();
        setShape('line');
        return;
      } else if (key === 'f') {
        e.preventDefault();
        const fillToggle = document.getElementById('shape-fill-toggle');
        if (fillToggle) {
          fillToggle.click();
        }
        return;
      }
    }

    switch (e.key.toLowerCase()) {
      case 'p':
        e.preventDefault()
        setTool('pencil')
        break
      case 'b':
        e.preventDefault()
        setTool('marker')
        break
      case 'n':
        e.preventDefault()
        setTool('sticky-note')
        break
      case 'v':
        if (!e.ctrlKey && !e.metaKey) {
          const textInput = document.getElementById('text-input')
          if (!textInput || textInput.style.display === 'none') {
            e.preventDefault()
            setTool('select')
          }
        }
        break
      case 's':
        e.preventDefault()
        
        const shapesBtn = document.getElementById('shapes-btn')
        if (shapesBtn) {
          hideAllTooltips()
          const shapesPopup = document.getElementById('shapes-popup')
          if (shapesPopup) {
            const wasOpen = shapesPopup.classList.contains('show')
            closeAllPopups()
            if (!wasOpen) {
              shapesPopup.classList.add('show')
            }
          }
          if (!shapesPopup.classList.contains('show')) {
            setTool('shapes')
          }
        }
        break
      case 'e':
        e.preventDefault()
        setTool('eraser')
        break

      case 'delete':
      case 'backspace':
        if (e.shiftKey) {
          e.preventDefault()
          clearCanvas()
        } else if (state.tool === 'select' && state.selectedElements.length > 0) {
          e.preventDefault()
          selectTool.deleteSelectedElements()
        }
        break
    case 'c':
        if (e.shiftKey) {
          e.preventDefault()
          document.getElementById('capture-btn').click()
        } else if (state.selectedElements.length > 0) {
          e.preventDefault()
          copySelectedElements()
        }
        break
      case 't':
        if (e.shiftKey) {
          e.preventDefault()
          const currentTheme = localStorage.getItem('theme') || 'system'
          let nextTheme
          if (currentTheme === 'system') nextTheme = 'light'
          else if (currentTheme === 'light') nextTheme = 'dark'
          else nextTheme = 'system'
          
          if (deps.applyTheme) {
            deps.applyTheme(nextTheme)
          } else {
            const { applyTheme } = require('../managers/themeManager.js')
            applyTheme(nextTheme)
          }
        } else {
          e.preventDefault()
          setTool('text')
        }
        break
      case 'escape':
        e.preventDefault()

        if (state.tool === 'select' && selectTool.cancelDrag) {
          if (selectTool.cancelDrag()) {
            return;
          }
        }
        const commandMenuOverlay = document.getElementById('command-menu-overlay')
        if (commandMenuOverlay && (commandMenuOverlay.style.display === 'flex' || commandMenuOverlay.classList.contains('show'))) {
          closeCommandMenu()
          return
        }
        
        const wbSettingsPopup = document.getElementById('whiteboard-settings-popup')
        if (wbSettingsPopup && wbSettingsPopup.style.display === 'flex') {
          const settingsBtn = document.getElementById('whiteboard-settings-btn')
          wbSettingsPopup.style.display = 'none'
          if (settingsBtn) settingsBtn.classList.remove('active')
          state.pickingWhiteboardColor = false
          return
        }

        if (state.tool === 'select') {
          if (selectTool.isContextMenuVisible && selectTool.isContextMenuVisible()) {
            selectTool.hideContextMenu()
            return
          }
          if (state.selectedElements.length > 0) {
            selectTool.clearSelection()
            if (deps.redrawCanvas) deps.redrawCanvas()
            return
          }
        }

        const featuresShelfOverlay = document.getElementById('features-shelf-overlay')
        if (featuresShelfOverlay && (featuresShelfOverlay.classList.contains('show') || featuresShelfOverlay.style.display === 'flex')) {
          const featuresShelfDone = document.getElementById('features-shelf-done')
          if (featuresShelfDone) {
            featuresShelfDone.click()
          } else {
            featuresShelfOverlay.classList.remove('show')
            setTimeout(() => featuresShelfOverlay.style.display = 'none', 400)
          }
          return
        }

        const popups = [
          document.getElementById('stroke-popup'),
          document.getElementById('drawing-tools-popup'),
          document.getElementById('shapes-popup'),
          document.getElementById('custom-color-popup'),
          document.getElementById('more-menu-dropdown'),
          document.getElementById('timer-settings-popup'),
          document.getElementById('clock-settings-popup'),
          document.getElementById('custom-color-picker'),
          document.getElementById('sticky-note-input-container')
        ]
        
        let hasOpenPopup = false
        popups.forEach(popup => {
          if (popup && (popup.classList.contains('show') || (popup.id === 'sticky-note-input-container' && popup.style.display === 'flex'))) {
            hasOpenPopup = true
            popup.classList.remove('show')
            if (popup.id === 'sticky-note-input-container') {
              popup.style.display = 'none'
            }
          }
        })
        
        if (!hasOpenPopup) {
          ipcRenderer.send('close-notification')
          setTimeout(() => {
            const closeBtn = document.getElementById('close-btn')
            if (closeBtn) closeBtn.click()
          }, 50)
        }
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        e.preventDefault()
        const sizes = { '1': 2, '2': 4, '3': 8, '4': 16 }
        const size = sizes[e.key]
        if (size) {
          state.strokeSize = size
          if (state.tool === 'select' && state.selectedElements.length > 0) {
            selectTool.updateSelectedStrokeSize(size)
          }
          document.querySelectorAll('.stroke-option').forEach(btn => {
            btn.classList.remove('active')
            if (parseInt(btn.dataset.size) === size) {
              btn.classList.add('active')
            }
          })
          localStorage.setItem('stroke-size', size.toString())
        }
        break
      case 'q':
      case 'w':
      case 'g':
        e.preventDefault()
        const colorMap = { 'q': '#ef4444', 'w': '#3b82f6', 'g': '#10b981' }
        const color = colorMap[e.key]
        if (color) {
          setColor(color)
          playSound('color')
        }
        break
      case ' ':
        e.preventDefault()
        const isWhiteboard = document.body.classList.contains('whiteboard-mode')
        if (!isWhiteboard) {
          standbyManager.toggle()
        }
        break
    }
  })

  document.addEventListener('keyup', (e) => {
    ipcRenderer.send('reset-shortcut-held')
  })
}

module.exports = { initShortcutManager: init }