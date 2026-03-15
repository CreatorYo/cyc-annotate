class WidgetComponent {
  static init() {
    this.injectToolbar()
    this.injectCommandMenu()
    this.injectFeaturesShelf()
    this.injectClockWidget()
    this.injectTimerWidget()
    this.injectTimesUpOverlay()
    this.injectTextTool()
    this.injectStickyNoteTool()
  }

  static injectToolbar() {
    if (document.getElementById('main-toolbar')) return
    const html = `
    <div id="main-toolbar" class="toolbar-vertical draggable">
      <div id="toolbar-drag-handle" class="toolbar-drag-handle" style="display: none;">
        <span class="material-symbols-outlined">drag_indicator</span>
      </div>
      <div class="toolbar-group">
        <div class="drawing-tools-wrapper">
          <button id="pencil-btn" class="toolbar-btn active" data-tool="pencil" data-tooltip="Pencil" data-shortcut="P">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <div id="drawing-tools-popup" class="drawing-tools-popup">
            <button class="drawing-tool-option" data-tool="select" data-tooltip="Select" data-shortcut="V">
              <span class="material-symbols-outlined">arrow_selector_tool</span>
              <span>Select</span>
            </button>
            <button class="drawing-tool-option" data-tool="pencil" data-tooltip="Pencil" data-shortcut="P">
              <span class="material-symbols-outlined">edit</span>
              <span>Pencil</span>
            </button>
            <button class="drawing-tool-option" data-tool="marker" data-tooltip="Marker" data-shortcut="B">
              <span class="material-symbols-outlined">brush</span>
              <span>Marker</span>
            </button>
            <button class="drawing-tool-option" data-tool="highlighter" data-tooltip="Highlighter" data-shortcut="H">
              <span class="material-symbols-outlined">ink_highlighter</span>
              <span>Highlighter</span>
            </button>
          </div>
        </div>
        <button id="text-btn" class="toolbar-btn" data-tool="text" data-tooltip="Text" data-shortcut="T">
          <span class="material-symbols-outlined">text_fields</span>
        </button>
        <button id="sticky-note-btn" class="toolbar-btn" data-tool="sticky-note" data-tooltip="Sticky Note"
          data-shortcut="N">
          <span class="material-symbols-outlined">sticky_note_2</span>
        </button>
        <div class="shapes-wrapper">
          <button id="shapes-btn" class="toolbar-btn" data-tool="shapes" data-tooltip="Shapes" data-shortcut="S">
            <span class="material-symbols-outlined">shapes</span>
          </button>
          <div id="shapes-popup" class="shapes-popup">
            <button class="shape-option" data-shape="rectangle" data-tooltip="Rectangle" data-shortcut="R">
              <span class="material-symbols-outlined">rectangle</span>
            </button>
            <button class="shape-option" data-shape="circle" data-tooltip="Circle" data-shortcut="C">
              <span class="material-symbols-outlined">radio_button_unchecked</span>
            </button>
            <button class="shape-option" data-shape="line" data-tooltip="Line" data-shortcut="L">
              <span class="material-symbols-outlined">remove</span>
            </button>
            <button class="shape-option" data-shape="arrow" data-tooltip="Arrow" data-shortcut="A">
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
            <div class="shapes-popup-separator"></div>
            <button id="shape-fill-toggle" class="shape-option" data-tooltip="Enable Fill" data-shortcut="F">
              <span class="material-symbols-outlined">format_color_fill</span>
            </button>
          </div>
        </div>
        <button id="eraser-btn" class="toolbar-btn" data-tool="eraser" data-tooltip="Eraser" data-shortcut="E">
          <span class="material-symbols-outlined">ink_eraser</span>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <div class="stroke-thickness-wrapper">
        <button id="stroke-thickness-btn" class="toolbar-btn" data-tooltip="Stroke Thickness" data-shortcut="1-4">
          <span class="material-symbols-outlined">line_weight</span>
        </button>
        <div id="stroke-popup" class="stroke-popup">
          <button class="stroke-option" data-size="2" data-tooltip="Small">
            <div class="stroke-dot" style="width: 4px; height: 4px;"></div>
          </button>
          <button class="stroke-option" data-size="4" data-tooltip="Medium">
            <div class="stroke-dot" style="width: 8px; height: 8px;"></div>
          </button>
          <button class="stroke-option" data-size="8" data-tooltip="Large">
            <div class="stroke-dot" style="width: 12px; height: 12px;"></div>
          </button>
          <button class="stroke-option" data-size="16" data-tooltip="Extra Large">
            <div class="stroke-dot" style="width: 16px; height: 16px;"></div>
          </button>
        </div>
      </div>

      <div class="toolbar-separator"></div>

      <div class="color-palette">
        <button class="color-swatch" data-color="#ef4444" style="background-color: #ef4444;" data-tooltip="Red"
          data-shortcut="Q"></button>
        <button class="color-swatch" data-color="#3b82f6" style="background-color: #3b82f6;" data-tooltip="Blue"
          data-shortcut="W"></button>
        <button class="color-swatch" data-color="#10b981" style="background-color: #10b981;" data-tooltip="Green"
          data-shortcut="G"></button>
        <div class="custom-color-wrapper">
          <button id="custom-color-btn" class="color-swatch custom-color active" data-tooltip="Custom Color">
            <span class="material-symbols-outlined">palette</span>
          </button>
          <div id="custom-color-popup" class="custom-color-popup">
            <div class="color-section">
              <div class="color-section-label">Warm</div>
              <div class="color-grid">
                <button class="color-option" data-color="#ff0000" style="background-color: #ff0000;" title="Red"></button>
                <button class="color-option" data-color="#ff4500" style="background-color: #ff4500;"
                  title="Orange Red"></button>
                <button class="color-option" data-color="#ff8c00" style="background-color: #ff8c00;"
                  title="Dark Orange"></button>
                <button class="color-option" data-color="#ffa500" style="background-color: #ffa500;"
                  title="Orange"></button>
                <button class="color-option" data-color="#ffd700" style="background-color: #ffd700;"
                  title="Gold"></button>
                <button class="color-option" data-color="#ffff00" style="background-color: #ffff00;"
                  title="Yellow"></button>
                <button class="color-option" data-color="#ff6347" style="background-color: #ff6347;"
                  title="Tomato"></button>
                <button class="color-option" data-color="#ff7f50" style="background-color: #ff7f50;"
                  title="Coral"></button>
              </div>
            </div>
            <div class="color-section">
              <div class="color-section-label">Cool</div>
              <div class="color-grid">
                <button class="color-option" data-color="#0000ff" style="background-color: #0000ff;"
                  title="Blue"></button>
                <button class="color-option" data-color="#4169e1" style="background-color: #4169e1;"
                  title="Royal Blue"></button>
                <button class="color-option" data-color="#00bfff" style="background-color: #00bfff;"
                  title="Deep Sky Blue"></button>
                <button class="color-option" data-color="#00ffff" style="background-color: #00ffff;"
                  title="Cyan"></button>
                <button class="color-option" data-color="#008000" style="background-color: #008000;"
                  title="Green"></button>
                <button class="color-option" data-color="#00ff00" style="background-color: #00ff00;"
                  title="Lime"></button>
                <button class="color-option" data-color="#20b2aa" style="background-color: #20b2aa;"
                  title="Light Sea Green"></button>
                <button class="color-option" data-color="#48d1cc" style="background-color: #48d1cc;"
                  title="Medium Turquoise"></button>
              </div>
            </div>
            <div class="color-section">
              <div class="color-section-label">Pastel</div>
              <div class="color-grid">
                <button class="color-option" data-color="#ffb6c1" style="background-color: #ffb6c1;"
                  title="Light Pink"></button>
                <button class="color-option" data-color="#ffdab9" style="background-color: #ffdab9;"
                  title="Peach Puff"></button>
                <button class="color-option" data-color="#fffacd" style="background-color: #fffacd;"
                  title="Lemon Chiffon"></button>
                <button class="color-option" data-color="#e0ffff" style="background-color: #e0ffff;"
                  title="Light Cyan"></button>
                <button class="color-option" data-color="#dda0dd" style="background-color: #dda0dd;"
                  title="Plum"></button>
                <button class="color-option" data-color="#f0e68c" style="background-color: #f0e68c;"
                  title="Khaki"></button>
                <button class="color-option" data-color="#98fb98" style="background-color: #98fb98;"
                  title="Pale Green"></button>
                <button class="color-option" data-color="#afeeee" style="background-color: #afeeee;"
                  title="Pale Turquoise"></button>
              </div>
            </div>
            <div class="color-section">
              <div class="color-section-label">Dark</div>
              <div class="color-grid">
                <button class="color-option" data-color="#8b0000" style="background-color: #8b0000;"
                  title="Dark Red"></button>
                <button class="color-option" data-color="#ff4500" style="background-color: #ff4500;"
                  title="Dark Orange"></button>
                <button class="color-option" data-color="#006400" style="background-color: #006400;"
                  title="Dark Green"></button>
                <button class="color-option" data-color="#00008b" style="background-color: #00008b;"
                  title="Dark Blue"></button>
                <button class="color-option" data-color="#4b0082" style="background-color: #4b0082;"
                  title="Indigo"></button>
                <button class="color-option" data-color="#800080" style="background-color: #800080;"
                  title="Purple"></button>
                <button class="color-option" data-color="#8b008b" style="background-color: #8b008b;"
                  title="Dark Magenta"></button>
                <button class="color-option" data-color="#2f4f4f" style="background-color: #2f4f4f;"
                  title="Dark Slate Gray"></button>
              </div>
            </div>
            <div class="color-section">
              <div class="color-section-label">Neutral</div>
              <div class="color-grid">
                <button class="color-option" data-color="#000000" style="background-color: #000000;"
                  title="Black"></button>
                <button class="color-option" data-color="#696969" style="background-color: #696969;"
                  title="Dim Gray"></button>
                <button class="color-option" data-color="#808080" style="background-color: #808080;"
                  title="Gray"></button>
                <button class="color-option" data-color="#a9a9a9" style="background-color: #a9a9a9;"
                  title="Dark Gray"></button>
                <button class="color-option" data-color="#c0c0c0" style="background-color: #c0c0c0;"
                  title="Silver"></button>
                <button class="color-option" data-color="#d3d3d3" style="background-color: #d3d3d3;"
                  title="Light Gray"></button>
                <button class="color-option" data-color="#8b4513" style="background-color: #8b4513;"
                  title="Saddle Brown"></button>
                <button class="color-option" data-color="#a0522d" style="background-color: #a0522d;"
                  title="Sienna"></button>
              </div>
            </div>
            <div class="color-section">
              <div class="color-section-label">Vibrant</div>
              <div class="color-grid">
                <button class="color-option" data-color="#ff1493" style="background-color: #ff1493;"
                  title="Deep Pink"></button>
                <button class="color-option" data-color="#ff00ff" style="background-color: #ff00ff;"
                  title="Magenta"></button>
                <button class="color-option" data-color="#9400d3" style="background-color: #9400d3;"
                  title="Violet"></button>
                <button class="color-option" data-color="#8a2be2" style="background-color: #8a2be2;"
                  title="Blue Violet"></button>
                <button class="color-option" data-color="#00ff7f" style="background-color: #00ff7f;"
                  title="Spring Green"></button>
                <button class="color-option" data-color="#00fa9a" style="background-color: #00fa9a;"
                  title="Medium Spring Green"></button>
                <button class="color-option" data-color="#ff69b4" style="background-color: #ff69b4;"
                  title="Hot Pink"></button>
                <button class="color-option" data-color="#ff1493" style="background-color: #ff1493;"
                  title="Deep Pink"></button>
              </div>
            </div>
            <div class="color-picker-option">
              <button id="open-color-picker-btn" class="open-picker-btn">
                <span class="material-symbols-outlined">colorize</span>
                <span>Pick Custom Color</span>
              </button>
            </div>
          </div>

          <div id="custom-color-picker" class="custom-color-picker-popup">
            <div id="picker-drag-handle" class="picker-drag-handle">
              <div class="drag-bar"></div>
            </div>
            <div class="custom-picker-content">
              <div class="picker-main-area">
                <div class="sv-picker-container">
                  <div id="sv-picker" class="sv-picker"></div>
                  <div id="sv-cursor" class="picker-cursor"></div>
                </div>
                <div class="hue-picker-container">
                  <div id="hue-picker" class="hue-picker"></div>
                  <div id="hue-cursor" class="hue-cursor"></div>
                </div>
              </div>
              <div class="picker-footer">
                <div class="input-group">
                  <span class="input-label">HEX</span>
                  <div class="hex-input-wrapper-inner">
                    <input type="text" id="hex-input" class="hex-input" spellcheck="false" placeholder="#000000">
                    <button id="eyedropper-btn" class="eyedropper-btn">
                      <span class="material-symbols-outlined">colorize</span>
                    </button>
                  </div>
                </div>
                <div class="preview-group">
                  <div id="color-preview" class="color-preview"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="toolbar-separator"></div>

      <div class="toolbar-group">
        <button id="undo-btn" class="toolbar-btn" data-tooltip="Undo" data-shortcut="Ctrl+Z">
          <span class="material-symbols-outlined">undo</span>
        </button>
        <button id="redo-btn" class="toolbar-btn" data-tooltip="Redo" data-shortcut="Ctrl+Shift+Z">
          <span class="material-symbols-outlined">redo</span>
        </button>
        <button id="clear-btn" class="toolbar-btn clear-btn" data-tooltip="Clear All" data-shortcut="Shift+Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <div class="toolbar-group">
        <div class="more-menu-wrapper">
          <button id="more-menu-btn" class="toolbar-btn" data-tooltip="More Options" style="display: none;">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
          <div id="more-menu-dropdown" class="more-menu-dropdown">
            <button id="more-undo-btn" class="more-menu-item" data-tooltip="Undo" data-shortcut="Ctrl+Z">
              <span class="material-symbols-outlined">undo</span>
              <span>Undo</span>
            </button>
            <button id="more-redo-btn" class="more-menu-item" data-tooltip="Redo" data-shortcut="Ctrl+Shift+Z">
              <span class="material-symbols-outlined">redo</span>
              <span>Redo</span>
            </button>
            <button id="more-sticky-note-btn" class="more-menu-item" data-tooltip="Sticky Note" data-shortcut="N">
              <span class="material-symbols-outlined">sticky_note_2</span>
              <span>Sticky Note</span>
            </button>
            <div class="more-menu-separator"></div>
            <button id="more-hide-btn" class="more-menu-item" data-tooltip="Toggle Visibility" data-shortcut="Ctrl+H">
              <span class="material-symbols-outlined">visibility_off</span>
              <span>Toggle Visibility</span>
            </button>
            <button id="more-standby-btn" class="more-menu-item" data-tooltip="Standby Mode" data-shortcut="Space">
              <span class="material-symbols-outlined">pause_circle</span>
              <span>Standby Mode</span>
            </button>
            <button id="open-features-btn" class="more-menu-item">
              <span class="material-symbols-outlined">grid_view</span>
              <span>More...</span>
            </button>
            <button id="more-menu-settings-btn" class="more-menu-item" data-tooltip="Settings" data-shortcut="Ctrl+,">
              <span class="material-symbols-outlined" style="position: relative;">
                settings
                <span id="more-settings-badge" class="settings-badge" style="display: none;">
                  <span class="material-symbols-outlined">warning</span>
                </span>
              </span>
              <span>Settings</span>
            </button>
          </div>
        </div>
        <button id="hide-btn" class="toolbar-btn" data-tooltip="Toggle Visibility" data-shortcut="Ctrl+H">
          <span class="material-symbols-outlined">visibility_off</span>
        </button>
        <button id="standby-btn" class="toolbar-btn" data-tooltip="Standby Mode" data-shortcut="Space">
          <span class="material-symbols-outlined">pause_circle</span>
        </button>
        <button id="capture-btn" class="toolbar-btn" data-tooltip="Capture" data-shortcut="Shift+C">
          <span class="material-symbols-outlined">camera_alt</span>
        </button>
        <button id="menu-btn" class="toolbar-btn" data-tooltip="Settings" data-shortcut="Ctrl+,">
          <span class="material-symbols-outlined">settings</span>
          <span id="settings-badge" class="settings-badge" style="display: none;">
            <span class="material-symbols-outlined">warning</span>
          </span>
        </button>
        <button id="close-btn" class="toolbar-btn" data-tooltip="Close" data-shortcut="Esc">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
    `
    document.body.insertAdjacentHTML('afterbegin', html)
  }

  static injectCommandMenu() {
    if (document.getElementById('command-menu-overlay')) return
    const html = `
      <div id="command-menu-overlay" class="command-menu-overlay" style="display: none;">
        <div class="command-menu-container">
          <div class="command-menu-input-wrapper">
            <span class="material-symbols-outlined command-menu-icon">search</span>
            <input type="text" id="command-menu-input" class="command-menu-input" placeholder="Search tools..."
              autocomplete="off">
            <button id="close-command-menu" class="close-command-menu-btn" title="Close (Esc)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div id="command-menu-results" class="command-menu-results" style="display: none;"></div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
  }

  static injectFeaturesShelf() {
    if (document.getElementById('features-shelf-overlay')) return
    const html = `
      <div id="features-shelf-overlay" class="features-shelf-overlay" style="display: none;">
        <div class="features-shelf-container">
          <div class="features-shelf-content">
            <div class="features-shelf-grid">
              <div class="widget-card widget-medium" id="feature-clock">
                <div class="widget-add-btn">+</div>
                <div class="widget-preview widget-clock-preview">
                  <div class="clock-face">
                    <div class="clock-hand clock-hour"></div>
                    <div class="clock-hand clock-minute"></div>
                    <div class="clock-hand clock-second"></div>
                    <div class="clock-center"></div>
                  </div>
                </div>
                <span class="widget-label">Clock</span>
              </div>
              <div class="widget-card widget-small" id="feature-whiteboard">
                <div class="widget-add-btn">+</div>
                <div class="widget-preview">
                  <span class="material-symbols-outlined widget-icon">edit_square</span>
                </div>
                <span class="widget-label">Whiteboard</span>
              </div>
              <div class="widget-card widget-small" id="feature-timer">
                <div class="widget-add-btn">+</div>
                <div class="widget-preview">
                  <span class="material-symbols-outlined widget-icon">timer</span>
                </div>
                <span class="widget-label">Timer</span>
              </div>
            </div>
          </div>
          <div class="features-shelf-footer">
            <button id="features-shelf-done" class="features-shelf-done-btn">Done</button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
  }

  static injectClockWidget() {
    if (document.getElementById('clock-widget')) return
    const html = `
      <div id="clock-widget" class="clock-widget" style="display: none;">
        <div class="clock-widget-header">
          <span class="clock-widget-drag-handle"></span>
        </div>
        <div class="clock-widget-controls">
          <button id="clock-settings-btn" class="clock-control-btn" title="Settings">
            <span class="material-symbols-outlined">settings</span>
          </button>
          <button id="clock-close-btn" class="clock-control-btn clock-close" title="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="clock-widget-display" id="clock-digital-display">
          <span id="clock-hours">12</span>
          <span class="clock-colon">:</span>
          <span id="clock-minutes">00</span>
        </div>
        <div class="clock-widget-analog" id="clock-analog-display" style="display: none;">
          <div class="analog-clock-face">
            <div class="analog-clock-tick" style="--i:0"></div>
            <div class="analog-clock-tick" style="--i:1"></div>
            <div class="analog-clock-tick" style="--i:2"></div>
            <div class="analog-clock-tick" style="--i:3"></div>
            <div class="analog-clock-tick" style="--i:4"></div>
            <div class="analog-clock-tick" style="--i:5"></div>
            <div class="analog-clock-tick" style="--i:6"></div>
            <div class="analog-clock-tick" style="--i:7"></div>
            <div class="analog-clock-tick" style="--i:8"></div>
            <div class="analog-clock-tick" style="--i:9"></div>
            <div class="analog-clock-tick" style="--i:10"></div>
            <div class="analog-clock-tick" style="--i:11"></div>
            <div class="analog-clock-hand analog-hour" id="analog-hour-hand"></div>
            <div class="analog-clock-hand analog-minute" id="analog-minute-hand"></div>
            <div class="analog-clock-hand analog-second" id="analog-second-hand"></div>
            <div class="analog-clock-center"></div>
            <div class="analog-clock-info">
              <span class="analog-clock-day" id="analog-clock-day">SAT</span>
              <span class="analog-clock-dot"></span>
              <span class="analog-clock-time" id="analog-clock-time">12:00</span>
              <span class="analog-clock-period" id="analog-clock-period">PM</span>
            </div>
          </div>
        </div>
        <div id="clock-settings-popup" class="clock-settings-popup">
          <div class="clock-settings-row">
            <div class="clock-style-toggle">
              <button class="clock-style-btn active" data-style="digital">
                <span class="material-symbols-outlined">schedule</span>
              </button>
              <button class="clock-style-btn" data-style="analog">
                <span class="material-symbols-outlined">nest_clock_farsight_analog</span>
              </button>
            </div>
            <div class="clock-settings-sep"></div>
            <div id="clock-timezone-dropdown" class="clock-tz-container"></div>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
  }

  static injectTimerWidget() {
    if (document.getElementById('timer-widget')) return
    const html = `
      <div id="timer-widget" class="timer-widget-circular" style="display: none;">
        <div class="timer-circle">
          <svg class="timer-progress-ring" viewBox="0 0 308 308">
            <circle class="timer-progress-bg" cx="154" cy="154" r="150"></circle>
            <circle id="timer-progress-bar" class="timer-progress-bar" cx="154" cy="154" r="150"></circle>
          </svg>
          <div class="timer-inner">
            <div class="timer-time-section">
              <button class="timer-adjust-btn" data-action="hours-up"><span class="material-symbols-outlined">expand_less</span></button>
              <input type="text" id="timer-hours" class="timer-input" value="00" maxlength="2">
              <button class="timer-adjust-btn" data-action="hours-down"><span class="material-symbols-outlined">expand_more</span></button>
            </div>
            <span class="timer-separator">:</span>
            <div class="timer-time-section">
              <button class="timer-adjust-btn" data-action="minutes-up"><span class="material-symbols-outlined">expand_less</span></button>
              <input type="text" id="timer-minutes" class="timer-input" value="05" maxlength="2">
              <button class="timer-adjust-btn" data-action="minutes-down"><span class="material-symbols-outlined">expand_more</span></button>
            </div>
            <span class="timer-separator">:</span>
            <div class="timer-time-section">
              <button class="timer-adjust-btn" data-action="seconds-up"><span class="material-symbols-outlined">expand_less</span></button>
              <input type="text" id="timer-seconds" class="timer-input" value="00" maxlength="2">
              <button class="timer-adjust-btn" data-action="seconds-down"><span class="material-symbols-outlined">expand_more</span></button>
            </div>
          </div>
          <button id="timer-play" class="timer-play-btn">
            <span class="material-symbols-outlined">play_arrow</span>
          </button>
        </div>
        <div class="timer-toolbar">
          <button class="timer-toolbar-btn" id="timer-settings-btn" title="Settings">
            <span class="material-symbols-outlined">settings</span>
          </button>
          <button class="timer-toolbar-btn" id="timer-reset" title="Reset">
            <span class="material-symbols-outlined">refresh</span>
          </button>
          <button class="timer-toolbar-btn timer-close-btn" id="timer-close" title="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div id="timer-settings-popup" class="timer-settings-popup">
          <div class="timer-settings-row">
            <label class="timer-settings-label">When time is up:</label>
            <div class="timer-action-toggle">
              <button class="timer-end-action-btn active" data-action="overlay" title="Show Overlay">
                <span class="material-symbols-outlined">celebration</span>
              </button>
              <button class="timer-end-action-btn" data-action="sound" title="Sound Only">
                <span class="material-symbols-outlined">volume_up</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
  }

  static injectTimesUpOverlay() {
    if (document.getElementById('times-up-overlay')) return
    const html = `
      <div id="times-up-overlay" class="times-up-overlay" style="display: none;">
        <canvas id="confetti-canvas"></canvas>
        <div class="times-up-content">
          <span class="times-up-text">Time's up!</span>
          <button id="times-up-dismiss" class="times-up-btn">OK</button>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
  }

  static injectTextTool() {
    if (document.getElementById('text-input')) return
    const html = `<div id="text-input" class="text-input" contenteditable="true" style="display: none;"></div>`
    document.body.insertAdjacentHTML('beforeend', html)
  }

  static injectStickyNoteTool() {
    if (document.getElementById('sticky-note-input-container')) return
    const html = `
      <div id="sticky-note-input-container" class="sticky-note-input-container" style="display: none;">
        <div class="sticky-note-header">
          <div class="sticky-note-menu-wrapper">
            <button id="sticky-color-menu-btn" class="sticky-menu-btn">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
            <div id="sticky-color-palette" class="sticky-color-palette-horizontal">
              <button class="sticky-color-btn active theme-color-dynamic" title="Theme Colour"></button>
              <button class="sticky-color-btn" data-color="#fff9c4" style="background-color: #fff9c4;"
                title="Yellow"></button>
              <button class="sticky-color-btn" data-color="#c8e6c9" style="background-color: #c8e6c9;"
                title="Green"></button>
              <button class="sticky-color-btn" data-color="#bbdefb" style="background-color: #bbdefb;"
                title="Blue"></button>
              <button class="sticky-color-btn" data-color="#e1bee7" style="background-color: #e1bee7;"
                title="Purple"></button>
              <button class="sticky-color-btn" data-color="#ffe0b2" style="background-color: #ffe0b2;"
                title="Orange"></button>
            </div>
          </div>
          <button id="close-sticky-btn" class="sticky-close-btn">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div id="sticky-note-input" class="sticky-note-input" contenteditable="true"></div>
        <div class="sticky-note-footer">
          <div class="sticky-formatting-toolbar">
            <button class="sticky-format-btn" data-format="bold" title="Bold">
              <span class="material-symbols-outlined">format_bold</span>
            </button>
            <button class="sticky-format-btn" data-format="italic" title="Italic">
              <span class="material-symbols-outlined">format_italic</span>
            </button>
            <button class="sticky-format-btn" data-format="underline" title="Underline">
              <span class="material-symbols-outlined">format_underlined</span>
            </button>
            <div class="sticky-format-separator"></div>
            <button class="sticky-format-btn" data-format="strikethrough" title="Strikethrough">
              <span class="material-symbols-outlined">strikethrough_s</span>
            </button>
            <div class="sticky-format-separator"></div>
            <button class="sticky-format-btn" data-format="bullet" title="Bullet List">
              <span class="material-symbols-outlined">format_list_bulleted</span>
            </button>
            <div class="sticky-format-separator"></div>
            <div class="sticky-font-wrapper">
              <button id="sticky-font-menu-btn" class="sticky-format-btn" title="Font Family">
                <span class="material-symbols-outlined">text_fields</span>
              </button>
              <div id="sticky-font-dropdown" class="sticky-font-dropdown">
                <button class="sticky-font-option active" data-font="comic-sans" style="font-family: 'Comic Sans MS', cursive, sans-serif;">Comic Sans</button>
                <button class="sticky-font-option" data-font="monospace" style="font-family: 'Courier New', monospace;">Monospace</button>
                <button class="sticky-font-option" data-font="opendyslexic" style="font-family: 'OpenDyslexicRegular', sans-serif;">OpenDyslexic</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', html)
  }
}

module.exports = WidgetComponent
