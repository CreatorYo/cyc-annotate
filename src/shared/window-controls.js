const { ipcRenderer } = require('electron')

function initWindowControls(options = {}) {
  const {
    showMinimize = true,
    showMaximize = true,
    showClose = true
  } = options

  function setupControls() {
    const windowMinimizeBtn = document.getElementById('window-minimize')
    const windowMaximizeBtn = document.getElementById('window-maximize')
    const windowCloseBtn = document.getElementById('window-close')

    if (windowMinimizeBtn && showMinimize) {
      windowMinimizeBtn.style.display = 'flex'
      windowMinimizeBtn.addEventListener('click', () => {
        ipcRenderer.send('window-minimize')
      })
    } else if (windowMinimizeBtn) {
      windowMinimizeBtn.style.display = 'none'
    }

    if (windowMaximizeBtn && showMaximize) {
      windowMaximizeBtn.style.display = 'flex'
      windowMaximizeBtn.addEventListener('click', () => {
        ipcRenderer.send('window-maximize')
      })
    } else if (windowMaximizeBtn) {
      windowMaximizeBtn.style.display = 'none'
    }

    if (windowCloseBtn && showClose) {
      windowCloseBtn.style.display = 'flex'
      windowCloseBtn.addEventListener('click', () => {
        ipcRenderer.send('window-close')
      })
    } else if (windowCloseBtn) {
      windowCloseBtn.style.display = 'none'
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupControls)
  } else {
    setupControls()
  }
}

module.exports = { initWindowControls }