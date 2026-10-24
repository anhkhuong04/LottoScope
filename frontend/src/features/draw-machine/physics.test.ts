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
  EXIT_Y,
  type Machine,
} from './physics'

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
function setup(max = 55, seed = 17) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  worlds.push(world)
  return createMachine(world, RAPIER, max, random(seed))
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
  it('keeps balls behind the closed gate and resolves ball/ball collisions', () => {
    const m = setup()
    const a = m.balls[0].body
    const b = m.balls[1].body
    a.setTranslation({ x: -0.19, y: 0, z: 0 }, true)
    b.setTranslation({ x: 0.19, y: 0, z: 0 }, true)
    a.setLinvel({ x: 1, y: 0, z: 0 }, true)
    b.setLinvel({ x: -1, y: 0, z: 0 }, true)
    m.world.step()
    expect(a.linvel().x).toBeLessThan(0)
    expect(b.linvel().x).toBeGreaterThan(0)
    for (let i = 0; i < 600; i++) m.world.step()
    expect(m.balls.every((ball) => ball.body.translation().y > EXIT_Y)).toBe(true)
    expect(m.drawn).toEqual([])
  })

  it.each([45, 55])(
    'physically draws exactly six distinct main balls from %i',
    (max) => {
      for (const seed of [17, 209, 4231]) {
        const m = setup(max, seed)
        startMachine(m)
        tick(m, 120)
        expect(m.status, `seed ${seed}: ${m.error}`).toBe('complete')
        expect(m.drawn).toHaveLength(6)
        expect(new Set(m.drawn).size).toBe(6)
        expect(m.drawn.every((n) => n >= 1 && n <= max)).toBe(true)
        expect(m.balls.filter((b) => b.captured)).toHaveLength(6)
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
    ball.previous = { x: 0, y: EXIT_Y + 0.1, z: 0 }
    ball.body.setTranslation({ x: 0, y: EXIT_Y - 0.1, z: 0 }, true)
    afterStep(m)
    expect(m.drawn).toEqual([ball.number])
    afterStep(m)
    expect(m.drawn).toEqual([ball.number])
    expect(ball.captured).toBe(true)
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
    old.world = replacement.world
    destroyMachine(old)
    expect(replacement.world.bodies.len()).toBe(55)
    expect(replacement.world.colliders.len()).toBe(81)
  })

  it('records a real exit on the timeout boundary before deciding the machine is stalled', () => {
    const m = setup()
    startMachine(m)
    m.status = 'drawing'
    m.gate.setEnabled(false)
    m.sinceCapture = 29.999
    const ball = m.balls[0]
    ball.body.setTranslation({ x: 0, y: EXIT_Y + 0.1, z: 0 }, true)
    beforeStep(m)
    ball.body.setTranslation({ x: 0, y: EXIT_Y - 0.1, z: 0 }, true)
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
