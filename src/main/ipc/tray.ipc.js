const { ipcMain } = require('electron');

function initTrayIpc(context) {
  const { getSystemTray, createTray, destroyTray, setSetting } = context;

  ipcMain.on('toggle-tray-icon', (event, show) => {
    const systemTray = getSystemTray();
    if (show) {
      if (!systemTray?.get()) {
        createTray();
      }
    } else {
      destroyTray();
    }
    setSetting('show-tray-icon', show);
  });
}

module.exports = initTrayIpc;