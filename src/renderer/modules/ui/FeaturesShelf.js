const { ipcRenderer } = require('electron')
const { state } = require('../core/AppState.js')

let _playSound = null
let _setTool = null

function init(deps) {
  _playSound = deps.playSound
  _setTool = deps.setTool
  initFeaturesShelf()
}

function initFeaturesShelf() {
  const openFeaturesBtn = document.getElementById('open-features-btn')
  const featuresShelfOverlay = document.getElementById('features-shelf-overlay')
  const closeFeaturesShelf = document.getElementById('close-features-shelf')
  const featuresShelfDone = document.getElementById('features-shelf-done')
  const featureWhiteboard = document.getElementById('feature-whiteboard')
  const moreMenuDropdown = document.getElementById('more-menu-dropdown')

  if (!openFeaturesBtn || !featuresShelfOverlay) return

  const toggleShelf = (show) => {
    if (show) {
      featuresShelfOverlay.style.display = 'flex'
      setTimeout(() => featuresShelfOverlay.classList.add('show'), 10)
      _playSound('pop')
    } else {
      featuresShelfOverlay.classList.remove('show')
      setTimeout(() => featuresShelfOverlay.style.display = 'none', 400)
    }
  }

  openFeaturesBtn.addEventListener('click', () => {
    if (moreMenuDropdown) moreMenuDropdown.classList.remove('show')
    toggleShelf(true)
  })

  closeFeaturesShelf?.addEventListener('click', () => toggleShelf(false))
  featuresShelfDone?.addEventListener('click', () => toggleShelf(false))

  featuresShelfOverlay.addEventListener('click', (e) => {
    if (e.target === featuresShelfOverlay) toggleShelf(false)
  })

  featureWhiteboard?.addEventListener('click', () => {
    ipcRenderer.send('open-whiteboard')
    toggleShelf(false)
  })

  document.getElementById('feature-timer')?.addEventListener('click', () => {
    state.timerEnabled = !state.timerEnabled
    const card = document.querySelector('#feature-timer')
    card?.classList.toggle('active', state.timerEnabled)
    const timerWidget = document.getElementById('timer-widget')
    if (timerWidget) {
      timerWidget.style.display = state.timerEnabled ? 'flex' : 'none'
    }
    toggleShelf(false)
    _playSound('pop')
  })

  document.getElementById('feature-clock')?.addEventListener('click', () => {
    state.clockEnabled = !state.clockEnabled
    const card = document.querySelector('#feature-clock')
    card?.classList.toggle('active', state.clockEnabled)
    const clockWidget = document.getElementById('clock-widget')
    if (clockWidget) {
      clockWidget.style.display = state.clockEnabled ? 'block' : 'none'
    }
    toggleShelf(false)
    _playSound('pop')
  })

  initClockWidget()
  initTimerWidget()
  initWidgetDragging()
}

