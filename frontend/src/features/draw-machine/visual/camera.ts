import { Vector3 } from 'three'
import type { Point, View } from './design'

// Frame the spherical chamber, silver ring, and dual-wing 6-o'clock chute base cleanly.
const envelope: Vector3[] = []
for (let latitude = 0; latitude <= 16; latitude++)
  for (let longitude = 0; longitude < 32; longitude++) {
    const theta = (latitude * Math.PI) / 16
    const phi = (longitude * Math.PI) / 16
    envelope.push(
      new Vector3(
        2.68 * Math.sin(theta) * Math.cos(phi),
        2.68 * Math.cos(theta),
        2.68 * Math.sin(theta) * Math.sin(phi),
      ),
    )
  }
for (const x of [-3.25, 3.25])
  for (const y of [-3.7, -2.95]) for (const z of [-1.85, 1.0]) envelope.push(new Vector3(x, y, z))

const directions: Record<View, Point> = {
  isometric: [0.95, 1.0, 10],
  front: [0, 0.05, 1],
  right: [1, 0.05, 0.02],
  top: [0, 1, 0.025],
}

export function cameraPose(view: View, aspect: number, modelScale = 1.25) {
  const direction = new Vector3(...directions[view]).normalize()
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize()
  const up = new Vector3().crossVectors(direction, right).normalize()
  const target = new Vector3(0, -0.52, 0).multiplyScalar(modelScale)
  const tanVertical = Math.tan((38 * Math.PI) / 360)
  const tanHorizontal = tanVertical * Math.max(0.1, aspect)
  let distance = 0
  for (const point of envelope) {
    const delta = point.clone().multiplyScalar(modelScale).sub(target)
    distance = Math.max(
      distance,
      Math.abs(delta.dot(right)) / tanHorizontal + delta.dot(direction),
      Math.abs(delta.dot(up)) / tanVertical + delta.dot(direction),
    )
  }
  distance *= 1.06
  return { target, position: target.clone().addScaledVector(direction, distance), distance }
}
