import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/warehouse/prep-area-packages?zone=PQ|MR
 * ดึงข้อมูล packages ที่อยู่ใน PQ01-PQ10, MR01-MR10
 * และแพ็คที่รอโหลดใน PQTD/MRTD (จาก loadlist ที่ยังไม่โหลด)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const zone = searchParams.get('zone') || 'PQ'; // PQ or MR

    // กำหนด location prefix ตาม zone
    const locationPrefix = zone.toUpperCase();
    const stagingLocation = `${locationPrefix}TD`;

    // ดึง packages ที่มี storage_location เป็น PQ01-PQ10 หรือ MR01-MR10
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
        bonus_face_sheets!inner (
          id,
          face_sheet_no
        )
      `)
      .not('storage_location', 'is', null)
      .like('storage_location', `${locationPrefix}%`)
      .order('storage_location')
      .order('package_number');

    if (error) {
      console.error('Error fetching prep area packages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // จัดกลุ่ม packages ตาม location
    const locationGroups: Record<string, {
      location_code: string;
      packages: Array<{
        id: number;
        package_number: number;
        barcode_id: string | null;
        shop_name: string | null;
        hub: string | null;
        trip_number: string | null;
        face_sheet_no: string;
        order_no?: string;
      }>;
      // สำหรับ staging location (PQTD/MRTD) แสดงแพ็คที่รอโหลด
      staging_packages?: Array<{
        package_id: number;
        package_number: number;
        shop_name: string | null;
        order_no: string;
        loadlist_code: string;
      }>;
    }> = {};

    // สร้าง locations ทั้งหมด (01-10 + TD)
    for (let i = 1; i <= 10; i++) {
      const locCode = `${locationPrefix}${i.toString().padStart(2, '0')}`;
      locationGroups[locCode] = { location_code: locCode, packages: [] };
    }
    locationGroups[stagingLocation] = { location_code: stagingLocation, packages: [], staging_packages: [] };

    // จัดกลุ่ม packages (ยกเว้น TD)
    for (const pkg of packages || []) {
      const loc = pkg.storage_location;
      if (loc && locationGroups[loc] && !loc.endsWith('TD')) {
        locationGroups[loc].packages.push({
          id: pkg.id,
          package_number: pkg.package_number,
          barcode_id: pkg.barcode_id,
          shop_name: pkg.shop_name,
          hub: pkg.hub,
          trip_number: pkg.trip_number,
          face_sheet_no: (pkg.bonus_face_sheets as any)?.face_sheet_no || '-'
        });
      }
    }

    // ✅ ดึงแพ็คที่รอโหลดใน PQTD/MRTD จาก loadlist ที่ยังไม่โหลด
    // หา loadlist ที่มี bonus_face_sheet และ status = pending
    
    const { data: pendingLoadlists } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id,
          matched_package_ids
        )
      `)
      .eq('status', 'pending');

    if (pendingLoadlists && pendingLoadlists.length > 0) {
      // รวบรวม package_ids ทั้งหมดจาก loadlists
      const loadlistPackageMap: Record<number, string> = {}; // package_id -> loadlist_code
      const allPackageIds: number[] = [];
      
      for (const loadlist of pendingLoadlists) {
        const bfsMappings = (loadlist as any).wms_loadlist_bonus_face_sheets || [];
        for (const mapping of bfsMappings) {
          const pkgIds = mapping.matched_package_ids || [];
          for (const pkgId of pkgIds) {
            loadlistPackageMap[pkgId] = loadlist.loadlist_code;
            allPackageIds.push(pkgId);
          }
        }
      }

      if (allPackageIds.length > 0) {
        // ดึงข้อมูล packages ทั้งหมดที่อยู่ใน loadlist pending (ไม่สนใจ storage_location)
        const { data: stagingPackages } = await supabase
          .from('bonus_face_sheet_packages')
          .select(`
            id,
            package_number,
            shop_name,
            hub,
            order_id
          `)
          .in('id', [...new Set(allPackageIds)]);

        if (stagingPackages && stagingPackages.length > 0) {
          // ดึง order_no จาก wms_orders
          const orderIds = [...new Set(stagingPackages.map(p => p.order_id).filter(Boolean))];
          let orderNoMap: Record<number, string> = {};
          
          if (orderIds.length > 0) {
            const { data: orders } = await supabase
              .from('wms_orders')
              .select('order_id, order_no')
              .in('order_id', orderIds);
            
            orders?.forEach(o => {
              orderNoMap[o.order_id] = o.order_no;
            });
          }

          // กรองตาม hub และเพิ่มเข้า staging_packages
          for (const pkg of stagingPackages) {
            // ตรวจสอบ hub - PQ = กรุงเทพ/ภาคกลาง/Marketing, MR = ต่างจังหวัด
            const isPQHub = pkg.hub && (pkg.hub.includes('กรุงเทพ') || pkg.hub.includes('ภาคกลาง') || pkg.hub.includes('Marketing'));
            const isMRHub = pkg.hub && !isPQHub;
            
            const shouldInclude = (zone === 'PQ' && isPQHub) || (zone === 'MR' && isMRHub);
            
            if (shouldInclude && loadlistPackageMap[pkg.id]) {
              locationGroups[stagingLocation].staging_packages!.push({
                package_id: pkg.id,
                package_number: pkg.package_number,
                shop_name: pkg.shop_name,
                order_no: orderNoMap[pkg.order_id] || '-',
                loadlist_code: loadlistPackageMap[pkg.id]
              });
            }
          }
        }
      }
    }

    // แปลงเป็น array และเรียงลำดับ
    const result = Object.values(locationGroups).sort((a, b) => {
      // TD ไว้ท้ายสุด
      if (a.location_code.endsWith('TD')) return 1;
      if (b.location_code.endsWith('TD')) return -1;
      return a.location_code.localeCompare(b.location_code);
    });

    // สรุปข้อมูล
    const totalPackages = result.reduce((sum, loc) => sum + loc.packages.length, 0);
    const stagingPackageCount = locationGroups[stagingLocation].staging_packages?.length || 0;
    const occupiedLocations = result.filter(loc => 
      loc.packages.length > 0 || (loc.staging_packages && loc.staging_packages.length > 0)
    ).length;

    return NextResponse.json({
      success: true,
      zone: locationPrefix,
      data: result,
      summary: {
        total_locations: result.length,
        occupied_locations: occupiedLocations,
        total_packages: totalPackages,
        staging_packages: stagingPackageCount
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/warehouse/prep-area-packages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
