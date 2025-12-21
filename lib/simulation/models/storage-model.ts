/**
 * Storage Model for Digital Twin
 * 
 * Calculates storage capacity, utilization, and overflow
 * 
 * Properties validated:
 * - Property 1: Utilization Calculation Correctness
 * - Property 2: Zone Aggregation Correctness
 * - Property 4: Overflow Detection
 * - Property 7: Storage Reduction Calculation
 */

import { createClient } from '@/lib/supabase/server';
import {
  StorageModel,
  LocationCapacity,
  ZoneCapacity,
  WarehouseCapacity,
  UtilizationMetrics,
  CapacityChange,
  OverflowAnalysis,
  calculateUtilization,
  calculateOverflow,
} from '../types';

/**
 * Load current storage state from database
 */
export async function loadStorageModel(): Promise<StorageModel> {
  const supabase = await createClient();

  // Get all locations with their capacity and current stock
  const { data: locations, error: locError } = await supabase
    .from('master_location')
    .select(`
      id,
      location_code,
      zone,
      warehouse_id,
      max_capacity_qty,
      master_warehouse!inner (
        id,
        name
      )
    `)
    .eq('is_active', true);

  if (locError) {
    console.error('[StorageModel] Error loading locations:', locError);
    throw new Error(`Failed to load locations: ${locError.message}`);
  }

  // Get current inventory by location
  const { data: inventory, error: invError } = await supabase
    .from('wms_inventory_balances')
    .select('location_id, total_piece_qty')
    .gt('total_piece_qty', 0);

  if (invError) {
    console.error('[StorageModel] Error loading inventory:', invError);
    throw new Error(`Failed to load inventory: ${invError.message}`);
  }

  // Create inventory lookup by location
  const inventoryByLocation: Record<string, number> = {};
  inventory?.forEach((inv) => {
    const locId = inv.location_id;
    inventoryByLocation[locId] = (inventoryByLocation[locId] || 0) + (inv.total_piece_qty || 0);
  });

  // Build location capacities
  const locationCapacities: LocationCapacity[] = (locations || []).map((loc) => {
    const maxCapacity = loc.max_capacity_qty || 0;
    const currentQty = inventoryByLocation[loc.id] || 0;
    const utilization = calculateUtilization(currentQty, maxCapacity);
    const overflow = calculateOverflow(currentQty, maxCapacity);

    return {
      location_id: loc.id,
      location_code: loc.location_code,
      zone: loc.zone || 'UNKNOWN',
      warehouse_id: loc.warehouse_id,
      warehouse_name: (loc.master_warehouse as any)?.name || 'Unknown',
      max_capacity: maxCapacity,
      current_qty: currentQty,
      utilization_percent: Math.round(utilization * 100) / 100,
      is_overflow: overflow.isOverflow,
      overflow_qty: overflow.overflowQty,
    };
  });

  // Aggregate by zone (Property 2: Zone Aggregation Correctness)
  const zoneMap = new Map<string, ZoneCapacity>();
  locationCapacities.forEach((loc) => {
    const key = `${loc.warehouse_id}_${loc.zone}`;
    const existing = zoneMap.get(key);
    
    if (existing) {
      existing.total_locations += 1;
      existing.total_capacity += loc.max_capacity;
      existing.current_qty += loc.current_qty;
    } else {
      zoneMap.set(key, {
        zone: loc.zone,
        warehouse_id: loc.warehouse_id,
        warehouse_name: loc.warehouse_name,
        total_locations: 1,
        total_capacity: loc.max_capacity,
        current_qty: loc.current_qty,
        utilization_percent: 0,
        is_overflow: false,
        overflow_qty: 0,
      });
    }
  });

  // Calculate zone utilization and overflow
  const zoneCapacities: ZoneCapacity[] = Array.from(zoneMap.values()).map((zone) => {
    const utilization = calculateUtilization(zone.current_qty, zone.total_capacity);
    const overflow = calculateOverflow(zone.current_qty, zone.total_capacity);
    return {
      ...zone,
      utilization_percent: Math.round(utilization * 100) / 100,
      is_overflow: overflow.isOverflow,
      overflow_qty: overflow.overflowQty,
    };
  });

  // Aggregate by warehouse
  const warehouseMap = new Map<string, WarehouseCapacity>();
  zoneCapacities.forEach((zone) => {
    const existing = warehouseMap.get(zone.warehouse_id);
    
    if (existing) {
      existing.total_locations += zone.total_locations;
      existing.total_capacity += zone.total_capacity;
      existing.current_qty += zone.current_qty;
      existing.zones.push(zone);
    } else {
      warehouseMap.set(zone.warehouse_id, {
        warehouse_id: zone.warehouse_id,
        warehouse_name: zone.warehouse_name,
        total_locations: zone.total_locations,
        total_capacity: zone.total_capacity,
        current_qty: zone.current_qty,
        available_capacity: 0,
        utilization_percent: 0,
        is_overflow: false,
        overflow_qty: 0,
        zones: [zone],
      });
    }
  });

  // Calculate warehouse utilization and overflow
  const warehouseCapacities: WarehouseCapacity[] = Array.from(warehouseMap.values()).map((wh) => {
    const utilization = calculateUtilization(wh.current_qty, wh.total_capacity);
    const overflow = calculateOverflow(wh.current_qty, wh.total_capacity);
    return {
      ...wh,
      available_capacity: Math.max(0, wh.total_capacity - wh.current_qty),
      utilization_percent: Math.round(utilization * 100) / 100,
      is_overflow: overflow.isOverflow,
      overflow_qty: overflow.overflowQty,
    };
  });

  // Calculate summary
  const totalCapacity = warehouseCapacities.reduce((sum, wh) => sum + wh.total_capacity, 0);
  const currentQty = warehouseCapacities.reduce((sum, wh) => sum + wh.current_qty, 0);
  const overflowLocations = locationCapacities.filter((loc) => loc.is_overflow).length;
  const totalOverflowQty = locationCapacities.reduce((sum, loc) => sum + loc.overflow_qty, 0);

  return {
    locations: locationCapacities,
    zones: zoneCapacities,
    warehouses: warehouseCapacities,
    summary: {
      total_locations: locationCapacities.length,
      total_capacity: totalCapacity,
      current_qty: currentQty,
      available_capacity: Math.max(0, totalCapacity - currentQty),
      utilization_percent: Math.round(calculateUtilization(currentQty, totalCapacity) * 100) / 100,
      overflow_locations: overflowLocations,
      total_overflow_qty: totalOverflowQty,
    },
  };
}

