// 付费解锁层：完整版状态 + 局外养成

import { META_KEY, CHARS, type MetaSave, type WeaponId } from './data'

export const AFDIAN_VERIFY_URL: string =
  (import.meta as any).env?.VITE_AFDIAN_VERIFY_URL ||
  '/api/afdian-verify'

export function isFullVersion(): boolean {
  // itch.io 等平台构建时注入 VITE_FULL_VERSION=1 → 直接完整版，无付费墙
  if ((import.meta as any).env?.VITE_FULL_VERSION === '1') return true
  try {
    return localStorage.getItem('ss-paid-v1') === '1'
  } catch {
    return false
  }
}

export function unlockFullVersion(): boolean {
  try {
    localStorage.setItem('ss-paid-v1', '1')
  } catch { /* ignore */ }
  return true
}

// ===== 局外养成 =====
function readMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { coins: 0, unlockedChars: ['nova'], unlockedWeapons: ['star_shot'], bestTime: 0, runCount: 0 }
}

function writeMeta(m: MetaSave) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m))
  } catch { /* ignore */ }
}

export function getMeta(): MetaSave { return readMeta() }

export function addCoins(n: number) {
  const m = readMeta()
  m.coins += n
  writeMeta(m)
}

export function unlockChar(id: string): boolean {
  const m = readMeta()
  if (m.unlockedChars.includes(id)) return false
  const cost = 100
  if (m.coins < cost) return false
  m.coins -= cost
  m.unlockedChars.push(id)
  writeMeta(m)
  return true
}

export function unlockWeapon(id: WeaponId): boolean {
  const m = readMeta()
  if (m.unlockedWeapons.includes(id)) return false
  const cost = 50
  if (m.coins < cost) return false
  m.coins -= cost
  m.unlockedWeapons.push(id)
  writeMeta(m)
  return true
}

export function isCharUnlocked(id: string): boolean {
  if (isFullVersion()) return true
  const c = CHARS.find(x => x.id === id)
  if (c?.free) return true
  return readMeta().unlockedChars.includes(id)
}

export function isWeaponUnlocked(id: WeaponId): boolean {
  if (isFullVersion()) return true
  if (id === 'star_shot') return true
  return readMeta().unlockedWeapons.includes(id)
}

export function recordRun(sec: number, coins: number) {
  const m = readMeta()
  m.runCount++
  if (sec > m.bestTime) m.bestTime = sec
  m.coins += coins
  writeMeta(m)
}
