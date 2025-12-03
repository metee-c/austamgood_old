import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch loadlists (all statuses)
    const { data: loadlists, error } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        created_at,
        updated_at,
        vehicle_id,
        driver_employee_id,
        loadlist_picklists (
          picklist_id,
          picklists:picklist_id (
            id,
            picklist_code,
            status,
            total_lines,
            trip:trip_id (
              trip_code,
              vehicle:vehicle_id (
                plate_number
              )
            )
          )
        ),
        loadlist_face_sheets (
          face_sheet_id,
          face_sheets:face_sheet_id (
            id,
            face_sheet_no,
            status,
            face_sheet_items (
              id
            )
          )
        ),
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id,
          bonus_face_sheets:bonus_face_sheet_id (
            id,
            face_sheet_no,
            status,
            bonus_face_sheet_items (
              id
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch loading tasks', details: error.message },
        { status: 500 }
      );
    }

    // Get unique vehicle IDs and driver IDs
    const vehicleIds = [...new Set(loadlists?.map((l: any) => l.vehicle_id).filter(Boolean))];
    const driverIds = [...new Set(loadlists?.map((l: any) => l.driver_employee_id).filter(Boolean))];

    // Fetch vehicles
    let vehicleMap: Record<string, any> = {};
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from('master_vehicle')
        .select('vehicle_id, plate_number, vehicle_type')
        .in('vehicle_id', vehicleIds);

      vehicles?.forEach((v: any) => {
        vehicleMap[v.vehicle_id] = v;
      });
    }

    // Fetch drivers
    let driverMap: Record<number, any> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('master_employee')
        .select('employee_id, first_name, last_name')
        .in('employee_id', driverIds);

      drivers?.forEach((d: any) => {
        driverMap[d.employee_id] = d;
      });
    }

    // Transform data with summary calculations
    const transformedData = await Promise.all(loadlists?.map(async (loadlist: any) => {
      const picklists = loadlist.loadlist_picklists || [];
      const faceSheets = loadlist.loadlist_face_sheets || [];
      const bonusFaceSheets = loadlist.wms_loadlist_bonus_face_sheets || [];
      
      // Get picklist IDs, face sheet IDs, and bonus face sheet IDs
      const picklistIds = picklists.map((p: any) => p.picklist_id).filter(Boolean);
      const faceSheetIds = faceSheets.map((fs: any) => fs.face_sheet_id).filter(Boolean);
      const bonusFaceSheetIds = bonusFaceSheets.map((bfs: any) => bfs.bonus_face_sheet_id).filter(Boolean);
      
      let totalItems = 0;
      let totalPieces = 0;
      let totalPacks = 0;
      let totalWeight = 0;
      
      // Calculate from picklists
      if (picklistIds.length > 0) {
        const { data: picklistItems } = await supabase
          .from('picklist_items')
          .select(`
            quantity_picked,
            sku_id,
            master_sku!inner (
              qty_per_pack,
              weight_per_piece_kg
            )
          `)
          .in('picklist_id', picklistIds);
        
        picklistItems?.forEach((item: any) => {
          const qty = parseFloat(item.quantity_picked) || 0;
          const qtyPerPack = item.master_sku?.qty_per_pack || 1;
          const weightPerPiece = item.master_sku?.weight_per_piece_kg || 0;
          
          totalItems += 1;
          totalPieces += qty;
          totalPacks += Math.ceil(qty / qtyPerPack);
          totalWeight += qty * weightPerPiece;
        });
      }
      
      // Calculate from face sheets
      if (faceSheetIds.length > 0) {
        const { data: faceSheetItems } = await supabase
          .from('face_sheet_items')
          .select(`
            quantity_picked,
            sku_id,
            master_sku!inner (
              qty_per_pack,
              weight_per_piece_kg
            )
          `)
          .in('face_sheet_id', faceSheetIds);
        
        faceSheetItems?.forEach((item: any) => {
          const qty = parseFloat(item.quantity_picked) || 0;
          const qtyPerPack = item.master_sku?.qty_per_pack || 1;
          const weightPerPiece = item.master_sku?.weight_per_piece_kg || 0;
          
          totalItems += 1;
          totalPieces += qty;
          totalPacks += Math.ceil(qty / qtyPerPack);
          totalWeight += qty * weightPerPiece;
        });
      }
      
      // Calculate from bonus face sheets
      if (bonusFaceSheetIds.length > 0) {
        // Fetch bonus face sheet items
        const { data: bonusFaceSheetItems } = await supabase
          .from('bonus_face_sheet_items')
          .select('quantity_picked, sku_id')
          .in('face_sheet_id', bonusFaceSheetIds);
        
        if (bonusFaceSheetItems && bonusFaceSheetItems.length > 0) {
          // Get unique SKU IDs
          const skuIds = [...new Set(bonusFaceSheetItems.map((item: any) => item.sku_id))];
          
          // Fetch SKU data
          const { data: skuData } = await supabase
            .from('master_sku')
            .select('sku_id, qty_per_pack, weight_per_piece_kg')
            .in('sku_id', skuIds);
          
          // Create SKU map
          const skuMap: Record<string, any> = {};
          skuData?.forEach((sku: any) => {
            skuMap[sku.sku_id] = sku;
          });
          
          // Calculate totals
          bonusFaceSheetItems.forEach((item: any) => {
            const qty = parseFloat(item.quantity_picked) || 0;
            const sku = skuMap[item.sku_id];
            const qtyPerPack = sku?.qty_per_pack || 1;
            const weightPerPiece = parseFloat(sku?.weight_per_piece_kg) || 0;
            
            totalItems += 1;
            totalPieces += qty;
            totalPacks += Math.ceil(qty / qtyPerPack);
            totalWeight += qty * weightPerPiece;
          });
        }
      }

      return {
        loadlist_id: loadlist.id,
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_items: totalItems,
        total_pieces: totalPieces,
        total_packs: totalPacks,
        total_weight: Math.round(totalWeight * 100) / 100, // Round to 2 decimals
        created_at: loadlist.created_at,
        updated_at: loadlist.updated_at,
        vehicle: loadlist.vehicle_id ? vehicleMap[loadlist.vehicle_id] : null,
        driver: loadlist.driver_employee_id ? driverMap[loadlist.driver_employee_id] : null
      };
    }) || []);

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
