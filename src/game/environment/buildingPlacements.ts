import type { BuildingDef } from './envTypes'

/**
 * Every building in VEXTRIDE City: type, lot, centre, size and entrance side.
 * Coordinates are world metres (X east, Z south). Each building sits inside
 * one of the city's lots with its entrance toward the nearest street; a test
 * checks that none touches a road, sidewalk or another building.
 * Business names are fictional.
 */
type Spec = Omit<BuildingDef, 'id'>

const SPECS: readonly Spec[] = [
  // Downtown: offices and brick commercial blocks.
  { type: 'office', districtId: 'downtown', blockId: 'B10', x: -34, z: -132, width: 24, depth: 24, height: 44, facing: 'E', variant: 0, name: 'MERIDIAN TOWER' },
  { type: 'brick-commercial', districtId: 'downtown', blockId: 'B10', x: -50, z: -101, width: 26, depth: 14, height: 13, facing: 'S', variant: 0, name: 'Dough & Daisy Bakery' },
  { type: 'brick-commercial', districtId: 'downtown', blockId: 'B10', x: -22, z: -101, width: 18, depth: 14, height: 17, facing: 'S', variant: 1, name: 'Lumen Books' },
  { type: 'office', districtId: 'downtown', blockId: 'B20', x: 31, z: -133, width: 22, depth: 22, height: 52, facing: 'W', variant: 1, name: 'ALTAMAR GROUP' },
  { type: 'brick-commercial', districtId: 'downtown', blockId: 'B20', x: 30, z: -101, width: 24, depth: 14, height: 11, facing: 'S', variant: 2, name: 'Rustic Pour Coffee' },
  // Residential: low-rise apartments and houses.
  { type: 'apartment', districtId: 'residential', blockId: 'B00', x: -118, z: -100, width: 30, depth: 16, height: 14, facing: 'S', variant: 0, name: 'BIRCHWOOD' },
  { type: 'house', districtId: 'residential', blockId: 'B00', x: -98, z: -124, width: 12, depth: 10, height: 3.2, facing: 'E', variant: 0, name: '' },
  { type: 'house', districtId: 'residential', blockId: 'B00', x: -98, z: -141, width: 11, depth: 10, height: 3.2, facing: 'E', variant: 1, name: '' },
  { type: 'apartment', districtId: 'residential', blockId: 'B01', x: -118, z: -24, width: 28, depth: 16, height: 14, facing: 'S', variant: 2, name: 'LINDEN COURT' },
  { type: 'house', districtId: 'residential', blockId: 'B01', x: -98, z: -60, width: 12, depth: 10, height: 3.2, facing: 'E', variant: 2, name: '' },
  { type: 'house', districtId: 'residential', blockId: 'B01', x: -98, z: -44, width: 12, depth: 10, height: 3.2, facing: 'E', variant: 3, name: '' },
  // Motor Row: garage, showroom, workshop and a corner store.
  { type: 'garage', districtId: 'motor-row', blockId: 'B30', x: 101, z: -103, width: 24, depth: 18, height: 7.5, facing: 'S', variant: 0, name: 'TORQUE & CO.' },
  { type: 'showroom', districtId: 'motor-row', blockId: 'B30', x: 130, z: -104, width: 28, depth: 18, height: 7, facing: 'S', variant: 0, name: 'STRATUS MOTORS' },
  { type: 'workshop', districtId: 'motor-row', blockId: 'B31', x: 104, z: -26, width: 20, depth: 14, height: 6, facing: 'S', variant: 0, name: 'GEARHEAD TUNING' },
  { type: 'convenience-store', districtId: 'motor-row', blockId: 'B31', x: 98, z: -58, width: 16, depth: 12, height: 4.5, facing: 'W', variant: 0, name: 'Daybreak Mart' },
  // Warehouse / Industrial.
  { type: 'warehouse', districtId: 'industrial', blockId: 'B32', x: 108, z: 41, width: 44, depth: 26, height: 11, facing: 'W', variant: 0, name: 'HARBORLIGHT FREIGHT' },
  { type: 'warehouse', districtId: 'industrial', blockId: 'B23', x: 40, z: 108, width: 40, depth: 24, height: 10, facing: 'N', variant: 1, name: 'BLUECRATE LOGISTICS' },
  { type: 'workshop', districtId: 'industrial', blockId: 'B23', x: 30, z: 138, width: 18, depth: 12, height: 6, facing: 'S', variant: 1, name: 'FORGE & FIX' },
  { type: 'warehouse', districtId: 'industrial', blockId: 'B33', x: 120, z: 118, width: 46, depth: 28, height: 12, facing: 'N', variant: 2, name: 'IRONWOOD SUPPLY' },
  // Riverside.
  { type: 'convenience-store', districtId: 'riverside', blockId: 'B13', x: -41, z: 102, width: 18, depth: 12, height: 4.5, facing: 'N', variant: 2, name: 'Willow Bend Cafe' },
]

export const BUILDINGS: readonly BuildingDef[] = SPECS.map((s, i) => ({ id: `building-${String(i + 1).padStart(2, '0')}`, ...s }))
