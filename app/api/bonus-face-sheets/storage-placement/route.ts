import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/bonus-face-sheets/storage-placement?id=xxx
 * Get data for printing storage placement form (ใบจัดวางสินค้า)
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ id' },
        { status: 400 }
      );
    }

    // Get face sheet info
    const { data: faceSheet, error: fsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, face_sheet_no, total_packages, created_date, status')
      .eq('id', id)
      .single();

    if (fsError || !faceSheet) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // Get packages with storage locations
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, package_number, barcode_id, shop_name, order_no, hub, storage_location')
      .eq('face_sheet_id', id)
      .order('package_number');

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: pkgError.message },
        { status: 500 }
      );
    }

    // Check if locations are assigned
    const unassignedCount = packages?.filter(p => !p.storage_location).length || 0;
    
    if (unassignedCount > 0) {
      return NextResponse.json({
        success: false,
        error: `มี ${unassignedCount} แพ็คที่ยังไม่ได้จัดสรรโลเคชั่น กรุณากดปุ่ม "จัดสรรโลเคชั่น" ก่อน`,
        needs_assignment: true,
        unassigned_count: unassignedCount
      }, { status: 400 });
    }

    // Group packages by storage_location
    const locationMap = new Map<string, any[]>();
    packages?.forEach(pkg => {
      const loc = pkg.storage_location || 'UNASSIGNED';
      if (!locationMap.has(loc)) {
        locationMap.set(loc, []);
      }
      locationMap.get(loc)!.push({
        package_id: pkg.id,
        package_number: pkg.package_number,
        barcode_id: pkg.barcode_id,
        shop_name: pkg.shop_name,
        order_no: pkg.order_no,
        hub: pkg.hub
      });
    });

    // Convert to array and sort by location
    const locationSummary = Array.from(locationMap.entries())
      .map(([location, pkgs]) => ({
        storage_location: location,
        package_count: pkgs.length,
        packages: pkgs.sort((a, b) => a.package_number - b.package_number)
      }))
      .sort((a, b) => a.storage_location.localeCompare(b.storage_location));

    return NextResponse.json({
      success: true,
      data: {
        face_sheet_no: faceSheet.face_sheet_no,
        created_date: faceSheet.created_date,
        total_packages: faceSheet.total_packages,
        status: faceSheet.status,
        location_summary: locationSummary
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/storage-placement:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
