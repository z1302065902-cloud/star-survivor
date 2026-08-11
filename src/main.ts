import './style.css'
import { CHARS, TRIAL_MINUTES, FULL_MINUTES, type UpgradeOption } from './game/data'
import { SurvivorGame } from './game/engine'
import {
  isFullVersion, getMeta, isCharUnlocked,
  unlockChar, recordRun, addCoins,
} from './game/paid'
import { bindRedeem } from './game/redeem'
import { initMusic, resumeMusic, setMusicOn, isMusicOn } from './game/audio'

let game: SurvivorGame | null = null
let currentChar = CHARS[0]
let currentIsFull = false

const $ = (id: string) => document.getElementById(id)!

// ===== 菜单 =====
function buildMenu() {
  const full = isFullVersion()
  const meta = getMeta()
  $('hud-coins').textContent = String(meta.coins)
  $('hud-besttime').textContent = `${Math.floor(meta.bestTime / 60)}:${String(meta.bestTime % 60).padStart(2, '0')}`
  $('menu-full-text').textContent = full
    ? '完整版 · 已解锁全部角色与武器'
    : `试玩版 · 免费体验 ${TRIAL_MINUTES} 分钟 · 完整版 $1 解锁全部内容（目标 ${FULL_MINUTES} 分钟）`
  $('btn-music').textContent = isMusicOn() ? '🎵 音乐：开' : '🎵 音乐：关'

  // 角色选择
  const list = $('char-list')
  list.innerHTML = ''
  CHARS.forEach((c) => {
    const unlocked = isCharUnlocked(c.id)
    const row = document.createElement('div')
    row.className = 'char-row' + (unlocked ? '' : ' locked') + (c.id === currentChar.id ? ' selected' : '')
    row.innerHTML = `
      <div class="char-avatar" style="background:${c.color}"></div>
      <div class="char-info">
        <div class="char-name">${c.name} ${unlocked ? '' : '🔒'}</div>
        <div class="char-desc">${c.desc}</div>
        <div class="char-passive">${c.passive}</div>
      </div>
      ${unlocked ? '' : '<button class="char-unlock">解锁◈100</button>'}
    `
    if (unlocked) {
      row.addEventListener('click', () => { currentChar = c; buildMenu() })
    } else {
      row.querySelector('.char-unlock')!.addEventListener('click', (e) => {
        e.stopPropagation()
        if (unlockChar(c.id)) buildMenu()
      })
    }
    list.appendChild(row)
  })
}

// ===== 开始 =====
function startGame() {
  $('menu-screen').classList.add('hidden')
  $('end-screen').classList.add('hidden')
  if (game) { game.destroy(); game = null }
  currentIsFull = isFullVersion()

  const canvas = $('game-canvas') as HTMLCanvasElement
  game = new SurvivorGame(canvas, currentChar, currentIsFull, {
    onLevelUp: (opts) => showLevelUp(opts),
    onHp: (hp, maxHp) => {
      $('hp-fill').style.width = `${(hp / maxHp) * 100}%`
      $('hp-text').textContent = `${hp}/${maxHp}`
    },
    onXp: (level, xp, need) => {
      $('level-num').textContent = String(level)
      $('xp-fill').style.width = `${Math.min(100, (xp / need) * 100)}%`
    },
    onTimer: (sec) => {
      const mm = Math.floor(sec / 60)
      const ss = sec % 60
      $('timer-text').textContent = `${mm}:${String(ss).padStart(2, '0')}`
    },
    onGameOver: (sec, kills, won) => endGame(sec, kills, won),
    onCoins: () => {},
  })
  ;(window as any).__game = game
  $('hp-text').textContent = `${currentChar.hp}/${currentChar.hp}`
  $('level-num').textContent = '1'
  $('timer-text').textContent = `0:00`
}

function showLevelUp(opts: UpgradeOption[]) {
  const panel = $('levelup-panel')
  const list = $('levelup-options')
  list.innerHTML = ''
  opts.forEach((o) => {
    const div = document.createElement('div')
    div.className = 'levelup-opt'
    div.style.borderColor = '#' + o.color.toString(16).padStart(6, '0')
    div.innerHTML = `
      <div class="opt-name">${o.name}</div>
      <div class="opt-desc">${o.desc}</div>
    `
    div.addEventListener('click', () => {
      panel.classList.add('hidden')
      game?.applyUpgrade(o)
    })
    list.appendChild(div)
  })
  panel.classList.remove('hidden')
}

function endGame(sec: number, kills: number, won: boolean) {
  const coinsEarned = Math.floor(sec / 10) + kills * 2
  addCoins(coinsEarned)
  recordRun(sec, coinsEarned)
  $('end-title').textContent = won ? '🏆 幸存！' : '☠️ 星舰坠落'
  $('end-info').innerHTML = `
    <div class="end-stats">存活 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} · 击毁 ${kills}</div>
    <div class="end-coins">◈ 获得 ${coinsEarned}</div>
    ${won ? '' : '<div class="end-hint">差一点！再来一局攒金币变强</div>'}
  `
  $('end-screen').classList.remove('hidden')
}

// ===== 绑定 =====
function bindUI() {
  $('btn-music').addEventListener('click', () => {
    setMusicOn(!isMusicOn())
    $('btn-music').textContent = isMusicOn() ? '🎵 音乐：开' : '🎵 音乐：关'
  })
  $('btn-start').addEventListener('click', startGame)
  $('btn-retry').addEventListener('click', startGame)
  $('btn-menu').addEventListener('click', () => {
    if (game) { game.destroy(); game = null }
    $('end-screen').classList.add('hidden')
    $('menu-screen').classList.remove('hidden')
    buildMenu()
  })

  // 移动控制（WASD + 方向键 + 触屏）
  window.addEventListener('keydown', (e) => {
    if (!game) return
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') game.setMove(0, -1)
    if (k === 's' || k === 'arrowdown') game.setMove(0, 1)
    if (k === 'a' || k === 'arrowleft') game.setMove(-1, 0)
    if (k === 'd' || k === 'arrowright') game.setMove(1, 0)
  })

  bindRedeem(() => buildMenu())
}

initMusic()
bindUI()
buildMenu()
// 首次点击时解锁音频（浏览器策略）
window.addEventListener('pointerdown', resumeMusic, { once: true })
