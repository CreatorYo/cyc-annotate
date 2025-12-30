const { Tray, Menu, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

let tray = null
let deps = {}

function init(dependencies) {
  deps = dependencies
  return { create, destroy, get: () => tray }
}

function create() {
  if (tray) {
    try { tray.destroy() } catch (e) {}
    tray = null
  }
  
  try {
    const iconPathIco = path.join(__dirname, '../../../icon.ico')
    const iconPathPng = path.join(__dirname, '../../../icon.png')
    const iconPath = fs.existsSync(iconPathIco) ? iconPathIco : iconPathPng
    
    tray = new Tray(iconPath)
    tray.setToolTip('CYC Annotate')
    tray.setContextMenu(buildMenu())
    tray.on('click', () => deps.toggleOverlay?.())
  } catch (e) {
    console.warn('Could not create system tray:', e)
  }
}

function destroy() {
  if (tray) {
    try { tray.destroy() } catch (e) {}
    tray = null
  }
}

function buildMenu() {
  const { app, getWin, getSettingsWin, saveAnnotationsForRelaunch } = deps
  
  return Menu.buildFromTemplate([
    { 
      label: 'Settings', 
      click: () => {
        const settingsWin = getSettingsWin?.()
        if (settingsWin && !settingsWin.isDestroyed()) {
          if (settingsWin.isMinimized()) settingsWin.restore()
          settingsWin.focus()
        } else {
          ipcMain.emit('open-settings')
        }
      }
    },
    { 
      label: 'Relaunch', 
      click: async () => {
        await saveAnnotationsForRelaunch?.()
        app.relaunch({ args: process.argv.slice(1).concat(['--restore-annotations']) })
        app.exit()
      }
    },
    { type: 'separator' },
    { label: 'Quit CYC Annotate', click: () => app.quit() }
  ])
}

module.exports = { init }