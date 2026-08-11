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
