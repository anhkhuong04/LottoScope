import { describe, expect, it } from 'vitest'
import { defaultSimulation, validateSimulation, outletPoint, outletCoordinates } from './config'

describe('mechanical configuration', () => {
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
