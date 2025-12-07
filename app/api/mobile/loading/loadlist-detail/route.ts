import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'กรุณาระบุเลขใบโหลด' },
        { status: 400 }
      );
    }

    // Get loadlist basic info with checker
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select(`
        id, 
        loadlist_code, 
        status,
        checker_employee_id,
        checker_employee:checker_employee_id (
          employee_id,
          first_name,
          last_name,
          employee_code
        )
      `)
      .eq('loadlist_code', code.toUpperCase())
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'ไม่พบใบโหลดนี้', details: loadlistError?.message },
        { status: 404 }
      );
    }

    // Check if already loaded
    if (loadlist.status === 'loaded') {
      return NextResponse.json(
        { error: 'ใบโหลดนี้โหลดเสร็จแล้ว' },
        { status: 400 }
      );
    }

    let totalWeight = 0;
    const ordersMap = new Map();

    // Get picklists with picker info
    const { data: picklistData } = await supabase
      .from('wms_loadlist_picklists')
      .select(`
        picklist_id,
        picklists:picklist_id (
          picklist_code,
          assigned_to_employee_id,
          picker_employee_ids,
          assigned_employee:assigned_to_employee_id (
            employee_id,
            first_name,
            last_name,
            employee_code
          ),
          picklist_items (
            order_id,
            order_no,
            sku_id,
            quantity_picked,
            quantity_to_pick,
            master_sku:sku_id (
              sku_name,
              weight_per_piece_kg
            ),
            wms_orders:order_id (
              order_id,
              order_no,
              shop_name
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist.id);

    // Process picklist items
    for (const lp of picklistData || []) {
      const picklist = lp.picklists as any;
      if (!picklist) continue;

      for (const item of picklist.picklist_items || []) {
        const qty = item.quantity_picked || item.quantity_to_pick || 0;
        const weight = item.master_sku?.weight_per_piece_kg || 0;
        totalWeight += qty * weight;

        if (item.wms_orders && item.order_id) {
          if (!ordersMap.has(item.order_id)) {
            ordersMap.set(item.order_id, {
              order_code: item.wms_orders.order_no || item.order_no,
              customer_name: item.wms_orders.shop_name || '-',
              items: []
            });
          }
          const orderData = ordersMap.get(item.order_id);
          orderData.items.push({
            sku_name: item.master_sku?.sku_name || '-',
            quantity: qty,
            weight: weight
          });
        }
      }
    }

    // Get face sheets
    const { data: faceSheetData } = await supabase
      .from('loadlist_face_sheets')
      .select(`
        face_sheet_id,
        face_sheets:face_sheet_id (
          face_sheet_no,
          face_sheet_items (
            sku_id,
            quantity,
            order_id,
            master_sku:sku_id (
              sku_name,
              weight_per_piece_kg
            ),
            wms_orders:order_id (
              order_id,
              order_no,
              shop_name
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist.id);

    // Process face sheet items
    for (const fs of faceSheetData || []) {
      const faceSheet = fs.face_sheets as any;
      if (!faceSheet) continue;

      for (const item of faceSheet.face_sheet_items || []) {
        const qty = item.quantity || 0;
        const weight = item.master_sku?.weight_per_piece_kg || 0;
        totalWeight += qty * weight;

        if (item.wms_orders && item.order_id) {
          if (!ordersMap.has(item.order_id)) {
            ordersMap.set(item.order_id, {
              order_code: item.wms_orders.order_no,
              customer_name: item.wms_orders.shop_name || '-',
              items: []
            });
          }
          const orderData = ordersMap.get(item.order_id);
          orderData.items.push({
            sku_name: item.master_sku?.sku_name || '-',
            quantity: qty,
            weight: weight
          });
        }
      }
    }

    // Get bonus face sheets
    const { data: bonusFaceSheetData } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        bonus_face_sheet_id,
        bonus_face_sheets:bonus_face_sheet_id (
          face_sheet_no,
          bonus_face_sheet_items (
            sku_id,
            quantity_picked,
            package_id
          )
        )
      `)
      .eq('loadlist_id', loadlist.id);

    // Process bonus face sheet items
    for (const bfs of bonusFaceSheetData || []) {
      const bonusFaceSheet = bfs.bonus_face_sheets as any;
      if (!bonusFaceSheet) continue;

      const items = bonusFaceSheet.bonus_face_sheet_items || [];

      // Get unique SKU IDs and package IDs from bonus face sheet items
      const skuIds = [...new Set(items.map((item: any) => item.sku_id).filter(Boolean))];
      const packageIds = [...new Set(items.map((item: any) => item.package_id).filter(Boolean))];
      
      // Create item to package mapping
      const itemPackageMap: Record<string, number> = {};
      items.forEach((item: any) => {
        itemPackageMap[item.sku_id] = item.package_id;
      });
      
      // Fetch SKU data separately
      let skuMap: Record<string, any> = {};
      if (skuIds.length > 0) {
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name, weight_per_piece_kg')
          .in('sku_id', skuIds);
        
        skuData?.forEach((sku: any) => {
          skuMap[sku.sku_id] = sku;
        });
      }

      // Fetch package data to get order_id and package_number
      let packageOrderMap: Record<number, number> = {};
      let packageNumberMap: Record<number, string> = {};
      if (packageIds.length > 0) {
        const { data: packageData } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, order_id, package_number')
          .in('id', packageIds);
        
        packageData?.forEach((pkg: any) => {
          packageOrderMap[pkg.id] = pkg.order_id;
          packageNumberMap[pkg.id] = pkg.package_number;
        });
      }

      // Get unique order IDs
      const orderIds = [...new Set(Object.values(packageOrderMap).filter(Boolean))];

      // Fetch order data separately
      let orderMap: Record<number, any> = {};
      if (orderIds.length > 0) {
        const { data: orderData } = await supabase
          .from('wms_orders')
          .select('order_id, order_no, shop_name')
          .in('order_id', orderIds);
        
        orderData?.forEach((order: any) => {
          orderMap[order.order_id] = order;
        });
      }

      for (const item of items) {
        const qty = item.quantity_picked || 0;
        const sku = skuMap[item.sku_id];
        const orderId = packageOrderMap[item.package_id];
        const order = orderMap[orderId];
        const weight = parseFloat(sku?.weight_per_piece_kg) || 0;
        totalWeight += qty * weight;

        if (order && orderId) {
          if (!ordersMap.has(orderId)) {
            ordersMap.set(orderId, {
              order_code: order.order_no,
              customer_name: order.shop_name || '-',
              items: []
            });
          }
          const orderData = ordersMap.get(orderId);
          orderData.items.push({
            sku_id: item.sku_id,
            sku_name: sku?.sku_name || '-',
            quantity: qty,
            weight: weight,
            package_number: packageNumberMap[item.package_id] || '-'
          });
        }
      }
    }

    const orders = Array.from(ordersMap.values());

    // Get picker info from first picklist
    // ใช้ picker_employee_ids ที่บันทึกตอนยืนยันหยิบสินค้าเสร็จ
    let pickerEmployee = null;
    if (picklistData && picklistData.length > 0) {
      const firstPicklist = picklistData[0].picklists as any;
      const pickerIds = firstPicklist?.picker_employee_ids;
      
      // ถ้ามี picker_employee_ids (บันทึกตอนยืนยันหยิบเสร็จ)
      if (pickerIds && Array.isArray(pickerIds) && pickerIds.length > 0) {
        const pickerId = parseInt(pickerIds[0]);
        const { data: pickerData } = await supabase
          .from('master_employee')
          .select('employee_id, first_name, last_name, employee_code')
          .eq('employee_id', pickerId)
          .single();
        
        if (pickerData) {
          pickerEmployee = pickerData;
        }
      }
      // ถ้าไม่มี ให้ใช้ assigned_employee (กำหนดตอนสร้าง picklist)
      else if (firstPicklist?.assigned_employee) {
        pickerEmployee = firstPicklist.assigned_employee;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_weight: totalWeight,
        checker_employee_id: loadlist.checker_employee_id,
        checker_employee: (loadlist as any).checker_employee,
        picker_employee: pickerEmployee,
        orders
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
