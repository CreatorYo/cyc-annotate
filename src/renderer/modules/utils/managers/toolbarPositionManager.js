class ToolbarPositionManager {
  constructor(toolbarElement, options = {}) {
    this.toolbar = toolbarElement
    this.isDragging = false
    this.dragTarget = null
    this.dragStartPos = { x: 0, y: 0 }
    this.toolbarStartPos = { x: 0, y: 0 }
    
    const isWhiteboard = window.location.pathname.includes('whiteboard.html')
    this.storagePrefix = isWhiteboard ? 'wb-toolbar' : 'toolbar'
    
    this.currentLayout = localStorage.getItem(`${this.storagePrefix}-layout`) || options.layout || 'vertical'
    this.currentVerticalPosition = localStorage.getItem('toolbar-position-vertical') || options.verticalPosition || 'left'
    this.currentHorizontalPosition = localStorage.getItem('toolbar-position-horizontal') || options.horizontalPosition || 'bottom'
    
    this.toolbar.style.opacity = '0'
    this.toolbar.style.transition = 'opacity 0.2s ease'
    
    const doInit = () => this.init()
    
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(doInit).catch(doInit)
    } else {
      doInit()
    }
  }

  init() {
    this.dragTarget = null
    this.dragStartPos = { x: 0, y: 0 }
    this.toolbarStartPos = { x: 0, y: 0 }
    
    this.toolbar.classList.remove('toolbar-vertical', 'toolbar-horizontal')
    this.toolbar.classList.add(`toolbar-${this.currentLayout}`)
    
    this.setupEventListeners()
    this.loadPosition()
    this.updateDropdownPositioning()
    this.updateDragHandleVisibility()
    
    this.revealAttempts = 0
    const revealToolbar = () => {
      this.revealAttempts++
      const rect = this.toolbar.getBoundingClientRect()
      const minDim = this.currentLayout === 'vertical' ? rect.height : rect.width
      
      if ((minDim > 50 && rect.width > 0) || this.revealAttempts > 20) {
        this.resetPosition(true)
        this.toolbar.style.opacity = '1'
      } else {
        setTimeout(revealToolbar, 50)
      }
    }
    setTimeout(revealToolbar, 50)
  }

  setupEventListeners() {
    this._boundMouseDown = (e) => this.handleMouseDown(e)
    this._boundMouseMove = (e) => this.handleMouseMove(e)
    this._boundMouseUp = () => this.handleMouseUp()
    this._boundMouseLeave = () => this.handleMouseLeave()
    this._boundDblClick = (e) => this.handleDoubleClick(e)
    this._boundResize = () => {
      if (!this.isDragging) {
        this.resetPosition(true)
      }
    }

    this.toolbar.addEventListener('mousedown', this._boundMouseDown)
    document.addEventListener('mousemove', this._boundMouseMove)
    document.addEventListener('mouseup', this._boundMouseUp)
    document.addEventListener('mouseleave', this._boundMouseLeave)
    this.toolbar.addEventListener('dblclick', this._boundDblClick)
    window.addEventListener('resize', this._boundResize)
    
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isDragging) {
        this.resetPosition(true)
      }
    })
    this.resizeObserver.observe(this.toolbar)

    window.addEventListener('storage', (e) => {
      if (e.key === 'toolbar-dragging-enabled') {
        this.updateDragHandleVisibility()
      } else if (
        e.key.includes('toolbar-x') || 
        e.key.includes('toolbar-y') || 
        e.key.includes('toolbar-layout') ||
        e.key === 'toolbar-position-vertical' ||
        e.key === 'toolbar-position-horizontal'
      ) {
        this.currentLayout = localStorage.getItem(`${this.storagePrefix}-layout`) || 'vertical'
        this.currentVerticalPosition = localStorage.getItem('toolbar-position-vertical') || 'left'
        this.currentHorizontalPosition = localStorage.getItem('toolbar-position-horizontal') || 'bottom'
        
        this.toolbar.classList.remove('toolbar-vertical', 'toolbar-horizontal')
        this.toolbar.classList.add(`toolbar-${this.currentLayout}`)
        this.resetPosition(true)
      }
    })
  }

  updateDragHandleVisibility() {
    const enabled = localStorage.getItem('toolbar-dragging-enabled') !== 'false'
    const handle = this.toolbar.querySelector('.toolbar-drag-handle')
    if (handle) {
      handle.style.display = enabled ? 'flex' : 'none'
    }
    
    if (!enabled) {
      this.toolbar.classList.add('toolbar-moving-disabled')
    } else {
      this.toolbar.classList.remove('toolbar-moving-disabled') 
    }
  }

  handleMouseDown(e) {
    const enableToolbarMoving = localStorage.getItem('toolbar-dragging-enabled') !== 'false'
    if (!enableToolbarMoving) return
    
    const clickedButton = e.target.closest('button')
    const clickedColor = e.target.closest('.color-swatch')
    const clickedWrapper = e.target.closest('.stroke-thickness-wrapper, .shapes-wrapper, .drawing-tools-wrapper, .custom-color-wrapper')
    const clickedPopup = e.target.closest('.stroke-popup, .shapes-popup, .drawing-tools-wrapper, .custom-color-popup')
    const clickedOption = e.target.closest('.stroke-option, .shape-option, .drawing-tool-option, .color-option')
    const clickedGroup = e.target.closest('.toolbar-group, .color-palette')
    
    if (clickedButton || clickedColor || clickedWrapper || clickedPopup || clickedOption || clickedGroup) {
      return
    }

    const ishandle = e.target.closest('.toolbar-drag-handle')
    if (!ishandle) return
    
    if (e.button !== 0) return

    this.isDragging = true
    this.dragTarget = this.toolbar
    this.toolbar.classList.add('dragging')
    
    const rect = this.toolbar.getBoundingClientRect()
    this.dragStartPos.x = e.clientX
    this.dragStartPos.y = e.clientY
    
    this.toolbarStartPos.x = rect.left + rect.width / 2
    
    if (this.currentLayout === 'vertical') {
      this.toolbarStartPos.y = rect.top + rect.height / 2
    } else {
      this.toolbarStartPos.y = window.innerHeight - rect.bottom
    }
    
    e.preventDefault()
    e.stopPropagation()
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.dragTarget) return
    
    const isShiftPressed = e.shiftKey
    this.toolbar.style.cursor = isShiftPressed ? 'crosshair' : 'grabbing'
    
    if (!isShiftPressed) {
      const EDGE_THRESHOLD = 20 
      const CORNER_THRESHOLD = 40
      
      const distLeft = e.clientX
      const distRight = window.innerWidth - e.clientX
      const distTop = e.clientY
      const distBottom = window.innerHeight - e.clientY
      
      const inCorner = (distLeft < CORNER_THRESHOLD && distTop < CORNER_THRESHOLD) || 
                       (distRight < CORNER_THRESHOLD && distTop < CORNER_THRESHOLD) ||
                       (distLeft < CORNER_THRESHOLD && distBottom < CORNER_THRESHOLD) ||
                       (distRight < CORNER_THRESHOLD && distBottom < CORNER_THRESHOLD)
      
      if (!inCorner) {
        if (this.currentLayout === 'vertical') {
          if (distTop < EDGE_THRESHOLD || distBottom < EDGE_THRESHOLD) {
            this.switchLayout('horizontal', e.clientX, e.clientY)
            return
          }
        } else {
          if (distLeft < EDGE_THRESHOLD || distRight < EDGE_THRESHOLD) {
            this.switchLayout('vertical', e.clientX, e.clientY)
            return
          }
        }
      }
    }
    
    const deltaX = e.clientX - this.dragStartPos.x
    const deltaY = e.clientY - this.dragStartPos.y
    
    if (this.currentLayout === 'vertical') {
      this.updateVerticalPosition(deltaX, deltaY, isShiftPressed)
    } else {
      this.updateHorizontalPosition(deltaX, deltaY, isShiftPressed)
    }
  }

  switchLayout(newLayout, clientX, clientY) {
    if (this.currentLayout === newLayout) return

    this.currentLayout = newLayout
    this.toolbar.classList.remove('toolbar-vertical', 'toolbar-horizontal')
    this.toolbar.classList.add(`toolbar-${newLayout}`)
    localStorage.setItem(`${this.storagePrefix}-layout`, newLayout)
    
    const rect = this.toolbar.getBoundingClientRect()
    this.dragStartPos = { x: clientX, y: clientY }
    
    if (newLayout === 'vertical') {
      this.toolbarStartPos.y = clientY - 12 + rect.height / 2
      this.toolbarStartPos.x = clientX
      this.updateVerticalPosition(0, 0, false)
    } else {
      this.toolbarStartPos.x = clientX - 12 + rect.width / 2
      this.toolbarStartPos.y = window.innerHeight - clientY - rect.height / 2
      this.updateHorizontalPosition(0, 0, false)
    }
    
    this.updateDropdownPositioning()
  }

  updateVerticalPosition(deltaX, deltaY, isShiftPressed = false) {
    let newX = this.toolbarStartPos.x + deltaX
    let newY = this.toolbarStartPos.y + deltaY

    const toolbarHalfWidth = this.toolbar.offsetWidth / 2
    const toolbarHalfHeight = this.toolbar.offsetHeight / 2
    
    const isWhiteboard = window.location.pathname.includes('whiteboard.html')
    const topLimit = isWhiteboard ? (40 + toolbarHalfHeight) : toolbarHalfHeight
    
    if (!isShiftPressed) {
      const snapThreshold = 15
      if (newX < toolbarHalfWidth + snapThreshold) newX = toolbarHalfWidth
      else if (newX > window.innerWidth - toolbarHalfWidth - snapThreshold) newX = window.innerWidth - toolbarHalfWidth
      
      if (newY < toolbarHalfHeight + snapThreshold) newY = toolbarHalfHeight
      else if (newY > window.innerHeight - toolbarHalfHeight - snapThreshold) newY = window.innerHeight - toolbarHalfHeight
    }
    
    newX = Math.max(toolbarHalfWidth, Math.min(newX, window.innerWidth - toolbarHalfWidth))
    newY = Math.max(topLimit, Math.min(newY, window.innerHeight - toolbarHalfHeight))
    
    this.toolbar.style.left = newX + 'px'
    this.toolbar.style.top = newY + 'px'
    this.toolbar.style.transform = 'translate(-50%, -50%)'
    this.toolbar.style.bottom = 'auto'
    this.toolbar.style.right = 'auto'
    
    this.updateEdgeClasses(newX, newY, toolbarHalfWidth, toolbarHalfHeight)
  }

  updateHorizontalPosition(deltaX, deltaY, isShiftPressed = false) {
    let newX = this.toolbarStartPos.x + deltaX
    let newY = this.toolbarStartPos.y - deltaY

    const toolbarHalfWidth = this.toolbar.offsetWidth / 2
    const toolbarHeight = this.toolbar.offsetHeight
    
    const isWhiteboard = window.location.pathname.includes('whiteboard.html')
    const topLimitPos = isWhiteboard ? (window.innerHeight - 40 - toolbarHeight) : (window.innerHeight - toolbarHeight)
    
    if (!isShiftPressed) {
      const snapThreshold = 15
      if (newX < toolbarHalfWidth + snapThreshold) newX = toolbarHalfWidth
      else if (newX > window.innerWidth - toolbarHalfWidth - snapThreshold) newX = window.innerWidth - toolbarHalfWidth
      
      if (newY < snapThreshold) newY = 0
      else if (newY > window.innerHeight - toolbarHeight - snapThreshold) newY = window.innerHeight - toolbarHeight
    }
    
    newX = Math.max(toolbarHalfWidth, Math.min(newX, window.innerWidth - toolbarHalfWidth))
    newY = Math.max(0, Math.min(newY, topLimitPos))
    
    this.toolbar.style.left = newX + 'px'
    this.toolbar.style.bottom = newY + 'px'
    this.toolbar.style.transform = 'translateX(-50%)'
    this.toolbar.style.top = 'auto'
    this.toolbar.style.right = 'auto'
    
    this.updateEdgeClasses(newX, newY, toolbarHalfWidth, toolbarHeight / 2, true)
  }

  handleMouseUp() {
    if (this.isDragging && this.dragTarget) {
      this.isDragging = false
      this.dragTarget = null
      this.toolbar.classList.remove('dragging')
      this.toolbar.style.cursor = ''
      this.savePosition()
      this.updateDropdownPositioning()
    }
  }

  handleMouseLeave() {
    if (this.isDragging && this.dragTarget) {
      this.isDragging = false
      this.dragTarget = null
      this.toolbar.classList.remove('dragging')
      this.toolbar.style.cursor = ''
      this.savePosition()
      this.updateDropdownPositioning()
    }
  }

  handleDoubleClick(e) {
    const ishandle = e.target.closest('.toolbar-drag-handle')
    if (ishandle) {
        e.stopPropagation()
        e.preventDefault()
        this.resetPosition(false, true)
        return
    }
  }

  setLayout(layout, forceReset = false, shouldSave = true) {
    const layoutChanged = this.currentLayout !== layout
    this.currentLayout = layout
    this.toolbar.classList.remove('toolbar-vertical', 'toolbar-horizontal')
    this.toolbar.classList.add(`toolbar-${layout}`)
    if (shouldSave) localStorage.setItem(`${this.storagePrefix}-layout`, layout)
    
    this.resetPosition(forceReset ? false : true, shouldSave)
    this.updateDropdownPositioning()
  }

  setVerticalPosition(position, shouldSave = true) {
    this.currentVerticalPosition = position
    if (shouldSave) localStorage.setItem('toolbar-position-vertical', position)
    if (this.currentLayout === 'vertical') {
      this.resetPosition(false, shouldSave)
    }
    this.updateDropdownPositioning()
  }

  setHorizontalPosition(position, shouldSave = true) {
    this.currentHorizontalPosition = position
    if (shouldSave) localStorage.setItem('toolbar-position-horizontal', position)
    if (this.currentLayout === 'horizontal') {
      this.resetPosition(false, shouldSave)
    }
    this.updateDropdownPositioning()
  }

  resetPosition(useSaved = false, shouldSave = true) {
    const rect = this.toolbar.getBoundingClientRect()
    const toolbarWidth = rect.width || this.toolbar.offsetWidth
    const toolbarHeight = rect.height || this.toolbar.offsetHeight

    if (toolbarWidth === 0 && this.revealAttempts < 20) {
      requestAnimationFrame(() => this.resetPosition(useSaved, shouldSave))
      return
    }

    const layoutKey = this.currentLayout === 'vertical' ? 'vertical' : 'horizontal'
    const savedX = localStorage.getItem(`${this.storagePrefix}-${layoutKey}-x`)
    const savedY = localStorage.getItem(`${this.storagePrefix}-${layoutKey}-y`)

    const toolbarHalfWidth = toolbarWidth / 2
    const toolbarHalfHeight = toolbarHeight / 2
    const isWhiteboard = window.location.pathname.includes('whiteboard.html')
    const topLimit = isWhiteboard ? (40 + toolbarHalfHeight) : toolbarHalfHeight

    if (useSaved && savedX !== null && savedY !== null && !isNaN(parseFloat(savedX))) {
      let x = parseFloat(savedX)
      let y = parseFloat(savedY)
      
      if (this.currentLayout === 'vertical') {
        x = Math.max(toolbarHalfWidth, Math.min(x, window.innerWidth - toolbarHalfWidth))
        y = Math.max(topLimit, Math.min(y, window.innerHeight - toolbarHalfHeight))

        this.toolbar.style.left = x + 'px'
        this.toolbar.style.top = y + 'px'
        this.toolbar.style.transform = 'translate(-50%, -50%)'
        this.toolbar.style.bottom = 'auto'
        this.toolbar.style.right = 'auto'
      } else {
        const topLimitPos = isWhiteboard ? (window.innerHeight - 40 - toolbarHeight) : (window.innerHeight - toolbarHeight)
        x = Math.max(toolbarHalfWidth, Math.min(x, window.innerWidth - toolbarHalfWidth))
        y = Math.max(0, Math.min(y, topLimitPos))

        this.toolbar.style.left = x + 'px'
        this.toolbar.style.bottom = y + 'px'
        this.toolbar.style.transform = 'translateX(-50%)'
        this.toolbar.style.top = 'auto'
        this.toolbar.style.right = 'auto'
      }
    } else {
      if (!useSaved && shouldSave) {
        localStorage.removeItem(`${this.storagePrefix}-${layoutKey}-x`)
        localStorage.removeItem(`${this.storagePrefix}-${layoutKey}-y`)
      }

      const margin = 20
      if (this.currentLayout === 'vertical') {
        const isLeft = this.currentVerticalPosition === 'left'
        const centerX = isLeft ? (margin + toolbarHalfWidth) : (window.innerWidth - margin - toolbarHalfWidth)
        
        this.toolbar.style.left = centerX + 'px'
        this.toolbar.style.top = '50%'
        this.toolbar.style.transform = 'translate(-50%, -50%)'
        this.toolbar.style.right = 'auto'
        this.toolbar.style.bottom = 'auto'
      } else {
        const isBottom = this.currentHorizontalPosition === 'bottom'
        const distY = isBottom ? margin : (window.innerHeight - toolbarHeight * 2 - margin)
        
        this.toolbar.style.left = '50%'
        this.toolbar.style.bottom = distY + 'px'
        this.toolbar.style.transform = 'translateX(-50%)'
        this.toolbar.style.top = 'auto'
        this.toolbar.style.right = 'auto'
      }
    }
    
    setTimeout(() => this.updateDropdownPositioning(), 10)
  }

  savePosition() {
    const rect = this.toolbar.getBoundingClientRect()
    const layoutKey = this.currentLayout === 'vertical' ? 'vertical' : 'horizontal'
    const centerX = rect.left + rect.width / 2
    
    if (this.currentLayout === 'vertical') {
      const centerY = rect.top + rect.height / 2
      localStorage.setItem(`${this.storagePrefix}-vertical-x`, centerX)
      localStorage.setItem(`${this.storagePrefix}-vertical-y`, centerY)
    } else {
      const bottomY = window.innerHeight - rect.bottom
      localStorage.setItem(`${this.storagePrefix}-horizontal-x`, centerX)
      localStorage.setItem(`${this.storagePrefix}-horizontal-y`, bottomY)
    }
  }

  loadPosition() {
    this.resetPosition(true)
  }

  updateDropdownPositioning() {
    const rect = this.toolbar.getBoundingClientRect()
    if (rect.width === 0) return

    if (this.currentLayout === 'vertical') {
      const toolbarCenterX = rect.left + rect.width / 2
      const isOnRightSide = toolbarCenterX > window.innerWidth / 2
      this.toolbar.classList.toggle('toolbar-right-side', isOnRightSide)
      this.toolbar.classList.remove('toolbar-top-side')
    } else {
      const toolbarCenterY = rect.top + rect.height / 2
      const isOnTop = toolbarCenterY < window.innerHeight / 2
      this.toolbar.classList.toggle('toolbar-top-side', isOnTop)
      this.toolbar.classList.remove('toolbar-right-side')
    }

    const toolbarHalfWidth = rect.width / 2
    const toolbarHalfHeight = rect.height / 2
    
    if (this.currentLayout === 'vertical') {
      this.updateEdgeClasses(rect.left + toolbarHalfWidth, rect.top + toolbarHalfHeight, toolbarHalfWidth, toolbarHalfHeight)
    } else {
      const bottomY = window.innerHeight - rect.bottom
      this.updateEdgeClasses(rect.left + toolbarHalfWidth, bottomY, toolbarHalfWidth, rect.height / 2, true)
    }
  }

  updateEdgeClasses(x, y, halfW, halfH, isHorizontal = false) {
    this.toolbar.classList.remove('at-left-edge', 'at-right-edge', 'at-top-edge', 'at-bottom-edge')
    const threshold = 5
    
    if (x <= halfW + threshold) this.toolbar.classList.add('at-left-edge')
    else if (x >= window.innerWidth - halfW - threshold) this.toolbar.classList.add('at-right-edge')
    
    if (isHorizontal) {
      if (y <= threshold) this.toolbar.classList.add('at-bottom-edge')
      else if (y >= window.innerHeight - halfH * 2 - threshold) this.toolbar.classList.add('at-top-edge')
    } else {
      if (y <= halfH + threshold) this.toolbar.classList.add('at-top-edge')
      else if (y >= window.innerHeight - halfH - threshold) this.toolbar.classList.add('at-bottom-edge')
    }
  }

  destroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect()
    this.toolbar.removeEventListener('mousedown', this._boundMouseDown)
    this.toolbar.removeEventListener('dblclick', this._boundDblClick)
    document.removeEventListener('mousemove', this._boundMouseMove)
    document.removeEventListener('mouseup', this._boundMouseUp)
    document.removeEventListener('mouseleave', this._boundMouseLeave)
    window.removeEventListener('resize', this._boundResize)
  }
}

module.exports = ToolbarPositionManager
