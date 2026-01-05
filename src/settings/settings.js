const { ipcRenderer } = require("electron");
const { updatePositionToggle } = require("./utils/dropdownMenu.js");
const { updateToggleSwitchColor } = require("./utils/toggleSwitch.js");
const { normalizeHex, getColorForPicker } = require("./utils/colorUtils.js");
const SettingsSearch = require("./utils/search");
const {
  applyTheme,
  updateToolbarBackgroundColor,
  updateAccentColor,
} = require("./utils/ThemeManager.js");
const { resetEverything } = require("./utils/ResetManager.js");
const {
  formatShortcut,
  parseShortcut,
  updateResetShortcutVisibility,
} = require("./utils/shortcutUtils.js");

const {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_SHORTCUT,
} = require("../shared/constants.js");

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

ipcRenderer.invoke("get-os-theme").then((theme) => {
  window.osTheme = theme;
  const savedTheme = localStorage.getItem("theme") || "system";
  if (savedTheme === "system") {
    const effectiveTheme = getEffectiveTheme(savedTheme);
    document.body.setAttribute("data-theme", effectiveTheme);
  }
});

const savedTheme = localStorage.getItem("theme") || "system";
const effectiveTheme = getEffectiveTheme(savedTheme);
document.body.setAttribute("data-theme", effectiveTheme);

ipcRenderer.on("os-theme-changed", (event, effectiveTheme) => {
  window.osTheme = effectiveTheme;
  const currentTheme = localStorage.getItem("theme") || "system";
  if (currentTheme === "system") {
    document.body.setAttribute("data-theme", effectiveTheme);
    const savedAccentColor =
      localStorage.getItem("accent-color") || DEFAULT_ACCENT_COLOR;
    updateAccentColor(savedAccentColor);
  }
});

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(savedTheme);
  });
} else {
  applyTheme(savedTheme);
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
    updateAccentColor(e.target.value)
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
        updateAccentColor(result);
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
        updateAccentColor(windowsColor);
      } else {
        await ipcRenderer.invoke(
          "show-error-dialog",
          "Accent Color Error",
          "Unable to get Windows accent colour. This feature is only available on Windows."
        );
      }
    } catch (error) {
      await ipcRenderer.invoke(
        "show-error-dialog",
        "Accent Color Error",
        "Error syncing with Windows accent colour",
        error.message
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
      updateAccentColor(normalizedHex);
    }
  });
  accentColorHex.addEventListener("blur", (e) => {
    const hex = e.target.value.trim();
    if (/^#[0-9A-Fa-f]{3}$/.test(hex) || /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const normalizedHex = normalizeHex(hex);
      updateAccentColor(normalizedHex);
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
        updateAccentColor(normalizedHex);
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

ipcRenderer.on("windows-accent-color-changed", (event, windowsColor) => {
  if (syncWindowsEnabled) {
    updateAccentColor(windowsColor);
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

const layoutDropdown = document.getElementById("layout-dropdown");
const layoutDropdownTrigger = document.getElementById(
  "layout-dropdown-trigger"
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
  "position-dropdown-trigger"
);

if (positionDropdownTrigger) {
  positionDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns(positionDropdown);
    positionDropdown.classList.toggle("open");
  });
}

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

applyLayout(currentLayout);
applyPosition("vertical", currentVerticalPosition);
applyPosition("horizontal", currentHorizontalPosition);

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
    if (shortcutInput) shortcutInput.value = "Ctrl+Shift+D";
    localStorage.setItem("shortcut", DEFAULT_SHORTCUT);
    updateResetShortcutVisibility();
    ipcRenderer.send("update-shortcut", DEFAULT_SHORTCUT);
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

const textSolveCheckbox = document.getElementById("text-solve-enabled");
if (textSolveCheckbox) {
  const textSolveEnabled = localStorage.getItem("text-solve-enabled");
  if (textSolveEnabled !== null) {
    textSolveCheckbox.checked = textSolveEnabled === "true";
  }

  textSolveCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("text-solve-enabled", e.target.checked);
  });
}

const snapToObjectsCheckbox = document.getElementById(
  "snap-to-objects-enabled"
);
if (snapToObjectsCheckbox) {
  const snapToObjects = localStorage.getItem("snap-to-objects-enabled");
  if (snapToObjects !== null) {
    snapToObjectsCheckbox.checked = snapToObjects === "true";
  } else {
    snapToObjectsCheckbox.checked = false;
  }

  snapToObjectsCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("snap-to-objects-enabled", e.target.checked);
    ipcRenderer.send("snap-to-objects-changed", e.target.checked);
  });
}

