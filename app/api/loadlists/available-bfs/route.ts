import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/loadlists/available-bfs
 * ดึงรายการ Bonus Face Sheets ที่พร้อมสร้าง Loadlist
 * 
 * Query Parameters:
 * - mode: 'unmapped' | 'mapped' (default: 'mapped')
 *   - unmapped: ดึง BFS ที่ยังไม่ได้สร้าง loadlist (ไม่ต้องแมพกับ picklist)
 *   - mapped: ดึง BFS ที่แมพกับ picklist ที่เลือก (behavior เดิม)
 * - picklist_id: (required for mode=mapped) ID ของ picklist ที่ต้องการแมพ
 * - warehouse_id: (optional) กรองตาม warehouse
 */
async function handleGet(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const mode = searchParams.get('mode') || 'mapped';
    const picklistId = searchParams.get('picklist_id');
    const warehouseId = searchParams.get('warehouse_id');

    if (mode === 'unmapped') {
      // =====================================================
      // โหมดไม่แมพ: ดึง BFS ที่ยังมี packages ไม่ได้อยู่ใน loadlist
      // =====================================================
      
      // 1. ดึง BFS ที่ status = completed หรือ picking (ยังมี packages เหลือ)
      // ✅ FIX (edit29): รองรับ BFS ที่ status = 'picking' ด้วย เพราะหลัง stock reconciliation 
      //    BFS ที่ยังมี packages เหลือจะถูกเปลี่ยนเป็น status = 'picking'
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
        .in('status', ['completed', 'picking'])
        .order('picking_completed_at', { ascending: false, nullsFirst: false });

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }

      const { data: bonusFaceSheets, error } = await query;

      if (error) {
        console.error('[available-bfs] Error fetching BFS:', error);
        return NextResponse.json(
          { error: 'Failed to fetch bonus face sheets', details: error.message },
          { status: 500 }
        );
      }

      const bfsIds = bonusFaceSheets?.map(bfs => bfs.id) || [];
      
      if (bfsIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          mode: 'unmapped',
          total: 0
        });
      }

      // 2. ดึง matched_package_ids ที่ถูกใช้แล้วจากทุก loadlist
      const { data: usedMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('bonus_face_sheet_id, matched_package_ids')
        .not('matched_package_ids', 'is', null);

      const usedPackagesByBFS = new Map<number, Set<number>>();
      usedMappings?.forEach(mapping => {
        const bfsId = mapping.bonus_face_sheet_id;
        const packageIds = mapping.matched_package_ids || [];
        
        if (!usedPackagesByBFS.has(bfsId)) {
          usedPackagesByBFS.set(bfsId, new Set());
        }
        packageIds.forEach((id: number) => usedPackagesByBFS.get(bfsId)!.add(id));
      });

      // 3. ดึง packages ที่ยังมี storage_location (ยังไม่ได้โหลด)
      // ✅ FIX: ใช้ loop เพื่อดึง packages ทุก row (Supabase default limit = 1000)
      let allPackages: { id: number; face_sheet_id: number; trip_number: string | null; order_id: number; storage_location: string | null }[] = [];
      const BATCH_SIZE = 1000;
      for (let offset = 0; ; offset += BATCH_SIZE) {
        const { data: batch } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, face_sheet_id, trip_number, order_id, storage_location')
          .in('face_sheet_id', bfsIds)
          .not('storage_location', 'is', null)
          .range(offset, offset + BATCH_SIZE - 1);
        if (!batch || batch.length === 0) break;
        allPackages = allPackages.concat(batch);
        if (batch.length < BATCH_SIZE) break;
      }

      // 4. กรอง packages ที่ยังไม่ถูกแมพ
      const availablePackagesByBFS = new Map<number, typeof allPackages>();
      
      for (const pkg of allPackages) {
        const usedPackages = usedPackagesByBFS.get(pkg.face_sheet_id);
        const isUsed = usedPackages && usedPackages.has(pkg.id);
        
        if (!isUsed) {
          const existing = availablePackagesByBFS.get(pkg.face_sheet_id) || [];
          existing.push(pkg);
          availablePackagesByBFS.set(pkg.face_sheet_id, existing);
        }
      }

      // 5. สร้างผลลัพธ์ - เฉพาะ BFS ที่ยังมี packages ที่ยังไม่ถูกแมพ
      const availableBfs = bonusFaceSheets
        ?.filter(bfs => {
          const packages = availablePackagesByBFS.get(bfs.id);
          return packages && packages.length > 0;
        })
        .map(bfs => {
          const packages = availablePackagesByBFS.get(bfs.id) || [];
          const usedCount = usedPackagesByBFS.get(bfs.id)?.size || 0;
          
          return {
            ...bfs,
            unmapped_packages: packages.length,
            total_available_packages: packages.length,
            original_total_packages: bfs.total_packages,
            used_packages: usedCount,
            available_package_ids: packages.map(p => p.id)
          };
        }) || [];

      console.log(`[available-bfs] Mode: unmapped, Found ${availableBfs.length} BFS with available packages`);

      return NextResponse.json({
        success: true,
        data: availableBfs,
        mode: 'unmapped',
        total: availableBfs.length
      });

    } else {
      // =====================================================
      // โหมดแมพ (เหมือนเดิม): ดึง BFS ที่แมพกับ picklist
      // =====================================================
      
      if (!picklistId) {
        return NextResponse.json({
          success: true,
          data: [],
          mode: 'mapped',
          message: 'กรุณาเลือก Picklist ก่อน'
        });
      }

      // ใช้ API เดิม available-bonus-face-sheets
      // แต่กรองเฉพาะที่แมพกับ picklist นี้
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/loadlists/available-bonus-face-sheets?warehouse_id=${warehouseId || ''}`,
        { headers: request.headers }
      );
      
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch available bonus face sheets' },
          { status: 500 }
        );
      }

      const result = await response.json();
      
      // TODO: Filter by picklist matching logic if needed
      // For now, return all available BFS
      return NextResponse.json({
        success: true,
        data: result.data || [],
        mode: 'mapped',
        picklist_id: picklistId
      });
    }

  } catch (err: any) {
    console.error('[available-bfs] Error:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(withAuth(handleGet));
