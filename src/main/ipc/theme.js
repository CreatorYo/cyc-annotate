const { ipcMain, nativeTheme } = require('electron');

function initThemeIpc(context) {
  const { setSetting, getSetting } = context;

  const broadcast = (channel, ...args) => {
    const windows = [
      context.getWin(),
      context.getSettingsWin(),
      context.getOnboardingWin(),
      context.getNotificationHandler()?.getWin(),
      ...(context.getWhiteboardWindows ? context.getWhiteboardWindows() : [])
    ];
    windows.forEach(w => {
      if (w && !w.isDestroyed()) {
        w.webContents.send(channel, ...args);
      }
    });
  };

  nativeTheme.on('updated', () => {
    const currentTheme = getSetting('theme', 'system');
    if (currentTheme === 'system') {
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      broadcast('os-theme-changed', effectiveTheme);
    }
  });

  ipcMain.handle('get-os-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.on('theme-changed', (event, theme) => {
    if (!theme || !['system', 'light', 'dark'].includes(theme)) return;
    setSetting('theme', theme);
    if (theme === 'system') {
      nativeTheme.themeSource = 'system';
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      broadcast('os-theme-changed', effectiveTheme);
      broadcast('theme-changed', theme);
    } else {
      nativeTheme.themeSource = theme;
      broadcast('theme-changed', theme);
    }
  });

  ipcMain.on('accent-color-changed', (event, color) => {
    setSetting('accent-color', color);
    broadcast('accent-color-changed', color);
  });
  
  ipcMain.on('toolbar-accent-bg-changed', (event, enabled) => {
    setSetting('toolbar-accent-bg', enabled);
    broadcast('toolbar-accent-bg-changed', enabled);
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