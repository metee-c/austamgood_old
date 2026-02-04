import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
const supabase = await createClient();
  
  try {
    const { updates } = await request.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid updates array' },
        { status: 400 }
      );
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      const { item_id, new_sku_id } = update;

      if (!item_id || !new_sku_id) {
        results.push({
          item_id,
          success: false,
          error: 'Missing item_id or new_sku_id'
        });
        errorCount++;
        continue;
      }

      // Validate that new_sku_id exists in master_sku (by sku_id or barcode)
      const { data: skuById } = await supabase
        .from('master_sku')
        .select('sku_id, sku_name, barcode')
        .eq('sku_id', new_sku_id)
        .single();

      let validSkuId = null;
      let validSkuName = null;

      if (skuById) {
        validSkuId = skuById.sku_id;
        validSkuName = skuById.sku_name;
      } else {
        // Try by barcode
        const { data: skuByBarcode } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name, barcode')
          .eq('barcode', new_sku_id)
          .single();

        if (skuByBarcode) {
          validSkuId = skuByBarcode.sku_id;
          validSkuName = skuByBarcode.sku_name;
        }
      }

      if (!validSkuId) {
        results.push({
          item_id,
          new_sku_id,
          success: false,
          error: `SKU "${new_sku_id}" ไม่พบใน Master SKU`
        });
        errorCount++;
        continue;
      }

      // Update the online_picklist_item
      const { error: updateError } = await supabase
        .from('online_picklist_items')
        .update({
          sku_id: validSkuId,
          sku_name: validSkuName,
          updated_at: new Date().toISOString()
        })
        .eq('id', item_id);

      if (updateError) {
        results.push({
          item_id,
          new_sku_id,
          success: false,
          error: updateError.message
        });
        errorCount++;
      } else {
        results.push({
          item_id,
          old_sku_id: update.old_sku_id,
          new_sku_id: validSkuId,
          new_sku_name: validSkuName,
          success: true
        });
        successCount++;
      }
    }

    return NextResponse.json({
      success: errorCount === 0,
      total: updates.length,
      success_count: successCount,
      error_count: errorCount,
      results
    });

  } catch (error: any) {
    console.error('Error updating SKUs:', error);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
