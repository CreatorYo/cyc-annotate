const { ipcMain, dialog, BrowserWindow, nativeTheme } = require('electron')

function init(context) {
  ipcMain.on('select-custom-sound', async (event, soundType) => {
    try {
      const settingsWin = context.getSettingsWin()
      if (!settingsWin || settingsWin.isDestroyed()) return

      const allowedExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'mp4']
      const result = await dialog.showOpenDialog(settingsWin, {
        title: `Select Custom Sound for ${soundType}`,
        filters: [
          { name: 'Supported Audio & Video', extensions: allowedExtensions }
        ],
        properties: ['openFile']
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const path = require('path')
        const ext = path.extname(filePath).toLowerCase().replace('.', '')
        
        if (!allowedExtensions.includes(ext)) {
          await dialog.showMessageBox(settingsWin, {
            type: 'error',
            title: 'Unsupported File Format',
            message: 'You must upload a supported sound format.',
            detail: `Supported formats: ${allowedExtensions.map(e => '.' + e).join(', ')}`,
            buttons: ['OK']
          })
          return
        }

        const fs = require('fs')
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          const fileSizeMB = stats.size / (1024 * 1024)
          
          if (fileSizeMB > 2) {
            const warningResult = await dialog.showMessageBox(settingsWin, {
              type: 'warning',
              buttons: ['Choose Another File', 'Use Anyway'],
              defaultId: 0,
              title: 'Audio File May Be Too Long',
              message: 'This audio file might be too long for a sound effect.',
              detail: 'For the best user experience, sound effects should be short (under 8 seconds). Large files may cause delays when using annotation tools.'
            })
            
            if (warningResult.response === 0) {
              ipcMain.emit('select-custom-sound', event, soundType)
              return
            }
          }
          
          settingsWin.webContents.send('custom-sound-selected', soundType, filePath)
          
          const win = context.getWin()
          if (win && !win.isDestroyed()) {
            win.webContents.send('custom-sound-updated', soundType, filePath)
          }
        }
      }
    } catch (error) {
      context.dialogs.showErrorDialog(settingsWin, 'Selection Error', 'Failed to select custom sound.', error.message)
    }
  })

  ipcMain.on('custom-sound-selected', (event, soundType, filePath) => {
    const win = context.getWin()
    if (win && !win.isDestroyed()) {
      win.webContents.send('custom-sound-updated', soundType, filePath)
    }
  })

  ipcMain.on('reset-custom-sound', (event, soundType) => {
    try {
      const win = context.getWin()
      if (win && !win.isDestroyed()) {
        win.webContents.send('custom-sound-reset', soundType)
      }
    } catch (error) {
      context.dialogs.showErrorDialog(win, 'Reset Error', 'Failed to reset custom sound.', error.message)
    }
  })

  let activeProgressDialog = null

  ipcMain.on('test-all-sounds', (event, accentColor) => {
    try {
      if (activeProgressDialog && !activeProgressDialog.isDestroyed()) {
        activeProgressDialog.focus()
        return
      }

      const win = context.getWin()
      if (win && !win.isDestroyed()) {
        activeProgressDialog = new BrowserWindow({
          width: 400,
          height: 150,
          modal: false,
          frame: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          resizable: false,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
          },
          parent: win
        })

        const path = require('path')
        activeProgressDialog.loadFile(path.join(__dirname, '../../renderer/pages/settings/sound-test-dialog.html'))

        let currentTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'

        activeProgressDialog.webContents.on('did-finish-load', () => {
          activeProgressDialog.webContents.send('set-theme', {
            theme: currentTheme,
            accentColor: accentColor
          })
        })

        const themeUpdateHandler = () => {
          if (activeProgressDialog && !activeProgressDialog.isDestroyed()) {
            currentTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
            activeProgressDialog.webContents.send('set-theme', {
              theme: currentTheme,
              accentColor: accentColor
            })
          }
        }
        nativeTheme.on('updated', themeUpdateHandler)

        const manualThemeHandler = (e, newTheme) => {
          if (activeProgressDialog && !activeProgressDialog.isDestroyed()) {
            currentTheme = newTheme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : newTheme
            activeProgressDialog.webContents.send('set-theme', {
              theme: currentTheme,
              accentColor: accentColor
            })
          }
        }
        const accentHandler = (e, newAccent) => {
          if (activeProgressDialog && !activeProgressDialog.isDestroyed()) {
            accentColor = newAccent
            activeProgressDialog.webContents.send('set-theme', {
              theme: currentTheme,
              accentColor: accentColor
            })
          }
        }

        ipcMain.on('theme-changed', manualThemeHandler)
        ipcMain.on('accent-color-changed', accentHandler)

        const soundTypes = [
          { type: 'pop', name: 'Click/Pop', duration: 600 },
          { type: 'undo', name: 'Undo', duration: 800 },
          { type: 'redo', name: 'Redo', duration: 800 },
          { type: 'capture', name: 'Capture', duration: 1000 },
          { type: 'color', name: 'Colour Change', duration: 700 },
          { type: 'trash', name: 'Clear/Trash', duration: 900 },
          { type: 'copy', name: 'Copy', duration: 800 },
          { type: 'paste', name: 'Paste', duration: 900 },
          { type: 'selectAll', name: 'Select All', duration: 1000 },
          { type: 'standbyOn', name: 'Standby On', duration: 1200 },
          { type: 'standbyOff', name: 'Standby Off', duration: 800 },
          { type: 'visibilityOn', name: 'Visibility On', duration: 700 },
          { type: 'visibilityOff', name: 'Visibility Off', duration: 600 },
          { type: 'timerAlarm', name: 'Timer Alarm', duration: 1500 }
        ]

        let currentIndex = 0
        let testTimeout = null
        let isTestStopped = false
        
        function playNextSound() {
          if (isTestStopped || !activeProgressDialog || activeProgressDialog.isDestroyed()) {
            return
          }

          if (currentIndex >= soundTypes.length) {
            activeProgressDialog.webContents.send('test-complete')
            return
          }

          const sound = soundTypes[currentIndex]
          
          activeProgressDialog.webContents.send('update-test-progress', {
            soundName: sound.name,
            progress: (currentIndex / soundTypes.length) * 100,
            current: currentIndex + 1,
            total: soundTypes.length
          })

          win.webContents.send('test-sound', sound.type)

          testTimeout = setTimeout(() => {
            if (!isTestStopped) {
              currentIndex++
              playNextSound()
            }
          }, sound.duration)
        }

        const stopHandler = () => {
          isTestStopped = true
          clearTimeout(testTimeout)
          if (activeProgressDialog && !activeProgressDialog.isDestroyed()) {
            activeProgressDialog.close()
          }
        }
        ipcMain.on('stop-sound-test', stopHandler)

        testTimeout = setTimeout(() => {
          if (!isTestStopped) {
            playNextSound()
          }
        }, 500)

        activeProgressDialog.on('closed', () => {
          isTestStopped = true
          clearTimeout(testTimeout)
          activeProgressDialog = null
          ipcMain.removeListener('stop-sound-test', stopHandler)
          ipcMain.removeListener('theme-changed', manualThemeHandler)
          ipcMain.removeListener('accent-color-changed', accentHandler)
          nativeTheme.removeListener('updated', themeUpdateHandler)
        })
      }
    } catch (error) {
      context.dialogs.showErrorDialog(win, 'Test Error', 'An error occurred while testing sound effects.', error.message)
    }
  })

  ipcMain.handle('check-file-exists', async (event, filePath) => {
    if (!filePath) return false;
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.isFile();
      }
      return false;
    } catch (error) {
      return false;
    }
  });
}

module.exports = { init }