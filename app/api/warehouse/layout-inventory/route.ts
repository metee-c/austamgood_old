import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface LocationInventory {
  location_id: string;
  location_code: string;
  aisle: string;
  shelf: string;
  lock_number: number;
  has_inventory: boolean;
  sku_id?: string;
  sku_name?: string;
  pallet_id?: string;
  total_pack_qty?: number;
  expiry_date?: string;
  reserved_pack_qty?: number;
}

export interface SlotInventory {
  slot_index: number;
  aisle: string;
  levels: {
    level: number;
    positions: LocationInventory[];
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const aisle = searchParams.get('aisle');
    const slot = searchParams.get('slot'); // slot number (1-based)
    const zone = searchParams.get('zone'); // for block storage (AA-BLK, AB-BLK)
    const type = searchParams.get('type'); // 'block' for block storage
    
    // Handle Picking Zone 1 request (preparation area inventory)
    if (type === 'picking-zone-1') {
      try {
        // Get all active preparation area codes
        const { data: prepAreas, error: prepError } = await supabase
          .from('preparation_area')
          .select('area_code')
          .eq('status', 'active');
        
        if (prepError) {
          console.error('[API DEBUG] Preparation area query error:', prepError);
          return NextResponse.json({ error: prepError.message }, { status: 500 });
        }
        
        const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
        console.log(`[API DEBUG] Found ${prepAreaCodes.length} preparation areas`);
        
        if (prepAreaCodes.length === 0) {
          return NextResponse.json({ data: [] });
        }
        
        // Get inventory for all preparation areas
        const { data: inventory, error: invError } = await supabase
          .from('wms_inventory_balances')
          .select(`
            location_id,
            sku_id,
            pallet_id,
            total_pack_qty,
            total_piece_qty,
            production_date,
            expiry_date,
            reserved_pack_qty,
            reserved_piece_qty,
            master_sku(sku_name)
          `)
          .in('location_id', prepAreaCodes)
          .gt('total_piece_qty', 0)
          .order('location_id')
          .order('sku_id');
        
        if (invError) {
          console.error('[API DEBUG] Picking Zone 1 inventory query error:', invError);
          return NextResponse.json({ error: invError.message }, { status: 500 });
        }
        
        // Map inventory to response format
        const result = (inventory || []).map(inv => {
          let skuName: string | undefined;
          if (inv.master_sku) {
            if (Array.isArray(inv.master_sku)) {
              skuName = inv.master_sku[0]?.sku_name;
            } else {
              skuName = (inv.master_sku as { sku_name: string }).sku_name;
            }
          }
          
          return {
            location_id: inv.location_id,
            sku_id: inv.sku_id,
            sku_name: skuName,
            pallet_id: inv.pallet_id,
            total_pack_qty: inv.total_pack_qty ? parseFloat(inv.total_pack_qty.toString()) : 0,
            total_piece_qty: inv.total_piece_qty ? parseFloat(inv.total_piece_qty.toString()) : 0,
            production_date: inv.production_date,
            expiry_date: inv.expiry_date,
            reserved_pack_qty: inv.reserved_pack_qty ? parseFloat(inv.reserved_pack_qty.toString()) : 0,
            reserved_piece_qty: inv.reserved_piece_qty ? parseFloat(inv.reserved_piece_qty.toString()) : 0,
          };
        });
        
        console.log(`[API DEBUG] Picking Zone 1: ${result.length} inventory items found`);
        
        return NextResponse.json({ data: result });
      } catch (pickingError) {
        console.error('[API DEBUG] Error in Picking Zone 1:', pickingError);
        return NextResponse.json(
          { error: pickingError instanceof Error ? pickingError.message : 'Error fetching Picking Zone 1 data' },
          { status: 500 }
        );
      }
    }
    
    // Handle Repack request
    if (type === 'repack') {
      try {
        // Get inventory for Repack location
        const { data: inventory, error: invError } = await supabase
          .from('wms_inventory_balances')
          .select(`
            location_id,
            sku_id,
            pallet_id,
            total_pack_qty,
            total_piece_qty,
            production_date,
            expiry_date,
            reserved_pack_qty,
            reserved_piece_qty,
            master_sku(sku_name)
          `)
          .eq('location_id', 'Repack')
          .gt('total_piece_qty', 0)
          .order('sku_id');
        
        if (invError) {
          console.error('[API DEBUG] Repack inventory query error:', invError);
          return NextResponse.json({ error: invError.message }, { status: 500 });
        }
        
        // Map inventory to response format
        const result = (inventory || []).map(inv => {
          let skuName: string | undefined;
          if (inv.master_sku) {
            if (Array.isArray(inv.master_sku)) {
              skuName = inv.master_sku[0]?.sku_name;
            } else {
              skuName = (inv.master_sku as { sku_name: string }).sku_name;
            }
          }
          
          return {
            location_id: inv.location_id,
            sku_id: inv.sku_id,
            sku_name: skuName,
            pallet_id: inv.pallet_id,
            total_pack_qty: inv.total_pack_qty ? parseFloat(inv.total_pack_qty.toString()) : 0,
            total_piece_qty: inv.total_piece_qty ? parseFloat(inv.total_piece_qty.toString()) : 0,
            production_date: inv.production_date,
            expiry_date: inv.expiry_date,
            reserved_pack_qty: inv.reserved_pack_qty ? parseFloat(inv.reserved_pack_qty.toString()) : 0,
            reserved_piece_qty: inv.reserved_piece_qty ? parseFloat(inv.reserved_piece_qty.toString()) : 0,
          };
        });
        
        console.log(`[API DEBUG] Repack: ${result.length} inventory items found`);
        
        return NextResponse.json({ data: result });
      } catch (repackError) {
        console.error('[API DEBUG] Error in Repack:', repackError);
        return NextResponse.json(
          { error: repackError instanceof Error ? repackError.message : 'Error fetching Repack data' },
          { status: 500 }
        );
      }
    }
    
    // Handle block storage request (AA-BLK, AB-BLK)
    if (type === 'block' && zone && slot) {
      try {
        const slotNum = parseInt(slot);
        const slotStr = slotNum.toString().padStart(2, '0');
        // zone format: "AA-BLK" or "AB-BLK" or "AA-BLK-R" (right section)
        // For AA-BLK-R, we need to offset the slot number
        let locationCode: string;
        if (zone === 'AA-BLK-R') {
          // Right section of AA-BLK starts at slot 17 (17+slotNum-1)
          const actualSlot = 17 + slotNum - 1;
          locationCode = `AA-BLK-${actualSlot.toString().padStart(2, '0')}`;
        } else {
          locationCode = `${zone}-${slotStr}`;
        }
        
        console.log(`[API DEBUG] Fetching block storage: zone=${zone}, slot=${slotNum}, locationCode=${locationCode}`);
        
        // Get the location
        const { data: location, error: locError } = await supabase
          .from('master_location')
          .select('location_id, location_code, aisle, shelf')
          .eq('location_type', 'floor')
          .eq('location_code', locationCode)
          .single();
        
        if (locError) {
          console.error('[API DEBUG] Block location query error:', locError);
          return NextResponse.json({ error: locError.message }, { status: 500 });
        }
        
        if (!location) {
          return NextResponse.json({ 
            data: {
              slot_index: slotNum,
              zone,
              location_code: locationCode,
              pallets: [],
              total_pallets: 0,
            }
          });
        }
        
        // Get all inventory (pallets) for this location
        const { data: inventory, error: invError } = await supabase
          .from('wms_inventory_balances')
          .select(`
            location_id,
            sku_id,
            pallet_id,
            total_pack_qty,
            total_piece_qty,
            production_date,
            expiry_date,
            reserved_pack_qty,
            master_sku(sku_name)
          `)
          .eq('location_id', location.location_id)
          .gt('total_pack_qty', 0)
          .order('pallet_id');
        
        if (invError) {
          console.error('[API DEBUG] Block inventory query error:', invError);
          return NextResponse.json({ error: invError.message }, { status: 500 });
        }
        
        // Map inventory to pallets array
        const pallets = (inventory || []).map((inv, index) => {
          let skuName: string | undefined;
          if (inv.master_sku) {
            if (Array.isArray(inv.master_sku)) {
              skuName = inv.master_sku[0]?.sku_name;
            } else {
              skuName = (inv.master_sku as { sku_name: string }).sku_name;
            }
          }
          
          return {
            index,
            location_id: location.location_id,
            location_code: location.location_code,
            sku_id: inv.sku_id,
            sku_name: skuName,
            pallet_id: inv.pallet_id,
            total_pack_qty: inv.total_pack_qty ? parseFloat(inv.total_pack_qty.toString()) : 0,
            total_piece_qty: inv.total_piece_qty ? parseFloat(inv.total_piece_qty.toString()) : 0,
            production_date: inv.production_date,
            expiry_date: inv.expiry_date,
            reserved_pack_qty: inv.reserved_pack_qty ? parseFloat(inv.reserved_pack_qty.toString()) : 0,
          };
        });
        
        console.log(`[API DEBUG] Block storage ${locationCode}: ${pallets.length} pallets found`);
        
        return NextResponse.json({ 
          data: {
            slot_index: slotNum,
            zone,
            location_code: locationCode,
            pallets,
            total_pallets: pallets.length,
          }
        });
      } catch (blockError) {
        console.error('[API DEBUG] Error in block storage details:', blockError);
        return NextResponse.json(
          { error: blockError instanceof Error ? blockError.message : 'Error fetching block storage details' },
          { status: 500 }
        );
      }
    }
    
    // If specific slot requested, get detailed inventory for that slot (rack)
    if (aisle && slot) {
      try {
        const slotNum = parseInt(slot);
        // Each slot has 2 locks: slot 1 = locks 001,002; slot 2 = locks 003,004; etc.
        const lock1 = (slotNum - 1) * 2 + 1;
        const lock2 = lock1 + 1;
        const lock1Str = lock1.toString().padStart(3, '0');
        const lock2Str = lock2.toString().padStart(3, '0');
        
        console.log(`[API DEBUG] Fetching slot details: aisle=${aisle}, slot=${slotNum}, locks=${lock1Str},${lock2Str}`);
        
        // Get all locations for this slot (all 5 levels, 2 locks each)
        // Build location codes for all 5 levels
        const targetLocationCodes: string[] = [];
        for (let level = 1; level <= 5; level++) {
          const levelStr = level.toString().padStart(2, '0');
          targetLocationCodes.push(`${aisle}-${levelStr}-${lock1Str}`);
          targetLocationCodes.push(`${aisle}-${levelStr}-${lock2Str}`);
        }
        
        console.log(`[API DEBUG] Target location codes:`, targetLocationCodes);
        
        const { data: locations, error: locError } = await supabase
          .from('master_location')
          .select('location_id, location_code, aisle, shelf')
          .eq('location_type', 'rack')
          .eq('active_status', 'active')
          .in('location_code', targetLocationCodes)
          .order('shelf')
          .order('location_code');
        
        if (locError) {
          console.error('[API DEBUG] Location query error:', locError);
          return NextResponse.json({ error: locError.message }, { status: 500 });
        }
        
        console.log(`[API DEBUG] Found ${locations?.length || 0} locations`);
        
        // If no locations found, return empty slot data (not an error)
        if (!locations || locations.length === 0) {
          const emptyLevels: SlotInventory['levels'] = [];
          for (let level = 1; level <= 5; level++) {
            emptyLevels.push({ level, positions: [] });
          }
          return NextResponse.json({ 
            data: {
              slot_index: slotNum,
              aisle,
              levels: emptyLevels,
            }
          });
        }
        
        // Get inventory for these locations
        const locationIds = locations?.map(l => l.location_id) || [];
        console.log(`[API DEBUG] Location IDs:`, locationIds);
        
        let inventory: Array<{
          location_id: string;
          sku_id: string;
          pallet_id: string | null;
          total_pack_qty: number;
          total_piece_qty: number | null;
          production_date: string | null;
          expiry_date: string | null;
          reserved_pack_qty: number | null;
          master_sku: { sku_name: string } | { sku_name: string }[] | null;
        }> = [];
        
        if (locationIds.length > 0) {
          console.log(`[API DEBUG] Fetching inventory for ${locationIds.length} locations`);
          const { data: invData, error: invError } = await supabase
            .from('wms_inventory_balances')
            .select(`
              location_id,
              sku_id,
              pallet_id,
              total_pack_qty,
              total_piece_qty,
              production_date,
              expiry_date,
              reserved_pack_qty,
              master_sku(sku_name)
            `)
            .in('location_id', locationIds)
            .gt('total_pack_qty', 0);
          
          if (invError) {
            console.error('[API DEBUG] Inventory query error:', invError);
            return NextResponse.json({ error: invError.message }, { status: 500 });
          }
          inventory = invData || [];
          console.log(`[API DEBUG] Found ${inventory.length} inventory records`);
        }
        
        // Map inventory by location_id
        const inventoryMap = new Map<string, typeof inventory[0]>();
        inventory.forEach(inv => {
          inventoryMap.set(inv.location_id, inv);
        });
        
        console.log(`[API DEBUG] Building levels response, locations shelf values:`, locations?.map(l => l.shelf));
        
        // Build response grouped by level
        const levels: SlotInventory['levels'] = [];
        for (let level = 1; level <= 5; level++) {
          // shelf might be stored as "1" or "01" - check both
          const levelStr = level.toString();
          const levelStrPadded = level.toString().padStart(2, '0');
          const levelLocations = locations?.filter(l => 
            l.shelf === levelStr || l.shelf === levelStrPadded
          ) || [];
          
          console.log(`[API DEBUG] Level ${level}: found ${levelLocations.length} locations`);
          
          const positions: LocationInventory[] = levelLocations.map(loc => {
            const inv = inventoryMap.get(loc.location_id);
            const lockNum = parseInt(loc.location_code.split('-')[2]);
            
            // Handle master_sku which can be object or array
            let skuName: string | undefined;
            if (inv?.master_sku) {
              if (Array.isArray(inv.master_sku)) {
                skuName = inv.master_sku[0]?.sku_name;
              } else {
                skuName = (inv.master_sku as { sku_name: string }).sku_name;
              }
            }
            
            return {
              location_id: loc.location_id,
              location_code: loc.location_code,
              aisle: loc.aisle,
              shelf: loc.shelf,
              lock_number: lockNum,
              has_inventory: !!inv,
              sku_id: inv?.sku_id,
              sku_name: skuName,
              pallet_id: inv?.pallet_id ?? undefined,
              total_pack_qty: inv?.total_pack_qty ? parseFloat(inv.total_pack_qty.toString()) : undefined,
              total_piece_qty: inv?.total_piece_qty ? parseFloat(inv.total_piece_qty.toString()) : undefined,
              expiry_date: inv?.expiry_date ?? undefined,
              mfg_date: inv?.production_date ?? undefined,
              received_date: undefined,
              reserved_pack_qty: inv?.reserved_pack_qty ? parseFloat(inv.reserved_pack_qty.toString()) : undefined,
            };
          });
          
          levels.push({ level, positions });
        }
        
        const slotData: SlotInventory = {
          slot_index: slotNum,
          aisle,
          levels,
        };
        
        console.log(`[API DEBUG] Returning slot data with ${levels.length} levels`);
        return NextResponse.json({ data: slotData });
      } catch (slotError) {
        console.error('[API DEBUG] Error in slot details:', slotError);
        return NextResponse.json(
          { error: slotError instanceof Error ? slotError.message : 'Error fetching slot details' },
          { status: 500 }
        );
      }
    }
    
    // Get summary for all rack locations (for grid display)
    // Use pagination to get all locations (Supabase has 1000 row limit per request)
    let allLocations: Array<{location_id: string; location_code: string; aisle: string; shelf: string; location_type: string}> = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error: pageError } = await supabase
        .from('master_location')
        .select('location_id, location_code, aisle, shelf, location_type')
        .in('location_type', ['rack', 'floor'])
        .eq('active_status', 'active')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (pageError) {
        return NextResponse.json({ error: pageError.message }, { status: 500 });
      }
      
