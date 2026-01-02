const { ipcMain, nativeTheme } = require('electron');

function initThemeIpc(context) {
  const { getWin, getSettingsWin, getOnboardingWin, setSetting, getSetting, getNotificationHandler } = context;

  ipcMain.handle('get-os-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.on('theme-changed', (event, theme) => {
    if (theme === 'system') {
      nativeTheme.themeSource = 'system';
    } else if (theme === 'light') {
      nativeTheme.themeSource = 'light';
    } else if (theme === 'dark') {
      nativeTheme.themeSource = 'dark';
    }
    
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme-changed', theme);
    }
    const settingsWin = getSettingsWin();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('theme-changed', theme);
    }
    const notificationHandler = getNotificationHandler();
    const nWin = notificationHandler?.getWin();
    if (nWin && !nWin.isDestroyed()) {
      nWin.webContents.send('theme-changed', theme);
    }
  });

  ipcMain.on('accent-color-changed', (event, color) => {
    setSetting('accent-color', color);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('accent-color-changed', color);
    }
    const onboardingWin = getOnboardingWin();
    if (onboardingWin && !onboardingWin.isDestroyed()) {
      onboardingWin.webContents.send('accent-color-changed', color);
    }
  });

  ipcMain.on('toggle-windows-accent-sync', (event, enabled) => {
    const { setWindowsAccentSyncEnabled } = context;
    setWindowsAccentSyncEnabled(enabled);
    setSetting('sync-windows-accent-auto', enabled);
  });

  ipcMain.handle('get-sync-windows-accent-state', () => {
    const { getWindowsAccentSyncEnabled } = context;
    return getWindowsAccentSyncEnabled() || getSetting('sync-windows-accent-auto', false);
  });

  ipcMain.handle('get-windows-accent-color', () => {
    const { getWindowsAccentColor } = context;
    return getWindowsAccentColor();
  });
}

module.exports = initThemeIpc;