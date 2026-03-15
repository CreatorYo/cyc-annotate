const { ipcMain } = require('electron');

function initOnboardingIpc(context) {
  const { getWin, getOnboardingWin, setSetting, setShortcut, createMainWindow, registerShortcut, showOverlay, createOnboardingWindow, broadcast } = context;

  ipcMain.on('show-onboarding', () => {
    createOnboardingWindow();
  });

  ipcMain.on('onboarding-complete', (event, data) => {
    if (data.shortcut) {
      setShortcut(data.shortcut);
      setSetting('shortcut', data.shortcut);
      broadcast('shortcut-changed', data.shortcut);
    }
    if (data.accentColor) {
      setSetting('accent-color', data.accentColor);
      broadcast('accent-color-changed', data.accentColor);
    }
    setSetting('onboarding-completed', true);
    broadcast('onboarding-completed');
    
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
      showOverlay();
    }
  });
}

module.exports = initOnboardingIpc;