// 3D 模型加载 + 玩家精致飞船建模

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const BASE = (import.meta as any).env?.BASE_URL || '/'
const loader = new GLTFLoader()
const cache = new Map<string, Promise<THREE.Object3D | null>>()

export function modelUrl(name: string): string {
  return `${BASE}assets/models/${name}.glb`
}

export function loadModel(name: string): Promise<THREE.Object3D | null> {
  const cached = cache.get(name)
  if (cached) return cached
  const p = new Promise<THREE.Object3D | null>((resolve) => {
    loader.load(modelUrl(name), (gltf) => resolve(gltf.scene), undefined, () => resolve(null))
  })
  cache.set(name, p)
  return p
}

export async function spawnModel(name: string, color?: number): Promise<THREE.Object3D | null> {
  const src = await loadModel(name)
  if (!src) return null
  const clone = src.clone(true)
  if (color !== undefined) {
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        const mat = mesh.material as any
        if (mat && mat.emissive !== undefined) {
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = 0.25
        } else if (mat && mat.color) {
          mat.color.lerp(new THREE.Color(color), 0.3)
        }
      }
    })
  }
  return clone
}

// ===== 玩家：精致程序化飞船（多层机身 + 机翼 + 座舱 + 引擎光） =====
export function buildHeroShip(color: number): THREE.Object3D {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x22304f, roughness: 0.5, metalness: 0.5 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 })

  // 机身（长圆体，Y 轴朝上，Z 轴朝前）
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 10), metal)
  body.rotation.x = Math.PI / 2
  g.add(body)
  // 机头锥
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 10), metal)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = 0.62
  g.add(nose)
  // 主翼（左右）
  const wingGeo = new THREE.BoxGeometry(0.12, 0.04, 0.6)
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, dark)
    wing.position.set(side * 0.42, 0.02, -0.05)
    wing.rotation.z = side * -0.25
    g.add(wing)
    const wingtip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), metal)
    wingtip.position.set(side * 0.62, 0.02, -0.25)
    g.add(wingtip)
  }
  // 垂直尾翼
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.2), dark)
  fin.position.set(0, 0.2, -0.4)
  g.add(fin)
  // 座舱
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glass)
  cockpit.position.set(0, 0.18, 0.25)
  cockpit.scale.set(1, 0.8, 1.4)
  g.add(cockpit)
  // 双引擎（尾部发光）
  for (const side of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 10), dark)
    eng.rotation.x = Math.PI / 2
    eng.position.set(side * 0.18, -0.02, -0.62)
    g.add(eng)
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.9 }),
    )
    glow.position.set(side * 0.18, -0.02, -0.8)
    g.add(glow)
  }
  g.position.y = 0.6
  return g
}

// ===== 敌人飞船：基于 UFO 模型，按类型差异化 =====
export const ENEMY_MODEL_MAP: Record<string, string> = {
  mite: 'enemy-ufo-a',
  imp: 'enemy-ufo-b',
  brute: 'enemy-ufo-c',
  phantom: 'enemy-ufo-a',
  boss: 'enemy-ufo-d',
}

export function enemyModelName(id: string): string {
  return ENEMY_MODEL_MAP[id] || 'enemy-ufo-a'
}

export function preloadModels() {
  Object.values(ENEMY_MODEL_MAP).forEach((n) => void loadModel(n))
}
