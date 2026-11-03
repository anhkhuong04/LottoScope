import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { cameraPose } from './camera'
import type { View } from './design'

describe('review camera framing', () => {
  for (const aspect of [0.6, 1, 1.5]) {
    for (const view of ['isometric', 'front', 'right', 'top'] as View[]) {
      it(`keeps the entire maximum-size model inside ${view} at aspect ${aspect}`, () => {
        const pose = cameraPose(view, aspect)
        const camera = new PerspectiveCamera(38, aspect, 0.1, 100)
        camera.position.copy(pose.position)
        camera.lookAt(pose.target)
        camera.updateMatrixWorld()
        const points = []
        // Independent samples of the sphere, plinth/feet, and projecting chute.
        for (let latitude = 0; latitude <= 12; latitude++)
          for (let longitude = 0; longitude < 24; longitude++) {
            const theta = (latitude * Math.PI) / 12
            const phi = (longitude * Math.PI) / 12
            points.push(
              new Vector3(
                2.6 * Math.sin(theta) * Math.cos(phi),
                2.6 * Math.cos(theta),
                2.6 * Math.sin(theta) * Math.sin(phi),
              ),
            )
          }
        for (const x of [-3.2, 3.2])
          for (const y of [-3.75, -2.76]) for (const z of [-2, 2]) points.push(new Vector3(x, y, z))
        for (const x of [-0.5, 0.5])
          for (const y of [-2.5, -1.75]) points.push(new Vector3(x, y, 3.75))
        for (const point of points) {
          const projected = point.multiplyScalar(1.25).project(camera)
          expect(Math.abs(projected.x)).toBeLessThan(0.94)
          expect(Math.abs(projected.y)).toBeLessThan(0.94)
          expect(projected.z).toBeGreaterThan(-1)
          expect(projected.z).toBeLessThan(1)
        }
      })
    }
  }
})
