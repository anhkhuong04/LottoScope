export type Design = {
  radius: number
  ballRadius: number
  scale: number
  frameColor: string
  ballColor: string
  digitColor: string
  acrylicOpacity: number
  quality: 'standard' | 'economy'
}
export type View = 'isometric' | 'front' | 'right' | 'top'
export type Point = [number, number, number]

export const defaultDesign: Design = {
  radius: 2.5,
  ballRadius: 0.28,
  scale: 1,
  frameColor: '#f2f4f5',
  ballColor: '#008c82',
  digitColor: '#ffffff',
  acrylicOpacity: 0.07,
  quality: 'standard',
}

export function validateDesign(design: Design) {
  if (
    !Number.isFinite(design.radius) ||
    design.radius < 1 ||
    design.radius > 5 ||
    !Number.isFinite(design.ballRadius) ||
    design.ballRadius <= 0 ||
    design.ballRadius > design.radius * 0.15 ||
    !Number.isFinite(design.scale) ||
    design.scale < 0.75 ||
    design.scale > 1.25 ||
    !Number.isFinite(design.acrylicOpacity) ||
    design.acrylicOpacity < 0 ||
    design.acrylicOpacity > 0.4 ||
    ![design.frameColor, design.ballColor, design.digitColor].every((color) =>
      /^#[\da-f]{6}$/i.test(color),
    ) ||
    !['standard', 'economy'].includes(design.quality)
  )
    throw new Error('Cấu hình hình học hoặc vật liệu không hợp lệ.')
}

// A deterministic display arrangement, not a settled physics state or draw result.
export function staticBallPositions(count: number, radius: number, ballRadius: number): Point[] {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 55 ||
    !Number.isFinite(radius) ||
    !Number.isFinite(ballRadius) ||
    ballRadius <= 0 ||
    ballRadius >= radius
  )
    throw new Error('Không thể bố trí số bóng này trong lồng.')
  const distance = 2 * ballRadius * 1.035
  const rowStep = (distance * Math.sqrt(3)) / 2
  const layerStep = distance * Math.sqrt(2 / 3)
  const limit = radius - ballRadius - 0.035
  const steps = Math.ceil(radius / distance)
  const points: Point[] = []
  for (let layer = 0; layer < (2 * radius) / layerStep; layer++) {
    const y = -limit + layer * layerStep
    const candidates: Point[] = []
    for (let row = -steps * 2; row <= steps * 2; row++) {
      for (let column = -steps; column <= steps; column++) {
        const x = (column + (Math.abs(row) % 2) * 0.5 + (layer % 2) * 0.5) * distance
        const z = row * rowStep + ((layer % 2) * rowStep) / 3
        if (Math.hypot(x, y, z) <= limit) candidates.push([x, y, z])
      }
    }
    // Fill the middle first so a partial top layer still looks naturally supported.
    candidates.sort((a, b) => Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2]))
    points.push(...candidates)
    if (points.length >= count) return points.slice(0, count)
  }
  throw new Error('Không đủ không gian để bố trí bóng không chồng lấn.')
}
