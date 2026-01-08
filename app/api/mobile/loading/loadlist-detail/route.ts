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

    // Get loadlist basic info
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('id, loadlist_code, status, checker_employee_id')
      .eq('loadlist_code', code.toUpperCase())
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'ไม่พบใบโหลดนี้', details: loadlistError?.message },
        { status: 404 }
      );
    }

    // Get checker employee info separately
    let checkerEmployee = null;
    if (loadlist.checker_employee_id) {
      const { data: checkerData } = await supabase
        .from('master_employee')
        .select('employee_id, first_name, last_name, nickname, employee_code')
        .eq('employee_id', loadlist.checker_employee_id)
        .single();
      
      if (checkerData) {
        checkerEmployee = checkerData;
      }
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

    // Get picklists with picker and checker info
    const { data: picklistData } = await supabase
      .from('wms_loadlist_picklists')
      .select(`
        picklist_id,
        picklists:picklist_id (
          picklist_code,
          assigned_to_employee_id,
          picker_employee_ids,
          checker_employee_ids,
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
          picker_employee_ids,
          checker_employee_ids,
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

      // Get unique package IDs from bonus face sheet items
      const packageIds = [...new Set(items.map((item: any) => item.package_id).filter(Boolean))];
      
      // ✅ Fetch package data พร้อม trip_number เพื่อกรองเฉพาะ packages ที่ถูกแมพสายรถแล้ว
      let packageOrderMap: Record<number, number> = {};
      let packageNumberMap: Record<number, string> = {};
      let validPackageIds = new Set<number>(); // เก็บ package_id ที่มี trip_number
      
      if (packageIds.length > 0) {
        const { data: packageData } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, order_id, package_number, trip_number')
          .in('id', packageIds);
        
        packageData?.forEach((pkg: any) => {
          // ✅ กรองเฉพาะ packages ที่มี trip_number (ถูกแมพเข้าสายรถแล้ว)
          if (pkg.trip_number && pkg.trip_number.trim() !== '') {
            packageOrderMap[pkg.id] = pkg.order_id;
            packageNumberMap[pkg.id] = pkg.package_number;
            validPackageIds.add(pkg.id);
          }
        });
      }

      // ✅ กรอง items เฉพาะที่อยู่ใน packages ที่มี trip_number
      const filteredItems = items.filter((item: any) => validPackageIds.has(item.package_id));

      // Get unique SKU IDs from filtered items
      const skuIds = [...new Set(filteredItems.map((item: any) => item.sku_id).filter(Boolean))];
      
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

      // ✅ ใช้ filteredItems แทน items
      for (const item of filteredItems) {
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

    // Get picker and checker info from first picklist, face sheet, or bonus face sheet
    // ใช้ picker_employee_ids และ checker_employee_ids ที่บันทึกตอนยืนยันหยิบสินค้าเสร็จ
    let pickerEmployee = null;
    let pickerEmployees: any[] = [];
    let checkerEmployees: any[] = [];
    
    // ลองดึงจาก picklist ก่อน
    if (picklistData && picklistData.length > 0) {
      const firstPicklist = picklistData[0].picklists as any;
      const pickerIds = firstPicklist?.picker_employee_ids;
      const checkerIds = firstPicklist?.checker_employee_ids;
      
      // ถ้ามี picker_employee_ids (บันทึกตอนยืนยันหยิบเสร็จ)
      if (pickerIds && Array.isArray(pickerIds) && pickerIds.length > 0) {
        const pickerIdsInt = pickerIds.map((id: any) => parseInt(id));
        const { data: pickerData } = await supabase
          .from('master_employee')
          .select('employee_id, first_name, last_name, nickname, employee_code')
          .in('employee_id', pickerIdsInt);
        
        if (pickerData && pickerData.length > 0) {
          pickerEmployees = pickerData;
          pickerEmployee = pickerData[0]; // เก็บคนแรกไว้เพื่อ backward compatibility
        }
      }
      // ถ้าไม่มี ให้ใช้ assigned_employee (กำหนดตอนสร้าง picklist)
      else if (firstPicklist?.assigned_employee) {
        pickerEmployee = firstPicklist.assigned_employee;
        pickerEmployees = [firstPicklist.assigned_employee];
      }

      // ดึงข้อมูล checker_employee_ids
      if (checkerIds && Array.isArray(checkerIds) && checkerIds.length > 0) {
        const checkerIdsInt = checkerIds.map((id: any) => parseInt(id));
        const { data: checkerData } = await supabase
          .from('master_employee')
          .select('employee_id, first_name, last_name, nickname, employee_code')
          .in('employee_id', checkerIdsInt);
        
        if (checkerData && checkerData.length > 0) {
          checkerEmployees = checkerData;
        }
      }
    }
    
    // ถ้ายังไม่มี picker หรือ checker ให้ลองดึงจาก face sheet
    if ((pickerEmployees.length === 0 || checkerEmployees.length === 0) && faceSheetData && faceSheetData.length > 0) {
      const firstFaceSheet = faceSheetData[0].face_sheets as any;
      
      // ดึง picker employees
      if (pickerEmployees.length === 0) {
        const pickerIds = firstFaceSheet?.picker_employee_ids;
        
        if (pickerIds && Array.isArray(pickerIds) && pickerIds.length > 0) {
          const pickerIdsInt = pickerIds.map((id: any) => parseInt(id));
          const { data: pickerData } = await supabase
            .from('master_employee')
            .select('employee_id, first_name, last_name, nickname, employee_code')
            .in('employee_id', pickerIdsInt);
          
          if (pickerData && pickerData.length > 0) {
            pickerEmployees = pickerData;
            pickerEmployee = pickerData[0]; // เก็บคนแรกไว้เพื่อ backward compatibility
          }
        }
      }

      // ดึง checker employees
      if (checkerEmployees.length === 0) {
        const checkerIds = firstFaceSheet?.checker_employee_ids;
        
        if (checkerIds && Array.isArray(checkerIds) && checkerIds.length > 0) {
          const checkerIdsInt = checkerIds.map((id: any) => parseInt(id));
          const { data: checkerData } = await supabase
            .from('master_employee')
            .select('employee_id, first_name, last_name, nickname, employee_code')
            .in('employee_id', checkerIdsInt);
          
          if (checkerData && checkerData.length > 0) {
            checkerEmployees = checkerData;
          }
        }
      }
    }
    
    // ถ้ายังไม่มี picker หรือ checker ให้ลองดึงจาก bonus face sheet
    if ((pickerEmployees.length === 0 || checkerEmployees.length === 0) && bonusFaceSheetData && bonusFaceSheetData.length > 0) {
      // ดึงข้อมูล picker_employee_ids และ checker_employee_ids จาก bonus_face_sheets
      const { data: bfsData } = await supabase
        .from('bonus_face_sheets')
        .select('picker_employee_ids, checker_employee_ids')
        .eq('id', bonusFaceSheetData[0].bonus_face_sheet_id)
        .single();
      
      // ดึง picker employees
      if (pickerEmployees.length === 0) {
        const pickerIds = bfsData?.picker_employee_ids;
        
        if (pickerIds && Array.isArray(pickerIds) && pickerIds.length > 0) {
          const pickerIdsInt = pickerIds.map((id: any) => parseInt(id));
          const { data: pickerData } = await supabase
            .from('master_employee')
            .select('employee_id, first_name, last_name, nickname, employee_code')
            .in('employee_id', pickerIdsInt);
          
          if (pickerData && pickerData.length > 0) {
            pickerEmployees = pickerData;
            pickerEmployee = pickerData[0]; // เก็บคนแรกไว้เพื่อ backward compatibility
          }
        }
      }

      // ดึง checker employees
      if (checkerEmployees.length === 0) {
        const checkerIds = bfsData?.checker_employee_ids;
        
        if (checkerIds && Array.isArray(checkerIds) && checkerIds.length > 0) {
          const checkerIdsInt = checkerIds.map((id: any) => parseInt(id));
          const { data: checkerData } = await supabase
            .from('master_employee')
            .select('employee_id, first_name, last_name, nickname, employee_code')
            .in('employee_id', checkerIdsInt);
          
          if (checkerData && checkerData.length > 0) {
            checkerEmployees = checkerData;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_weight: totalWeight,
        checker_employee_id: loadlist.checker_employee_id,
        checker_employee: checkerEmployee,
        picker_employee: pickerEmployee,
        picker_employees: pickerEmployees, // ส่งรายชื่อพนักงานจัดสินค้าทั้งหมด
        checker_employees: checkerEmployees, // ส่งรายชื่อผู้เช็คจัดสินค้าทั้งหมด
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
