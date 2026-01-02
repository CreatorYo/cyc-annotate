const { ipcMain, nativeTheme } = require('electron');

function initThemeIpc(context) {
  const { getWin, getSettingsWin, getOnboardingWin, setSetting, getSetting, getNotificationHandler } = context;

  nativeTheme.on('updated', () => {
    const currentTheme = getSetting('theme', 'system');
    if (currentTheme === 'system') {
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      
      const win = getWin();
      if (win && !win.isDestroyed()) {
        win.webContents.send('os-theme-changed', effectiveTheme);
      }
      const settingsWin = getSettingsWin();
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.webContents.send('os-theme-changed', effectiveTheme);
      }
      const onboardingWin = getOnboardingWin();
      if (onboardingWin && !onboardingWin.isDestroyed()) {
        onboardingWin.webContents.send('os-theme-changed', effectiveTheme);
      }
      const notificationHandler = getNotificationHandler();
      const nWin = notificationHandler?.getWin();
      if (nWin && !nWin.isDestroyed()) {
        nWin.webContents.send('os-theme-changed', effectiveTheme);
      }
    }
  });

  ipcMain.handle('get-os-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.on('theme-changed', (event, theme) => {
    if (theme === 'system') {
      nativeTheme.themeSource = 'system';
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      
      const win = getWin();
      if (win && !win.isDestroyed()) {
        win.webContents.send('os-theme-changed', effectiveTheme);
        win.webContents.send('theme-changed', theme);
      }
      const settingsWin = getSettingsWin();
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.webContents.send('os-theme-changed', effectiveTheme);
        settingsWin.webContents.send('theme-changed', theme);
      }
      const notificationHandler = getNotificationHandler();
      const nWin = notificationHandler?.getWin();
      if (nWin && !nWin.isDestroyed()) {
        nWin.webContents.send('os-theme-changed', effectiveTheme);
        nWin.webContents.send('theme-changed', theme);
      }
    } else {
      nativeTheme.themeSource = theme;
      
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