import './style.css'
import { CHARS, WEAPONS, TRIAL_MINUTES, FULL_MINUTES, type UpgradeOption } from './game/data'
import { SurvivorGame } from './game/engine'
import {
  isFullVersion, getMeta, isCharUnlocked, isWeaponUnlocked,
  unlockChar, unlockWeapon, recordRun,
} from './game/paid'
import { bindRedeem, setupRedeem } from './game/redeem'
import { initMusic, resumeMusic, setMusicOn, isMusicOn, playSfx, ensureSfxCtx } from './game/audio'

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

  // 武器收藏（局内随机获得，试玩版需解锁）
  const wl = $('weapon-list')
  wl.innerHTML = ''
  Object.values(WEAPONS).forEach((w) => {
    const unlocked = isWeaponUnlocked(w.id)
    const row = document.createElement('div')
    row.className = 'weapon-row' + (unlocked ? '' : ' locked')
    row.innerHTML = `
      <div class="weapon-icon" style="background:#${w.color.toString(16).padStart(6, '0')}"></div>
      <div class="weapon-name">${w.name} ${unlocked ? '' : '🔒'}</div>
      <div class="weapon-desc">${w.desc}</div>
      ${unlocked ? '<span class="weapon-state">✓ 已解锁</span>' : '<button class="weapon-unlock">解锁◈50</button>'}
    `
    if (!unlocked) {
      row.querySelector('.weapon-unlock')!.addEventListener('click', (e) => {
        e.stopPropagation()
        if (unlockWeapon(w.id)) buildMenu()
      })
    }
    wl.appendChild(row)
  })
}

// ===== 开始 =====
function startGame() {
  $('menu-screen').classList.add('hidden')
  $('end-screen').classList.add('hidden')
  $('paywall-screen').classList.add('hidden')
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
      $('kills-num').textContent = String(game?.kills ?? 0)
    },
    onGameOver: (sec, kills, won) => endGame(sec, kills, won),
    onCoins: (coins) => { $('hud-coin-live').textContent = String(coins) },
    onTrialEnd: () => showPaywall(),
    onSfx: (kind) => playSfx(kind),
  })
  ;(window as any).__game = game
  $('hp-text').textContent = `${currentChar.hp}/${currentChar.hp}`
  $('level-num').textContent = '1'
  $('timer-text').textContent = `0:00`
  $('kills-num').textContent = '0'
  $('hud-coin-live').textContent = '0'
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
  // 结算金币 = 存活奖励 + 击杀奖励 + 局内拾取
  // （recordRun 内部已把 coins 写入 meta，切勿再 addCoins，否则双倍）
  const inRunCoins = game?.coins ?? 0
  const coinsEarned = Math.floor(sec / 10) + kills * 2 + inRunCoins
  recordRun(sec, coinsEarned)
  $('end-title').textContent = won ? '🏆 幸存！' : '☠️ 星舰坠落'
  $('end-info').innerHTML = `
    <div class="end-stats">存活 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} · 击毁 ${kills}</div>
    <div class="end-coins">◈ 获得 ${coinsEarned}${inRunCoins ? `（含局内拾取 ${inRunCoins}）` : ''}</div>
    ${won ? '' : '<div class="end-hint">差一点！再来一局攒金币变强</div>'}
  `
  $('end-screen').classList.remove('hidden')
}

// 试玩超时 → 付费墙
function showPaywall() {
  $('end-screen').classList.add('hidden')
  $('paywall-screen').classList.remove('hidden')
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
  $('btn-paywall-menu').addEventListener('click', () => {
    if (game) { game.destroy(); game = null }
    $('paywall-screen').classList.add('hidden')
    $('menu-screen').classList.remove('hidden')
    buildMenu()
  })
  // 付费墙内兑换：成功 → 立即以完整版开新局
  setupRedeem('paywall-redeem-input', 'paywall-redeem-btn', 'paywall-redeem-msg', () => {
    $('paywall-screen').classList.add('hidden')
    startGame()
  })

  // 移动控制（WASD + 方向键 + 触屏）——按住移动、松开停止，多键不冲突
  const moveKeys = { w: false, s: false, a: false, d: false }
  const syncMove = () => {
    if (!game) return
    let x = 0
    let y = 0
    if (moveKeys.w) y -= 1
    if (moveKeys.s) y += 1
    if (moveKeys.a) x -= 1
    if (moveKeys.d) x += 1
    game.setMove(x, y)
  }
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') moveKeys.w = true
    else if (k === 's' || k === 'arrowdown') moveKeys.s = true
    else if (k === 'a' || k === 'arrowleft') moveKeys.a = true
    else if (k === 'd' || k === 'arrowright') moveKeys.d = true
    else return
    syncMove()
  })
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') moveKeys.w = false
    else if (k === 's' || k === 'arrowdown') moveKeys.s = false
    else if (k === 'a' || k === 'arrowleft') moveKeys.a = false
    else if (k === 'd' || k === 'arrowright') moveKeys.d = false
    else return
    syncMove()
  })

  bindRedeem(() => buildMenu())
}

initMusic()
bindUI()
buildMenu()
// 首次点击时解锁音频 + 音效（浏览器策略）
window.addEventListener('pointerdown', () => {
  resumeMusic()
  ensureSfxCtx()
}, { once: true })

// 全局错误兜底：不白屏
window.addEventListener('error', (e) => {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#D06040;color:#fff;padding:10px 16px;border-radius:12px;z-index:999;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);'
  el.textContent = `出错了：${e.message || '未知错误'} · 请刷新重试`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 6000)
})
