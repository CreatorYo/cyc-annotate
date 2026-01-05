function initTextTool(state, canvas, helpers) {
  const { createElement, redrawCanvas, saveState } = helpers
  let editingBackup = null;

  function startTextInput(x, y) {
    const textInput = document.getElementById('text-input')
    const canvasRect = canvas.getBoundingClientRect()

    textInput.style.display = 'block'
    textInput.style.position = 'fixed'
    textInput.style.left = (canvasRect.left + x) + 'px'
    textInput.style.top = (canvasRect.top + y) + 'px'
    textInput.style.maxWidth = '2000px'
    textInput.style.zIndex = '2000'
    
    const fontSize = Math.max(32, state.strokeSize * 10)
    textInput.style.fontSize = fontSize + 'px'
    textInput.style.color = state.color
    textInput.style.setProperty('--text-color', state.color)
    textInput.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    textInput.style.lineHeight = '1'
    
    textInput.textContent = ''
    textInput.innerHTML = ''

    state.textFormatting = {
      bold: false,
      italic: false,
      underline: false
    }

    setTimeout(() => {
      textInput.focus()
    }, 10)
    
    state.textInput = { x, y }
  }

  function wrapText(ctx, text, maxWidth) {
    if (!text || !text.trim()) {
      return ['']
    }

    const words = text.split(' ')
    const lines = []
    
    if (words.length === 0) {
      return ['']
    }

    let currentLine = words[0]

    for (let i = 1; i < words.length; i++) {
      const word = words[i]
      const testLine = currentLine + ' ' + word
      const width = ctx.measureText(testLine).width
      
      if (width < maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) {
          lines.push(currentLine)
        }
        currentLine = word
        
        if (ctx.measureText(word).width > maxWidth) {
          lines.push(word)
          currentLine = ''
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
    
    return lines
  }

  function evaluateMathExpression(expression) {
    try {
      let cleaned = expression.trim()
      
      if (cleaned.includes('=')) {
        cleaned = cleaned.split('=')[0].trim()
      }
      
      cleaned = cleaned.replace(/[xX×]/g, '*')
      
      cleaned = cleaned.replace(/\s/g, '')
      
      if (!/[+\-*/]/.test(cleaned)) return null
      if (!/[0-9]/.test(cleaned)) return null
      
      const allowedChars = /^[0-9+\-*/().]+$/
      if (!allowedChars.test(cleaned)) return null

      const result = Function('"use strict"; return (' + cleaned + ')')()

      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result
      }
      return null
    } catch (e) {
      return null
    }
  }

  function parseFormattedText(element) {
    const segments = []
    const computedStyle = window.getComputedStyle(element)
    const defaultColor = computedStyle.color
    
    function traverse(node, formatting = { bold: false, italic: false, underline: false, color: defaultColor }) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent
        if (text) {
          segments.push({ text, formatting: { ...formatting } })
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase()
        const newFormatting = { ...formatting }
        
        if (tagName === 'b' || tagName === 'strong') {
          newFormatting.bold = true
        } else if (tagName === 'i' || tagName === 'em') {
          newFormatting.italic = true
        } else if (tagName === 'u') {
          newFormatting.underline = true
        } else if (tagName === 'font') {
          if (node.color) newFormatting.color = node.color
          if (node.style.color) newFormatting.color = node.style.color
        } else if (node.style && node.style.color) {
          newFormatting.color = node.style.color
        } else if (tagName === 'br') {
          segments.push({ text: '\n', formatting: { ...formatting } })
        }
        
        for (let child of node.childNodes) {
          traverse(child, newFormatting)
        }
      }
    }
    
    for (let child of element.childNodes) {
      traverse(child)
    }
    
    if (segments.length === 0) {
      segments.push({ text: element.textContent || '', formatting: { bold: false, italic: false, underline: false } })
    }
    
    const merged = []
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      
      if (merged.length > 0) {
        const last = merged[merged.length - 1]
        const formatMatch = last.formatting.bold === segment.formatting.bold &&
                           last.formatting.italic === segment.formatting.italic &&
                           last.formatting.underline === segment.formatting.underline &&
                           last.formatting.color === segment.formatting.color
        
        if (formatMatch) {
          last.text += segment.text
        } else {
          merged.push({ text: segment.text, formatting: { ...segment.formatting } })
        }
      } else {
        merged.push({ text: segment.text, formatting: { ...segment.formatting } })
      }
    }
    
    return merged
  }

  function updateTextFormatting() {
    if (!state.textFormatting) {
      state.textFormatting = { bold: false, italic: false, underline: false }
    }
    
    state.textFormatting.bold = document.queryCommandState('bold')
    state.textFormatting.italic = document.queryCommandState('italic')
    state.textFormatting.underline = document.queryCommandState('underline')
  }

  function applyMathSolving(segments) {
    const textSolveEnabled = localStorage.getItem('text-solve-enabled') === 'true'
    if (!textSolveEnabled || segments.length === 0) return

    const fullText = segments.map(s => s.text).join('')
    const result = evaluateMathExpression(fullText)
    if (result !== null) {
      let hasEquals = false
      for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].text.includes('=')) {
          const parts = segments[i].text.split('=')
          segments[i].text = parts[0].replace(/\s+$/, '') + ' = ' + result
          segments.splice(i + 1)
          hasEquals = true
          break
        }
      }
      if (!hasEquals) {
        const lastSegment = segments[segments.length - 1]
        lastSegment.text = lastSegment.text.replace(/\s+$/, '') + ' = ' + result
      }
    }
  }

  function finishTextInput() {
    const textInput = document.getElementById('text-input')
    if (!textInput) return
    const textContent = textInput.textContent.trim()
    
    if (state.editingElementId) {
      const element = state.elements.find(e => e.id === state.editingElementId)
      if (element && element.type === 'text') {
        if (textContent) {
          updateTextFormatting()
          let segments = parseFormattedText(textInput)
          applyMathSolving(segments)
          
          element.segments = segments
          element.color = textInput.style.color || element.color
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
        textInput.style.display = 'none'
        state.textInput = null
        if (state.textFormatting) {
          state.textFormatting = { bold: false, italic: false, underline: false }
        }
        return
      }
    }
    
    if (textContent && state.textInput) {
      updateTextFormatting()
      let segments = parseFormattedText(textInput)
      applyMathSolving(segments)
      
      const fontSize = Math.max(32, state.strokeSize * 10)
      const baseColor = textInput.style.color || state.color
      
      createElement('text', {
        x: state.textInput.x,
        y: state.textInput.y,
        color: baseColor,
        strokeSize: state.strokeSize,
        fontSize: fontSize,
        segments: segments
      })
      
      redrawCanvas()
      saveState()
      state.hasDrawn = true
    }
    
    editingBackup = null
    textInput.style.display = 'none'
    state.textInput = null
    state.editingElementId = null
    if (state.textFormatting) {
      state.textFormatting = { bold: false, italic: false, underline: false }
    }
  }

  function cancelTextInput() {
    const textInput = document.getElementById('text-input')
    if (textInput) {
      textInput.style.display = 'none'
    }

    if (state.editingElementId && editingBackup) {
      const element = state.elements.find(e => e.id === state.editingElementId)
      if (element) {
        element.segments = editingBackup.segments
        element.color = editingBackup.color
      }
    }

    editingBackup = null
    state.textInput = null
    state.editingElementId = null
    if (state.textFormatting) {
      state.textFormatting = { bold: false, italic: false, underline: false }
    }
    redrawCanvas()
  }

  function editTextElement(element) {
    editingBackup = JSON.parse(JSON.stringify(element))
    const textInput = document.getElementById('text-input')
    if (!textInput) return
    
    const canvasRect = canvas.getBoundingClientRect()
    textInput.style.display = 'block'
    textInput.style.position = 'fixed'
    textInput.style.left = (canvasRect.left + element.x) + 'px'
    textInput.style.top = (canvasRect.top + element.y) + 'px'
    textInput.style.maxWidth = '2000px'
    textInput.style.zIndex = '2000'
    
    const fontSize = element.fontSize || Math.max(32, (element.strokeSize || state.strokeSize) * 10)
    textInput.style.fontSize = fontSize + 'px'
    textInput.style.color = element.color || state.color
    textInput.style.setProperty('--text-color', element.color || state.color)
    textInput.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    textInput.style.lineHeight = '1'

    const htmlContent = element.segments ? element.segments.map(s => {
      let content = s.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      const col = s.formatting?.color
      if (s.formatting?.bold) content = `<b>${content}</b>`
      if (s.formatting?.italic) content = `<i>${content}</i>`
      if (s.formatting?.underline) content = `<u>${content}</u>`
      if (col) {
        content = `<span style="color: ${col}">${content}</span>`
      }
      return content
    }).join('') : ''
    
    textInput.innerHTML = htmlContent
    
    state.editingElementId = element.id
    state.textInput = { x: element.x, y: element.y }
    
    if (element.segments && element.segments.length > 0) {
      const firstSegment = element.segments[0]
      state.textFormatting = {
        bold: firstSegment.formatting?.bold || false,
        italic: firstSegment.formatting?.italic || false,
        underline: firstSegment.formatting?.underline || false
      }
    } else {
      state.textFormatting = { bold: false, italic: false, underline: false }
    }
    
    setTimeout(() => {
      textInput.focus()
      const range = document.createRange()
      range.selectNodeContents(textInput)
      range.collapse(false) 
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      updateCurrentTextColor(state.color)
    }, 10)
    
    redrawCanvas()
  }

  function updateCaretColor() {
    const textInput = document.getElementById('text-input')
    if (!textInput || textInput.style.display === 'none') return

    const color = document.queryCommandValue('foreColor')
    if (color && color !== 'rgba(0, 0, 0, 0)') {
      textInput.style.caretColor = color
    }
  }

  function updateCurrentTextColor(color) {
    const textInput = document.getElementById('text-input')
    if (textInput && textInput.style.display !== 'none') {
      if (document.activeElement !== textInput) {
        textInput.focus()
      }

      const sel = window.getSelection()
      const isActiveSelection = sel.rangeCount > 0 && textInput.contains(sel.anchorNode)
      
      textInput.style.caretColor = color
      
      if (isActiveSelection && !sel.isCollapsed) {
        document.execCommand('foreColor', false, color)
        
        let el = sel.anchorNode.parentElement
        if (el && el !== textInput && el.tagName === 'FONT') {
          el.style.color = color
        }
        
        const range = sel.getRangeAt(0)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        if (textInput.textContent.trim().length === 0) {
          textInput.style.color = color
          textInput.style.setProperty('--text-color', color)
        }
        
        document.execCommand('foreColor', false, color)
        textInput.style.caretColor = color

        if (state.editingElementId) {
          const el = state.elements.find(e => e.id === state.editingElementId)
          if (el && el.type === 'text' && textInput.textContent.trim().length === 0) {
            el.color = color
          }
        }
      }
    }
  }

  const textInput = document.getElementById('text-input')
  if (textInput) {
    ['keyup', 'click', 'input', 'keydown', 'mouseup'].forEach(evt => {
      textInput.addEventListener(evt, updateCaretColor)
    })
    
    document.addEventListener('selectionchange', () => {
      if (textInput.style.display !== 'none' && document.activeElement === textInput) {
        updateCaretColor()
      }
    })
  }

  return {
    startTextInput,
    wrapText,
    evaluateMathExpression,
    parseFormattedText,
    updateTextFormatting,
    finishTextInput,
    cancelTextInput,
    editTextElement,
    updateCurrentTextColor
  }
}

module.exports = { initTextTool }