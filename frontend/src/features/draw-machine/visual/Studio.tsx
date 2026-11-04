import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator, type WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { cameraPose } from './camera'

export const cameraOptions = { position: [0, 1, 20] as [number, number, number], fov: 38 }
export const rendererOptions = { antialias: true, alpha: false }
export const sceneOptions = { environmentIntensity: 0.45 }

export function Studio({ onError }: { onError: () => void }) {
  const { camera, gl, invalidate, size } = useThree()
  const [environment, setEnvironment] = useState<WebGLRenderTarget | null>(null)
  useEffect(() => {
    const pose = cameraPose('isometric', size.width / size.height)
    camera.position.copy(pose.position)
    camera.lookAt(pose.target)
    invalidate()
  }, [camera, invalidate, size.width, size.height])
  useEffect(() => {
    const generator = new PMREMGenerator(gl)
    const environment = new RoomEnvironment()
    const target = generator.fromScene(environment, 0.04, 0.1, 100, { size: 64 })
    const frame = requestAnimationFrame(() => {
      setEnvironment(target)
      invalidate()
    })
    return () => {
      cancelAnimationFrame(frame)
      target.dispose()
      environment.dispose()
      generator.dispose()
    }
  }, [gl, invalidate])
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault()
      onError()
    }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onError])
  return (
    <>
      <color attach="background" args={['#e7ecef']} />
      {environment && <primitive object={environment.texture} attach="environment" />}
      <hemisphereLight args={['#ffffff', '#a9b4bb', 0.65]} />
      <directionalLight position={[-4, 8, 6]} intensity={1.8} />
      <directionalLight position={[5, 3, -3]} intensity={0.7} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.77, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#e7ecef" roughness={0.9} />
      </mesh>
    </>
  )
}
