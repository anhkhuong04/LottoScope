import { useEffect, useMemo, type RefObject } from 'react'
import { DoubleSide, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { BallPool } from './BallPool'
import { validateDesign, type Design } from './design'
import { bandGeometry, shellGeometry } from './geometry'
import { BaseAndChute, type Materials } from './MachineHardware'
import { ROTOR_ARM_ANGLES } from '../physics'

function DrumFrame({ materials }: { materials: Materials }) {
  const resource = useMemo(
    () => ({
      frontRing: bandGeometry(2.55, 0.16, 0.14),
      trimRing: bandGeometry(2.49, 0.06, 0.06),
      sideRing: bandGeometry(2.53, 0.06, 0.04, 0.18, Math.PI * 2 - 0.18),
    }),
    [],
  )
  useEffect(
    () => () => Object.values(resource).forEach((geometry) => geometry.dispose()),
    [resource],
  )
  return (
    <group>
      {/* Prominent silver circular front ring silhouette */}
      <mesh geometry={resource.frontRing} position={[0, 0, 0.06]} material={materials.silver} />
      <mesh geometry={resource.trimRing} position={[0, 0, 0.16]} material={materials.chrome} />
      {/* Subtle vertical arch reinforcing the sphere while keeping bottom 6-o'clock clear */}
      <mesh
        geometry={resource.sideRing}
        rotation={[0, Math.PI / 2, Math.PI / 2]}
        material={materials.silver}
      />
      {/* Top crown cap detail */}
      <mesh position={[0, 2.54, 0]} material={materials.silver}>
        <cylinderGeometry args={[0.24, 0.28, 0.1, 24]} />
      </mesh>
    </group>
  )
}

function YRotor({
  materials,
  rotorRef,
}: {
  materials: Materials
  rotorRef?: RefObject<Group | null>
}) {
  return (
    <group ref={rotorRef}>
      {/* Central metallic hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.chrome}>
        <cylinderGeometry args={[0.17, 0.17, 0.36, 28]} />
      </mesh>
      <mesh position={[0, 0, 0.19]} rotation={[Math.PI / 2, 0, 0]} material={materials.silver}>
        <cylinderGeometry args={[0.09, 0.12, 0.06, 24]} />
      </mesh>
      {/* 3 arms at 120-degree intervals matching physics colliders */}
      {ROTOR_ARM_ANGLES.map((armAngle) => (
        <group key={armAngle} rotation={[0, 0, armAngle - Math.PI / 2]}>
          <mesh position={[0, 1.15, 0]} material={materials.silver}>
            <boxGeometry args={[0.11, 1.9, 0.26]} />
          </mesh>
          <mesh position={[0, 1.15, 0.14]} material={materials.chrome}>
            <cylinderGeometry args={[0.025, 0.025, 1.92, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function MachineModel({
  design,
  count,
  cutaway,
  gateOpen,
  hatchRef,
  rotorRef,
  showBalls = true,
}: {
  design: Design
  count: number
  cutaway: boolean
  gateOpen: boolean
  hatchRef?: RefObject<Mesh | null>
  rotorRef?: RefObject<Group | null>
  showBalls?: boolean
}) {
  validateDesign(design)
  const materials = useMemo<Materials>(
    () => ({
      silver: new MeshStandardMaterial({
        color: design.frameColor,
        metalness: 0.9,
        roughness: 0.2,
      }),
      chrome: new MeshStandardMaterial({
        color: '#e5eaee',
        metalness: 0.96,
        roughness: 0.12,
      }),
      darkBase: new MeshStandardMaterial({
        color: '#373d42',
        metalness: 0.1,
        roughness: 0.68,
      }),
      acrylic: new MeshPhysicalMaterial({
        color: '#c9e2e7',
        transparent: true,
        opacity: design.acrylicOpacity,
        depthWrite: false,
        side: DoubleSide,
        roughness: 0.07,
        metalness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        ior: 1.48,
        envMapIntensity: 1.65,
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
      <BaseAndChute materials={materials} open={gateOpen} hatchRef={hatchRef} />
      {showBalls && <BallPool count={count} design={normalized} />}
      <YRotor materials={materials} rotorRef={rotorRef} />
      <mesh geometry={shell} material={materials.acrylic} renderOrder={3} />
      <DrumFrame materials={materials} />
      {/* Inner 6-o'clock acrylic discharge funnel */}
      <mesh position={[0, -2.36, 0]} material={materials.acrylic} renderOrder={2}>
        <cylinderGeometry
          args={[
            Math.max(0.68, normalized.ballRadius * 1.54 + 0.28),
            Math.max(0.36, normalized.ballRadius * 1.54),
            0.45,
            24,
            1,
            true,
          ]}
        />
      </mesh>
    </group>
  )
}
