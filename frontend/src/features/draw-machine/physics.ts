import type RAPIER from '@dimforge/rapier3d-compat'
import { CylinderGeometry, Quaternion, SphereGeometry, Vector3 } from 'three'
import {
  defaultSimulation,
  validateSimulation,
  EXIT_DEPTH,
  OUTLET_ANGLE,
  outletPoint,
  outletCoordinates,
  type SimulationConfig,
} from './config'

export const STEP = 1 / 60
export const RADIUS = 2.5
export const BALL_RADIUS = 0.19
export const OPENING_ANGLE = 0.16
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
  config: Readonly<SimulationConfig>
  rotor: RAPIER.RigidBody
}

export function createMachine(
  world: RAPIER.World,
  rapier: typeof RAPIER,
  max: number,
  random: () => number = Math.random,
  count: number,
  config: Readonly<SimulationConfig> = defaultSimulation,
): Machine {
  // Game definitions come from the API; physics must not infer their main count.
  if (!Number.isInteger(max) || !Number.isInteger(count) || count < 1 || count > max) {
    throw new Error('Số lượng kết quả phải là số nguyên dương trong phạm vi số bóng.')
  }
  validateSimulation(config)
  const scale = config.radius / RADIUS
  const positions: Point[] = []
  const spacing = 2 * config.ballRadius + 0.05
  for (let x = -1.72 * scale; x <= 1.73 * scale; x += spacing)
    for (let y = -1.72 * scale; y <= 1.73 * scale; y += spacing)
      for (let z = -1.72 * scale; z <= 1.73 * scale; z += spacing) {
        const insideRotor =
          Math.abs(Math.abs(x) - 0.9 * scale) < 0.055 * scale + config.ballRadius &&
          Math.abs(y) < 1.85 * scale + config.ballRadius &&
          Math.abs(z) < 0.12 * scale + config.ballRadius
        if (
          !insideRotor &&
          Math.hypot(x, y, z) < 1.95 * scale &&
          Math.hypot(y, z) > 0.105 * scale + config.ballRadius + 0.04
        )
          positions.push({ x, y, z })
      }
  if (positions.length < max) throw new Error('Không đủ không gian cho pool bóng này.')
  const geometry = new SphereGeometry(
    config.radius,
    48,
    32,
    0,
    Math.PI * 2,
    0,
    Math.PI - OPENING_ANGLE,
  )
  geometry.rotateX(OUTLET_ANGLE)
  const shell = world.createCollider(
    rapier.ColliderDesc.trimesh(
      new Float32Array(geometry.attributes.position.array),
      new Uint32Array(geometry.index!.array),
    )
      .setFriction(config.friction)
      .setRestitution(0.55),
  )
  geometry.dispose()
  const fixed = [shell]
  const funnel = new CylinderGeometry(0.8 * scale, 0.37 * scale, 0.7 * scale, 24, 1, true)
  funnel.rotateX(OUTLET_ANGLE)
  const funnelCenter = outletPoint(2.2 * scale)
  funnel.translate(funnelCenter.x, funnelCenter.y, funnelCenter.z)
  fixed.push(
    world.createCollider(
      rapier.ColliderDesc.trimesh(
        new Float32Array(funnel.attributes.position.array),
        new Uint32Array(funnel.index!.array),
      )
        .setFriction(0.02)
        .setRestitution(0.1),
    ),
  )
  funnel.dispose()
  const portRotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), OUTLET_ANGLE)
  // A hollow throat, not a solid cylinder. Its width only permits a single file.
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24
    const position = outletPoint(
      2.87 * scale,
      Math.cos(angle) * 0.42 * scale,
      Math.sin(angle) * 0.42 * scale,
    )
    const rotation = portRotation
      .clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -angle))
    fixed.push(
      world.createCollider(
        rapier.ColliderDesc.cuboid(0.047 * scale, 0.43 * scale, 0.04 * scale)
          .setTranslation(position.x, position.y, position.z)
          .setRotation(rotation)
          .setFriction(0.02)
          .setRestitution(0.1),
      ),
    )
  }
  const gatePosition = outletPoint(2.55 * scale)
  const gate = world.createCollider(
    rapier.ColliderDesc.cuboid(0.43 * scale, 0.045 * scale, 0.43 * scale)
      .setTranslation(gatePosition.x, gatePosition.y, gatePosition.z)
      .setRotation(portRotation)
      .setRestitution(0.15),
  )
  fixed.push(gate)
  fixed.push(
    world.createCollider(
      rapier.ColliderDesc.cylinder(2.6 * scale, 0.105 * scale)
        .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
        .setFriction(config.friction),
    ),
  )
  const rotor = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased())
  for (const x of [-0.9, 0.9])
    world.createCollider(
      rapier.ColliderDesc.cuboid(0.055 * scale, 1.85 * scale, 0.12 * scale)
        .setTranslation(x * scale, 0, 0)
        .setRestitution(0.25)
        .setFriction(config.friction),
      rotor,
    )
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }
  const balls = Array.from({ length: max }, (_, index) => {
    const position = positions[index]
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(config.linearDamping)
        .setAngularDamping(config.angularDamping)
        .setCcdEnabled(true),
    )
    world.createCollider(
      rapier.ColliderDesc.ball(config.ballRadius)
        .setMass(config.mass)
        .setRestitution(config.restitution)
        .setFriction(config.friction),
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
    config: Object.freeze({ ...config }),
    rotor,
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
  m.rotor.setEnabled(enabled)
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
  const angle = -m.elapsed * m.config.rotationSpeed
  m.rotor.setNextKinematicRotation({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) })
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
    // Alternate tumbling and release: continuous upward forcing holds balls against
    // the aperture lip. This is a global mechanical cycle, never a number selection.
    const stirring = m.status === 'mixing' || m.phaseTime % 1.8 < 0.9
    const circulation = (7 * m.config.rotationSpeed) / defaultSimulation.rotationSpeed
    ball.body.applyImpulse(
      stirring
        ? {
            x: (p.x * 3 + noise() * 12) * STEP,
            y: (p.z * circulation + p.y * 3 + 11 + noise() * 12) * STEP,
            z: (-p.y * circulation + p.z * 3 + Math.sin(m.elapsed * 2) * 8 + noise() * 15) * STEP,
          }
        : { x: noise() * 3 * STEP, y: 0, z: noise() * 3 * STEP },
      true,
    )
    const v = ball.body.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)
    if (speed > m.config.maxSpeed)
      ball.body.setLinvel(
        {
          x: (v.x * m.config.maxSpeed) / speed,
          y: (v.y * m.config.maxSpeed) / speed,
          z: (v.z * m.config.maxSpeed) / speed,
        },
        true,
      )
  }
}

