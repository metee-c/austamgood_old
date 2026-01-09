import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/pick-list?id=xxx&loadlist_id=xxx
 * Get data for printing pick list form (ใบหยิบสินค้า)
 * Groups packages by trip_number and determines destination (PQTD/MRTD)
 * ✅ NEW: ดึงข้อมูลร้านค้าจาก face sheet ที่แมพด้วย
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id'); // bonus_face_sheet_id
    const loadlistId = searchParams.get('loadlist_id');

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

    // Get loadlist info if provided
    let loadlistCode = null;
    let mappedFaceSheetId: number | null = null;
    let mappedPicklistId: number | null = null;
    
    if (loadlistId) {
      const { data: loadlist } = await supabase
        .from('loadlists')
        .select('loadlist_code, trip_id')
        .eq('id', loadlistId)
        .single();
      loadlistCode = loadlist?.loadlist_code;

      // ✅ NEW: ดึง face_sheet_id ที่แมพกับ loadlist นี้
      const { data: mappedFaceSheets } = await supabase
        .from('loadlist_face_sheets')
        .select('face_sheet_id')
        .eq('loadlist_id', loadlistId);
      
      if (mappedFaceSheets && mappedFaceSheets.length > 0) {
        mappedFaceSheetId = mappedFaceSheets[0].face_sheet_id;
        console.log('📋 Found mapped face_sheet_id:', mappedFaceSheetId);
      }

      // ✅ NEW: ดึง picklist_id ที่แมพกับ loadlist นี้
      const { data: mappedPicklists } = await supabase
        .from('wms_loadlist_picklists')
        .select('picklist_id')
        .eq('loadlist_id', loadlistId);
      
      if (mappedPicklists && mappedPicklists.length > 0) {
        mappedPicklistId = mappedPicklists[0].picklist_id;
        console.log('📋 Found mapped picklist_id:', mappedPicklistId);
      }
    }

    // ✅ NEW: ดึงข้อมูลร้านค้าจาก face sheet ที่แมพ
    let faceSheetOrders: Array<{ order_no: string; shop_name: string; hub: string }> = [];
    if (mappedFaceSheetId) {
      const { data: faceSheetPackages } = await supabase
        .from('face_sheet_packages')
        .select('order_no, shop_name, hub')
        .eq('face_sheet_id', mappedFaceSheetId);
      
      if (faceSheetPackages) {
        // Deduplicate by order_no
        const orderMap = new Map<string, { order_no: string; shop_name: string; hub: string }>();
        faceSheetPackages.forEach((pkg: any) => {
          if (pkg.order_no && !orderMap.has(pkg.order_no)) {
            orderMap.set(pkg.order_no, {
              order_no: pkg.order_no,
              shop_name: pkg.shop_name || '',
              hub: pkg.hub || ''
            });
          }
        });
        faceSheetOrders = Array.from(orderMap.values());
        console.log('📋 Found face sheet orders:', faceSheetOrders.length);
      }
    }

    // Get packages with storage locations and trip info
    // ✅ ถ้ามี mapping กับ face sheet แล้ว ดึง packages ทั้งหมด (ไม่กรอง trip_number)
    // ✅ ถ้าไม่มี mapping ให้กรองเฉพาะ packages ที่มี trip_number
    let packages: any[] = [];
    let pkgError: any = null;

    if (mappedFaceSheetId || mappedPicklistId) {
      // มี mapping แล้ว - ดึง packages ทั้งหมด
      const result = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id, 
          package_number, 
          barcode_id, 
          shop_name, 
          order_no, 
          hub, 
          storage_location,
          trip_number
        `)
        .eq('face_sheet_id', id)
        .order('package_number');
      
      packages = result.data || [];
      pkgError = result.error;
    } else {
      // ไม่มี mapping - กรองเฉพาะ packages ที่มี trip_number
      const result = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id, 
          package_number, 
          barcode_id, 
          shop_name, 
          order_no, 
          hub, 
          storage_location,
          trip_number
        `)
        .eq('face_sheet_id', id)
        .not('trip_number', 'is', null)
        .neq('trip_number', '')
        .order('trip_number')
        .order('package_number');
      
      packages = result.data || [];
      pkgError = result.error;
    }

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: pkgError.message },
        { status: 500 }
      );
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ไม่พบแพ็คในใบปะหน้าของแถมนี้',
        no_mapped_packages: true
      }, { status: 400 });
    }

    // Get daily_trip_number from receiving_route_trips
    const tripNumbers = [...new Set(packages.map(p => p.trip_number).filter(Boolean))];
    
    // Parse trip_number format: {plan_code}-{trip_code}
    const tripCodeMap: Record<string, number | null> = {};
    
    for (const tripNumber of tripNumbers) {
      if (!tripNumber) continue;
      
      // Try to find the trip by trip_code
      const parts = tripNumber.split('-');
      if (parts.length >= 2) {
        const tripCode = parts.slice(1).join('-'); // Everything after first dash
        
        const { data: trip } = await supabase
          .from('receiving_route_trips')
          .select('daily_trip_number')
          .eq('trip_code', tripCode)
          .single();
        
        tripCodeMap[tripNumber] = trip?.daily_trip_number || null;
      }
    }

    // Group packages by trip_number (or 'UNASSIGNED' if no trip_number)
    const tripGroupsMap = new Map<string, {
      trip_number: string;
      daily_trip_number: number | null;
      destination_location: string;
      packages: any[];
    }>();

    for (const pkg of packages) {
      const tripNumber = pkg.trip_number && pkg.trip_number.trim() !== '' ? pkg.trip_number : 'UNASSIGNED';
      
      if (!tripGroupsMap.has(tripNumber)) {
        // Determine destination based on storage_location prefix
        // PQ* -> PQTD, MR* -> MRTD
        const destination = pkg.storage_location?.startsWith('PQ') ? 'PQTD' : 'MRTD';
        
        tripGroupsMap.set(tripNumber, {
          trip_number: tripNumber,
          daily_trip_number: tripCodeMap[tripNumber] || null,
          destination_location: destination,
          packages: []
        });
      }
      
      tripGroupsMap.get(tripNumber)!.packages.push({
        package_id: pkg.id,
        package_number: pkg.package_number,
        barcode_id: pkg.barcode_id,
        shop_name: pkg.shop_name,
        order_no: pkg.order_no,
        hub: pkg.hub,
        storage_location: pkg.storage_location,
        trip_number: pkg.trip_number
      });
    }

    // Convert to array and sort by trip_number
    const tripGroups = Array.from(tripGroupsMap.values())
      .sort((a, b) => {
        // Sort by daily_trip_number if available, otherwise by trip_number
        if (a.daily_trip_number && b.daily_trip_number) {
          return a.daily_trip_number - b.daily_trip_number;
        }
        return a.trip_number.localeCompare(b.trip_number);
      });

    return NextResponse.json({
      success: true,
      data: {
        face_sheet_no: faceSheet.face_sheet_no,
        created_date: faceSheet.created_date,
        total_packages: packages.length,
        status: faceSheet.status,
        loadlist_code: loadlistCode,
        trip_groups: tripGroups,
        // ✅ NEW: ข้อมูลร้านค้าจาก face sheet ที่แมพ
        mapped_face_sheet_id: mappedFaceSheetId,
        mapped_picklist_id: mappedPicklistId,
        face_sheet_orders: faceSheetOrders
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/pick-list:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
