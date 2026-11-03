import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  ShaderChunk,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { staticBallPositions, type Design } from './design'

export function BallPool({ count, design }: { count: number; design: Design }) {
  const mesh = useRef<InstancedMesh>(null)
  const resource = useMemo(() => {
    const tileWidth = design.quality === 'economy' ? 128 : 256
    const tileHeight = tileWidth / 2
    const canvas = document.createElement('canvas')
    canvas.width = tileWidth * 8
    canvas.height = tileHeight * 8
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Không tạo được texture số bóng.')
    context.fillStyle = design.ballColor
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = design.digitColor
    context.font = `bold ${tileHeight * 0.43}px Arial`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const offsets: number[] = []
    for (let i = 0; i < count; i++) {
      const column = i % 8
      const row = Math.floor(i / 8)
      offsets.push(column / 8, row / 8)
      for (const half of [0.25, 0.75]) {
        context.fillText(
          String(i + 1).padStart(2, '0'),
          (column + half) * tileWidth,
          (7 - row + 0.51) * tileHeight,
        )
      }
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.34, metalness: 0 })
    // One atlas and draw call for the pool. Each instance samples its own numbered tile.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'attribute vec2 atlasCell; varying vec2 vAtlasCell;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvAtlasCell = atlasCell;',
      )
      shader.fragmentShader = 'varying vec2 vAtlasCell;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        ShaderChunk.map_fragment.replaceAll('vMapUv', '(vMapUv / 8.0 + vAtlasCell)'),
      )
    }
    material.customProgramCacheKey = () => 'lotto-static-atlas-v1'
    const geometry = new SphereGeometry(
      design.ballRadius,
      design.quality === 'economy' ? 20 : 28,
      18,
    )
    geometry.setAttribute('atlasCell', new InstancedBufferAttribute(new Float32Array(offsets), 2))
    return { texture, material, geometry }
  }, [count, design.ballColor, design.digitColor, design.ballRadius, design.quality])
  const positions = useMemo(
    () => staticBallPositions(count, design.radius, design.ballRadius),
    [count, design.radius, design.ballRadius],
  )
  useLayoutEffect(() => {
    const matrix = new Matrix4()
    positions.forEach((position, index) => {
      matrix.makeTranslation(...position)
      mesh.current!.setMatrixAt(index, matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [positions, resource])
  useEffect(
    () => () => {
      resource.geometry.dispose()
      resource.material.dispose()
      resource.texture.dispose()
    },
    [resource],
  )
  return (
    <instancedMesh ref={mesh} args={[resource.geometry, resource.material, count]} receiveShadow />
  )
}
