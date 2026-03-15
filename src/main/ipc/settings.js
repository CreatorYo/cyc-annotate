const { ipcMain } = require('electron');

function initSettingsIpc(context) {
  const { broadcast, getWin, getVisible, setVisible, getSettingsWin, setSetting, createSettingsWindow } = context;

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
    broadcast('update-settings-badge', show);
  });

  ipcMain.on('get-all-settings', (event) => {
    event.returnValue = context.getAllSettings();
  });

  ipcMain.on('get-system-settings', (event) => {
    event.returnValue = context.getAllSettings();
  });

  ipcMain.on('sync-setting', (event, { key, value, channel }) => {
    if (key) setSetting(key, value);
    if (channel) {
      broadcast(channel, value);
      
      const sideEffectChannels = ['toggle-tray-icon', 'set-auto-launch'];
      if (sideEffectChannels.includes(channel)) {
        ipcMain.emit(channel, event, value);
      }
    }
  });

  const autoSyncSettings = [
    'sticky-note-in-toolbar-changed',
    'auto-save-snapshots-changed',
    'reduce-clutter-changed',
    'toolbar-dragging-changed',
    'standby-in-toolbar-changed',
    'element-eraser-changed',
    'hardware-acceleration-changed',
    'startup-window-changed',
    'screenshot-notification-changed',
    'copy-snapshot-clipboard-changed'
  ];

  autoSyncSettings.forEach(channel => {
    ipcMain.on(channel, (event, value) => {
      const key = channel.replace('-changed', '');
      setSetting(key, value);
      broadcast(channel, value);
    });
  });

  ipcMain.on('save-directory-changed', (event, directoryPath) => {
    const value = (!directoryPath || directoryPath.trim() === '') ? null : directoryPath;
    setSetting('save-directory-path', value);
    broadcast('save-directory-changed', value);
  });

  ipcMain.on('optimized-rendering-changed', (event, enabled) => {
    setSetting('optimized-rendering', enabled);
  });

  ipcMain.on('set-standby-mode', (event, enabled) => {
    const { setStandbyMode, restoreMouseEvents } = context;
    setStandbyMode(enabled);
    restoreMouseEvents();
  });

  ipcMain.on('toolbar-bg-changed', (event, data) => {
    setSetting('toolbar-accent-bg', data.enabled);
    broadcast('toolbar-bg-changed', data);
  });

  ipcMain.on('sounds-changed', (event, enabled) => {
    broadcast('sounds-changed', enabled);
  });
}

module.exports = initSettingsIpc;