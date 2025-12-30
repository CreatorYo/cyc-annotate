const { globalShortcut } = require('electron')

let currentShortcut = null
let deps = {}

function init(dependencies) {
  deps = dependencies
  return { register, unregisterAll, setShortcut, getShortcut, isRegistered }
}

function isRegistered() {
  return currentShortcut && globalShortcut.isRegistered(currentShortcut)
}

function setShortcut(newShortcut) {
  currentShortcut = newShortcut
}

function getShortcut() {
  return currentShortcut
}

function register() {
  if (!currentShortcut) return
  
  try {
    if (globalShortcut.isRegistered(currentShortcut)) {
      globalShortcut.unregister(currentShortcut)
    } else {
      globalShortcut.unregisterAll()
    }
  } catch (e) {
    globalShortcut.unregisterAll()
  }
  
  const attemptRegister = (attempt = 0, maxAttempts = 10) => {
    if (attempt >= maxAttempts) return false
    
    try {
      const registered = globalShortcut.register(currentShortcut, () => {
        deps.onShortcutPressed?.()
      })
      
      if (registered) return true
      
      setTimeout(() => attemptRegister(attempt + 1, maxAttempts), 100 * (attempt + 1))
      return false
    } catch (error) {
      setTimeout(() => attemptRegister(attempt + 1, maxAttempts), 100 * (attempt + 1))
      return false
    }
  }
  
  setTimeout(() => attemptRegister(), 50)
}

function unregisterAll() {
  globalShortcut.unregisterAll()
}

module.exports = { init }
