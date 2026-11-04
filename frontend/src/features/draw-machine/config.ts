export type Point = { x: number; y: number; z: number }
export type SimulationConfig = {
  radius: number
  ballRadius: number
  mass: number
  rotationSpeed: number
  friction: number
  restitution: number
  linearDamping: number
  maxSpeed: number
  gravity: number
  angularDamping: number
}
export const defaultSimulation: Readonly<SimulationConfig> = Object.freeze({
  radius: 2.5,
  ballRadius: 0.19,
  mass: 1,
  rotationSpeed: 1.1,
  friction: 0.06,
  restitution: 0.65,
  linearDamping: 0.12,
  maxSpeed: 9,
  gravity: -9.81,
  angularDamping: 0.15,
})
export const OUTLET_ANGLE = -Math.acos(0.64)
const cosine = Math.cos(OUTLET_ANGLE)
const sine = Math.sin(OUTLET_ANGLE)
// Close to the gate: when the leading center crosses, the next ball is still
// behind the gate. A downstream sensor leaves a second ball trapped outside it.
export const EXIT_DEPTH = 2.65
export function outletPoint(depth: number, x = 0, side = 0): Point {
  return { x, y: -depth * cosine - side * sine, z: -depth * sine + side * cosine }
}
export function outletCoordinates(point: Point) {
  return {
    x: point.x,
    depth: -point.y * cosine - point.z * sine,
    side: -point.y * sine + point.z * cosine,
  }
}
export function validateSimulation(config: SimulationConfig) {
  if (
    !Object.values(config).every(Number.isFinite) ||
    config.radius < 2 ||
    config.radius > 3 ||
    config.ballRadius < 0.12 ||
    config.ballRadius > 0.23 ||
    config.mass <= 0 ||
    config.mass > 5 ||
    config.rotationSpeed <= 0 ||
    config.rotationSpeed > 2 ||
    config.friction < 0 ||
    config.friction > 1 ||
    config.restitution < 0 ||
    config.restitution > 1 ||
    config.linearDamping < 0 ||
    config.linearDamping > 2 ||
    config.maxSpeed < 2 ||
    config.maxSpeed > 12 ||
    config.gravity >= 0 ||
    config.gravity < -20 ||
    config.angularDamping < 0 ||
    config.angularDamping > 2
  )
    throw new Error('Cấu hình máy quay không hợp lệ.')
}
