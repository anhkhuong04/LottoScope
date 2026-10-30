import type RAPIER from '@dimforge/rapier3d-compat'
import { SphereGeometry } from 'three'

export const STEP = 1 / 60
export const RADIUS = 2.5
export const BALL_RADIUS = 0.19
export const EXIT_Y = -3.05
export const OPENING_ANGLE = 0.12
export type Status = 'ready' | 'mixing' | 'drawing' | 'paused' | 'stalled' | 'complete' | 'error'
type Point = { x: number; y: number; z: number }
export type MachineBall = {
  number: number
  body: RAPIER.RigidBody
  previous: Point
  captured: boolean
}
export type Machine = {
  world: RAPIER.World
  balls: MachineBall[]
  gate: RAPIER.Collider
  fixed: RAPIER.Collider[]
  status: Status
  resumeStatus: 'mixing' | 'drawing'
  drawn: number[]
  elapsed: number
  phaseTime: number
  sinceCapture: number
  error: string | null
  random: () => number
  count: number
}

export function createMachine(
  world: RAPIER.World,
  rapier: typeof RAPIER,
  max: number,
  random: () => number = Math.random,
  count: number,
): Machine {
  // Game definitions come from the API; physics must not infer their main count.
  if (!Number.isInteger(max) || !Number.isInteger(count) || count < 1 || count > max) {
    throw new Error('Số lượng kết quả phải là số nguyên dương trong phạm vi số bóng.')
  }
  const geometry = new SphereGeometry(RADIUS, 48, 32, 0, Math.PI * 2, 0, Math.PI - OPENING_ANGLE)
  const shell = world.createCollider(
    rapier.ColliderDesc.trimesh(
      new Float32Array(geometry.attributes.position.array),
      new Uint32Array(geometry.index!.array),
    )
      .setFriction(0.06)
      .setRestitution(0.55),
  )
  geometry.dispose()
  const fixed = [shell]
  // A hollow throat, not a solid cylinder. Its width only permits a single file.
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24
    fixed.push(
      world.createCollider(
        rapier.ColliderDesc.cuboid(0.047, 0.43, 0.04)
          .setTranslation(Math.cos(angle) * 0.34, -2.87, Math.sin(angle) * 0.34)
          .setRotation({ x: 0, y: -Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
          .setFriction(0.02)
          .setRestitution(0.1),
      ),
    )
  }
  const gate = world.createCollider(
    rapier.ColliderDesc.cuboid(0.43, 0.045, 0.43).setTranslation(0, -2.55, 0).setRestitution(0.15),
  )
  fixed.push(gate)
  const positions: Point[] = []
  for (let x = -1.72; x <= 1.73; x += 0.43)
    for (let y = -1.72; y <= 1.73; y += 0.43)
      for (let z = -1.72; z <= 1.73; z += 0.43)
        if (Math.hypot(x, y, z) < 1.95) positions.push({ x, y, z })
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }
  const balls = Array.from({ length: max }, (_, index) => {
    const position = positions[index]
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.12)
        .setAngularDamping(0.15)
        .setCcdEnabled(true),
    )
    world.createCollider(
      rapier.ColliderDesc.ball(BALL_RADIUS).setMass(1).setRestitution(0.65).setFriction(0.06),
      body,
    )
    return { number: index + 1, body, previous: { ...position }, captured: false }
  })
  return {
    world,
    balls,
    gate,
    fixed,
    status: 'ready',
    resumeStatus: 'mixing',
    drawn: [],
    elapsed: 0,
    phaseTime: 0,
    sinceCapture: 0,
    error: null,
    random,
    count,
  }
}

export function startMachine(m: Machine) {
  if (m.status === 'ready') m.status = 'mixing'
}
export function pauseMachine(m: Machine) {
  if (m.status === 'mixing' || m.status === 'drawing') {
    m.resumeStatus = m.status
    m.status = 'paused'
    setBodiesEnabled(m, false)
  }
}
export function resumeMachine(m: Machine) {
  if (m.status === 'paused') {
    m.status = m.resumeStatus
    setBodiesEnabled(m, true)
  } else if (m.status === 'stalled') {
    m.status = 'mixing'
    m.phaseTime = 0
    m.sinceCapture = 0
    m.gate.setEnabled(true)
    setBodiesEnabled(m, true)
  }
}
function setBodiesEnabled(m: Machine, enabled: boolean) {
  m.balls.forEach((ball) => {
    if (!ball.captured) ball.body.setEnabled(enabled)
  })
}
export function isRunning(m: Machine) {
  return m.status === 'mixing' || m.status === 'drawing'
}

