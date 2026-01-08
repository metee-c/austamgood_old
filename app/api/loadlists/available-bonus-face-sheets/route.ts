import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/loadlists/available-bonus-face-sheets
 * ดึงรายการ Bonus Face Sheets ที่พร้อมสร้าง Loadlist (status = completed)
 * 
 * ✅ FIX: กรองเฉพาะ packages ที่มี trip_number (ถูกแมพเข้าสายรถแล้ว)
 * - แสดงจำนวน packages/items/orders เฉพาะที่มี trip_number
 * - แสดงจำนวน packages ที่ยังไม่แมพ (unmapped_packages)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');

    // Query bonus face sheets ที่ status = completed และยังไม่ได้อยู่ใน loadlist
    let query = supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        warehouse_id,
        total_packages,
        total_items,
        total_orders,
        delivery_date,
        created_at,
        updated_at,
        picking_completed_at
      `)
      .eq('status', 'completed')
      .order('picking_completed_at', { ascending: false });

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data: bonusFaceSheets, error } = await query;

    if (error) {
      console.error('Error fetching available bonus face sheets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available bonus face sheets', details: error.message },
        { status: 500 }
      );
    }

    // Filter out bonus face sheets ที่อยู่ใน loadlist แล้ว
    const { data: usedBonusFaceSheets } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id');

    const usedIds = new Set(usedBonusFaceSheets?.map(lbfs => lbfs.bonus_face_sheet_id) || []);
    const availableBonusFaceSheets = bonusFaceSheets?.filter(bfs => !usedIds.has(bfs.id)) || [];

    // ดึงข้อมูล trips (เลขคัน) สำหรับแต่ละ bonus face sheet
    const enrichedBonusFaceSheets = await Promise.all(
      availableBonusFaceSheets.map(async (bfs) => {
        // ✅ ดึง packages ทั้งหมดพร้อม trip_number
        const { data: packages } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, trip_number, order_id')
          .eq('face_sheet_id', bfs.id);

        // ✅ แยก packages ที่มี trip_number กับไม่มี
        const mappedPackages = packages?.filter(p => p.trip_number && p.trip_number.trim() !== '') || [];
        const unmappedPackages = packages?.filter(p => !p.trip_number || p.trip_number.trim() === '') || [];
        
        // ✅ นับจำนวน items เฉพาะจาก packages ที่มี trip_number
        const mappedPackageIds = mappedPackages.map(p => p.id);
        let mappedItemsCount = 0;
        let mappedOrdersCount = 0;
        
        if (mappedPackageIds.length > 0) {
          const { data: items } = await supabase
            .from('bonus_face_sheet_items')
            .select('id, quantity_to_pick')
            .in('package_id', mappedPackageIds);
          
          mappedItemsCount = items?.reduce((sum, item) => sum + (item.quantity_to_pick || 0), 0) || 0;
          mappedOrdersCount = new Set(mappedPackages.map(p => p.order_id)).size;
        }

        const uniqueTripNumbers = [...new Set(mappedPackages.map(p => p.trip_number).filter(Boolean))];

        // Map trip_number (format: RP-YYYYMMDD-XXX-TRIP-YYY) กลับไปหา daily_trip_number
        // trip_number = plan_code + '-' + trip_code
        // ต้อง query receiving_route_trips โดย match plan_code และ trip_code
        const tripInfos: Array<{ trip_number: string; daily_trip_number: number | null; vehicle_id: number | null; plate_number: string | null }> = [];

        for (const tripNumber of uniqueTripNumbers) {
          if (!tripNumber) continue;
          
          // Parse trip_number: RP-20260108-001-TRIP-001 -> plan_code=RP-20260108-001, trip_code=TRIP-001
          const parts = tripNumber.split('-TRIP-');
          if (parts.length === 2) {
            const planCode = parts[0]; // RP-20260108-001
            const tripCode = `TRIP-${parts[1]}`; // TRIP-001

            // Query receiving_route_trips
            const { data: tripData } = await supabase
              .from('receiving_route_trips')
              .select(`
                trip_id,
                daily_trip_number,
                vehicle_id,
                receiving_route_plans!inner (
                  plan_code
                )
              `)
              .eq('trip_code', tripCode)
              .eq('receiving_route_plans.plan_code', planCode)
              .single();

            if (tripData) {
              // Get vehicle plate number
              let plateNumber: string | null = null;
              if (tripData.vehicle_id) {
                const { data: vehicleData } = await supabase
                  .from('master_vehicle')
                  .select('plate_number')
                  .eq('vehicle_id', tripData.vehicle_id)
                  .single();
                plateNumber = vehicleData?.plate_number || null;
              }

              tripInfos.push({
                trip_number: tripNumber,
                daily_trip_number: tripData.daily_trip_number,
                vehicle_id: tripData.vehicle_id,
                plate_number: plateNumber
              });
            }
          }
        }

        // Sort by daily_trip_number
        tripInfos.sort((a, b) => (a.daily_trip_number || 0) - (b.daily_trip_number || 0));

        // สร้าง string แสดงเลขคัน เช่น "1, 4, 10, 11, 12, 13, 14"
        const dailyTripNumbers = tripInfos
          .map(t => t.daily_trip_number)
          .filter(n => n !== null);

        return {
          ...bfs,
          // ✅ แสดงจำนวนเฉพาะที่มี trip_number (พร้อมโหลด)
          mapped_packages: mappedPackages.length,
          mapped_items: mappedItemsCount,
          mapped_orders: mappedOrdersCount,
          // ✅ แสดงจำนวนที่ยังไม่แมพ (เตือนผู้ใช้)
          unmapped_packages: unmappedPackages.length,
          // ✅ ข้อมูล trips
          trip_infos: tripInfos,
          daily_trip_numbers: dailyTripNumbers,
          daily_trip_numbers_display: dailyTripNumbers.length > 0 
            ? dailyTripNumbers.join(', ') 
            : '-',
          // ✅ Flag บอกว่ามี packages ที่ยังไม่แมพหรือไม่
          has_unmapped_packages: unmappedPackages.length > 0,
          // ✅ ถ้าไม่มี packages ที่แมพเลย ให้ซ่อนจากรายการ
          is_ready_for_loadlist: mappedPackages.length > 0
        };
      })
    );

    // ✅ แยกใบปะหน้าเป็น 2 กลุ่ม:
    // 1. มี trip_number (พร้อมโหลดตามสายรถ)
    // 2. ไม่มี trip_number (ยังไม่ได้แมพสายรถ - เช่น ส่งฝ่ายการตลาด)
    const withTripNumber = enrichedBonusFaceSheets.filter(bfs => bfs.mapped_packages > 0);
    const withoutTripNumber = enrichedBonusFaceSheets.filter(bfs => bfs.mapped_packages === 0 && bfs.unmapped_packages > 0);

    // ✅ รวมทั้ง 2 กลุ่มเข้าด้วยกัน โดยเพิ่ม flag บอกประเภท
    const allAvailable = [
      ...withTripNumber.map(bfs => ({
        ...bfs,
        category: 'with_trip' as const,
        category_label: 'มีสายรถ'
      })),
      ...withoutTripNumber.map(bfs => ({
        ...bfs,
        // สำหรับใบปะหน้าที่ไม่มี trip_number ให้ใช้ข้อมูลจาก total ของ face sheet แทน
        mapped_packages: bfs.unmapped_packages, // แสดงจำนวน packages ทั้งหมด
        mapped_items: bfs.total_items || 0,
        mapped_orders: bfs.total_orders || 0,
        category: 'no_trip' as const,
        category_label: 'ไม่ระบุสายรถ',
        is_ready_for_loadlist: true // ให้สามารถสร้าง loadlist ได้
      }))
    ];

    return NextResponse.json({
      success: true,
      data: allAvailable,
      total: allAvailable.length,
      // ✅ ข้อมูลเพิ่มเติมสำหรับ debug
      with_trip_count: withTripNumber.length,
      without_trip_count: withoutTripNumber.length,
      total_available: enrichedBonusFaceSheets.length
    });

  } catch (error) {
    console.error('Error in available-bonus-face-sheets API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
