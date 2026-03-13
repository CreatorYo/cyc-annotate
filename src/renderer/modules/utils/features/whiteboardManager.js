const { ipcRenderer } = require('electron')

function initWhiteboardMode(deps) {
  const { 
    state, 
    redrawCanvas, 
    initWindowControls,
    updateCursor,
    playSound
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
          updateSettingsUI();
          
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

    let lastPreviewCapture = 0;
    const PREVIEW_CAPTURE_INTERVAL = 30000; // 30 seconds

    const saveCurrentBoard = async (options = { capturePreview: true }) => {
        if (!state.currentBoardId) return;
        
        state.saveStatus = 'saving';
        
        let preview = null;
        const now = Date.now();
        
        if (options.capturePreview || (now - lastPreviewCapture > PREVIEW_CAPTURE_INTERVAL)) {
            preview = await capturePreview();
            lastPreviewCapture = now;
        }
        
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
            if (preview) refreshBoardsList(); 
        } catch (e) {
            ipcRenderer.invoke('show-error-dialog', 'Save Error', 'Failed to save whiteboard data.', e.message);
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

    let collapsedSections = JSON.parse(localStorage.getItem('wb-collapsed-sections') || '{"pinned": false, "all": false}');

    const renderBoardsList = () => {
      const listContainer = document.getElementById('wb-list');
      if (!listContainer) return;
      
      const filteredBoards = boardsList.filter(b => 
        b.title.toLowerCase().includes(searchQuery)
      );

      if (filteredBoards.length === 0) {
        if (searchQuery) {
          listContainer.innerHTML = `
            <div class="wb-empty-state search-empty">
              <span class="material-symbols-outlined wb-empty-icon">search</span>
              <div class="wb-empty-main">No results found</div>
              <div class="wb-empty-sub">Try searching for something else</div>
            </div>
          `;
        } else {
          listContainer.innerHTML = `
            <div class="wb-empty-state">
              <div class="wb-empty-main">No boards yet</div>
              <div class="wb-empty-sub">Create one to get started</div>
            </div>
          `;
        }
        return;
      }

      const pinnedBoards = filteredBoards.filter(b => b.pinned);
      const otherBoards = filteredBoards.filter(b => !b.pinned);

      listContainer.innerHTML = '';

      const createSection = (id, title, boards) => {
        if (boards.length === 0 && !searchQuery) return;
        if (boards.length === 0 && searchQuery) return;

        const section = document.createElement('div');
        section.className = `wb-list-section ${collapsedSections[id] ? 'collapsed' : ''}`;
        
        const header = document.createElement('div');
        header.className = 'wb-section-header';
        header.innerHTML = `
          <span class="material-symbols-outlined wb-section-chevron">expand_more</span>
          <span class="wb-section-title">${title} (${boards.length})</span>
        `;
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          collapsedSections[id] = !collapsedSections[id];
          localStorage.setItem('wb-collapsed-sections', JSON.stringify(collapsedSections));
          section.classList.toggle('collapsed');
        });

        const content = document.createElement('div');
        content.className = 'wb-section-content';

        boards.forEach(board => {
          const item = document.createElement('div');
          item.className = `wb-board-item ${board.id === state.currentBoardId ? 'active' : ''}`;
          item.setAttribute('data-id', board.id);
          
          item.innerHTML = `
            <div class="wb-board-info">
              <div class="wb-board-title">${board.title}</div>
              <div class="wb-board-date">${new Date(board.updatedAt).toLocaleDateString()}</div>
            </div>
            <button class="wb-item-more-btn" title="More Options">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          `;

          item.addEventListener('click', (e) => {
            if (e.target.closest('.wb-item-more-btn')) return;
            if (board.id !== state.currentBoardId) {
              loadBoard(board.id);
            }
            sidebar.classList.remove('open');
          });

          item.querySelector('.wb-item-more-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = e.target.getBoundingClientRect();
            ipcRenderer.send('show-whiteboard-context-menu', {
               boardId: board.id,
               title: board.title,
               x: Math.round(rect.left),
               y: Math.round(rect.bottom)
            });
          });

          item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ipcRenderer.send('show-whiteboard-context-menu', {
               boardId: board.id,
               title: board.title
            });
          });

          content.appendChild(item);
        });

        section.appendChild(header);
        section.appendChild(content);
        listContainer.appendChild(section);
      };

      createSection('pinned', 'Pinned', pinnedBoards);
      createSection('all', 'All Boards', otherBoards);
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
            saveCurrentBoard({ capturePreview: false });
        }
    }, 2000);
    
    const updateSettingsUI = () => {
        const colorBtns = document.querySelectorAll('.wb-color-btn');
        colorBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === state.whiteboardPageColor);
        });

        const modeBtns = document.querySelectorAll('.wb-mode-btn');
        modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === state.whiteboardGridMode);
        });

        const gridColorBtns = document.querySelectorAll('.wb-pattern-color-btn');
        gridColorBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === state.whiteboardGridColor);
        });
    }

    const getBrightness = (hex) => {
      hex = hex.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    }

    const updateWhiteboardTheme = (color) => {
      document.body.style.setProperty('--wb-page-color', color)
      localStorage.setItem('last-wb-page-color', color)
      const isDark = getBrightness(color) < 128;
      const header = document.querySelector('.whiteboard-header');
      if (header) header.setAttribute('data-header-theme', isDark ? 'dark' : 'light');
      redrawCanvas();
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
            if (typeof updateCursor === 'function') updateCursor();
        });
        
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && e.target !== menuBtn) {
                const wasOpen = sidebar.classList.contains('open');
                sidebar.classList.remove('open');
                if (wasOpen && typeof updateCursor === 'function') updateCursor();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // First, handle color category dropdowns
                const openCategoryMenus = document.querySelectorAll('.wb-category-dropdown-container.open');
                if (openCategoryMenus.length > 0) {
                    openCategoryMenus.forEach(c => c.classList.remove('open'));
                    e.stopPropagation();
                    return;
                }

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

                const sidebarInner = document.getElementById('wb-sidebar-inner');
                if (sidebarInner && sidebarInner.classList.contains('show-settings')) {
                    sidebarInner.classList.remove('show-settings');
                    e.stopPropagation();
                    return;
                }

                if (sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    if (typeof updateCursor === 'function') updateCursor();
                    e.stopPropagation();
                    return;
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

    ipcRenderer.on('wb-board-updated', () => {
        refreshBoardsList();
    });

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
    
    let previousTitle = "";

    let titleSizeSpan = null;
    const resizeTitleInput = () => {
        if (!titleInput) return;
        
        if (!titleSizeSpan) {
            titleSizeSpan = document.createElement('span');
            titleSizeSpan.style.visibility = 'hidden';
            titleSizeSpan.style.position = 'absolute';
            titleSizeSpan.style.whiteSpace = 'pre';
            titleSizeSpan.style.pointerEvents = 'none';
            document.body.appendChild(titleSizeSpan);
        }
        
        titleSizeSpan.style.font = getComputedStyle(titleInput).font;
        titleSizeSpan.innerText = titleInput.value || titleInput.placeholder || "Board Title";
        titleInput.style.width = Math.min(Math.max(titleSizeSpan.offsetWidth + 12, 10), 450) + 'px';
    };

    if (titleInput) {
        titleInput.addEventListener('focus', () => {
            previousTitle = titleInput.value;
            titleInput.select();
        });

        titleInput.addEventListener('input', (e) => {
            state.currentBoardTitle = e.target.value;
            state.saveStatus = 'unsaved';
            resizeTitleInput();
        });

        titleInput.addEventListener('blur', () => {
            if (!titleInput.value.trim()) {
                titleInput.value = previousTitle;
                state.currentBoardTitle = previousTitle;
                resizeTitleInput();
            } else if (state.saveStatus === 'unsaved') {
                saveCurrentBoard();
            }
        });

        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
                e.preventDefault();
                e.stopPropagation();
            } else if (e.key === 'Escape') {
                titleInput.value = previousTitle;
                state.currentBoardTitle = previousTitle;
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
            
            if (!isVisible) {
                titleDropdown.style.display = 'flex';
                
                const btnRect = titleOptionsBtn.getBoundingClientRect();
                const dropdownWidth = 160; 
                
                if (btnRect.right < dropdownWidth + 12) {
                    titleDropdown.style.left = '0';
                    titleDropdown.style.right = 'auto';
                } else {
                    titleDropdown.style.left = 'auto';
                    titleDropdown.style.right = '0';
                }
            } else {
                titleDropdown.style.display = 'none';
            }
            
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
        
        revealUI();
    });

    const initialColorBtn = document.querySelector(`.wb-color-btn[data-color="${state.whiteboardPageColor}"]`)
    if (initialColorBtn) initialColorBtn.classList.add('active')

    const initialModeBtn = document.querySelector(`.wb-mode-btn[data-mode="${state.whiteboardGridMode}"]`)
    if (initialModeBtn) initialModeBtn.classList.add('active')

    const settingsBtn = document.getElementById('wb-sidebar-settings-btn')
    const headerSettingsBtn = document.getElementById('whiteboard-settings-btn')
    const backBtn = document.getElementById('wb-settings-back-btn')
    const sidebarInner = document.getElementById('wb-sidebar-inner')
    
    if (settingsBtn && sidebarInner) {
      const openSettings = (e) => {
        e.stopPropagation()
        if (sidebar && !sidebar.classList.contains('open')) {
          sidebar.classList.add('open')
          refreshBoardsList()
        }
        sidebarInner.classList.add('show-settings')
        playSound('pop')
      }

      settingsBtn.addEventListener('click', openSettings)
      if (headerSettingsBtn) {
        headerSettingsBtn.addEventListener('click', openSettings)
      }

      if (backBtn) {
        backBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          sidebarInner.classList.remove('show-settings')
          playSound('pop')
        })
      }

      const closePopup = () => {
        if (sidebarInner) sidebarInner.classList.remove('show-settings')
        state.pickingWhiteboardColor = false
      }

      document.addEventListener('click', (e) => {
        if (sidebarInner && !sidebarInner.contains(e.target) && e.target !== settingsBtn) {
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
          updateSettingsUI()
          saveCurrentBoard({ capturePreview: false });
          CanvasManager.clearGridCache();
        })
      })

      const modeBtns = document.querySelectorAll('.wb-mode-btn')
      modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode
          state.whiteboardGridMode = (state.whiteboardGridMode === mode) ? 'none' : mode
          state.saveStatus = 'unsaved'
          updateSettingsUI()
          saveCurrentBoard({ capturePreview: false });
          redrawCanvas()
        })
      })

      const gridColorBtns = document.querySelectorAll('.wb-pattern-color-btn')
      gridColorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          state.whiteboardGridColor = btn.dataset.color
          state.saveStatus = 'unsaved';
          updateSettingsUI()
          saveCurrentBoard({ capturePreview: false });
          CanvasManager.clearGridCache();
          redrawCanvas()
        })
      })

      const triggers = document.querySelectorAll('.wb-category-trigger, .wb-category-trigger-minimal');
      triggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const container = trigger.closest('.wb-category-dropdown-container');
          const isOpen = container.classList.contains('open');
          document.querySelectorAll('.wb-category-dropdown-container').forEach(c => c.classList.remove('open'));
          if (!isOpen) container.classList.add('open');
        });
      });

      const categoryItems = document.querySelectorAll('.wb-category-item');
      categoryItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = item.dataset.value;
          const labelText = item.dataset.label || item.textContent;
          const section = item.closest('.wb-settings-section');
          const container = item.closest('.wb-category-dropdown-container');
          if (section) {
            section.setAttribute('data-active-category', value);
            const label = container.querySelector('.current-label');
            if (label) label.textContent = labelText;
            container.querySelectorAll('.wb-category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            container.classList.remove('open');
          }
        });
      });

      document.addEventListener('click', () => {
        document.querySelectorAll('.wb-category-dropdown-container').forEach(c => c.classList.remove('open'));
      });

      updateSettingsUI()
    }

    const captureFullBoard = (format = 'image/png', quality = 0.92) => {
        const canvas = document.getElementById('canvas');
        if (!canvas) return null;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        try {
            tempCtx.fillStyle = state.whiteboardPageColor || '#fffacd';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            if (typeof window.drawGridOnBuffer === 'function') {
                window.drawGridOnBuffer(tempCtx);
            }

            tempCtx.drawImage(canvas, 0, 0);

            const result = tempCanvas.toDataURL(format, quality);
            tempCanvas.width = 0;
            tempCanvas.height = 0;
            return result;
        } catch (e) {
            return null;
        }
    };

    const AppNotification = require('../../../pages/notification/notification.js');

    const showNotification = (title, message, filePath = null) => {
        const container = document.getElementById('wb-notification-container');
        if (!container) return;
        AppNotification.show(container, { title, message, filePath });
    };

    const handleExport = async (format) => {
        const dataUrl = captureFullBoard(format === 'png' ? 'image/png' : 'image/jpeg');
        if (!dataUrl) return;

        const result = await ipcRenderer.invoke('wb-export-board', {
            dataUrl,
            format,
            title: state.currentBoardTitle
        });
        
        if (result && result.success) {
            if (typeof playSound === 'function') playSound('pop');
            showNotification(
                'Export Successful', 
                `Board exported as ${format.toUpperCase()}`, 
                result.filePath
            );
        }
    };

    document.getElementById('wb-export-png-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleExport('png');
    });

    document.getElementById('wb-export-jpg-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleExport('jpg');
    });

    document.getElementById('wb-print-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.print();
    });
  }
}

module.exports = { initWhiteboardMode }