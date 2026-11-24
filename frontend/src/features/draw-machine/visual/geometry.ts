import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three'

export function bandGeometry(
  radius: number,
  width: number,
  depth: number,
  start = 0,
  end = 2 * Math.PI,
) {
  const positions: number[] = []
  const indices: number[] = []
  const segments = 80
  for (let i = 0; i <= segments; i++) {
    const angle = start + ((end - start) * i) / segments
    for (const [r, z] of [
      [radius - depth / 2, -width / 2],
      [radius + depth / 2, -width / 2],
      [radius + depth / 2, width / 2],
      [radius - depth / 2, width / 2],
    ]) {
      positions.push(r * Math.cos(angle), r * Math.sin(angle), z)
    }
    if (i < segments)
      for (let face = 0; face < 4; face++) {
        const a = i * 4 + face
        const b = i * 4 + ((face + 1) % 4)
        indices.push(a, b, a + 4, b, b + 4, a + 4)
      }
  }
  indices.push(0, 2, 1, 0, 3, 2)
  const last = segments * 4
  indices.push(last, last + 1, last + 2, last, last + 2, last + 3)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// Visual sphere shell with 6-o'clock bottom discharge port removed; collider is in physics.ts.
export function shellGeometry(radius: number, economy: boolean, cutaway: boolean) {
  const source = new SphereGeometry(radius, economy ? 44 : 76, economy ? 30 : 52)
  const position = source.attributes.position
  const indices: number[] = []
  const point = new Vector3()
  const boundary = radius / 2.5
  for (let index = 0; index < source.index!.count; index += 3) {
    const triangle = [0, 1, 2].map((offset) => source.index!.getX(index + offset))
    const center = triangle
      .reduce((sum, vertex) => sum.add(point.fromBufferAttribute(position, vertex)), new Vector3())
      .multiplyScalar(1 / 3)
    const bottomPort =
      center.y < -2.35 * boundary && Math.hypot(center.x, center.z) < 0.56 * boundary
    if (!bottomPort && !(cutaway && center.z > 0)) indices.push(...triangle)
  }
  source.setIndex(indices)
  return source
}

// Dark gray wide dual-wing sloped base matching the 6-o'clock bottom outlet design.
export function dualChuteBaseGeometry() {
  const shape = new Shape()
  shape.moveTo(-3.1, -3.65)
  shape.lineTo(3.1, -3.65)
  shape.lineTo(3.1, -3.38)
  shape.lineTo(0.68, -2.98)
  shape.lineTo(-0.68, -2.98)
  shape.lineTo(-3.1, -3.38)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: 1.5,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
    steps: 1,
  })
  geometry.translate(0, 0, -0.75)
  geometry.computeVertexNormals()
  return geometry
}

// Raised chute side rails sloping gently outward to guide exiting balls left and right.
export function chuteRailGeometry() {
  const shape = new Shape()
  shape.moveTo(-3.1, -3.38)
  shape.lineTo(-3.1, -3.14)
  shape.lineTo(-0.55, -2.86)
  shape.lineTo(0.55, -2.86)
  shape.lineTo(3.1, -3.14)
  shape.lineTo(3.1, -3.38)
  shape.lineTo(0.68, -2.98)
  shape.lineTo(-0.68, -2.98)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelSize: 0.015,
    bevelThickness: 0.015,
    bevelSegments: 1,
    steps: 1,
  })
  geometry.translate(0, 0, -0.045)
  geometry.computeVertexNormals()
  return geometry
}
