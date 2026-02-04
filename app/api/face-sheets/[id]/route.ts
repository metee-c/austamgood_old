import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * GET /api/face-sheets/[id]
 * Fetch face sheet details by ID
 */
async function _GET(
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

    // Fetch packages for this face sheet - เรียงตาม product_code เพื่อให้สินค้าเดียวกันอยู่ติดกัน
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
      .order('product_code', { ascending: true })
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

/**
 * PATCH /api/face-sheets/[id]
 * Update face sheet status
 */
async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    const { status } = body;

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid face sheet ID' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['draft', 'generated', 'picking', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update face sheet status
    const { data, error } = await supabase
      .from('face_sheets')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating face sheet status:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/face-sheets/[id]:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const PATCH = withShadowLog(_PATCH);
