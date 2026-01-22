import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentUserFromCookie } from '@/lib/auth/simple-auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    // Create admin client to bypass RLS for generating move numbers
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    const body = await request.json()

    const {
      pallet_id,
      balance_id,
      to_location_id,
      notes,
      force_move = false
    } = body

    // Validate input
    if (!pallet_id && !balance_id) {
      return NextResponse.json(
        { error: 'ต้องระบุ pallet_id หรือ balance_id' },
        { status: 400 }
      )
    }

    if (!to_location_id) {
      return NextResponse.json(
        { error: 'ต้องระบุ to_location_id' },
        { status: 400 }
      )
    }

    // Get current user from JWT token
    const userResult = await getCurrentUserFromCookie();
    
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const employeeId = userResult.user.employee_id

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Unauthorized - No employee linked to user' },
        { status: 401 }
      )
    }

    let balanceRecords: any[] = []
    let from_location_id: string | null = null
    let warehouse_id: string = 'WH001' // Default warehouse

    // Get balance info
    if (pallet_id) {
      const { data, error } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('pallet_id', pallet_id)

      if (error) {
        console.error('Pallet query error:', error)
        return NextResponse.json(
          { error: `เกิดข้อผิดพลาดในการค้นหา Pallet: ${error.message}` },
          { status: 500 }
        )
      }

      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: `ไม่พบข้อมูล Pallet ID: ${pallet_id}` },
          { status: 404 }
        )
      }

      balanceRecords = data
      from_location_id = data[0].location_id
      warehouse_id = data[0].warehouse_id || 'WH001' // Get warehouse from balance
    } else if (balance_id) {
      const { data, error } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('balance_id', balance_id)
        .maybeSingle()

      if (error) {
        console.error('Balance query error:', error)
        return NextResponse.json(
          { error: `เกิดข้อผิดพลาดในการค้นหา Balance: ${error.message}` },
          { status: 500 }
        )
      }

      if (!data) {
        return NextResponse.json(
          { error: `ไม่พบข้อมูล Balance ID: ${balance_id}` },
          { status: 404 }
        )
      }

      balanceRecords = [data]
      from_location_id = data.location_id
      warehouse_id = data.warehouse_id || 'WH001' // Get warehouse from balance
    }

    // Use first record for SKU validation
    if (!force_move) {
      const { data: destinationLocation } = await supabaseAdmin
        .from('master_location')
        .select('location_id, location_code')
        .eq('location_id', to_location_id)
        .maybeSingle()

      const destinationLocationCode = destinationLocation?.location_code || to_location_id

      const { data: destPrepArea } = await supabaseAdmin
        .from('preparation_area')
        .select('area_id, area_code, area_name')
        .eq('area_code', destinationLocationCode)
        .maybeSingle()

      if (destPrepArea) {
        const { data: skuMappings } = await supabaseAdmin
          .from('sku_preparation_area_mapping')
          .select('sku_id, priority, is_primary')
          .eq('preparation_area_id', destPrepArea.area_id)
          .order('priority', { ascending: true })

        let allowedSkus: string[] = (skuMappings || []).map((m: any) => m.sku_id)

        if (allowedSkus.length === 0) {
          const { data: skusByDefault } = await supabaseAdmin
            .from('master_sku')
            .select('sku_id')
            .eq('default_location', destinationLocationCode)

          allowedSkus = (skusByDefault || []).map((s: any) => s.sku_id)
        }

        const uniqueSkus = [...new Set(balanceRecords.map(b => b.sku_id).filter(Boolean))]

        for (const skuId of uniqueSkus) {
          const { data: skuHomeMappings } = await supabaseAdmin
            .from('sku_preparation_area_mapping')
            .select(`
              sku_id,
              priority,
              is_primary,
              preparation_area:preparation_area_id (
                area_code,
                area_name
              )
            `)
            .eq('sku_id', skuId)
            .order('is_primary', { ascending: false })
            .order('priority', { ascending: true })

          const allValidHomes = (skuHomeMappings || []).map((m: any) => {
            const prepArea = Array.isArray(m.preparation_area) ? m.preparation_area[0] : m.preparation_area;
            return prepArea?.area_code;
          }).filter(Boolean);

          const primaryMapping = skuHomeMappings?.find((m: any) => m.is_primary);
          const prepArea = primaryMapping?.preparation_area as any;
          const mappedHomeName = prepArea?.area_name;

          let designatedHomeCode: string | null = allValidHomes.length > 0 ? allValidHomes[0] : null

          if (!designatedHomeCode) {
            const { data: skuData } = await supabaseAdmin
              .from('master_sku')
              .select('default_location')
              .eq('sku_id', skuId)
              .maybeSingle()

            designatedHomeCode = skuData?.default_location || null
          }

          if (allValidHomes.length > 0 && !allValidHomes.includes(destinationLocationCode)) {
            return NextResponse.json(
              {
                error: `ตำแหน่งปลายทาง ${destinationLocationCode} ไม่ใช่บ้านหยิบของ SKU นี้ (${allValidHomes.join(', ')}${mappedHomeName ? ` - ${mappedHomeName}` : ''})`,
                canForceMove: true
              },
              { status: 400 }
            )
          }

          if (!designatedHomeCode && allowedSkus.length > 0 && !allowedSkus.includes(skuId)) {
            return NextResponse.json(
              {
                error: `ตำแหน่งปลายทาง ${destinationLocationCode} เป็นบ้านหยิบของสินค้าอื่น ไม่รองรับ SKU ${skuId}`,
                canForceMove: true
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // Generate move_no and Insert with Retry logic
    let move
    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries) {
      // Find latest move_no (re-query each time using Admin)
      const { data: lastMove } = await supabaseAdmin
        .from('wms_moves')
        .select('move_no')
        .order('move_no', { ascending: false }) // Sort by move_no to be sure
        .limit(1)
        .maybeSingle()

      let nextNumber = 1
      if (lastMove?.move_no) {
        const match = lastMove.move_no.match(/MV(\d+)/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }

      // If retrying, skip numbers to avoid collision loop if the latest hasn't updated yet in read replica
      const currentNumber = nextNumber + retryCount
      const move_no = `MV${String(currentNumber).padStart(10, '0')}`

      // Try Insert
      const { data: insertedMove, error: moveError } = await supabase
        .from('wms_moves')
        .insert({
          move_no,
          move_type: 'transfer',
          status: 'completed',
          from_warehouse_id: warehouse_id,
          notes: notes || 'Quick move from misplaced inventory',
          created_by: employeeId,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (moveError) {
        // Check for unique key violation (Postgres code 23505)
        if (moveError.code === '23505') {
          console.warn(`Duplicate move_no ${move_no}, retrying... (${retryCount + 1}/${maxRetries})`)
          retryCount++
          // Wait a tiny bit (backoff)
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }

        // Real Error
        console.error('Move insert error:', moveError)
        return NextResponse.json(
          { error: 'ไม่สามารถสร้างรายการย้ายได้: ' + moveError.message },
          { status: 500 }
        )
      }

      // Success
      move = insertedMove
      break
    }

    if (!move) {
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      )
    }

    // Insert move items for all balance records
    const moveItems = balanceRecords.map(balance => ({
      move_id: move.move_id,
      sku_id: balance.sku_id,
      ...(balance.pallet_id ? { pallet_id: balance.pallet_id } : {}),
      move_method: balance.pallet_id ? 'pallet' : 'individual',
      status: 'completed',
      from_location_id,
      to_location_id,
      requested_pack_qty: balance.total_pack_qty || 0,
      requested_piece_qty: balance.total_piece_qty || 0,
      confirmed_pack_qty: balance.total_pack_qty || 0,
      confirmed_piece_qty: balance.total_piece_qty || 0,
      production_date: balance.production_date,
      expiry_date: balance.expiry_date,
      created_by: employeeId,
      ...(employeeId ? { executed_by: employeeId } : {}),
      completed_at: new Date().toISOString()
    }))

    const { error: moveItemError } = await supabase
      .from('wms_move_items')
      .insert(moveItems)

    if (moveItemError) {
      console.error('Move item insert error:', moveItemError)
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างรายการย้ายได้: ' + moveItemError.message },
        { status: 500 }
      )
    }

    // Update inventory balance location for all records
    // Handle duplicate key by trying update first, then merge if conflict
    // Unique constraint v2: warehouse_id, location_id, sku_id, pallet_id, pallet_id_external, lot_no, production_date, expiry_date
    for (const balance of balanceRecords) {
      // First attempt: Try to update location directly
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({ location_id: to_location_id })
        .eq('balance_id', balance.balance_id)

      // If duplicate key error, find the conflicting balance and merge
      if (updateError && updateError.code === '23505') {
        console.log('Duplicate key detected, finding matching balance to merge...')

        // Find all balances at destination with same SKU and pallet
        // We need to match the exact constraint which uses COALESCE
        const { data: candidates } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, pallet_id, pallet_id_external, lot_no, production_date, expiry_date')
          .eq('warehouse_id', balance.warehouse_id)
          .eq('location_id', to_location_id)
          .eq('sku_id', balance.sku_id)
          .neq('balance_id', balance.balance_id)

        // Find the one that matches with COALESCE logic
        const existingBalance = candidates?.find(c => {
          const palletMatch = (c.pallet_id || '') === (balance.pallet_id || '')
          const palletExtMatch = (c.pallet_id_external || '') === (balance.pallet_id_external || '')
          const lotMatch = (c.lot_no || '') === (balance.lot_no || '')

          // For dates, both null or both equal
          const prodDateMatch = (c.production_date === balance.production_date) ||
            (!c.production_date && !balance.production_date)
          const expDateMatch = (c.expiry_date === balance.expiry_date) ||
            (!c.expiry_date && !balance.expiry_date)

          return palletMatch && palletExtMatch && lotMatch && prodDateMatch && expDateMatch
        })

        if (existingBalance) {
          // Merge: Add qty to existing balance
          const newPieceQty = (existingBalance.total_piece_qty || 0) + (balance.total_piece_qty || 0)
          const newPackQty = (existingBalance.total_pack_qty || 0) + (balance.total_pack_qty || 0)

          const { error: mergeError } = await supabase
            .from('wms_inventory_balances')
            .update({
              total_piece_qty: newPieceQty,
              total_pack_qty: newPackQty,
              updated_at: new Date().toISOString()
            })
            .eq('balance_id', existingBalance.balance_id)

          if (mergeError) {
            console.error('Balance merge error:', mergeError)
            return NextResponse.json(
              { error: 'ไม่สามารถรวม balance ได้: ' + mergeError.message },
              { status: 500 }
            )
          }

          // Update any face_sheet_item_reservations that reference the source balance
          // to point to the merged balance instead
          await supabase
            .from('face_sheet_item_reservations')
            .update({ balance_id: existingBalance.balance_id })
            .eq('balance_id', balance.balance_id)

          // Also update bonus_face_sheet_item_reservations if exists
          await supabase
            .from('bonus_face_sheet_item_reservations')
            .update({ balance_id: existingBalance.balance_id })
            .eq('balance_id', balance.balance_id)

          // Also update picklist_item_reservations if exists
          await supabase
            .from('picklist_item_reservations')
            .update({ balance_id: existingBalance.balance_id })
            .eq('balance_id', balance.balance_id)

          // Delete source balance
          const { error: deleteError } = await supabase
            .from('wms_inventory_balances')
            .delete()
            .eq('balance_id', balance.balance_id)

          if (deleteError) {
            console.error('Balance delete error:', deleteError)
            // If still can't delete due to other FK constraints, just set qty to 0
            if (deleteError.code === '23503') {
              console.log('Cannot delete balance due to FK constraint, setting qty to 0 instead')
              await supabase
                .from('wms_inventory_balances')
                .update({
                  total_piece_qty: 0,
                  total_pack_qty: 0,
                  updated_at: new Date().toISOString()
                })
                .eq('balance_id', balance.balance_id)
            } else {
              return NextResponse.json(
                { error: 'ไม่สามารถลบ balance ต้นทางได้: ' + deleteError.message },
                { status: 500 }
              )
            }
          }

          console.log(`Merged balance ${balance.balance_id} into ${existingBalance.balance_id}`)
        } else {
          // Couldn't find matching balance - this shouldn't happen
          console.error('Duplicate key but no matching balance found:', updateError.details)
          return NextResponse.json(
            { error: 'เกิดข้อผิดพลาด: พบ duplicate key แต่ไม่พบ balance ที่ตรงกัน' },
            { status: 500 }
          )
        }
      } else if (updateError) {
        // Other error
        console.error('Balance update error:', updateError)
        return NextResponse.json(
          { error: 'ไม่สามารถอัปเดตตำแหน่งได้: ' + updateError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: move,
      message: 'ย้ายสินค้าสำเร็จ'
    })
  } catch (error: any) {
    console.error('Quick move error:', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการย้ายสินค้า' },
      { status: 500 }
    )
  }
}
