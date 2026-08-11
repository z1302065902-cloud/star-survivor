// 星际幸存者 · 核心引擎（自动攻击肉鸽生存）

import * as THREE from 'three'
import {
  WEAPONS, PASSIVES, ENEMIES, TRIAL_MINUTES, FULL_MINUTES,
  type WeaponId, type PassiveId, type EnemyId, type CharDef, type UpgradeOption,
} from './data'
import { buildHeroShip, enemyModelName, spawnModel, preloadModels } from './assets'

export interface GameEvents {
  onLevelUp: (options: UpgradeOption[]) => void
  onHp: (hp: number, maxHp: number) => void
  onXp: (level: number, xp: number, need: number) => void
  onTimer: (sec: number) => void
  onGameOver: (sec: number, kills: number, won: boolean) => void
  onCoins: (coins: number) => void
}

interface Enemy {
  def: EnemyId
  hp: number
  maxHp: number
  mesh: THREE.Object3D
  pos: THREE.Vector2
  radius: number
  damage: number
  xp: number
  hitFlash: number
  dead: boolean
}

interface Pickup {
  mesh: THREE.Object3D
  pos: THREE.Vector2
  kind: 'xp' | 'coin'
  value: number
}

interface Projectile {
  mesh: THREE.Object3D
  pos: THREE.Vector2
  vel: THREE.Vector2
  damage: number
  life: number
  kind: 'star' | 'nova' | 'comet'
  dead: boolean
}

export class SurvivorGame {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.OrthographicCamera
  clock = new THREE.Clock()
  group = new THREE.Group()

  char: CharDef
  events: GameEvents
  isFull: boolean

  // 玩家
  playerMesh: THREE.Object3D
  playerPos = new THREE.Vector2(0, 0)
  playerVel = new THREE.Vector2(0, 0)
  hp: number
  maxHp: number
  speed: number
  move = { x: 0, y: 0 }

  // 战斗
  weapons = new Map<WeaponId, number>() // weaponId -> level
  passives = new Set<PassiveId>()
  statPower = 0
  statHaste = 0
  statArmor = 0
  statRegen = 0
  statMagnet = 1
  statCrystal = 0

  enemies: Enemy[] = []
  pickups: Pickup[] = []
  projectiles: Projectile[] = []
  orbitOrbs: { mesh: THREE.Object3D; angle: number }[] = []
  novaFlash = 0
  beamTimer = 0
  beamDir = new THREE.Vector2(0, -1)

  xp = 0
  level = 1
  kills = 0
  coins = 0
  elapsed = 0
  timer = 0
  spawnTimer = 0
  spawnCount = 0
  gameOver = false
  won = false

  private raf = 0
  private disposeFn: () => void
  private levelQueue: UpgradeOption[] = []
  private weaponTimers = new Map<WeaponId, number>()
  private keyState = new Set<string>()
  private touchDir = new THREE.Vector2(0, 0)

  constructor(canvas: HTMLCanvasElement, char: CharDef, isFull: boolean, events: GameEvents) {
    this.char = char
    this.events = events
    this.isFull = isFull
    this.hp = char.hp
    this.maxHp = char.hp
    this.speed = char.speed

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true

    // 俯视角相机
    const size = 14
    this.camera = new THREE.OrthographicCamera(-size, size, size * 0.7, -size * 0.7, 0.1, 100)
    this.camera.position.set(0, 20, 0)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(this.group)
    this.scene.fog = new THREE.FogExp2(0x1a1030, 0.012)
    this.scene.background = new THREE.Color(0x1a1030)

    // 灯光
    this.scene.add(new THREE.HemisphereLight(0xfff8e8, 0x9f7cff, 1.2))
    const dir = new THREE.DirectionalLight(0xfff0d0, 1.2)
    dir.position.set(5, 15, 5)
    this.scene.add(dir)

    // 预加载 UFO 模型（后台拉取，敌人生成时立即可用）
    preloadModels()
    // 星空地面
    this.buildGround()
    // 玩家
    this.playerMesh = this.buildPlayer(char.color)
    this.group.add(this.playerMesh)
    // 默认武器：星光弹
    this.weapons.set('star_shot', 1)
    this.weaponTimers.set('star_shot', 0)

    this.disposeFn = this.bindControls()
    this.loop()
  }

