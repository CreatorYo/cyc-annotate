const { ipcRenderer } = require("electron");
const { updatePositionToggle, updateDropdownMenu } = require("./utils/interface/dropdownMenu.js");
const { updateToggleSwitchColor } = require("./utils/interface/toggleSwitch.js");
const { normalizeHex, getColorForPicker } = require("./utils/theme/colorUtils.js");
const SettingsSearch = require("./utils/interface/search");
const {
  initThemeManager,
  applyTheme,
  updateToolbarBackgroundColor,
  updateAccentColor,
} = require("../../modules/utils/managers/themeManager.js");
const {
  formatShortcut,
  parseShortcut,
  updateResetShortcutVisibility,
} = require("./utils/shortcutUtils.js");
const {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_SHORTCUT,
} = require("../../../shared/constants.js");

initThemeManager();

ipcRenderer.on("shortcut-changed", (event, newShortcut) => {
  const shortcutInput = document.getElementById("shortcut-input");
  if (shortcutInput) {
    shortcutInput.value = formatShortcut(parseShortcut(newShortcut));
  }
});

ipcRenderer.on("onboarding-completed", () => {
  const newAccentColor =
    localStorage.getItem("accent-color") || DEFAULT_ACCENT_COLOR;
  updateAccentColor(newAccentColor);

  const newShortcut = localStorage.getItem("shortcut") || DEFAULT_SHORTCUT;
  const shortcutInput = document.getElementById("shortcut-input");
  if (shortcutInput) {
    shortcutInput.value = formatShortcut(parseShortcut(newShortcut));
  }
});

ipcRenderer.on("reset-everything", () => {
  window.location.reload();
});

const PRESET_ACCENT_COLORS = [
  { name: "Default Blue", color: DEFAULT_ACCENT_COLOR },
  { name: "Turquoise", color: "#40E0D0" },
  { name: "Lime Green", color: "#AEEA00" },
  { name: "Orange", color: "#ff8c42" },
  { name: "Pink", color: "#ff6b9d" },
  { name: "Green", color: "#36b065" },
  { name: "Red", color: "#ff6b6b" },
  { name: "Purple", color: "#7c4dff" },
  { name: "Navy", color: "#2962ff" },
  { name: "Teal", color: "#00bfa5" },
  { name: "Yellow", color: "#ffd600" },
  { name: "Magenta", color: "#ff00ff" },
];

window.osTheme = "dark";
let directoryCheckInterval = null;

function getEffectiveTheme(theme) {
  return theme === "system" ? window.osTheme : theme;
}

const themeDropdown = document.getElementById("theme-dropdown");
const themeDropdownTrigger = document.getElementById("theme-dropdown-trigger");

if (themeDropdownTrigger) {
  themeDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns(themeDropdown);
    themeDropdown.classList.toggle("open");
  });
}

document
  .querySelectorAll("#theme-dropdown .dropdown-menu-item")
  .forEach((item) => {
    item.addEventListener("click", () => {
      const value = item.dataset.value;
      applyTheme(value);
      themeDropdown.classList.remove("open");
    });
  });

function bindCheckbox(id, storageKey, defaultValue, ipcEvent = null, callback = null) {
  const el = document.getElementById(id);
  if (!el) return;
  const saved = localStorage.getItem(storageKey);
  el.checked = saved !== null ? saved === "true" : defaultValue;
  el.addEventListener("change", (e) => {
    const val = e.target.checked;
    localStorage.setItem(storageKey, val ? "true" : "false");
    
    ipcRenderer.send('sync-setting', { 
      key: storageKey, 
      value: val, 
      channel: ipcEvent 
    });
    
    if (callback) callback(val);
  });
  if (callback) callback(el.checked);
}



function updatePositionSettingsVisibility() {
  const layout = getCurrentLayout();
  const verticalPosition =
    localStorage.getItem("toolbar-position-vertical") || "left";
  const horizontalPosition =
    localStorage.getItem("toolbar-position-horizontal") || "bottom";

  if (layout === "vertical") {
    updatePositionToggle("vertical", verticalPosition);
  } else {
    updatePositionToggle("horizontal", horizontalPosition);
  }
}
window.updatePositionSettingsVisibility = updatePositionSettingsVisibility;

updateToggleSwitchColor();

const accentColorPicker = document.getElementById("accent-color-picker");
const accentColorPreview = document.getElementById("accent-color-preview");
const accentColorHex = document.getElementById("accent-color-hex");
const syncInfoIcon = document.getElementById("sync-info-icon");

const savedAccentColor =
  localStorage.getItem("accent-color") || DEFAULT_ACCENT_COLOR;
updateAccentColor(savedAccentColor);

if (accentColorHex) {
  accentColorHex.placeholder = DEFAULT_ACCENT_COLOR;
}

if (accentColorPicker) {
  accentColorPicker.value = savedAccentColor;
  accentColorPicker.addEventListener("change", (e) =>
    updateAccentColor(e.target.value, true),
  );
}

if (accentColorPreview && accentColorPicker) {
  const syncPickerValue = () => {
    const currentColor =
      localStorage.getItem("accent-color") || DEFAULT_ACCENT_COLOR;
    const pickerColor = getColorForPicker(currentColor);
    accentColorPicker.value = pickerColor;
  };

  accentColorPreview.addEventListener("click", () => {
    syncPickerValue();
    setTimeout(() => accentColorPicker.click(), 10);
  });

  accentColorPreview.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showAccentColorPresets(e.clientX, e.clientY);
  });

  accentColorPicker.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showAccentColorPresets(e.clientX, e.clientY);
  });

  accentColorPicker.addEventListener("focus", () => {
    syncPickerValue();
  });
}

const PRESET_ICONS = PRESET_ACCENT_COLORS.map((preset) => {
  const canvas = document.createElement("canvas");
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = preset.color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();
  return { ...preset, iconData: canvas.toDataURL("image/png") };
});

function showAccentColorPresets(x, y) {
  ipcRenderer
    .invoke("show-accent-color-presets", PRESET_ICONS, x, y, {
      isSyncEnabled: syncWindowsEnabled,
    })
    .then((result) => {
      if (result === "TOGGLE_SYNC") {
        toggleSync();
      } else if (result) {
        if (syncWindowsEnabled) toggleSync();
        updateAccentColor(result, true);
      }
    });
}

