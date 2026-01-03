let ctx = null
let masterGain = null
let queue = []
let isResuming = false

function init() {
  if (ctx) return ctx
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 1.0
    masterGain.connect(ctx.destination)
    ctx.onstatechange = processQueue
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  } catch (e) {
    ctx = null
  }
  return ctx
}

function resume() {
  if (!ctx || isResuming) return
  if (ctx.state === 'running') {
    processQueue()
    return
  }
  isResuming = true
  ctx.resume().then(() => {
    isResuming = false
    if (ctx && ctx.state === 'running') processQueue()
  }).catch(() => {
    isResuming = false
    setTimeout(resume, 30)
  })
}

function processQueue() {
  if (!ctx || ctx.state !== 'running' || !masterGain) return
  while (queue.length > 0) {
    const fn = queue.shift()
    try { fn() } catch (e) {}
  }
}

function ensureReady(fn) {
  init()
  if (!ctx) return
  
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      if (ctx.state === 'running' && masterGain) {
        try { fn() } catch (e) {}
      } else {
        queue.push(fn)
      }
    }).catch(() => {
      queue.push(fn)
    })
  } else if (ctx.state === 'running' && masterGain) {
    try { fn() } catch (e) {}
  } else {
    queue.push(fn)
    resume()
  }
}

function warmUp() {
  init()
  resume()
}

const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'focus']
events.forEach(e => document.addEventListener(e, warmUp, { passive: true }))
window.addEventListener('load', warmUp)
setTimeout(warmUp, 50)
setTimeout(warmUp, 200)
setTimeout(warmUp, 500)

function createSound(duration, volume, generator) {
  ensureReady(() => {
    if (!ctx || !masterGain) return
    
    const sr = ctx.sampleRate
    const len = Math.max(44, Math.round(sr * duration))
    const buf = ctx.createBuffer(1, len, sr)
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
    
    const src = ctx.createBufferSource()
    const gain = ctx.createGain()
    
    src.buffer = buf
    src.connect(gain)
    gain.connect(masterGain)
    
    const now = ctx.currentTime
    gain.gain.setValueAtTime(volume, now)
    gain.gain.setValueAtTime(volume, now + duration * 0.8)
    gain.gain.linearRampToValueAtTime(0.001, now + duration)
    
    try {
      src.start(now)
      src.stop(now + duration + 0.05)
    } catch (e) {
      try {
        src.start(0)
        src.stop(duration + 0.05)
      } catch (e2) {
        try { gain.disconnect() } catch (e3) {}
        try { src.disconnect() } catch (e3) {}
        return
      }
    }
    
    src.onended = () => {
      try { gain.disconnect() } catch (e) {}
      try { src.disconnect() } catch (e) {}
    }
  })
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
  visibilityOn: [0.12, 0.85, t => {
    const env = exp(t, 40)
    const click = exp(t, 250) * 0.7
    const metal = sin(2500, t) * 0.15 * exp(t, 80)
    const resonance = sin(800, t) * 0.3 * exp(t, 35)
    const lowEnd = sin(140, t) * 0.25 * exp(t, 20)
    return (click + metal + resonance + lowEnd) * env
  }],
  visibilityOff: [0.1, 0.75, t => {
    const env = exp(t, 50)
    const click = exp(t, 300) * 0.8
    const resonance = sin(1200, t) * 0.25 * exp(t, 45)
    const body = sin(300, t) * 0.2 * exp(t, 25)
    return (click + resonance + body) * env
  }]
}

function playSound(type) {
  const el = document.getElementById('sounds-enabled')
  if (el && el.checked === false) return
  
  init()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  
  const s = SOUNDS[type]
  if (s) {
    let attempts = 0
    const maxAttempts = 3
    
    const tryPlay = () => {
      attempts++
      try {
        createSound(s[0], s[1], s[2])
      } catch (e) {
        if (attempts < maxAttempts) {
          setTimeout(tryPlay, 50 * attempts)
        }
      }
    }
    
    tryPlay()
  }
}

function initAudioContext() {
  init()
  warmUp()
}

module.exports = { initAudioContext, playSound }