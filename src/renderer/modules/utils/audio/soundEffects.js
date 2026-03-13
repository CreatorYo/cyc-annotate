const { ipcRenderer } = require('electron')
let ctx = null
let masterGain = null
let masterCompressor = null
const bufferCache = new Map()
const customSoundCache = new Map()
let isResuming = false
let resumePromise = null

function init() {
  if (ctx && ctx.state !== 'closed') return ctx
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext())
    
    masterGain = ctx.createGain()
    masterGain.gain.value = 1.0
    
    masterCompressor = ctx.createDynamicsCompressor()
    masterCompressor.threshold.setValueAtTime(-12, ctx.currentTime)
    masterCompressor.knee.setValueAtTime(30, ctx.currentTime)
    masterCompressor.ratio.setValueAtTime(12, ctx.currentTime)
    masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime)
    masterCompressor.release.setValueAtTime(0.25, ctx.currentTime)
    
    masterGain.connect(masterCompressor)
    masterCompressor.connect(ctx.destination)
        
    ctx.onstatechange = () => {
      if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted') && !isResuming) {
        ensureRunning()
      }
    }
  } catch (e) {
    ipcRenderer.invoke('show-error-dialog', 'Audio Error', 'Fatal error initializing AudioContext. Sounds may not work.', e.message)
    ctx = null
  }
  return ctx
}

async function ensureRunning() {
  const context = init()
  if (!context) return false
  if (context.state === 'running') return true
  if (isResuming) return resumePromise
  
  isResuming = true
  resumePromise = (async () => {
    try {
      if (context.state === 'suspended' || context.state === 'interrupted') {
        await context.resume()
      }
      return context.state === 'running'
    } catch (err) {
      ipcRenderer.invoke('show-warning-dialog', 'Audio Alert', 'System failed to resume audio. Sounds may be muted.', err.message)
      return false
    } finally {
      isResuming = false
      resumePromise = null
    }
  })()
  return resumePromise
}

function sin(f, t) { return Math.sin(6.2831853 * f * t) }
function exp(t, r) { return Math.exp(-t * r) }
function rnd() { return Math.random() * 2 - 1 }