const showTrayIconCheckbox = document.getElementById("show-tray-icon");
if (showTrayIconCheckbox) {
  const showTrayIcon = localStorage.getItem("show-tray-icon");
  if (showTrayIcon !== null) {
    showTrayIconCheckbox.checked = showTrayIcon === "true";
  } else {
    showTrayIconCheckbox.checked = true;
  }

  showTrayIconCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("show-tray-icon", e.target.checked);
    ipcRenderer.send("toggle-tray-icon", e.target.checked);
  });
}

const toolbarAccentBgCheckbox = document.getElementById(
  "toolbar-accent-bg-enabled"
);
if (toolbarAccentBgCheckbox) {
  const toolbarAccentBg = localStorage.getItem("toolbar-accent-bg");
  if (toolbarAccentBg !== null) {
    toolbarAccentBgCheckbox.checked = toolbarAccentBg === "true";
  }

  toolbarAccentBgCheckbox.addEventListener("change", (e) => {
    localStorage.setItem(
      "toolbar-accent-bg",
      e.target.checked ? "true" : "false"
    );
    updateToolbarBackgroundColor();
  });

  updateToolbarBackgroundColor();
}

const disableToolbarMovingCheckbox = document.getElementById(
  "disable-toolbar-moving"
);
if (disableToolbarMovingCheckbox) {
  const disableToolbarMoving = localStorage.getItem("disable-toolbar-moving");
  disableToolbarMovingCheckbox.checked = disableToolbarMoving !== "false";

  disableToolbarMovingCheckbox.addEventListener("change", (e) => {
    localStorage.setItem(
      "disable-toolbar-moving",
      e.target.checked ? "true" : "false"
    );
    ipcRenderer.send("disable-toolbar-moving-changed", e.target.checked);
  });
}

const standbyInToolbarCheckbox = document.getElementById("standby-in-toolbar");
if (standbyInToolbarCheckbox) {
  const standbyInToolbar = localStorage.getItem("standby-in-toolbar");
  if (standbyInToolbar !== null) {
    standbyInToolbarCheckbox.checked = standbyInToolbar === "true";
  } else {
    standbyInToolbarCheckbox.checked = false;
  }

  standbyInToolbarCheckbox.addEventListener("change", (e) => {
    localStorage.setItem(
      "standby-in-toolbar",
      e.target.checked ? "true" : "false"
    );
    ipcRenderer.send("standby-in-toolbar-changed", e.target.checked);
  });
}

const launchOnStartupCheckbox = document.getElementById("launch-on-startup");
if (launchOnStartupCheckbox) {
  const launchOnStartup = localStorage.getItem("launch-on-startup");
  if (launchOnStartup !== null) {
    launchOnStartupCheckbox.checked = launchOnStartup === "true";
  }

  launchOnStartupCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("launch-on-startup", e.target.checked);
    ipcRenderer.send("set-auto-launch", e.target.checked);
  });
}

const screenshotNotificationCheckbox = document.getElementById(
  "screenshot-notification"
);
if (screenshotNotificationCheckbox) {
  const screenshotNotification = localStorage.getItem(
    "screenshot-notification"
  );
  if (screenshotNotification !== null) {
    screenshotNotificationCheckbox.checked = screenshotNotification === "true";
  } else {
    screenshotNotificationCheckbox.checked = true;
  }

  screenshotNotificationCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("screenshot-notification", e.target.checked);
    ipcRenderer.send("screenshot-notification-changed", e.target.checked);
  });
}

