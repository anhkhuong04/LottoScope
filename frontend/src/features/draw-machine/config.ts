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
  rotationSpeed: 1.65,
  friction: 0.05,
  restitution: 0.62,
  linearDamping: 0.12,
  maxSpeed: 9,
  gravity: -9.81,
  angularDamping: 0.15,
})
// +50% larger 3D ball radius for Lotto 5/35 (35 main / 12 special).
export const LOTTO_BALL_RADIUS = 0.285
export function simulationForGame(gameId: string): Readonly<SimulationConfig> {
  if (gameId === 'lotto_535') {
    return Object.freeze({ ...defaultSimulation, ballRadius: LOTTO_BALL_RADIUS })
  }
  return defaultSimulation
}
// Straight downward 6-o'clock discharge outlet (-Y axis).
export const EXIT_DEPTH = 2.7
export function outletPoint(depth: number, x = 0, side = 0): Point {
  return { x, y: -depth, z: side }
}
export function outletCoordinates(point: Point) {
  return {
    x: point.x,
    depth: -point.y,
    side: point.z,
  }
}
export function validateSimulation(config: SimulationConfig) {
  if (
    !Object.values(config).every(Number.isFinite) ||
    config.radius < 2 ||
    config.radius > 3 ||
    config.ballRadius < 0.12 ||
    config.ballRadius > 0.32 ||
    config.mass <= 0 ||
    config.mass > 5 ||
    config.rotationSpeed <= 0 ||
    config.rotationSpeed > 4 ||
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
    throw new Error('Invalid draw machine configuration.')
}
