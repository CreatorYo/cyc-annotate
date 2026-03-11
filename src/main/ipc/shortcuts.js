const { ipcMain } = require('electron');

function initShortcutsIpc(context) {
  const { setShortcut, setSetting, registerShortcut } = context;

  ipcMain.on('update-shortcut', (event, newShortcut) => {
    setShortcut(newShortcut);
    setSetting('shortcut', newShortcut);
    registerShortcut();
  });

  ipcMain.on('reset-shortcut-held', () => {
    context.resetShortcutHeld();
  });
}

module.exports = initShortcutsIpc;