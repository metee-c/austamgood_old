import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/checklist?id=xxx
 * สร้างใบเช็คสินค้าสำหรับใบปะหน้าของแถม
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const bonusFaceSheetId = parseInt(id);
    if (isNaN(bonusFaceSheetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลใบปะหน้าของแถม
    const { data: bonusFaceSheet, error: bonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        warehouse_id,
        status,
        delivery_date,
        total_packages,
        total_items,
        total_orders,
        created_date,
        created_by
      `)
      .eq('id', bonusFaceSheetId)
      .single();

    if (bonusFaceSheetError || !bonusFaceSheet) {
      console.error('Error fetching bonus face sheet:', bonusFaceSheetError);
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // ดึงข้อมูล packages และ items
    const { data: packages, error: packagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        order_id,
        order_no,
        shop_name,
        barcode_id,
        bonus_face_sheet_items (
          id,
          sku_id,
          product_name,
          quantity_to_pick,
          quantity_picked,
          status,
          source_location_id
        )
      `)
      .eq('face_sheet_id', bonusFaceSheetId)
      .order('package_number', { ascending: true });

    if (packagesError) {
      console.error('Error fetching packages:', packagesError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คเกจได้' },
        { status: 500 }
      );
    }

    // จัดรูปแบบข้อมูลสำหรับใบเช็ค
    const checklistData = {
      bonusFaceSheet: {
        ...bonusFaceSheet,
        created_date: new Date(bonusFaceSheet.created_date).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        delivery_date: new Date(bonusFaceSheet.delivery_date).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      },
      packages: packages || [],
      summary: {
        totalPackages: bonusFaceSheet.total_packages,
        totalItems: bonusFaceSheet.total_items,
        totalOrders: bonusFaceSheet.total_orders,
        totalQuantityToPick: (packages || []).reduce((sum, pkg) => 
          sum + (pkg.bonus_face_sheet_items || []).reduce((itemSum, item) => 
            itemSum + (item.quantity_to_pick || 0), 0
          ), 0
        ),
        totalQuantityPicked: (packages || []).reduce((sum, pkg) => 
          sum + (pkg.bonus_face_sheet_items || []).reduce((itemSum, item) => 
            itemSum + (item.quantity_picked || 0), 0
          ), 0
        )
      }
    };

    return NextResponse.json({
      success: true,
      data: checklistData
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/checklist:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
