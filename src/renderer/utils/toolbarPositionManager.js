class ToolbarPositionManager {
  constructor(toolbarElement, options = {}) {
    this.toolbar = toolbarElement
    this.isDragging = false
    this.dragTarget = null
    this.dragStartPos = { x: 0, y: 0 }
    this.toolbarStartPos = { x: 0, y: 0 }
    
    this.currentLayout = localStorage.getItem('toolbar-layout') || options.layout || 'vertical'
    this.currentVerticalPosition = localStorage.getItem('toolbar-position-vertical') || options.verticalPosition || 'left'
    this.currentHorizontalPosition = localStorage.getItem('toolbar-position-horizontal') || options.horizontalPosition || 'bottom'
    
    this.toolbar.style.opacity = '0'
    this.toolbar.style.transition = 'opacity 0.2s ease'
    
    this.init()
  }

  init() {
    this.dragTarget = null
    this.dragStartPos = { x: 0, y: 0 }
    this.toolbarStartPos = { x: 0, y: 0 }
    
    this.setupEventListeners()
    this.loadPosition()
    this.updateDropdownPositioning()
    
    setTimeout(() => {
      this.toolbar.style.opacity = '1'
    }, 50)
  }

  setupEventListeners() {
    this.toolbar.addEventListener('mousedown', (e) => this.handleMouseDown(e))
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e))
    document.addEventListener('mouseup', () => this.handleMouseUp())
    document.addEventListener('mouseleave', () => this.handleMouseLeave())
    this.toolbar.addEventListener('dblclick', (e) => this.handleDoubleClick(e))
    window.addEventListener('resize', () => this.updateDropdownPositioning())
  }

  handleMouseDown(e) {
    const disableToolbarMoving = localStorage.getItem('disable-toolbar-moving') !== 'false'
    if (disableToolbarMoving) return
    
    const clickedButton = e.target.closest('button')
    const clickedColor = e.target.closest('.color-swatch')
    const clickedWrapper = e.target.closest('.stroke-thickness-wrapper, .shapes-wrapper, .drawing-tools-wrapper, .custom-color-wrapper')
    const clickedPopup = e.target.closest('.stroke-popup, .shapes-popup, .drawing-tools-popup, .custom-color-popup')
    const clickedOption = e.target.closest('.stroke-option, .shape-option, .drawing-tool-option, .color-option')
    const clickedGroup = e.target.closest('.toolbar-group, .color-palette')
    
    if (clickedButton || clickedColor || clickedWrapper || clickedPopup || clickedOption || clickedGroup) {
      return
    }

    if (e.button !== 0) return

    this.isDragging = true
    this.dragTarget = this.toolbar
    this.toolbar.classList.add('dragging')
    
    const rect = this.toolbar.getBoundingClientRect()
    this.dragStartPos.x = e.clientX
    this.dragStartPos.y = e.clientY
    
    if (this.currentLayout === 'vertical') {
      this.toolbarStartPos.x = rect.left
      this.toolbarStartPos.y = rect.top + rect.height / 2
    } else {
      this.toolbarStartPos.x = rect.left + rect.width / 2
      this.toolbarStartPos.y = window.innerHeight - rect.bottom
    }
    
    e.preventDefault()
    e.stopPropagation()
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.dragTarget) return
    
    const deltaX = e.clientX - this.dragStartPos.x
    const deltaY = e.clientY - this.dragStartPos.y
    
    if (this.currentLayout === 'vertical') {
      this.updateVerticalPosition(deltaX, deltaY)
    } else {
      this.updateHorizontalPosition(deltaX, deltaY)
    }
  }

  updateVerticalPosition(deltaX, deltaY) {
    let newX = this.toolbarStartPos.x + deltaX
    let newY = this.toolbarStartPos.y + deltaY

    const toolbarHalfWidth = this.toolbar.offsetWidth / 2
    const toolbarHalfHeight = this.toolbar.offsetHeight / 2
    const padding = 10
    
    newX = Math.max(toolbarHalfWidth + padding, Math.min(newX, window.innerWidth - toolbarHalfWidth - padding))
    newY = Math.max(toolbarHalfHeight + padding, Math.min(newY, window.innerHeight - toolbarHalfHeight - padding))
    
    this.toolbar.style.left = newX + 'px'
    this.toolbar.style.top = newY + 'px'
    this.toolbar.style.transform = 'translate(-50%, -50%)'
    this.toolbar.style.bottom = 'auto'
    this.toolbar.style.right = 'auto'
  }

  updateHorizontalPosition(deltaX, deltaY) {
    let newX = this.toolbarStartPos.x + deltaX
    let newY = this.toolbarStartPos.y - deltaY

    const toolbarHalfWidth = this.toolbar.offsetWidth / 2
    const toolbarHeight = this.toolbar.offsetHeight
    const padding = 10
    
    newX = Math.max(toolbarHalfWidth + padding, Math.min(newX, window.innerWidth - toolbarHalfWidth - padding))
    newY = Math.max(padding, Math.min(newY, window.innerHeight - toolbarHeight - padding))
    
    this.toolbar.style.left = newX + 'px'
    this.toolbar.style.bottom = newY + 'px'
    this.toolbar.style.transform = 'translateX(-50%)'
    this.toolbar.style.top = 'auto'
    this.toolbar.style.right = 'auto'
  }

  handleMouseUp() {
    if (this.isDragging && this.dragTarget) {
      this.isDragging = false
      this.dragTarget = null
      this.toolbar.classList.remove('dragging')
      this.savePosition()
      this.updateDropdownPositioning()
    }
  }

  handleMouseLeave() {
    if (this.isDragging && this.dragTarget) {
      this.isDragging = false
      this.dragTarget = null
      this.toolbar.classList.remove('dragging')
      this.savePosition()
      this.updateDropdownPositioning()
    }
  }

  handleDoubleClick(e) {
    const clickedButton = e.target.closest('button')
    const clickedColor = e.target.closest('.color-swatch')
    const clickedWrapper = e.target.closest('.stroke-thickness-wrapper, .shapes-wrapper, .drawing-tools-wrapper, .custom-color-wrapper')
    const clickedPopup = e.target.closest('.stroke-popup, .shapes-popup, .drawing-tools-popup, .custom-color-popup')
    const clickedOption = e.target.closest('.stroke-option, .shape-option, .drawing-tool-option, .color-option')
    const clickedGroup = e.target.closest('.toolbar-group, .color-palette')
    
    if (clickedButton || clickedColor || clickedWrapper || clickedPopup || clickedOption || clickedGroup) {
      return
    }
    
    e.stopPropagation()
    this.resetPosition()
  }

  setLayout(layout) {
    this.currentLayout = layout
    this.toolbar.classList.remove('toolbar-vertical', 'toolbar-horizontal')
    this.toolbar.classList.add(`toolbar-${layout}`)
    localStorage.setItem('toolbar-layout', layout)
    
    this.resetPosition()
    this.updateDropdownPositioning()
  }

  setVerticalPosition(position) {
    this.currentVerticalPosition = position
    localStorage.setItem('toolbar-position-vertical', position)
    this.resetPosition()
    this.updateDropdownPositioning()
  }

  setHorizontalPosition(position) {
    this.currentHorizontalPosition = position
    localStorage.setItem('toolbar-position-horizontal', position)
    this.resetPosition()
    this.updateDropdownPositioning()
  }

  resetPosition() {
    if (this.currentLayout === 'vertical') {
      const isLeft = this.currentVerticalPosition === 'left'
      this.toolbar.style[isLeft ? 'left' : 'right'] = '20px'
      this.toolbar.style[isLeft ? 'right' : 'left'] = 'auto'
      this.toolbar.style.top = '50%'
      this.toolbar.style.transform = 'translateY(-50%)'
      this.toolbar.style.bottom = 'auto'
    } else {
      const isBottom = this.currentHorizontalPosition === 'bottom'
      this.toolbar.style[isBottom ? 'bottom' : 'top'] = '20px'
      this.toolbar.style[isBottom ? 'top' : 'bottom'] = 'auto'
      this.toolbar.style.left = '50%'
      this.toolbar.style.transform = 'translateX(-50%)'
      this.toolbar.style.right = 'auto'
    }
    
    setTimeout(() => {
      this.savePosition()
      this.updateDropdownPositioning()
    }, 10)
  }

  savePosition() {
    const rect = this.toolbar.getBoundingClientRect()
    if (this.currentLayout === 'vertical') {
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      localStorage.setItem('toolbar-x', centerX)
      localStorage.setItem('toolbar-y', centerY)
    } else {
      const centerX = rect.left + rect.width / 2
      const bottomY = window.innerHeight - rect.bottom
      localStorage.setItem('toolbar-x', centerX)
      localStorage.setItem('toolbar-y', bottomY)
    }
  }

  loadPosition() {
    this.resetPosition()
    setTimeout(() => {
      this.updateDropdownPositioning()
    }, 100)
  }

  updateDropdownPositioning() {
    const rect = this.toolbar.getBoundingClientRect()
    
    if (this.currentLayout === 'vertical') {
      const toolbarCenterX = rect.left + rect.width / 2
      const isOnRightSide = toolbarCenterX > window.innerWidth / 2
      
      if (isOnRightSide) {
        this.toolbar.classList.add('toolbar-right-side')
      } else {
        this.toolbar.classList.remove('toolbar-right-side')
      }
      
      this.toolbar.classList.remove('toolbar-top-side')
    } else {
      const toolbarCenterY = rect.top + rect.height / 2
      const isOnTop = toolbarCenterY < window.innerHeight / 2
      
      if (isOnTop) {
        this.toolbar.classList.add('toolbar-top-side')
      } else {
        this.toolbar.classList.remove('toolbar-top-side')
      }
      
      this.toolbar.classList.remove('toolbar-right-side')
    }
  }

  getLayout() {
    return this.currentLayout
  }

  getVerticalPosition() {
    return this.currentVerticalPosition
  }

  getHorizontalPosition() {
    return this.currentHorizontalPosition
  }

  destroy() {
    this.toolbar.removeEventListener('mousedown', this.handleMouseDown)
    this.toolbar.removeEventListener('dblclick', this.handleDoubleClick)
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)
    document.removeEventListener('mouseleave', this.handleMouseLeave)
    window.removeEventListener('resize', this.updateDropdownPositioning)
  }
}

module.exports = ToolbarPositionManager
