import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
import { executeStockMovements, StockMovement } from '@/lib/database/inventory-transaction';

/**
 * POST /api/receives/[id]/link-production-order
 * Links a production receive to a production order retroactively
 * and consumes materials from Repack location
 *
 * แก้ไข:
 * - ใช้ executeStockMovements แทน insert ledger ตรงๆ (match balance ที่ Repack ถูกต้อง)
 * - Fallback ไปใช้ BOM เมื่อไม่มี production_receipt (รองรับ PO ที่ยังไม่ได้บันทึกผลิตจริง)
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

    // 3. Check if this PO is already linked to this GR
    const existingRefs = receive.reference_doc
      ? receive.reference_doc.split(',').map((r: string) => r.trim())
      : [];

    if (existingRefs.includes(production_no.trim())) {
      return NextResponse.json(
        { error: `ใบสั่งผลิต ${production_no} ถูกเชื่อมโยงกับใบรับนี้แล้ว` },
        { status: 400 }
      );
    }

    // 4. Get receive items
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

    // 5. Get materials to consume - try production_receipt first, fallback to BOM
    let materialsToConsume: { material_sku_id: string; issued_qty: number; actual_qty: number; uom: string }[] = [];

    // 5a. Try production_receipt_materials
    const { data: productionReceipt } = await supabase
      .from('production_receipts')
      .select('id')
      .eq('production_order_id', productionOrder.id)
      .order('received_at', { ascending: false })
      .limit(1)
      .single();

    if (productionReceipt) {
      const { data: materials } = await supabase
        .from('production_receipt_materials')
        .select('material_sku_id, issued_qty, actual_qty, uom')
        .eq('receipt_id', productionReceipt.id);

      if (materials && materials.length > 0) {
        materialsToConsume = materials;
      }
    }

    // 5b. Merge BOM materials — เสริมวัสดุที่ไม่มีใน production_receipt (เช่น ถุง/สติ๊กเกอร์)
    const { data: bomData } = await supabase
      .from('bom_sku')
      .select('material_sku_id, material_qty, uom')
      .eq('finished_sku_id', productionOrder.sku_id)
      .eq('status', 'active');

    if (bomData && bomData.length > 0) {
      const poQty = parseFloat(productionOrder.quantity) || 0;
      const existingSkuIds = new Set(materialsToConsume.map(m => m.material_sku_id));

      // เพิ่มเฉพาะ BOM materials ที่ยังไม่มีใน production_receipt
      const missingFromReceipt = bomData.filter((bom: any) => !existingSkuIds.has(bom.material_sku_id));

      if (missingFromReceipt.length > 0) {
        const bomMaterials = missingFromReceipt.map((bom: any) => {
          const materialQty = (parseFloat(bom.material_qty) || 0) * poQty;
          return {
            material_sku_id: bom.material_sku_id,
            issued_qty: materialQty,
            actual_qty: materialQty,
            uom: bom.uom || 'ชิ้น'
          };
        });
        materialsToConsume = [...materialsToConsume, ...bomMaterials];
        console.log(`[link-production-order] BOM supplement: added ${missingFromReceipt.length} materials not in receipt (${missingFromReceipt.map((b: any) => b.material_sku_id).join(', ')}), PO qty=${poQty}`);
      }

      if (materialsToConsume.length === 0) {
        // ไม่มี receipt เลย ใช้ BOM ทั้งหมด
        materialsToConsume = bomData.map((bom: any) => {
          const materialQty = (parseFloat(bom.material_qty) || 0) * poQty;
          return {
            material_sku_id: bom.material_sku_id,
            issued_qty: materialQty,
            actual_qty: materialQty,
            uom: bom.uom || 'ชิ้น'
          };
        });
        console.log(`[link-production-order] BOM full fallback: ${materialsToConsume.length} materials, PO qty=${poQty}`);
      }
    }

    // 6. Update receive items with production_order_id (only items without production_order_id)
    const unlinkedItems = receiveItems.filter(item => !item.production_order_id);
    if (unlinkedItems.length > 0) {
      const { error: updateItemsError } = await supabase
        .from('wms_receive_items')
        .update({ production_order_id: productionOrder.id })
        .eq('receive_id', receiveId)
        .is('production_order_id', null);

      if (updateItemsError) {
        console.error('Error updating receive items:', updateItemsError);
      }
    }

    // 7. Update receive header - append PO to reference_doc (comma-separated)
    const newReferenceDoc = existingRefs.length > 0
      ? [...existingRefs, production_no.trim()].join(', ')
      : production_no.trim();

    const { error: updateReceiveError } = await supabase
      .from('wms_receives')
      .update({ reference_doc: newReferenceDoc })
      .eq('receive_id', receiveId);

    if (updateReceiveError) {
      console.error('Error updating receive:', updateReceiveError);
    }

    // 8. Consume materials from Repack using executeStockMovements (atomic balance update)
    const repackLocation = 'Repack';
    const consumedMaterials: any[] = [];
    let materialSource = 'none';
    let movementResult: any = null;
    const diagnostics: any = {
      has_production_receipt: !!productionReceipt,
      materials_count: materialsToConsume.length,
      materials_skus: materialsToConsume.map(m => m.material_sku_id),
      repack_balances_found: 0,
      movements_created: 0
    };

    if (materialsToConsume.length > 0) {
      materialSource = productionReceipt ? 'production_receipt' : 'bom_fallback';

      // Get qty_per_pack for each material
      const materialSkuIds = materialsToConsume.map(m => m.material_sku_id);
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('sku_id, qty_per_pack')
        .in('sku_id', materialSkuIds);

      const skuQtyPerPackMap = new Map<string, number>();
      if (skuData) {
        skuData.forEach((sku: any) => {
          skuQtyPerPackMap.set(sku.sku_id, sku.qty_per_pack || 1);
        });
      }

      // Query actual balances at Repack — ใช้ total_piece_qty (ไม่หัก reserved)
      // เพราะ stock ที่ Repack ถูก replenish มาเพื่อการผลิตโดยเฉพาะ
      const { data: repackBalances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, sku_id, pallet_id, production_date, expiry_date, lot_no, total_piece_qty, reserved_piece_qty')
        .eq('location_id', repackLocation)
        .eq('warehouse_id', receive.warehouse_id)
        .in('sku_id', materialSkuIds)
        .gt('total_piece_qty', 0)
        .order('expiry_date', { ascending: true }); // FEFO

      diagnostics.repack_balances_found = repackBalances?.length || 0;
      diagnostics.repack_balances = (repackBalances || []).map((b: any) => ({
        sku_id: b.sku_id, pallet_id: b.pallet_id, total: b.total_piece_qty, reserved: b.reserved_piece_qty
      }));

      // Group balances by sku_id
      const balancesBySku: Record<string, any[]> = {};
      if (repackBalances) {
        repackBalances.forEach((b: any) => {
          if (!balancesBySku[b.sku_id]) balancesBySku[b.sku_id] = [];
          balancesBySku[b.sku_id].push(b);
        });
      }

      const movements: StockMovement[] = [];

      for (const material of materialsToConsume) {
        const isFood = material.material_sku_id.startsWith('00-');
        // ใช้ actual_qty ก่อน ถ้าเป็น 0 ให้ fallback เป็น issued_qty
        const qtyToConsume = Number(material.actual_qty) || Number(material.issued_qty) || 0;

        if (qtyToConsume <= 0) continue;

        const qtyPerPack = skuQtyPerPackMap.get(material.material_sku_id) || 1;

        // Find matching balance at Repack (FEFO order)
        const availableBalances = balancesBySku[material.material_sku_id] || [];
        let remainingQty = qtyToConsume;

        if (availableBalances.length > 0) {
          // Consume from actual balance records (with correct pallet_id)
          // ใช้ total_piece_qty ไม่หัก reserved เพราะเป็น production consume
          for (const balance of availableBalances) {
            if (remainingQty <= 0) break;

            const totalQty = parseFloat(balance.total_piece_qty) || 0;
            if (totalQty <= 0) continue;

            const consumeFromThis = Math.min(remainingQty, totalQty);
            const packQty = qtyPerPack > 0 ? Math.floor(consumeFromThis / qtyPerPack) : 0;

            movements.push({
              direction: 'out',
              warehouse_id: receive.warehouse_id,
              location_id: repackLocation,
              sku_id: material.material_sku_id,
              pallet_id: balance.pallet_id || null,
              production_date: balance.production_date || null,
              expiry_date: balance.expiry_date || null,
              lot_no: balance.lot_no || null,
              pack_qty: packQty,
              piece_qty: consumeFromThis,
              transaction_type: 'production_consume',
              reference_doc_type: 'production_order',
              reference_no: `PROD-${production_no}`,
              created_by: 1,
              remarks: isFood
                ? `ตัดวัตถุดิบอาหาร (ย้อนหลัง) สำหรับการผลิต ${production_no}`
                : `ตัดวัสดุบรรจุภัณฑ์ (ย้อนหลัง) สำหรับการผลิต ${production_no}`
            });

            remainingQty -= consumeFromThis;
          }
        }

        // ถ้ายังเหลือ qty ที่ไม่มี balance → log แต่ไม่สร้าง movement (จะ error)
        if (remainingQty > 0) {
          console.warn(`[link-production-order] SKU ${material.material_sku_id}: remaining ${remainingQty} has no balance at Repack`);
        }

        consumedMaterials.push({
          sku_id: material.material_sku_id,
          qty: qtyToConsume,
          consumed: qtyToConsume - remainingQty,
          no_balance: remainingQty,
          type: isFood ? 'food' : 'packaging'
        });
      }

      diagnostics.movements_created = movements.length;

      // Execute all movements atomically
      if (movements.length > 0) {
        const result = await executeStockMovements(movements);
        movementResult = result;
        if (!result.success) {
          console.error(`[link-production-order] Failed to execute movements for ${production_no}:`, result.error);
        } else {
          console.log(`[link-production-order] Consumed ${movements.length} material movements for ${production_no}`);
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
        consumed_materials: consumedMaterials,
        material_source: materialSource,
        movement_result: movementResult,
        diagnostics
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