      if (!pageData || pageData.length === 0) break;
      
      allLocations = allLocations.concat(pageData);
      
      if (pageData.length < pageSize) break;
      page++;
    }
    
    console.log('[API DEBUG] allLocations count:', allLocations.length);
    
    // Get all inventory with pagination (count pallets per location for block storage)
    let allInventory: Array<{location_id: string; pallet_id: string | null}> = [];
    page = 0;
    
    while (true) {
      const { data: invPageData, error: invPageError } = await supabase
        .from('wms_inventory_balances')
        .select('location_id, pallet_id')
        .gt('total_pack_qty', 0)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (invPageError) {
        return NextResponse.json({ error: invPageError.message }, { status: 500 });
      }
      
      if (!invPageData || invPageData.length === 0) break;
      
      allInventory = allInventory.concat(invPageData);
      
      if (invPageData.length < pageSize) break;
      page++;
    }
    
    console.log('[API DEBUG] allInventory count:', allInventory.length);
    
    // Create a map of location_id -> pallet count
    const palletCountMap = new Map<string, number>();
    allInventory.forEach(inv => {
      const count = palletCountMap.get(inv.location_id) || 0;
      palletCountMap.set(inv.location_id, count + 1);
    });
    
    const occupiedSet = new Set(allInventory.map(i => i.location_id));
    
    // Group by aisle and slot
    const aisleSlotMap = new Map<string, { total: number; occupied: number; isBlock?: boolean }>();
    
    allLocations?.forEach(loc => {
      // Handle floor/block storage (AA-BLK, AB-BLK)
      if (loc.location_type === 'floor' && loc.shelf === 'BLK') {
        // Extract slot number from location_code (e.g., AA-BLK-01 -> 1)
        const parts = loc.location_code.split('-');
        const slotNum = parseInt(parts[2]);
        
        // For AA-BLK, split into two zones: AA-BLK (1-16) and AA-BLK-R (17-31)
        let zoneName: string;
        let adjustedSlot: number;
        
        if (loc.aisle === 'AA' && slotNum >= 17) {
          // Right section: AA-BLK-R with slots 1-15 (maps to AA-BLK-17 to AA-BLK-31)
          zoneName = 'AA-BLK-R';
          adjustedSlot = slotNum - 16; // 17->1, 18->2, ..., 31->15
        } else {
          // Left section or AB-BLK: use original zone name
          zoneName = `${loc.aisle}-BLK`;
          adjustedSlot = slotNum;
        }
        
        const key = `${zoneName}-${adjustedSlot}`;
        
        // For block storage, each location is 1 slot, and we count pallets
        const palletCount = palletCountMap.get(loc.location_id) || 0;
        
        if (!aisleSlotMap.has(key)) {
          aisleSlotMap.set(key, { total: 1, occupied: palletCount, isBlock: true });
        }
      } else if (loc.location_type === 'rack') {
        // Handle rack storage (existing logic)
        const lockNum = parseInt(loc.location_code.split('-')[2]);
        const slotNum = Math.ceil(lockNum / 2);
        const key = `${loc.aisle}-${slotNum}`;
        
        if (!aisleSlotMap.has(key)) {
          aisleSlotMap.set(key, { total: 0, occupied: 0 });
        }
        
        const slot = aisleSlotMap.get(key)!;
        slot.total++;
        if (occupiedSet.has(loc.location_id)) {
          slot.occupied++;
        }
      }
    });
    
    // Convert to array
    const summaryData = Array.from(aisleSlotMap.entries()).map(([key, value]) => {
      // Handle block storage keys (e.g., AA-BLK-1 or AA-BLK-R-1)
      if (value.isBlock) {
        const parts = key.split('-');
        let zone: string;
        let slot: number;
        
        if (parts.length === 4 && parts[2] === 'R') {
          // AA-BLK-R-1 format (right section)
          zone = `${parts[0]}-${parts[1]}-${parts[2]}`; // AA-BLK-R
          slot = parseInt(parts[3]);
        } else {
          // AA-BLK-1 or AB-BLK-1 format
          zone = `${parts[0]}-${parts[1]}`; // AA-BLK or AB-BLK
          slot = parseInt(parts[2]);
        }
        
        return {
          aisle: zone,
          slot,
          total_positions: value.total,
          occupied_positions: value.occupied,
          occupancy_rate: value.occupied > 0 ? 1 : 0, // For block: 0 or 1
          isBlock: true,
        };
      }
      
      // Handle rack storage keys (e.g., A01-1)
      const [aisle, slot] = key.split('-');
      return {
        aisle,
        slot: parseInt(slot),
        total_positions: value.total,
        occupied_positions: value.occupied,
        occupancy_rate: value.total > 0 ? value.occupied / value.total : 0,
      };
    });
    
    console.log('[API DEBUG] summaryData length:', summaryData.length, 'A01-1:', summaryData.find(s => s.aisle === 'A01' && s.slot === 1), 'AA-BLK-1:', summaryData.find(s => s.aisle === 'AA-BLK' && s.slot === 1));
    
    return NextResponse.json({ 
      data: summaryData,
      _debug: {
        locationsCount: allLocations?.length,
        inventoryCount: allInventory?.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching layout inventory:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
