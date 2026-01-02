const { dialog, app, clipboard } = require('electron')

async function showRelaunchDialog(parentWindow, settingName) {
  const settingLabel = settingName === 'optimized-rendering' ? 'Optimised Rendering' : 'Hardware Acceleration'
  const result = await dialog.showMessageBox(parentWindow || null, {
    type: 'info',
    title: 'Relaunch Required',
    message: `${settingLabel} setting changed`,
    detail: 'The app needs to be relaunched for this change to take effect. Would you like to relaunch now?',
    buttons: ['Relaunch Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  })
  
  if (result.response === 0) {
    app.relaunch()
    app.exit(0)
    return true
  }
  return false
}

async function showResetConfirmation(parentWindow) {
  const result = await dialog.showMessageBox(parentWindow || null, {
    type: 'warning',
    title: 'Reset All Settings',
    message: 'Are you sure you want to reset all settings?',
    detail: 'This action cannot be undone. All your settings will be restored to their default values.',
    buttons: ['Cancel', 'Reset'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  
  return result.response === 1
}

async function showSettingsResetDialog(parentWindow) {
  await dialog.showMessageBox(parentWindow || null, {
    type: 'info',
    title: 'Settings Reset',
    message: 'All settings have been reset to defaults!',
    buttons: ['OK'],
    defaultId: 0
  })
}

async function selectSaveDirectory(parentWindow) {
  return await dialog.showOpenDialog(parentWindow || null, {
    title: 'Select Save Directory',
    properties: ['openDirectory']
  })
}

async function showSaveScreenshotDialog(parentWindow, defaultFilename) {
  return await dialog.showSaveDialog(parentWindow || null, {
    title: 'Save Screenshot',
    defaultPath: defaultFilename,
    filters: [
      { name: 'PNG Images', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
}

function showErrorBox(title, message) {
  dialog.showErrorBox(title, message)
}

async function showErrorDialog(parentWindow, title, message, detail = null) {
  await dialog.showMessageBox(parentWindow || null, {
    type: 'error',
    title: title || 'Error',
    message: message || 'An error occurred',
    detail: detail,
    buttons: ['OK'],
    defaultId: 0
  })
}

async function showWarningDialog(parentWindow, title, message, detail = null) {
  await dialog.showMessageBox(parentWindow || null, {
    type: 'warning',
    title: title || 'Warning',
    message: message || 'A warning occurred',
    detail: detail,
    buttons: ['OK'],
    defaultId: 0
  })
}

function showSecondInstanceWarning(formattedShortcut) {
  dialog.showMessageBox(null, {
    type: 'warning',
    title: 'CYC Annotate',
    message: 'CYC Annotate is already running',
    detail: `Press ${formattedShortcut} to toggle the annotation overlay.`,
    buttons: ['OK'],
    defaultId: 0,
    noLink: true
  })
}

async function showDuplicateWarning(parentWindow, elementCount) {
  const result = await dialog.showMessageBox(parentWindow || null, {
    type: 'warning',
    title: 'Duplicate Many Elements',
    message: `You are about to duplicate approximately ${elementCount} elements`,
    detail: 'Duplicating a large number of elements may affect performance. Do you want to continue?',
    buttons: ['Cancel', 'Duplicate'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    checkboxLabel: "Don't show this again",
    checkboxChecked: false
  })
  
  return {
    confirmed: result.response === 1,
    dontShowAgain: result.checkboxChecked
  }
}

async function showSystemDetailsDialog(parentWindow, systemInfo) {
  const detail = `Version: ${systemInfo.version}
OS: ${systemInfo.osVersion}
Architecture: ${systemInfo.arch}
Electron: ${systemInfo.electronVersion}
Chromium: ${systemInfo.chromeVersion}
Node.js: ${systemInfo.nodeVersion}`

  const result = await dialog.showMessageBox(parentWindow || null, {
    type: 'info',
    title: 'CYC Annotate',
    message: 'CYC Annotate',
    detail,
    buttons: ['Copy', 'OK'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })

  if (result.response === 0) clipboard.writeText(detail)
}

async function showAccentColorPresets(parentWindow, presetColors, x, y) {
  const { Menu } = require('electron')
  
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Accent Preset Colors', enabled: false },
      { type: 'separator' },
      ...presetColors.map(preset => ({
        label: preset.name,
        type: 'normal',
        click: () => {
          resolve(preset.color)
        }
      })),
      { type: 'separator' },
      {
        label: 'Cancel',
        type: 'normal',
        click: () => {
          resolve(null)
        }
      }
    ])
    
    if (parentWindow && !parentWindow.isDestroyed()) {
      try {
        menu.popup({
          window: parentWindow,
          x: x,
          y: y
        })
      } catch (error) {
        menu.popup()
      }
    } else {
      menu.popup()
    }
    
    setTimeout(() => {
      resolve(null)
    }, 5000)
  })
}

module.exports = {
  showRelaunchDialog,
  showResetConfirmation,
  showSettingsResetDialog,
  selectSaveDirectory,
  showSaveScreenshotDialog,
  showErrorBox,
  showErrorDialog,
  showWarningDialog,
  showSecondInstanceWarning,
  showDuplicateWarning,
  showSystemDetailsDialog,
  showAccentColorPresets
}