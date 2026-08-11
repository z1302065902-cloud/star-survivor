// 兑换 UI：爱发电订单号 → 解锁完整版
// （激活码不再支持——游戏只接爱发电自助解锁）

import { AFDIAN_VERIFY_URL, unlockFullVersion } from './paid'

export function bindRedeem(onUnlocked: () => void): void {
  setupRedeem('redeem-input', 'redeem-btn', 'redeem-msg', onUnlocked)
}

/** 可复用的兑换逻辑：主菜单与付费墙共用 */
export function setupRedeem(
  inputId: string,
  btnId: string,
  msgId: string,
  onUnlocked: () => void,
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null
  const btn = document.getElementById(btnId) as HTMLButtonElement | null
  const msg = document.getElementById(msgId) as HTMLElement | null
  if (!input || !msg) return

  const doRedeem = async () => {
    const raw = input.value.trim()
    if (!raw) return
    msg.textContent = '验证中…'
    msg.className = 'redeem-msg'
    // 爱发电订单号 = 14 位以上纯数字
    const digits = raw.replace(/[\s-]/g, '')
    if (!/^\d{14,}$/.test(digits)) {
      msg.textContent = '请输入爱发电订单号（14 位以上纯数字）'
      msg.className = 'redeem-msg err'
      return
    }
    try {
      const order = encodeURIComponent(digits)
      const r = await fetch(`${AFDIAN_VERIFY_URL}?order=${order}`, { method: 'GET' })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; em?: string }
      if (!j.ok) {
        msg.textContent = j.em === 'order not paid' ? '订单未找到或未付款' : '验证失败，请稍后再试'
        msg.className = 'redeem-msg err'
        return
      }
    } catch {
      msg.textContent = '网络错误，请稍后再试'
      msg.className = 'redeem-msg err'
      return
    }
    msg.textContent = '✓ 解锁成功！'
    msg.className = 'redeem-msg ok'
    input.value = ''
    unlockFullVersion()
    onUnlocked()
  }

  btn?.addEventListener('click', (e) => {
    e.stopPropagation()
    void doRedeem()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void doRedeem()
  })
}
