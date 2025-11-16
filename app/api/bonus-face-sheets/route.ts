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
      warehouse_id = 'WH01',
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
      console.error('Error creating face sheet:', faceSheetError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถสร้างใบปะหน้าได้' },
        { status: 500 }
      );
    }
    
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
          product_code: item.product_code,
          product_name: item.product_name,
          quantity: item.quantity,
          unit: 'ชิ้น',
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
    
    return NextResponse.json({
      success: true,
      face_sheet_no,
      total_packages,
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
