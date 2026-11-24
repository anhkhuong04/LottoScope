import { describe, expect, it } from 'vitest'
import {
  defaultSimulation,
  LOTTO_BALL_RADIUS,
  validateSimulation,
  outletPoint,
  outletCoordinates,
  simulationForGame,
} from './config'

describe('mechanical configuration', () => {
  it('increases Lotto 5/35 ball radius by 50% while keeping Mega and Power standard', () => {
    expect(LOTTO_BALL_RADIUS).toBeCloseTo(defaultSimulation.ballRadius * 1.5)
    expect(simulationForGame('lotto_535').ballRadius).toBe(LOTTO_BALL_RADIUS)
    expect(simulationForGame('mega_645').ballRadius).toBe(defaultSimulation.ballRadius)
    expect(simulationForGame('power_655').ballRadius).toBe(defaultSimulation.ballRadius)
  })
  it('places the 6-o-clock exit at the bottom of the sphere and round trips its coordinates', () => {
    const point = outletPoint(2.9, 0.1, -0.05)
    expect(point.y).toBeLessThan(-2.5)
    expect(Math.abs(point.z)).toBeLessThan(0.2)
    const local = outletCoordinates(point)
    expect(local.depth).toBeCloseTo(2.9)
    expect(local.x).toBeCloseTo(0.1)
    expect(local.side).toBeCloseTo(-0.05)
  })
  it.each([
    'radius',
    'ballRadius',
    'mass',
    'rotationSpeed',
    'friction',
    'restitution',
    'linearDamping',
    'maxSpeed',
  ] as const)('rejects invalid %s', (key) => {
    expect(() => validateSimulation({ ...defaultSimulation, [key]: NaN })).toThrow()
  })
})
