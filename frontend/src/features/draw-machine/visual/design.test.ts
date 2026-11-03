import { describe, expect, it } from 'vitest'
import { defaultDesign, staticBallPositions, validateDesign } from './design'

describe('static machine layout', () => {
  for (const count of [35, 45, 55]) {
    it(`${count} numbered balls fit inside the sphere without intersections`, () => {
      const { radius, ballRadius } = defaultDesign
      const points = staticBallPositions(count, radius, ballRadius)
      expect(points).toHaveLength(count)
      for (let i = 0; i < count; i++) {
        expect(Math.hypot(...points[i]) + ballRadius).toBeLessThan(radius)
        for (let j = 0; j < i; j++) {
          expect(
            Math.hypot(...points[i].map((v, axis) => v - points[j][axis])),
          ).toBeGreaterThanOrEqual(2 * ballRadius - 1e-6)
        }
      }
      expect(staticBallPositions(count, radius, ballRadius)).toEqual(points)
    })
  }
  it('rejects invalid geometry and unsupported counts instead of overlapping balls', () => {
    expect(() => validateDesign({ ...defaultDesign, radius: NaN })).toThrow()
    expect(() => validateDesign({ ...defaultDesign, ballRadius: 3 })).toThrow()
    expect(() => staticBallPositions(0, 2.5, 0.28)).toThrow()
    expect(() => staticBallPositions(56, 2.5, 0.28)).toThrow()
    expect(() => staticBallPositions(55, 1, 0.9)).toThrow()
  })
})
