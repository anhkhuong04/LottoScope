import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, PMREMGenerator, type WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { cameraPose } from './camera'

export const cameraOptions = { position: [0, 0.5, 20] as [number, number, number], fov: 38 }
export const rendererOptions = { antialias: true, alpha: true }
export const sceneOptions = { environmentIntensity: 0.72 }

export function Studio({ onError }: { onError: () => void }) {
  const { camera, gl, invalidate, size } = useThree()
  const [environment, setEnvironment] = useState<WebGLRenderTarget | null>(null)

  const floorShadow = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 64, 12, 128, 64, 124)
      grad.addColorStop(0, 'rgba(16, 43, 54, 0.22)')
      grad.addColorStop(0.55, 'rgba(16, 43, 54, 0.08)')
      grad.addColorStop(1, 'rgba(16, 43, 54, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 256, 128)
    }
    return new CanvasTexture(canvas)
  }, [])

  useEffect(() => () => floorShadow.dispose(), [floorShadow])

  useEffect(() => {
    const pose = cameraPose('isometric', size.width / size.height, 1.02)
    camera.position.copy(pose.position)
    camera.lookAt(pose.target)
    invalidate()
  }, [camera, invalidate, size.width, size.height])

  useEffect(() => {
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, 0.04, 0.1, 100, { size: 64 })
    const frame = requestAnimationFrame(() => {
      setEnvironment(target)
      invalidate()
    })
    return () => {
      cancelAnimationFrame(frame)
      target.dispose()
      room.dispose()
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
      <color attach="background" args={['#ffffff']} />
      {environment && <primitive object={environment.texture} attach="environment" />}
      <hemisphereLight args={['#ffffff', '#7e939e', 0.52]} />
      <directionalLight position={[-4.5, 8, 7]} intensity={1.45} />
      <directionalLight position={[5.5, 3.5, 4]} intensity={0.75} />
      <directionalLight position={[0, 4, -6]} intensity={0.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.68, 0]}>
        <planeGeometry args={[8.4, 4.2]} />
        <meshBasicMaterial map={floorShadow} transparent depthWrite={false} />
      </mesh>
    </>
  )
}
