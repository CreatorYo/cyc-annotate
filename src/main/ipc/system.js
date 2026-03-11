const { ipcMain, app } = require('electron');

function initSystemIpc(context) {
  const { getOsVersion, setSetting, startupFeature } = context;

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-system-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    osVersion: getOsVersion()
  }));

  ipcMain.on('set-auto-launch', (event, enabled) => {
    startupFeature.setEnabled(enabled);
    setSetting('launch-on-startup', enabled);
  });

  ipcMain.on('reset-everything', () => {
    const { getWin } = context;
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('reset-everything');
    }
  });
}

module.exports = initSystemIpc;