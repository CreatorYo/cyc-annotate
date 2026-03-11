const { ipcRenderer } = require('electron')

function initWhiteboardMode(deps) {
  const { 
    state, 
    redrawCanvas, 
    initWindowControls 
  } = deps

  const isWhiteboard = window.location.pathname.includes('whiteboard.html')

  if (isWhiteboard) {
    document.body.classList.add('whiteboard-mode')
    
    const wbContainer = document.getElementById('whiteboard-ui');
    if (wbContainer) wbContainer.style.display = 'block';

    let boardsList = [];
    let autoSaveInterval = null;

    const updateSaveStatusUI = (statusText) => {
      const statusEl = document.getElementById('wb-save-status');
      if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.style.opacity = statusText ? '1' : '0';
      }
    }

    const loadBoard = async (boardId) => {
      try {
        const boardData = await ipcRenderer.invoke('wb-load-board', boardId);
        if (boardData) {
          state.elements = boardData.elements || [];
          state.whiteboardPageColor = boardData.pageColor || '#fffacd';
          state.whiteboardGridMode = boardData.gridMode || 'none';
          state.whiteboardGridColor = boardData.gridColor || 'default';
          state.panX = boardData.panX || 0;
          state.panY = boardData.panY || 0;
          state.currentBoardId = boardId;
          
          state.history = [];
          state.historyIndex = -1;
          state.nextElementId = (Math.max(...state.elements.map(e => e.id), 0) || 0) + 1;
          state.saveStatus = 'saved';

          updateWhiteboardTheme(state.whiteboardPageColor);
          redrawCanvas();
          updateActiveBoardUI();
          
          document.querySelectorAll('.wb-pattern-color-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.color === state.whiteboardGridColor);
          });

          revealUI();
        }
      } catch (e) {
        ipcRenderer.invoke('show-error-dialog', 'Whiteboard Error', 'Failed to load board', e.message);
        revealUI();
      }
    }

    const revealUI = () => {
        const wbContainer = document.getElementById('whiteboard-ui');
        if (wbContainer && wbContainer.style.opacity === '0') {
            wbContainer.style.opacity = '1';
            wbContainer.style.pointerEvents = 'all';
        }
    }

    const createNewBoard = async () => {
      try {
        const newBoard = await ipcRenderer.invoke('wb-create-board', 'Untitled Whiteboard');
        state.currentBoardId = newBoard.id;
        await refreshBoardsList();
        await loadBoard(newBoard.id);
      } catch (e) {
        ipcRenderer.invoke('show-error-dialog', 'Whiteboard Error', 'Failed to create board', e.message);
      }
    }

    let searchQuery = '';
    const searchInput = document.getElementById('wb-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderBoardsList();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchQuery) {
          searchInput.value = '';
          searchQuery = '';
          renderBoardsList();
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }

    let selectedIndex = -1;
    document.addEventListener('keydown', (e) => {
      if (!isWhiteboard) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        if (e.repeat) return;
        ipcRenderer.send('open-new-whiteboard-window');
        e.preventDefault();
        return;
      }

      const sidebar = document.getElementById('wb-sidebar');
      if (!sidebar?.classList.contains('open')) return;

      const items = document.querySelectorAll('.wb-board-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % items.length;
        updateItemSelection(items);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateItemSelection(items);
        e.preventDefault();
      } else if (e.key === 'Enter' && selectedIndex !== -1) {
        items[selectedIndex].click();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Delete' && state.currentBoardId) {
        deleteBoard(state.currentBoardId);
        e.preventDefault();
      }
    });

    const updateItemSelection = (items) => {
      items.forEach((item, idx) => {
        item.classList.toggle('kb-selected', idx === selectedIndex);
        if (idx === selectedIndex) {
          item.scrollIntoView({ block: 'nearest' });
        }
      });
    };

    const capturePreview = () => {
        try {
            const canvas = document.getElementById('canvas');
            if (!canvas) return null;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.fillStyle = state.whiteboardPageColor || '#fffacd';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            if (typeof window.drawGridOnBuffer === 'function') {
                window.drawGridOnBuffer(tempCtx);
            }

            tempCtx.drawImage(canvas, 0, 0);

            return tempCanvas.toDataURL('image/webp', 0.5);
        } catch (e) {
            ipcRenderer.invoke('show-error-dialog', 'Whiteboard Error', 'Failed to capture board preview', e.message);
        }
        return null;
    }

    const saveCurrentBoard = async () => {
        if (!state.currentBoardId) return;
        
        state.saveStatus = 'saving';
        
        const preview = await capturePreview();
        
        try {
            await ipcRenderer.invoke('wb-save-board', {
                id: state.currentBoardId,
                title: state.currentBoardTitle,
                preview: preview,
                data: {
                    elements: state.elements,
                    pageColor: state.whiteboardPageColor,
                    gridMode: state.whiteboardGridMode,
                    gridColor: state.whiteboardGridColor,
                    panX: state.panX,
                    panY: state.panY
                }
            });
            state.saveStatus = 'saved';
            refreshBoardsList(); 
        } catch (e) {
            ipcRenderer.invoke('show-error-dialog', 'Whiteboard Error', 'Failed to save board', e.message);
            state.saveStatus = 'unsaved'; 
            updateSaveStatusUI('Error Saving');
        }
    }
    
    state.saveCurrentBoard = saveCurrentBoard;
    state.triggerInstantSave = saveCurrentBoard;

    document.addEventListener('mousedown', (e) => {
        const titleInput = document.getElementById('wb-title-input');
        const titleSection = document.querySelector('.wb-title-section');
        if (titleInput && document.activeElement === titleInput) {
            if (!titleSection.contains(e.target)) {
                titleInput.blur();
            }
        }
    });

    const refreshBoardsList = async () => {
      boardsList = await ipcRenderer.invoke('wb-get-boards');
      renderBoardsList();
    }

    const renderBoardsList = () => {
      const listContainer = document.getElementById('wb-list');
      if (!listContainer) return;
      
      const filteredBoards = boardsList.filter(b => 
        b.title.toLowerCase().includes(searchQuery)
      );

      if (filteredBoards.length === 0) {
        listContainer.innerHTML = `
          <div class="wb-empty-state">
            <div class="wb-empty-main">No boards yet</div>
            <div class="wb-empty-sub">Create one to get started</div>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';
      filteredBoards.forEach(board => {
        const item = document.createElement('div');
        item.className = `wb-board-item ${board.id === state.currentBoardId ? 'active' : ''}`;
        item.setAttribute('data-id', board.id);
        
        const canDelete = filteredBoards.length > 1;
        
        item.innerHTML = `
          <div class="wb-board-info">
            <div class="wb-board-title">${board.title}</div>
            <div class="wb-board-date">${new Date(board.updatedAt).toLocaleDateString()}</div>
          </div>
          ${canDelete ? `
          <button class="wb-item-delete-btn" title="Delete Board">
            <span class="material-symbols-outlined">close</span>
          </button>
          ` : ''}
        `;

        item.addEventListener('click', (e) => {
          if (e.target.closest('.wb-item-delete-btn')) return;
          if (board.id !== state.currentBoardId) {
            loadBoard(board.id);
          }
          sidebar.classList.remove('open');
        });

        if (canDelete) {
          item.querySelector('.wb-item-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBoard(board.id);
          });
        }

        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          ipcRenderer.send('show-whiteboard-context-menu', {
             boardId: board.id,
             title: board.title
          });
        });

        listContainer.appendChild(item);
      });
    }

    const deleteAllBtn = document.getElementById('wb-delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteAllBoards();
        });
    }

    const deleteBoard = async (id) => {
        const confirmed = await ipcRenderer.invoke('show-confirmation-dialog', {
            title: 'Delete Whiteboard',
            message: 'Are you sure you want to delete this whiteboard?',
            buttons: ['Cancel', 'Delete']
        });

        if (confirmed) {
            await ipcRenderer.invoke('wb-delete-board', id);
            if (state.currentBoardId === id) {
                refreshBoardsList().then(() => {
                    if (boardsList.length > 0) loadBoard(boardsList[0].id);
                    else createNewBoard();
                });
            } else {
                refreshBoardsList();
            }
        }
    }

    const deleteAllBoards = async () => {
        const confirmed = await ipcRenderer.invoke('show-confirmation-dialog', {
            title: 'Delete All Whiteboards',
            message: 'Are you sure you want to delete ALL whiteboards? This cannot be undone.',
            buttons: ['Cancel', 'Delete All']
        });

        if (confirmed) {
             try {
                 for (const board of boardsList) {
                     await ipcRenderer.invoke('wb-delete-board', board.id);
                 }
                 createNewBoard();
             } catch (e) {
                 ipcRenderer.invoke('show-error-dialog', 'Whiteboard Error', 'Failed to delete all boards', e.message);
             }
        }
    }

    const settingsBtnSidebar = document.getElementById('wb-sidebar-settings-btn');
    if (settingsBtnSidebar) {
        settingsBtnSidebar.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('whiteboard-settings-btn')?.click();
        });
    }
    
    const updateActiveBoardUI = () => {
        const titleInput = document.getElementById('wb-title-input');
        if (titleInput) {
            const currentBoard = boardsList.find(b => b.id === state.currentBoardId);
            if (currentBoard) {
                titleInput.value = currentBoard.title;
                state.currentBoardTitle = currentBoard.title;
            } else {
                titleInput.value = state.currentBoardTitle || "Untitled Whiteboard";
            }
            resizeTitleInput();
        }
        
        const items = document.querySelectorAll('.wb-board-item');
        items.forEach(item => {
            const boardId = item.getAttribute('data-id');
            item.classList.toggle('active', boardId === state.currentBoardId);
        });
    }
    
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        if (state.saveStatus === 'unsaved' && state.currentBoardId) {
            saveCurrentBoard(false);
        }
    }, 1000);
    
    const updateWhiteboardTheme = (color) => {
      document.body.style.setProperty('--wb-page-color', color)
      localStorage.setItem('last-wb-page-color', color)
      
      const isDark = color === '#1a1a1a'
      const iconColor = isDark ? '#ffffff' : '#1e1e1e'
      document.documentElement.style.setProperty('--wb-icon-color', iconColor)
      
      redrawCanvas()
    }
    
    updateWhiteboardTheme(state.whiteboardPageColor)
    
    setTimeout(() => {
      document.body.style.transition = 'background 0.3s ease'
    }, 100)
    if (typeof window.updateReduceClutter === 'function') {
      window.updateReduceClutter()
    }

    initWindowControls({ showMinimize: true, showMaximize: true, showClose: true })
    
    const wbWindowCloseBtn = document.getElementById('window-close');
    if (wbWindowCloseBtn) {
        const newCloseBtn = wbWindowCloseBtn.cloneNode(true);
        wbWindowCloseBtn.parentNode.replaceChild(newCloseBtn, wbWindowCloseBtn);
        newCloseBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (state.saveCurrentBoard) {
                await state.saveCurrentBoard();
            }
            
            setTimeout(() => {
                ipcRenderer.send('window-close');
            }, 100);
        });
    }

    const menuBtn = document.getElementById('wb-menu-btn');
    const sidebar = document.getElementById('wb-sidebar');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
            refreshBoardsList();
        });
        
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && e.target !== menuBtn) {
                sidebar.classList.remove('open');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const titleDropdown = document.getElementById('wb-title-dropdown');
                if (titleDropdown && titleDropdown.style.display === 'flex') {
                     titleDropdown.style.display = 'none';
                     const titleOptionsBtn = document.getElementById('wb-title-options-btn');
                     if (titleOptionsBtn) titleOptionsBtn.classList.remove('active');
                     e.stopPropagation();
                     return;
                }

                const filterDropdown = document.getElementById('wb-filter-dropdown');
                if (filterDropdown && filterDropdown.classList.contains('show')) {
                    filterDropdown.classList.remove('show');
                    e.stopPropagation();
                    return;
                }

                if (sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    e.stopPropagation();
                    return;
                }
                const settingsPopup = document.getElementById('whiteboard-settings-popup');
                if (settingsPopup && settingsPopup.style.display === 'flex') {
                    settingsPopup.style.display = 'none';
                    document.getElementById('whiteboard-settings-btn')?.classList.remove('active');
                    e.stopPropagation();
                }
            }
        }, true);
    }

    const duplicateBoard = async (id) => {
      try {
        const newBoard = await ipcRenderer.invoke('wb-duplicate-board', id);
        if (newBoard) {
          await refreshBoardsList();
          loadBoard(newBoard.id);
        }
      } catch (e) {
        ipcRenderer.invoke('show-error-dialog', 'Whiteboard Error', 'Failed to duplicate board', e.message);
      }
    }

    ipcRenderer.on('wb-menu-rename', (event, boardId) => {
      if (state.currentBoardId !== boardId) {
        loadBoard(boardId).then(() => {
          document.getElementById('wb-title-input')?.focus();
          document.getElementById('wb-title-input')?.select();
        });
      } else {
        document.getElementById('wb-title-input')?.focus();
        document.getElementById('wb-title-input')?.select();
      }
    });

    ipcRenderer.on('wb-menu-duplicate', (event, boardId) => {
      duplicateBoard(boardId);
    });

    ipcRenderer.on('wb-menu-delete', (event, boardId) => {
      deleteBoard(boardId);
    });

    const newBoardBtn = document.getElementById('wb-new-board-btn');
    if (newBoardBtn) {
        newBoardBtn.addEventListener('click', createNewBoard);
    }

    const titleInput = document.getElementById('wb-title-input');
    
    const resizeTitleInput = () => {
        if (!titleInput) return;
        
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre';
        tempSpan.style.font = getComputedStyle(titleInput).font;
        tempSpan.innerText = titleInput.value || titleInput.placeholder;
        document.body.appendChild(tempSpan);
        titleInput.style.width = Math.min(Math.max(tempSpan.offsetWidth + 16, 40), 450) + 'px';
        document.body.removeChild(tempSpan);
    };

    if (titleInput) {
        titleInput.addEventListener('input', (e) => {
            state.currentBoardTitle = e.target.value;
            state.saveStatus = 'unsaved';
            resizeTitleInput();
        });
        titleInput.addEventListener('blur', () => {
            if (state.saveStatus === 'unsaved') saveCurrentBoard();
        });
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                titleInput.blur();
                e.preventDefault();
                e.stopPropagation();
            }
        });

        setTimeout(resizeTitleInput, 50);
    }

    const titleOptionsBtn = document.getElementById('wb-title-options-btn');
    const titleDropdown = document.getElementById('wb-title-dropdown');
    
    if (titleOptionsBtn && titleDropdown) {
        titleOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = titleDropdown.style.display === 'flex';
            titleDropdown.style.display = isVisible ? 'none' : 'flex';
            titleOptionsBtn.classList.toggle('active', !isVisible);
        });

        document.addEventListener('click', (e) => {
            if (!titleDropdown.contains(e.target) && e.target !== titleOptionsBtn) {
                titleDropdown.style.display = 'none';
                titleOptionsBtn.classList.remove('active');
            }
        });

        const renameBtn = document.getElementById('wb-rename-board-btn');
        if (renameBtn) {
            renameBtn.addEventListener('click', () => {
                titleInput?.focus();
                titleInput?.select();
                titleDropdown.style.display = 'none';
                titleOptionsBtn.classList.remove('active');
            });
        }

        const deleteCurrentBtn = document.getElementById('wb-delete-current-board-btn');
        if (deleteCurrentBtn) {
            deleteCurrentBtn.addEventListener('click', () => {
                titleDropdown.style.display = 'none';
                titleOptionsBtn.classList.remove('active');
                if (state.currentBoardId) {
                    deleteBoard(state.currentBoardId);
                }
            });
        }
    }

    refreshBoardsList().then(() => {
        const lastBoardId = localStorage.getItem('last-opened-board-id');
        if (lastBoardId && boardsList.find(b => b.id === lastBoardId)) {
            loadBoard(lastBoardId);
        } else if (boardsList.length > 0) {
            loadBoard(boardsList[0].id);
        } else {
            createNewBoard();
        }
        
        setTimeout(revealUI, 1000);
    });

    const initialColorBtn = document.querySelector(`.wb-color-btn[data-color="${state.whiteboardPageColor}"]`)
    if (initialColorBtn) initialColorBtn.classList.add('active')

    const initialModeBtn = document.querySelector(`.wb-mode-btn[data-mode="${state.whiteboardGridMode}"]`)
    if (initialModeBtn) initialModeBtn.classList.add('active')

    const settingsBtn = document.getElementById('whiteboard-settings-btn')
    const settingsPopup = document.getElementById('whiteboard-settings-popup')
    
    if (settingsBtn && settingsPopup) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const isVisible = settingsPopup.style.display === 'flex'
        settingsPopup.style.display = isVisible ? 'none' : 'flex'
        settingsBtn.classList.toggle('active', !isVisible)
      })

      const closePopup = () => {
        settingsPopup.style.display = 'none'
        settingsBtn.classList.remove('active')
        state.pickingWhiteboardColor = false
      }

      document.addEventListener('click', (e) => {
        if (!settingsPopup.contains(e.target) && e.target !== settingsBtn) {
          closePopup()
        }
      })

      const colorBtns = document.querySelectorAll('.wb-color-btn')
      colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const color = btn.dataset.color
          state.whiteboardPageColor = color
          updateWhiteboardTheme(color)
          state.saveStatus = 'unsaved';
          saveCurrentBoard();
          
          colorBtns.forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
        })
      })

      const modeBtns = document.querySelectorAll('.wb-mode-btn')
      modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode
          
          if (state.whiteboardGridMode === mode) {
            state.whiteboardGridMode = 'none'
            btn.classList.remove('active')
          } else {
            state.whiteboardGridMode = mode
            modeBtns.forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
          }
          
          state.saveStatus = 'unsaved'
          saveCurrentBoard();
          redrawCanvas()
        })
      })

      const gridColorBtns = document.querySelectorAll('.wb-pattern-color-btn')
      gridColorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const color = btn.dataset.color
          state.whiteboardGridColor = color
          state.saveStatus = 'unsaved';
          
          gridColorBtns.forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          saveCurrentBoard();
          redrawCanvas()
        })
      })
    }
  }
}

module.exports = { initWhiteboardMode }