async function toggleSync() {
  const isCurrentlyActive = syncWindowsEnabled;

  if (isCurrentlyActive) {
    syncWindowsEnabled = false;
    updateSyncState(false);
    localStorage.setItem("sync-windows-accent", "false");
    ipcRenderer.send("toggle-windows-accent-sync", false);
  } else {
    try {
      const windowsColor = await ipcRenderer.invoke("get-windows-accent-color");
      if (windowsColor) {
        syncWindowsEnabled = true;
        updateSyncState(true);
        localStorage.setItem("sync-windows-accent", "true");
        ipcRenderer.send("toggle-windows-accent-sync", true);
        updateAccentColor(windowsColor, true);
      } else {
        await ipcRenderer.invoke(
          "show-error-dialog",
          "Accent Color Error",
          "Unable to get Windows accent colour. This feature is only available on Windows.",
        );
      }
    } catch (error) {
      await ipcRenderer.invoke(
        "show-error-dialog",
        "Accent Color Error",
        "Error syncing with Windows accent colour",
        error.message,
      );
    }
  }
}

if (accentColorHex) {
  accentColorHex.value = savedAccentColor;
  accentColorHex.addEventListener("input", (e) => {
    const hex = e.target.value.trim();
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex);
      updateAccentColor(normalizedHex, true);
    }
  });
  accentColorHex.addEventListener("blur", (e) => {
    const hex = e.target.value.trim();
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex);
      updateAccentColor(normalizedHex, true);
    } else {
      e.target.value = savedAccentColor;
    }
  });
  accentColorHex.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const hex = e.target.value.trim();
      if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
        const normalizedHex = normalizeHex(hex);
        updateAccentColor(normalizedHex, true);
      } else {
        e.target.value = savedAccentColor;
      }
      e.target.blur();
    }
  });
}

function updateSyncState(enabled) {
  syncWindowsEnabled = enabled;

  if (syncInfoIcon) {
    syncInfoIcon.style.display = enabled ? "inline-flex" : "none";
  }

  if (accentColorHex) {
    accentColorHex.disabled = enabled;
    if (enabled) {
      accentColorHex.style.opacity = "0.5";
      accentColorHex.style.cursor = "not-allowed";
      accentColorHex.title = "Right click to disable sync";
    } else {
      accentColorHex.style.opacity = "";
      accentColorHex.style.cursor = "";
      accentColorHex.title = "";
    }
  }

  if (accentColorPicker) {
    accentColorPicker.disabled = enabled;
    if (enabled) {
      accentColorPicker.style.pointerEvents = "none";
    } else {
      accentColorPicker.style.pointerEvents = "";
    }
  }

  if (accentColorPreview) {
    if (enabled) {
      accentColorPreview.style.cursor = "help";
      accentColorPreview.style.opacity = "0.7";
      accentColorPreview.title = "Right click to disable sync";
    } else {
      accentColorPreview.style.removeProperty("cursor");
      accentColorPreview.style.removeProperty("opacity");
      accentColorPreview.title = "Click to open colour picker";
    }
  }
}

let syncWindowsEnabled = localStorage.getItem("sync-windows-accent") === "true";
ipcRenderer.invoke("get-sync-windows-accent-state").then((enabled) => {
  if (enabled !== null) {
    syncWindowsEnabled = enabled;
    localStorage.setItem("sync-windows-accent", enabled ? "true" : "false");
    updateSyncState(enabled);
  }
});



const {
  applyLayout,
  getCurrentLayout,
  applyPosition,
} = require("./utils/toolbarSettings.js");

let currentLayout = getCurrentLayout();
let currentVerticalPosition =
  localStorage.getItem("toolbar-position-vertical") || "left";
let currentHorizontalPosition =
  localStorage.getItem("toolbar-position-horizontal") || "bottom";

window.applyPosition = applyPosition;
window.applyLayout = applyLayout;

const layoutDropdown = document.getElementById("layout-dropdown");
const layoutDropdownTrigger = document.getElementById(
  "layout-dropdown-trigger",
);

if (layoutDropdownTrigger) {
  layoutDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns(layoutDropdown);
    layoutDropdown.classList.toggle("open");
  });
}

document
  .querySelectorAll("#layout-dropdown .dropdown-menu-item")
  .forEach((item) => {
    item.addEventListener("click", () => {
      const value = item.dataset.value;
      applyLayout(value);
      layoutDropdown.classList.remove("open");
    });
  });

const positionDropdown = document.getElementById("position-dropdown");
const positionDropdownTrigger = document.getElementById(
  "position-dropdown-trigger",
);

if (positionDropdownTrigger) {
  positionDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns(positionDropdown);
    positionDropdown.classList.toggle("open");
  });
}

const startupWindowDropdown = document.getElementById("startup-window-dropdown");
const startupWindowDropdownTrigger = document.getElementById("startup-window-dropdown-trigger");

if (startupWindowDropdownTrigger) {
  startupWindowDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns(startupWindowDropdown);
    startupWindowDropdown.classList.toggle("open");
  });
}

const savedStartupWindow = localStorage.getItem("startup-window") || "toolbar";
if (startupWindowDropdown) {
  updateDropdownMenu("startup-window-dropdown", savedStartupWindow);
}

document
  .querySelectorAll("#startup-window-dropdown .dropdown-menu-item")
  .forEach((item) => {
    item.addEventListener("click", () => {
      const value = item.dataset.value;
      localStorage.setItem("startup-window", value);
      updateDropdownMenu("startup-window-dropdown", value);
      if (startupWindowDropdown) startupWindowDropdown.classList.remove("open");
      ipcRenderer.send("startup-window-changed", value);
    });
  });

function closeAllDropdowns(except = null) {
  const dropdowns = document.querySelectorAll(".dropdown-menu");
  dropdowns.forEach((d) => {
    if (d !== except) {
      d.classList.remove("open");
    }
  });
}

