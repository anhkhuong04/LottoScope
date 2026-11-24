import { useEffect, useMemo, type RefObject } from 'react'
import {
  CanvasTexture,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three'
import { chuteRailGeometry, dualChuteBaseGeometry } from './geometry'

export type Materials = {
  silver: MeshStandardMaterial
  chrome: MeshStandardMaterial
  darkBase: MeshStandardMaterial
  acrylic: MeshPhysicalMaterial
}

export function BaseAndChute({
  materials,
  open,
  hatchRef,
}: {
  materials: Materials
  open: boolean
  hatchRef?: RefObject<Mesh | null>
}) {
  const { baseGeo, railGeo, brand } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 96
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Failed to create draw machine label.')
    context.fillStyle = '#d5e5df'
    context.font = '700 48px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('LOTTOSCOPE', 256, 48)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return {
      baseGeo: dualChuteBaseGeometry(),
      railGeo: chuteRailGeometry(),
      brand: texture,
    }
  }, [])

  useEffect(
    () => () => {
      baseGeo.dispose()
      railGeo.dispose()
      brand.dispose()
    },
    [baseGeo, railGeo, brand],
  )

  return (
    <group>
      {/* Dual-wing dark gray base and lateral ball guide channels */}
      <mesh geometry={baseGeo} material={materials.darkBase} castShadow receiveShadow />
      <mesh position={[0, 0, 0.56]} geometry={railGeo} material={materials.darkBase} />
      <mesh position={[0, 0, -0.56]} geometry={railGeo} material={materials.darkBase} />

      {/* Subtle brand plate centered on front plinth */}
      <mesh position={[0, -3.4, 0.8]}>
        <planeGeometry args={[1.9, 0.36]} />
        <meshBasicMaterial map={brand} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Rear subtle structural pillar anchoring the central drum shaft to the base */}
      <mesh position={[0, -1.55, -1.35]} rotation={[-0.22, 0, 0]} material={materials.silver}>
        <cylinderGeometry args={[0.14, 0.22, 3.3, 24]} />
      </mesh>
      <mesh position={[0, 0, -0.78]} rotation={[Math.PI / 2, 0, 0]} material={materials.chrome}>
        <cylinderGeometry args={[0.16, 0.16, 1.55, 24]} />
      </mesh>
      <mesh position={[0, -3.02, -1.68]} material={materials.darkBase}>
        <boxGeometry args={[0.8, 0.24, 0.5]} />
      </mesh>

      {/* 6-o'clock discharge neck & sliding silver gate */}
      <group position={[0, -2.55, 0]}>
        <mesh material={materials.darkBase} position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.58, 28, 1, true]} />
        </mesh>
        <mesh material={materials.silver} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.45, 0.055, 12, 32]} />
        </mesh>
        <mesh ref={hatchRef} position={[open ? 0.62 : 0, -0.05, 0]} material={materials.chrome}>
          <cylinderGeometry args={[0.42, 0.42, 0.07, 24]} />
        </mesh>
      </group>
    </group>
  )
}