function initClockWidget() {
  const Dropdown = require('../components/Dropdown.js')
  
  let clockStyle = localStorage.getItem('clock-style') || 'digital'
  let clockTimezone = localStorage.getItem('clock-timezone') || 'local'
  
  const clockSettingsBtn = document.getElementById('clock-settings-btn')
  const clockCloseBtn = document.getElementById('clock-close-btn')
  const clockSettingsPopup = document.getElementById('clock-settings-popup')
  const clockDigitalDisplay = document.getElementById('clock-digital-display')
  const clockAnalogDisplay = document.getElementById('clock-analog-display')
  const clockStyleBtns = document.querySelectorAll('.clock-style-btn')
  const clockTimezoneContainer = document.getElementById('clock-timezone-dropdown')

  const generateTimezoneOptions = () => {
    const common = [
      { value: 'local', label: 'Local Time', icon: 'home' },
      { value: 'UTC', label: 'UTC', icon: 'public' }
    ];
    
    const allTimezones = Intl.supportedValuesOf('timeZone');
    
    const formattedTimezones = allTimezones.map(tz => {
      const parts = tz.split('/');
      const city = (parts[parts.length - 1] || tz).replace(/_/g, ' ');
      
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'short'
        });
        const tzName = formatter.formatToParts(new Date()).find(p => p.type === 'timeZoneName').value;
        return { value: tz, label: `${city} (${tzName})` };
      } catch (e) {
        return { value: tz, label: city };
      }
    });

    formattedTimezones.sort((a, b) => a.label.localeCompare(b.label));
    
    return [...common, ...formattedTimezones];
  };

  const timezoneOptions = generateTimezoneOptions();

  let clockTimezoneDropdown = null
  if (clockTimezoneContainer) {
    clockTimezoneDropdown = new Dropdown({
      id: 'clock-tz-dropdown',
      options: timezoneOptions,
      defaultValue: clockTimezone,
      icon: 'schedule',
      searchable: true,
      searchPlaceholder: 'Search timezones...',
      onChange: (value) => {
        clockTimezone = value
        localStorage.setItem('clock-timezone', value)
        updateClockWidget()
        _playSound('switch')
      }
    })
    clockTimezoneDropdown.render(clockTimezoneContainer)
  }

  function applyClockStyle(style) {
    clockStyle = style
    localStorage.setItem('clock-style', style)
    
    if (style === 'digital') {
      if (clockDigitalDisplay) clockDigitalDisplay.style.display = 'flex'
      if (clockAnalogDisplay) clockAnalogDisplay.style.display = 'none'
    } else {
      if (clockDigitalDisplay) clockDigitalDisplay.style.display = 'none'
      if (clockAnalogDisplay) clockAnalogDisplay.style.display = 'flex'
    }
    
    clockStyleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style)
    })
  }

  clockStyleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyClockStyle(btn.dataset.style)
      _playSound('switch')
    })
  })

  if (clockSettingsBtn) {
    clockSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      
      if (!clockSettingsPopup?.classList.contains('show')) {
        const widget = document.getElementById('clock-widget')
        if (widget) {
          const rect = widget.getBoundingClientRect()
          const popupHeight = 60
          const dropdownHeight = 220
          const totalHeight = popupHeight + dropdownHeight
          
          const spaceBelow = window.innerHeight - rect.bottom
          const spaceAbove = rect.top
          
          if (spaceBelow < totalHeight && spaceAbove > spaceBelow) {
            clockSettingsPopup.classList.add('flip')
            const dropdown = clockSettingsPopup.querySelector('.app-dropdown')
            if (dropdown) dropdown.classList.add('flip')
          } else {
            clockSettingsPopup.classList.remove('flip')
            const dropdown = clockSettingsPopup.querySelector('.app-dropdown')
            if (dropdown) dropdown.classList.remove('flip')
          }
        }
      }
      
      clockSettingsPopup?.classList.toggle('show')
    })
  }

  if (clockCloseBtn) {
    clockCloseBtn.addEventListener('click', () => {
      state.clockEnabled = false
      const clockWidget = document.getElementById('clock-widget')
      if (clockWidget) clockWidget.style.display = 'none'
      const card = document.querySelector('#feature-clock')
      card?.classList.remove('active')
      _playSound('pop')
    })
  }

  document.addEventListener('click', (e) => {
    if (clockSettingsPopup?.classList.contains('show')) {
      if (!clockSettingsPopup.contains(e.target) && e.target !== clockSettingsBtn) {
        clockSettingsPopup.classList.remove('show')
      }
    }
  })

  applyClockStyle(clockStyle)

  function updateClockWidget() {
    let now = new Date()
    
    if (clockTimezone !== 'local') {
      try {
        const options = { timeZone: clockTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        const formatter = new Intl.DateTimeFormat('en-GB', options)
        const parts = formatter.formatToParts(now)
        const hours = parseInt(parts.find(p => p.type === 'hour').value)
        const minutes = parseInt(parts.find(p => p.type === 'minute').value)
        const seconds = parseInt(parts.find(p => p.type === 'second').value)
        
        const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: clockTimezone, weekday: 'short' })
        const dayOfWeek = dayFormatter.format(now).toUpperCase()
        
        const hoursEl = document.getElementById('clock-hours')
        const minutesEl = document.getElementById('clock-minutes')
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0')
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0')
        
        updateAnalogHands(hours, minutes, seconds)
        updateAnalogInfo(hours, minutes, dayOfWeek)
      } catch (e) {
        updateClockLocal(now)
      }
    } else {
      updateClockLocal(now)
    }
  }

  function updateClockLocal(now) {
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const seconds = now.getSeconds()
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayOfWeek = days[now.getDay()]
    
    const hoursEl = document.getElementById('clock-hours')
    const minutesEl = document.getElementById('clock-minutes')
    if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0')
    if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0')
    
    updateAnalogHands(hours, minutes, seconds)
    updateAnalogInfo(hours, minutes, dayOfWeek)
  }

  function updateAnalogInfo(hours, minutes, dayOfWeek) {
    const dayEl = document.getElementById('analog-clock-day')
    const timeEl = document.getElementById('analog-clock-time')
    const periodEl = document.getElementById('analog-clock-period')
    
    if (dayEl) dayEl.textContent = dayOfWeek
    if (timeEl) {
      const hour12 = hours % 12 || 12
      timeEl.textContent = `${hour12}:${minutes.toString().padStart(2, '0')}`
    }
    if (periodEl) periodEl.textContent = hours >= 12 ? 'PM' : 'AM'
  }

  function updateAnalogHands(hours, minutes, seconds) {
    const hourHand = document.getElementById('analog-hour-hand')
    const minuteHand = document.getElementById('analog-minute-hand')
    const secondHand = document.getElementById('analog-second-hand')
    
    if (hourHand && minuteHand && secondHand) {
      const hourDeg = (hours % 12) * 30 + minutes * 0.5
      const minuteDeg = minutes * 6 + seconds * 0.1
      const secondDeg = seconds * 6
      
      hourHand.style.transform = `rotate(${hourDeg}deg)`
      minuteHand.style.transform = `rotate(${minuteDeg}deg)`
      secondHand.style.transform = `rotate(${secondDeg}deg)`
    }
  }

  setInterval(updateClockWidget, 1000)
  updateClockWidget()
}