const SOUNDS = {
  trash: [0.4, 0.9, t => {
    const d = exp(t, 6)
    return (exp(t, 30) * 0.5 + sin(80, t) * 0.3 * d + sin(200, t) * 0.2 * d + sin(800, t) * 0.15 * exp(t, 15) + rnd() * 0.2 * d) * d
  }],
  pop: [0.15, 0.9, t => {
    const d = exp(t, 25)
    return (exp(t, 50) * 0.7 + sin(400, t) * 0.5 * d + sin(1200, t) * 0.35 * exp(t, 40) + sin(150, t) * 0.25 * d + rnd() * 0.2 * exp(t, 30)) * d
  }],
  undo: [0.2, 0.9, t => {
    const d = exp(t, 20)
    return (sin(300, t) * 0.6 * d + sin(100, t) * 0.4 * d + sin(800, t) * 0.25 * exp(t, 30) + rnd() * 0.15 * d) * d
  }],
  redo: [0.2, 0.9, t => {
    const d = exp(t, 20)
    return (sin(400, t) * 0.6 * d + sin(100, t) * 0.4 * d + sin(800, t) * 0.25 * exp(t, 30) + rnd() * 0.15 * d) * d
  }],
  capture: [0.25, 0.9, t => {
    const d = exp(t, 15)
    return (sin(600, t) * 0.6 * exp(t, 40) + sin(1200, t) * 0.5 * exp(t, 50) + sin(200, t) * 0.35 * d + sin(1800, t) * 0.25 * exp(t, 60) + rnd() * 0.15 * exp(t, 35)) * d
  }],
  color: [0.12, 0.9, t => {
    const d = exp(t, 30)
    return (sin(600, t) * 0.6 * d + sin(900, t) * 0.4 * d + sin(1500, t) * 0.25 * exp(t, 50) + sin(300, t) * 0.2 * d) * d
  }],
  copy: [0.18, 0.9, t => {
    const d = exp(t, 20)
    return (sin(400 + t * 200, t) * 0.6 * d + sin(1200, t) * 0.5 * exp(t, 60) + sin(1800, t) * 0.35 * exp(t, 45) + sin(250, t) * 0.25 * d + rnd() * 0.1 * exp(t, 50)) * d
  }],
  paste: [0.22, 0.9, t => {
    const d = exp(t, 12)
    return (sin(523, t) * 0.6 * d + sin(659, t) * 0.5 * d + sin(600 - t * 150, t) * 0.35 * d + sin(1400, t) * 0.3 * exp(t, 40) + sin(200, t) * 0.25 * d + exp(t, 35) * 0.35) * d
  }],
  selectAll: [0.25, 0.9, t => {
    const d = exp(t, 12)
    return (sin(300 + t * 2000, t) * 0.5 * d + sin(1200, t) * 0.4 * exp(t, 20) + sin(600, t) * 0.3 * d + sin(2000, t) * 0.2 * exp(t, 25) + rnd() * 0.08 * d) * d
  }],
  standbyOn: [0.4, 0.9, t => {
    const att = Math.min(1, t * 200)
    const e1 = att * exp(t, 8)
    const e2 = att * exp(Math.max(0, t - 0.08), 6)
    const n1 = sin(523, t) * 0.5 + sin(1046, t) * 0.25 + sin(1569, t) * 0.12
    const n2 = t >= 0.08 ? sin(392, t - 0.08) * 0.55 + sin(784, t - 0.08) * 0.28 + sin(1176, t - 0.08) * 0.14 : 0
    const bell = sin(2093, t) * 0.1 * exp(t, 25)
    const click = exp(t, 100) * 0.3
    return (n1 * e1 + n2 * e2 + bell + click) * 0.9
  }],
  standbyOff: [0.2, 0.95, t => {
    const env = Math.min(1, t * 200) * exp(t, 12)
    const ping = sin(1200, t) * 0.6
    const body = sin(600, t) * 0.45
    const low = sin(300, t) * 0.25
    const bright = sin(2400, t) * 0.2 * exp(t, 25)
    const click = exp(t, 80) * 0.5
    return (ping + body + low + bright + click) * env
  }],
  visibilityOn: [0.12, 0.9, t => {
    const env = exp(t, 40)
    const click = exp(t, 250) * 0.7
    const metal = sin(2500, t) * 0.15 * exp(t, 80)
    const resonance = sin(800, t) * 0.3 * exp(t, 35)
    const lowEnd = sin(140, t) * 0.25 * exp(t, 20)
    return (click + metal + resonance + lowEnd) * env
  }],
  visibilityOff: [0.1, 0.85, t => {
    const env = exp(t, 50)
    const click = exp(t, 300) * 0.8
    const resonance = sin(1200, t) * 0.25 * exp(t, 45)
    const body = sin(300, t) * 0.2 * exp(t, 25)
    return (click + resonance + body) * env
  }],
  move: [0.15, 0.85, t => {
    const d = exp(t, 20)
    return (sin(200 + t * 400, t) * 0.4 * d + sin(400, t) * 0.3 * exp(t, 40) + rnd() * 0.1 * d) * d
  }],
  reset: [0.2, 0.9, t => {
    const d = exp(t, 25)
    return (sin(800 - t * 1000, t) * 0.5 * d + sin(400, t) * 0.3 * d + exp(t, 50) * 0.2) * d
  }],
  layerUp: [0.22, 0.9, t => {
    const d = exp(t, 25)
    const fund = sin(440 * Math.pow(1.5, t * 8), t) * 0.4
    const harm1 = sin(880 * Math.pow(1.5, t * 8), t) * 0.2
    const noise = rnd() * 0.05 * exp(t, 100)
    const click = exp(t, 150) * 0.6
    return (fund + harm1 + noise + click) * d
  }],
  layerDown: [0.22, 0.9, t => {
    const d = exp(t, 25)
    const fund = sin(880 * Math.pow(0.5, t * 8), t) * 0.4
    const harm1 = sin(440 * Math.pow(0.5, t * 8), t) * 0.2
    const noise = rnd() * 0.05 * exp(t, 100)
    const click = exp(t, 150) * 0.6
    return (fund + harm1 + noise + click) * d
  }],
  timerAlarm: [0.8, 0.9, t => {
    const env1 = t < 0.4 ? Math.min(1, t * 20) * exp(t, 4) : 0
    const env2 = t >= 0.35 ? Math.min(1, (t - 0.35) * 20) * exp(t - 0.35, 3) : 0
    const note1 = (sin(523, t) * 0.5 + sin(1046, t) * 0.25 + sin(1569, t) * 0.1) * env1
    const note2 = (sin(659, t - 0.35) * 0.5 + sin(1318, t - 0.35) * 0.25 + sin(1977, t - 0.35) * 0.1) * env2
    const shimmer = sin(2093, t) * 0.05 * exp(t, 15)
    return note1 + note2 + shimmer
  }]
}

async function loadCustomSound(filePath) {
  if (customSoundCache.has(filePath)) return customSoundCache.get(filePath)
  
  try {
    const context = init()
    if (!context) return null
    
    const response = await fetch(`file://${filePath}`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer)
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const data = audioBuffer.getChannelData(channel)
      let peak = 0
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i])
        if (abs > peak) peak = abs
      }
      if (peak > 0.01) {
        const scale = 0.95 / peak
        for (let i = 0; i < data.length; i++) data[i] *= scale
      }
    }
    
    customSoundCache.set(filePath, audioBuffer)
    return audioBuffer
  } catch (error) {
    ipcRenderer.invoke('show-warning-dialog', 'Sound Alert', `Failed to load custom sound from: ${filePath}`, error.message)
    return null
  }
}

