const { ipcMain } = require('electron');

function initSettingsIpc(context) {
  const { getWin, getVisible, setVisible, getSettingsWin, getSetting, setSetting, createSettingsWindow } = context;

  ipcMain.on('open-settings', () => {
    const win = getWin();
    const visible = getVisible();
    if (win && !win.isDestroyed() && visible) {
      setVisible(false);
      win.setOpacity(0);
      win.setIgnoreMouseEvents(true, { forward: true });
      win.hide();
      if (win && !win.isDestroyed()) {
        win.webContents.send('draw-mode', false);
      }
    }
    
    let settingsWin = getSettingsWin();
    if (settingsWin && !settingsWin.isDestroyed()) {
      if (settingsWin.isMinimized()) settingsWin.restore();
      settingsWin.focus();
      return;
    }

    createSettingsWindow();
  });

  ipcMain.on('update-settings-badge', (event, show) => {
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-settings-badge', show);
    }
  });

  ipcMain.on('get-system-settings', (event) => {
    event.returnValue = {
      standbyInToolbar: getSetting('standby-in-toolbar', false),
      showTrayIcon: getSetting('show-tray-icon', true),
      launchOnStartup: getSetting('launch-on-startup', false)
    };
  });

  ipcMain.on('auto-save-snapshots-changed', (event, enabled) => {
    setSetting('auto-save-snapshots', enabled);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('auto-save-snapshots-changed', enabled);
    }
  });

  ipcMain.on('save-directory-changed', (event, directoryPath) => {
    if (!directoryPath || directoryPath.trim() === '') {
      setSetting('save-directory-path', null);
    } else {
      setSetting('save-directory-path', directoryPath);
    }
  });

  ipcMain.on('screenshot-notification-changed', (event, enabled) => {
    setSetting('screenshot-notification', enabled);
  });

  ipcMain.on('copy-snapshot-clipboard-changed', (event, enabled) => {
    setSetting('copy-snapshot-clipboard', enabled);
  });

  ipcMain.on('optimized-rendering-changed', (event, enabled) => {
    setSetting('optimized-rendering', enabled);
  });

  ipcMain.on('hardware-acceleration-changed', (event, enabled) => {
    setSetting('hardware-acceleration', enabled);
  });

  ipcMain.on('reduce-clutter-changed', (event, enabled) => {
    setSetting('reduce-clutter', enabled);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('reduce-clutter-changed', enabled);
    }
  });

  ipcMain.on('disable-toolbar-moving-changed', (event, enabled) => {
    setSetting('disable-toolbar-moving', enabled);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('disable-toolbar-moving-changed', enabled);
    }
  });

  ipcMain.on('standby-in-toolbar-changed', (event, enabled) => {
    setSetting('standby-in-toolbar', enabled);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('standby-in-toolbar-changed', enabled);
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('standby-in-toolbar-changed', enabled);
        }
      }, 100);
    }
  });

  ipcMain.on('set-standby-mode', (event, enabled) => {
    const { setStandbyMode, restoreMouseEvents } = context;
    setStandbyMode(enabled);
    restoreMouseEvents();
  });

  ipcMain.on('toolbar-bg-changed', (event, data) => {
    setSetting('toolbar-accent-bg', data.enabled);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('toolbar-bg-changed', data);
    }
  });

  ipcMain.on('sounds-changed', (event, enabled) => {
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('sounds-changed', enabled);
    }
  });
}

module.exports = initSettingsIpc;