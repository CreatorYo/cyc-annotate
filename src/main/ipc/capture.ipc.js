const { ipcMain, desktopCapturer } = require('electron');
const fs = require('fs');

function initCaptureIpc(context) {
  const { getWin, getCaptureOverlay, initCaptureOverlayModule, dialogs } = context;

  ipcMain.handle('check-directory-exists', async (event, directoryPath) => {
    if (!directoryPath) return false;
    try {
      if (fs.existsSync(directoryPath)) {
        const stats = fs.statSync(directoryPath);
        return stats.isDirectory();
      }
      return false;
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('capture-desktop', async () => {
    const win = getWin();
    try {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      });
      
      if (sources.length > 0) {
        const primarySource = sources.find(source => source.id.includes('screen:0')) || sources[0];
        return primarySource.thumbnail.toDataURL();
      }
      return null;
    } catch (error) {
      dialogs.showErrorDialog(win, 'Capture Error', 'Failed to capture desktop', error.message);
      return null;
    }
  });

  ipcMain.handle('open-capture-overlay', () => {
    let captureOverlay = getCaptureOverlay();
    if (!captureOverlay) {
      initCaptureOverlayModule();
      captureOverlay = getCaptureOverlay();
    }
    captureOverlay.open();
  });

  ipcMain.on('capture-selection', async (event, bounds) => {
    let captureOverlay = getCaptureOverlay();
    if (!captureOverlay) {
      initCaptureOverlayModule();
      captureOverlay = getCaptureOverlay();
    }
    await captureOverlay.captureSelection(bounds);
  });

  ipcMain.on('cancel-capture', () => {
    getCaptureOverlay()?.close();
  });
}

module.exports = initCaptureIpc;