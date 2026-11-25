import type RAPIER from '@dimforge/rapier3d-compat'
import { CylinderGeometry, Quaternion, SphereGeometry, Vector3 } from 'three'
import {
  defaultSimulation,
  validateSimulation,
  EXIT_DEPTH,
  outletCoordinates,
  outletPoint,
  type SimulationConfig,
} from './config'

export const STEP = 1 / 60
export const RADIUS = 2.5
export const OPENING_ANGLE = 0.21
export const ROTOR_ARM_ANGLES = [
  Math.PI / 2,
  Math.PI / 2 + (2 * Math.PI) / 3,
  Math.PI / 2 + (4 * Math.PI) / 3,
] as const

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

function throatInnerRadius(scale: number, ballRadius: number): number {
  return Math.max(0.36 * scale, ballRadius * 1.54)
}

function insideYRotor(x: number, y: number, z: number, scale: number, ballRadius: number): boolean {
  if (Math.hypot(x, y) < 0.15 * scale + ballRadius + 0.04) return true
  if (Math.abs(z) > 0.14 * scale + ballRadius + 0.03) return false
  for (const armAngle of ROTOR_ARM_ANGLES) {
    const ux = Math.cos(armAngle)
    const uy = Math.sin(armAngle)
    const along = x * ux + y * uy
    const perp = Math.abs(-x * uy + y * ux)
    if (
      along > 0.12 * scale - ballRadius &&
      along < 2.15 * scale + ballRadius + 0.03 &&
      perp < 0.055 * scale + ballRadius + 0.03
    ) {
      return true
    }
  }
  return false
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
    throw new Error('Result count must be a positive integer within ball pool range.')
  }
  validateSimulation(config)
  const scale = config.radius / RADIUS
  const throatInner = throatInnerRadius(scale, config.ballRadius)
  const positions: Point[] = []
  const spacing = 2 * config.ballRadius + 0.035
  const spawnLimit = Math.max(2.02 * scale, config.radius - config.ballRadius - 0.12)
  for (let x = -spawnLimit; x <= spawnLimit; x += spacing) {
    for (let y = -spawnLimit; y <= spawnLimit; y += spacing) {
      for (let z = -spawnLimit; z <= spawnLimit; z += spacing) {
        if (Math.hypot(x, y, z) <= spawnLimit && !insideYRotor(x, y, z, scale, config.ballRadius)) {
          positions.push({ x, y, z })
        }
      }
    }
  }
  if (positions.length < max) throw new Error('Insufficient space for this ball pool.')

  // Bottom 6-o'clock circular opening widened gently when larger balls are used.
  const requiredOpening = Math.max(
    OPENING_ANGLE,
    Math.asin(Math.min(0.95, (throatInner + 0.09 * scale) / config.radius)),
  )
  const geometry = new SphereGeometry(
    config.radius,
    48,
    32,
    0,
    Math.PI * 2,
    0,
    Math.PI - requiredOpening,
  )
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

  // Inner funnel guiding balls smoothly into the single-file vertical 6-o'clock neck.
  const funnelTop = Math.max(0.68 * scale, throatInner + 0.28 * scale)
  const funnel = new CylinderGeometry(funnelTop, throatInner, 0.45 * scale, 24, 1, true)
  const funnelCenter = outletPoint(2.38 * scale)
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

  // Single-file vertical throat walls below the bottom aperture.
  const throatWallRadius = throatInner + 0.05 * scale
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24
    const position = outletPoint(
      2.88 * scale,
      Math.cos(angle) * throatWallRadius,
      Math.sin(angle) * throatWallRadius,
    )
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -angle)
    fixed.push(
      world.createCollider(
        rapier.ColliderDesc.cuboid(0.052 * scale, 0.43 * scale, 0.04 * scale)
          .setTranslation(position.x, position.y, position.z)
          .setRotation(rotation)
          .setFriction(0.02)
          .setRestitution(0.1),
      ),
    )
  }

  // Sliding discharge gate near depth 2.58 (EXIT_DEPTH = 2.70 guarantees single-file closure).
  const gatePosition = outletPoint(2.58 * scale)
  const gateHalf = throatInner + 0.06 * scale
  const gate = world.createCollider(
    rapier.ColliderDesc.cuboid(gateHalf, 0.045 * scale, gateHalf)
      .setTranslation(gatePosition.x, gatePosition.y, gatePosition.z)
      .setRestitution(0.15),
  )
  fixed.push(gate)

  // Central Z-axis shaft supporting the 3-arm Y-rotor (last fixed collider for clearance checks).
  fixed.push(
    world.createCollider(
      rapier.ColliderDesc.cylinder(1.8 * scale, 0.14 * scale)
        .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
        .setFriction(config.friction),
    ),
  )

  // Kinematic 3-blade Y-rotor spinning around the Z-axis.
  const rotor = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased())
  for (const armAngle of ROTOR_ARM_ANGLES) {
    const rMid = 1.15 * scale
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), armAngle - Math.PI / 2)
    world.createCollider(
      rapier.ColliderDesc.cuboid(0.055 * scale, 0.95 * scale, 0.14 * scale)
        .setTranslation(Math.cos(armAngle) * rMid, Math.sin(armAngle) * rMid, 0)
        .setRotation(rotation)
        .setRestitution(0.25)
        .setFriction(config.friction),
      rotor,
    )
  }

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
  const angle = m.elapsed * m.config.rotationSpeed
  m.rotor.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })
  if (m.status === 'mixing' && m.phaseTime >= (m.drawn.length ? 1.4 : 2.6)) {
    m.status = 'drawing'
    m.phaseTime = 0
    m.gate.setEnabled(false)
  }
  for (const ball of m.balls) {
    if (ball.captured) continue
    const p = ball.body.translation()
    ball.previous = { ...p }
    const noise = () => m.random() * 2 - 1
    // Global mechanical air/rotor stirring around Z + gentle gravity settling window during drawing.
    const stirring = m.status === 'mixing' || m.phaseTime % 1.8 < 0.75
    const swirl = (6.2 * m.config.rotationSpeed) / defaultSimulation.rotationSpeed
    ball.body.applyImpulse(
      stirring
        ? {
            x: (-p.y * swirl + p.x * 2.2 + noise() * 11) * STEP,
            y: (p.x * swirl + p.y * 2.2 + 9.5 + noise() * 11) * STEP,
            z: (Math.sin(m.elapsed * 2.4 + p.x) * 7 + noise() * 13) * STEP,
          }
        : {
            x: (noise() * 4 - p.x * 0.6) * STEP,
            y: 0,
            z: (noise() * 4 - p.z * 0.6) * STEP,
          },
      true,
    )
    const v = ball.body.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)
    if (speed > m.config.maxSpeed) {
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
}

export function afterStep(m: Machine) {
  if (!isRunning(m)) return
  const crossings: { ball: MachineBall; fraction: number }[] = []
  const scale = m.config.radius / RADIUS
  const throatInner = throatInnerRadius(scale, m.config.ballRadius)
  for (const ball of m.balls) {
    if (ball.captured) continue
    const p = ball.body.translation()
    const local = outletCoordinates(p)
    const previous = outletCoordinates(ball.previous)
    const radial = Math.hypot(local.x, local.side)
    if (
      ![p.x, p.y, p.z].every(Number.isFinite) ||
      (Math.hypot(p.x, p.y, p.z) > m.config.radius + 0.15 &&
        !(
          radial < throatInner + 0.09 * scale &&
          local.depth > 2.25 * scale &&
          local.depth < 3.6 * scale
        ))
    ) {
      m.status = 'error'
      m.error = 'Ball escaped chamber wall. Please start a new session.'
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
      if (Math.hypot(x, side) < throatInner - 0.05 * scale) crossings.push({ ball, fraction })
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
