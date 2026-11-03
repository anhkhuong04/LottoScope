// @vitest-environment node
import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createMachine,
  beforeStep,
  afterStep,
  startMachine,
  pauseMachine,
  resumeMachine,
  destroyMachine,
  STEP,
  type Machine,
} from './physics'
import { EXIT_DEPTH, outletPoint, outletCoordinates } from './config'

beforeAll(async () => {
  await RAPIER.init()
})
const worlds: RAPIER.World[] = []
afterEach(() => {
  worlds.splice(0).forEach((world) => world.free())
})
function random(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
function setup(max = 55, seed = 17, count = 6) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  worlds.push(world)
  return createMachine(world, RAPIER, max, random(seed), count)
}
function tick(machine: Machine, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) {
    if (!['mixing', 'drawing'].includes(machine.status)) break
    beforeStep(machine)
    machine.world.timestep = STEP
    machine.world.step()
    afterStep(machine)
  }
}

describe('real Rapier draw machine', () => {
  it.each([17, 209, 4231])('spawns balls clear of the axle and rotor (seed %s)', (seed) => {
    const m = setup(55, seed)
    m.world.propagateModifiedBodyPositionsToColliders()
    const obstacles = [m.fixed[m.fixed.length - 1], m.rotor.collider(0), m.rotor.collider(1)]
    for (const ball of m.balls)
      for (const obstacle of obstacles) {
        const contact = ball.body.collider(0).contactCollider(obstacle, 0)
        expect(
          contact?.distance ?? 0,
          `ball ${ball.number} starts inside the mechanism`,
        ).toBeGreaterThanOrEqual(-0.0001)
      }
  })

  it('requires an explicit result count instead of inferring it from the ball pool', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    worlds.push(world)
    expect(() => Reflect.apply(createMachine, undefined, [world, RAPIER, 35, random(17)])).toThrow()
    expect(world.bodies.len()).toBe(0)
    expect(world.colliders.len()).toBe(0)
  })

  it.each([
    [35, 0],
    [35, -1],
    [35, 1.5],
    [35, 36],
    [35, Number.NaN],
    [35.5, 5],
    [Number.NaN, 5],
  ])('rejects invalid pool/count %s/%s before allocating physics resources', (max, count) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    worlds.push(world)
    expect(() => createMachine(world, RAPIER, max, random(17), count)).toThrow()
    expect(world.bodies.len()).toBe(0)
    expect(world.colliders.len()).toBe(0)
  })

  it('keeps balls behind the closed gate and resolves ball/ball collisions', () => {
    const m = setup()
    const a = m.balls[0].body
    const b = m.balls[1].body
    a.setTranslation({ x: -0.19, y: 0.7, z: 0 }, true)
    b.setTranslation({ x: 0.19, y: 0.7, z: 0 }, true)
    a.setLinvel({ x: 1, y: 0, z: 0 }, true)
    b.setLinvel({ x: -1, y: 0, z: 0 }, true)
    m.world.step()
    expect(a.linvel().x).toBeLessThan(0)
    expect(b.linvel().x).toBeGreaterThan(0)
    for (let i = 0; i < 600; i++) m.world.step()
    expect(
      m.balls.every((ball) => outletCoordinates(ball.body.translation()).depth < EXIT_DEPTH),
    ).toBe(true)
    expect(m.drawn).toEqual([])
  })

  it.each([
    { max: 35, count: 5 },
    { max: 45, count: 6 },
    { max: 55, count: 6 },
  ])(
    'physically draws exactly $count distinct main balls from $max',
    ({ max, count }) => {
      for (const seed of [17, 209, 4231, 97, 991]) {
        const m = setup(max, seed, count)
        startMachine(m)
        tick(m, 120)
        const outside = m.balls
          .filter(
            (ball) =>
              !ball.captured && Math.hypot(...Object.values(ball.body.translation())) > 2.65,
          )
          .map((ball) => ({
            number: ball.number,
            ...ball.body.translation(),
            ...outletCoordinates(ball.body.translation()),
          }))
        expect(m.status, `seed ${seed}: ${m.error}; outside=${JSON.stringify(outside)}`).toBe(
          'complete',
        )
        expect(m.drawn).toHaveLength(count)
        expect(new Set(m.drawn).size).toBe(count)
        expect(m.drawn.every((n) => n >= 1 && n <= max)).toBe(true)
        expect(m.balls.filter((b) => b.captured)).toHaveLength(count)
        const saved = [...m.drawn]
        afterStep(m)
        startMachine(m)
        tick(m, 10)
        expect(m.drawn).toEqual(saved)
      }
    },
    30000,
  )

  it('only records an outward crossing; duplicate checks never add a second result', () => {
    const m = setup()
    startMachine(m)
    m.status = 'drawing'
    m.gate.setEnabled(false)
    const ball = m.balls[0]
    ball.previous = outletPoint(EXIT_DEPTH - 0.1)
    ball.body.setTranslation(outletPoint(EXIT_DEPTH + 0.1), true)
    afterStep(m)
    expect(m.drawn).toEqual([ball.number])
    afterStep(m)
    expect(m.drawn).toEqual([ball.number])
    expect(ball.captured).toBe(true)
  })

  it('physically blocks the front gate when closed and releases through its throat when opened', () => {
    const m = setup(35, 17, 5)
    m.balls.forEach((ball) => ball.body.setEnabled(false))
    m.rotor.setEnabled(false)
    const ball = m.balls[0]
    ball.body.setEnabled(true)
    const place = () => {
      ball.body.setTranslation(outletPoint(2.1), true)
      ball.body.setLinvel(outletPoint(2), true)
    }
    place()
    for (let i = 0; i < 60; i++) {
      m.world.timestep = STEP
      m.world.step()
      expect(outletCoordinates(ball.body.translation()).depth).toBeLessThan(EXIT_DEPTH)
    }
    place()
    startMachine(m)
    m.status = 'drawing'
    m.gate.setEnabled(false)
    for (let i = 0; i < 60 && !ball.captured; i++) {
      ball.previous = { ...ball.body.translation() }
      m.world.step()
      afterStep(m)
    }
    expect(m.drawn).toEqual([ball.number])
    expect(m.gate.isEnabled()).toBe(true)
  })

  it.each(['reverse', 'closed', 'off_axis'] as const)('does not record a %s crossing', (kind) => {
    const m = setup()
    startMachine(m)
    m.status = 'drawing'
    m.gate.setEnabled(kind === 'closed')
    const ball = m.balls[0]
    const x = kind === 'off_axis' ? 0.34 : 0
    ball.previous = outletPoint(EXIT_DEPTH + (kind === 'reverse' ? 0.1 : -0.1), x)
    ball.body.setTranslation(outletPoint(EXIT_DEPTH + (kind === 'reverse' ? -0.1 : 0.1), x), true)
    afterStep(m)
    expect(m.drawn).toEqual([])
    expect(ball.captured).toBe(false)
  })

  it('rejects invalid physical configuration before allocating colliders or bodies', () => {
    const m = setup()
    const bodies = m.world.bodies.len()
    const colliders = m.world.colliders.len()
    expect(() =>
      createMachine(m.world, RAPIER, 35, random(17), 5, { ...m.config, mass: -1 }),
    ).toThrow()
    expect(m.world.bodies.len()).toBe(bodies)
    expect(m.world.colliders.len()).toBe(colliders)
  })

  it('pauses without consuming time; timeout resumes mixing without picking a substitute', () => {
    const m = setup()
    startMachine(m)
    tick(m, 1)
    pauseMachine(m)
    const elapsed = m.sinceCapture
    tick(m, 60)
    expect(m.sinceCapture).toBe(elapsed)
    expect(m.status).toBe('paused')
    resumeMachine(m)
    m.sinceCapture = 30
    beforeStep(m)
    afterStep(m)
    expect(m.status).toBe('stalled')
    expect(m.drawn).toEqual([])
    resumeMachine(m)
    expect(m.status).toBe('mixing')
    expect(m.drawn).toEqual([])
  })

  it('stops on an escaped ball and frees only the resources owned by this session', () => {
    const m = setup()
    startMachine(m)
    m.balls[0].body.setTranslation({ x: 10, y: 0, z: 0 }, true)
    afterStep(m)
    expect(m.status).toBe('error')
    expect(m.drawn).toEqual([])
    destroyMachine(m)
    expect(m.world.bodies.len()).toBe(0)
    expect(m.world.colliders.len()).toBe(0)
  })

  it('does not remove foreign bodies if the renderer has already replaced its world', () => {
    const old = setup()
    const replacement = setup()
    const colliderCount = replacement.world.colliders.len()
    old.world = replacement.world
    destroyMachine(old)
    expect(replacement.world.bodies.len()).toBe(56)
    expect(replacement.world.colliders.len()).toBe(colliderCount)
  })

  it('records a real exit on the timeout boundary before deciding the machine is stalled', () => {
    const m = setup()
    startMachine(m)
    m.status = 'drawing'
    m.gate.setEnabled(false)
    m.sinceCapture = 29.999
    const ball = m.balls[0]
    ball.body.setTranslation(outletPoint(EXIT_DEPTH - 0.1), true)
    beforeStep(m)
    ball.body.setTranslation(outletPoint(EXIT_DEPTH + 0.1), true)
    afterStep(m)
    expect(m.drawn).toEqual([ball.number])
    expect(m.status).toBe('mixing')
  })

  it('freezes physical bodies immediately even if the renderer still finishes a queued step', () => {
    const m = setup()
    startMachine(m)
    tick(m, 0.5)
    pauseMachine(m)
    const p = { ...m.balls[0].body.translation() }
    m.world.step()
    expect(m.balls[0].body.translation()).toEqual(p)
    resumeMachine(m)
    expect(m.balls[0].body.isEnabled()).toBe(true)
  })
})
