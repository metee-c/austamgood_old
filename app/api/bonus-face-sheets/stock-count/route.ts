import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/bonus-face-sheets/stock-count
 * ดึงข้อมูล packages ทั้งหมดที่ยังอยู่ใน prep areas (PQ01-PQ10, MR01-MR10, PQTD, MRTD)
 * สำหรับการนับสต็อกและปรับสต็อก
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ดึง packages ที่ยังอยู่ใน prep areas
    const { data: packages, error } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        barcode_id,
        storage_location,
        shop_name,
        hub,
        trip_number,
        face_sheet_id,
        order_id,
        order_no,
        bonus_face_sheets!inner (
          id,
          face_sheet_no,
          status,
          created_date
        )
      `)
      .not('storage_location', 'is', null)
      .neq('storage_location', '')
      .order('storage_location')
      .order('face_sheet_id')
      .order('package_number');

    if (error) {
      console.error('Error fetching packages:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // กรองเฉพาะ packages ที่อยู่ใน prep areas (PQ01-PQ10, MR01-MR10, PQTD, MRTD)
    const prepAreaPattern = /^(PQ0[1-9]|PQ10|MR0[1-9]|MR10|PQTD|MRTD)$/;
    const filteredPackages = packages?.filter(pkg => 
      pkg.storage_location && prepAreaPattern.test(pkg.storage_location)
    ) || [];

    // ดึง items ของแต่ละ package
    const packageIds = filteredPackages.map(p => p.id);
    let itemsMap: Record<number, any[]> = {};

    if (packageIds.length > 0) {
      const { data: items } = await supabase
        .from('bonus_face_sheet_items')
        .select(`
          id,
          package_id,
          sku_id,
          product_code,
          product_name,
          quantity,
          quantity_picked,
          status
        `)
        .in('package_id', packageIds);

      // Group items by package_id
      items?.forEach(item => {
        if (!itemsMap[item.package_id]) {
          itemsMap[item.package_id] = [];
        }
        itemsMap[item.package_id].push(item);
      });
    }

    // จัดกลุ่มตาม location
    const locationGroups: Record<string, {
      location_code: string;
      zone: 'PQ' | 'MR';
      is_staging: boolean;
      packages: any[];
      total_packages: number;
    }> = {};

    for (const pkg of filteredPackages) {
      const loc = pkg.storage_location;
      if (!locationGroups[loc]) {
        locationGroups[loc] = {
          location_code: loc,
          zone: loc.startsWith('PQ') ? 'PQ' : 'MR',
          is_staging: loc === 'PQTD' || loc === 'MRTD',
          packages: [],
          total_packages: 0
        };
      }

      const bfs = pkg.bonus_face_sheets as any;
      locationGroups[loc].packages.push({
        id: pkg.id,
        package_number: pkg.package_number,
        barcode_id: pkg.barcode_id,
        storage_location: pkg.storage_location,
        shop_name: pkg.shop_name,
        hub: pkg.hub,
        trip_number: pkg.trip_number,
        order_no: pkg.order_no,
        face_sheet_id: pkg.face_sheet_id,
        face_sheet_no: bfs?.face_sheet_no || '-',
        face_sheet_status: bfs?.status || '-',
        created_date: bfs?.created_date,
        items: itemsMap[pkg.id] || []
      });
      locationGroups[loc].total_packages++;
    }

    // สรุปข้อมูล
    const summary = {
      total_packages: filteredPackages.length,
      pq_packages: filteredPackages.filter(p => p.storage_location?.startsWith('PQ')).length,
      mr_packages: filteredPackages.filter(p => p.storage_location?.startsWith('MR')).length,
      staging_packages: filteredPackages.filter(p => 
        p.storage_location === 'PQTD' || p.storage_location === 'MRTD'
      ).length,
      locations: Object.keys(locationGroups).sort()
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        locations: locationGroups,
        packages: filteredPackages.map(pkg => {
          const bfs = pkg.bonus_face_sheets as any;
          return {
            id: pkg.id,
            package_number: pkg.package_number,
            barcode_id: pkg.barcode_id,
            storage_location: pkg.storage_location,
            shop_name: pkg.shop_name,
            hub: pkg.hub,
            trip_number: pkg.trip_number,
            order_no: pkg.order_no,
            face_sheet_id: pkg.face_sheet_id,
            face_sheet_no: bfs?.face_sheet_no || '-',
            face_sheet_status: bfs?.status || '-',
            created_date: bfs?.created_date,
            items: itemsMap[pkg.id] || []
          };
        })
      }
    });

  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/stock-count:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
