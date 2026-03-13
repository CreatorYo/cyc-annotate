const { ipcMain } = require('electron');

function initOnboardingIpc(context) {
  const { getWin, getSettingsWin, getOnboardingWin, setSetting, setShortcut, createMainWindow, registerShortcut, showOverlay, createOnboardingWindow } = context;

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
    const settingsWin = getSettingsWin();

    [win, settingsWin].forEach(targetWin => {
      if (targetWin && !targetWin.isDestroyed()) {
        if (data.shortcut) {
          targetWin.webContents.send('shortcut-changed', data.shortcut);
        }
        if (data.accentColor) {
          targetWin.webContents.executeJavaScript(`localStorage.setItem('accent-color', '${data.accentColor}')`);
          targetWin.webContents.send('accent-color-changed', data.accentColor);
        }
        targetWin.webContents.send('onboarding-completed');
      }
    });

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