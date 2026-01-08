import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets
 * ดึงรายการใบปะหน้าของแถมทั้งหมด
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const limit = parseInt(searchParams.get('limit') || '100');
    const status = searchParams.get('status');
    const created_date = searchParams.get('created_date');
    
    let query = supabase
      .from('bonus_face_sheets')
      .select('*')
      .order('created_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (created_date) {
      query = query.eq('created_date', created_date);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching bonus face sheets:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bonus-face-sheets
 * สร้างใบปะหน้าของแถมใหม่จากออเดอร์ที่มี order_type = 'special'
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      warehouse_id = 'WH001',
      created_by = 'System',
      delivery_date,
      packages = []
    } = body;
    
    if (!packages || packages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีข้อมูลแพ็คสินค้า' },
        { status: 400 }
      );
    }
    
    // ✅ Validate: ตรวจสอบว่าทุก SKU มี preparation area mapping
    const allSkuIds = new Set<string>();
    for (const pkg of packages) {
      if (pkg.items && Array.isArray(pkg.items)) {
        for (const item of pkg.items) {
          if (item.product_code) {
            allSkuIds.add(item.product_code);
          }
        }
      }
    }

    if (allSkuIds.size > 0) {
      const { data: mappings, error: mappingError } = await supabase
        .from('sku_preparation_area_mapping')
        .select('sku_id')
        .in('sku_id', Array.from(allSkuIds));

      if (mappingError) {
        console.error('Error checking SKU mappings:', mappingError);
        return NextResponse.json(
          { success: false, error: 'ไม่สามารถตรวจสอบการตั้งค่าบ้านหยิบได้' },
          { status: 500 }
        );
      }

      const mappedSkuIds = new Set(mappings?.map(m => m.sku_id) || []);
      const unmappedSkuIds = Array.from(allSkuIds).filter(sku => !mappedSkuIds.has(sku));

      if (unmappedSkuIds.length > 0) {
        // ดึงชื่อ SKU สำหรับแสดงใน error message
        const { data: skuNames } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name')
          .in('sku_id', unmappedSkuIds);

        const skuList = skuNames?.map(s => `${s.sku_id} (${s.sku_name})`).join(', ') || unmappedSkuIds.join(', ');
        
        console.error('❌ [Bonus FS] SKUs without mapping:', unmappedSkuIds);
        return NextResponse.json(
          { 
            success: false, 
            error: `SKU ต่อไปนี้ยังไม่ได้กำหนดบ้านหยิบ: ${skuList}\n\nกรุณาตั้งค่าที่หน้า Master Data > Preparation Area ก่อนสร้างใบปะหน้า`,
            unmapped_skus: unmappedSkuIds
          },
          { status: 400 }
        );
      }
    }

    // Generate face sheet number
    const { data: faceSheetNoData, error: faceSheetNoError } = await supabase
      .rpc('generate_bonus_face_sheet_no');
    
    if (faceSheetNoError) {
      console.error('Error generating face sheet number:', faceSheetNoError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถสร้างเลขที่ใบปะหน้าได้' },
        { status: 500 }
      );
    }
    
    const face_sheet_no = faceSheetNoData;
    
    // นับจำนวนรวม
    const total_packages = packages.length;
    const total_items = packages.reduce((sum: number, pkg: any) => 
      sum + (pkg.items?.length || 0), 0
    );
    const total_orders = new Set(packages.map((pkg: any) => pkg.order_id)).size;
    
    // สร้าง face sheet header
    console.log('🔵 [Bonus FS] Creating face sheet with:', {
      face_sheet_no,
      warehouse_id,
      status: 'generated',
      delivery_date,
      total_packages,
      total_items,
      total_orders
    });

    const { data: faceSheet, error: faceSheetError } = await supabase
      .from('bonus_face_sheets')
      .insert({
        face_sheet_no,
        warehouse_id,
        status: 'generated',
        delivery_date,
        created_by,
        total_packages,
        total_items,
        total_orders
      })
      .select()
      .single();
    
    if (faceSheetError || !faceSheet) {
      console.error('❌ [Bonus FS] Error creating face sheet:', faceSheetError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถสร้างใบปะหน้าได้' },
        { status: 500 }
      );
    }

    console.log('✅ [Bonus FS] Face sheet created:', {
      id: faceSheet.id,
      face_sheet_no: faceSheet.face_sheet_no,
      warehouse_id: faceSheet.warehouse_id,
      status: faceSheet.status
    });

    // รอ trigger ทำงาน (trigger จะ run หลัง INSERT)
    await new Promise(resolve => setTimeout(resolve, 500));

    // ตรวจสอบว่า trigger จองสต็อคหรือยัง
    const { data: reservations, error: reservationCheckError } = await supabase
      .from('bonus_face_sheet_item_reservations')
      .select('reservation_id, bonus_face_sheet_item_id, reserved_piece_qty')
      .in('bonus_face_sheet_item_id', 
        (await supabase
          .from('bonus_face_sheet_items')
          .select('id')
          .eq('face_sheet_id', faceSheet.id)
        ).data?.map(i => i.id) || []
      );

    console.log('📊 [Bonus FS] Stock reservations check:', {
      face_sheet_id: faceSheet.id,
      reservations_count: reservations?.length || 0,
      reservations: reservations
    });
    
    // สร้าง packages และ items
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      
      // สร้าง barcode_id
      const barcode_id = `${face_sheet_no}-P${String(i + 1).padStart(3, '0')}`;
      
      // Insert package
      const { data: packageData, error: packageError } = await supabase
        .from('bonus_face_sheet_packages')
        .insert({
          face_sheet_id: faceSheet.id,
          package_number: i + 1,
          barcode_id,
          order_id: pkg.order_id,
          order_no: pkg.order_no,
          customer_id: pkg.customer_code,
          shop_name: pkg.shop_name,
          address: pkg.address,
          province: pkg.province,
          contact_info: pkg.contact_info,
          phone: pkg.phone,
          hub: pkg.hub,
          delivery_type: pkg.delivery_type,
          remark: pkg.remark || '',
          sales_territory: pkg.sales_territory || '',
          trip_number: pkg.trip_number || '',
          pack_no: pkg.pack_no || '', // เก็บค่าที่ผู้ใช้กรอก
          total_items: pkg.items?.length || 0
        })
        .select()
        .single();
      
      if (packageError || !packageData) {
        console.error('Error creating package:', packageError);
        continue;
      }
      
      // Insert items
      if (pkg.items && pkg.items.length > 0) {
        const items = pkg.items.map((item: any) => ({
          face_sheet_id: faceSheet.id,
          package_id: packageData.id,
          order_item_id: item.order_item_id,
          sku_id: item.product_code, // ✅ เพิ่ม sku_id สำหรับ stock reservation
          product_code: item.product_code,
          product_name: item.product_name,
          quantity: item.quantity,
          quantity_to_pick: item.quantity, // ✅ เพิ่ม quantity_to_pick
          source_location_id: item.preparation_area || null, // ✅ เพิ่ม source_location_id (preparation area)
          status: 'pending', // ✅ เพิ่ม status เริ่มต้น
          unit: 'ชิ้น',
          uom: 'ชิ้น', // ✅ เพิ่ม uom
          weight: item.weight
        }));
        
        const { error: itemsError } = await supabase
          .from('bonus_face_sheet_items')
          .insert(items);
        
        if (itemsError) {
          console.error('Error creating items:', itemsError);
        }
      }
    }

    console.log('🔄 [Bonus FS] All items created, now calling stock reservation...');
    
    // เรียก function จองสต็อคด้วยตนเอง (เพราะ trigger ทำงานก่อนที่จะมี items)
    const { data: reservationResult, error: reservationError } = await supabase
      .rpc('reserve_stock_for_bonus_face_sheet_items', {
        p_bonus_face_sheet_id: faceSheet.id,
        p_warehouse_id: warehouse_id,
        p_reserved_by: created_by
      });

    if (reservationError) {
      console.error('❌ [Bonus FS] Reservation error:', reservationError);
    } else {
      console.log('✅ [Bonus FS] Reservation result:', reservationResult);
    }

    // ✅ อัปเดตสถานะ orders เป็น 'confirmed' สำหรับทุก order ในใบปะหน้า
    const orderIds = packages.map(pkg => pkg.order_id).filter(Boolean);
    if (orderIds.length > 0) {
      const { error: orderUpdateError } = await supabase
        .from('wms_orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .in('order_id', orderIds)
        .eq('order_type', 'special');

      if (orderUpdateError) {
        console.error('❌ [Bonus FS] Order status update error:', orderUpdateError);
      } else {
        console.log(`✅ [Bonus FS] Updated ${orderIds.length} orders to 'confirmed'`);
      }
    }

    return NextResponse.json({
      success: true,
      face_sheet_no,
      total_packages,
      reservation_result: reservationResult?.[0],
      message: `สร้างใบปะหน้าของแถม ${face_sheet_no} สำเร็จ`
    });
  } catch (error: any) {
    console.error('Error in POST /api/bonus-face-sheets:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
