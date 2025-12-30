const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { exec } = require('child_process')

function setEnabled(enabled) {
  if (process.platform === 'win32') {
    manageWindowsStartupShortcut(enabled)
  } else if (process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  }
}

function manageWindowsStartupShortcut(enabled) {
  if (process.platform !== 'win32') return
  
  setImmediate(() => {
    try {
      const startupFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
      
      if (!fs.existsSync(startupFolder)) {
        fs.mkdirSync(startupFolder, { recursive: true })
      }
      
      const shortcutPath = path.join(startupFolder, `${app.getName()}.lnk`)
      
      if (enabled) {
        const exePath = app.getPath('exe')
        const workingDir = path.dirname(exePath)
        
        const escapedShortcutPath = shortcutPath.replace(/'/g, "''").replace(/\\/g, '\\')
        const escapedExePath = exePath.replace(/'/g, "''").replace(/\\/g, '\\')
        const escapedWorkingDir = workingDir.replace(/'/g, "''").replace(/\\/g, '\\')
        
        const psScript = `$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${escapedShortcutPath}'); $Shortcut.TargetPath = '${escapedExePath}'; $Shortcut.WorkingDirectory = '${escapedWorkingDir}'; $Shortcut.Save()`
        
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'ignore' }, (error) => {
          if (error) console.error('Error creating startup shortcut:', error)
        })
      } else {
        if (fs.existsSync(shortcutPath)) {
          fs.unlink(shortcutPath, (error) => {
            if (error) console.error('Error removing startup shortcut:', error)
          })
        }
      }
    } catch (error) {
      console.error('Error managing startup shortcut:', error)
    }
  })
}

function applyStartupSetting(enabled) {
  if (process.platform === 'win32') {
    manageWindowsStartupShortcut(enabled)
  } else if (process.platform === 'darwin') {
    const settings = { openAtLogin: enabled }
    if (enabled) settings.openAsHidden = true
    app.setLoginItemSettings(settings)
  }
}

module.exports = { setEnabled, applyStartupSetting }
