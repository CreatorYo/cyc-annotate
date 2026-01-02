const { ipcMain } = require('electron');

function initWindowsIpc(context) {
  const { getWin, getSettingsWin, getOnboardingWin, setVisible, getWindowUtils } = context;

  ipcMain.on('window-minimize', (event) => {
    const senderId = event.sender.id;
    const settingsWin = getSettingsWin();
    const onboardingWin = getOnboardingWin();
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderId) {
      settingsWin.minimize();
    } else if (onboardingWin && !onboardingWin.isDestroyed() && onboardingWin.webContents.id === senderId) {
      onboardingWin.minimize();
    }
  });

  ipcMain.on('window-maximize', (event) => {
    const senderId = event.sender.id;
    const settingsWin = getSettingsWin();
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderId) {
      if (settingsWin.isMaximized()) {
        settingsWin.unmaximize();
      } else {
        settingsWin.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const senderId = event.sender.id;
    const settingsWin = getSettingsWin();
    const onboardingWin = getOnboardingWin();
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderId) {
      settingsWin.close();
    } else if (onboardingWin && !onboardingWin.isDestroyed() && onboardingWin.webContents.id === senderId) {
      onboardingWin.close();
    }
  });

  ipcMain.on('close-window', () => {
    const win = getWin();
    if (win) {
      win.close();
    }
  });

  ipcMain.on('hide-window', () => {
    const win = getWin();
    if (win) {
      setVisible(false);
      
      let opacity = 1;
      const fadeInterval = setInterval(() => {
        opacity -= 0.25;
        if (opacity <= 0) {
          win.setOpacity(0);
          win.setIgnoreMouseEvents(true, { forward: true });
          win.hide();
          clearInterval(fadeInterval);
        } else {
          win.setOpacity(opacity);
        }
      }, 8); 
      if (win && !win.isDestroyed()) {
        win.webContents.send('draw-mode', false);
      }
    }
  });

  ipcMain.on('focus-window', () => {
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.focus();
    }
  });

  ipcMain.on('update-toolbar-bounds', (event, bounds) => {
    const windowUtils = getWindowUtils();
    if (windowUtils) windowUtils.setToolbarBounds(bounds);
  });

  ipcMain.on('layout-changed', (event, layout) => {
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('layout-changed', layout);
    }
  });

  ipcMain.on('vertical-position-changed', (event, position) => {
    const { setSetting } = context;
    setSetting('toolbar-position-vertical', position);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('vertical-position-changed', position);
    }
  });

  ipcMain.on('horizontal-position-changed', (event, position) => {
    const { setSetting } = context;
    setSetting('toolbar-position-horizontal', position);
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.webContents.send('horizontal-position-changed', position);
    }
  });
}

module.exports = initWindowsIpc;