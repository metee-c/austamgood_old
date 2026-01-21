import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว - ดึงข้อมูลทั้งหมด
    const { data: inventoryData, error } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_location!location_id (location_name),
        master_warehouse!warehouse_id (warehouse_name),
        master_sku!sku_id (sku_name, weight_per_piece_kg)
      `)
      .eq('location_id', 'Delivery-In-Progress')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    console.log(`[DELIVERY-INVENTORY] Found ${inventoryData?.length || 0} items at DELIVERY-IN-PROGRESS location`);

    // For each inventory item, find related documents (picklists, face sheets, bonus face sheets)
    const enrichedData = await Promise.all(
      (inventoryData || []).map(async (item) => {
        console.log(`[DELIVERY-INVENTORY] Processing item: SKU=${item.sku_id}, Balance=${item.balance_id}`);
        
        let relatedDocuments: any[] = [];

        // 1. Find regular picklist items
        console.log(`[DELIVERY-INVENTORY] 🔍 Querying picklist_items for SKU: ${item.sku_id}`);
        
        // First, get picklist items with status='picked' (exclude voided)
        const { data: picklistItems, error: picklistError } = await supabase
          .from('picklist_items')
          .select(`
            picklist_id,
            order_id,
            sku_id,
            status,
            quantity_to_pick,
            quantity_picked,
            voided_at
          `)
          .eq('sku_id', item.sku_id)
          .eq('status', 'picked')
          .is('voided_at', null); // ✅ กรอง voided items ออก

        console.log(`[DELIVERY-INVENTORY] 📋 Found ${picklistItems?.length || 0} picked picklist items for SKU ${item.sku_id}`);
        
        if (picklistError) {
          console.error(`[DELIVERY-INVENTORY] ❌ Error fetching picklist items:`, picklistError);
        }

        if (picklistItems && picklistItems.length > 0) {
          // Get unique picklist IDs
          const picklistIds = [...new Set(picklistItems.map(pi => pi.picklist_id))];
          console.log(`[DELIVERY-INVENTORY] 🔑 Unique picklist IDs: ${picklistIds.join(', ')}`);

          // Now fetch picklist details with loadlist info
          const { data: picklists, error: picklistsError } = await supabase
            .from('picklists')
            .select(`
              id,
              picklist_code,
              status,
              trip_id,
              route_plan_trip:receiving_route_trips (
                trip_code,
                plan_id,
                route_plan:receiving_route_plans (
                  plan_code,
                  plan_date
                )
              ),
              wms_loadlist_picklists (
                loadlist_id,
                loadlists (
                  loadlist_code,
                  delivery_number,
                  status
                )
              )
            `)
            .in('id', picklistIds);

          if (picklistsError) {
            console.error(`[DELIVERY-INVENTORY] ❌ Error fetching picklists:`, picklistsError);
          } else {
            console.log(`[DELIVERY-INVENTORY] 📦 Found ${picklists?.length || 0} picklists`);
            if (picklists && picklists.length > 0) {
              console.log(`[DELIVERY-INVENTORY] 📦 Sample picklist:`, JSON.stringify(picklists[0], null, 2));
            }
          }

          // กรองเฉพาะ picklists ที่มี loadlist status='loaded' หรือ 'voided' (เพื่อแสดงข้อมูลที่ยังค้างอยู่)
          // ถ้ายังไม่มี loadlist หรือ loadlist ยัง pending = ยังอยู่ที่ Dispatch ไม่ใช่ที่ Delivery-In-Progress
          const loadedPicklists = picklists?.filter(pl => {
            const hasLoadedOrVoidedLoadlist = pl.wms_loadlist_picklists?.some((lp: any) => 
              lp.loadlists?.status === 'loaded' || lp.loadlists?.status === 'voided'
            );
            console.log(`[DELIVERY-INVENTORY] Picklist ${pl.picklist_code}: hasLoadedOrVoidedLoadlist=${hasLoadedOrVoidedLoadlist}`);
            return hasLoadedOrVoidedLoadlist;
          }) || [];

          console.log(`[DELIVERY-INVENTORY] ✅ Found ${loadedPicklists.length} picklists with loaded/voided loadlist`);

          if (loadedPicklists.length > 0) {
            // Get order details for these picklist items
            const orderIds = [...new Set(picklistItems
              .filter(pi => loadedPicklists.some(pl => pl.id === pi.picklist_id))
              .map(pi => pi.order_id)
              .filter(Boolean)
            )];

            console.log(`[DELIVERY-INVENTORY] 🛒 Fetching ${orderIds.length} orders`);

            const { data: orders, error: ordersError } = await supabase
              .from('wms_orders')
              .select('order_id, order_no, shop_name, province, phone')
              .in('order_id', orderIds);

            if (ordersError) {
              console.error(`[DELIVERY-INVENTORY] ❌ Error fetching orders:`, ordersError);
            } else {
              console.log(`[DELIVERY-INVENTORY] 🛒 Found ${orders?.length || 0} orders`);
            }

            // ✅ FIX: Build documents for EACH picklist item (not just per picklist)
            // This ensures each order gets its own row even if same SKU
            const picklistDocs: any[] = [];
            
            for (const pl of loadedPicklists) {
              const loadlistPicklist = pl.wms_loadlist_picklists?.find((lp: any) => 
                lp.loadlists?.status === 'loaded' || lp.loadlists?.status === 'voided'
              );
              
              // ✅ Get ALL picklist items for this picklist (not just first one)
              const itemsForThisPicklist = picklistItems.filter(pi => pi.picklist_id === pl.id);
              
              for (const picklistItem of itemsForThisPicklist) {
                const order = orders?.find(o => o.order_id === picklistItem?.order_id);

                const doc = {
                  document_type: 'picklist',
                  plan_code: (pl.route_plan_trip as any)?.route_plan?.plan_code || null,
                  trip_code: (pl.route_plan_trip as any)?.trip_code || null,
                  picklist_code: pl.picklist_code || null,
                  loadlist_code: (loadlistPicklist?.loadlists as any)?.loadlist_code || null,
                  delivery_number: (loadlistPicklist?.loadlists as any)?.delivery_number || null,
                  order_id: picklistItem?.order_id || null,
                  order_no: order?.order_no || null,
                  shop_name: order?.shop_name || null,
                  province: order?.province || null,
                  phone: order?.phone || null,
                  // ✅ Add quantity for this specific order
                  quantity_picked: parseFloat(picklistItem?.quantity_picked) || 0,
                  quantity_to_pick: parseFloat(picklistItem?.quantity_to_pick) || 0,
                  // Add status info for debugging
                  picklist_status: pl.status,
                  has_loadlist: pl.wms_loadlist_picklists && pl.wms_loadlist_picklists.length > 0
                };

                console.log(`[DELIVERY-INVENTORY] 📄 Built picklist doc:`, JSON.stringify(doc, null, 2));
                picklistDocs.push(doc);
              }
            }

            relatedDocuments.push(...picklistDocs);
            console.log(`[DELIVERY-INVENTORY] ✅ Added ${picklistDocs.length} picklist documents for SKU ${item.sku_id}`);
          }
        }

        // 2. Find face sheet items (no plan/trip info)
        console.log(`[DELIVERY-INVENTORY] 🔍 Querying face_sheet_items for SKU: ${item.sku_id}`);
        
        const { data: faceSheetItems, error: faceSheetError } = await supabase
          .from('face_sheet_items')
          .select(`
            face_sheet_id,
            order_id,
            sku_id,
            status,
            quantity,
            quantity_picked,
            voided_at
          `)
          .eq('sku_id', item.sku_id)
          .eq('status', 'picked')
          .is('voided_at', null); // ✅ กรอง voided items ออก

        console.log(`[DELIVERY-INVENTORY] 📋 Found ${faceSheetItems?.length || 0} picked face sheet items for SKU ${item.sku_id}`);

        if (faceSheetError) {
          console.error(`[DELIVERY-INVENTORY] ❌ Error fetching face sheet items:`, faceSheetError);
        }

        if (faceSheetItems && faceSheetItems.length > 0) {
          const faceSheetIds = [...new Set(faceSheetItems.map(fs => fs.face_sheet_id))];
          console.log(`[DELIVERY-INVENTORY] 🔑 Unique face sheet IDs: ${faceSheetIds.join(', ')}`);

          // Fetch face sheet details with loadlist info
          const { data: faceSheets, error: faceSheetsError } = await supabase
            .from('face_sheets')
            .select(`
              id,
              face_sheet_no,
              status,
              loadlist_face_sheets (
                loadlist_id,
                loadlist:loadlists (
                  loadlist_code,
                  delivery_number,
                  status
                )
              )
            `)
            .in('id', faceSheetIds);

          if (faceSheetsError) {
            console.error(`[DELIVERY-INVENTORY] ❌ Error fetching face sheets:`, faceSheetsError);
          } else {
            console.log(`[DELIVERY-INVENTORY] 📦 Found ${faceSheets?.length || 0} face sheets`);
          }

          // กรองเฉพาะ face sheets ที่มี loadlist status='loaded' หรือ 'voided' (เพื่อแสดงข้อมูลที่ยังค้างอยู่)
          // ถ้ายังไม่มี loadlist หรือ loadlist ยัง pending = ยังอยู่ที่ Dispatch ไม่ใช่ที่ Delivery-In-Progress
          const loadedFaceSheets = faceSheets?.filter(fs => {
            const hasLoadedOrVoidedLoadlist = fs.loadlist_face_sheets?.some((lfs: any) => 
              lfs.loadlist?.status === 'loaded' || lfs.loadlist?.status === 'voided'
            );
            console.log(`[DELIVERY-INVENTORY] Face Sheet ${fs.face_sheet_no}: hasLoadedOrVoidedLoadlist=${hasLoadedOrVoidedLoadlist}`);
            return hasLoadedOrVoidedLoadlist;
          }) || [];

          console.log(`[DELIVERY-INVENTORY] ✅ Found ${loadedFaceSheets.length} face sheets with loaded/voided loadlist`);

          if (loadedFaceSheets.length > 0) {
            const orderIds = [...new Set(faceSheetItems
              .filter(fsi => loadedFaceSheets.some(fs => fs.id === fsi.face_sheet_id))
              .map(fsi => fsi.order_id)
              .filter(Boolean)
            )];

            const { data: orders } = await supabase
              .from('wms_orders')
              .select('order_id, order_no, shop_name, province, phone')
              .in('order_id', orderIds);

            // ✅ FIX: Build documents for EACH face sheet item (not just per face sheet)
            // This ensures each order gets its own row even if same SKU
            const faceSheetDocs: any[] = [];
            
            for (const fs of loadedFaceSheets) {
              const loadlistFaceSheet = fs.loadlist_face_sheets?.find((lfs: any) => 
                lfs.loadlist?.status === 'loaded' || lfs.loadlist?.status === 'voided'
              );
              
              // ✅ Get ALL face sheet items for this face sheet (not just first one)
              const itemsForThisFaceSheet = faceSheetItems.filter(fsi => fsi.face_sheet_id === fs.id);
              
              for (const faceSheetItem of itemsForThisFaceSheet) {
                const order = orders?.find(o => o.order_id === faceSheetItem?.order_id);

                faceSheetDocs.push({
                  document_type: 'face_sheet',
                  face_sheet_code: fs.face_sheet_no || null,
                  loadlist_code: (loadlistFaceSheet?.loadlist as any)?.loadlist_code || null,
                  delivery_number: (loadlistFaceSheet?.loadlist as any)?.delivery_number || null,
                  order_id: faceSheetItem?.order_id || null,
                  order_no: order?.order_no || null,
                  shop_name: order?.shop_name || null,
                  province: order?.province || null,
                  phone: order?.phone || null,
                  // ✅ Add quantity for this specific order
                  quantity_picked: parseFloat(faceSheetItem?.quantity_picked) || parseFloat(faceSheetItem?.quantity) || 0,
                  quantity_to_pick: parseFloat(faceSheetItem?.quantity) || 0
                });
              }
            }

            relatedDocuments.push(...faceSheetDocs);
            console.log(`[DELIVERY-INVENTORY] ✅ Added ${faceSheetDocs.length} face sheet documents for SKU ${item.sku_id}`);
          }
        }

        // 3. Find bonus face sheet items (no plan/trip info) - exclude voided
        const { data: bonusFaceSheetItems, error: bonusFaceSheetError } = await supabase
          .from('bonus_face_sheet_items')
          .select(`
            face_sheet_id,
            package_id,
            sku_id,
            quantity,
            quantity_picked,
            voided_at,
            bonus_face_sheet:bonus_face_sheets!face_sheet_id!inner (
              face_sheet_no,
              status,
              wms_loadlist_bonus_face_sheets!inner (
                loadlist_id,
                loadlist:loadlists!inner (
                  loadlist_code,
                  delivery_number,
                  status
                )
              )
            )
          `)
          .eq('sku_id', item.sku_id)
          .eq('bonus_face_sheet.wms_loadlist_bonus_face_sheets.loadlist.status', 'loaded')
          .is('voided_at', null); // ✅ กรอง voided items ออก

        if (bonusFaceSheetError) {
          console.error(`[DELIVERY-INVENTORY] ❌ Error fetching bonus face sheet items:`, bonusFaceSheetError);
        } else {
          console.log(`[DELIVERY-INVENTORY] 📋 Found ${bonusFaceSheetItems?.length || 0} bonus face sheet items with loaded loadlist for SKU ${item.sku_id}`);
          if (bonusFaceSheetItems && bonusFaceSheetItems.length > 0) {
            // ✅ ดึงข้อมูล bonus_face_sheet_packages แยกต่างหาก
            const packageIds = bonusFaceSheetItems.map((bfs: any) => bfs.package_id).filter(Boolean);
            let bonusPackagesMap: Record<number, any> = {};
            
            if (packageIds.length > 0) {
              const { data: packagesData, error: packagesError } = await supabase
                .from('bonus_face_sheet_packages')
                .select(`
                  id,
                  order_no,
                  shop_name,
                  province,
                  phone
                `)
                .in('id', packageIds);
              
              if (packagesError) {
                console.error(`[DELIVERY-INVENTORY] ❌ Error fetching bonus packages:`, packagesError);
              } else {
                // สร้าง map สำหรับ lookup
                bonusPackagesMap = (packagesData || []).reduce((acc, pkg) => {
                  acc[pkg.id] = pkg;
                  return acc;
                }, {} as Record<number, any>);
                console.log(`[DELIVERY-INVENTORY] ✅ Loaded ${Object.keys(bonusPackagesMap).length} bonus packages`);
              }
            }
            
            const bonusFaceSheetDocs = bonusFaceSheetItems.map((bfs: any) => {
              const loadlist = bfs.bonus_face_sheet?.wms_loadlist_bonus_face_sheets?.[0]?.loadlist;
              // ✅ ใช้ bonusPackagesMap แทน nested select
              const pkg = bfs.package_id ? bonusPackagesMap[bfs.package_id] : null;
              
              return {
                document_type: 'bonus_face_sheet',
                bonus_face_sheet_code: bfs.bonus_face_sheet?.face_sheet_no || null,
                loadlist_code: loadlist?.loadlist_code || null,
                delivery_number: loadlist?.delivery_number || null,
                order_no: pkg?.order_no || null,
                shop_name: pkg?.shop_name || null,
                province: pkg?.province || null,
                phone: pkg?.phone || null,
                // ✅ Add quantity for this specific item
                quantity_picked: parseFloat(bfs.quantity_picked) || parseFloat(bfs.quantity) || 0,
                quantity_to_pick: parseFloat(bfs.quantity) || 0
              };
            });
            relatedDocuments.push(...bonusFaceSheetDocs);
            console.log(`[DELIVERY-INVENTORY] ✅ Added ${bonusFaceSheetDocs.length} bonus face sheet documents for SKU ${item.sku_id}`);
          }
        }

        console.log(`[DELIVERY-INVENTORY] Total related_documents for SKU ${item.sku_id}: ${relatedDocuments.length}`);

        return {
          ...item,
          related_documents: relatedDocuments
        };
      })
    );

    // ✅ กรองออก: items ที่ไม่มี related_documents และ total_piece_qty = 0
    // เพราะถ้าไม่มี related_documents แสดงว่าสินค้าถูก delivered ไปแล้ว
    const finalData = enrichedData.filter(item => {
      // ต้องมี related_documents อย่างน้อย 1 รายการ
      const hasRelatedDocs = item.related_documents && item.related_documents.length > 0;
      // หรือต้องมี total_piece_qty > 0 (มีสินค้าจริงๆ ที่ Delivery-In-Progress)
      const hasStock = Number(item.total_piece_qty) > 0;
      
      return hasRelatedDocs || hasStock;
    });

    console.log(`[DELIVERY-INVENTORY] After filtering (no docs & zero qty): ${finalData.length} items`);

    return NextResponse.json({
      success: true,
      data: finalData
    });
  } catch (error: any) {
    console.error('Error in delivery inventory API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
