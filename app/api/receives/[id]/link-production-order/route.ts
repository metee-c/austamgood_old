import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/receives/[id]/link-production-order
 * Links a production receive to a production order retroactively
 * and consumes materials from Repack location
 */
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
const supabase = createServiceRoleClient();
  const { id } = await params;
  const receiveId = parseInt(id);

  if (isNaN(receiveId)) {
    return NextResponse.json({ error: 'Invalid receive ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { production_no } = body;

    if (!production_no || typeof production_no !== 'string') {
      return NextResponse.json(
        { error: 'กรุณาระบุเลขใบสั่งผลิต (production_no)' },
        { status: 400 }
      );
    }

    // 1. Verify the receive exists and is a production type
    const { data: receive, error: receiveError } = await supabase
      .from('wms_receives')
      .select('receive_id, receive_no, receive_type, status, warehouse_id, reference_doc')
      .eq('receive_id', receiveId)
      .single();

    if (receiveError || !receive) {
      return NextResponse.json(
        { error: 'ไม่พบใบรับสินค้า' },
        { status: 404 }
      );
    }

    if (receive.receive_type !== 'การผลิต') {
      return NextResponse.json(
        { error: 'ใบรับนี้ไม่ใช่ประเภทการผลิต' },
        { status: 400 }
      );
    }

    // 2. Find the production order by production_no
    const { data: productionOrder, error: poError } = await supabase
      .from('production_orders')
      .select('id, production_no, sku_id, quantity, status')
      .eq('production_no', production_no.trim())
      .single();

    if (poError || !productionOrder) {
      return NextResponse.json(
        { error: `ไม่พบใบสั่งผลิตเลขที่ ${production_no}` },
        { status: 404 }
      );
    }

    // 3. Get receive items that don't have production_order_id yet
    const { data: receiveItems, error: itemsError } = await supabase
      .from('wms_receive_items')
      .select('item_id, sku_id, piece_quantity, production_order_id')
      .eq('receive_id', receiveId);

    if (itemsError || !receiveItems || receiveItems.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบรายการสินค้าในใบรับ' },
        { status: 404 }
      );
    }

    // Check if already linked
    const alreadyLinked = receiveItems.some(item => item.production_order_id);
    if (alreadyLinked) {
      return NextResponse.json(
        { error: 'ใบรับนี้เชื่อมโยงกับใบสั่งผลิตแล้ว' },
        { status: 400 }
      );
    }

    // 4. Get the production receipt for this production order (to get materials info)
    const { data: productionReceipt, error: receiptError } = await supabase
      .from('production_receipts')
      .select('id')
      .eq('production_order_id', productionOrder.id)
      .order('received_at', { ascending: false })
      .limit(1)
      .single();

    let materialsToConsume: any[] = [];

    if (productionReceipt) {
      // Get materials from production_receipt_materials
      const { data: materials, error: materialsError } = await supabase
        .from('production_receipt_materials')
        .select(`
          material_sku_id,
          issued_qty,
          actual_qty,
          uom
        `)
        .eq('receipt_id', productionReceipt.id);

      if (!materialsError && materials) {
        materialsToConsume = materials;
      }
    }

    // 5. Update receive items with production_order_id
    const { error: updateItemsError } = await supabase
      .from('wms_receive_items')
      .update({ production_order_id: productionOrder.id })
      .eq('receive_id', receiveId);

    if (updateItemsError) {
      console.error('Error updating receive items:', updateItemsError);
      return NextResponse.json(
        { error: 'ไม่สามารถอัพเดทรายการสินค้าได้' },
        { status: 500 }
      );
    }

    // 6. Update receive header with reference_doc
    const { error: updateReceiveError } = await supabase
      .from('wms_receives')
      .update({ reference_doc: production_no.trim() })
      .eq('receive_id', receiveId);

    if (updateReceiveError) {
      console.error('Error updating receive:', updateReceiveError);
    }

    // 7. Consume materials from Repack (create OUT ledger entries)
    const repackLocation = 'Repack';
    const consumedMaterials: any[] = [];

    if (materialsToConsume.length > 0) {
      // Get qty_per_pack for each material
      const materialSkuIds = materialsToConsume.map(m => m.material_sku_id);
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('sku_id, qty_per_pack')
        .in('sku_id', materialSkuIds);

      const skuQtyPerPackMap = new Map<string, number>();
      if (skuData) {
        skuData.forEach(sku => {
          skuQtyPerPackMap.set(sku.sku_id, sku.qty_per_pack || 1);
        });
      }

      for (const material of materialsToConsume) {
        // Determine quantity to consume:
        // Food materials (00-): use actual_qty
        // Packaging: use issued_qty
        const isFood = material.material_sku_id.startsWith('00-');
        const qtyToConsume = isFood
          ? (material.actual_qty || 0)
          : (material.issued_qty || 0);

        if (qtyToConsume <= 0) continue;

        const qtyPerPack = skuQtyPerPackMap.get(material.material_sku_id) || 1;
        const packQty = qtyPerPack > 0 ? Math.floor(qtyToConsume / qtyPerPack) : 0;

        // Create OUT ledger entry
        const { error: ledgerError } = await supabase
          .from('wms_inventory_ledger')
          .insert({
            transaction_type: 'production_consume',
            warehouse_id: receive.warehouse_id,
            location_id: repackLocation,
            sku_id: material.material_sku_id,
            pallet_id: null,
            pack_qty: packQty,
            piece_qty: qtyToConsume,
            direction: 'out',
            movement_at: new Date().toISOString(),
            reference_doc_type: 'production_order',
            reference_no: `PROD-${production_no}`,
            created_by: 1, // System user
            remarks: isFood
              ? `ตัดวัตถุดิบอาหาร (ย้อนหลัง) สำหรับการผลิต ${production_no}`
              : `ตัดวัสดุบรรจุภัณฑ์ (ย้อนหลัง) สำหรับการผลิต ${production_no}`
          });

        if (ledgerError) {
          console.error('Error creating ledger entry:', ledgerError);
        } else {
          consumedMaterials.push({
            sku_id: material.material_sku_id,
            qty: qtyToConsume,
            type: isFood ? 'food' : 'packaging'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `เชื่อมโยงใบรับ ${receive.receive_no} กับใบสั่งผลิต ${production_no} สำเร็จ`,
      data: {
        receive_id: receiveId,
        receive_no: receive.receive_no,
        production_order_id: productionOrder.id,
        production_no: production_no,
        items_updated: receiveItems.length,
        materials_consumed: consumedMaterials.length,
        consumed_materials: consumedMaterials
      }
    });

  } catch (error: any) {
    console.error('Error linking production order:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมโยงใบสั่งผลิต' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
