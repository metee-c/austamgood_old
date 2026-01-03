/**
 * Warehouse Physical Model - WH001 (ENGINEERING SCALE - REVISED)
 * Based on actual warehouse floor plan with correct proportions
 * Coordinate System: (0,0) = Top-Left, X=Left→Right, Y=Top→Bottom, Unit=Meter
 *
 * CRITICAL RULES:
 * - Racks MUST be long (30m+) along X-axis
 * - BLK MUST consume depth (Y-axis), not width
 * - Dock MUST be flush against right wall
 * - Layout MUST look like factory floor, NOT dashboard
 */

export type PhysicalObjectType = 'RACK' | 'BLK' | 'DOCK' | 'AISLE' | 'PICKING' | 'OFFICE';
export type Orientation = 'N' | 'S' | 'E' | 'W' | 'E-W' | 'N-S';

export interface PhysicalObject {
  id: string;
  type: PhysicalObjectType;
  label: string;
  x: number; // meters from origin
  y: number; // meters from origin
  width: number; // meters (along X-axis)
  height: number; // meters (along Y-axis / depth)
  orientation?: Orientation;
  zone?: string;
  row?: number;
  metadata?: Record<string, any>;
}

export interface RackBay {
  rack_id: string;
  bay_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  levels: number;
}

export interface WarehousePhysicalLayout {
  warehouse_id: string;
  warehouse_code: string;
  total_width: number; // meters
  total_depth: number; // meters
  main_aisle_width: number;
  secondary_aisle_width: number;
  objects: PhysicalObject[];
  racks: RackBay[];
}

/**
 * WH001 Physical Layout Definition (ENGINEERING SCALE)
 * Source: REVISED WAREHOUSE LAYOUT MAPPING TABLE
 */
export const WH001_PHYSICAL_LAYOUT: WarehousePhysicalLayout = {
  warehouse_id: 'WH001',
  warehouse_code: 'WH001',
  total_width: 80,
  total_depth: 60,
  main_aisle_width: 4.7,
  secondary_aisle_width: 5,
  objects: [
    // ===== Selective Racks - Row 1 (Top) =====
    {
      id: 'SR-A01',
      type: 'RACK',
      label: 'A01',
      x: 4,
      y: 3,
      width: 30, // LONG rack along X
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-A',
      row: 1,
    },
    {
      id: 'SR-A02',
      type: 'RACK',
      label: 'A02',
      x: 38,
      y: 3,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-A',
      row: 1,
    },
    {
      id: 'SR-A03',
      type: 'RACK',
      label: 'A03',
      x: 4,
      y: 10.5,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-A',
      row: 1,
      metadata: { note: 'Offset position' },
    },

    // ===== Selective Racks - Row 2 =====
    {
      id: 'SR-A04',
      type: 'RACK',
      label: 'A04',
      x: 4,
      y: 18,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-B',
      row: 2,
    },
    {
      id: 'SR-A05',
      type: 'RACK',
      label: 'A05',
      x: 38,
      y: 18,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-B',
      row: 2,
    },

    // ===== Selective Racks - Row 3 =====
    {
      id: 'SR-A06',
      type: 'RACK',
      label: 'A06',
      x: 4,
      y: 25.5,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-C',
      row: 3,
    },
    {
      id: 'SR-A07',
      type: 'RACK',
      label: 'A07',
      x: 38,
      y: 25.5,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-C',
      row: 3,
    },

    // ===== Selective Racks - Row 4 =====
    {
      id: 'SR-A08',
      type: 'RACK',
      label: 'A08',
      x: 4,
      y: 33,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-D',
      row: 4,
    },
    {
      id: 'SR-A09',
      type: 'RACK',
      label: 'A09',
      x: 38,
      y: 33,
      width: 30,
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-D',
      row: 4,
    },

    // ===== Bottom Long Rack (A10) =====
    {
      id: 'SR-A10',
      type: 'RACK',
      label: 'A10',
      x: 4,
      y: 40,
      width: 64, // EXTRA LONG rack
      height: 2.8,
      orientation: 'E-W',
      zone: 'SR-E',
      row: 5,
      metadata: { note: 'Extra long rack' },
    },

    // ===== Dock Area (Flush against right wall) =====
    {
      id: 'DOCK-D01',
      type: 'DOCK',
      label: 'D01',
      x: 74,
      y: 5,
      width: 4,
      height: 3,
      zone: 'DOCK',
      metadata: { wall_position: 'right' },
    },
    {
      id: 'DOCK-D02',
      type: 'DOCK',
      label: 'D02',
      x: 74,
      y: 9,
      width: 4,
      height: 3,
      zone: 'DOCK',
      metadata: { wall_position: 'right' },
    },
    {
      id: 'DOCK-D03',
      type: 'DOCK',
      label: 'D03',
      x: 74,
      y: 13,
      width: 4,
      height: 3,
      zone: 'DOCK',
      metadata: { wall_position: 'right' },
    },
    {
      id: 'DOCK-D04',
      type: 'DOCK',
      label: 'D04',
      x: 74,
      y: 17,
      width: 4,
      height: 3,
      zone: 'DOCK',
      metadata: { wall_position: 'right' },
    },
    {
      id: 'DOCK-D05',
      type: 'DOCK',
      label: 'D05',
      x: 74,
      y: 21,
      width: 4,
      height: 3,
      zone: 'DOCK',
      metadata: { wall_position: 'right' },
    },
    {
      id: 'DOCK-D06',
      type: 'DOCK',
      label: 'D06',
      x: 74,
      y: 25,
      width: 4,
      height: 3,
      zone: 'DOCK',
      metadata: { wall_position: 'right' },
    },

    // ===== BLK Storage - AA (DEEP along Y-axis) =====
    {
      id: 'BLK-AA',
      type: 'BLK',
      label: 'AA-BLK (01-30)',
      x: 4,
      y: 44,
      width: 30,
      height: 14, // DEEP not wide
      zone: 'AA-BLK',
      orientation: 'N-S',
      metadata: { start_location: 'AA-BLK01', end_location: 'AA-BLK30' },
    },

    // ===== BLK Storage - AB (EXTRA DEEP) =====
    {
      id: 'BLK-AB',
      type: 'BLK',
      label: 'AB-BLK (01-30)',
      x: 4,
      y: 58,
      width: 60,
      height: 18, // VERY DEEP
      zone: 'AB-BLK',
      orientation: 'N-S',
      metadata: { start_location: 'AB-BLK01', end_location: 'AB-BLK30' },
    },

    // ===== Picking Zone (Related to flow) =====
    {
      id: 'PICKING-PZ1',
      type: 'PICKING',
      label: 'Picking Zone 1',
      x: 42,
      y: 44,
      width: 18,
      height: 10,
      zone: 'PICKING',
      metadata: { note: 'Near BLK and Dock for flow' },
    },

    // ===== Office + Battery Charger =====
    {
      id: 'OFFICE-1',
      type: 'OFFICE',
      label: 'Office',
      x: 62,
      y: 44,
      width: 14,
      height: 16,
      zone: 'OFFICE',
    },
    {
      id: 'CHARGER-1',
      type: 'OFFICE',
      label: 'Battery Charger',
      x: 62,
      y: 60,
      width: 14,
      height: 6,
      zone: 'OFFICE',
      metadata: { type: 'charger' },
    },

    // ===== Main Aisles (Visual reference) =====
    {
      id: 'AISLE-MAIN-1',
      type: 'AISLE',
      label: 'Main Aisle',
      x: 34,
      y: 3,
      width: 4,
      height: 37,
      metadata: { width_m: 4.7 },
    },
    {
      id: 'AISLE-MAIN-2',
      type: 'AISLE',
      label: 'Main Aisle',
      x: 68,
      y: 3,
      width: 4,
      height: 37,
      metadata: { width_m: 4.7 },
    },
  ],
  racks: [],
};

