const { ipcMain } = require('electron');

function initOnboardingIpc(context) {
  const { getWin, getOnboardingWin, setSetting, setShortcut, createMainWindow, registerShortcut, showOverlay, createOnboardingWindow } = context;

  ipcMain.on('show-onboarding', () => {
    createOnboardingWindow();
  });

  ipcMain.on('onboarding-complete', (event, data) => {
    if (data.shortcut) {
      setShortcut(data.shortcut);
      setSetting('shortcut', data.shortcut);
    }
    if (data.accentColor) {
      setSetting('accent-color', data.accentColor);
    }
    setSetting('onboarding-completed', true);
    
    const onboardingWin = getOnboardingWin();
    if (onboardingWin && !onboardingWin.isDestroyed()) {
      onboardingWin.close();
    }
    
    const win = getWin();
    if (!win || win.isDestroyed()) {
      createMainWindow();
      const newWin = getWin();
      if (newWin && !newWin.isDestroyed()) {
        newWin.webContents.once('did-finish-load', () => {
          setTimeout(() => {
            showOverlay();
          }, 100);
        });
      }
    } else {
      if (data.shortcut) {
        registerShortcut();
      }
      if (data.accentColor && win && !win.isDestroyed()) {
        win.webContents.executeJavaScript(`localStorage.setItem('accent-color', '${data.accentColor}')`);
        win.webContents.send('accent-color-changed', data.accentColor);
      }
      showOverlay();
    }
  });
}

module.exports = initOnboardingIpc;