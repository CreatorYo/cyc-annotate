const { ipcMain } = require('electron');

function initWindowsIpc(context) {
  const { broadcast, getWin, setVisible, getWindowUtils } = context;

  ipcMain.on('window-minimize', (event) => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.minimize();
    }
  });

  ipcMain.on('window-maximize', (event) => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
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
    broadcast('layout-changed', layout);
  });

  ipcMain.on('vertical-position-changed', (event, position) => {
    const { setSetting } = context;
    setSetting('toolbar-position-vertical', position);
    broadcast('vertical-position-changed', position);
  });

  ipcMain.on('horizontal-position-changed', (event, position) => {
    const { setSetting } = context;
    setSetting('toolbar-position-horizontal', position);
    broadcast('horizontal-position-changed', position);
  });

  const handleOpenWhiteboard = () => {
    const { createWhiteboardWindow, hideOverlay } = context;
    if (createWhiteboardWindow) {
      if (hideOverlay) {
        hideOverlay();
      }
      createWhiteboardWindow();
    }
  };

  ipcMain.on('open-whiteboard', handleOpenWhiteboard);
  ipcMain.on('open-new-whiteboard-window', handleOpenWhiteboard);

  ipcMain.on('whiteboard-closed', () => {
    broadcast('whiteboard-active', false);
  });
}

module.exports = initWindowsIpc;