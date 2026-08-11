// 音乐：mp3 循环播放（玩家提供的赛博/电子曲）

const BASE = (import.meta as any).env?.BASE_URL || '/'
const MUSIC_FILES = ['battle.mp3', 'battle2.mp3']

let musicEls: HTMLAudioElement[] = []
let currentIdx = 0
let musicOn = true
const MUTE_KEY = 'ss-audio-v1'

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(MUTE_KEY) || '{}')
    musicOn = p.music !== false
  } catch { /* ignore */ }
}

export function initMusic() {
  loadPrefs()
  startMusic()
}

function startMusic() {
  if (!musicOn || musicEls.length) return
  try {
    musicEls = MUSIC_FILES.map((f) => {
      const a = new Audio(`${BASE}assets/music/${f}`)
      a.loop = false
      a.volume = 0.45
      a.preload = 'auto'
      return a
    })
    const playNext = () => {
      currentIdx = (currentIdx + 1) % musicEls.length
      if (musicOn) void musicEls[currentIdx].play().catch(() => {})
    }
    musicEls.forEach((a) => a.addEventListener('ended', playNext))
    void musicEls[0].play().catch(() => {})
  } catch { /* ignore */ }
}

export function resumeMusic() {
  if (musicOn && !musicEls.length) startMusic()
  else if (musicOn && musicEls.length) {
    musicEls.forEach((a) => { if (a.paused) void a.play().catch(() => {}) })
  }
}

export function setMusicOn(v: boolean) {
  musicOn = v
  if (musicEls.length) {
    if (v) void musicEls[currentIdx].play().catch(() => {})
    else musicEls.forEach((a) => a.pause())
  }
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify({ music: v }))
  } catch { /* ignore */ }
}

export function isMusicOn() { return musicOn }

// ---------- 音效：WebAudio 合成（无外部文件） ----------
export type SfxKind = 'fire' | 'beam' | 'hit' | 'boom' | 'pickup' | 'levelup' | 'hurt'

let sfxCtx: AudioContext | null = null
let sfxGain: GainNode | null = null

export function ensureSfxCtx(): AudioContext | null {
  if (sfxCtx) {
    if (sfxCtx.state === 'suspended') void sfxCtx.resume()
    return sfxCtx
  }
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    sfxCtx = new AC()
    sfxGain = sfxCtx.createGain()
    sfxGain.gain.value = 0.5
    sfxGain.connect(sfxCtx.destination)
  } catch {
    return null
  }
  return sfxCtx
}

function sfxTone(opts: {
  freq: number
  endFreq?: number
  dur: number
  gain: number
  type?: OscillatorType
  attack?: number
  delay?: number
}) {
  const ctx = sfxCtx
  if (!ctx || !sfxGain) return
  const t = ctx.currentTime + (opts.delay || 0)
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = opts.type || 'square'
  o.frequency.setValueAtTime(opts.freq, t)
  if (opts.endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t + opts.dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(opts.gain, t + (opts.attack || 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
  o.connect(g).connect(sfxGain)
  o.start(t)
  o.stop(t + opts.dur + 0.05)
}

function sfxNoise(dur: number, gain: number, cutoff: number) {
  const ctx = sfxCtx
  if (!ctx || !sfxGain) return
  const t = ctx.currentTime
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = cutoff
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(sfxGain)
  src.start(t)
}

let sfxLastFire = 0

export function playSfx(kind: SfxKind) {
  if (!ensureSfxCtx()) return
  switch (kind) {
    case 'fire': {
      if (performance.now() - sfxLastFire < 50) return
      sfxLastFire = performance.now()
      sfxTone({ freq: 1400 + Math.random() * 200, endFreq: 500, dur: 0.06, gain: 0.06, type: 'square' })
      break
    }
    case 'beam':
      sfxTone({ freq: 900, endFreq: 300, dur: 0.1, gain: 0.05, type: 'sawtooth' })
      break
    case 'hit':
      sfxNoise(0.04, 0.1, 3000)
      break
    case 'boom':
      sfxTone({ freq: 180, endFreq: 45, dur: 0.3, gain: 0.2, type: 'square' })
      sfxNoise(0.2, 0.12, 1500)
      break
    case 'pickup':
      sfxTone({ freq: 700, endFreq: 1100, dur: 0.07, gain: 0.06, type: 'triangle' })
      break
    case 'levelup':
      ;[440, 554, 659].forEach((f, i) => sfxTone({ freq: f, dur: 0.15, gain: 0.08, type: 'triangle', delay: i * 0.08 }))
      break
    case 'hurt':
      sfxTone({ freq: 300, endFreq: 90, dur: 0.2, gain: 0.16, type: 'sawtooth' })
      break
  }
}
