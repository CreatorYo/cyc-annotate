const { ipcMain } = require('electron');

function initDialogsIpc(context) {
  const { getWin, getSettingsWin, getSetting, setSetting, dialogs, app, getOsVersion } = context;

  ipcMain.handle('show-relaunch-dialog', async (event, settingName) => {
    return await dialogs.showRelaunchDialog(getSettingsWin(), settingName);
  });

  ipcMain.handle('show-system-details-dialog', async () => {
    const systemInfo = {
      version: app.getVersion(),
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      osVersion: getOsVersion()
    };
    await dialogs.showSystemDetailsDialog(getSettingsWin(), systemInfo);
  });

  ipcMain.handle('show-reset-confirmation', async (event) => {
    return await dialogs.showResetConfirmation(getSettingsWin());
  });

  ipcMain.handle('show-settings-reset-dialog', async () => {
    await dialogs.showSettingsResetDialog(getSettingsWin());
  });

  ipcMain.handle('show-accent-color-presets', async (event, presetColors, x, y, options = {}) => {
    return await dialogs.showAccentColorPresets(getSettingsWin(), presetColors, x, y, options);
  });

  ipcMain.handle('show-duplicate-warning', async (event, elementCount) => {
    const dismissedDialogs = getSetting('dismissed-dialogs', {});
    if (dismissedDialogs['duplicate-warning']) {
      return true;
    }
    
    const result = await dialogs.showDuplicateWarning(getWin(), elementCount);
    
    if (result.dontShowAgain && result.confirmed) {
      dismissedDialogs['duplicate-warning'] = true;
      setSetting('dismissed-dialogs', dismissedDialogs);
      const settingsWin = getSettingsWin();
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.webContents.send('dismissed-dialogs-updated');
      }
    }
    
    return result.confirmed;
  });

  ipcMain.handle('get-dismissed-dialogs', () => {
    return getSetting('dismissed-dialogs', {});
  });

  ipcMain.on('reset-dismissed-dialog', (event, dialogId) => {
    const dismissedDialogs = getSetting('dismissed-dialogs', {});
    delete dismissedDialogs[dialogId];
    setSetting('dismissed-dialogs', dismissedDialogs);
    const settingsWin = getSettingsWin();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('dismissed-dialogs-updated');
    }
  });

  ipcMain.on('reset-all-dismissed-dialogs', () => {
    setSetting('dismissed-dialogs', {});
    const settingsWin = getSettingsWin();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('dismissed-dialogs-updated');
    }
  });

  ipcMain.handle('select-save-directory', async () => {
    return await dialogs.selectSaveDirectory(getWin());
  });

  ipcMain.handle('show-error-dialog', async (event, title, message, detail) => {
    await dialogs.showErrorDialog(getWin(), title, message, detail);
  });

  ipcMain.handle('show-warning-dialog', async (event, title, message, detail) => {
    await dialogs.showWarningDialog(getWin(), title, message, detail);
  });
}

module.exports = initDialogsIpc;