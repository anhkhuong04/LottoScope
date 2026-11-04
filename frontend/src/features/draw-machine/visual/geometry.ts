import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three'

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

// Remove front-port triangles from the visual shell only; never use this as a collider.
export function shellGeometry(radius: number, economy: boolean, cutaway: boolean) {
  const source = new SphereGeometry(radius, economy ? 40 : 72, economy ? 28 : 48)
  const position = source.attributes.position
  const indices: number[] = []
  const point = new Vector3()
  const boundary = radius / 2.5
  for (let index = 0; index < source.index!.count; index += 3) {
    const triangle = [0, 1, 2].map((offset) => source.index!.getX(index + offset))
    const center = triangle
      .reduce((sum, vertex) => sum.add(point.fromBufferAttribute(position, vertex)), new Vector3())
      .multiplyScalar(1 / 3)
    const port =
      Math.abs(center.x) < 0.45 * boundary &&
      center.y < -1.13 * boundary &&
      center.y > -2.15 * boundary &&
      center.z > 1.4 * boundary
    if (!port && !(cutaway && center.z > 0)) indices.push(...triangle)
  }
  source.setIndex(indices)
  return source
}

export function housingGeometry() {
  const positions: number[] = []
  const indices: number[] = []
  const levels = [
    [-3.5, 3.08, 1.9],
    [-3.43, 3.18, 1.98],
    [-2.83, 2.88, 1.72],
    [-2.76, 2.78, 1.62],
  ]
  const segments = 32
  for (const [y, halfWidth, halfDepth] of levels) {
    for (let i = 0; i < segments; i++) {
      const corner = Math.floor(i / 8)
      const angle = (corner * Math.PI) / 2 + ((i % 8) * Math.PI) / 14
      const x = (corner === 0 || corner === 3 ? 1 : -1) * (halfWidth - 0.2)
      const z = (corner < 2 ? 1 : -1) * (halfDepth - 0.2)
      positions.push(x + 0.2 * Math.cos(angle), y, z + 0.2 * Math.sin(angle))
    }
  }
  for (let layer = 0; layer < levels.length - 1; layer++)
    for (let i = 0; i < segments; i++) {
      const a = layer * segments + i
      const b = layer * segments + ((i + 1) % segments)
      indices.push(a, a + segments, b, b, a + segments, b + segments)
    }
  for (let i = 1; i < segments - 1; i++) {
    indices.push(0, i, i + 1)
    const last = (levels.length - 1) * segments
    indices.push(last, last + i + 1, last + i)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
