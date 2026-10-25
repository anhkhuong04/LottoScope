import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import {
  CatmullRomCurve3,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import {
  beforeStep,
  destroyMachine,
  pauseMachine,
  resumeMachine,
  startMachine,
  BALL_RADIUS,
  OPENING_ANGLE,
  RADIUS,
  STEP,
} from './physics'
import { afterSessionStep, createSession, sessionSnapshot } from './session'
import type { Action, Snapshot } from './DrawMachine'

type Props = {
  max: number
  count: number
  specialMax: number | null
  action: Action | null
  running: boolean
  onSnapshot: (s: Snapshot) => void
  onError: () => void
}
const colors = ['#f8cd47', '#69c8e1', '#f48d77', '#9eb7ff', '#87cfaa', '#d1a2e9']

function numberMaterial(number: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = colors[Math.floor((number - 1) / 10) % colors.length]
  context.fillRect(0, 0, 256, 128)
  for (const x of [64, 192]) {
    context.fillStyle = '#fffdf5'
    context.beginPath()
    context.arc(x, 64, 39, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#152439'
    context.font = 'bold 48px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(number).padStart(2, '0'), x, 67)
  }
  const texture = new CanvasTexture(canvas)
  return new MeshStandardMaterial({ map: texture, roughness: 0.32, metalness: 0.08 })
}

function Cage() {
  const ribs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const phi = (index * Math.PI) / 6
        const points = Array.from({ length: 49 }, (_, j) => {
          const theta = (j / 48) * (Math.PI - OPENING_ANGLE)
          return new Vector3(
            RADIUS * Math.sin(theta) * Math.cos(phi),
            RADIUS * Math.cos(theta),
            RADIUS * Math.sin(theta) * Math.sin(phi),
          )
        })
        return new TubeGeometry(new CatmullRomCurve3(points), 48, 0.013, 5, false)
      }),
    [],
  )
  useEffect(() => () => ribs.forEach((geometry) => geometry.dispose()), [ribs])
  return (
    <group>
      {ribs.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color="#8ea8bd" metalness={0.65} roughness={0.3} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const theta = ((i + 1) * Math.PI) / 9
        return (
          <mesh key={i} position={[0, RADIUS * Math.cos(theta), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RADIUS * Math.sin(theta), 0.014, 5, 64]} />
            <meshStandardMaterial color="#8ea8bd" metalness={0.65} roughness={0.3} />
          </mesh>
        )
      })}
      <mesh position={[0, -2.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.035, 8, 32]} />
        <meshStandardMaterial color="#e8b74c" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, -2.9, -0.32]}>
        <boxGeometry args={[0.65, 0.9, 0.035]} />
        <meshStandardMaterial color="#7893a9" metalness={0.5} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 2.85, -1.8, 0]}>
            <cylinderGeometry args={[0.075, 0.1, 4.9, 12]} />
            <meshStandardMaterial color="#71899d" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[side * 2.62, 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.48, 12]} />
            <meshStandardMaterial color="#c3d2dd" metalness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -4.15, 0]}>
        <boxGeometry args={[6.3, 0.2, 1.8]} />
        <meshStandardMaterial color="#20384b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, -3.93, 0.15]}>
        <boxGeometry args={[3.7, 0.12, 0.65]} />
        <meshStandardMaterial color="#c29c55" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Mechanism({
  max,
  count,
  specialMax,
  action,
  onSnapshot,
}: Pick<Props, 'max' | 'count' | 'specialMax' | 'action' | 'onSnapshot'>) {
  const { world, rapier } = useRapier()
  const invalidate = useThree((state) => state.invalidate)
  const session = useRef<ReturnType<typeof createSession> | null>(null)
  const meshes = useRef<(Mesh | null)[]>([])
  const gateMesh = useRef<Mesh>(null)
  const lastSnapshot = useRef('')
  const group = useRef<Group>(null)
  const geometry = useMemo(() => new SphereGeometry(BALL_RADIUS, 20, 14), [])
  const materials = useMemo(
    () => Array.from({ length: max }, (_, i) => numberMaterial(i + 1)),
    [max],
  )
  const publish = useCallback(() => {
    const s = session.current
    if (!s) return
    const snapshot = sessionSnapshot(s)
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
  useEffect(
    () => () => {
      geometry.dispose()
      materials.forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
    },
    [geometry, materials],
  )
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
    if (!m) return
    // The special pool reuses the numbered meshes; hide the old main-only ones.
    meshes.current.forEach((mesh, index) => {
      if (mesh) mesh.visible = index < m.balls.length
    })
    for (let i = 0; i < m.balls.length; i++) {
      const ball = m.balls[i]
      const mesh = meshes.current[i]
      if (!mesh) continue
      if (ball.captured) {
        const index = m.drawn.indexOf(ball.number)
        const destination = new Vector3((index - (m.count - 1) / 2) * 0.52, -3.64, 0.15)
        mesh.position.lerp(destination, Math.min(1, delta * 8))
        if (mesh.position.distanceToSquared(destination) > 0.0001) invalidate()
      } else {
        mesh.position.copy(ball.body.translation())
        mesh.quaternion.copy(ball.body.rotation())
      }
    }
    if (gateMesh.current) gateMesh.current.position.x = m.gate.isEnabled() ? 0 : 0.85
  })
  return (
    <group ref={group}>
      {materials.map((material, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh
          }}
          geometry={geometry}
          material={material}
        />
      ))}
      <mesh ref={gateMesh} position={[0, -2.55, 0]}>
        <boxGeometry args={[0.85, 0.09, 0.85]} />
        <meshStandardMaterial color="#e5bb65" metalness={0.65} roughness={0.3} />
      </mesh>
    </group>
  )
}

export default function DrawScene(props: Props) {
  return (
    <Canvas
      frameloop={props.running ? 'always' : 'demand'}
      dpr={[1, 1.5]}
      camera={{ position: [2.3, 1.2, 11.2], fov: 43 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => {
        camera.lookAt(0, -0.8, 0)
      }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[4, 7, 6]} intensity={3.5} color="#fff2d6" />
      <directionalLight position={[-4, 2, -3]} intensity={2.3} color="#91d2ff" />
      <ContextLossObserver onError={props.onError} />
      <Cage />
      <Physics
        gravity={[0, -9.81, 0]}
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

function ContextLossObserver({ onError }: { onError: () => void }) {
  const canvas = useThree((state) => state.gl.domElement)
  useLayoutEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault()
      onError()
    }
    canvas.addEventListener('webglcontextlost', lost)
    // R3F intentionally loses its old context during disposal. Unsubscribe first.
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [canvas, onError])
  return null
}
