import { describe, expect, it } from 'vitest'
import { defaultSimulation, validateSimulation, outletPoint, outletCoordinates } from './config'

describe('mechanical configuration', () => {
  it('places the exit below and in front of the sphere and round trips its coordinates', () => {
    const point = outletPoint(2.9, 0.1, -0.05)
    expect(point.z).toBeGreaterThan(2)
    expect(point.y).toBeLessThan(-1.5)
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
