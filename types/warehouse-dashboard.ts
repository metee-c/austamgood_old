// ============================================================================
// Type Definitions: Warehouse Dashboard 2D Model
// ============================================================================

export interface LocationInventory {
  location_id: string;
  location_code: string;
  location_name: string | null;
  location_type: string;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  active_status: string;

  // Inventory data
  sku_count: number;
  total_pack_qty: number;
  total_piece_qty: number;
  reserved_pack_qty: number;
  reserved_piece_qty: number;

  // Capacity
  max_capacity_qty: number;
  current_qty: number;
  utilization_percent: number;

  // Status
  is_empty: boolean;
  is_full: boolean;
  has_reserved: boolean;
}

export interface ZoneGroup {
  zone_name: string;
  zone_type: 'selective_rack' | 'blk_storage' | 'picking' | 'dock' | 'other';
  locations: LocationInventory[];
  total_locations: number;
  occupied_locations: number;
  total_sku_count: number;
  total_qty: number;
  utilization_percent: number;
}

export interface WarehouseDashboardData {
  warehouse_id: string;
  warehouse_name: string;
  zones: ZoneGroup[];
  total_locations: number;
  occupied_locations: number;
  total_sku_count: number;
  total_qty: number;
  last_updated: string;
}

export interface LocationDetailData extends LocationInventory {
  items: LocationItem[];
}

export interface LocationItem {
  balance_id: number;
  sku_id: string;
  sku_name: string;
  pallet_id: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  total_pack_qty: number;
  total_piece_qty: number;
  reserved_pack_qty: number;
  reserved_piece_qty: number;
  last_movement_at: string | null;
}

export type LocationStatus = 'empty' | 'available' | 'reserved' | 'full' | 'blocked';

export function getLocationStatus(location: LocationInventory): LocationStatus {
  if (!location.is_empty && location.current_qty === 0) return 'empty';
  if (location.is_full || location.utilization_percent >= 95) return 'full';
  if (location.has_reserved && location.reserved_piece_qty > 0) return 'reserved';
  if (location.sku_count > 0) return 'available';
  return 'empty';
}

export function getStatusColor(status: LocationStatus): string {
  switch (status) {
    case 'empty': return '#E5E7EB'; // gray-200
    case 'available': return '#34D399'; // green-400
    case 'reserved': return '#FBBF24'; // yellow-400
    case 'full': return '#EF4444'; // red-400
    case 'blocked': return '#6B7280'; // gray-500
    default: return '#E5E7EB';
  }
}
