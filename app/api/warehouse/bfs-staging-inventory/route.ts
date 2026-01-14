import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/warehouse/bfs-staging-inventory
 * ดึงข้อมูลสต็อก BFS ที่ PQTD/MRTD รอยืนยันโหลด
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const exportMode = searchParams.get('export') === 'true';

    // Get PQTD and MRTD location IDs
    const { data: locations } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .in('location_code', ['PQTD', 'MRTD']);

    console.log('🟡 [BFS API] Found locations:', locations);

    if (!locations || locations.length === 0) {
      console.log('⚠️ [BFS API] No PQTD/MRTD locations found');
      return NextResponse.json({ data: [] });
    }

    const locationIds = locations.map(l => l.location_id);
    console.log('🟡 [BFS API] Location IDs:', locationIds);

    // Fetch inventory at PQTD/MRTD
    const { data: inventory, error } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_location!location_id (
          location_name,
          location_code
        ),
        master_warehouse!warehouse_id (
          warehouse_name
        ),
        master_sku!sku_id (
          sku_name,
          weight_per_piece_kg
        )
      `)
      .in('location_id', locationIds)
      .gt('total_piece_qty', 0)
      .order('updated_at', { ascending: false })
      .limit(exportMode ? 10000 : 2000);

    if (error) {
      console.error('❌ [BFS API] Error fetching BFS staging inventory:', error);
      return NextResponse.json(
        { error: 'Failed to fetch BFS staging inventory', details: error.message },
        { status: 500 }
      );
    }

    console.log('🟡 [BFS API] Found inventory items:', inventory?.length || 0);

    // For each inventory item, find related bonus face sheets
    const enrichedData = await Promise.all(
      (inventory || []).map(async (item) => {
        // Find bonus face sheet items that match this SKU and location
        const { data: bfsItems, error: bfsError } = await supabase
          .from('bonus_face_sheet_items')
          .select(`
            id,
            face_sheet_id,
            sku_id,
            quantity_picked,
            quantity_to_pick,
            package_id,
            bonus_face_sheets!face_sheet_id (
              id,
              face_sheet_no,
              status,
              warehouse_id
            ),
            bonus_face_sheet_packages!package_id (
              id,
              package_number,
              barcode_id,
              hub,
              storage_location,
              order_id,
              order_no,
              shop_name,
              province,
              phone
            )
          `)
          .eq('sku_id', item.sku_id)
          .limit(100);

        if (bfsError) {
          console.error('❌ Error fetching BFS items for SKU:', item.sku_id, bfsError);
        }

        // Filter items that are at this staging location (PQTD/MRTD) and have correct status
        const relatedDocuments = (bfsItems || [])
          .filter((bfsItem: any) => {
            const bfs = bfsItem.bonus_face_sheets;
            const pkg = bfsItem.bonus_face_sheet_packages;
            
            if (!bfs || !pkg) {
              return false;
            }
            
            // Check BFS status
            if (!['picked', 'completed'].includes(bfs.status)) {
              return false;
            }
            
            // Check if package is at staging (storage_location is null or empty)
            const isAtStaging = !pkg.storage_location || pkg.storage_location.trim() === '';
            
            if (!isAtStaging) {
              return false;
            }
            
            return true;
          })
          .map((bfsItem: any) => {
            const bfs = bfsItem.bonus_face_sheets;
            const pkg = bfsItem.bonus_face_sheet_packages;

            return {
              document_type: 'bonus_face_sheet',
              bonus_face_sheet_code: bfs?.face_sheet_no,
              face_sheet_status: bfs?.status,
              package_id: pkg?.id,
              package_number: pkg?.package_number,
              barcode_id: pkg?.barcode_id,
              hub: pkg?.hub,
              order_id: pkg?.order_id,
              order_no: pkg?.order_no,
              shop_name: pkg?.shop_name,
              province: pkg?.province,
              phone: pkg?.phone,
              quantity_picked: bfsItem.quantity_picked || bfsItem.quantity_to_pick,
            };
          });

        return {
          ...item,
          related_documents: relatedDocuments,
        };
      })
    );

    console.log('🟡 [BFS API] Enriched data:', {
      total: enrichedData.length,
      withDocs: enrichedData.filter(i => i.related_documents && i.related_documents.length > 0).length
    });

    return NextResponse.json({ data: enrichedData });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
