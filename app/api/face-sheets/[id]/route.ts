import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/face-sheets/[id]
 * Fetch face sheet details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid face sheet ID' },
        { status: 400 }
      );
    }

    // Fetch face sheet with packages
    const { data: faceSheet, error: faceSheetError } = await supabase
      .from('face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        created_date,
        total_packages,
        total_items,
        total_orders,
        small_size_count,
        large_size_count,
        warehouse_id,
        notes
      `)
      .eq('id', id)
      .single();

    if (faceSheetError || !faceSheet) {
      return NextResponse.json(
        { success: false, error: 'Face sheet not found' },
        { status: 404 }
      );
    }

    // Fetch packages for this face sheet
    const { data: packages, error: packagesError } = await supabase
      .from('face_sheet_packages')
      .select(`
        id,
        package_number,
        barcode_id,
        order_no,
        shop_name,
        product_code,
        product_name,
        size,
        size_category,
        package_type,
        pieces_per_pack,
        address,
        province,
        contact_name,
        phone,
        hub,
        notes
      `)
      .eq('face_sheet_id', id)
      .order('package_number', { ascending: true });

    if (packagesError) {
      console.error('Error fetching packages:', packagesError);
      return NextResponse.json(
        { success: false, error: 'Error loading packages' },
        { status: 500 }
      );
    }

    const result = {
      face_sheet_no: faceSheet.face_sheet_no,
      status: faceSheet.status,
      created_date: faceSheet.created_date,
      total_packages: faceSheet.total_packages,
      total_items: faceSheet.total_items,
      total_orders: faceSheet.total_orders,
      small_size_count: faceSheet.small_size_count,
      large_size_count: faceSheet.large_size_count,
      packages: packages || []
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Error in GET /api/face-sheets/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
