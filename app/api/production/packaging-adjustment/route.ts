/**
 * Packaging Adjustment API Route
 * API สำหรับสร้าง Stock Adjustment สำหรับวัสดุบรรจุภัณฑ์ (ถุง, สติ๊กเกอร์)
 * ที่รับจริงแตกต่างจากที่เติมมา (BOM)
 * 
 * Logic:
 * - bom_qty = จำนวนที่เติมมาจาก replenishment (ตาม BOM)
 * - actual_qty = จำนวนที่รับจริง/นับได้จริง
 * - variance = bom_qty - actual_qty (จำนวนที่หายไป)
 * 
 * กรณี:
 * - รับจริงน้อยกว่าที่เติมมา (actual < bom): สินค้าหายไป → decrease adjustment
 * - รับจริงมากกว่าที่เติมมา (actual > bom): มีเกินมา → increase adjustment (คืน stock)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
// Constants
const PRODUCTION_VARIANCE_REASON_ID = 40; // reason_code = 'PRODUCTION_VARIANCE'
const DEFAULT_WAREHOUSE_ID = 'WH001';
const REPACK_LOCATION = 'Repack';

interface PackagingAdjustmentItem {
  sku_id: string;
  sku_name: string;
  bom_qty: number;
  actual_qty: number;
  variance_qty: number;
  uom: string;
}

async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    const body = await request.json();

    // ใช้ user_id สำหรับ stock adjustment
    const systemUserId = context.user?.user_id;
    
    // Validate systemUserId
    if (!systemUserId || typeof systemUserId !== 'number') {
      console.error('Invalid systemUserId from session:', systemUserId);
      return NextResponse.json(
        { error: 'Invalid user session - missing user_id' },
        { status: 401 }
      );
    }

    const {
      production_no,
      receipt_id,
      items // Array of PackagingAdjustmentItem
    } = body;

    // Validate required fields
    if (!production_no || !receipt_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: production_no, receipt_id, items' },
        { status: 400 }
      );
    }

    console.log('=== Packaging Adjustment Request ===', {
      production_no,
      receipt_id,
      items_count: items.length,
      user_id: systemUserId
    });

    // แยก items ตาม variance type
    // variance_qty ที่ส่งมา = actual_qty - bom_qty
    // ถ้า variance_qty < 0 หมายความว่า actual < bom → สินค้าหายไป → decrease
    // ถ้า variance_qty > 0 หมายความว่า actual > bom → มีเกินมา → increase (คืน stock)
    const increaseItems: PackagingAdjustmentItem[] = []; // actual > bom → มีเกินมา → คืน stock
    const decreaseItems: PackagingAdjustmentItem[] = []; // actual < bom → สินค้าหายไป → ตัด stock

    items.forEach((item: PackagingAdjustmentItem) => {
      if (item.variance_qty > 0) {
        // actual > bom → มีเกินมา → คืน stock (increase)
        increaseItems.push(item);
      } else if (item.variance_qty < 0) {
        // actual < bom → สินค้าหายไป → ตัด stock (decrease)
        decreaseItems.push(item);
      }
    });

    console.log('=== Variance Analysis ===', {
      increase_items: increaseItems.length,
      decrease_items: decreaseItems.length
    });

    // ดึง location จาก replenishment_queue สำหรับ packaging materials
    const skuIds = items.map((item: PackagingAdjustmentItem) => item.sku_id);
    const { data: replData } = await supabase
      .from('replenishment_queue')
      .select('sku_id, pallet_id, from_location_id')
      .eq('trigger_source', 'production_order')
      .eq('trigger_reference', production_no)
      .in('sku_id', skuIds)
      .eq('status', 'completed');

    // สร้าง map ของ location data
    const locationMap = new Map<string, { pallet_id: string | null; from_location_id: string | null }>();
    if (replData) {
      replData.forEach(r => {
        locationMap.set(r.sku_id, { pallet_id: r.pallet_id, from_location_id: r.from_location_id });
      });
    }

    const result: { increase?: any; decrease?: any } = {};

    // สร้าง increase adjustment สำหรับ items ที่ actual > bom (มีเกินมา → คืน stock)
    if (increaseItems.length > 0) {
      const increasePayload = {
        adjustment_type: 'increase' as const,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        reason_id: PRODUCTION_VARIANCE_REASON_ID,
        reference_no: `PKG-${production_no}`,
        remarks: `คืน stock วัสดุบรรจุภัณฑ์จากการผลิต ${production_no} - รับจริงมากกว่าที่เติมมา (Receipt: ${receipt_id})`,
        created_by: systemUserId,
        items: increaseItems.map(item => {
          const locData = locationMap.get(item.sku_id);
          return {
            sku_id: item.sku_id,
            location_id: locData?.from_location_id || REPACK_LOCATION,
            pallet_id: locData?.pallet_id || null,
            adjustment_piece_qty: Math.abs(item.variance_qty), // positive for increase
            remarks: `คืนจากการผลิต - รับจริงมากกว่าที่เติมมา ${Math.abs(item.variance_qty)} ${item.uom} (${item.sku_name})`
          };
        })
      };

      console.log('=== Increase Adjustment Payload ===', JSON.stringify(increasePayload, null, 2));

      const { data: increaseAdj, error: increaseError } = await stockAdjustmentService.createAdjustment(increasePayload);
      if (increaseError) {
        console.error('Error creating increase adjustment:', increaseError);
        return NextResponse.json(
          { error: `Failed to create increase adjustment: ${increaseError}` },
          { status: 500 }
        );
      } else if (increaseAdj) {
        // Submit for approval
        await stockAdjustmentService.submitForApproval(increaseAdj.adjustment_id, systemUserId);
        result.increase = {
          adjustment_id: increaseAdj.adjustment_id,
          adjustment_no: increaseAdj.adjustment_no,
          items_count: increaseItems.length
        };
      }
    }

    // สร้าง decrease adjustment สำหรับ items ที่ actual < bom (สินค้าหายไป → ตัด stock)
    if (decreaseItems.length > 0) {
      const decreasePayload = {
        adjustment_type: 'decrease' as const,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        reason_id: PRODUCTION_VARIANCE_REASON_ID,
        reference_no: `PKG-${production_no}`,
        remarks: `ตัด stock วัสดุบรรจุภัณฑ์จากการผลิต ${production_no} - สินค้าหายไป/เสียหาย (Receipt: ${receipt_id})`,
        created_by: systemUserId,
        items: decreaseItems.map(item => {
          const locData = locationMap.get(item.sku_id);
          return {
            sku_id: item.sku_id,
            location_id: locData?.from_location_id || REPACK_LOCATION,
            pallet_id: locData?.pallet_id || null,
            adjustment_piece_qty: -Math.abs(item.variance_qty), // negative for decrease
            remarks: `สินค้าหายไป/เสียหายจากการผลิต - ${Math.abs(item.variance_qty)} ${item.uom} (${item.sku_name})`
          };
        })
      };

      console.log('=== Decrease Adjustment Payload ===', JSON.stringify(decreasePayload, null, 2));

      const { data: decreaseAdj, error: decreaseError } = await stockAdjustmentService.createAdjustment(decreasePayload);
      if (decreaseError) {
        console.error('Error creating decrease adjustment:', decreaseError);
        return NextResponse.json(
          { error: `Failed to create decrease adjustment: ${decreaseError}` },
          { status: 500 }
        );
      } else if (decreaseAdj) {
        // Submit for approval
        await stockAdjustmentService.submitForApproval(decreaseAdj.adjustment_id, systemUserId);
        result.decrease = {
          adjustment_id: decreaseAdj.adjustment_id,
          adjustment_no: decreaseAdj.adjustment_no,
          items_count: decreaseItems.length
        };
      }
    }

    // สร้าง response message
    let adjustmentNo = '';
    let totalItems = 0;
    
    if (result.increase) {
      adjustmentNo = result.increase.adjustment_no;
      totalItems += result.increase.items_count;
    }
    if (result.decrease) {
      if (adjustmentNo) {
        adjustmentNo += `, ${result.decrease.adjustment_no}`;
      } else {
        adjustmentNo = result.decrease.adjustment_no;
      }
      totalItems += result.decrease.items_count;
    }

    return NextResponse.json({
      success: true,
      message: 'สร้างใบปรับสต็อกวัสดุบรรจุภัณฑ์สำเร็จ',
      adjustment_no: adjustmentNo,
      total_items: totalItems,
      adjustments: result
    });

  } catch (error: any) {
    console.error('Error in POST /api/production/packaging-adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(withAuth(handlePost));