document.addEventListener("click", (e) => {
  if (themeDropdown && !themeDropdown.contains(e.target))
    themeDropdown.classList.remove("open");
  if (layoutDropdown && !layoutDropdown.contains(e.target))
    layoutDropdown.classList.remove("open");
  if (positionDropdown && !positionDropdown.contains(e.target))
    positionDropdown.classList.remove("open");
  if (startupWindowDropdown && !startupWindowDropdown.contains(e.target))
    startupWindowDropdown.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllDropdowns();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    updatePositionSettingsVisibility();
  });
} else {
  updatePositionSettingsVisibility();
}

updateDropdownMenu("layout-dropdown", currentLayout);

const shortcutInput = document.getElementById("shortcut-input");
const resetShortcutBtn = document.getElementById("reset-shortcut");
let isRecordingShortcut = false;
let currentShortcut = localStorage.getItem("shortcut") || DEFAULT_SHORTCUT;

const initialKeys = parseShortcut(currentShortcut);

if (shortcutInput) {
  shortcutInput.value = formatShortcut(initialKeys);
}

if (shortcutInput) {
  shortcutInput.addEventListener("click", () => {
    if (isRecordingShortcut) {
      isRecordingShortcut = false;
      shortcutInput.classList.remove("recording");
      shortcutInput.value = formatShortcut(parseShortcut(currentShortcut));
      return;
    }

    isRecordingShortcut = true;
    shortcutInput.classList.add("recording");
    shortcutInput.value = "Press keys...";
    shortcutInput.placeholder = "Press keys...";
  });
}

document.addEventListener("click", (e) => {
  if (
    isRecordingShortcut &&
    e.target !== shortcutInput &&
    !shortcutInput.contains(e.target)
  ) {
    isRecordingShortcut = false;
    shortcutInput.classList.remove("recording");
    shortcutInput.value = formatShortcut(parseShortcut(currentShortcut));
  }
});

document.addEventListener("keydown", (e) => {
  if (!isRecordingShortcut) return;

  e.preventDefault();
  e.stopPropagation();

  const keys = [];
  if (e.ctrlKey) keys.push("Control");
  if (e.metaKey) keys.push("Meta");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");

  if (!["Control", "Meta", "Alt", "Shift"].includes(e.key)) {
    keys.push(e.key);

    const shortcutStr = keys.join("+");
    currentShortcut = shortcutStr;
    if (shortcutInput) {
      shortcutInput.value = formatShortcut(keys);
      shortcutInput.classList.remove("recording");
    }
    isRecordingShortcut = false;
    localStorage.setItem("shortcut", shortcutStr);
    updateResetShortcutVisibility();

    ipcRenderer.send("update-shortcut", shortcutStr);
  }
});

if (resetShortcutBtn) {
  resetShortcutBtn.addEventListener("click", () => {
    currentShortcut = DEFAULT_SHORTCUT;
    if (shortcutInput) {
      shortcutInput.value = formatShortcut(parseShortcut(DEFAULT_SHORTCUT));
    }
    localStorage.setItem("shortcut", DEFAULT_SHORTCUT);
    ipcRenderer.send("update-shortcut", DEFAULT_SHORTCUT);
    updateResetShortcutVisibility();
  });
}

const soundsCheckbox = document.getElementById("sounds-enabled");
if (soundsCheckbox) {
  const soundsEnabled = localStorage.getItem("sounds-enabled");
  if (soundsEnabled !== null) {
    soundsCheckbox.checked = soundsEnabled === "true";
  }

  soundsCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("sounds-enabled", e.target.checked);
    ipcRenderer.send("sounds-changed", e.target.checked);
  });
}

const SOUND_TYPES = [
  "trash",
  "pop",
  "undo",
  "redo",
  "capture",
  "color",
  "copy",
  "paste",
  "selectAll",
  "standbyOn",
  "standbyOff",
  "visibilityOn",
  "visibilityOff",
  "timerAlarm",
];

let currentSoundFilter = "all";
let currentSoundSearch = "";

