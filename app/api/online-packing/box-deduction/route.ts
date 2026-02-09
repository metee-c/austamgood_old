import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { executeStockMovements, StockMovement } from '@/lib/database/inventory-transaction'

export const dynamic = 'force-dynamic'

/**
 * POST /api/online-packing/box-deduction
 * ตัดสต็อกกล่อง - ใช้ inventory-transaction service เพื่อบันทึก ledger + balance
 *
 * ใช้ OUT movement เพียงอย่างเดียว (consumption pattern)
 * - สร้าง OUT ledger entry ที่ E-Commerce location
 * - ลดยอด wms_inventory_balances
 * - สร้าง wms_moves + wms_move_items สำหรับ audit trail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, reason, notes, user_id, user_name } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุรายการที่ต้องการตัดสต็อก' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลการตัดสต็อก' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Get E-Commerce location
    const { data: ecomLocations, error: locError } = await supabase
      .from('master_location')
      .select('location_id, warehouse_id')
      .eq('zone', 'Zone E-Commerce')
      .eq('active_status', 'active')
      .limit(1)

    if (locError || !ecomLocations || ecomLocations.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Location ใน Zone E-Commerce' }, { status: 404 })
    }

    const ecomLocation = ecomLocations[0]
    const results: Array<{ sku_id: string; quantity: number; success: boolean; error?: string }> = []

    for (const item of items) {
      const { sku_id, quantity } = item
      if (!sku_id || !quantity || quantity <= 0) continue

      // Get balance records for this SKU at E-Commerce (FIFO - oldest first)
      const { data: balances, error: balError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', sku_id)
        .eq('location_id', ecomLocation.location_id)
        .gt('total_piece_qty', 0)
        .order('created_at', { ascending: true })

      if (balError || !balances || balances.length === 0) {
        results.push({ sku_id, quantity, success: false, error: 'ไม่พบสต็อกสำหรับ SKU นี้' })
        continue
      }

      // Generate BOX reference number
      const today = new Date()
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
      const { count: todayCount } = await supabase
        .from('wms_moves')
        .select('*', { count: 'exact', head: true })
        .like('move_no', `BOX-${dateStr}-%`)
      const seqNum = String((todayCount || 0) + 1).padStart(3, '0')
      const moveNo = `BOX-${dateStr}-${seqNum}`

      const remarksText = `ตัดสต็อกกล่อง - ${reason}${notes ? ` | ${notes}` : ''}`

      // Create move record for audit trail
      const { data: moveData, error: moveError } = await supabase
        .from('wms_moves')
        .insert({
          move_no: moveNo,
          move_type: 'issue',
          from_warehouse_id: ecomLocation.warehouse_id,
          status: 'completed',
          notes: `${remarksText} | ตัดโดย: ${user_name || 'ไม่ระบุ'} | เวลา: ${today.toLocaleString('th-TH')}`,
          created_by: user_id || null,
          completed_at: today.toISOString()
        })
        .select()
        .single()

      if (moveError) {
        results.push({ sku_id, quantity, success: false, error: `สร้างรายการเคลื่อนย้ายไม่สำเร็จ: ${moveError.message}` })
        continue
      }

      // Deduct from balances using FIFO (oldest first)
      let remainingQty = quantity
      const movements: StockMovement[] = []

      for (const balance of balances) {
        if (remainingQty <= 0) break

        const available = Number(balance.total_piece_qty || 0) - Number(balance.reserved_piece_qty || 0)
        if (available <= 0) continue

        const deductQty = Math.min(remainingQty, available)
        const qtyPerPack = Number(balance.qty_per_pack || 0)

        // Create move item for audit trail
        await supabase
          .from('wms_move_items')
          .insert({
            move_id: moveData.move_id,
            from_location_id: ecomLocation.location_id,
            to_location_id: 'Delivery-In-Progress',
            sku_id,
            pallet_id: balance.pallet_id || null,
            pallet_id_external: balance.pallet_id_external || null,
            production_date: balance.production_date || null,
            expiry_date: balance.expiry_date || null,
            requested_pack_qty: 0,
            requested_piece_qty: deductQty,
            confirmed_pack_qty: 0,
            confirmed_piece_qty: deductQty,
            status: 'completed'
          })

        // Build dual-entry movements for inventory ledger + balance
        // OUT from E-Commerce
        movements.push({
          direction: 'out',
          warehouse_id: ecomLocation.warehouse_id,
          location_id: ecomLocation.location_id,
          sku_id,
          pallet_id: balance.pallet_id || null,
          pallet_id_external: balance.pallet_id_external || null,
          production_date: balance.production_date || null,
          expiry_date: balance.expiry_date || null,
          lot_no: balance.lot_no || null,
          pack_qty: qtyPerPack > 0 ? Math.floor(deductQty / qtyPerPack) : 0,
          piece_qty: deductQty,
          transaction_type: 'box_deduction',
          reference_no: moveNo,
          reference_doc_type: 'box_deduction',
          reference_doc_id: moveData.move_id,
          move_item_id: null,
          created_by: user_id || null,
          remarks: remarksText,
        })
        // IN to Delivery-In-Progress
        movements.push({
          direction: 'in',
          warehouse_id: ecomLocation.warehouse_id,
          location_id: 'Delivery-In-Progress',
          sku_id,
          pallet_id: balance.pallet_id || null,
          pallet_id_external: balance.pallet_id_external || null,
          production_date: balance.production_date || null,
          expiry_date: balance.expiry_date || null,
          lot_no: balance.lot_no || null,
          pack_qty: qtyPerPack > 0 ? Math.floor(deductQty / qtyPerPack) : 0,
          piece_qty: deductQty,
          transaction_type: 'box_deduction',
          reference_no: moveNo,
          reference_doc_type: 'box_deduction',
          reference_doc_id: moveData.move_id,
          move_item_id: null,
          created_by: user_id || null,
          remarks: remarksText,
        })

        remainingQty -= deductQty
      }

      if (remainingQty > 0) {
        results.push({ sku_id, quantity, success: false, error: `สต็อกไม่เพียงพอ ตัดได้ ${quantity - remainingQty} จาก ${quantity}` })
        continue
      }

      // Execute all movements atomically (ledger + balance)
      const moveResult = await executeStockMovements(movements)

      if (!moveResult.success) {
        console.error(`[box-deduction] executeStockMovements failed for ${sku_id}:`, moveResult.error)
        results.push({ sku_id, quantity, success: false, error: `บันทึก ledger ไม่สำเร็จ: ${moveResult.error}` })
      } else {
        results.push({ sku_id, quantity, success: true })
      }
    }

    const allOk = results.every(r => r.success)
    return NextResponse.json({
      success: allOk,
      results,
      message: allOk ? 'ตัดสต็อกกล่องเรียบร้อยแล้ว' : 'ตัดสต็อกบางรายการไม่สำเร็จ'
    })

  } catch (error: any) {
    console.error('[box-deduction] Error:', error)
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
