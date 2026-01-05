let ctx = null
let masterGain = null
const bufferCache = new Map()
let isResuming = false
let resumePromise = null

function init() {
  if (ctx && ctx.state !== 'closed') return ctx
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 1.0
    masterGain.connect(ctx.destination)
    bufferCache.clear()
    ctx.onstatechange = () => {
      if (ctx && ctx.state === 'suspended' && !isResuming) ensureRunning()
    }
  } catch (e) {
    console.error('SoundEffects: Fatal error initializing AudioContext', e)
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
      await context.resume()
      return context.state === 'running'
    } catch (err) {
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

function getBuffer(type) {
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

async function playSound(type) {
  const soundsEnabledSetting = localStorage.getItem('sounds-enabled') !== 'false'
  const el = document.getElementById('sounds-enabled')
  if (el && el.checked === false) return
  if (!el && !soundsEnabledSetting) return
  const sound = SOUNDS[type]
  if (!sound) return

  await ensureRunning()
  if (!ctx || !masterGain) return

  const buffer = getBuffer(type)
  if (!buffer) return

  try {
    const source = ctx.createBufferSource()
    const gainNode = ctx.createGain()
    source.buffer = buffer
    source.connect(gainNode)
    gainNode.connect(masterGain)
    const now = ctx.currentTime
    const [duration, volume] = sound
    
    gainNode.gain.setValueAtTime(volume, now) 
    gainNode.gain.setValueAtTime(volume, now + duration * 0.8)
    gainNode.gain.linearRampToValueAtTime(0.001, now + duration)
    
    source.start(now)
    source.stop(now + duration + 0.1)
    source.onended = () => {
      try { gainNode.disconnect(); source.disconnect(); } catch (e) {}
    }
  } catch (err) {
    console.error(`SoundEffects: Error playing "${type}"`, err)
  }
}

function warmUp() { ensureRunning() }
function initAudioContext() { init(); warmUp(); }

const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'focus']
events.forEach(e => document.addEventListener(e, warmUp, { passive: true }))

setInterval(() => {
  if (ctx && ctx.state === 'suspended') {
    ensureRunning()
  } else if (!ctx || ctx.state === 'closed') {
    init()
  }
}, 30000)

setTimeout(() => {
  if (init()) {
    Object.keys(SOUNDS).forEach(type => getBuffer(type))
  }
}, 500)

module.exports = { initAudioContext, playSound }