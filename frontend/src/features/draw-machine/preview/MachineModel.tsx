import { useEffect, useMemo } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three'
import { BallPool } from './BallPool'
import { validateDesign, type Design } from './design'
import { bandGeometry, housingGeometry, shellGeometry } from './geometry'
import { GateAndChute, Supports, type Materials } from './MachineHardware'

function CageFrame({ materials, cutaway }: { materials: Materials; cutaway: boolean }) {
  const resource = useMemo(
    () => ({
      band: bandGeometry(2.53, 0.1, 0.04),
      portBand: bandGeometry(2.53, 0.105, 0.045, -0.45, 2 * Math.PI - 1.05),
      equator: bandGeometry(2.54, 0.105, 0.04),
    }),
    [],
  )
  useEffect(
    () => () => Object.values(resource).forEach((geometry) => geometry.dispose()),
    [resource],
  )
  return (
    <group>
      {[0, -Math.PI / 4, (-3 * Math.PI) / 4].map((angle) => (
        <mesh
          key={angle}
          geometry={resource.band}
          rotation={[0, angle, 0]}
          material={materials.white}
        />
      ))}
      {!cutaway && (
        <mesh
          geometry={resource.portBand}
          rotation={[0, -Math.PI / 2, 0]}
          material={materials.white}
        />
      )}
      <mesh geometry={resource.equator} rotation={[Math.PI / 2, 0, 0]} material={materials.white} />
      {[-1, 1].map((side) => (
        <group key={side} position={[0, side * 2.51, 0]}>
          <mesh material={materials.white}>
            <cylinderGeometry args={[0.33, 0.33, 0.09, 32]} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh
              key={i}
              position={[
                0.25 * Math.cos((i * Math.PI) / 4),
                side * 0.062,
                0.25 * Math.sin((i * Math.PI) / 4),
              ]}
              material={materials.silver}
            >
              <cylinderGeometry args={[0.027, 0.027, 0.035, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function Housing({ materials }: { materials: Materials }) {
  const { geometry, brand } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 100
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Không tạo được nhãn lồng cầu.')
    context.fillStyle = '#00877f'
    context.font = 'italic bold 70px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('LottoScope', 256, 52)
    const brand = new CanvasTexture(canvas)
    brand.colorSpace = SRGBColorSpace
    return { geometry: housingGeometry(), brand }
  }, [])
  useEffect(
    () => () => {
      geometry.dispose()
      brand.dispose()
    },
    [geometry, brand],
  )
  return (
    <group>
      <mesh geometry={geometry} material={materials.white} castShadow receiveShadow />
      <mesh position={[0, -3.16, 1.9]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[2.25, 0.44]} />
        <meshBasicMaterial map={brand} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}-${z}`} position={[x * 2.72, -3.63, z * 1.5]}>
            <mesh material={materials.dark} castShadow>
              <cylinderGeometry args={[0.18, 0.2, 0.12, 24]} />
            </mesh>
            <mesh position={[0, -0.075, 0]} material={materials.silver}>
              <cylinderGeometry args={[0.21, 0.21, 0.045, 24]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  )
}

export function MachineModel({
  design,
  count,
  cutaway,
  gateOpen,
}: {
  design: Design
  count: number
  cutaway: boolean
  gateOpen: boolean
}) {
  validateDesign(design)
  const materials = useMemo<Materials>(
    () => ({
      white: new MeshStandardMaterial({
        color: design.frameColor,
        metalness: 0.25,
        roughness: 0.3,
      }),
      silver: new MeshStandardMaterial({ color: '#b6c0c6', metalness: 0.85, roughness: 0.23 }),
      dark: new MeshStandardMaterial({ color: '#263338', roughness: 0.85 }),
      acrylic: new MeshPhysicalMaterial({
        color: '#e0f1f3',
        transparent: true,
        opacity: design.acrylicOpacity,
        depthWrite: false,
        side: DoubleSide,
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.3,
      }),
    }),
    [design.frameColor, design.acrylicOpacity],
  )
  const shell = useMemo(
    () => shellGeometry(2.5, design.quality === 'economy', cutaway),
    [design.quality, cutaway],
  )
  useEffect(
    () => () => Object.values(materials).forEach((material) => material.dispose()),
    [materials],
  )
  useEffect(() => () => shell.dispose(), [shell])
  const normalized = {
    ...design,
    radius: 2.5,
    ballRadius: (design.ballRadius * 2.5) / design.radius,
  }
  return (
    <group scale={(design.scale * design.radius) / 2.5}>
      <Housing materials={materials} />
      <Supports materials={materials} />
      <BallPool count={count} design={normalized} />
      <mesh geometry={shell} material={materials.acrylic} renderOrder={3} />
      <CageFrame materials={materials} cutaway={cutaway} />
      <GateAndChute materials={materials} open={gateOpen} />
    </group>
  )
}
