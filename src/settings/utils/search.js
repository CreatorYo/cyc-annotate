class SettingsSearch {
  constructor() {
    this.lastSearchTerm = null
    this.cachedElements = null
    this.settingsData = null
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.indexSettings()
  }

  indexSettings() {
    const sections = document.querySelectorAll('.settings-section')
    this.settingsData = Array.from(sections).map(section => {
      const category = section.getAttribute('data-category') || ''
      const sectionContent = section.querySelector('.section-content')
      
      const items = []
      if (sectionContent) {
        let currentSubsection = null
        Array.from(sectionContent.children).forEach(node => {
          if (node.classList.contains('setting-subsection-title')) {
            currentSubsection = node
            items.push({
              type: 'subsection',
              element: node,
              text: node.textContent.toLowerCase()
            })
          } else if (node.classList.contains('setting-item')) {
            const label = node.querySelector('label')?.textContent.toLowerCase() || ''
            const description = node.querySelector('.setting-description')?.textContent.toLowerCase() || ''
            const keywords = node.getAttribute('data-keywords')?.toLowerCase() || ''
            
            const subItems = Array.from(node.querySelectorAll('.setting-sub-item')).map(sub => ({
              element: sub,
              text: (sub.querySelector('label')?.textContent.toLowerCase() || '') + ' ' + (sub.getAttribute('data-keywords')?.toLowerCase() || '')
            }))

            items.push({
              type: 'item',
              element: node,
              subsection: currentSubsection,
              label,
              description,
              keywords,
              subItems,
              allText: `${label} ${description} ${keywords} ${subItems.map(s => s.text).join(' ')}`
            })
          }
        })
      }

      const categoryTitleInfo = this.getCategoryTitles()[category]
      const icon = this.getCategoryIcon(category)
      const header = document.createElement('div')
      header.className = 'search-category-header'
      header.style.display = 'none'
      header.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        <span>${categoryTitleInfo?.title || category}</span>
      `
      section.insertBefore(header, section.firstChild)

      return {
        section,
        category,
        items,
        header,
        sectionData: (section.getAttribute('data-section') || '').toLowerCase()
      }
    })

    this.cachedElements = {
      sections,
      categoryHeader: document.querySelector('.settings-header'),
      headerDivider: document.querySelector('.header-divider'),
      noResults: document.getElementById('no-results'),
      noResultsMessage: document.getElementById('no-results-message'),
      clearSearchBtn: document.getElementById('clear-search')
    }
  }

  setupEventListeners() {
    const settingsSearch = document.getElementById('settings-search')
    const sidebarSearchToggle = document.getElementById('sidebar-search-toggle')
    const sidebarSearchContainer = document.querySelector('.sidebar-search-container')
    const clearSearchBtn = document.getElementById('clear-search')

    if (settingsSearch) {
      settingsSearch.addEventListener('input', (e) => {
        this.performSearch(e.target.value)
      })

      settingsSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          settingsSearch.value = ''
          this.performSearch('')
          if (clearSearchBtn) clearSearchBtn.style.display = 'none'
          if (sidebarSearchToggle && sidebarSearchContainer) {
            sidebarSearchContainer.style.display = 'none'
            sidebarSearchToggle.classList.remove('active')
          }
          settingsSearch.blur()
        }
      })
    }

    if (sidebarSearchToggle && sidebarSearchContainer) {
      sidebarSearchToggle.addEventListener('click', () => {
        this.toggleSearch()
      })
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (settingsSearch) {
          settingsSearch.value = ''
          this.performSearch('')
          clearSearchBtn.style.display = 'none'
          settingsSearch.focus()
        }
      })
    }

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        e.stopPropagation()
        this.toggleSearch()
        return
      }
    })
  }

  toggleSearch() {
    const sidebarSearchContainer = document.querySelector('.sidebar-search-container')
    const sidebarSearchToggle = document.getElementById('sidebar-search-toggle')
    const settingsSearch = document.getElementById('settings-search')
    
    if (!sidebarSearchContainer || !settingsSearch) return
    
    const isCurrentlyVisible = window.getComputedStyle(sidebarSearchContainer).display !== 'none'
    
    if (isCurrentlyVisible) {
      sidebarSearchContainer.style.display = 'none'
      sidebarSearchToggle?.classList.remove('active')
      settingsSearch.value = ''
      this.performSearch('')
      settingsSearch.blur()
    } else {
      sidebarSearchContainer.style.display = 'block'
      sidebarSearchToggle?.classList.add('active')
      setTimeout(() => {
        settingsSearch.focus()
        settingsSearch.select()
      }, 10)
    }
  }

  toggleSettingsSearch() {
    const sidebarSearchToggle = document.getElementById('sidebar-search-toggle')
    const sidebarSearchContainer = document.querySelector('.sidebar-search-container')
    const settingsSearch = document.getElementById('settings-search')
    
    if (sidebarSearchToggle && sidebarSearchContainer) {
      const isVisible = sidebarSearchContainer.style.display !== 'none'
      if (isVisible) {
        sidebarSearchContainer.style.display = 'none'
        sidebarSearchToggle.classList.remove('active')
        if (settingsSearch) {
          settingsSearch.value = ''
          this.performSearch('')
        }
      } else {
        sidebarSearchContainer.style.display = 'block'
        sidebarSearchToggle.classList.add('active')
        setTimeout(() => {
          if (settingsSearch) {
            settingsSearch.focus()
          }
        }, 100)
      }
    }
  }

  performSearch(query) {
    if (!this.settingsData) {
      this.indexSettings()
      if (!this.settingsData) return
    }

    const searchTerm = query.toLowerCase().trim()
    
    if (searchTerm === this.lastSearchTerm) return
    this.lastSearchTerm = searchTerm

    const { categoryHeader, headerDivider, noResults, noResultsMessage, clearSearchBtn } = this.cachedElements
    
    let hasResults = false

    if (searchTerm === '') {
      const currentCat = this.getCurrentCategory()
      this.settingsData.forEach(data => {
        const isCurrent = data.category === currentCat
        
        if (data.section.classList.contains('active') !== isCurrent) {
          data.section.classList.toggle('active', isCurrent)
        }
        if (data.section.classList.contains('search-result-section')) {
          data.section.classList.remove('search-result-section')
        }
        if (data.section.classList.contains('hidden')) {
          data.section.classList.remove('hidden')
        }
        if (data.header.style.display !== 'none') {
          data.header.style.display = 'none'
        }
        
        data.items.forEach(item => {
          if (item.element.classList.contains('hidden')) {
            item.element.classList.remove('hidden')
          }
          if (item.element.classList.contains('last-visible')) {
            item.element.classList.remove('last-visible')
          }
          if (item.type === 'item') {
            item.subItems.forEach(sub => {
              if (sub.element.style.display !== '') {
                sub.element.style.display = ''
              }
            })
          }
        })
      })
      
      if (categoryHeader) categoryHeader.style.display = 'block'
      if (headerDivider) headerDivider.style.display = 'block'
      if (noResults) noResults.style.display = 'none'
      if (clearSearchBtn) clearSearchBtn.style.display = 'none'
      return
    }

    if (clearSearchBtn && clearSearchBtn.style.display !== 'flex') clearSearchBtn.style.display = 'flex'
    if (categoryHeader && categoryHeader.style.display !== 'none') categoryHeader.style.display = 'none'
    if (headerDivider && headerDivider.style.display !== 'none') headerDivider.style.display = 'none'

    const categoryTitles = this.getCategoryTitles()

    this.settingsData.forEach(data => {
      if (data.category === 'labs') {
        if (!data.section.classList.contains('hidden')) {
          data.section.classList.remove('active', 'search-result-section')
          data.section.classList.add('hidden')
          data.header.style.display = 'none'
        }
        return
      }

      const categoryTitleInfo = categoryTitles[data.category]
      const categoryTitle = categoryTitleInfo?.title.toLowerCase() || ''
      const sectionMatches = categoryTitle.includes(searchTerm) || data.sectionData.includes(searchTerm)
      
      let sectionHasVisibleItems = false
      let subsectionHasMatches = false
      let lastVisibleItem = null

      data.items.forEach(item => {
        if (item.type === 'subsection') {
          if (!item.element.classList.contains('hidden')) {
            item.element.classList.add('hidden')
          }
          subsectionHasMatches = item.text.includes(searchTerm)
        } else {
          const itemMatches = item.allText.includes(searchTerm)
          const isMatch = itemMatches || sectionMatches || subsectionHasMatches
          
          if (isMatch) {
            if (item.element.classList.contains('hidden')) {
              item.element.classList.remove('hidden')
            }
            if (item.element.classList.contains('last-visible')) {
              item.element.classList.remove('last-visible')
            }

            item.subItems.forEach(sub => {
              const subMatches = sub.text.includes(searchTerm)
              const shouldShow = subMatches || sectionMatches || subsectionHasMatches
              const currentDisplay = sub.element.style.display
              if (shouldShow && currentDisplay !== 'block') {
                sub.element.style.display = 'block'
              } else if (!shouldShow && currentDisplay !== 'none') {
                sub.element.style.display = 'none'
              }
            })
            
            sectionHasVisibleItems = true
            hasResults = true
            lastVisibleItem = item.element
            if (item.subsection && item.subsection.classList.contains('hidden')) {
              item.subsection.classList.remove('hidden')
            }
          } else {
            if (!item.element.classList.contains('hidden')) {
              item.element.classList.add('hidden')
            }
          }
        }
      })
      
      if (sectionHasVisibleItems) {
        if (!data.section.classList.contains('active')) data.section.classList.add('active')
        if (!data.section.classList.contains('search-result-section')) data.section.classList.add('search-result-section')
        if (data.section.classList.contains('hidden')) data.section.classList.remove('hidden')
        if (data.header.style.display !== 'flex') data.header.style.display = 'flex'
        
        if (lastVisibleItem) {
          lastVisibleItem.classList.add('last-visible')
        }
      } else {
        if (data.section.classList.contains('active')) data.section.classList.remove('active')
        if (data.section.classList.contains('search-result-section')) data.section.classList.remove('search-result-section')
        if (!data.section.classList.contains('hidden')) data.section.classList.add('hidden')
        if (data.header.style.display !== 'none') data.header.style.display = 'none'
      }
    })

    if (noResults) {
      const shouldShowNoResults = !hasResults
      if (noResults.style.display !== (shouldShowNoResults ? 'flex' : 'none')) {
        noResults.style.display = shouldShowNoResults ? 'flex' : 'none'
      }
      
      if (!hasResults && noResultsMessage) {
        const trimmedQuery = query.trim()
        const newContent = `No results found for <span class="no-results-quote">"</span><span class="search-query-highlight">${trimmedQuery}</span><span class="no-results-quote">"</span>`
        if (noResultsMessage.innerHTML !== newContent) {
          noResultsMessage.innerHTML = newContent
        }
      }
    }
  }

  getCategoryIcon(category) {
    const navItem = document.querySelector(`.nav-item[data-category="${category}"]`)
    const icon = navItem?.querySelector('.material-symbols-outlined')?.textContent
    return icon || 'settings'
  }

  getCategoryTitles() {
    return window.categoryTitles || {}
  }

  getCurrentCategory() {
    return window.currentCategory || 'appearance'
  }
}

module.exports = SettingsSearch