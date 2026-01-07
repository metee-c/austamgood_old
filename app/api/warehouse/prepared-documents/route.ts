import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface PreparedDocumentItem {
  balance_id?: number;
  sku_id: string;
  sku_name: string;
  quantity: number;
  location_id: string;
  pallet_id?: string;
  pallet_id_external?: string;
  lot_no?: string;
  production_date?: string;
  expiry_date?: string;
  total_pack_qty?: number;
  total_piece_qty?: number;
  reserved_pack_qty?: number;
  reserved_piece_qty?: number;
  warehouse_id?: string;
  last_movement_at?: string;
  updated_at?: string;
  // Order info
  order_id?: number;
  order_no?: string;
  shop_name?: string;
}

interface PreparedDocument {
  document_type: 'picklist' | 'face_sheet' | 'bonus_face_sheet';
  document_id: number;
  document_no: string;
  status: string;
  total_items: number;
  total_quantity: number;
  created_at: string;
  // Route plan info
  plan_id?: number;
  plan_code?: string;
  trip_id?: number;
  trip_code?: string;
  loadlist_code?: string | null;
  items: PreparedDocumentItem[];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id') || 'WH001';

    const documents: PreparedDocument[] = [];

    // 1. ดึงข้อมูล Picklists ที่กำลังจัดหรือจัดเสร็จแล้ว แต่ยังไม่ได้เพิ่มเข้า loadlist
    const { data: picklists, error: picklistError } = await supabase
      .from('picklists')
      .select(`
        id,
        picklist_code,
        status,
        total_lines,
        total_quantity,
        created_at,
        plan_id,
        trip_id,
        picklist_items (
          id,
          sku_id,
          sku_name,
          quantity_to_pick,
          source_location_id,
          order_id,
          order_no,
          voided_at,
          status
        ),
        wms_loadlist_picklists (
          loadlist_id,
          loadlists (
            loadlist_code,
            status
          )
        )
      `)
      .in('status', ['assigned', 'picking', 'completed'])  // ✅ รวมที่กำลังจัดและจัดเสร็จ
      .neq('status', 'voided')  // ✅ ไม่รวม picklist ที่ถูก voided
      .order('created_at', { ascending: false });

    console.log('[prepared-documents] Picklists query result:', { 
      count: picklists?.length || 0, 
      error: picklistError 
    });

    if (!picklistError && picklists) {
      const dispatchLocationId = 'Dispatch';
      
      // Get all unique plan_ids and trip_ids to fetch plan_code and trip_code
      const planIds = [...new Set(picklists.map(pl => pl.plan_id).filter(Boolean))];
      const tripIds = [...new Set(picklists.map(pl => pl.trip_id).filter(Boolean))];
      
      // Fetch plan codes
      let planCodeMap: Record<number, string> = {};
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from('receiving_route_plans')
          .select('plan_id, plan_code')
          .in('plan_id', planIds);
        if (plans) {
          planCodeMap = Object.fromEntries(plans.map(p => [p.plan_id, p.plan_code]));
        }
      }
      
      // Fetch trip codes
      let tripCodeMap: Record<number, string> = {};
      if (tripIds.length > 0) {
        const { data: trips } = await supabase
          .from('receiving_route_trips')
          .select('trip_id, trip_code')
          .in('trip_id', tripIds);
        if (trips) {
          tripCodeMap = Object.fromEntries(trips.map(t => [t.trip_id, t.trip_code]));
        }
      }
      
