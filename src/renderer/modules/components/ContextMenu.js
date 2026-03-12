const { playSound } = require('../utils/audio/soundEffects.js')

class ContextMenu {
  constructor() {
    this.element = null
    this.onAction = null
    this.submenuTimeout = null
  }

  show(event, items, onAction) {
    this.hide()
    this.onAction = onAction

    this.element = document.createElement('div')
    this.element.className = 'context-menu'
    
    this.element.addEventListener('contextmenu', (e) => e.preventDefault())

    this.element.innerHTML = this._renderItems(items)
    document.body.appendChild(this.element)

    this._positionMenu(event.clientX, event.clientY)

    requestAnimationFrame(() => {
      if (this.element) this.element.classList.add('show')
    })

    this._setupEvents()
    this._setupSubmenuEvents()
  }

  hide() {
    if (this.closeHandler) {
      window.removeEventListener('mousedown', this.closeHandler)
      this.closeHandler = null
    }

    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler)
      this.keyHandler = null
    }
    
    if (this.submenuTimeout) {
      clearTimeout(this.submenuTimeout)
      this.submenuTimeout = null
    }

    if (this.element) {
      this.element.remove()
      this.element = null
      this.onAction = null
    }
  }

  isVisible() {
    return !!this.element
  }

  _renderItems(items) {
    return items.map(item => {
      if (item.type === 'separator') {
        return '<div class="context-menu-separator"></div>'
      }

      const classes = ['context-menu-item']
      if (item.className) classes.push(item.className)
      if (item.submenu) classes.push('submenu-item')

      let html = `
        <div class="${classes.join(' ')}" data-action="${item.action || ''}">
          ${item.icon ? `<span class="material-symbols-outlined">${item.icon}</span>` : ''}
          <span>${item.label}</span>
          ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}
          ${item.submenu ? '<span class="material-symbols-outlined submenu-arrow">chevron_right</span>' : ''}
        </div>
      `

      if (item.submenu) {
        html += `
          <div class="context-submenu">
            ${this._renderItems(item.submenu)}
          </div>
        `
      }

      return html
    }).join('')
  }

  _positionMenu(x, y) {
    if (!this.element) return

    const rect = this.element.getBoundingClientRect()
    const winWidth = window.innerWidth
    const winHeight = window.innerHeight

    if (x + rect.width > winWidth) {
      x = Math.max(10, winWidth - rect.width - 10)
    }

    if (y + rect.height > winHeight) {
      y = Math.max(10, winHeight - rect.height - 10)
    }

    this.element.style.left = x + 'px'
    this.element.style.top = y + 'px'
  }

  _setupEvents() {
    this.closeHandler = (e) => {
      if (this.element && !this.element.contains(e.target)) {
        this.hide()
      }
    }
    
    this.keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') {
        this.hide()
      }
    }

    requestAnimationFrame(() => {
      if (this.element) {
        window.addEventListener('mousedown', this.closeHandler)
        window.addEventListener('keydown', this.keyHandler)
      }
    })

    this.element.addEventListener('click', (e) => {
      e.stopPropagation()
      const itemEl = e.target.closest('.context-menu-item')
      if (!itemEl) return
      
      if (itemEl.classList.contains('submenu-item')) {
        const submenu = itemEl.nextElementSibling
        if (!submenu || !submenu.classList.contains('context-submenu')) return
        
        const isShowing = submenu.classList.contains('show')
        
        this.element.querySelectorAll('.context-submenu').forEach(el => {
          if (el !== submenu) el.classList.remove('show')
        })

        if (!isShowing) {
           this._positionSubmenu(itemEl, submenu)
           submenu.classList.add('show')
        } else {
           submenu.classList.remove('show')
        }
        return
      }

      const action = itemEl.dataset.action
      if (action && this.onAction) {
        this.onAction(action)
        this.hide()
      }
    })
  }

  _positionSubmenu(item, submenu) {
      const menuRect = this.element.getBoundingClientRect()
      
      let left = menuRect.width - 4
      let top = item.offsetTop - 6
      
      const screenRight = menuRect.left + menuRect.width + submenu.offsetWidth
      if (screenRight > window.innerWidth) {
         left = -submenu.offsetWidth + 4
      }

      submenu.style.left = left + 'px'
      submenu.style.top = top + 'px'
  }

  _setupSubmenuEvents() {
    const submenuItems = this.element.querySelectorAll('.submenu-item')
    
    submenuItems.forEach(item => {
      const submenu = item.nextElementSibling
      if (!submenu || !submenu.classList.contains('context-submenu')) return

      item.addEventListener('mouseenter', () => {
        clearTimeout(this.submenuTimeout)
        this._positionSubmenu(item, submenu)
        
        this.element.querySelectorAll('.context-submenu').forEach(el => {
            if (el !== submenu) el.classList.remove('show')
        })
        
        submenu.classList.add('show')
      })

      item.addEventListener('mouseleave', () => {
        this.submenuTimeout = setTimeout(() => {
          if (!submenu.matches(':hover')) {
            submenu.classList.remove('show')
          }
        }, 100)
      })

      submenu.addEventListener('mouseenter', () => {
        clearTimeout(this.submenuTimeout)
      })

      submenu.addEventListener('mouseleave', () => {
        submenu.classList.remove('show')
      })
    })
  }
}

module.exports = new ContextMenu()