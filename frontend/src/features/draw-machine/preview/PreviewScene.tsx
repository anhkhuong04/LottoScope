import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PMREMGenerator, type WebGLRenderTarget } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MachineModel } from './MachineModel'
import type { Design, View } from './design'
import { cameraPose } from './camera'

type Props = {
  design: Design
  count: number
  cutaway: boolean
  gateOpen: boolean
  view: View
  onReady: () => void
  onError: () => void
}
// Stable options prevent a parent UI update from resetting the orbit camera.
const cameraOptions = { position: [0, 1, 20] as [number, number, number], fov: 38 }
const rendererOptions = { antialias: true, alpha: false }
const sceneOptions = { environmentIntensity: 0.45 }
function Studio({ view, onReady, onError }: Pick<Props, 'view' | 'onReady' | 'onError'>) {
  const { camera, gl, invalidate, size } = useThree()
  const [environment, setEnvironment] = useState<WebGLRenderTarget | null>(null)
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    const pose = cameraPose(view, size.width / size.height)
    controls.target.copy(pose.target)
    camera.position.copy(pose.position)
    controls.minDistance = 7
    controls.maxDistance = Math.max(35, pose.distance * 1.6)
    controls.enablePan = false
    controls.enableDamping = false
    const changed = () => invalidate()
    controls.addEventListener('change', changed)
    controls.update()
    invalidate()
    return () => {
      controls.removeEventListener('change', changed)
      controls.dispose()
    }
  }, [camera, gl, view, invalidate, size.width, size.height])
  useEffect(() => {
    const generator = new PMREMGenerator(gl)
    const environment = new RoomEnvironment()
    const target = generator.fromScene(environment, 0.04, 0.1, 100, { size: 64 })
    const frame = requestAnimationFrame(() => {
      setEnvironment(target)
      invalidate()
      onReady()
    })
    return () => {
      cancelAnimationFrame(frame)
      target.dispose()
      environment.dispose()
      generator.dispose()
    }
  }, [gl, invalidate, onReady])
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault()
      onError()
    }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onError])
  return environment ? <primitive object={environment.texture} attach="environment" /> : null
}

export default function PreviewScene({ design, ...props }: Props) {
  const economy = design.quality === 'economy'
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, economy ? 1 : 1.5]}
      shadows={economy ? false : 'percentage'}
      camera={cameraOptions}
      scene={sceneOptions}
      gl={rendererOptions}
      onCreated={({ gl }) => {
        gl.debug.onShaderError = () => props.onError()
      }}
    >
      <color attach="background" args={['#e7ecef']} />
      <Studio {...props} />
      <hemisphereLight args={['#ffffff', '#a9b4bb', 0.65]} />
      <directionalLight
        position={[-4, 8, 6]}
        intensity={1.8}
        castShadow={!economy}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[5, 3, -3]} intensity={0.7} />
      <MachineModel design={design} {...props} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, (-3.77 * design.scale * design.radius) / 2.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#e7ecef" roughness={0.9} />
      </mesh>
    </Canvas>
  )
}
