const { ipcMain } = require('electron');

function initNotificationsIpc(context) {
  const { getNotificationHandler } = context;

  ipcMain.on('close-notification', () => {
    getNotificationHandler()?.close();
  });
}

module.exports = initNotificationsIpc;