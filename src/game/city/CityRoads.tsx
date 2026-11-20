import { memo, useEffect, useState } from 'react'
import { MeshStandardMaterial } from 'three'
import { buildCityGeometries } from './cityGeometry'

/**
 * Visible road network: two meshes in total (surface and markings). Geometry
 * and materials are created once and shared; nothing updates per frame.
 */
function CityRoadsImpl() {
  const [assets] = useState(() => ({
    geometries: buildCityGeometries(),
    surfaceMaterial: new MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 }),
    markingMaterial: new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0,
      // Pull the paint toward the camera in depth so it never flickers against the asphalt.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  }))

  useEffect(
    () => () => {
      assets.geometries.surface.dispose()
      assets.geometries.markings.dispose()
      assets.surfaceMaterial.dispose()
      assets.markingMaterial.dispose()
    },
    [assets],
  )

  return (
    <group name="city-roads">
      <mesh geometry={assets.geometries.surface} material={assets.surfaceMaterial} receiveShadow />
      <mesh geometry={assets.geometries.markings} material={assets.markingMaterial} receiveShadow renderOrder={1} />
    </group>
  )
}

export const CityRoads = memo(CityRoadsImpl)
