const { ipcMain, app, BrowserWindow, Menu, MenuItem, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function initWhiteboardIpc(context) {
  const { getWin, dialogs } = context;
  const userDataPath = app.getPath('userData');
  const whiteboardsDir = path.join(userDataPath, 'whiteboards');
  const metadataPath = path.join(whiteboardsDir, 'metadata.json');

  if (!fs.existsSync(whiteboardsDir)) {
    fs.mkdirSync(whiteboardsDir, { recursive: true });
  }

  function getMetadata() {
    if (!fs.existsSync(metadataPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      dialogs.showErrorDialog(getWin(), 'Whiteboard Metadata Error', 'Failed to parse whiteboard metadata library.', e.message);
      return [];
    }
  }

  function saveMetadata(metadata) {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  ipcMain.handle('wb-get-boards', async () => {
    return getMetadata().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  });

  ipcMain.handle('wb-create-board', async (event, title) => {
    const id = Date.now().toString();
    const metadata = getMetadata();
    const newBoard = {
      id,
      title: title || 'Untitled Whiteboard',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    metadata.push(newBoard);
    saveMetadata(metadata);
    
    const boardPath = path.join(whiteboardsDir, `board_${id}.json`);
    const initialData = { elements: [], pageColor: '#fffacd', gridMode: 'none' };
    fs.writeFileSync(boardPath, JSON.stringify(initialData));

    return newBoard;
  });

  ipcMain.handle('wb-save-board', async (event, { id, title, preview, data }) => {
    const metadata = getMetadata();
    const boardIndex = metadata.findIndex(b => b.id === id);
    
    if (boardIndex === -1) {
      metadata.push({
        id,
        title: title || 'Untitled Whiteboard',
        preview: preview || null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      metadata[boardIndex].updatedAt = Date.now();
      if (title) metadata[boardIndex].title = title;
      if (preview) metadata[boardIndex].preview = preview;
    }
    saveMetadata(metadata);

    if (data) {
      const boardPath = path.join(whiteboardsDir, `board_${id}.json`);
      fs.writeFileSync(boardPath, JSON.stringify(data));
    }
    
    return true;
  });

  ipcMain.handle('wb-load-board', async (event, id) => {
    const boardPath = path.join(whiteboardsDir, `board_${id}.json`);
    if (fs.existsSync(boardPath)) {
      try {
        return JSON.parse(fs.readFileSync(boardPath, 'utf8'));
      } catch (e) {
        dialogs.showErrorDialog(getWin(), 'Board Load Error', `Failed to load data for board ${id}.`, e.message);
        return null;
      }
    }
    return null;
  });

  ipcMain.handle('wb-delete-board', async (event, id) => {
    let metadata = getMetadata();
    metadata = metadata.filter(b => b.id !== id);
    saveMetadata(metadata);

    const boardPath = path.join(whiteboardsDir, `board_${id}.json`);
    if (fs.existsSync(boardPath)) {
      fs.unlinkSync(boardPath);
    }
    return true;
  });

  ipcMain.on('show-whiteboard-context-menu', (event, { boardId, title, x, y }) => {
    const metadata = getMetadata();
    const board = metadata.find(b => b.id === boardId);
    if (!board) return;

    const isPinned = !!board.pinned;
    const menu = new Menu();

    menu.append(new MenuItem({
      label: 'Rename',
      click: () => event.sender.send('wb-menu-rename', boardId)
    }));

    menu.append(new MenuItem({
      label: isPinned ? 'Unpin' : 'Pin',
      click: () => {
        board.pinned = !isPinned;
        saveMetadata(metadata);
        event.sender.send('wb-board-updated', boardId);
      }
    }));

    menu.append(new MenuItem({
      label: 'Duplicate',
      click: () => event.sender.send('wb-menu-duplicate', boardId)
    }));

    menu.append(new MenuItem({ type: 'separator' }));

    menu.append(new MenuItem({
      label: 'Delete',
      click: () => event.sender.send('wb-menu-delete', boardId)
    }));

    const popupOptions = { window: BrowserWindow.fromWebContents(event.sender) };
    if (typeof x === 'number' && typeof y === 'number') {
      popupOptions.x = Math.round(x);
      popupOptions.y = Math.round(y);
    }
    menu.popup(popupOptions);
  });

  ipcMain.handle('wb-duplicate-board', async (event, id) => {
    const metadata = getMetadata();
    const sourceBoard = metadata.find(b => b.id === id);
    if (!sourceBoard) return null;

    const newId = Date.now().toString();
    const newBoard = {
      ...sourceBoard,
      id: newId,
      title: `${sourceBoard.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    metadata.push(newBoard);
    saveMetadata(metadata);

    const sourcePath = path.join(whiteboardsDir, `board_${id}.json`);
    const targetPath = path.join(whiteboardsDir, `board_${newId}.json`);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }

    return newBoard;
  });

  ipcMain.handle('wb-export-board', async (event, { dataUrl, format, title }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    
    const extensions = format === 'jpg' || format === 'jpeg' ? ['jpg', 'jpeg'] : ['png'];
    const defaultPath = `${title || 'whiteboard'}.${extensions[0]}`;
    
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: `Export Whiteboard as ${format.toUpperCase()}`,
      defaultPath: defaultPath,
      filters: [{ name: 'Images', extensions: extensions }]
    });

    if (canceled || !filePath) return null;
    
    try {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      return { success: true, filePath };
    } catch (e) {
      return { success: false };
    }
  });
}

module.exports = initWhiteboardIpc;
