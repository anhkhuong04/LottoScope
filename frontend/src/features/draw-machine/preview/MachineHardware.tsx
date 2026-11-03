import { useEffect, useMemo } from 'react'
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three'

export type Materials = {
  white: MeshStandardMaterial
  silver: MeshStandardMaterial
  dark: MeshStandardMaterial
  acrylic: MeshPhysicalMaterial
}

function roundedRectangle(width: number, height: number, radius: number) {
  const shape = new Shape()
  const x = -width / 2
  const y = -height / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + height - radius)
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  shape.lineTo(x + radius, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  return shape
}

export function Supports({ materials }: { materials: Materials }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(2.69, 0.12)
    shape.quadraticCurveTo(3.21, -0.8, 2.35, -2.61)
    shape.lineTo(1.95, -2.72)
    shape.quadraticCurveTo(2.91, -0.85, 2.42, 0.12)
    shape.closePath()
    return new ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 24,
    })
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} material={materials.silver}>
        <cylinderGeometry args={[0.105, 0.105, 5.8, 20]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={geometry}
            position={[0, 0, -0.11]}
            scale={[side, 1, 1]}
            material={materials.white}
          />
          <mesh
            position={[side * 2.53, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={materials.white}
          >
            <cylinderGeometry args={[0.32, 0.32, 0.14, 32]} />
          </mesh>
          <mesh
            position={[side * 2.76, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={materials.silver}
          >
            <cylinderGeometry args={[0.23, 0.23, 0.28, 32]} />
          </mesh>
          <mesh
            position={[side * 2.92, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={materials.white}
          >
            <cylinderGeometry args={[0.28, 0.28, 0.08, 32]} />
          </mesh>
          <mesh
            position={[side * 2.97, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={materials.silver}
          >
            <torusGeometry args={[0.16, 0.025, 8, 28]} />
          </mesh>
          <mesh position={[side * 2.15, -2.69, 0]} material={materials.white}>
            <boxGeometry args={[0.7, 0.16, 0.65]} />
          </mesh>
          {[-0.23, 0.23].map((z) => (
            <mesh key={z} position={[side * 2.15, -2.58, z]} material={materials.silver}>
              <cylinderGeometry args={[0.047, 0.047, 0.05, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function GateAndChute({ materials, open }: { materials: Materials; open: boolean }) {
  const { flange, hatch, spring } = useMemo(() => {
    const shape = roundedRectangle(1.12, 1.06, 0.2)
    const hole = new Path()
    hole.moveTo(-0.37, -0.34)
    hole.lineTo(-0.37, 0.34)
    hole.lineTo(0.37, 0.34)
    hole.lineTo(0.37, -0.34)
    hole.closePath()
    shape.holes.push(hole)
    const options = {
      depth: 0.1,
      bevelEnabled: true,
      bevelSize: 0.022,
      bevelThickness: 0.015,
      bevelSegments: 2,
      steps: 1,
    }
    const points = Array.from(
      { length: 97 },
      (_, i) =>
        new Vector3(
          0.68 + Math.cos((i / 96) * Math.PI * 16) * 0.055,
          -0.22 + (i / 96) * 0.7,
          Math.sin((i / 96) * Math.PI * 16) * 0.055,
        ),
    )
    return {
      flange: new ExtrudeGeometry(shape, options),
      hatch: new ExtrudeGeometry(roundedRectangle(0.77, 0.74, 0.1), { ...options, depth: 0.035 }),
      spring: new TubeGeometry(new CatmullRomCurve3(points), 96, 0.012, 5, false),
    }
  }, [])
  useEffect(
    () => () => {
      flange.dispose()
      hatch.dispose()
      spring.dispose()
    },
    [flange, hatch, spring],
  )
  return (
    <group position={[0, -1.62, 2.02]}>
      <mesh geometry={flange} material={materials.white} />
      <mesh geometry={hatch} material={materials.silver} position={[0, open ? 0.77 : 0, -0.065]} />
      <mesh geometry={spring} position={[0, 0, 0.12]} material={materials.silver} />
      <mesh
        position={[0.47, 0.08, 0.18]}
        rotation={[0, 0, open ? 0.65 : -0.1]}
        material={materials.white}
      >
        <boxGeometry args={[0.5, 0.11, 0.07]} />
      </mesh>
      {[-0.46, 0.46].flatMap((x) =>
        [-0.4, 0, 0.4].map((y) => (
          <mesh
            key={`${x}-${y}`}
            position={[x, y, 0.13]}
            rotation={[Math.PI / 2, 0, 0]}
            material={materials.silver}
          >
            <cylinderGeometry args={[0.043, 0.043, 0.04, 6]} />
          </mesh>
        )),
      )}
      <group position={[0, -0.4, 0.85]} rotation={[0.2, 0, 0]}>
        <mesh material={materials.acrylic} position={[0, 0, 0]} renderOrder={2}>
          <boxGeometry args={[0.84, 0.055, 1.6]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.43, 0.16, 0]} material={materials.acrylic} renderOrder={2}>
              <boxGeometry args={[0.035, 0.34, 1.6]} />
            </mesh>
            {[0.02, 0.32].map((y) => (
              <mesh key={y} position={[side * 0.46, y, 0]} material={materials.white}>
                <boxGeometry args={[0.045, 0.045, 1.64]} />
              </mesh>
            ))}
            {[-0.77, 0.77].map((z) => (
              <mesh key={z} position={[side * 0.46, 0.17, z]} material={materials.white}>
                <boxGeometry args={[0.045, 0.34, 0.045]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0, 0.81]} material={materials.white}>
          <boxGeometry args={[0.95, 0.06, 0.055]} />
        </mesh>
      </group>
      <mesh position={[0, -0.77, 0]} material={materials.white}>
        <cylinderGeometry args={[0.3, 0.4, 0.7, 24]} />
      </mesh>
    </group>
  )
}
