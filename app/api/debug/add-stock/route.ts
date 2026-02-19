import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create client with explicit env vars
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/debug/add-stock
 * 
 * เติมสต็อกลมโดยตรงสำหรับ LD-20260219-0015
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const loadlistCode = body.code || 'LD-20260219-0015';

    console.log(`Adding stock for ${loadlistCode}`);

    // รายการ SKU ที่ขาดจาก log ก่อนหน้า
    const neededStock = [
      { sku_id: 'B-BEY-C|TUN|010', qty: 36 },
      { sku_id: 'B-NEC-D|LSD-S|012', qty: 12 },
      { sku_id: 'B-NEC-D|LSD-L|012', qty: 12 },
      { sku_id: 'B-NEC-D|LHEJ|012', qty: 12 },
      { sku_id: 'B-BEY-D|SAL|100', qty: 6 },
      { sku_id: 'B-BEY-D|LAM|100', qty: 10 },
      { sku_id: 'B-BEY-C|LAM|010', qty: 84 },
      { sku_id: 'B-NET-D|SAL-L|100', qty: 2 },
      { sku_id: 'B-NET-D|CHI-S|025', qty: 6 },
      { sku_id: 'B-NET-D|LAM|100', qty: 6 },
      { sku_id: 'B-NET-D|CHI-L|100', qty: 2 },
      { sku_id: 'B-NEC-D|LSD-S|030', qty: 4 },
      { sku_id: 'B-NEC-D|LSD-L|030', qty: 4 },
      { sku_id: 'B-NEC-D|LHEJ|030', qty: 4 },
      { sku_id: 'B-NEC-D|LSD-S|080', qty: 2 },
      { sku_id: 'B-NEC-D|LSD-L|100', qty: 2 },
      { sku_id: 'B-NEC-D|LHEJ|100', qty: 2 },
    ];

    const results = [];
    const errors = [];

    for (const item of neededStock) {
      try {
        // สร้างสต็อกใหม่โดยตรง (upsert)
        const { data, error } = await supabase
          .from('wms_inventory_balances')
          .upsert({
            warehouse_id: 'WH001',
            location_id: 3, // E-Commerce location_id
            sku_id: item.sku_id,
            pallet_id: `DUMMY-${item.sku_id}`,
            total_piece_qty: item.qty,
            total_pack_qty: item.qty,
            reserved_piece_qty: 0,
            reserved_pack_qty: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'warehouse_id,location_id,sku_id,pallet_id'
          })
          .select();

        if (error) {
          errors.push({ sku_id: item.sku_id, error: error.message });
        } else {
          results.push({ sku_id: item.sku_id, qty: item.qty, status: 'added' });
        }
      } catch (err: any) {
        errors.push({ sku_id: item.sku_id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${neededStock.length} SKUs`,
      added: results.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack 
    }, { status: 500 });
  }
}
