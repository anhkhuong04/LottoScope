import type RAPIER from '@dimforge/rapier3d-compat'
import {
  afterStep,
  createMachine,
  destroyMachine,
  startMachine,
  type Machine,
  type Status,
} from './physics'

export type Snapshot = {
  status: Status
  drawn: number[]
  specialNumber: number | null
  phase: 'main' | 'special'
  error: string | null
}
type Session = {
  machine: Machine
  mainDrawn: number[]
  phase: Snapshot['phase']
  specialMax: number | null
  rapier: typeof RAPIER
  random: () => number
}
export function createSession(
  world: RAPIER.World,
  rapier: typeof RAPIER,
  max: number,
  count: number,
  specialMax: number | null,
  random: () => number,
): Session {
  // The scene reuses the main pool's numbered meshes for the special pool.
  if (
    specialMax !== null &&
    (!Number.isInteger(specialMax) || specialMax < 1 || specialMax > max)
  ) {
    throw new Error('Miền bóng đặc biệt phải là số nguyên dương không vượt quá miền bóng chính.')
  }
  return {
    machine: createMachine(world, rapier, max, random, count),
    mainDrawn: [],
    phase: 'main',
    specialMax,
    rapier,
    random,
  }
}
export function afterSessionStep(session: Session) {
  afterStep(session.machine)
  if (
    session.phase === 'main' &&
    session.machine.status === 'complete' &&
    session.specialMax !== null
  ) {
    const world = session.machine.world
    session.mainDrawn = [...session.machine.drawn]
    destroyMachine(session.machine)
    session.machine = createMachine(world, session.rapier, session.specialMax, session.random, 1)
    session.phase = 'special'
    startMachine(session.machine)
  }
}
export function sessionSnapshot(session: Session): Snapshot {
  return {
    status: session.machine.status,
    drawn: [...(session.phase === 'main' ? session.machine.drawn : session.mainDrawn)],
    specialNumber: session.phase === 'special' ? (session.machine.drawn[0] ?? null) : null,
    phase: session.phase,
    error: session.machine.error,
  }
}