export function afterStep(m: Machine) {
  if (!isRunning(m)) return
  const crossings: { ball: MachineBall; fraction: number }[] = []
  const scale = m.config.radius / RADIUS
  for (const ball of m.balls) {
    if (ball.captured) continue
    const p = ball.body.translation()
    const local = outletCoordinates(p)
    const previous = outletCoordinates(ball.previous)
    const radial = Math.hypot(local.x, local.side)
    if (
      ![p.x, p.y, p.z].every(Number.isFinite) ||
      (Math.hypot(p.x, p.y, p.z) > m.config.radius + 0.15 &&
        !(radial < 0.45 * scale && local.depth > 2.3 * scale && local.depth < 3.5 * scale))
    ) {
      m.status = 'error'
      m.error = 'Bóng thoát khỏi thành lồng. Hãy tạo phiên mới.'
      setBodiesEnabled(m, false)
      return
    }
    if (
      !m.gate.isEnabled() &&
      previous.depth < EXIT_DEPTH * scale &&
      local.depth >= EXIT_DEPTH * scale
    ) {
      const fraction = (EXIT_DEPTH * scale - previous.depth) / (local.depth - previous.depth)
      const x = previous.x + (local.x - previous.x) * fraction
      const side = previous.side + (local.side - previous.side) * fraction
      if (Math.hypot(x, side) < 0.31 * scale) crossings.push({ ball, fraction })
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
  if (m.world.getRigidBody(m.rotor.handle) === m.rotor) m.world.removeRigidBody(m.rotor)
}
