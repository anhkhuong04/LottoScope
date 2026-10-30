// @vitest-environment node
import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { afterSessionStep, createSession, sessionSnapshot } from './session'
import {
  beforeStep,
  destroyMachine,
  EXIT_Y,
  pauseMachine,
  resumeMachine,
  startMachine,
  STEP,
} from './physics'

beforeAll(async () => {
  await RAPIER.init()
})
const worlds: RAPIER.World[] = []
afterEach(() => worlds.splice(0).forEach((world) => world.free()))
function setup() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  worlds.push(world)
  let seed = 17
  return createSession(world, RAPIER, 35, 5, 12, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  })
}
function exit(session: ReturnType<typeof setup>, number: number) {
  const m = session.machine
  startMachine(m)
  m.status = 'drawing'
  m.gate.setEnabled(false)
  const ball = m.balls[number - 1]
  ball.previous = { x: 0, y: EXIT_Y + 0.1, z: 0 }
  ball.body.setTranslation({ x: 0, y: EXIT_Y - 0.1, z: 0 }, true)
  afterSessionStep(session)
}
describe('Lotto physical session', () => {
  it.each([0, 1.5, Number.NaN, 36])(
    'rejects invalid special pool %s before allocation',
    (specialMax) => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
      worlds.push(world)
      expect(() => createSession(world, RAPIER, 35, 5, specialMax, () => 0.5)).toThrow()
      expect(world.bodies.len()).toBe(0)
      expect(world.colliders.len()).toBe(0)
    },
  )

  it.each([45, 55])(
    'keeps the %s-ball session main-only when no special pool is configured',
    (max) => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
      worlds.push(world)
      const s = createSession(world, RAPIER, max, 6, null, () => 0.5)
      for (const n of [1, 2, 3, 4, 5, 6]) exit(s, n)
      expect(sessionSnapshot(s)).toEqual({
        phase: 'main',
        status: 'complete',
        drawn: [1, 2, 3, 4, 5, 6],
        specialNumber: null,
        error: null,
      })
      expect(world.bodies.len()).toBe(max)
    },
  )

  it('retains five main numbers while replacing their pool with twelve special balls', () => {
    const s = setup()
    for (const n of [1, 2, 3, 4, 9]) exit(s, n)
    expect(sessionSnapshot(s)).toEqual({
      phase: 'special',
      status: 'mixing',
      drawn: [1, 2, 3, 4, 9],
      specialNumber: null,
      error: null,
    })
    expect(s.machine.balls).toHaveLength(12)
    expect(s.machine.world.bodies.len()).toBe(12)
    expect(s.machine.count).toBe(1)
    exit(s, 9)
    expect(sessionSnapshot(s)).toEqual({
      phase: 'special',
      status: 'complete',
      drawn: [1, 2, 3, 4, 9],
      specialNumber: 9,
      error: null,
    })
    afterSessionStep(s)
    expect(s.machine.drawn).toEqual([9])
    destroyMachine(s.machine)
    expect(s.machine.world.bodies.len()).toBe(0)
    expect(s.machine.world.colliders.len()).toBe(0)
  })
  it('pauses and stalls the special pool without losing main results', () => {
    const s = setup()
    for (const n of [1, 2, 3, 4, 9]) exit(s, n)
    pauseMachine(s.machine)
    beforeStep(s.machine)
    expect(s.machine.elapsed).toBe(0)
    expect(sessionSnapshot(s).status).toBe('paused')
    resumeMachine(s.machine)
    s.machine.sinceCapture = 30
    afterSessionStep(s)
    expect(sessionSnapshot(s).status).toBe('stalled')
    expect(sessionSnapshot(s).drawn).toEqual([1, 2, 3, 4, 9])
    expect(sessionSnapshot(s).specialNumber).toBeNull()
    resumeMachine(s.machine)
    expect(sessionSnapshot(s).status).toBe('mixing')
  })
  it('draws five main and one special using real Rapier steps', () => {
    const s = setup()
    startMachine(s.machine)
    for (let i = 0; i < 120 / STEP; i++) {
      if (!['mixing', 'drawing'].includes(s.machine.status)) break
      beforeStep(s.machine)
      s.machine.world.timestep = STEP
      s.machine.world.step()
      afterSessionStep(s)
    }
    const snapshot = sessionSnapshot(s)
    expect(snapshot.status).toBe('complete')
    expect(snapshot.drawn).toHaveLength(5)
    expect(new Set(snapshot.drawn).size).toBe(5)
    expect(snapshot.drawn.every((n) => n >= 1 && n <= 35)).toBe(true)
    expect(snapshot.specialNumber).toBeGreaterThanOrEqual(1)
    expect(snapshot.specialNumber).toBeLessThanOrEqual(12)
  }, 30000)
})
