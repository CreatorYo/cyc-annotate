function initSelectTool(state, ctx, canvas, helpers) {
  const { getElementBounds, hitTest, findElementAt, redrawCanvas, updateSelectionOnly, saveState, playSound } = helpers
  const HANDLE_SIZE = 8
  const PADDING = 4
  const SELECTION_COLOR = '#3b82f6'
  const HANDLE_ANGLES = [
    { angle: 0, type: 'e' }, { angle: Math.PI / 4, type: 'se' },
    { angle: Math.PI / 2, type: 's' }, { angle: 3 * Math.PI / 4, type: 'sw' },
    { angle: Math.PI, type: 'w' }, { angle: 5 * Math.PI / 4, type: 'nw' },
    { angle: 3 * Math.PI / 2, type: 'n' }, { angle: 7 * Math.PI / 4, type: 'ne' }
  ]
  const CURSOR_MAP = { 'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize', 'e': 'e-resize',
                       'se': 'se-resize', 's': 's-resize', 'sw': 'sw-resize', 'w': 'w-resize' }
  
  let activeGuides = []
  let fadingGuides = []
  let fadeStartTime = 0
  const FADE_DURATION = 2000
  const SNAP_THRESHOLD = 5

  const updateSelection = () => updateSelectionOnly ? updateSelectionOnly() : redrawCanvas()

  const getElement = (id) => state.elements.find(e => e.id === id)

  function drawAlignmentGuides(overlayCtx) {
    if (activeGuides.length === 0 && fadingGuides.length === 0) return

    overlayCtx.save()
    overlayCtx.lineWidth = 1
    overlayCtx.setLineDash([4, 4])
    
    if (fadingGuides.length > 0) {
      const elapsed = Date.now() - fadeStartTime
      const remaining = Math.max(0, 1 - elapsed / FADE_DURATION)
      
      if (remaining > 0) {
        overlayCtx.strokeStyle = '#d946ef'
        overlayCtx.globalAlpha = 0.6 * remaining
        overlayCtx.beginPath()
        fadingGuides.forEach(guide => {
          if (guide.type === 'x') {
            overlayCtx.moveTo(guide.pos, 0)
            overlayCtx.lineTo(guide.pos, overlayCtx.canvas.height)
          } else {
            overlayCtx.moveTo(0, guide.pos)
            overlayCtx.lineTo(overlayCtx.canvas.width, guide.pos)
          }
        })
        overlayCtx.stroke()
      } else {
        fadingGuides = []
      }
    }

    if (activeGuides.length > 0) {
      overlayCtx.strokeStyle = '#d946ef'
      overlayCtx.globalAlpha = 0.6
      overlayCtx.beginPath()
      activeGuides.forEach(guide => {
        if (guide.type === 'x') {
          overlayCtx.moveTo(guide.pos, 0)
          overlayCtx.lineTo(guide.pos, overlayCtx.canvas.height)
        } else {
          overlayCtx.moveTo(0, guide.pos)
          overlayCtx.lineTo(overlayCtx.canvas.width, guide.pos)
        }
      })
      overlayCtx.stroke()
    }

    overlayCtx.restore()
  }


  function handleSelectStop() {
    if (state.isResizing) {
    }
    if (state.isDraggingSelection) {
      state.isDraggingSelection = false
      state.dragOffset = null
      state.dragStartBounds = null
      
      if (activeGuides.length > 0) {
        fadingGuides = [...activeGuides]
        fadeStartTime = Date.now()
        activeGuides = []
        
        const animate = () => {
          if (fadingGuides.length > 0) {
              redrawCanvas()
              if (Date.now() - fadeStartTime < FADE_DURATION) {
                  requestAnimationFrame(animate)
              } else {
                  fadingGuides = []
                  redrawCanvas()
              }
          }
        }
        requestAnimationFrame(animate)
      }
      
      getSelectedElements().forEach(element => cleanupTempState(element))
      saveState()
    }
  }

  const getSelectedElements = () => state.selectedElements.map(id => getElement(id)).filter(Boolean)

  function getCombinedBounds() {
    const elements = getSelectedElements()
    if (elements.length === 0) return null
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    for (const element of elements) {
      const bounds = getElementBounds(element)
      if (bounds) {
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      }
    }
    
    if (minX === Infinity) return null
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
  function selectElement(elementId, addToSelection = false) {
    if (!addToSelection) state.selectedElements = []
    if (!state.selectedElements.includes(elementId)) {
      state.selectedElements.push(elementId)
    }
    updateSelection()
  }

  function deselectElement(elementId) {
    state.selectedElements = state.selectedElements.filter(id => id !== elementId)
    if (state.hoveredElementId === elementId) state.hoveredElementId = null
    updateSelection()
  }

  function clearSelection() {
    state.selectedElements = []
    state.hoveredElementId = null
    updateSelection()
  }

  function selectAllElements() {
    if (state.elements.length === 0) return
    state.selectedElements = state.elements.map(e => e.id)
    updateSelection()
    playSound('selectAll')
  }

  function deleteSelectedElements() {
    if (state.selectedElements.length === 0) return
    const selectedSet = new Set(state.selectedElements)
    state.elements = state.elements.filter(e => !selectedSet.has(e.id))
    state.selectedElements = []
    redrawCanvas()
    saveState()
    playSound('trash')
  }

  function storeInitialState(element) {
    if (element.type === 'stroke' && element.points) {
      element._initialPoints = element.points.map(p => ({ x: p.x, y: p.y }))
      const bounds = getElementBounds(element)
      if (bounds) element._initialBounds = { ...bounds }
    } else if (element.type === 'shape') {
      element._initialStart = { x: element.start.x, y: element.start.y }
      element._initialEnd = { x: element.end.x, y: element.end.y }
    } else if (element.type === 'text') {
      element._initialPos = { x: element.x, y: element.y }
      element._initialFontSize = element.fontSize || Math.max(12, element.strokeSize * 4)
      const bounds = getElementBounds(element)
      if (bounds) element._initialBounds = { ...bounds }
    }
  }

  function cleanupTempState(element) {
    delete element._initialPoints
    delete element._initialStart
    delete element._initialEnd
    delete element._initialPos
    delete element._initialFontSize
    delete element._initialBounds
  }

  function moveSelectedElements(totalDeltaX, totalDeltaY) {
    let hasChanges = false
    for (const elementId of state.selectedElements) {
      const element = getElement(elementId)
      if (!element) continue

      if (element.type === 'stroke' && element._initialPoints) {
        element.points.forEach((p, i) => {
          if (element._initialPoints[i]) {
            const newX = element._initialPoints[i].x + totalDeltaX
            const newY = element._initialPoints[i].y + totalDeltaY
            if (p.x !== newX || p.y !== newY) {
              p.x = newX
              p.y = newY
              hasChanges = true
            }
          }
        })
      } else if (element.type === 'shape' && element._initialStart && element._initialEnd) {
        const newStartX = element._initialStart.x + totalDeltaX
        const newStartY = element._initialStart.y + totalDeltaY
        const newEndX = element._initialEnd.x + totalDeltaX
        const newEndY = element._initialEnd.y + totalDeltaY
        if (element.start.x !== newStartX || element.start.y !== newStartY ||
            element.end.x !== newEndX || element.end.y !== newEndY) {
          element.start.x = newStartX
          element.start.y = newStartY
          element.end.x = newEndX
          element.end.y = newEndY
          hasChanges = true
        }
      } else if (element.type === 'text' && element._initialPos) {
        const newX = element._initialPos.x + totalDeltaX
        const newY = element._initialPos.y + totalDeltaY
        if (element.x !== newX || element.y !== newY) {
          element.x = newX
          element.y = newY
          hasChanges = true
        }
      }
    }
    if (hasChanges) redrawCanvas()
  }

  function getResizeHandleAt(x, y) {
    if (state.selectedElements.length === 0) return null
    
    if (state.selectedElements.length === 1) {
      const element = getElement(state.selectedElements[0])
      if (element && element.type === 'shape' && element.shapeType === 'circle') {
        const w = Math.abs(element.end.x - element.start.x)
        const h = Math.abs(element.end.y - element.start.y)
        const centerX = (element.start.x + element.end.x) / 2
        const centerY = (element.start.y + element.end.y) / 2
        const radius = Math.sqrt(w * w + h * h) / 2
        const handleRadius = radius + PADDING
        
        const dx = x - centerX
        const dy = y - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (Math.abs(distance - handleRadius) <= HANDLE_SIZE / 2) {
          const angle = Math.atan2(dy, dx)
          const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle
          
          let closestHandle = HANDLE_ANGLES[0]
          let minDiff = Math.abs(normalizedAngle - HANDLE_ANGLES[0].angle)
          for (const handle of HANDLE_ANGLES) {
            let diff = Math.abs(normalizedAngle - handle.angle)
            if (diff > Math.PI) diff = 2 * Math.PI - diff
            if (diff < minDiff) {
              minDiff = diff
              closestHandle = handle
            }
          }
          return minDiff < Math.PI / 8 ? closestHandle.type : null
        }
        return null
      }
    }
    
    const bounds = getCombinedBounds()
    if (!bounds) return null
    
    const borderX = bounds.x - PADDING
    const borderY = bounds.y - PADDING
    const borderW = bounds.width + PADDING * 2
    const borderH = bounds.height + PADDING * 2
    const halfHandle = HANDLE_SIZE / 2
    
    const handles = [
      { x: Math.round(borderX + halfHandle), y: Math.round(borderY + halfHandle), type: 'nw' },
      { x: Math.round(borderX + borderW / 2), y: Math.round(borderY + halfHandle), type: 'n' },
      { x: Math.round(borderX + borderW - halfHandle), y: Math.round(borderY + halfHandle), type: 'ne' },
      { x: Math.round(borderX + borderW - halfHandle), y: Math.round(borderY + borderH / 2), type: 'e' },
      { x: Math.round(borderX + borderW - halfHandle), y: Math.round(borderY + borderH - halfHandle), type: 'se' },
      { x: Math.round(borderX + borderW / 2), y: Math.round(borderY + borderH - halfHandle), type: 's' },
      { x: Math.round(borderX + halfHandle), y: Math.round(borderY + borderH - halfHandle), type: 'sw' },
      { x: Math.round(borderX + halfHandle), y: Math.round(borderY + borderH / 2), type: 'w' }
    ]
    
    for (const handle of handles) {
      const dx = x - handle.x
      const dy = y - handle.y
      if (dx * dx + dy * dy <= (HANDLE_SIZE / 2 + 2) ** 2) {
        return handle.type
      }
    }
    return null
  }

  function resizeSelectedElement(handle, totalDeltaX, totalDeltaY) {
    if (state.selectedElements.length === 0 || !state.resizeStartBounds) return
    
    const calcBounds = state.resizeStartBounds
    let newX = calcBounds.x, newY = calcBounds.y, newWidth = calcBounds.width, newHeight = calcBounds.height
    
    if (handle.includes('e')) newWidth = calcBounds.width + totalDeltaX
    if (handle.includes('w')) { newX = calcBounds.x + totalDeltaX; newWidth = calcBounds.width - totalDeltaX }
    if (handle.includes('s')) newHeight = calcBounds.height + totalDeltaY
    if (handle.includes('n')) { newY = calcBounds.y + totalDeltaY; newHeight = calcBounds.height - totalDeltaY }
    
    if (newWidth < 10) { newWidth = 10; if (handle.includes('w')) newX = calcBounds.x + calcBounds.width - 10 }
    if (newHeight < 10) { newHeight = 10; if (handle.includes('n')) newY = calcBounds.y + calcBounds.height - 10 }
    
    const scaleX = newWidth / calcBounds.width
    const scaleY = newHeight / calcBounds.height
    const offsetX = newX - calcBounds.x
    const offsetY = newY - calcBounds.y
    
    for (const elementId of state.selectedElements) {
      const element = getElement(elementId)
      if (!element) continue
      
      if (element.type === 'shape' && element._initialStart && element._initialEnd) {
        const relStartX = element._initialStart.x - calcBounds.x
        const relStartY = element._initialStart.y - calcBounds.y
        const relEndX = element._initialEnd.x - calcBounds.x
        const relEndY = element._initialEnd.y - calcBounds.y
        
        element.start.x = calcBounds.x + offsetX + (relStartX * scaleX)
        element.start.y = calcBounds.y + offsetY + (relStartY * scaleY)
        element.end.x = calcBounds.x + offsetX + (relEndX * scaleX)
        element.end.y = calcBounds.y + offsetY + (relEndY * scaleY)
        
      } else if (element.type === 'text' && element._initialPos && element._initialFontSize && element._initialBounds) {
        const scale = Math.min(scaleX, scaleY)
        element.fontSize = element._initialFontSize * scale
        element.strokeSize = Math.max(1, Math.floor(element.fontSize / 4))
        
        const relX = element._initialPos.x - calcBounds.x
        const relY = element._initialPos.y - calcBounds.y
        element.x = calcBounds.x + offsetX + (relX * scaleX)
        element.y = calcBounds.y + offsetY + (relY * scaleY)
        
      } else if (element.type === 'stroke' && element._initialPoints && element._initialBounds) {
        element.points.forEach((p, i) => {
          if (element._initialPoints[i]) {
            const relX = element._initialPoints[i].x - calcBounds.x
            const relY = element._initialPoints[i].y - calcBounds.y
            p.x = calcBounds.x + offsetX + (relX * scaleX)
            p.y = calcBounds.y + offsetY + (relY * scaleY)
          }
        })
      }
    }
    
    redrawCanvas()
  }

  function drawHandle(overlayCtx, x, y) {
    overlayCtx.save()
    overlayCtx.fillStyle = SELECTION_COLOR
    overlayCtx.strokeStyle = '#ffffff'
    overlayCtx.lineWidth = 2
    overlayCtx.globalAlpha = 1.0
    const handleX = Math.round(x - HANDLE_SIZE / 2)
    const handleY = Math.round(y - HANDLE_SIZE / 2)
    overlayCtx.beginPath()
    overlayCtx.rect(handleX, handleY, HANDLE_SIZE, HANDLE_SIZE)
    overlayCtx.fill()
    overlayCtx.stroke()
    overlayCtx.restore()
  }

  function drawSelectionBorder(overlayCtx, x, y, w, h) {
    overlayCtx.save()
    overlayCtx.strokeStyle = SELECTION_COLOR
    overlayCtx.lineWidth = 2
    overlayCtx.setLineDash([5, 5])
    overlayCtx.globalAlpha = 1.0
    overlayCtx.beginPath()
    overlayCtx.rect(x, y, w, h)
    overlayCtx.stroke()
    overlayCtx.restore()
  }

  function drawAlignmentGuides(overlayCtx) {
    if (activeGuides.length === 0) return

    overlayCtx.save()
    overlayCtx.strokeStyle = '#d946ef'
    overlayCtx.lineWidth = 1
    overlayCtx.setLineDash([4, 4])
    overlayCtx.globalAlpha = 0.6
    overlayCtx.beginPath()

    activeGuides.forEach(guide => {
      if (guide.type === 'x') {
        overlayCtx.moveTo(guide.pos, 0)
        overlayCtx.lineTo(guide.pos, overlayCtx.canvas.height)
      } else {
        overlayCtx.moveTo(0, guide.pos)
        overlayCtx.lineTo(overlayCtx.canvas.width, guide.pos)
      }
    })

    overlayCtx.stroke()
    overlayCtx.restore()
  }

  function drawSelectionIndicators(overlayCtx = ctx) {
    drawAlignmentGuides(overlayCtx)
    if (state.selectedElements.length === 0) return
    
    overlayCtx.save()
    overlayCtx.globalCompositeOperation = 'source-over'
    overlayCtx.setLineDash([])
    overlayCtx.globalAlpha = 1.0
    
    if (state.selectedElements.length === 1) {
      const element = getElement(state.selectedElements[0])
      if (element && element.type === 'shape' && element.shapeType === 'circle') {
        const w = Math.abs(element.end.x - element.start.x)
        const h = Math.abs(element.end.y - element.start.y)
        const centerX = (element.start.x + element.end.x) / 2
        const centerY = (element.start.y + element.end.y) / 2
        const radius = Math.sqrt(w * w + h * h) / 2
        const handleRadius = radius + PADDING
        
        overlayCtx.save()
        overlayCtx.strokeStyle = SELECTION_COLOR
        overlayCtx.lineWidth = 2
        overlayCtx.setLineDash([5, 5])
        overlayCtx.globalAlpha = 1.0
        overlayCtx.beginPath()
        overlayCtx.arc(centerX, centerY, radius + PADDING, 0, Math.PI * 2)
        overlayCtx.stroke()
        overlayCtx.restore()
        
        HANDLE_ANGLES.forEach(handle => {
          const handleX = Math.round(centerX + Math.cos(handle.angle) * handleRadius)
          const handleY = Math.round(centerY + Math.sin(handle.angle) * handleRadius)
          drawHandle(overlayCtx, handleX, handleY)
        })
        
        overlayCtx.restore()
        return
      }
    }
    
    for (const elementId of state.selectedElements) {
      const element = getElement(elementId)
      if (!element) continue
      
      const bounds = getElementBounds(element)
      if (!bounds) continue
      
      const borderX = bounds.x - PADDING
      const borderY = bounds.y - PADDING
      const borderW = bounds.width + PADDING * 2
      const borderH = bounds.height + PADDING * 2
      
      drawSelectionBorder(overlayCtx, borderX, borderY, borderW, borderH)
    }
    
    const combinedBounds = getCombinedBounds()
    if (combinedBounds) {
      const borderX = combinedBounds.x - PADDING
      const borderY = combinedBounds.y - PADDING
      const borderW = combinedBounds.width + PADDING * 2
      const borderH = combinedBounds.height + PADDING * 2
      
      if (state.selectedElements.length > 1) {
        overlayCtx.save()
        overlayCtx.strokeStyle = SELECTION_COLOR
        overlayCtx.lineWidth = 2
        overlayCtx.setLineDash([8, 4])
        overlayCtx.globalAlpha = 0.8
        overlayCtx.beginPath()
        overlayCtx.rect(borderX - 2, borderY - 2, borderW + 4, borderH + 4)
        overlayCtx.stroke()
        overlayCtx.restore()
      }
      
      const halfHandle = HANDLE_SIZE / 2
      const handles = [
        { x: Math.round(borderX + halfHandle), y: Math.round(borderY + halfHandle) },
        { x: Math.round(borderX + borderW / 2), y: Math.round(borderY + halfHandle) },
        { x: Math.round(borderX + borderW - halfHandle), y: Math.round(borderY + halfHandle) },
        { x: Math.round(borderX + borderW - halfHandle), y: Math.round(borderY + borderH / 2) },
        { x: Math.round(borderX + borderW - halfHandle), y: Math.round(borderY + borderH - halfHandle) },
        { x: Math.round(borderX + borderW / 2), y: Math.round(borderY + borderH - halfHandle) },
        { x: Math.round(borderX + halfHandle), y: Math.round(borderY + borderH - halfHandle) },
        { x: Math.round(borderX + halfHandle), y: Math.round(borderY + borderH / 2) }
      ]
      handles.forEach(handle => drawHandle(overlayCtx, handle.x, handle.y))
    }
    
    overlayCtx.restore()
  }

  function drawSelectionBox(overlayCtx = ctx) {
    if (!state.selectionStart || !state.selectionEnd) return
    
    const x = Math.min(state.selectionStart.x, state.selectionEnd.x)
    const y = Math.min(state.selectionStart.y, state.selectionEnd.y)
    const w = Math.abs(state.selectionEnd.x - state.selectionStart.x)
    const h = Math.abs(state.selectionEnd.y - state.selectionStart.y)
    
    overlayCtx.save()
    overlayCtx.strokeStyle = SELECTION_COLOR
    overlayCtx.lineWidth = 2
    overlayCtx.setLineDash([5, 5])
    overlayCtx.globalAlpha = 1.0
    overlayCtx.globalCompositeOperation = 'source-over'
    overlayCtx.beginPath()
    overlayCtx.rect(x, y, w, h)
    overlayCtx.stroke()
    overlayCtx.restore()
  }
  
  function selectElementsInBox() {
    if (!state.selectionStart || !state.selectionEnd) return
    
    const x = Math.min(state.selectionStart.x, state.selectionEnd.x)
    const y = Math.min(state.selectionStart.y, state.selectionEnd.y)
    const w = Math.abs(state.selectionEnd.x - state.selectionStart.x)
    const h = Math.abs(state.selectionEnd.y - state.selectionStart.y)
    
    const selectedInBox = []
    for (const element of state.elements) {
      const bounds = getElementBounds(element)
      if (bounds) {
        const centerX = bounds.x + bounds.width / 2
        const centerY = bounds.y + bounds.height / 2
        if (centerX >= x && centerX <= x + w && centerY >= y && centerY <= y + h) {
          selectedInBox.push(element.id)
        }
      }
    }
    
    if (selectedInBox.length > 0) {
      state.selectedElements = [...new Set([...state.selectedElements, ...selectedInBox])]
    }
  }

  function handleSelectStart(e, coords) {
    const resizeHandle = getResizeHandleAt(coords.x, coords.y)
    if (resizeHandle && state.selectedElements.length > 0) {
      state.isResizing = true
      state.resizeHandle = resizeHandle
      state.resizeStartBounds = getCombinedBounds()
      getSelectedElements().forEach(element => storeInitialState(element))
      state.dragOffset = coords
      return true
    }
    
    state.dragStartBounds = getCombinedBounds()
    
    const clickedElement = findElementAt(coords.x, coords.y)
    if (clickedElement) {
      const isSelected = state.selectedElements.includes(clickedElement.id)
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (isSelected) {
          deselectElement(clickedElement.id)
        } else {
          selectElement(clickedElement.id, true)
        }
      } else {
        if (!isSelected) {
          clearSelection()
          selectElement(clickedElement.id)
        }
        state.isDraggingSelection = true
        state.dragOffset = coords
        getSelectedElements().forEach(element => storeInitialState(element))
      }
      return true
    } else {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) clearSelection()
      state.isSelecting = true
      state.selectionStart = coords
      state.selectionEnd = coords
      return true
    }
  }

  function handleSelectDraw(coords) {
    if (state.isResizing) {
      if (state.selectedElements.length > 0 && state.resizeHandle && state.dragOffset && state.resizeStartBounds) {
        const totalDeltaX = coords.x - state.dragOffset.x
        const totalDeltaY = coords.y - state.dragOffset.y
        if (Math.abs(totalDeltaX) > 0.5 || Math.abs(totalDeltaY) > 0.5) {
          resizeSelectedElement(state.resizeHandle, totalDeltaX, totalDeltaY)
        }
      }
      return true
    }
    
    if (state.isDraggingSelection) {
      if (state.selectedElements.length > 0 && state.dragOffset && state.dragStartBounds) {
        let totalDeltaX = coords.x - state.dragOffset.x
        let totalDeltaY = coords.y - state.dragOffset.y
        
        activeGuides = []
        if (state.snapToObjectsEnabled) {
            const dragBounds = state.dragStartBounds
            
            let proposedX = dragBounds.x + totalDeltaX
            let proposedY = dragBounds.y + totalDeltaY
            
            let minDiffX = SNAP_THRESHOLD
            let minDiffY = SNAP_THRESHOLD
            let snapX = null
            let snapY = null
            
            const myPointsX = [proposedX, proposedX + dragBounds.width / 2, proposedX + dragBounds.width]
            const myPointsY = [proposedY, proposedY + dragBounds.height / 2, proposedY + dragBounds.height]
            
            state.elements.forEach(el => {
                if (state.selectedElements.includes(el.id)) return
                const b = getElementBounds(el)
                if (!b) return
                
                const targetX = [b.x, b.x + b.width / 2, b.x + b.width]
                const targetY = [b.y, b.y + b.height / 2, b.y + b.height]
                
                myPointsX.forEach((mx, i) => {
                    targetX.forEach(tx => {
                        const diff = Math.abs(mx - tx)
                        if (diff < minDiffX) {
                            minDiffX = diff
                            const origPoint = (i===0 ? dragBounds.x : (i===1 ? dragBounds.x + dragBounds.width/2 : dragBounds.x + dragBounds.width))
                            snapX = tx - origPoint
                        }
                    })
                })
                
                myPointsY.forEach((my, i) => {
                    targetY.forEach(ty => {
                        const diff = Math.abs(my - ty)
                        if (diff < minDiffY) {
                            minDiffY = diff
                            const origPoint = (i===0 ? dragBounds.y : (i===1 ? dragBounds.y + dragBounds.height/2 : dragBounds.y + dragBounds.height))
                            snapY = ty - origPoint
                        }
                    })
                })
            })
            
            if (snapX !== null) {
                totalDeltaX = snapX
                const newX = dragBounds.x + snapX
                const pX = [newX, newX + dragBounds.width/2, newX + dragBounds.width]
                
                 state.elements.forEach(el => {
                    if (state.selectedElements.includes(el.id)) return
                    const b = getElementBounds(el)
                    if(!b) return
                    const tX = [b.x, b.x + b.width / 2, b.x + b.width]
                    pX.forEach(px => {
                        tX.forEach(tx => {
                            if(Math.abs(px - tx) < 1) activeGuides.push({type:'x', pos: tx})
                        })
                    })
                })
            }
            
            if (snapY !== null) {
                totalDeltaY = snapY
                const newY = dragBounds.y + snapY
                const pY = [newY, newY + dragBounds.height/2, newY + dragBounds.height]
                 state.elements.forEach(el => {
                    if (state.selectedElements.includes(el.id)) return
                    const b = getElementBounds(el)
                    if(!b) return
                    const tY = [b.y, b.y + b.height / 2, b.y + b.height]
                    pY.forEach(py => {
                        tY.forEach(ty => {
                            if(Math.abs(py - ty) < 1) activeGuides.push({type:'y', pos: ty})
                        })
                    })
                })
            }
        }
        
        activeGuides = activeGuides.filter((v,i,a)=>a.findIndex(t=>(t.type===v.type && t.pos===v.pos))===i)

        moveSelectedElements(totalDeltaX, totalDeltaY)
      }
      return true
    }
    
    if (state.isSelecting) {
      state.selectionEnd = coords
      updateSelection()
      return true
    }
    
    return false
  }

  function handleSelectStop() {
    if (state.isResizing) {
      state.isResizing = false
      state.resizeHandle = null
      state.resizeStartBounds = null
      state.dragOffset = null
      getSelectedElements().forEach(element => cleanupTempState(element))
      saveState()
    }
    if (state.isDraggingSelection) {
      state.isDraggingSelection = false
      state.dragOffset = null
      state.dragStartBounds = null
      activeGuides = []
      getSelectedElements().forEach(element => cleanupTempState(element))
      saveState()
    }
    if (state.isSelecting) {
      selectElementsInBox()
      state.isSelecting = false
      state.selectionStart = null
      state.selectionEnd = null
      updateSelection()
    }
  }

  function getCursorForSelect(coords) {
    if (state.isDraggingSelection || state.isResizing || state.isSelecting) return null
    const resizeHandle = getResizeHandleAt(coords.x, coords.y)
    return resizeHandle ? (CURSOR_MAP[resizeHandle] || 'default') : 'default'
  }

  function updateSelectedColor(color) {
    if (state.selectedElements.length === 0) return
    getSelectedElements().forEach(element => { element.color = color })
    redrawCanvas()
    saveState()
  }

  function updateSelectedStrokeSize(size) {
    if (state.selectedElements.length === 0) return
    getSelectedElements().forEach(element => {
      element.strokeSize = size
      if (element.type === 'text') element.fontSize = Math.max(12, size * 4)
    })
    redrawCanvas()
    saveState()
  }

  return {
    selectElement,
    deselectElement,
    clearSelection,
    selectAllElements,
    deleteSelectedElements,
    drawSelectionIndicators,
    getResizeHandleAt,
    handleSelectStart,
    handleSelectDraw,
    handleSelectStop,
    getCursorForSelect,
    updateSelectedColor,
    updateSelectedStrokeSize,
    drawSelectionBox
  }
}

module.exports = { initSelectTool }