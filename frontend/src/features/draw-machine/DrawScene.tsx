import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three'
import {
  beforeStep,
  destroyMachine,
  pauseMachine,
  resumeMachine,
  startMachine,
  STEP,
} from './physics'
import { afterSessionStep, createSession, sessionSnapshot } from './session'
import { defaultSimulation } from './config'
import { defaultDesign } from './visual/design'
import { BallPool } from './visual/BallPool'
import { MachineModel } from './visual/MachineModel'
import { Studio, cameraOptions, rendererOptions, sceneOptions } from './visual/Studio'
import type { Action, Snapshot } from './DrawMachine'

type Props = {
  max: number
  count: number
  specialMax: number | null
  action: Action | null
  running: boolean
  onSnapshot: (snapshot: Snapshot) => void
  onError: () => void
}
const visualDesign = {
  ...defaultDesign,
  radius: defaultSimulation.radius,
  ballRadius: defaultSimulation.ballRadius,
}

function Mechanism({
  max,
  count,
  specialMax,
  action,
  onSnapshot,
}: Omit<Props, 'running' | 'onError'>) {
  const { world, rapier } = useRapier()
  const invalidate = useThree((state) => state.invalidate)
  const session = useRef<ReturnType<typeof createSession> | null>(null)
  const mesh = useRef<InstancedMesh>(null)
  const hatch = useRef<Mesh>(null)
  const rotor = useRef<Group>(null)
  const lastSnapshot = useRef('')
  const positions = useMemo(() => Array.from({ length: max }, () => new Vector3()), [max])
  const matrix = useMemo(() => new Matrix4(), [])
  const orientation = useMemo(() => new Quaternion(), [])
  const unitScale = useMemo(() => new Vector3(1, 1, 1), [])
  const destination = useMemo(
    () => new Vector3(0, -2.16, 3.5).multiplyScalar(defaultSimulation.radius / 2.5),
    [],
  )
  const publish = useCallback(() => {
    if (!session.current) return
    const snapshot = sessionSnapshot(session.current)
    const key = `${snapshot.phase}:${snapshot.status}:${snapshot.drawn.join(',')}:${snapshot.specialNumber}:${snapshot.error}`
    if (key !== lastSnapshot.current) {
      lastSnapshot.current = key
      onSnapshot(snapshot)
    }
  }, [onSnapshot])
  useLayoutEffect(() => {
    session.current = createSession(world, rapier, max, count, specialMax, Math.random)
    publish()
    return () => {
      if (session.current) destroyMachine(session.current.machine)
      session.current = null
    }
  }, [world, rapier, max, count, specialMax, publish])
  useEffect(() => {
    const m = session.current?.machine
    if (!m || !action) return
    if (action.type === 'start') startMachine(m)
    if (action.type === 'pause') pauseMachine(m)
    if (action.type === 'resume') resumeMachine(m)
    publish()
  }, [action, publish])
  useBeforePhysicsStep(() => {
    if (session.current) {
      beforeStep(session.current.machine)
      publish()
    }
  })
  useAfterPhysicsStep(() => {
    if (session.current) {
      afterSessionStep(session.current)
      publish()
    }
  })
  useFrame((_, delta) => {
    const m = session.current?.machine
    if (!m || !mesh.current) return
    mesh.current.count = m.balls.length
    m.balls.forEach((ball, index) => {
      const position = positions[index]
      if (ball.captured) {
        // Presentation begins only after the real outward crossing selected this ball.
        if (m.status !== 'paused') {
          position.lerp(destination, Math.min(1, delta * 5))
          if (position.distanceToSquared(destination) > 0.0001) invalidate()
        }
      } else position.copy(ball.body.translation())
      unitScale.setScalar(
        ball.captured && position.distanceToSquared(destination) <= 0.0001 ? 0 : 1,
      )
      orientation.copy(ball.body.rotation())
      matrix.compose(position, orientation, unitScale)
      mesh.current!.setMatrixAt(index, matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (hatch.current) hatch.current.position.y = m.gate.isEnabled() ? 0 : 0.77
    if (rotor.current) rotor.current.rotation.x = -m.elapsed * m.config.rotationSpeed
  })
  return (
    <>
      <MachineModel
        design={visualDesign}
        count={max}
        cutaway={false}
        gateOpen={false}
        hatchRef={hatch}
        rotorRef={rotor}
        showBalls={false}
      />
      <BallPool count={max} design={visualDesign} meshRef={mesh} />
    </>
  )
}

export default function DrawScene(props: Props) {
  const economy = window.matchMedia('(max-width: 767px)').matches
  return (
    <Canvas
      frameloop={props.running ? 'always' : 'demand'}
      dpr={[1, economy ? 1 : 1.5]}
      camera={cameraOptions}
      gl={rendererOptions}
      scene={sceneOptions}
      onCreated={({ gl }) => {
        gl.debug.onShaderError = props.onError
      }}
    >
      <Studio onError={props.onError} />
      <Physics
        gravity={[0, defaultSimulation.gravity, 0]}
        timeStep={STEP}
        paused={!props.running}
        interpolate={false}
        numSolverIterations={6}
      >
        <Mechanism {...props} />
      </Physics>
    </Canvas>
  )
}