/**
 * Get utilization metrics from storage model
 */
export function getUtilization(model: StorageModel): UtilizationMetrics {
  const byZone: Record<string, { capacity: number; used: number; utilization: number }> = {};
  model.zones.forEach((zone) => {
    byZone[zone.zone] = {
      capacity: zone.total_capacity,
      used: zone.current_qty,
      utilization: zone.utilization_percent,
    };
  });

  const byWarehouse: Record<string, { capacity: number; used: number; utilization: number }> = {};
  model.warehouses.forEach((wh) => {
    byWarehouse[wh.warehouse_name] = {
      capacity: wh.total_capacity,
      used: wh.current_qty,
      utilization: wh.utilization_percent,
    };
  });

  return {
    total_capacity: model.summary.total_capacity,
    used_capacity: model.summary.current_qty,
    available_capacity: model.summary.available_capacity,
    utilization_percent: model.summary.utilization_percent,
    overflow_qty: model.summary.total_overflow_qty,
    by_zone: byZone,
    by_warehouse: byWarehouse,
  };
}

/**
 * Apply capacity change to storage model (creates new model, doesn't modify original)
 * Property 7: Storage Reduction Calculation
 */
export function applyCapacityChange(model: StorageModel, change: CapacityChange): StorageModel {
  // Deep clone the model to ensure isolation
  const newModel: StorageModel = JSON.parse(JSON.stringify(model));

  if (change.type === 'reduction_percent' && change.reduction_percent !== undefined) {
    // Property 7: simulated total_capacity = baseline total_capacity * (1 - R/100)
    const reductionFactor = 1 - (change.reduction_percent / 100);
    
    // Apply to all locations (or filtered by zones)
    newModel.locations = newModel.locations.map((loc) => {
      if (change.affected_zones && !change.affected_zones.includes(loc.zone)) {
        return loc;
      }
      
      const newMaxCapacity = Math.round(loc.max_capacity * reductionFactor);
      const utilization = calculateUtilization(loc.current_qty, newMaxCapacity);
      const overflow = calculateOverflow(loc.current_qty, newMaxCapacity);
      
      return {
        ...loc,
        max_capacity: newMaxCapacity,
        utilization_percent: Math.round(utilization * 100) / 100,
        is_overflow: overflow.isOverflow,
        overflow_qty: overflow.overflowQty,
      };
    });
  } else if (change.type === 'reduction_locations' && change.reduction_locations) {
    // Remove specific locations
    newModel.locations = newModel.locations.filter(
      (loc) => !change.reduction_locations!.includes(loc.location_id)
    );
  }

  // Recalculate zones
  const zoneMap = new Map<string, ZoneCapacity>();
  newModel.locations.forEach((loc) => {
    const key = `${loc.warehouse_id}_${loc.zone}`;
    const existing = zoneMap.get(key);
    
    if (existing) {
      existing.total_locations += 1;
      existing.total_capacity += loc.max_capacity;
      existing.current_qty += loc.current_qty;
    } else {
      zoneMap.set(key, {
        zone: loc.zone,
        warehouse_id: loc.warehouse_id,
        warehouse_name: loc.warehouse_name,
        total_locations: 1,
        total_capacity: loc.max_capacity,
        current_qty: loc.current_qty,
        utilization_percent: 0,
        is_overflow: false,
        overflow_qty: 0,
      });
    }
  });

  newModel.zones = Array.from(zoneMap.values()).map((zone) => {
    const utilization = calculateUtilization(zone.current_qty, zone.total_capacity);
    const overflow = calculateOverflow(zone.current_qty, zone.total_capacity);
    return {
      ...zone,
      utilization_percent: Math.round(utilization * 100) / 100,
      is_overflow: overflow.isOverflow,
      overflow_qty: overflow.overflowQty,
    };
  });

  // Recalculate warehouses
  const warehouseMap = new Map<string, WarehouseCapacity>();
  newModel.zones.forEach((zone) => {
    const existing = warehouseMap.get(zone.warehouse_id);
    
    if (existing) {
      existing.total_locations += zone.total_locations;
      existing.total_capacity += zone.total_capacity;
      existing.current_qty += zone.current_qty;
      existing.zones.push(zone);
    } else {
      warehouseMap.set(zone.warehouse_id, {
        warehouse_id: zone.warehouse_id,
        warehouse_name: zone.warehouse_name,
        total_locations: zone.total_locations,
        total_capacity: zone.total_capacity,
        current_qty: zone.current_qty,
        available_capacity: 0,
        utilization_percent: 0,
        is_overflow: false,
        overflow_qty: 0,
        zones: [zone],
      });
    }
  });

  newModel.warehouses = Array.from(warehouseMap.values()).map((wh) => {
    const utilization = calculateUtilization(wh.current_qty, wh.total_capacity);
    const overflow = calculateOverflow(wh.current_qty, wh.total_capacity);
    return {
      ...wh,
      available_capacity: Math.max(0, wh.total_capacity - wh.current_qty),
      utilization_percent: Math.round(utilization * 100) / 100,
      is_overflow: overflow.isOverflow,
      overflow_qty: overflow.overflowQty,
    };
  });

  // Recalculate summary
  const totalCapacity = newModel.warehouses.reduce((sum, wh) => sum + wh.total_capacity, 0);
  const currentQty = newModel.warehouses.reduce((sum, wh) => sum + wh.current_qty, 0);
  const overflowLocations = newModel.locations.filter((loc) => loc.is_overflow).length;
  const totalOverflowQty = newModel.locations.reduce((sum, loc) => sum + loc.overflow_qty, 0);

  newModel.summary = {
    total_locations: newModel.locations.length,
    total_capacity: totalCapacity,
    current_qty: currentQty,
    available_capacity: Math.max(0, totalCapacity - currentQty),
    utilization_percent: Math.round(calculateUtilization(currentQty, totalCapacity) * 100) / 100,
    overflow_locations: overflowLocations,
    total_overflow_qty: totalOverflowQty,
  };

  return newModel;
}

/**
 * Calculate overflow analysis
 * Property 4: Overflow Detection
 */
export function calculateOverflowAnalysis(model: StorageModel): OverflowAnalysis {
  const overflowLocations = model.locations
    .filter((loc) => loc.is_overflow)
    .map((loc) => ({
      location_id: loc.location_id,
      location_code: loc.location_code,
      overflow_qty: loc.overflow_qty,
      utilization_percent: loc.utilization_percent,
    }));

  const affectedZones = [...new Set(
    model.locations
      .filter((loc) => loc.is_overflow)
      .map((loc) => loc.zone)
  )];

  return {
    has_overflow: overflowLocations.length > 0,
    total_overflow_qty: model.summary.total_overflow_qty,
    overflow_locations: overflowLocations,
    affected_zones: affectedZones,
  };
}