/**
 * Convert meters to pixels for rendering
 * @param meters - Physical dimension in meters
 * @param scale - Pixels per meter (default: 12)
 */
export function metersToPixels(meters: number, scale: number = 12): number {
  return meters * scale;
}

/**
 * Get physical object by location code
 */
export function getPhysicalObjectByLocation(locationCode: string): PhysicalObject | null {
  // Parse location code (e.g., "A04-B03-L2" → Rack A04)
  const rackMatch = locationCode.match(/^([A-Z]\d+)/);
  if (!rackMatch) return null;

  const rackCode = rackMatch[1];
  return WH001_PHYSICAL_LAYOUT.objects.find(
    (obj) => obj.type === 'RACK' && obj.label === rackCode
  ) || null;
}

/**
 * Get BLK zone object by location code
 */
export function getBLKZoneByLocation(locationCode: string): PhysicalObject | null {
  if (locationCode.startsWith('AA-BLK')) {
    return WH001_PHYSICAL_LAYOUT.objects.find((obj) => obj.id === 'BLK-AA') || null;
  }
  if (locationCode.startsWith('AB-BLK')) {
    return WH001_PHYSICAL_LAYOUT.objects.find((obj) => obj.id === 'BLK-AB') || null;
  }
  return null;
}

/**
 * Validation: Ensure layout meets engineering constraints
 */
export function validatePhysicalLayout(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: Racks must be LONG (width > height significantly)
  const racks = WH001_PHYSICAL_LAYOUT.objects.filter((obj) => obj.type === 'RACK');
  racks.forEach((rack) => {
    if (rack.width <= rack.height * 5) {
      errors.push(`❌ FAIL: Rack ${rack.label} not long enough (${rack.width}m × ${rack.height}m)`);
    }
  });

  // Rule 2: BLK must consume DEPTH (height must be significant)
  const blkZones = WH001_PHYSICAL_LAYOUT.objects.filter((obj) => obj.type === 'BLK');
  blkZones.forEach((blk) => {
    if (blk.height < 10) {
      errors.push(`❌ FAIL: BLK ${blk.label} not deep enough (${blk.height}m)`);
    }
  });

  // Rule 3: Dock must be flush against right wall
  const docks = WH001_PHYSICAL_LAYOUT.objects.filter((obj) => obj.type === 'DOCK');
  const maxX = WH001_PHYSICAL_LAYOUT.total_width;
  docks.forEach((dock) => {
    if (dock.x + dock.width < maxX - 2) {
      errors.push(`❌ FAIL: Dock ${dock.label} not flush against right wall (x=${dock.x})`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