const copySnapshotClipboardCheckbox = document.getElementById(
  "copy-snapshot-clipboard"
);
if (copySnapshotClipboardCheckbox) {
  const copySnapshotClipboard = localStorage.getItem("copy-snapshot-clipboard");
  if (copySnapshotClipboard !== null) {
    copySnapshotClipboardCheckbox.checked = copySnapshotClipboard === "true";
  } else {
    copySnapshotClipboardCheckbox.checked = false;
  }

  copySnapshotClipboardCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("copy-snapshot-clipboard", e.target.checked);
    ipcRenderer.send("copy-snapshot-clipboard-changed", e.target.checked);
  });
}

const autoSaveSnapshotsCheckbox = document.getElementById(
  "auto-save-snapshots"
);
const saveDirectoryWrapper = document.getElementById("save-directory-wrapper");
const saveDirectoryPath = document.getElementById("save-directory-path");
const selectSaveDirectoryBtn = document.getElementById(
  "select-save-directory-btn"
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
            saveDirectoryPath.textContent =
              directoryPath + " (Directory not found)";
            saveDirectoryPath.style.color = "#ff6b6b";
            saveDirectoryPath.style.opacity = "1";
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
            } else {
              saveDirectoryPath.textContent =
                directoryPath + " (Directory not found)";
              saveDirectoryPath.style.color = "#ff6b6b";
              saveDirectoryPath.style.opacity = "1";
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
        ""
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
  "close-directory-warning"
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
        settings.launchOnStartup === true
      );
    }
  }
});

function initToggleLabelClick() {
  document.querySelectorAll(".setting-row").forEach((row) => {
    const labelWrapper = row.querySelector(
      ".setting-label-wrapper[data-toggle-for]"
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

const reduceClutterCheckbox = document.getElementById("reduce-clutter-enabled");
const standbyInToolbarWrapper = document.getElementById(
  "standby-in-toolbar-wrapper"
);

function updateStandbySubSettingVisibility() {
  if (standbyInToolbarWrapper && reduceClutterCheckbox) {
    standbyInToolbarWrapper.style.display = reduceClutterCheckbox.checked
      ? "block"
      : "none";
  }
}

if (reduceClutterCheckbox) {
  const reduceClutter = localStorage.getItem("reduce-clutter");
  if (reduceClutter !== null) {
    reduceClutterCheckbox.checked = reduceClutter === "true";
  } else {
    reduceClutterCheckbox.checked = true;
  }

  updateStandbySubSettingVisibility();

  reduceClutterCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("reduce-clutter", e.target.checked ? "true" : "false");
    ipcRenderer.send("reduce-clutter-changed", e.target.checked);
    updateStandbySubSettingVisibility();
  });
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
};

const dismissedDialogsToggle = document.getElementById(
  "dismissed-dialogs-toggle"
);
const dismissedDialogsContent = document.getElementById(
  "dismissed-dialogs-content"
);
const dismissedDialogsList = document.getElementById("dismissed-dialogs-list");
const dismissedCount = document.getElementById("dismissed-count");

if (dismissedDialogsToggle) {
  dismissedDialogsToggle.addEventListener("click", () => {
    dismissedDialogsToggle.classList.toggle("expanded");
    dismissedDialogsContent.classList.toggle("expanded");
  });
}

async function loadDismissedDialogs() {
  try {
    const dismissedDialogs = await ipcRenderer.invoke("get-dismissed-dialogs");
    const dialogIds = Object.keys(dismissedDialogs || {}).filter(
      (id) => dismissedDialogs[id]
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
      e.message
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
        "These features are experimental and may be unstable or change in future updates. Use at your own risk."
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
        `Bug Report - CYC Annotate v${systemInfo.version}`
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
      error.message
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
  "optimized-rendering"
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
        "optimized-rendering"
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
  "hardware-acceleration"
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
        "hardware-acceleration"
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
      tooltip.classList.remove("visible")
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

const { initWindowControls } = require("../shared/window-controls.js");
initWindowControls({ showMinimize: true, showMaximize: true, showClose: true });