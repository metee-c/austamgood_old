import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/[id]
 * ดึงรายละเอียดใบปะหน้าของแถม
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }
    
    // ดึงข้อมูล face sheet
    const { data: faceSheet, error: faceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (faceSheetError || !faceSheet) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลใบปะหน้าของแถม' },
        { status: 404 }
      );
    }
    
    // ดึงข้อมูล packages
    const { data: packages, error: packagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('*')
      .eq('face_sheet_id', id)
      .order('package_number');
    
    if (packagesError) {
      console.error('Error fetching packages:', packagesError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }
    
    // ดึงข้อมูล items สำหรับแต่ละ package
    const packagesWithItems = await Promise.all(
      (packages || []).map(async (pkg) => {
        const { data: items } = await supabase
          .from('bonus_face_sheet_items')
          .select('*')
          .eq('package_id', pkg.id)
          .order('id');
        
        return {
          ...pkg,
          items: items || []
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: {
        ...faceSheet,
        packages: packagesWithItems
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bonus-face-sheets/[id]
 * อัพเดทข้อมูลใบปะหน้าของแถม
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { packages } = body;

    if (!packages || !Array.isArray(packages)) {
      return NextResponse.json(
        { success: false, error: 'Invalid packages data' },
        { status: 400 }
      );
    }

    // ลบ packages และ items เดิมทั้งหมด
    const { error: deleteItemsError } = await supabase
      .from('bonus_face_sheet_items')
      .delete()
      .in('package_id', 
        (await supabase
          .from('bonus_face_sheet_packages')
          .select('id')
          .eq('face_sheet_id', id)
        ).data?.map(p => p.id) || []
      );

    if (deleteItemsError) {
      console.error('Error deleting items:', deleteItemsError);
    }

    const { error: deletePackagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .delete()
      .eq('face_sheet_id', id);

    if (deletePackagesError) {
      console.error('Error deleting packages:', deletePackagesError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถลบแพ็คเดิมได้' },
        { status: 500 }
      );
    }

    // สร้าง packages ใหม่
    let packageNumber = 1;
    for (const pkg of packages) {
      const { data: newPackage, error: pkgError } = await supabase
        .from('bonus_face_sheet_packages')
        .insert({
          face_sheet_id: id,
          package_number: packageNumber++,
          order_id: pkg.order_id,
          order_no: pkg.order_no,
          customer_code: pkg.customer_code,
          shop_name: pkg.shop_name,
          address: pkg.address,
          province: pkg.province,
          contact_info: pkg.contact_info,
          phone: pkg.phone,
          hub: pkg.hub,
          remark: pkg.remark,
          delivery_type: pkg.delivery_type,
          sales_territory: pkg.sales_territory,
          trip_number: pkg.trip_number,
          pack_no: pkg.pack_no
        })
        .select()
        .single();

      if (pkgError || !newPackage) {
        console.error('Error creating package:', pkgError);
        return NextResponse.json(
          { success: false, error: 'ไม่สามารถสร้างแพ็คได้' },
          { status: 500 }
        );
      }

      // สร้าง items
      for (const item of pkg.items) {
        const { error: itemError } = await supabase
          .from('bonus_face_sheet_items')
          .insert({
            package_id: newPackage.id,
            order_item_id: item.order_item_id,
            product_code: item.product_code,
            product_name: item.product_name,
            quantity: item.quantity,
            weight: item.weight
          });

        if (itemError) {
          console.error('Error creating item:', itemError);
          return NextResponse.json(
            { success: false, error: 'ไม่สามารถสร้างรายการสินค้าได้' },
            { status: 500 }
          );
        }
      }
    }

    // อัพเดท total counts
    const totalPackages = packages.length;
    const totalItems = packages.reduce((sum, pkg) => sum + pkg.items.length, 0);
    const uniqueOrders = new Set(packages.map(pkg => pkg.order_id)).size;

    await supabase
      .from('bonus_face_sheets')
      .update({
        total_packages: totalPackages,
        total_items: totalItems,
        total_orders: uniqueOrders,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // ดึงข้อมูลใหม่หลังอัพเดท
    const { data: faceSheet, error: faceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (faceSheetError || !faceSheet) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลใบปะหน้าของแถม' },
        { status: 404 }
      );
    }
    
    const { data: updatedPackages, error: packagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('*')
      .eq('face_sheet_id', id)
      .order('package_number');
    
    if (packagesError) {
      console.error('Error fetching packages:', packagesError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }
    
    const packagesWithItems = await Promise.all(
      (updatedPackages || []).map(async (pkg) => {
        const { data: items } = await supabase
          .from('bonus_face_sheet_items')
          .select('*')
          .eq('package_id', pkg.id)
          .order('id');
        
        return {
          ...pkg,
          items: items || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        ...faceSheet,
        packages: packagesWithItems
      }
    });
  } catch (error: any) {
    console.error('Error in PUT /api/bonus-face-sheets/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