function getBuffer(type) {
  const customSoundPath = localStorage.getItem(`custom-sound-${type}`)
  if (customSoundPath) {
    const customBuffer = customSoundCache.get(customSoundPath)
    if (customBuffer) return customBuffer
    
    loadCustomSound(customSoundPath)
  }
  
  if (bufferCache.has(type)) return bufferCache.get(type)
  const context = init()
  if (!context) return null
  
  const sound = SOUNDS[type]
  if (!sound) return null
  
  const [duration, , generator] = sound
  const sr = context.sampleRate
  const len = Math.max(44, Math.round(sr * duration))
  const buf = context.createBuffer(1, len, sr)
  const data = buf.getChannelData(0)
  
  let peak = 0
  for (let i = 0; i < len; i++) {
    const v = generator(i / sr)
    data[i] = v
    const abs = Math.abs(v)
    if (abs > peak) peak = abs
  }
  
  if (peak > 0.01) {
    const scale = 0.95 / peak
    for (let i = 0; i < len; i++) data[i] *= scale
  }
  
  bufferCache.set(type, buf)
  return buf
}

async function playSound(type, retryCount = 0, isTest = false) {
  const soundsEnabledSetting = localStorage.getItem('sounds-enabled') !== 'false'
  const el = document.getElementById('sounds-enabled')
  if (el && el.checked === false) return
  if (!el && !soundsEnabledSetting) return
  
  const customSoundPath = localStorage.getItem(`custom-sound-${type}`)
  
  try {
    const context = init()
    if (!context || context.state === 'closed') {
      if (retryCount < 2) {
        ctx = null
        init()
        return setTimeout(() => playSound(type, retryCount + 1, isTest), 50)
      }
      return
    }

    if (context.state !== 'running') {
      const resumed = await ensureRunning()
      if (!resumed && retryCount < 2) {
        return setTimeout(() => playSound(type, retryCount + 1, isTest), 100)
      }
      if (!resumed) return
    }

    let buffer = null
    let volume = 0.9

    if (customSoundPath) {
      buffer = customSoundCache.get(customSoundPath)
      if (!buffer) {
        buffer = await loadCustomSound(customSoundPath)
      }
      if (buffer) volume = 0.9
    }
    
    if (!buffer) {
      buffer = getBuffer(type)
      const sound = SOUNDS[type]
      if (sound) volume = sound[1]
    }
    
    if (!buffer) return

    const source = context.createBufferSource()
    const gainNode = context.createGain()
    
    source.buffer = buffer
    source.connect(gainNode)
    gainNode.connect(masterGain)
    
    const now = context.currentTime + 0.06 
    let finalDuration = buffer.duration
    
    if (isTest) {
      finalDuration = Math.min(3.0, buffer.duration)
    } else if (customSoundPath) {
      finalDuration = Math.min(5.0, buffer.duration)
    }
    
    const fadeOutDuration = Math.min(0.15, finalDuration * 0.1)
    const sustainDuration = finalDuration - fadeOutDuration

    gainNode.gain.cancelScheduledValues(context.currentTime)
    gainNode.gain.setValueAtTime(0, context.currentTime)
    gainNode.gain.linearRampToValueAtTime(volume, now)
    gainNode.gain.setValueAtTime(volume, now + sustainDuration)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + finalDuration)
    
    source.start(now)
    source.stop(now + finalDuration + 0.1)
    
    source.onended = () => {
      try { 
        gainNode.disconnect() 
        source.disconnect() 
      } catch (e) {}
    }

  } catch (err) {
    if (retryCount < 2) {
      setTimeout(() => playSound(type, retryCount + 1, isTest), 100)
    } else {
      ipcRenderer.invoke('show-warning-dialog', 'Audio Alert', `Failed to play sound: "${type}" after multiple attempts.`, err.message)
    }
  }
}

if (typeof window !== 'undefined' && window.electronAPI) {
  window.electronAPI.onCustomSoundUpdated((soundType, filePath) => {
    const oldPath = localStorage.getItem(`custom-sound-${soundType}`)
    if (oldPath) customSoundCache.delete(oldPath)
    loadCustomSound(filePath)
  })
  
  window.electronAPI.onCustomSoundReset((soundType) => {
    const oldPath = localStorage.getItem(`custom-sound-${soundType}`)
    if (oldPath) customSoundCache.delete(oldPath)
  })
}

if (typeof require !== 'undefined') {
  ipcRenderer.on('custom-sound-updated', (event, soundType, filePath) => {
    const oldPath = localStorage.getItem(`custom-sound-${soundType}`)
    if (oldPath) customSoundCache.delete(oldPath)
    loadCustomSound(filePath)
  })
  
  ipcRenderer.on('custom-sound-reset', (event, soundType) => {
    const oldPath = localStorage.getItem(`custom-sound-${soundType}`)
    if (oldPath) customSoundCache.delete(oldPath)
  })
  
  ipcRenderer.on('test-sound', (event, soundType) => {
    playSound(soundType, 0, true)
  })
}

function initAudioContext() { init(); ensureRunning(); }

const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'focus']
events.forEach(e => document.addEventListener(e, () => {
  ensureRunning()
}, { passive: true }))

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    ensureRunning()
  }
})

setInterval(() => {
  if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
    ensureRunning()
  } else if (!ctx || ctx.state === 'closed') {
    init()
  }
}, 10000)

setTimeout(() => {
  if (init()) {
    Object.keys(SOUNDS).forEach(type => getBuffer(type))
  }
}, 500)

module.exports = { initAudioContext, playSound }