class Dropdown {
  constructor(options = {}) {
    this.options = options.options || []
    this.filteredOptions = [...this.options]
    this.selectedValue = options.defaultValue || null
    this.onChange = options.onChange || (() => {})
    this.placeholder = options.placeholder || 'Select...'
    this.icon = options.icon || null
    this.searchable = options.searchable || false
    this.searchPlaceholder = options.searchPlaceholder || 'Search...'
    this.element = null
    this.isOpen = false
    this.id = options.id || `dropdown-${Date.now()}`
    this.searchQuery = ''
    
    this._handleOutsideClick = this._handleOutsideClick.bind(this)
    this._handleKeydown = this._handleKeydown.bind(this)
  }

  render(container) {
    this.element = document.createElement('div')
    this.element.className = 'app-dropdown'
    this.element.id = this.id
    
    this._buildTrigger()
    this._buildMenu()
    this._setupEvents()
    
    if (container) {
      container.appendChild(this.element)
    }
    
    return this.element
  }

  _buildTrigger() {
    const trigger = document.createElement('button')
    trigger.className = 'app-dropdown-trigger'
    trigger.type = 'button'
    
    const content = document.createElement('span')
    content.className = 'trigger-content'
    
    if (this.icon) {
      const iconEl = document.createElement('span')
      iconEl.className = 'material-symbols-outlined'
      iconEl.textContent = this.icon
      content.appendChild(iconEl)
    }
    
    const textSpan = document.createElement('span')
    textSpan.className = 'trigger-text'
    textSpan.textContent = this._getSelectedLabel()
    content.appendChild(textSpan)
    
    trigger.appendChild(content)
    
    const arrow = document.createElement('span')
    arrow.className = 'material-symbols-outlined arrow'
    arrow.textContent = 'expand_more'
    trigger.appendChild(arrow)
    
    this.triggerEl = trigger
    this.triggerTextEl = textSpan
    this.element.appendChild(trigger)
  }

  _buildMenu() {
    const menu = document.createElement('div')
    menu.className = 'app-dropdown-menu'
    
    if (this.searchable) {
      const searchWrapper = document.createElement('div')
      searchWrapper.className = 'app-dropdown-search'
      
      const searchIcon = document.createElement('span')
      searchIcon.className = 'material-symbols-outlined'
      searchIcon.textContent = 'search'
      searchWrapper.appendChild(searchIcon)
      
      const searchInput = document.createElement('input')
      searchInput.type = 'text'
      searchInput.className = 'app-dropdown-search-input'
      searchInput.placeholder = this.searchPlaceholder
      searchInput.autocomplete = 'off'
      searchWrapper.appendChild(searchInput)
      
      this.searchInputEl = searchInput
      menu.appendChild(searchWrapper)
    }
    
    const itemsContainer = document.createElement('div')
    itemsContainer.className = 'app-dropdown-items'
    this._renderItems(itemsContainer)
    
    this.itemsContainerEl = itemsContainer
    menu.appendChild(itemsContainer)
    
    this.menuEl = menu
    this.element.appendChild(menu)
  }

  _renderItems(container) {
    container.innerHTML = ''
    
    if (this.filteredOptions.length === 0) {
      const noResults = document.createElement('div')
      noResults.className = 'app-dropdown-no-results'
      noResults.textContent = 'No results found'
      container.appendChild(noResults)
      return
    }
    
    this.filteredOptions.forEach(option => {
      const item = document.createElement('div')
      item.className = 'app-dropdown-item'
      item.dataset.value = option.value
      
      if (option.value === this.selectedValue) {
        item.classList.add('selected')
      }
      
      if (option.icon) {
        const iconEl = document.createElement('span')
        iconEl.className = 'material-symbols-outlined'
        iconEl.textContent = option.icon
        item.appendChild(iconEl)
      }
      
      const label = document.createElement('span')
      label.textContent = option.label
      item.appendChild(label)
      
      container.appendChild(item)
    })
  }

  _setupEvents() {
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggle()
    })
    
    this.menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('.app-dropdown-item')
      if (item) {
        this.select(item.dataset.value)
      }
    })
    
    if (this.searchable && this.searchInputEl) {
      this.searchInputEl.addEventListener('input', (e) => {
        this._filterOptions(e.target.value)
      })
      
      this.searchInputEl.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    }
  }

  _filterOptions(query) {
    this.searchQuery = query.toLowerCase().trim()
    
    if (!this.searchQuery) {
      this.filteredOptions = [...this.options]
    } else {
      this.filteredOptions = this.options.filter(option => 
        option.label.toLowerCase().includes(this.searchQuery) ||
        option.value.toLowerCase().includes(this.searchQuery)
      )
    }
    
    this._renderItems(this.itemsContainerEl)
  }

  _handleOutsideClick(e) {
    if (this.element && !this.element.contains(e.target)) {
      this.close()
    }
  }

  _handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close()
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open() {
    this.isOpen = true
    
    if (this.searchable && this.searchInputEl) {
      this.searchInputEl.value = ''
      this.filteredOptions = [...this.options]
      this._renderItems(this.itemsContainerEl)
    }
    
    const rect = this.element.getBoundingClientRect()
    const menuHeight = 320
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      this.element.classList.add('flip')
    } else {
      this.element.classList.remove('flip')
    }
    
    this.element.classList.add('open')
    document.addEventListener('click', this._handleOutsideClick)
    document.addEventListener('keydown', this._handleKeydown)
    
    if (this.searchable && this.searchInputEl) {
      setTimeout(() => {
        this.searchInputEl.focus({ preventScroll: true })
      }, 10)
    }
  }

  close() {
    this.isOpen = false
    this.element.classList.remove('open')
    this.element.classList.remove('flip')
    document.removeEventListener('click', this._handleOutsideClick)
    document.removeEventListener('keydown', this._handleKeydown)
  }

  select(value) {
    this.selectedValue = value
    
    this.itemsContainerEl.querySelectorAll('.app-dropdown-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.value === value)
    })
    
    this.triggerTextEl.textContent = this._getSelectedLabel()
    this.close()
    this.onChange(value)
  }

  setValue(value) {
    this.selectedValue = value
    this.filteredOptions = [...this.options]
    this._renderItems(this.itemsContainerEl)
    this.triggerTextEl.textContent = this._getSelectedLabel()
  }

  _getSelectedLabel() {
    const option = this.options.find(o => o.value === this.selectedValue)
    return option ? option.label : this.placeholder
  }

  destroy() {
    document.removeEventListener('click', this._handleOutsideClick)
    document.removeEventListener('keydown', this._handleKeydown)
    if (this.element) {
      this.element.remove()
    }
  }
}

module.exports = Dropdown
