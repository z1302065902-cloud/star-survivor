// 星际幸存者 · 游戏数据定义

// ===== 武器 =====
export type WeaponId = 'star_shot' | 'orbit' | 'nova' | 'beam' | 'comet' | 'aura'

export interface WeaponDef {
  id: WeaponId
  name: string
  desc: string
  maxLevel: number
  /** 攻击间隔（秒） */
  cooldown: number
  damage: number
  color: number
  /** 特殊行为标记 */
  kind: 'projectile' | 'orbit' | 'aura' | 'beam'
  /** 满级+被动 → 进化的武器描述（提升） */
  evolveName?: string
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  star_shot: { id: 'star_shot', name: '星光弹', desc: '自动朝最近敌人发射光弹', maxLevel: 5, cooldown: 0.8, damage: 8, color: 0xffd166, kind: 'projectile', evolveName: '超星光弹' },
  orbit: { id: 'orbit', name: '星环', desc: '环绕自身的光环持续伤害', maxLevel: 5, cooldown: 0.4, damage: 5, color: 0x9f7cff, kind: 'orbit' },
  nova: { id: 'nova', name: '新星爆', desc: '周期性向四周爆发', maxLevel: 5, cooldown: 2.5, damage: 20, color: 0xff6f61, kind: 'projectile', evolveName: '超新星' },
  beam: { id: 'beam', name: '光之刃', desc: '朝移动方向发射光束', maxLevel: 5, cooldown: 1.2, damage: 12, color: 0x4fd1ff, kind: 'beam' },
  comet: { id: 'comet', name: '彗星', desc: '召唤彗星轰击最近敌人', maxLevel: 5, cooldown: 1.6, damage: 18, color: 0xff8a3d, kind: 'projectile', evolveName: '流星雨' },
  aura: { id: 'aura', name: '星云护体', desc: '周围敌人持续受到伤害', maxLevel: 5, cooldown: 0.3, damage: 3, color: 0x7ae0ff, kind: 'aura' },
}

// ===== 被动 =====
export type PassiveId = 'magnet' | 'haste' | 'power' | 'armor' | 'regen' | 'crystal'

export interface PassiveDef {
  id: PassiveId
  name: string
  desc: string
  maxLevel: number
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  magnet: { id: 'magnet', name: '磁力', desc: '经验/金币吸附范围增大', maxLevel: 5 },
  haste: { id: 'haste', name: '急速', desc: '所有武器攻速提升', maxLevel: 5 },
  power: { id: 'power', name: '火力', desc: '所有武器伤害提升', maxLevel: 5 },
  armor: { id: 'armor', name: '装甲', desc: '受到的伤害降低', maxLevel: 5 },
  regen: { id: 'regen', name: '再生', desc: '每秒回复生命', maxLevel: 5 },
  crystal: { id: 'crystal', name: '聚晶', desc: '经验获取增加', maxLevel: 5 },
}

// ===== 敌人 =====
export type EnemyId = 'mite' | 'imp' | 'brute' | 'phantom' | 'boss'

export interface EnemyDef {
  id: EnemyId
  name: string
  hp: number
  speed: number
  damage: number
  color: number
  xp: number
  radius: number
  /** 与玩家距离接触的伤害间隔 */
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  mite: { id: 'mite', name: '星虫', hp: 10, speed: 2.6, damage: 5, color: 0xff6f61, xp: 1, radius: 0.4 },
  imp: { id: 'imp', name: '小恶魔', hp: 25, speed: 2.0, damage: 8, color: 0xff8a3d, xp: 2, radius: 0.5 },
  brute: { id: 'brute', name: '巨兽', hp: 60, speed: 1.3, damage: 15, color: 0x9f7cff, xp: 4, radius: 0.8 },
  phantom: { id: 'phantom', name: '幻影', hp: 15, speed: 3.2, damage: 6, color: 0x7ae0ff, xp: 2, radius: 0.4 },
  boss: { id: 'boss', name: '星之领主', hp: 400, speed: 0.8, damage: 30, color: 0xff3b6b, xp: 30, radius: 1.5 },
}

// ===== 升级选项 =====
export interface UpgradeOption {
  type: 'weapon' | 'passive' | 'stat'
  id: string
  name: string
  desc: string
  color: number
}

// ===== 局外养成 =====
export interface MetaSave {
  coins: number
  unlockedChars: string[]
  unlockedWeapons: WeaponId[]
  bestTime: number
  runCount: number
}

export const META_KEY = 'ss-meta-v1'

export const TRIAL_MINUTES = 3 // 免费试玩 3 分钟
export const FULL_MINUTES = 10 // 完整版目标 10 分钟

// ===== 角色 =====
export interface CharDef {
  id: string
  name: string
  desc: string
  hp: number
  speed: number
  color: number
  free: boolean
  passive: string
}

export const CHARS: CharDef[] = [
  { id: 'nova', name: '新星', desc: '均衡的星际战士', hp: 100, speed: 3.2, color: 0x4fd1ff, free: true, passive: '生命上限 +0' },
  { id: 'blaze', name: '烈焰', desc: '火力强大但脆弱', hp: 70, speed: 3.0, color: 0xff8a3d, free: false, passive: '伤害 +15%' },
  { id: 'guard', name: '守护', desc: '皮糙肉厚', hp: 160, speed: 2.6, color: 0x7ae0ff, free: false, passive: '受击减免 +20%' },
  { id: 'spark', name: '电光', desc: '极速身法', hp: 85, speed: 4.2, color: 0xf6ff5e, free: false, passive: '移动速度 +25%' },
]