      // Fetch order info for shop_name
      const orderIds = [...new Set(picklists.flatMap(pl => 
        (pl.picklist_items || []).map((item: any) => item.order_id).filter(Boolean)
      ))];
      let orderInfoMap: Record<number, { order_no: string; shop_name: string }> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('wms_orders')
          .select('order_id, order_no, shop_name')
          .in('order_id', orderIds);
        if (orders) {
          orderInfoMap = Object.fromEntries(orders.map(o => [o.order_id, { order_no: o.order_no, shop_name: o.shop_name }]));
        }
      }
      
      for (const pl of picklists) {
        // ✅ ตรวจสอบว่ายังไม่ได้เพิ่มเข้า loadlist หรืออยู่ใน loadlist ที่ยังไม่ loaded/voided
        const loadlistData = (pl as any).wms_loadlist_picklists?.[0];
        const loadlistCode = loadlistData?.loadlists?.loadlist_code;
        const loadlistStatus = loadlistData?.loadlists?.status;
        
        // ✅ ข้ามถ้าอยู่ใน loadlist ที่ loaded หรือ voided แล้ว
        if (loadlistCode && (loadlistStatus === 'loaded' || loadlistStatus === 'voided')) {
          console.log(`⏭️ Skip picklist ${pl.picklist_code} - in ${loadlistStatus} loadlist ${loadlistCode}`);
          continue;
        }
        
        // แสดงถ้า: ยังไม่ได้เข้า loadlist หรือ อยู่ใน loadlist ที่ยังไม่ loaded/voided
        if (loadlistCode && loadlistStatus !== 'loaded' && loadlistStatus !== 'voided') {
          console.log(`✅ Include picklist ${pl.picklist_code} - in ${loadlistStatus} loadlist ${loadlistCode}`);
        }
        
        const items = [];
        
        for (const item of (pl.picklist_items || [])) {
          // ✅ ข้าม items ที่ถูก voided
          if (item.voided_at || item.status === 'voided') {
            console.log(`⏭️ Skip voided picklist item ${item.id} for SKU ${item.sku_id}`);
            continue;
          }
          
          // ดึงข้อมูล balance จาก Dispatch location
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select(`
              balance_id,
              pallet_id,
              pallet_id_external,
              lot_no,
              production_date,
              expiry_date,
              total_pack_qty,
              total_piece_qty,
              reserved_pack_qty,
              reserved_piece_qty,
              warehouse_id,
              location_id,
              last_movement_at,
              updated_at
            `)
            .eq('location_id', dispatchLocationId)
            .eq('sku_id', item.sku_id)
            .limit(1)
            .single();

          // Get order info
          const orderInfo = item.order_id ? orderInfoMap[item.order_id] : null;

          items.push({
            balance_id: balances?.balance_id,
            sku_id: item.sku_id,
            sku_name: item.sku_name || item.sku_id,
            quantity: item.quantity_to_pick || 0,
            location_id: balances?.location_id || dispatchLocationId,
            pallet_id: balances?.pallet_id,
            pallet_id_external: balances?.pallet_id_external,
            lot_no: balances?.lot_no,
            production_date: balances?.production_date,
            expiry_date: balances?.expiry_date,
            total_pack_qty: balances?.total_pack_qty,
            total_piece_qty: balances?.total_piece_qty,
            reserved_pack_qty: balances?.reserved_pack_qty,
            reserved_piece_qty: balances?.reserved_piece_qty,
            warehouse_id: balances?.warehouse_id,
            last_movement_at: balances?.last_movement_at,
            updated_at: balances?.updated_at,
            order_id: item.order_id,
            order_no: item.order_no || orderInfo?.order_no,
            shop_name: orderInfo?.shop_name
          });
        }
        
        // ✅ ข้าม picklist ที่ไม่มี items ที่ยังใช้งานได้ (ทั้งหมดถูก voided)
        if (items.length === 0) {
          console.log(`⏭️ Skip picklist ${pl.picklist_code} - all items voided`);
          continue;
        }
        
        console.log(`✅ Include picklist ${pl.picklist_code} - ${items.length} active items`);
        
        documents.push({
          document_type: 'picklist',
          document_id: pl.id,
          document_no: pl.picklist_code,
          status: pl.status,
          total_items: pl.total_lines || 0,
          total_quantity: pl.total_quantity || 0,
          created_at: pl.created_at,
          plan_id: pl.plan_id,
          plan_code: pl.plan_id ? planCodeMap[pl.plan_id] : undefined,
          trip_id: pl.trip_id,
          trip_code: pl.trip_id ? tripCodeMap[pl.trip_id] : undefined,
          loadlist_code: loadlistCode || null,
          items
        } as any);
      }
    }

    // 2. ดึงข้อมูล Face Sheets ที่กำลังจัดหรือจัดเสร็จแล้ว แต่ยังไม่ได้เพิ่มเข้า loadlist
    const { data: faceSheets, error: faceSheetError } = await supabase
      .from('face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        total_items,
        total_packages,
        created_at,
        face_sheet_items (
          id,
          sku_id,
          product_name,
          quantity,
          quantity_picked,
          source_location_id,
          voided_at,
          status,
          package_id
        ),
        loadlist_face_sheets (
          loadlist_id,
          loadlists (
            loadlist_code,
            status
          )
        )
      `)
      .in('status', ['generated', 'picking', 'completed'])  // ✅ รวมที่กำลังจัดและจัดเสร็จ
      .neq('status', 'voided')  // ✅ ไม่รวม face sheet ที่ถูก voided
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    if (!faceSheetError && faceSheets) {
      const dispatchLocationId = 'Dispatch';
      
      // ดึง package_ids ทั้งหมดจาก face_sheet_items เพื่อ fetch order_no และ shop_name
      const allFsPackageIds = faceSheets.flatMap(fs => 
        (fs.face_sheet_items || []).map((item: any) => item.package_id).filter(Boolean)
      );
      
      // Fetch face_sheet_packages แยกต่างหาก
      let fsPackageMap: Record<number, { order_no: string; shop_name: string }> = {};
      if (allFsPackageIds.length > 0) {
        const uniqueFsPackageIds = [...new Set(allFsPackageIds)];
        const { data: fsPackages } = await supabase
          .from('face_sheet_packages')
          .select('id, order_no, shop_name')
          .in('id', uniqueFsPackageIds);
        if (fsPackages) {
          fsPackageMap = Object.fromEntries(
            fsPackages.map(p => [p.id, { order_no: p.order_no || '', shop_name: p.shop_name || '' }])
          );
        }
      }
      
      for (const fs of faceSheets) {
        // ✅ ตรวจสอบว่ายังไม่ได้เพิ่มเข้า loadlist หรืออยู่ใน loadlist ที่ยังไม่ loaded/voided
        const loadlistData = (fs as any).loadlist_face_sheets?.[0];
        const loadlistCode = loadlistData?.loadlists?.loadlist_code;
        const loadlistStatus = loadlistData?.loadlists?.status;
        
        // ✅ ข้ามถ้าอยู่ใน loadlist ที่ loaded หรือ voided แล้ว
        if (loadlistCode && (loadlistStatus === 'loaded' || loadlistStatus === 'voided')) {
          console.log(`⏭️ Skip face sheet ${fs.face_sheet_no} - in ${loadlistStatus} loadlist ${loadlistCode}`);
          continue;
        }
        
        // แสดงถ้า: ยังไม่ได้เข้า loadlist หรือ อยู่ใน loadlist ที่ยังไม่ loaded/voided
        if (loadlistCode && loadlistStatus !== 'loaded' && loadlistStatus !== 'voided') {
          console.log(`✅ Include face sheet ${fs.face_sheet_no} - in ${loadlistStatus} loadlist ${loadlistCode}`);
        }
        
        const totalQty = (fs.face_sheet_items || []).reduce((sum: number, item: any) => 
          sum + (parseFloat(item.quantity_picked) || parseFloat(item.quantity) || 0), 0
        );
        
        // ✅ ไม่ group by SKU แล้ว - แสดงแต่ละ item แยกกันเพื่อให้เห็น order_no และ shop_name ของแต่ละ package
        const items: PreparedDocumentItem[] = [];
        
        for (const item of (fs.face_sheet_items || [])) {
          // ✅ ข้าม items ที่ถูก voided
          if (item.voided_at || item.status === 'voided') {
            console.log(`⏭️ Skip voided face sheet item ${item.id} for SKU ${item.sku_id}`);
            continue;
          }
          
          const skuId = item.sku_id || '-';
          const qty = parseFloat(item.quantity_picked) || parseFloat(item.quantity) || 0;
          
          // ดึง order_no และ shop_name จาก package
          const packageInfo = item.package_id ? fsPackageMap[item.package_id] : null;
          
          // Fetch balance data for this SKU
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select(`
              balance_id,
              pallet_id,
              pallet_id_external,
              lot_no,
              production_date,
              expiry_date,
              total_pack_qty,
              total_piece_qty,
              reserved_pack_qty,
              reserved_piece_qty,
              warehouse_id,
              location_id,
              last_movement_at,
              updated_at
            `)
            .eq('location_id', dispatchLocationId)
            .eq('sku_id', skuId)
            .limit(1)
            .single();
          
          items.push({
            balance_id: balances?.balance_id,
            sku_id: skuId,
            sku_name: item.product_name || skuId,
            quantity: qty,
            location_id: balances?.location_id || dispatchLocationId,
            pallet_id: balances?.pallet_id,
            pallet_id_external: balances?.pallet_id_external,
            lot_no: balances?.lot_no,
            production_date: balances?.production_date,
            expiry_date: balances?.expiry_date,
            total_pack_qty: balances?.total_pack_qty,
            total_piece_qty: balances?.total_piece_qty,
            reserved_pack_qty: balances?.reserved_pack_qty,
            reserved_piece_qty: balances?.reserved_piece_qty,
            warehouse_id: balances?.warehouse_id,
            last_movement_at: balances?.last_movement_at,
            updated_at: balances?.updated_at,
            order_no: packageInfo?.order_no,
            shop_name: packageInfo?.shop_name
          });
        }
        
        // ✅ ข้าม face sheet ที่ไม่มี items ที่ยังใช้งานได้ (ทั้งหมดถูก voided)
        if (items.length === 0) {
          console.log(`⏭️ Skip face sheet ${fs.face_sheet_no} - all items voided`);
          continue;
        }
        
        console.log(`✅ Include face sheet ${fs.face_sheet_no} - ${items.length} active items, ${fs.total_packages} packages`);
        
        documents.push({
          document_type: 'face_sheet',
          document_id: fs.id,
          document_no: fs.face_sheet_no,
          status: fs.status,
          total_items: items.length,
          total_quantity: totalQty,
          created_at: fs.created_at,
          loadlist_code: loadlistCode || null,  // ✅ ส่ง loadlist_code ถ้ามี
          items
        } as any);
      }
    }

    // 3. ดึงข้อมูล Bonus Face Sheets ที่กำลังจัดหรือจัดเสร็จแล้ว แต่ยังไม่ได้เพิ่มเข้า loadlist
    const { data: bonusFaceSheets, error: bonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        total_items,
        total_packages,
        created_at,
        bonus_face_sheet_items (
          id,
          sku_id,
          product_name,
          quantity,
          quantity_picked,
          source_location_id,
          voided_at,
          status,
          package_id
        ),
        wms_loadlist_bonus_face_sheets (
          loadlist_id,
          loadlists (
            loadlist_code,
            status
          )
        )
      `)
      .in('status', ['generated', 'picking', 'completed'])  // ✅ รวมที่กำลังจัดและจัดเสร็จ
      .neq('status', 'voided')  // ✅ ไม่รวม bonus face sheet ที่ถูก voided
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    if (!bonusFaceSheetError && bonusFaceSheets) {
      const dispatchLocationId = 'Dispatch';
      
      // ดึง package_ids ทั้งหมดจาก bonus_face_sheet_items เพื่อ fetch order_no และ shop_name
      const allBfsPackageIds = bonusFaceSheets.flatMap(bfs => 
        (bfs.bonus_face_sheet_items || []).map((item: any) => item.package_id).filter(Boolean)
      );
      
      // Fetch bonus_face_sheet_packages แยกต่างหาก
      let bfsPackageMap: Record<number, { order_no: string; shop_name: string }> = {};
      if (allBfsPackageIds.length > 0) {
        const uniqueBfsPackageIds = [...new Set(allBfsPackageIds)];
        const { data: bfsPackages } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, order_no, shop_name')
          .in('id', uniqueBfsPackageIds);
        if (bfsPackages) {
          bfsPackageMap = Object.fromEntries(
            bfsPackages.map(p => [p.id, { order_no: p.order_no || '', shop_name: p.shop_name || '' }])
          );
        }
      }
      
      for (const bfs of bonusFaceSheets) {
        // ✅ ตรวจสอบว่ายังไม่ได้เพิ่มเข้า loadlist หรืออยู่ใน loadlist ที่ยังไม่ loaded/voided
        const loadlistData = (bfs as any).wms_loadlist_bonus_face_sheets?.[0];
        const loadlistCode = loadlistData?.loadlists?.loadlist_code;
        const loadlistStatus = loadlistData?.loadlists?.status;
        
        // ✅ ข้ามถ้าอยู่ใน loadlist ที่ loaded หรือ voided แล้ว
        if (loadlistCode && (loadlistStatus === 'loaded' || loadlistStatus === 'voided')) {
          console.log(`⏭️ Skip bonus face sheet ${bfs.face_sheet_no} - in ${loadlistStatus} loadlist ${loadlistCode}`);
          continue;
        }
        
        // แสดงถ้า: ยังไม่ได้เข้า loadlist หรือ อยู่ใน loadlist ที่ยังไม่ loaded/voided
        if (loadlistCode && loadlistStatus !== 'loaded' && loadlistStatus !== 'voided') {
          console.log(`✅ Include bonus face sheet ${bfs.face_sheet_no} - in ${loadlistStatus} loadlist ${loadlistCode}`);
        }
        
        const totalQty = (bfs.bonus_face_sheet_items || []).reduce((sum: number, item: any) => 
          sum + (parseFloat(item.quantity_picked) || parseFloat(item.quantity) || 0), 0
        );
        
        // ✅ ไม่ group by SKU แล้ว - แสดงแต่ละ item แยกกันเพื่อให้เห็น order_no และ shop_name ของแต่ละ package
        const items: PreparedDocumentItem[] = [];
        
        for (const item of (bfs.bonus_face_sheet_items || [])) {
          // ✅ ข้าม items ที่ถูก voided
          if (item.voided_at || item.status === 'voided') {
            console.log(`⏭️ Skip voided bonus face sheet item ${item.id} for SKU ${item.sku_id}`);
            continue;
          }
          
          const skuId = item.sku_id || '-';
          const qty = parseFloat(item.quantity_picked) || parseFloat(item.quantity) || 0;
          
          // ดึง order_no และ shop_name จาก package
          const packageInfo = item.package_id ? bfsPackageMap[item.package_id] : null;
          
          // Fetch balance data for this SKU
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select(`
              balance_id,
              pallet_id,
              pallet_id_external,
              lot_no,
              production_date,
              expiry_date,
              total_pack_qty,
              total_piece_qty,
              reserved_pack_qty,
              reserved_piece_qty,
              warehouse_id,
              location_id,
              last_movement_at,
              updated_at
            `)
            .eq('location_id', dispatchLocationId)
            .eq('sku_id', skuId)
            .limit(1)
            .single();
          
          items.push({
            balance_id: balances?.balance_id,
            sku_id: skuId,
            sku_name: item.product_name || skuId,
            quantity: qty,
            location_id: balances?.location_id || dispatchLocationId,
            pallet_id: balances?.pallet_id,
            pallet_id_external: balances?.pallet_id_external,
            lot_no: balances?.lot_no,
            production_date: balances?.production_date,
            expiry_date: balances?.expiry_date,
            total_pack_qty: balances?.total_pack_qty,
            total_piece_qty: balances?.total_piece_qty,
            reserved_pack_qty: balances?.reserved_pack_qty,
            reserved_piece_qty: balances?.reserved_piece_qty,
            warehouse_id: balances?.warehouse_id,
            last_movement_at: balances?.last_movement_at,
            updated_at: balances?.updated_at,
            order_no: packageInfo?.order_no,
            shop_name: packageInfo?.shop_name
          });
        }
        
        // ✅ ข้าม bonus face sheet ที่ไม่มี items ที่ยังใช้งานได้ (ทั้งหมดถูก voided)
        if (items.length === 0) {
          console.log(`⏭️ Skip bonus face sheet ${bfs.face_sheet_no} - all items voided`);
          continue;
        }
        
        console.log(`✅ Include bonus face sheet ${bfs.face_sheet_no} - ${items.length} active items, ${bfs.total_packages} packages`);
        
        documents.push({
          document_type: 'bonus_face_sheet',
          document_id: bfs.id,
          document_no: bfs.face_sheet_no,
          status: bfs.status,
          total_items: items.length,
          total_quantity: totalQty,
          created_at: bfs.created_at,
          loadlist_code: loadlistCode || null,  // ✅ ส่ง loadlist_code ถ้ามี
          items
        } as any);
      }
    }

    // เรียงตามวันที่สร้างล่าสุด
    documents.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      data: documents,
      total: documents.length
    });

  } catch (error: any) {
    console.error('Error fetching prepared documents:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