function initTimerWidget() {
  let timerHours = 0
  let timerMinutes = 5
  let timerSecondsVal = 0
  let timerInterval = null
  let timerRunning = false
  let timerStartTotal = 0
  let timerEndAction = localStorage.getItem('timer-end-action') || 'overlay'

  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 150

  function updateTimerProgress() {
    const progressBar = document.getElementById('timer-progress-bar')
    if (!progressBar) return
    
    const currentTotal = timerHours * 3600 + timerMinutes * 60 + timerSecondsVal
    
    if (timerStartTotal > 0) {
      const progress = currentTotal / timerStartTotal
      const offset = TIMER_CIRCUMFERENCE * (1 - progress)
      progressBar.style.strokeDashoffset = offset
    } else {
      progressBar.style.strokeDashoffset = 0
    }
  }

  function updateTimerDisplay() {
    const hoursEl = document.getElementById('timer-hours')
    const minutesEl = document.getElementById('timer-minutes')
    const secondsEl = document.getElementById('timer-seconds')
    if (hoursEl) hoursEl.value = timerHours.toString().padStart(2, '0')
    if (minutesEl) minutesEl.value = timerMinutes.toString().padStart(2, '0')
    if (secondsEl) secondsEl.value = timerSecondsVal.toString().padStart(2, '0')
    
    const btns = document.querySelectorAll('.timer-adjust-btn')
    btns.forEach(btn => {
      const action = btn.dataset.action
      let disabled = timerRunning
      
      if (!disabled) {
        if (action === 'hours-up' && timerHours >= 23) disabled = true
        if (action === 'hours-down' && timerHours <= 0) disabled = true
        if (action === 'minutes-up' && timerMinutes >= 59) disabled = true
        if (action === 'minutes-down' && timerMinutes <= 0) disabled = true
        if (action === 'seconds-up' && timerSecondsVal >= 59) disabled = true
        if (action === 'seconds-down' && timerSecondsVal <= 0) disabled = true
      }
      
      btn.classList.toggle('disabled', disabled)
      btn.disabled = disabled
    })

    updateTimerProgress()
  }

  function setupTimerInput(inputEl, getter, setter, max) {
    if (!inputEl) return
    
    inputEl.addEventListener('focus', () => {
      if (timerRunning) return
      inputEl.select()
    })
    
    inputEl.addEventListener('blur', () => {
      if (timerRunning) return
      let val = parseInt(inputEl.value, 10)
      if (isNaN(val) || val < 0) val = 0
      if (val > max) val = max
      setter(val)
      timerStartTotal = 0
      updateTimerDisplay()
    })
    
    inputEl.addEventListener('keydown', (e) => {
      if (timerRunning) return
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        inputEl.blur()
        return
      }
      if (!/^\d$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault()
      }
    })
  }
  
  setupTimerInput(document.getElementById('timer-hours'), 
    () => timerHours, 
    (v) => { timerHours = v }, 
    23
  )
  setupTimerInput(document.getElementById('timer-minutes'), 
    () => timerMinutes, 
    (v) => { timerMinutes = v }, 
    59
  )
  setupTimerInput(document.getElementById('timer-seconds'), 
    () => timerSecondsVal, 
    (v) => { timerSecondsVal = v }, 
    59
  )

  let holdInterval = null
  let holdTimeout = null
  
  function performAction(action) {
    if (action === 'hours-up') timerHours = Math.min(23, timerHours + 1)
    if (action === 'hours-down') timerHours = Math.max(0, timerHours - 1)
    if (action === 'minutes-up') timerMinutes = Math.min(59, timerMinutes + 1)
    if (action === 'minutes-down') timerMinutes = Math.max(0, timerMinutes - 1)
    if (action === 'seconds-up') timerSecondsVal = Math.min(59, timerSecondsVal + 1)
    if (action === 'seconds-down') timerSecondsVal = Math.max(0, timerSecondsVal - 1)
    timerStartTotal = 0
    updateTimerDisplay()
  }
  
  function stopHold() {
    if (holdTimeout) {
      clearTimeout(holdTimeout)
      holdTimeout = null
    }
    if (holdInterval) {
      clearInterval(holdInterval)
      holdInterval = null
    }
  }

  document.querySelectorAll('.timer-adjust-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (timerRunning) return
      performAction(btn.dataset.action)
    })
    
    btn.addEventListener('mousedown', (e) => {
      if (timerRunning) return
      const action = btn.dataset.action
      
      holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => {
          performAction(action)
        }, 80)
      }, 400)
    })
    
    btn.addEventListener('mouseup', stopHold)
    btn.addEventListener('mouseleave', stopHold)
  })

  let confettiAnimationId = null

  function showTimesUpOverlay() {
    const overlay = document.getElementById('times-up-overlay')
    const confettiCanvas = document.getElementById('confetti-canvas')
    if (!overlay || !confettiCanvas) return
    
    overlay.style.display = 'flex'
    
    const confettiCtx = confettiCanvas.getContext('2d')
    confettiCanvas.width = window.innerWidth
    confettiCanvas.height = window.innerHeight
    
    const confettiColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43']
    const confettiPieces = []
    
    for (let i = 0; i < 150; i++) {
      confettiPieces.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height - confettiCanvas.height,
        size: Math.random() * 10 + 5,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5
      })
    }
    
    const DEG_TO_RAD = Math.PI / 180
    
    function animateConfetti() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
      
      for (let i = 0, len = confettiPieces.length; i < len; i++) {
        const piece = confettiPieces[i]
        confettiCtx.save()
        confettiCtx.translate(piece.x, piece.y)
        confettiCtx.rotate(piece.rotation * DEG_TO_RAD)
        confettiCtx.fillStyle = piece.color
        confettiCtx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6)
        confettiCtx.restore()
        
        piece.y += piece.speedY
        piece.x += piece.speedX
        piece.rotation += piece.rotationSpeed
        
        if (piece.y > confettiCanvas.height + 20) {
          piece.y = -20
          piece.x = Math.random() * confettiCanvas.width
        }
      }
      
      confettiAnimationId = requestAnimationFrame(animateConfetti)
    }
    
    animateConfetti()
  }
  
  function hideTimesUpOverlay() {
    const overlay = document.getElementById('times-up-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId)
      confettiAnimationId = null
    }
    const confettiCanvas = document.getElementById('confetti-canvas')
    if (confettiCanvas) {
      confettiCanvas.width = 0
      confettiCanvas.height = 0
    }
  }
  
  document.getElementById('times-up-dismiss')?.addEventListener('click', hideTimesUpOverlay)

  document.getElementById('timer-play')?.addEventListener('click', () => {
    const timerWidget = document.getElementById('timer-widget')
    
    if (timerRunning) {
      clearInterval(timerInterval)
      timerInterval = null
      timerRunning = false
      timerWidget?.classList.remove('running')
      document.querySelector('#timer-play .material-symbols-outlined').textContent = 'play_arrow'
      updateTimerDisplay() 
    } else {
      const currentTotal = timerHours * 3600 + timerMinutes * 60 + timerSecondsVal
      if (currentTotal === 0) return
      
      if (timerStartTotal === 0) {
        timerStartTotal = currentTotal
      }
      
      timerRunning = true
      timerWidget?.classList.add('running')
      document.querySelector('#timer-play .material-symbols-outlined').textContent = 'pause'
      updateTimerDisplay()
      timerInterval = setInterval(() => {
        const totalSeconds = timerHours * 3600 + timerMinutes * 60 + timerSecondsVal
        if (totalSeconds > 0) {
          const newTotal = totalSeconds - 1
          timerHours = Math.floor(newTotal / 3600)
          timerMinutes = Math.floor((newTotal % 3600) / 60)
          timerSecondsVal = newTotal % 60
          updateTimerDisplay()
        } else {
          clearInterval(timerInterval)
          timerInterval = null
          timerRunning = false
          timerStartTotal = 0
          timerWidget?.classList.remove('running')
          document.querySelector('#timer-play .material-symbols-outlined').textContent = 'play_arrow'
          _playSound('timerAlarm')
          updateTimerDisplay()
          if (timerEndAction === 'overlay') {
            showTimesUpOverlay()
          }
        }
      }, 1000)
    }
  })

  document.getElementById('timer-reset')?.addEventListener('click', () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    timerRunning = false
    timerHours = 0
    timerMinutes = 5
    timerSecondsVal = 0
    timerStartTotal = 0
    const timerWidget = document.getElementById('timer-widget')
    timerWidget?.classList.remove('running')
    document.querySelector('#timer-play .material-symbols-outlined').textContent = 'play_arrow'
    updateTimerDisplay()
  })

  document.getElementById('timer-close')?.addEventListener('click', () => {
    state.timerEnabled = false
    const timerWidget = document.getElementById('timer-widget')
    if (timerWidget) {
      timerWidget.style.display = 'none'
    }
    const card = document.querySelector('#feature-timer')
    card?.classList.remove('active')
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
      timerRunning = false
    }
  })

  // Timer settings
  const timerSettingsBtn = document.getElementById('timer-settings-btn')
  const timerSettingsPopup = document.getElementById('timer-settings-popup')
  const timerEndActionBtns = document.querySelectorAll('.timer-end-action-btn')

  if (timerSettingsBtn && timerSettingsPopup) {
    timerSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      timerSettingsPopup.classList.toggle('show')
    })

    document.addEventListener('click', (e) => {
      if (!timerSettingsPopup.contains(e.target) && e.target !== timerSettingsBtn) {
        timerSettingsPopup.classList.remove('show')
      }
    })
  }

  function applyTimerEndAction(action) {
    timerEndAction = action
    localStorage.setItem('timer-end-action', action)
    timerEndActionBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === action)
    })
  }

  timerEndActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyTimerEndAction(btn.dataset.action)
      _playSound('switch')
    })
  })

  applyTimerEndAction(timerEndAction)
  updateTimerDisplay()
}

function initWidgetDragging() {
  makeDraggable(document.getElementById('timer-widget'))
  makeDraggable(document.getElementById('clock-widget'))
}

function makeDraggable(element) {
  if (!element) return
  let offsetX = 0
  let offsetY = 0
  let hasBeenDragged = false

  const onMove = (e) => {
    const rect = element.getBoundingClientRect()
    const width = rect.width

    let newX = e.clientX - offsetX
    let newY = e.clientY - offsetY

    const minVisible = 50
    newX = Math.max(-width + minVisible, Math.min(window.innerWidth - minVisible, newX))
    newY = Math.max(0, Math.min(window.innerHeight - minVisible, newY))

    element.style.left = `${newX}px`
    element.style.top = `${newY}px`
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    element.style.cursor = 'move'
  }

  element.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return
    
    const rect = element.getBoundingClientRect()
    
    if (!hasBeenDragged) {
      element.style.transform = 'none'
      element.style.left = `${rect.left}px`
      element.style.top = `${rect.top}px`
      hasBeenDragged = true
    }
    
    offsetX = e.clientX - rect.left
    offsetY = e.clientY - rect.top
    element.style.cursor = 'grabbing'
    e.preventDefault()

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

module.exports = {
  init
}