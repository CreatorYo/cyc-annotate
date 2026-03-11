const { ipcMain, nativeImage, clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');

function initScreenshotsIpc(context) {
  const { getWin, getSetting, showDesktopNotification, dialogs } = context;

  ipcMain.on('open-screenshot-file', async (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        await shell.openPath(filePath);
      } catch (error) {
        dialogs.showErrorDialog(getWin(), 'File Error', 'Failed to open file', error.message);
      }
    }
  });

  ipcMain.on('save-screenshot', async (event, dataURL, defaultFilename) => {
    const win = getWin();
    try {
      if (!win || win.isDestroyed()) return;

      const copyToClipboard = getSetting('copy-snapshot-clipboard', false);
      const autoSaveEnabled = getSetting('auto-save-snapshots', false);
      const saveDirectory = getSetting('save-directory-path', null);
      const hasValidDirectory = saveDirectory?.trim() && fs.existsSync(saveDirectory);
      
      let savedFilePath = null;
      let clipboardCopied = false;
      const img = nativeImage.createFromDataURL(dataURL);
      
      if (copyToClipboard) {
        try {
          clipboard.writeImage(img);
          clipboardCopied = true;
        } catch (error) {
          dialogs.showErrorDialog(win, 'Clipboard Error', 'Failed to copy to clipboard', error.message);
        }
      }

      if (autoSaveEnabled && hasValidDirectory) {
        try {
          const buffer = img.toPNG();
          savedFilePath = path.join(saveDirectory, `annotation-${Date.now()}.png`);
          fs.writeFileSync(savedFilePath, buffer);
        } catch (error) {
          dialogs.showErrorDialog(win, 'Auto-Save Error', 'Failed to auto-save screenshot', 'Please check your save directory settings.');
        }
      }

      if (!savedFilePath && (autoSaveEnabled ? !hasValidDirectory : !copyToClipboard)) {
        const result = await dialogs.showSaveScreenshotDialog(win, defaultFilename);

        if (!result.canceled && result.filePath) {
          try {
            fs.writeFileSync(result.filePath, img.toPNG());
            savedFilePath = result.filePath;
          } catch (error) {
            dialogs.showErrorDialog(win, 'Save Error', 'Failed to save screenshot', error.message);
          }
        }
      }
      
      const showNotification = getSetting('screenshot-notification', true);
      
      setTimeout(() => {
        if (clipboardCopied && savedFilePath) {
          showDesktopNotification('Screenshot Saved & Copied', 'Saved and copied to clipboard', savedFilePath);
        } else if (clipboardCopied) {
          if (showNotification) {
            showDesktopNotification('Screenshot Copied', 'Copied to clipboard', null);
          }
        } else if (savedFilePath) {
          if (showNotification) {
            showDesktopNotification('Screenshot Saved', 'Screenshot saved successfully', savedFilePath);
          }
        }
      }, 100);
      
      if (win && !win.isDestroyed()) {
        win.webContents.send('screenshot-saved');
      }
    } catch (error) {
      dialogs.showErrorDialog(win, 'Dialog Error', 'Failed to show save dialog', error.message);
      if (win && !win.isDestroyed()) {
        win.webContents.send('screenshot-saved');
      }
    }
  });
}

module.exports = initScreenshotsIpc;