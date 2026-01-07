function initCommandMenu(helpers) {
  const {
    setTool,
    setShape,
    undo,
    redo,
    clearCanvas,
    standbyManager,
    triggerCapture,
    playSound,
  } = helpers;

  let selectedItemIndex = 0;
  let filteredItems = [];
  let lastMouseX = 0;
  let lastMouseY = 0;
  let cleanupTimeout = null;

  let isDragging = false,
    dragStart = { x: 0, y: 0 },
    menuStart = { x: 0, y: 0 };
  const overlay = document.getElementById("command-menu-overlay");
  const commandMenuContainer = document.querySelector(
    ".command-menu-container"
  );

  if (commandMenuContainer) {
    const getGuide = (cls) =>
      document.querySelector("." + cls) ||
      document.body.appendChild(
        Object.assign(document.createElement("div"), {
          className: `snap-guide ${cls}`,
        })
      );

    commandMenuContainer.onmousedown = (e) => {
      const isInput = e.target.tagName === "INPUT";
      if (!isInput) {
        const input = document.getElementById("command-menu-input");
        if (input) input.focus();
      }

      if (e.target.closest(".command-menu-item, button, input")) return;
      isDragging = true;
      commandMenuContainer.classList.add("dragging");

      const rect = overlay.getBoundingClientRect();
      const isAbs = overlay.style.left && overlay.style.left.indexOf("px") > -1;
      const currentLeft = isAbs ? parseFloat(overlay.style.left) : rect.left;
      const currentTop = isAbs ? parseFloat(overlay.style.top) : rect.top;

      if (!isAbs) {
        Object.assign(overlay.style, {
          transform: "none",
          left: currentLeft + "px",
          top: currentTop + "px",
        });
      }

      dragStart = { x: e.clientX, y: e.clientY };
      menuStart = { x: currentLeft, y: currentTop };

      const onMove = (e) => {
        if (!isDragging) return;
        let x = menuStart.x + (e.clientX - dragStart.x),
          y = menuStart.y + (e.clientY - dragStart.y);
        const [winW, winH] = [window.innerWidth, window.innerHeight];
        const screenW = window.screen.width;
        const width = overlay.offsetWidth,
          height = overlay.offsetHeight;

        x = Math.max(0, Math.min(x, winW - width));
        y = Math.max(0, Math.min(y, winH - height));

        let xTargets = [winW / 2];
        if (winW > screenW + 100) {
          xTargets = [screenW / 2, screenW + (winW - screenW) / 2];
        }

        const snap = (val, targets, guideCls, isVertical) => {
          const guide = getGuide(guideCls);
          const size = isVertical ? width : height;
          const currentCenter = val + size / 2;

          for (const target of targets) {
            const compareVal = isVertical ? currentCenter : val;
            if (Math.abs(compareVal - target) < 20) {
              guide.classList.add("visible");
              guide.style[isVertical ? "left" : "top"] = target + "px";
              return isVertical ? target - size / 2 : target;
            }
          }
          guide.classList.remove("visible");
          return val;
        };

        overlay.style.left = snap(x, xTargets, "snap-guide-v", true) + "px";
        overlay.style.top =
          snap(
            y,
            [Math.abs(y - 100) < 20 ? 100 : winH / 2],
            "snap-guide-h",
            false
          ) + "px";
      };

      const onUp = () => {
        isDragging = false;
        commandMenuContainer.classList.remove("dragging");
        document
          .querySelectorAll(".snap-guide")
          .forEach((g) => g.classList.remove("visible"));
        localStorage.setItem(
          "cmd-pos",
          JSON.stringify({ x: overlay.style.left, y: overlay.style.top })
        );
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
  }

  const savedPos = JSON.parse(localStorage.getItem("cmd-pos"));
  if (savedPos)
    Object.assign(overlay.style, {
      transform: "none",
      left: savedPos.x,
      top: savedPos.y,
    });

  document.addEventListener(
    "mousemove",
    (e) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    },
    { passive: true }
  );

  const commandMenuItems = [
    {
      name: "Select",
      icon: "arrow_selector_tool",
      shortcut: "V",
      action: () => setTool("select"),
    },
    {
      name: "Pencil",
      icon: "edit",
      shortcut: "P",
      action: () => setTool("pencil"),
    },
    {
      name: "Marker",
      icon: "brush",
      shortcut: "B",
      action: () => setTool("marker"),
    },
    {
      name: "Text",
      icon: "text_fields",
      shortcut: "T",
      action: () => setTool("text"),
    },
    {
      name: "Eraser",
      icon: "ink_eraser",
      shortcut: "E",
      action: () => setTool("eraser"),
    },
    {
      name: "Rectangle",
      icon: "rectangle",
      shortcut: "R",
      action: () => {
        setShape("rectangle");
        setTool("shapes");
      },
    },
    {
      name: "Circle",
      icon: "radio_button_unchecked",
      shortcut: "C",
      action: () => {
        setShape("circle");
        setTool("shapes");
      },
    },
    {
      name: "Line",
      icon: "remove",
      shortcut: "L",
      action: () => {
        setShape("line");
        setTool("shapes");
      },
    },
    {
      name: "Arrow",
      icon: "arrow_forward",
      shortcut: "A",
      action: () => {
        setShape("arrow");
        setTool("shapes");
      },
    },
    {
      name: "Fill Toggle",
      icon: "format_color_fill",
      shortcut: "F",
      action: () => {
        const fillToggle = document.getElementById("shape-fill-toggle");
        if (fillToggle) fillToggle.click();
      },
    },
    {
      name: "Undo",
      icon: "undo",
      shortcut: "Ctrl+Z",
      hasInternalSound: true,
      action: () => undo(),
    },
    {
      name: "Redo",
      icon: "redo",
      shortcut: "Ctrl+Y",
      hasInternalSound: true,
      action: () => redo(),
    },
    {
      name: "Clear All",
      icon: "delete",
      shortcut: "Shift+Del",
      hasInternalSound: true,
      action: () => clearCanvas(),
    },
    {
      name: "Toggle Visibility",
      icon: "visibility_off",
      shortcut: "Ctrl+H",
      hasInternalSound: true,
      action: () => {
        const hideBtn = document.getElementById("hide-btn");
        if (hideBtn) hideBtn.click();
      },
    },
    {
      name: "Standby Mode",
      icon: "pause_circle",
      shortcut: "Space",
      hasInternalSound: true,
      action: () => standbyManager.toggle(),
    },
    {
      name: "Capture",
      icon: "camera_alt",
      shortcut: "Shift+C",
      action: () => {
        triggerCapture();
      },
    },
    {
      name: "Reset Menu Position",
      icon: "center_focus_strong",
      shortcut: "",
      noClose: true,
      action: () => {
        const overlay = document.getElementById("command-menu-overlay");
        const input = document.getElementById("command-menu-input");
        if (overlay) {
          Object.assign(overlay.style, { transform: "", left: "", top: "" });
          localStorage.removeItem("cmd-pos");
          document
            .querySelectorAll(".snap-guide")
            .forEach((g) => g.classList.remove("visible"));
          if (input) {
            input.value = "";
            input.focus();
            selectedItemIndex = 0;
            updateCommandMenu();
            if (resultsContainer) resultsContainer.scrollTop = 0;
          }
        }
      },
    },
    {
      name: "Settings",
      icon: "settings",
      shortcut: "Ctrl+,",
      hasInternalSound: true,
      action: () => {
        const menuBtn = document.getElementById("menu-btn");
        if (menuBtn) menuBtn.click();
      },
    },
    {
      name: "Close App",
      icon: "close",
      shortcut: "Esc",
      action: () => {
        const closeBtn = document.getElementById("close-btn");
        if (closeBtn) closeBtn.click();
      },
    },
  ];

  const commandMenuInput = document.getElementById("command-menu-input");
  const closeCommandMenuBtn = document.getElementById("close-command-menu");
  const commandMenuOverlay = document.getElementById("command-menu-overlay");
  const resultsContainer = document.getElementById("command-menu-results");

  function updateSelection(shouldScroll = true) {
    const items = resultsContainer.querySelectorAll(".command-menu-item");
    items.forEach((item, index) => {
      item.classList.toggle("active", index === selectedItemIndex);
    });

    const activeItem = resultsContainer.querySelector(
      ".command-menu-item.active"
    );
    if (activeItem && shouldScroll) {
      activeItem.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
    checkScrollMask();
  }

  function updateCommandMenu() {
    if (!commandMenuInput || !resultsContainer) return;

    const rawQuery = commandMenuInput.value;
    const query = rawQuery.toLowerCase().trim();

    const newFilteredItems = commandMenuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.shortcut.toLowerCase().includes(query)
    );

    filteredItems = newFilteredItems;

    if (filteredItems.length > 0) {
      resultsContainer.style.display = "block";
      resultsContainer.innerHTML = filteredItems
        .map(
          (item, index) => `
        <div class="command-menu-item ${index === selectedItemIndex ? "active" : ""}" data-index="${index}">
          <span class="material-symbols-outlined command-menu-item-icon">${item.icon}</span>
          <span class="command-menu-item-name">${item.name}</span>
          <span class="command-menu-item-shortcut">${item.shortcut}</span>
        </div>
      `
        )
        .join("");

      resultsContainer.querySelectorAll(".command-menu-item").forEach((el) => {
        el.addEventListener("click", () => {
          const index = parseInt(el.dataset.index);
          applyCommandMenuItem(index);
        });

        el.addEventListener("mouseenter", (e) => {
          if (e.clientX === lastMouseX && e.clientY === lastMouseY) return;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          selectedItemIndex = parseInt(el.dataset.index);
          updateSelection(false);
        });

        el.addEventListener("mousemove", (e) => {
          if (e.clientX === lastMouseX && e.clientY === lastMouseY) return;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          selectedItemIndex = parseInt(el.dataset.index);
          updateSelection(false);
        });
      });

      updateSelection();
    } else if (query !== "") {
      resultsContainer.style.display = "block";
      resultsContainer.innerHTML = `
        <div class="command-menu-no-results">
          <span class="material-symbols-outlined">search</span>
          <div class="command-menu-no-results-text">
            <span>No results found for </span>
            <span class="command-menu-no-results-quote">"</span><span class="command-menu-query-highlight">${rawQuery.trim()}</span><span class="command-menu-no-results-quote">"</span>
          </div>
        </div>
      `;
    } else {
      resultsContainer.style.display = "none";
      resultsContainer.innerHTML = "";
    }
  }

  function applyCommandMenuItem(index) {
    const item = filteredItems[index];
    if (item && item.action) {
      item.action();
      if (!item.noClose) {
        closeCommandMenu();
      }
      if (!item.hasInternalSound) {
        playSound("pop");
      }
    }
  }

  function toggleCommandMenu() {
    if (!commandMenuOverlay || !commandMenuInput) return;

    if (cleanupTimeout) {
      clearTimeout(cleanupTimeout);
      cleanupTimeout = null;
    }

    const isVisible = commandMenuOverlay.classList.contains("show");

    if (!isVisible) {
      commandMenuOverlay.classList.add("show");
      commandMenuInput.value = "";
      selectedItemIndex = 0;
      updateCommandMenu();
      checkScrollMask();
      setTimeout(() => {
        commandMenuInput.focus();
      }, 100);
    } else {
      closeCommandMenu();
    }
  }

  function closeCommandMenu() {
    if (commandMenuOverlay) {
      commandMenuOverlay.classList.remove("show");
    }

    cleanupTimeout = setTimeout(() => {
      if (commandMenuInput) {
        commandMenuInput.value = "";
      }
      if (resultsContainer) {
        resultsContainer.style.display = "none";
        resultsContainer.innerHTML = "";
      }
      filteredItems = [];
      cleanupTimeout = null;
    }, 150);
  }

  function checkScrollMask() {
    if (!resultsContainer) return;
    const isAtBottom =
      resultsContainer.scrollHeight - resultsContainer.scrollTop <=
      resultsContainer.clientHeight + 10;
    let shouldHaveMask =
      resultsContainer.scrollHeight > resultsContainer.clientHeight &&
      !isAtBottom;

    const activeItem = resultsContainer.querySelector(
      ".command-menu-item.active"
    );
    if (activeItem && shouldHaveMask) {
      const containerRect = resultsContainer.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      if (itemRect.bottom > containerRect.bottom - 45) {
        shouldHaveMask = false;
      }
    }

    resultsContainer.classList.toggle("has-mask", shouldHaveMask);
  }

  if (commandMenuInput) {
    commandMenuInput.addEventListener("input", () => {
      selectedItemIndex = 0;
      updateCommandMenu();
      setTimeout(checkScrollMask, 0);
    });

    commandMenuInput.addEventListener("keydown", (e) => {
      const itemsCount = filteredItems.length;

      if (e.key === "Escape") {
        e.preventDefault();
        if (commandMenuInput.value.length > 0) {
          commandMenuInput.value = "";
          selectedItemIndex = 0;
          updateCommandMenu();
          if (resultsContainer) resultsContainer.scrollTop = 0;
        } else {
          closeCommandMenu();
        }
        return;
      } else if (e.key === "ArrowDown" && itemsCount > 0) {
        e.preventDefault();
        selectedItemIndex = (selectedItemIndex + 1) % itemsCount;
        updateSelection(true);
        return;
      } else if (e.key === "ArrowUp" && itemsCount > 0) {
        e.preventDefault();
        selectedItemIndex = (selectedItemIndex - 1 + itemsCount) % itemsCount;
        updateSelection(true);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (itemsCount > 0) {
          applyCommandMenuItem(selectedItemIndex);
        }
        return;
      }

      const eventCtrl = e.ctrlKey || e.metaKey;
      const eventKey =
        e.key === "Delete" || e.key === "Backspace"
          ? "del"
          : e.key.toLowerCase();

      const item = commandMenuItems.find((i) => {
        if (!i.shortcut) return false;
        const p = i.shortcut.toLowerCase().split("+");
        const k = p.pop();
        return (
          k === eventKey &&
          p.includes("ctrl") === eventCtrl &&
          p.includes("shift") === e.shiftKey &&
          p.includes("alt") === e.altKey
        );
      });

      if (
        item &&
        (e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          e.key.length > 1 ||
          item.shortcut === "Shift+C")
      ) {
        e.preventDefault();
        item.action();
      }
    });
  }

  if (resultsContainer) {
    resultsContainer.addEventListener("scroll", checkScrollMask);
  }

  if (closeCommandMenuBtn) {
    closeCommandMenuBtn.addEventListener("click", closeCommandMenu);
  }

  return {
    toggleCommandMenu,
    closeCommandMenu,
    updateCommandMenu,
  };
}

module.exports = { initCommandMenu };
