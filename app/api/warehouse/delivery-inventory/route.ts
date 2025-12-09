import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Query inventory at Delivery-In-Progress location with related document context
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_location!location_id (
          location_name
        ),
        master_warehouse!warehouse_id (
          warehouse_name
        ),
        master_sku!sku_id (
          sku_name,
          weight_per_piece_kg
        )
      `)
      .eq('location_id', 'WH001-DELIVERY-IN-PROGRESS')
      .order('updated_at', { ascending: false });

    if (inventoryError) {
      console.error('Error fetching delivery inventory:', inventoryError);
      return NextResponse.json(
        { error: inventoryError.message },
        { status: 500 }
      );
    }

    console.log(`[DELIVERY-INVENTORY] Found ${inventoryData?.length || 0} items at DELIVERY-IN-PROGRESS location`);

    // For each inventory item, find related documents (picklists, face sheets, bonus face sheets)
    const enrichedData = await Promise.all(
      (inventoryData || []).map(async (item) => {
        console.log(`[DELIVERY-INVENTORY] Processing item: SKU=${item.sku_id}, Balance=${item.balance_id}`);
        
        let relatedDocuments: any[] = [];

        // 1. Find regular picklist items
        const { data: picklistItems, error: picklistError } = await supabase
          .from('picklist_items')
          .select(`
            picklist_id,
            order_id,
            sku_id,
            picklist:picklists!inner (
              picklist_code,
              status,
              trip_id,
              route_plan_trip:receiving_route_trips!trip_id (
                trip_code,
                plan_id,
                route_plan:receiving_route_plans (
                  plan_code,
                  plan_date
                )
              ),
              loadlist_picklists!inner (
                loadlist_id,
                loadlist:loadlists (
                  loadlist_code,
                  delivery_number,
                  status
                )
              )
            ),
            order:wms_orders (
              order_no,
              shop_name,
              province,
              phone
            )
          `)
          .eq('sku_id', item.sku_id)
          .in('picklist.status', ['pending', 'picking', 'completed']);

        if (picklistError) {
          console.error(`[DELIVERY-INVENTORY] Error fetching picklist items:`, picklistError);
        } else if (picklistItems && picklistItems.length > 0) {
          const picklistDocs = picklistItems.map((pi: any) => ({
            document_type: 'picklist',
            plan_code: pi.picklist?.route_plan_trip?.route_plan?.plan_code || null,
            trip_code: pi.picklist?.route_plan_trip?.trip_code || null,
            picklist_code: pi.picklist?.picklist_code || null,
            loadlist_code: pi.picklist?.loadlist_picklists?.[0]?.loadlist?.loadlist_code || null,
            delivery_number: pi.picklist?.loadlist_picklists?.[0]?.loadlist?.delivery_number || null,
            order_no: pi.order?.order_no || null,
            shop_name: pi.order?.shop_name || null,
            province: pi.order?.province || null,
            phone: pi.order?.phone || null
          }));
          relatedDocuments.push(...picklistDocs);
          console.log(`[DELIVERY-INVENTORY] Found ${picklistDocs.length} picklist items for SKU ${item.sku_id}`);
        }

        // 2. Find face sheet items (no plan/trip info)
        const { data: faceSheetItems, error: faceSheetError } = await supabase
          .from('face_sheet_items')
          .select(`
            face_sheet_id,
            order_id,
            sku_id,
            face_sheet:face_sheets!inner (
              face_sheet_no,
              status,
              loadlist_face_sheets!inner (
                loadlist_id,
                loadlist:loadlists (
                  loadlist_code,
                  delivery_number,
                  status
                )
              )
            ),
            order:wms_orders (
              order_no,
              shop_name,
              province,
              phone
            )
          `)
          .eq('sku_id', item.sku_id)
          .in('face_sheet.status', ['pending', 'picking', 'completed']);

        if (faceSheetError) {
          console.error(`[DELIVERY-INVENTORY] Error fetching face sheet items:`, faceSheetError);
        } else if (faceSheetItems && faceSheetItems.length > 0) {
          const faceSheetDocs = faceSheetItems.map((fs: any) => {
            const loadlist = fs.face_sheet?.loadlist_face_sheets?.[0]?.loadlist;
            return {
              document_type: 'face_sheet',
              face_sheet_code: fs.face_sheet?.face_sheet_no || null,
              loadlist_code: loadlist?.loadlist_code || null,
              delivery_number: loadlist?.delivery_number || null,
              order_no: fs.order?.order_no || null,
              shop_name: fs.order?.shop_name || null,
              province: fs.order?.province || null,
              phone: fs.order?.phone || null
            };
          });
          relatedDocuments.push(...faceSheetDocs);
          console.log(`[DELIVERY-INVENTORY] Found ${faceSheetDocs.length} face sheet items for SKU ${item.sku_id}`);
        }

        // 3. Find bonus face sheet items (no plan/trip info)
        const { data: bonusFaceSheetItems, error: bonusFaceSheetError } = await supabase
          .from('bonus_face_sheet_items')
          .select(`
            face_sheet_id,
            package_id,
            sku_id,
            bonus_face_sheet:bonus_face_sheets!face_sheet_id (
              face_sheet_no,
              status,
              wms_loadlist_bonus_face_sheets (
                loadlist_id,
                loadlist:loadlists (
                  loadlist_code,
                  delivery_number,
                  status
                )
              )
            ),
            package:bonus_face_sheet_packages!package_id (
              order_no,
              shop_name,
              province,
              phone
            )
          `)
          .eq('sku_id', item.sku_id)
          .in('bonus_face_sheet.status', ['pending', 'picking', 'completed']);

        if (bonusFaceSheetError) {
          console.error(`[DELIVERY-INVENTORY] Error fetching bonus face sheet items:`, bonusFaceSheetError);
        } else if (bonusFaceSheetItems && bonusFaceSheetItems.length > 0) {
          const bonusFaceSheetDocs = bonusFaceSheetItems.map((bfs: any) => {
            const loadlist = bfs.bonus_face_sheet?.wms_loadlist_bonus_face_sheets?.[0]?.loadlist;
            return {
              document_type: 'bonus_face_sheet',
              bonus_face_sheet_code: bfs.bonus_face_sheet?.face_sheet_no || null,
              loadlist_code: loadlist?.loadlist_code || null,
              delivery_number: loadlist?.delivery_number || null,
              order_no: bfs.package?.order_no || null,
              shop_name: bfs.package?.shop_name || null,
              province: bfs.package?.province || null,
              phone: bfs.package?.phone || null
            };
          });
          relatedDocuments.push(...bonusFaceSheetDocs);
          console.log(`[DELIVERY-INVENTORY] Found ${bonusFaceSheetDocs.length} bonus face sheet items for SKU ${item.sku_id}`);
        }

        console.log(`[DELIVERY-INVENTORY] Total related_documents for SKU ${item.sku_id}: ${relatedDocuments.length}`);

        return {
          ...item,
          related_documents: relatedDocuments
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedData
    });
  } catch (error: any) {
    console.error('Error in delivery inventory API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
