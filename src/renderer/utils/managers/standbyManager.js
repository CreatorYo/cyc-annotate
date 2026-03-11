const { ipcRenderer } = require("electron");

let deps = {},
  active = false,
  savedTool = null,
  boundsInterval = null;

function init(d) {
  deps = d;
  reset();
  setupEvents();
  return {
    isActive: () => active,
    enable,
    disable,
    toggle,
    pause,
    resume,
    shouldBlockAction: () => active,
    updateStandbyButtons,
  };
}

function pause() {
  if (!active) return;
  stopBounds();
  ipcRenderer.send("set-standby-mode", false);
}

function resume() {
  if (!active) return;
  startBounds();
  ipcRenderer.send("set-standby-mode", true);
}

function reset() {
  active = false;
  savedTool = null;
  if (deps.state) {
    deps.state.standbyMode = false;
    deps.state.toolBeforeStandby = null;
  }
  if (deps.canvas) deps.canvas.style.pointerEvents = "auto";
  stopBounds();
  ipcRenderer.send("set-standby-mode", false);
  updateUI(false);
  setDisabled(false);
}

function setupEvents() {
  const click = (e) => {
    e.stopPropagation();
    toggle();
  };
  document.getElementById("standby-btn")?.addEventListener("click", click);
  document
    .getElementById("more-standby-btn")
    ?.addEventListener("click", (e) => {
      click(e);
      document.getElementById("more-menu-dropdown")?.classList.remove("show");
    });

  document.addEventListener(
    "click",
    (e) => {
      if (active && e.target.closest(".standby-disabled")) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true
  );

  ipcRenderer.on("disable-standby-mode", () => disable(false));
}

function enable() {
  if (active) return;
  const { state, canvas, closeAllPopups, finishTextInput, playSound } = deps;

  active = true;
  savedTool = state.tool;
  state.standbyMode = true;
  state.toolBeforeStandby = state.tool;

  document
    .querySelectorAll("[data-tool], .drawing-tool-option")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("pencil-btn")?.classList.remove("active");

  startBounds();
  ipcRenderer.send("set-standby-mode", true);
  if (canvas) canvas.style.pointerEvents = "none";

  updateUI(true);
  setDisabled(true);
  closeAllPopups?.();

  const ti = document.getElementById("text-input");
  if (ti?.style.display === "block") finishTextInput?.();

  playSound?.("standbyOn");
}

function disable(sound = true) {
  if (!active) return;
  const { state, canvas, setTool, playSound } = deps;

  active = false;
  state.standbyMode = false;

  stopBounds();
  ipcRenderer.send("set-standby-mode", false);
  if (canvas) canvas.style.pointerEvents = "auto";

  updateUI(false);
  setDisabled(false);

  if (savedTool && setTool) {
    setTool(savedTool);
    savedTool = null;
    state.toolBeforeStandby = null;
  }

  if (sound) playSound?.("standbyOff");
}

function toggle() {
  ipcRenderer.send('focus-window')
  active ? disable(true) : enable()
}

function sendBounds() {
  const tb = document.getElementById("main-toolbar");
  if (!tb) return;
  let { left: x, top: y, right: r, bottom: b } = tb.getBoundingClientRect();
  const expand = (el, check) => {
    if (!el || !check(el)) return;
    const rect = el.getBoundingClientRect();
    x = Math.min(x, rect.left);
    y = Math.min(y, rect.top);
    r = Math.max(r, rect.right);
    b = Math.max(b, rect.bottom);
  };
  const popups = [
    'more-menu-dropdown',
    'custom-color-popup',
    'drawing-tools-popup',
    'shapes-popup',
    'stroke-popup'
  ]
  popups.forEach(id => {
    const el = document.getElementById(id)
    if (el) expand(el, e => e.classList.contains('show'))
  })
  ipcRenderer.send('update-toolbar-bounds', { 
    x: Math.round(window.screenX + x), 
    y: Math.round(window.screenY + y), 
    width: Math.round(r - x), 
    height: Math.round(b - y) 
  })
}

function startBounds() {
  if (!boundsInterval) {
    sendBounds();
    boundsInterval = setInterval(sendBounds, 100);
  }
}
function stopBounds() {
  if (boundsInterval) {
    clearInterval(boundsInterval);
    boundsInterval = null;
  }
}

function updateUI(on) {
  const sb = document.getElementById("standby-btn");
  const msb = document.getElementById("more-standby-btn");
  const tb = document.getElementById("main-toolbar");
  const method = on ? "add" : "remove";
  const icon = on ? "play_circle" : "pause_circle";

  sb?.classList[method]("active");
  msb?.classList[method]("active");
  tb?.classList[method]("standby-active");

  sb?.querySelector(".material-symbols-outlined")?.replaceChildren(
    document.createTextNode(icon)
  );
  msb
    ?.querySelector(".material-symbols-outlined")
    ?.replaceChildren(document.createTextNode(icon));

  const tooltip = on ? 'Resume Standby' : 'Standby Mode'
  const label = on ? 'Resume' : 'Standby Mode'

  if (sb) {
    sb.setAttribute('data-tooltip', tooltip)
    const tooltipText = sb.querySelector('.custom-tooltip .tooltip-text')
    if (tooltipText) tooltipText.textContent = tooltip
  }

  if (msb) {
    msb.setAttribute('data-tooltip', tooltip)
    const tooltipText = msb.querySelector('.custom-tooltip .tooltip-text')
    if (tooltipText) tooltipText.textContent = tooltip

    const textSpan = msb.querySelector('span:not(.material-symbols-outlined)')
    if (textSpan) textSpan.textContent = label
  }
}

function setDisabled(d) {
  const tb = document.getElementById("main-toolbar");
  if (!tb) return;

  const skip = [
    "standby-btn",
    "close-btn",
    "hide-btn",
    "capture-btn",
    "more-menu-btn",
    "menu-btn",
  ];
  const skipMore = [
    "more-standby-btn",
    "more-hide-btn",
    "more-menu-settings-btn",
  ];

  const apply = (el, excluded) => {
    if (excluded.includes(el.id)) return;
    el.classList[d ? "add" : "remove"]("standby-disabled");
    d
      ? el.setAttribute("data-standby-disabled", "true")
      : el.removeAttribute("data-standby-disabled");
  };

  tb.querySelectorAll(".toolbar-btn").forEach((b) => apply(b, skip));
  tb.querySelectorAll(".color-swatch").forEach((s) => apply(s, []));
  document
    .querySelectorAll(".more-menu-item")
    .forEach((i) => apply(i, skipMore));
}

function updateStandbyButtons(inToolbar) {
  const sb = document.getElementById("standby-btn");
  const msb = document.getElementById("more-standby-btn");
  const clutter = localStorage.getItem("reduce-clutter") !== "false";

  if (clutter) {
    if (sb) sb.style.display = inToolbar ? "flex" : "none";
    if (msb) msb.style.display = inToolbar ? "none" : "flex";
  } else {
    if (sb) sb.style.display = "flex";
    if (msb) msb.style.display = "none";
  }
}

module.exports = { initStandbyManager: init };