export function beforeStep(m: Machine) {
  if (!isRunning(m)) return
  m.elapsed += STEP
  m.sinceCapture += STEP
  m.phaseTime += STEP
  if (m.status === 'mixing' && m.phaseTime >= (m.drawn.length ? 1.5 : 3)) {
    m.status = 'drawing'
    m.phaseTime = 0
    m.gate.setEnabled(false)
  }
  for (const ball of m.balls) {
    if (ball.captured) continue
    const p = ball.body.translation()
    ball.previous = { ...p }
    const noise = () => m.random() * 2 - 1
    // These stirring forces depend on position/time, never the printed number.
    const stirring = m.status === 'mixing'
    ball.body.applyImpulse(
      stirring
        ? {
            x: (-p.y * 7 + noise() * 12) * STEP,
            y: (p.x * 7 + 11 + noise() * 12) * STEP,
            z: (Math.sin(m.elapsed * 2) * 8 + noise() * 15) * STEP,
          }
        : { x: noise() * 3 * STEP, y: 0, z: noise() * 3 * STEP },
      true,
    )
    const v = ball.body.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)
    if (speed > 9)
      ball.body.setLinvel(
        { x: (v.x * 9) / speed, y: (v.y * 9) / speed, z: (v.z * 9) / speed },
        true,
      )
  }
}

export function afterStep(m: Machine) {
  if (!isRunning(m)) return
  const crossings: { ball: MachineBall; fraction: number }[] = []
  for (const ball of m.balls) {
    if (ball.captured) continue
    const p = ball.body.translation()
    const radial = Math.hypot(p.x, p.z)
    if (
      ![p.x, p.y, p.z].every(Number.isFinite) ||
      (Math.hypot(p.x, p.y, p.z) > RADIUS + 0.15 && !(radial < 0.37 && p.y < -2.3 && p.y > -3.5))
    ) {
      m.status = 'error'
      m.error = 'Bóng thoát khỏi thành lồng. Hãy tạo phiên mới.'
      setBodiesEnabled(m, false)
      return
    }
    if (ball.previous.y > EXIT_Y && p.y <= EXIT_Y) {
      const fraction = (ball.previous.y - EXIT_Y) / (ball.previous.y - p.y)
      const x = ball.previous.x + (p.x - ball.previous.x) * fraction
      const z = ball.previous.z + (p.z - ball.previous.z) * fraction
      if (Math.hypot(x, z) < 0.31) crossings.push({ ball, fraction })
    }
  }
  // If two crossings share a physics step, their interpolated crossing time wins.
  crossings.sort((a, b) => a.fraction - b.fraction)
  for (const { ball } of crossings) {
    if (m.drawn.length === m.count) break
    ball.captured = true
    ball.body.setEnabled(false)
    m.drawn.push(ball.number)
    m.sinceCapture = 0
    m.phaseTime = 0
    m.gate.setEnabled(true)
    m.status = m.drawn.length === m.count ? 'complete' : 'mixing'
  }
  if (m.status === 'complete') setBodiesEnabled(m, false)
  else if (m.sinceCapture >= 30) {
    m.status = 'stalled'
    setBodiesEnabled(m, false)
  }
}

export function destroyMachine(m: Machine) {
  // Physics may free/reset its world before child effect cleanup (StrictMode).
  // Handles can be reused in the replacement world; compare object identity too.
  m.balls.forEach((ball) => {
    if (m.world.getRigidBody(ball.body.handle) === ball.body) m.world.removeRigidBody(ball.body)
  })
  m.fixed.forEach((collider) => {
    if (m.world.getCollider(collider.handle) === collider) m.world.removeCollider(collider, true)
  })
}