function applyCustomSoundsFilters() {
  window.applyCustomSoundsFilters = applyCustomSoundsFilters;
  const soundRows = document.querySelectorAll(".custom-sound-row");
  soundRows.forEach((row) => {
    const soundInfo = row.querySelector(".sound-info span:not(.material-symbols-outlined)");
    if (!soundInfo) return;
    
    const soundName = soundInfo.textContent.toLowerCase();
    const pathDisplay = row.querySelector(".sound-path-display");
    const isCustom = pathDisplay && pathDisplay.classList.contains("has-custom-path");

    const matchesSearch = soundName.includes(currentSoundSearch);
    let matchesFilter = true;

    if (currentSoundFilter === "custom") matchesFilter = isCustom;
    else if (currentSoundFilter === "default") matchesFilter = !isCustom;

    row.style.display = matchesSearch && matchesFilter ? "grid" : "none";
  });

  const visibleRows = Array.from(soundRows).filter(r => r.style.display !== "none");
  const listContainer = document.querySelector(".custom-sounds-list");
  const testSection = document.querySelector(".test-sounds-section");
  
  if (!listContainer) return;

  let emptyState = document.getElementById("custom-sounds-empty-state");
  
  if (visibleRows.length === 0) {
    if (testSection) testSection.style.display = "none";
    if (!emptyState) {
      emptyState = document.createElement("div");
      emptyState.id = "custom-sounds-empty-state";
      emptyState.className = "empty-state-message";
      emptyState.style.cssText = `
        padding: 40px 20px;
        text-align: center;
        opacity: 0.6;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      `;
      emptyState.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 32px;">search</span>
        <span style="font-size: 13px;">No matching sounds found</span>
      `;
      listContainer.appendChild(emptyState);
    }
  } else {
    if (testSection) testSection.style.display = "block";
    if (emptyState) {
      emptyState.remove();
    }
  }
}

function initCustomSounds() {
  SOUND_TYPES.forEach((soundType) => {
    const pathSpan = document.getElementById(`${soundType}-sound-path`);
    const selectBtn = document.getElementById(`${soundType}-sound-btn`);
    const resetBtn = document.getElementById(`${soundType}-sound-reset`);

    if (pathSpan && selectBtn && resetBtn) {
      const savedPath = localStorage.getItem(`custom-sound-${soundType}`);
      if (savedPath) {
        pathSpan.textContent = savedPath;
        pathSpan.classList.add("has-custom-path");
        checkSoundFileExists(soundType, savedPath);
      } else {
        pathSpan.textContent = "Default sound";
        pathSpan.classList.remove("has-custom-path");
      }

      selectBtn.addEventListener("click", () => {
        ipcRenderer.send("select-custom-sound", soundType);
      });

      resetBtn.addEventListener("click", () => {
        localStorage.removeItem(`custom-sound-${soundType}`);
        pathSpan.textContent = "Default sound";
        pathSpan.title = "";
        pathSpan.classList.remove("has-custom-path");
        pathSpan.style.color = "";
        pathSpan.style.opacity = "";
        ipcRenderer.send("reset-custom-sound", soundType);
        applyCustomSoundsFilters();
      });

      pathSpan.addEventListener("click", () => {
        if (pathSpan.textContent === "Copied!") return;
        if (!pathSpan.classList.contains("has-custom-path")) return;
        const text = pathSpan.textContent.replace(" (File not found)", "");
        navigator.clipboard.writeText(text).then(() => {
          const originalText = pathSpan.textContent;
          const originalColor = pathSpan.style.color;
          pathSpan.textContent = "Copied!";
          pathSpan.style.color = "#16a34a";
          pathSpan.classList.add("copied");
          setTimeout(() => {
            pathSpan.textContent = originalText;
            pathSpan.style.color = originalColor;
            pathSpan.classList.remove("copied");
          }, 1000);
        });
      });
    }
  });

  const testAllBtn = document.getElementById("test-all-sounds-btn");
  if (testAllBtn) {
    testAllBtn.addEventListener("click", () => {
      const accentColor = getComputedStyle(document.body)
        .getPropertyValue("--accent-color")
        .trim();
      ipcRenderer.send("test-all-sounds", accentColor);
    });
  }

  const applyAllToggle = document.getElementById("apply-all-sounds-toggle");
  const applyAllMenu = document.getElementById("apply-all-sounds-menu");

  if (applyAllToggle && applyAllMenu) {
    applyAllToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isShowing = applyAllMenu.classList.toggle("show");
      applyAllToggle.classList.toggle("active", isShowing);
    });

    document.addEventListener("click", () => {
      applyAllMenu.classList.remove("show");
      applyAllToggle.classList.remove("active");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        applyAllMenu.classList.remove("show");
        applyAllToggle.classList.remove("active");
      }
    });
  }

  const applyToAllBtn = document.getElementById("apply-current-to-all");
  if (applyToAllBtn) {
    applyToAllBtn.addEventListener("click", async () => {
      const result = await ipcRenderer.invoke("show-open-dialog", {
        title: "Select Sound to Apply to All",
        filters: [
          {
            name: "Supported Audio & Video",
            extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a", "mp4"],
          },
        ],
        properties: ["openFile"],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        SOUND_TYPES.forEach((type) => {
          localStorage.setItem(`custom-sound-${type}`, filePath);
          const pathSpan = document.getElementById(`${type}-sound-path`);
          if (pathSpan) {
            pathSpan.textContent = filePath;
            pathSpan.classList.add("has-custom-path");
          }
          ipcRenderer.send("custom-sound-selected", type, filePath);
        });
        applyCustomSoundsFilters();
        await ipcRenderer.invoke("show-info-dialog", "Success", "Sound applied to all actions!");
      }
    });
  }

  const resetAllSoundsBtn = document.getElementById("reset-all-custom-sounds");
  if (resetAllSoundsBtn) {
    resetAllSoundsBtn.addEventListener("click", () => {
      SOUND_TYPES.forEach((type) => {
        localStorage.removeItem(`custom-sound-${type}`);
        const pathSpan = document.getElementById(`${type}-sound-path`);
        if (pathSpan) {
          pathSpan.textContent = "Default sound";
          pathSpan.title = "";
          pathSpan.classList.remove("has-custom-path");
          pathSpan.style.color = "";
          pathSpan.style.opacity = "";
        }
        ipcRenderer.send("reset-custom-sound", type);
      });
      applyCustomSoundsFilters();
      ipcRenderer.invoke("show-info-dialog", "Success", "All custom sounds have been reset to defaults!");
    });
  }
}

async function checkSoundFileExists(soundType, filePath) {
  if (!filePath) return;
  const pathSpan = document.getElementById(`${soundType}-sound-path`);
  if (!pathSpan) return;

  const exists = await ipcRenderer.invoke("check-file-exists", filePath);
  if (!exists) {
    if (!pathSpan.textContent.includes("(File not found)")) {
      pathSpan.textContent = filePath + " (File not found)";
    }
    pathSpan.classList.add("file-missing");
    pathSpan.style.color = "#ff6b6b";
    pathSpan.style.opacity = "1";
    pathSpan.title = filePath;
  } else {
    pathSpan.textContent = filePath;
    pathSpan.classList.remove("file-missing");
    pathSpan.style.color = "";
    pathSpan.style.opacity = "";
    pathSpan.title = filePath;
  }
}

function checkAllSoundFiles() {
  SOUND_TYPES.forEach((type) => {
    const savedPath = localStorage.getItem(`custom-sound-${type}`);
    if (savedPath) {
      checkSoundFileExists(type, savedPath);
    }
  });
}

setInterval(checkAllSoundFiles, 3000);

function updateCustomSoundFilterGlider(animate = true) {
  const filterGroup = document.getElementById("custom-sounds-filter");
  const glider = filterGroup?.querySelector(".filter-glider");
  const activePill = filterGroup?.querySelector(".filter-pill.active");

  if (glider && activePill) {
    if (!animate) glider.style.transition = "none";
    glider.style.width = `${activePill.offsetWidth}px`;
    glider.style.left = `${activePill.offsetLeft}px`;
    if (!animate) {
      glider.offsetHeight;
      glider.style.transition = "";
    }
  }
}

function initCustomSoundsFiltering() {
  const searchInput = document.getElementById("custom-sounds-search");
  const filterGroup = document.getElementById("custom-sounds-filter");

  if (!searchInput || !filterGroup) return;

  searchInput.addEventListener("input", (e) => {
    currentSoundSearch = e.target.value.toLowerCase();
    applyCustomSoundsFilters();
  });

  filterGroup.addEventListener("click", (e) => {
    const pill = e.target.closest(".filter-pill");
    if (!pill) return;

    filterGroup
      .querySelectorAll(".filter-pill")
      .forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    currentSoundFilter = pill.dataset.filter;
    updateCustomSoundFilterGlider();
    applyCustomSoundsFilters();
  });

  setTimeout(() => updateCustomSoundFilterGlider(false), 50);

  const customSoundsToggle = document.getElementById("custom-sounds-toggle");
  if (customSoundsToggle) {
    customSoundsToggle.addEventListener("click", () => {
      updateCustomSoundFilterGlider(false);
      setTimeout(() => updateCustomSoundFilterGlider(false), 50);
      setTimeout(() => updateCustomSoundFilterGlider(false), 150);
    });
  }

  const mainSoundsToggle = document.getElementById("sounds-enabled");
  if (mainSoundsToggle) {
    mainSoundsToggle.addEventListener("change", () => {
      if (mainSoundsToggle.checked) {
        setTimeout(() => updateCustomSoundFilterGlider(false), 50);
      }
    });
  }
}

initCustomSounds();
initCustomSoundsFiltering();

ipcRenderer.on("custom-sound-selected", (event, soundType, filePath) => {
  const pathSpan = document.getElementById(`${soundType}-sound-path`);
  if (pathSpan) {
    localStorage.setItem(`custom-sound-${soundType}`, filePath);
    pathSpan.textContent = filePath;
    pathSpan.classList.add("has-custom-path");
    pathSpan.style.color = "";
    pathSpan.style.opacity = "";
    checkSoundFileExists(soundType, filePath);
    applyCustomSoundsFilters();
  }
});

const soundsToggle = document.getElementById("sounds-enabled");
const customSoundsSection = document.getElementById("custom-sounds-section");

function updateCustomSoundsVisibility() {
  if (customSoundsSection && soundsToggle) {
    customSoundsSection.style.display = soundsToggle.checked ? "block" : "none";
  }
}

if (soundsToggle) {
  soundsToggle.addEventListener("change", updateCustomSoundsVisibility);
  updateCustomSoundsVisibility();
}

bindCheckbox("text-solve-enabled", "text-solve-enabled", false);
bindCheckbox("element-eraser-enabled", "element-eraser-enabled", true, "element-eraser-changed");
bindCheckbox("snap-to-objects-enabled", "snap-to-objects-enabled", false, "snap-to-objects-changed");
bindCheckbox("show-tray-icon", "show-tray-icon", true, "toggle-tray-icon");
bindCheckbox("toolbar-accent-bg-enabled", "toolbar-accent-bg", false, null, updateToolbarBackgroundColor);
bindCheckbox("toolbar-dragging-enabled", "toolbar-dragging-enabled", true, "toolbar-dragging-changed");
bindCheckbox("standby-in-toolbar", "standby-in-toolbar", false, "standby-in-toolbar-changed");
bindCheckbox("launch-on-startup", "launch-on-startup", false, "set-auto-launch");
bindCheckbox("screenshot-notification", "screenshot-notification", true, "screenshot-notification-changed");
bindCheckbox("copy-snapshot-clipboard", "copy-snapshot-clipboard", false, "copy-snapshot-clipboard-changed");
bindCheckbox("reduce-clutter-enabled", "reduce-clutter", true, "reduce-clutter-changed", updateToolbarSubSettingVisibility);
bindCheckbox("sticky-note-in-toolbar", "sticky-note-in-toolbar", false, "sticky-note-in-toolbar-changed");

const autoSaveSnapshotsCheckbox = document.getElementById(
  "auto-save-snapshots",
);
const saveDirectoryWrapper = document.getElementById("save-directory-wrapper");
const saveDirectoryPath = document.getElementById("save-directory-path");
const selectSaveDirectoryBtn = document.getElementById(
  "select-save-directory-btn",
);

if (autoSaveSnapshotsCheckbox) {
  const autoSaveSnapshots = localStorage.getItem("auto-save-snapshots");
  if (autoSaveSnapshots !== null) {
    autoSaveSnapshotsCheckbox.checked = autoSaveSnapshots === "true";
  } else {
    autoSaveSnapshotsCheckbox.checked = false;
  }

  if (autoSaveSnapshotsCheckbox.checked && saveDirectoryWrapper) {
    saveDirectoryWrapper.style.display = "block";
  }

  function checkDirectoryExists(directoryPath) {
    if (!directoryPath) return;

    ipcRenderer
      .invoke("check-directory-exists", directoryPath)
      .then((exists) => {
        const autoSaveEnabled =
          localStorage.getItem("auto-save-snapshots") === "true";
        const directoryWarning = document.getElementById("directory-warning");

        if (!exists && autoSaveEnabled) {
          const warningDismissed =
            sessionStorage.getItem("directory-warning-dismissed") === "true";
          if (directoryWarning && !warningDismissed) {
            directoryWarning.style.display = "flex";
          }

          if (saveDirectoryPath) {
            if (!saveDirectoryPath.textContent.includes("(Directory not found)")) {
              saveDirectoryPath.textContent =
                directoryPath + " (Directory not found)";
            }
            saveDirectoryPath.style.color = "#ff6b6b";
            saveDirectoryPath.style.opacity = "1";
            saveDirectoryPath.title = directoryPath;
            saveDirectoryPath.classList.add("file-missing");
          }

          ipcRenderer.send("update-settings-badge", true);
        } else {
          if (directoryWarning) {
            directoryWarning.style.display = "none";
          }

          if (exists) {
            sessionStorage.removeItem("directory-warning-dismissed");
          }

          if (saveDirectoryPath) {
            if (exists) {
              saveDirectoryPath.textContent = directoryPath;
              saveDirectoryPath.style.color = "";
              saveDirectoryPath.style.opacity = "";
              saveDirectoryPath.title = directoryPath;
              saveDirectoryPath.classList.remove("file-missing");
            } else {
              if (!saveDirectoryPath.textContent.includes("(Directory not found)")) {
                saveDirectoryPath.textContent =
                  directoryPath + " (Directory not found)";
              }
              saveDirectoryPath.style.color = "#ff6b6b";
              saveDirectoryPath.style.opacity = "1";
              saveDirectoryPath.title = directoryPath;
              saveDirectoryPath.classList.add("file-missing");
            }
          }

          ipcRenderer.send("update-settings-badge", !exists && autoSaveEnabled);
        }
      });
  }

  if (saveDirectoryPath) {
    saveDirectoryPath.addEventListener("click", () => {
      if (saveDirectoryPath.textContent === "Copied!") return;
      if (!saveDirectoryPath.classList.contains("has-directory")) return;
      const text = saveDirectoryPath.textContent.replace(
        " (Directory not found)",
        "",
      );
      navigator.clipboard.writeText(text).then(() => {
        const originalText = saveDirectoryPath.textContent;
        const originalColor = saveDirectoryPath.style.color;
        saveDirectoryPath.textContent = "Copied!";
        saveDirectoryPath.style.color = "#16a34a";
        saveDirectoryPath.classList.add("copied");
        setTimeout(() => {
          saveDirectoryPath.textContent = originalText;
          saveDirectoryPath.style.color = originalColor;
          saveDirectoryPath.classList.remove("copied");
        }, 1000);
      });
    });
  }

  const savedDirectory = localStorage.getItem("save-directory-path");
  if (savedDirectory && saveDirectoryPath) {
    saveDirectoryPath.textContent = savedDirectory;
    saveDirectoryPath.classList.add("has-directory");

    if (autoSaveSnapshotsCheckbox && autoSaveSnapshotsCheckbox.checked) {
      checkDirectoryExists(savedDirectory);

      directoryCheckInterval = setInterval(() => {
        const autoSaveEnabled =
          localStorage.getItem("auto-save-snapshots") === "true";
        const currentDir = localStorage.getItem("save-directory-path");
        if (autoSaveEnabled && currentDir) {
          checkDirectoryExists(currentDir);
        } else {
          clearInterval(directoryCheckInterval);
          directoryCheckInterval = null;
        }
      }, 3000);
    }
  } else if (saveDirectoryPath) {
    saveDirectoryPath.textContent = "No directory selected";
    saveDirectoryPath.classList.remove("has-directory");
  }

  autoSaveSnapshotsCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("auto-save-snapshots", e.target.checked);
    ipcRenderer.send("auto-save-snapshots-changed", e.target.checked);

    if (saveDirectoryWrapper) {
      saveDirectoryWrapper.style.display = e.target.checked ? "block" : "none";
    }

    if (e.target.checked) {
      const savedDir = localStorage.getItem("save-directory-path");
      if (savedDir) {
        checkDirectoryExists(savedDir);
        if (!directoryCheckInterval) {
          directoryCheckInterval = setInterval(() => {
            const autoSaveEnabled =
              localStorage.getItem("auto-save-snapshots") === "true";
            const currentDir = localStorage.getItem("save-directory-path");
            if (autoSaveEnabled && currentDir) {
              checkDirectoryExists(currentDir);
            } else {
              clearInterval(directoryCheckInterval);
              directoryCheckInterval = null;
            }
          }, 3000);
        }
      }
    } else {
      ipcRenderer.send("update-settings-badge", false);
      const directoryWarning = document.getElementById("directory-warning");
      if (directoryWarning) {
        directoryWarning.style.display = "none";
      }
      if (directoryCheckInterval) {
        clearInterval(directoryCheckInterval);
        directoryCheckInterval = null;
      }
    }
  });
}

const closeDirectoryWarningBtn = document.getElementById(
  "close-directory-warning",
);
if (closeDirectoryWarningBtn) {
  closeDirectoryWarningBtn.addEventListener("click", () => {
    const directoryWarning = document.getElementById("directory-warning");
    if (directoryWarning) {
      directoryWarning.style.display = "none";
      sessionStorage.setItem("directory-warning-dismissed", "true");
    }
  });
}

if (selectSaveDirectoryBtn) {
  selectSaveDirectoryBtn.addEventListener("click", async () => {
    const result = await ipcRenderer.invoke("select-save-directory");
    if (
      result &&
      !result.canceled &&
      result.filePaths &&
      result.filePaths.length > 0
    ) {
      const selectedPath = result.filePaths[0];
      localStorage.setItem("save-directory-path", selectedPath);
      sessionStorage.removeItem("directory-warning-dismissed");
      if (saveDirectoryPath) {
        saveDirectoryPath.textContent = selectedPath;
        saveDirectoryPath.style.color = "";
        saveDirectoryPath.style.opacity = "";
        saveDirectoryPath.classList.add("has-directory");
      }
      ipcRenderer.send("save-directory-changed", selectedPath);

      checkDirectoryExists(selectedPath);

      const autoSaveEnabled =
        localStorage.getItem("auto-save-snapshots") === "true";
      if (autoSaveEnabled && !directoryCheckInterval) {
        directoryCheckInterval = setInterval(() => {
          const enabled =
            localStorage.getItem("auto-save-snapshots") === "true";
          const currentDir = localStorage.getItem("save-directory-path");
          if (enabled && currentDir) {
            checkDirectoryExists(currentDir);
          } else {
            clearInterval(directoryCheckInterval);
            directoryCheckInterval = null;
          }
        }, 3000);
      }
    }
  });
}

ipcRenderer.on("sync-system-settings", (event, settings) => {
  if (settings) {
    if (showTrayIconCheckbox) {
      showTrayIconCheckbox.checked = settings.showTrayIcon !== false;
      localStorage.setItem("show-tray-icon", settings.showTrayIcon !== false);
    }
    if (launchOnStartupCheckbox) {
      launchOnStartupCheckbox.checked = settings.launchOnStartup === true;
      localStorage.setItem(
        "launch-on-startup",
        settings.launchOnStartup === true,
      );
    }
  }
});

function initToggleLabelClick() {
  document.querySelectorAll(".setting-row").forEach((row) => {
    const labelWrapper = row.querySelector(
      ".setting-label-wrapper[data-toggle-for]",
    );
    if (labelWrapper) {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".toggle-switch")) {
          return;
        }
        const checkboxId = labelWrapper.getAttribute("data-toggle-for");
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.click();
        }
      });
    }
  });
}

function updateToolbarSubSettingVisibility() {
  const el = document.getElementById("reduce-clutter-enabled");
  const standby = document.getElementById("standby-in-toolbar-wrapper");
  const sticky = document.getElementById("sticky-note-in-toolbar-wrapper");
  const display = el && el.checked ? "block" : "none";
  if (standby) standby.style.display = display;
  if (sticky) sticky.style.display = display;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initToggleLabelClick);
} else {
  initToggleLabelClick();
}

const showOnboardingBtn = document.getElementById("show-onboarding-btn");
if (showOnboardingBtn) {
  showOnboardingBtn.addEventListener("click", () => {
    ipcRenderer.send("show-onboarding");
  });
}

const resetEverythingBtn = document.getElementById("reset-everything-btn");
if (resetEverythingBtn) {
  resetEverythingBtn.addEventListener("click", async () => {
    await resetEverything();
  });
}

const DIALOG_INFO = {
  "duplicate-warning": {
    name: "Duplicate Many Elements",
    description: "Warning when duplicating a large number of elements",
    icon: "content_copy",
  },
  "switch-to-overlay-warning": {
    name: "Switch to Overlay",
    description: "Warning when switching from whiteboard to annotation overlay",
    icon: "layers",
  },
  "toolbar-collision": {
    name: "Toolbar Collision",
    description: "Warning when elements overlap with the toolbar",
    icon: "dock_to_right",
  },
};

const dismissedDialogsToggle = document.getElementById(
  "dismissed-dialogs-toggle",
);
const dismissedDialogsContent = document.getElementById(
  "dismissed-dialogs-content",
);
const dismissedDialogsList = document.getElementById("dismissed-dialogs-list");
const dismissedCount = document.getElementById("dismissed-count");

if (dismissedDialogsToggle) {
  dismissedDialogsToggle.addEventListener("click", () => {
    dismissedDialogsToggle.classList.toggle("expanded");
    dismissedDialogsContent.classList.toggle("expanded");
  });
}

const customSoundsToggle = document.getElementById("custom-sounds-toggle");
const customSoundsContent = document.getElementById("custom-sounds-content");

if (customSoundsToggle) {
  customSoundsToggle.addEventListener("click", () => {
    customSoundsToggle.classList.toggle("expanded");
    customSoundsContent.classList.toggle("expanded");
  });
}

async function loadDismissedDialogs() {
  try {
    const dismissedDialogs = await ipcRenderer.invoke("get-dismissed-dialogs");
    const dialogIds = Object.keys(dismissedDialogs || {}).filter(
      (id) => dismissedDialogs[id],
    );

    if (dismissedCount) {
      dismissedCount.textContent = dialogIds.length > 0 ? dialogIds.length : "";
    }

    if (dismissedDialogsList) {
      if (dialogIds.length === 0) {
        dismissedDialogsList.innerHTML = `
          <div class="no-dismissed-dialogs">
            <span class="material-symbols-outlined">check_circle</span>
            <span>All dialogs are enabled</span>
          </div>
        `;
      } else {
        dismissedDialogsList.innerHTML = dialogIds
          .map((id) => {
            const info = DIALOG_INFO[id] || {
              name: id,
              description: "",
              icon: "info",
            };
            return `
            <div class="dismissed-dialog-item" data-dialog-id="${id}">
              <div class="dismissed-dialog-icon">
                <span class="material-symbols-outlined">${info.icon}</span>
              </div>
              <div class="dismissed-dialog-info">
                <span class="dismissed-dialog-name">${info.name}</span>
                <span class="dismissed-dialog-desc">${info.description}</span>
              </div>
              <button class="restore-dialog-btn" data-dialog-id="${id}" title="Re-enable this dialog">
                <span class="material-symbols-outlined">visibility</span>
              </button>
            </div>
          `;
          })
          .join("");

        dismissedDialogsList
          .querySelectorAll(".restore-dialog-btn")
          .forEach((btn) => {
            btn.addEventListener("click", async () => {
              const dialogId = btn.dataset.dialogId;
              ipcRenderer.send("reset-dismissed-dialog", dialogId);
              await loadDismissedDialogs();
            });
          });
      }
    }
  } catch (e) {
    await ipcRenderer.invoke(
      "show-warning-dialog",
      "Settings Warning",
      "Could not load dismissed dialogs",
      e.message,
    );
  }
}

ipcRenderer.on("dismissed-dialogs-updated", () => {
  loadDismissedDialogs();
});

setTimeout(() => loadDismissedDialogs(), 100);

const categoryTitles = {
  appearance: {
    title: "Appearance",
    subtitle: "Customise the app's look and feel",
  },
  toolbar: {
    title: "Toolbar",
    subtitle: "Configure toolbar layout and display options",
  },
  shortcuts: { title: "Shortcuts", subtitle: "Manage keyboard shortcuts" },
  behavior: {
    title: "Behavior",
    subtitle: "Customise how the app behaves and responds",
  },
  system: {
    title: "System",
    subtitle: "System integration and startup options",
  },
  labs: {
    title: "Labs",
    subtitle: "Experimental features and advanced options",
  },
  reset: { title: "Reset", subtitle: "Reset settings or view onboarding" },
  about: { title: "About", subtitle: "Application information and support" },
};

let currentCategory = localStorage.getItem("settings-category") || "appearance";

function showCategory(category) {
  currentCategory = category;
  window.currentCategory = category;
  localStorage.setItem("settings-category", category);

  const pill = document.querySelector(".nav-pill");

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.category === category) {
      item.classList.add("active");
      if (pill) {
        pill.style.top = `${item.offsetTop}px`;
        pill.style.height = `${item.offsetHeight}px`;
        pill.style.opacity = "1";
      }
    }
  });

  const categoryTitle = document.getElementById("category-title");
  const categorySubtitle = document.getElementById("category-subtitle");
  const labsInfoBtn = document.getElementById("labs-info-btn");

  if (categoryTitle && categorySubtitle && categoryTitles[category]) {
    categoryTitle.textContent = categoryTitles[category].title;
    categorySubtitle.textContent = categoryTitles[category].subtitle;

    if (labsInfoBtn) {
      labsInfoBtn.style.display = category === "labs" ? "flex" : "none";
    }
  }

  document.querySelectorAll(".settings-section").forEach((section) => {
    if (section.dataset.category === category) {
      section.classList.add("active");
    } else {
      section.classList.remove("active");
    }
  });
}

function initCategoryNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const category = item.dataset.category;
      if (category) {
        showCategory(category);
      }
    });
  });

  const labsInfoBtn = document.getElementById("labs-info-btn");
  let isLabsDialogShowing = false;
  if (labsInfoBtn) {
    labsInfoBtn.addEventListener("click", async () => {
      if (isLabsDialogShowing) return;
      isLabsDialogShowing = true;
      await ipcRenderer.invoke(
        "show-warning-dialog",
        "Labs Warning",
        "Experimental Features",
        "These features are experimental and may be unstable or change in future updates. Use at your own risk.",
      );
      isLabsDialogShowing = false;
    });
  }

  showCategory(currentCategory);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCategoryNavigation);
} else {
  initCategoryNavigation();
}

async function initReportIssueButton() {
  try {
    const systemInfo = await ipcRenderer.invoke("get-system-info");
    cachedSystemInfo = systemInfo;
    const versionEl = document.getElementById("about-version");
    const reportBtn = document.getElementById("report-issue-btn");

    if (versionEl) {
      versionEl.textContent = `Version ${systemInfo.version}`;
    }

    if (reportBtn) {
      const subject = encodeURIComponent(
        `Bug Report - CYC Annotate v${systemInfo.version}`,
      );
      const body =
        encodeURIComponent(`Please describe the issue you're experiencing:




---
System Information:
- App Version: ${systemInfo.version}
${systemInfo.osVersion ? `- Operating System: ${systemInfo.osVersion}` : `- Platform: ${systemInfo.platform}`}
- Architecture: ${systemInfo.arch}
- Electron Version: ${systemInfo.electronVersion}
- Chrome Version: ${systemInfo.chromeVersion}
- Node Version: ${systemInfo.nodeVersion}`);

      reportBtn.href = `mailto:help@creatoryogames.com?subject=${subject}&body=${body}`;
    }
  } catch (error) {
    await ipcRenderer.invoke(
      "show-error-dialog",
      "Initialization Error",
      "Error initializing report issue button",
      error.message,
    );
  }
}

function initViewDetailsButton() {
  const viewDetailsBtn = document.getElementById("view-details-btn");

  if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener("click", () => {
      ipcRenderer.invoke("show-system-details-dialog");
    });
  }
}

const optimizedRenderingCheckbox = document.getElementById(
  "optimized-rendering",
);
if (optimizedRenderingCheckbox) {
  const optimizedRendering = localStorage.getItem("optimized-rendering");
  const initialOptimizedRendering = optimizedRendering === "true";
  if (optimizedRendering !== null) {
    optimizedRenderingCheckbox.checked = initialOptimizedRendering;
  }

  optimizedRenderingCheckbox.addEventListener("change", async (e) => {
    const newValue = e.target.checked;

    if (newValue !== initialOptimizedRendering) {
      localStorage.setItem("optimized-rendering", newValue);
      localStorage.setItem("settings-category", "labs");
      ipcRenderer.send("optimized-rendering-changed", newValue);

      const shouldRelaunch = await ipcRenderer.invoke(
        "show-relaunch-dialog",
        "optimized-rendering",
      );
      if (shouldRelaunch) {
      }
    } else {
      localStorage.setItem("optimized-rendering", newValue);
      ipcRenderer.send("optimized-rendering-changed", newValue);
    }
  });
}

const hardwareAccelerationCheckbox = document.getElementById(
  "hardware-acceleration",
);
if (hardwareAccelerationCheckbox) {
  const hardwareAcceleration = localStorage.getItem("hardware-acceleration");
  const initialHardwareAcceleration = hardwareAcceleration === "true";
  if (hardwareAcceleration !== null) {
    hardwareAccelerationCheckbox.checked = initialHardwareAcceleration;
  }

  hardwareAccelerationCheckbox.addEventListener("change", async (e) => {
    const newValue = e.target.checked;

    if (newValue !== initialHardwareAcceleration) {
      localStorage.setItem("hardware-acceleration", newValue);
      localStorage.setItem("settings-category", "labs");
      ipcRenderer.send("hardware-acceleration-changed", newValue);

      const shouldRelaunch = await ipcRenderer.invoke(
        "show-relaunch-dialog",
        "hardware-acceleration",
      );
      if (shouldRelaunch) {
      }
    } else {
      localStorage.setItem("hardware-acceleration", newValue);
      ipcRenderer.send("hardware-acceleration-changed", newValue);
    }
  });
}

function initInfoTooltips() {
  const tooltip = document.createElement("div");
  tooltip.className = "info-tooltip";
  document.body.appendChild(tooltip);

  document.querySelectorAll(".info-icon[data-tooltip]").forEach((icon) => {
    icon.addEventListener("mouseenter", () => {
      tooltip.textContent = icon.dataset.tooltip;
      tooltip.classList.add("visible");
      const rect = icon.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.top - 8}px`;
    });
    icon.addEventListener("mouseleave", () =>
      tooltip.classList.remove("visible"),
    );
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initReportIssueButton();
    initViewDetailsButton();
    updateResetShortcutVisibility();
    initInfoTooltips();
  });
} else {
  initReportIssueButton();
  initViewDetailsButton();
  updateResetShortcutVisibility();
  initInfoTooltips();
}

window.categoryTitles = categoryTitles;
window.currentCategory = currentCategory;

new SettingsSearch();

const { initWindowControls } = require("../../../shared/window-controls.js");
initWindowControls({ showMinimize: true, showMaximize: true, showClose: true });