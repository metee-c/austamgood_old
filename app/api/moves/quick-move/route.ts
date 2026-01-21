import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

    // Get session token from cookie
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized - No session token' },
        { status: 401 }
      )
    }

    // Get user and employee_id from session token (without timeout check)
    // Use explicit FK name to avoid ambiguity
    const { data: sessionData, error: sessionError } = await supabase
      .from('user_sessions')
      .select(`
        user_id,
        master_system_user!user_sessions_user_id_fkey(employee_id)
      `)
      .eq('token', sessionToken)
      .eq('invalidated', false)
      .single()

    if (sessionError || !sessionData) {
      console.error('Session lookup error:', sessionError)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const employeeId = (sessionData.master_system_user as any)?.employee_id

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Unauthorized - No employee linked to user' },
        { status: 401 }
      )
    }

    // Update last_activity_at
    await supabase
      .from('user_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('token', sessionToken)

    let balanceRecords: any[] = []
    let from_location_id: string | null = null

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
    }

    // Use first record for SKU validation
    const balanceData = balanceRecords[0]

    // Validate picking home if not force move
    if (!force_move) {
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('default_location')
        .eq('sku_id', balanceData.sku_id)
        .single()

      if (skuData && skuData.default_location && skuData.default_location !== to_location_id) {
        return NextResponse.json(
          {
            error: `ตำแหน่งปลายทาง ${to_location_id} ไม่ใช่บ้านหยิบของ SKU นี้ (${skuData.default_location})`,
            canForceMove: true
          },
          { status: 400 }
        )
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
      executed_by: employeeId,
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
