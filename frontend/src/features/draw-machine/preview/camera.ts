import { Vector3 } from 'three'
import type { Point, View } from './design'

// Fit the actual envelope, not the empty corners of a box around the tall sphere.
// Includes feet and the projecting chute. World +Z is front.
const envelope: Vector3[] = []
for (let latitude = 0; latitude <= 16; latitude++)
  for (let longitude = 0; longitude < 32; longitude++) {
    const theta = (latitude * Math.PI) / 16
    const phi = (longitude * Math.PI) / 16
    envelope.push(
      new Vector3(
        2.65 * Math.sin(theta) * Math.cos(phi),
        2.65 * Math.cos(theta),
        2.65 * Math.sin(theta) * Math.sin(phi),
      ),
    )
  }
for (const x of [-3.3, 3.3])
  for (const y of [-3.77, -2.7]) for (const z of [-2.05, 2.05]) envelope.push(new Vector3(x, y, z))
for (const x of [-0.56, 0.56]) for (const y of [-2.55, -1.7]) envelope.push(new Vector3(x, y, 3.9))
const directions: Record<View, Point> = {
  isometric: [7.3, 4, 10],
  front: [0, 0.05, 1],
  right: [1, 0.05, 0.02],
  top: [0, 1, 0.025],
}

export function cameraPose(view: View, aspect: number) {
  const direction = new Vector3(...directions[view]).normalize()
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize()
  const up = new Vector3().crossVectors(direction, right).normalize()
  const target = new Vector3(0, -0.56, 0.65).multiplyScalar(1.25)
  const tanVertical = Math.tan((38 * Math.PI) / 360)
  const tanHorizontal = tanVertical * Math.max(0.1, aspect)
  let distance = 0
  for (const point of envelope) {
    const delta = point.clone().multiplyScalar(1.25).sub(target)
    distance = Math.max(
      distance,
      Math.abs(delta.dot(right)) / tanHorizontal + delta.dot(direction),
      Math.abs(delta.dot(up)) / tanVertical + delta.dot(direction),
    )
  }
  // Reserve space at the maximum 125% size; changing the size slider remains visible.
  distance *= 1.09
  return { target, position: target.clone().addScaledVector(direction, distance), distance }
}