  private buildGround() {
    const g = new THREE.PlaneGeometry(120, 120)
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.9 })
    const ground = new THREE.Mesh(g, mat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    this.group.add(ground)
    // 装饰星星点
    const geo = new THREE.BufferGeometry()
    const pts: number[] = []
    for (let i = 0; i < 300; i++) {
      pts.push((Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 100)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.5 }))
    stars.position.y = -0.4
    this.group.add(stars)
  }

  private buildPlayer(color: number): THREE.Object3D {
    return buildHeroShip(color)
  }

  private enemyMesh(id: EnemyId): THREE.Object3D {
    const def = ENEMIES[id]
    const g = new THREE.Group()
    // 用真实 UFO 模型（异步加载，先放占位环避免空）
    const placeholder = new THREE.Mesh(
      new THREE.IcosahedronGeometry(def.radius, 0),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.3 }),
    )
    g.add(placeholder)
    void spawnModel(enemyModelName(id), def.color).then((m) => {
      if (!m) return
      // 移除占位
      placeholder.removeFromParent()
      const s = (def.radius / 0.5) * 1.4
      m.scale.setScalar(s)
      m.position.y = 0.2
      g.add(m)
      g.userData.model = m
    })
    if (id === 'boss') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(def.radius * 1.4, 0.1, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0xff3b6b }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.3
      g.add(ring)
    }
    return g
  }

  private bindControls() {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      this.keyState[down ? 'add' : 'delete'](k)
    }
    const kd = onKey(true)
    const ku = onKey(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    // 触屏：触摸移动（虚拟方向）
    const canvas = this.renderer.domElement
    const onTouch = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 0) { this.touchDir.set(0, 0); return }
      // 相对屏幕中心的方向
      const t = e.touches[0]
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      this.touchDir.set(
        (t.clientX - cx) / (window.innerWidth / 2),
        (t.clientY - cy) / (window.innerHeight / 2),
      )
      if (this.touchDir.length() > 1) this.touchDir.normalize()
    }
    canvas.addEventListener('touchstart', onTouch, { passive: false })
    canvas.addEventListener('touchmove', onTouch, { passive: false })
    canvas.addEventListener('touchend', onTouch, { passive: false })

    const onResize = () => {
      const size = 14
      const aspect = window.innerWidth / window.innerHeight
      this.camera.left = -size
      this.camera.right = size
      this.camera.top = size * 0.7 * (aspect < 1 ? 1 : aspect)
      this.camera.bottom = -size * 0.7 * (aspect < 1 ? 1 : aspect)
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    onResize()

    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('resize', onResize)
    }
  }

  setMove(x: number, y: number) {
    this.move.x = x
    this.move.y = y
  }

  // ===== 升级系统 =====
  private gainXp(n: number) {
    if (this.gameOver) return
    this.xp += n
    const need = this.xpNeed()
    while (this.xp >= need) {
      this.xp -= need
      this.level++
      const opts = this.rollUpgrades()
      this.levelQueue.push(...opts)
      if (this.levelQueue.length === 1) this.events.onLevelUp(this.levelQueue)
    }
    this.events.onXp(this.level, this.xp, this.xpNeed())
  }

  xpNeed(): number {
    return 5 + this.level * 3
  }

  private rollUpgrades(): UpgradeOption[] {
    const opts: UpgradeOption[] = []
    // 新武器（最多6种）
    const ownedWeapons = Array.from(this.weapons.keys())
    if (ownedWeapons.length < 6) {
      const avail = Object.values(WEAPONS).filter(w => !ownedWeapons.includes(w.id))
      if (avail.length) {
        const w = avail[Math.floor(Math.random() * avail.length)]
        opts.push({ type: 'weapon', id: w.id, name: `新武器：${w.name}`, desc: w.desc, color: w.color })
      }
    }
    // 升级已有武器
    for (const [wid, lvl] of this.weapons) {
      const def = WEAPONS[wid]
      if (lvl < def.maxLevel) {
        const evo = lvl + 1 === def.maxLevel && def.evolveName ? `（进化→${def.evolveName}）` : ''
        opts.push({ type: 'weapon', id: wid, name: `${def.name} Lv.${lvl + 1}`, desc: `伤害/效果提升${evo}`, color: def.color })
      }
    }
    // 新被动
    for (const pid of Object.keys(PASSIVES) as PassiveId[]) {
      if (!this.passives.has(pid) && opts.length < 4) {
        const p = PASSIVES[pid]
        opts.push({ type: 'passive', id: pid, name: p.name, desc: p.desc, color: 0x9f7cff })
      }
    }
    // 兜底：属性
    if (opts.length < 3) {
      opts.push({ type: 'stat', id: 'power', name: '火力+10%', desc: '提升伤害', color: 0xff6f61 })
      opts.push({ type: 'stat', id: 'haste', name: '急速+10%', desc: '提升攻速', color: 0x4fd1ff })
      opts.push({ type: 'stat', id: 'armor', name: '装甲+10%', desc: '减少伤害', color: 0x7ae0ff })
    }
    // 打乱取3
    opts.sort(() => Math.random() - 0.5)
    return opts.slice(0, 3)
  }

  applyUpgrade(opt: UpgradeOption) {
    if (opt.type === 'weapon') {
      const wid = opt.id as WeaponId
      const cur = this.weapons.get(wid) || 0
      this.weapons.set(wid, cur + 1)
      if (!this.weaponTimers.has(wid)) this.weaponTimers.set(wid, 0)
    } else if (opt.type === 'passive') {
      this.passives.add(opt.id as PassiveId)
      // 被动立即生效：磁力、火力、急速、护甲、再生、聚晶
      if (opt.id === 'magnet') this.statMagnet += 1.2
      if (opt.id === 'haste') this.statHaste += 0.2
      if (opt.id === 'power') this.statPower += 0.2
      if (opt.id === 'armor') this.statArmor += 0.15
      if (opt.id === 'regen') this.statRegen += 0.8
      if (opt.id === 'crystal') this.statCrystal += 0.3
    } else {
      if (opt.id === 'power') this.statPower += 0.1
      if (opt.id === 'haste') this.statHaste += 0.1
      if (opt.id === 'armor') this.statArmor += 0.1
    }
    // 弹出下一个升级
    this.levelQueue.shift()
    if (this.levelQueue.length) this.events.onLevelUp(this.levelQueue)
  }

  // ===== 敌人生成 =====
  private spawnEnemy() {
    let id: EnemyId = 'mite'
    const t = Math.min(this.elapsed / 300, 1) // 随时间难度
    if (t < 0.2) id = 'mite'
    else if (t < 0.4) id = Math.random() < 0.6 ? 'imp' : 'mite'
    else if (t < 0.6) id = Math.random() < 0.5 ? 'imp' : 'brute'
    else if (t < 0.8) id = Math.random() < 0.5 ? 'phantom' : 'imp'
    else id = 'brute'
    // Boss 每 60 秒
    if (Math.floor(this.elapsed / 60) > Math.floor((this.elapsed - 1) / 60)) id = 'boss'
    const def = ENEMIES[id]
    // 从屏幕边缘生成
    const angle = Math.random() * Math.PI * 2
    const dist = 12
    const pos = new THREE.Vector2(this.playerPos.x + Math.cos(angle) * dist, this.playerPos.y + Math.sin(angle) * dist)
    // HP 随难度成长
    const scale = 1 + this.elapsed / 240
    const hp = Math.round(def.hp * scale)
    const mesh = this.enemyMesh(id)
    mesh.position.set(pos.x, 0.4, pos.y)
    this.group.add(mesh)
    this.enemies.push({ def: id, hp, maxHp: hp, mesh, pos, radius: def.radius, damage: def.damage, xp: def.xp, hitFlash: 0, dead: false })
  }

  // ===== 更新 =====
  private update(dt: number) {
    this.elapsed += dt
    this.timer += dt

    // 玩家移动
    let mx = this.move.x + this.touchDir.x
    let my = this.move.y + this.touchDir.y
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my)
      mx /= len; my /= len
      this.playerPos.x += mx * this.speed * dt
      this.playerPos.y += my * this.speed * dt
      // 朝向
      this.playerMesh.lookAt(this.playerPos.x, 0.3, this.playerPos.y)
    }
    this.playerMesh.position.set(this.playerPos.x, 0.3, this.playerPos.y)

    // 再生
    if (this.statRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.statRegen * dt)
      this.events.onHp(Math.round(this.hp), this.maxHp)
    }

    // 生成敌人
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.25, 1.2 - this.elapsed / 400)
      this.spawnEnemy()
      // 随难度增加密度
      if (this.elapsed > 120 && this.spawnCount % 3 === 0) this.spawnEnemy()
      this.spawnCount++
    }

    // 敌人移动 + 碰撞
    for (const en of this.enemies) {
      const dx = this.playerPos.x - en.pos.x
      const dy = this.playerPos.y - en.pos.y
      const d = Math.hypot(dx, dy)
      if (d > 0.1) {
        en.pos.x += (dx / d) * ENEMIES[en.def].speed * dt
        en.pos.y += (dy / d) * ENEMIES[en.def].speed * dt
      }
      en.mesh.position.set(en.pos.x, 0.4, en.pos.y)
      // 面向玩家（UFO 的 -Z 朝向移动方向）
      en.mesh.lookAt(this.playerPos.x, 0.4, this.playerPos.y)
      // 接触伤害
      if (d < 0.9 + en.radius) {
        const dmg = Math.max(1, Math.round(en.damage * (1 - this.statArmor)))
        this.damagePlayer(dmg)
      }
      // 受击闪白
      if (en.hitFlash > 0) en.hitFlash -= dt
    }
    this.enemies = this.enemies.filter(e => !e.dead)

    // 武器自动攻击
    this.fireWeapons(dt)

    // 弹体更新
    for (const pr of this.projectiles) {
      pr.pos.add(pr.vel.clone().multiplyScalar(dt))
      pr.mesh.position.set(pr.pos.x, 0.6, pr.pos.y)
      pr.life -= dt
      // 命中检测
      for (const en of this.enemies) {
        if (en.dead) continue
        if (en.pos.distanceTo(pr.pos) < en.radius + 0.3) {
          this.damageEnemy(en, pr.damage)
          pr.dead = true
          pr.mesh.visible = false
          break
        }
      }
      if (pr.life <= 0) { pr.dead = true; pr.mesh.visible = false }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead)

    // 光环武器（aura 持续伤害周围）
    for (const [wid, lvl] of this.weapons) {
      if (WEAPONS[wid].kind === 'aura') {
        const dmg = WEAPONS[wid].damage * lvl * (1 + this.statPower)
        const radius = 3
        for (const en of this.enemies) {
          if (!en.dead && en.pos.distanceTo(this.playerPos) < radius) {
            this.damageEnemy(en, dmg * dt)
          }
        }
      }
    }

    // 星环轨道
    if (this.weapons.has('orbit')) {
      const lvl = this.weapons.get('orbit')!
      const count = 2 + lvl
      while (this.orbitOrbs.length < count) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x9f7cff, emissive: 0x9f7cff, emissiveIntensity: 0.6 }),
        )
        this.group.add(orb)
        this.orbitOrbs.push({ mesh: orb, angle: (this.orbitOrbs.length / count) * Math.PI * 2 })
      }
      const speed = 2 + lvl * 0.5
      const radius = 2.2
      for (const o of this.orbitOrbs) {
        o.angle += speed * dt
        const x = this.playerPos.x + Math.cos(o.angle) * radius
        const z = this.playerPos.y + Math.sin(o.angle) * radius
        o.mesh.position.set(x, 0.5, z)
        // 轨道伤害
        for (const en of this.enemies) {
          if (!en.dead && en.pos.distanceTo(new THREE.Vector2(x, z)) < en.radius + 0.35) {
            this.damageEnemy(en, WEAPONS.orbit.damage * lvl * (1 + this.statPower) * dt * 2)
          }
        }
      }
    }

    // 拾取物吸附 + 收集
    const magnetR = 1.2 * this.statMagnet
    for (const pk of this.pickups) {
      const d = pk.pos.distanceTo(this.playerPos)
      if (d < magnetR) {
        const dir = this.playerPos.clone().sub(pk.pos).normalize()
        pk.pos.add(dir.multiplyScalar(8 * dt))
      }
      if (d < 0.8) {
        pk.mesh.visible = false
        if (pk.kind === 'xp') this.gainXp(pk.value)
        else { this.coins += pk.value; this.events.onCoins(this.coins) }
        pk.mesh.removeFromParent()
        pk.value = -1 // 标记移除
      }
    }
    this.pickups = this.pickups.filter(p => p.value >= 0)

    // 新星爆特效
    if (this.novaFlash > 0) this.novaFlash -= dt

    // 计时
    const target = this.isFull ? FULL_MINUTES : TRIAL_MINUTES
    if (this.timer >= target * 60 && !this.gameOver) {
      this.gameOver = true
      this.won = true
      this.events.onGameOver(Math.round(this.timer), this.kills, true)
    }
    this.events.onTimer(Math.floor(this.timer))
  }

  private fireWeapons(dt: number) {
    for (const [wid, lvl] of this.weapons) {
      const def = WEAPONS[wid]
      if (def.kind === 'orbit' || def.kind === 'aura') continue
      const t = this.weaponTimers.get(wid) || 0
      const next = t - dt
      this.weaponTimers.set(wid, next)
      if (next > 0) continue
      const cd = def.cooldown / (1 + this.statHaste)
      this.weaponTimers.set(wid, cd)
      const dmg = def.damage * lvl * (1 + this.statPower)

      if (wid === 'beam') {
        // 光之刃：朝移动方向
        const dir = (this.move.x || this.touchDir.x) !== 0 || (this.move.y || this.touchDir.y) !== 0
          ? new THREE.Vector2(this.move.x + this.touchDir.x, this.move.y + this.touchDir.y).normalize()
          : new THREE.Vector2(0, -1)
        this.spawnBeam(dir, dmg, lvl)
      } else {
        // 找最近敌人
        let best: Enemy | null = null
        let bd = Infinity
        for (const en of this.enemies) {
          if (en.dead) continue
          const d = en.pos.distanceTo(this.playerPos)
          if (d < bd) { bd = d; best = en }
        }
        if (best) {
          const dir = best.pos.clone().sub(this.playerPos).normalize()
          const speed = wid === 'comet' ? 7 : 12
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(wid === 'comet' ? 0.35 : 0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: def.color }),
          )
          m.position.set(this.playerPos.x, 0.6, this.playerPos.y)
          this.group.add(m)
          this.projectiles.push({
            mesh: m, pos: this.playerPos.clone(), vel: dir.multiplyScalar(speed),
            damage: dmg, life: 2, kind: 'star', dead: false,
          })
        }
      }
    }
  }

  private spawnBeam(dir: THREE.Vector2, dmg: number, lvl: number) {
    const len = 3 + lvl * 0.3
    const a = this.playerPos.clone()
    const b = a.clone().add(dir.clone().multiplyScalar(len))
    const mat = new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.6 })
    const h = a.distanceTo(b)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h, 6), mat)
    mesh.position.set((a.x + b.x) / 2, 0.6, (a.y + b.y) / 2)
    const tgt = new THREE.Vector3(b.x, 0.6, b.y)
    mesh.lookAt(tgt)
    mesh.rotateX(Math.PI / 2)
    this.group.add(mesh)
    // 光束伤害
    for (const en of this.enemies) {
      if (en.dead) continue
      // 点到线段距离近似
      const proj = dir.clone().dot(en.pos.clone().sub(a))
      if (proj >= 0 && proj <= len) {
        const perp = en.pos.distanceTo(a.clone().add(dir.clone().multiplyScalar(proj)))
        if (perp < 0.8) this.damageEnemy(en, dmg)
      }
    }
    // 视觉光束自动消失
    setTimeout(() => mesh.removeFromParent(), 120)
  }

  private damageEnemy(en: Enemy, dmg: number) {
    en.hp -= dmg
    en.hitFlash = 0.1
    if (en.hp <= 0) {
      en.dead = true
      en.mesh.removeFromParent()
      this.kills++
      // 掉 XP 晶体
      this.spawnPickup(en.pos, 'xp', en.xp)
      // 偶尔掉金币
      if (Math.random() < 0.08) this.spawnPickup(en.pos, 'coin', 1)
    }
  }

  private spawnPickup(pos: THREE.Vector2, kind: 'xp' | 'coin', value: number) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(kind === 'xp' ? 0.18 : 0.22, 0),
      new THREE.MeshBasicMaterial({ color: kind === 'xp' ? 0x4fd1ff : 0xffd166 }),
    )
    const p = pos.clone()
    p.x += (Math.random() - 0.5) * 0.6
    p.y += (Math.random() - 0.5) * 0.6
    mesh.position.set(p.x, 0.4, p.y)
    this.group.add(mesh)
    this.pickups.push({ mesh, pos: p, kind, value })
  }

  private damagePlayer(dmg: number) {
    if (this.gameOver) return
    this.hp -= dmg
    this.events.onHp(Math.max(0, Math.round(this.hp)), this.maxHp)
    if (this.hp <= 0) {
      this.gameOver = true
      this.won = false
      this.events.onGameOver(Math.round(this.timer), this.kills, false)
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (!this.gameOver) this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.disposeFn()
    this.renderer.dispose()
  }
}
