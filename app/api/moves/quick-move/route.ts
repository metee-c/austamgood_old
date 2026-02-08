import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentUserFromCookie } from '@/lib/auth/simple-auth'
import { receiveService } from '@/lib/database/receive'
import { apiLog } from '@/lib/logging'
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _POST(request: NextRequest) {
  const txId = await apiLog.start('MOVE', request)
  
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
      from_location_id: client_from_location_id = null, // ✅ รับ from_location_id จาก client เพื่อระบุต้นทางที่ถูกต้อง
      notes,
      force_move = false,
      partial_quantities = null // { [sku_id]: qty } - สำหรับย้ายบางส่วน
    } = body

    const isPartialMove = partial_quantities && Object.keys(partial_quantities).length > 0

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
    
    // ✅ Use user_id (not employee_id) - FK points to master_system_user.user_id
    let userId = parseInt(String(userResult.user.user_id), 10)

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid user ID' },
        { status: 401 }
      )
    }

    // ✅ Verify user exists in database (in case of old/invalid JWT token)
    const { data: userExists } = await supabase
      .from('master_system_user')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!userExists) {
      console.warn(`User ID ${userId} from JWT not found in database, using system user (8)`)
      userId = 8 // Fallback to system user
    }

    let balanceRecords: any[] = []
    let from_location_id: string | null = null
    let warehouse_id: string = 'WH001' // Default warehouse

    // Get balance info
    if (pallet_id) {
      // ✅ FIX: Always query ALL balances for this pallet first
      const { data: allBalances, error: allBalancesError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('pallet_id', pallet_id)
        .gt('total_piece_qty', 0) // Only balances with stock

      if (allBalancesError) {
        console.error('Pallet query error:', allBalancesError)
        return NextResponse.json(
          { error: `เกิดข้อผิดพลาดในการค้นหา Pallet: ${allBalancesError.message}` },
          { status: 500 }
        )
      }

      if (!allBalances || allBalances.length === 0) {
        return NextResponse.json(
          { error: `ไม่พบข้อมูล Pallet ID: ${pallet_id} หรือไม่มีสต็อกคงเหลือ` },
          { status: 404 }
        )
      }

      // ✅ FIX: If client provided from_location_id, validate it exists in actual balances
      if (client_from_location_id) {
        const matchingBalances = allBalances.filter(b => b.location_id === client_from_location_id)
        if (matchingBalances.length === 0) {
          // Client sent wrong from_location - show available locations
          const availableLocations = allBalances.map(b => b.location_id).join(', ')
          return NextResponse.json(
            { error: `Pallet ${pallet_id} ไม่อยู่ที่ตำแหน่ง ${client_from_location_id} อยู่ที่: ${availableLocations}` },
            { status: 400 }
          )
        }
        balanceRecords = matchingBalances
        from_location_id = client_from_location_id
      } else {
        // No from_location specified - if pallet at multiple locations, require user to specify
        if (allBalances.length > 1) {
          const locations = allBalances.map(b => `${b.location_id} (${b.total_piece_qty} ชิ้น)`).join(', ')
          return NextResponse.json(
            { error: `Pallet ${pallet_id} อยู่หลายตำแหน่ง: ${locations} กรุณาเลือกตำแหน่งต้นทาง`, requireSourceLocation: true, locations: allBalances.map(b => ({ location_id: b.location_id, qty: b.total_piece_qty })) },
            { status: 400 }
          )
        }
        balanceRecords = allBalances
        from_location_id = allBalances[0].location_id
      }

      warehouse_id = balanceRecords[0].warehouse_id || 'WH001' // Get warehouse from balance
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

    // ✅ Generate move_no using database function (correct format: TRF-202601-0001)
    const { data: move_no, error: moveNoError } = await supabaseAdmin.rpc('generate_move_no', {
      p_move_type: 'transfer',
      p_pallet_id: pallet_id || null
    })

    if (moveNoError || !move_no) {
      console.error('Move number generation error:', moveNoError)
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างเลขที่เอกสารได้: ' + (moveNoError?.message || 'Unknown error') },
        { status: 500 }
      )
    }

    // Insert move with generated move_no
    const { data: move, error: moveError } = await supabase
      .from('wms_moves')
      .insert({
        move_no,
        move_type: 'transfer',
        status: 'completed',
        from_warehouse_id: warehouse_id,
        notes: notes || 'Quick move from misplaced inventory',
        created_by: userId, // ✅ Use user_id
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (moveError) {
      console.error('Move insert error:', moveError)
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างรายการย้ายได้: ' + moveError.message },
        { status: 500 }
      )
    }

    // Insert move items for all balance records
    console.log('DEBUG: move.move_id =', move.move_id, 'type:', typeof move.move_id)
    console.log('DEBUG: isPartialMove =', isPartialMove, 'partial_quantities =', partial_quantities)
    
    // ✅ FIX: ตรวจสอบว่าย้ายทั้งหมดหรือบางส่วนจริงๆ
    // ถ้า partial_quantities เท่ากับ total_piece_qty ของทุก SKU = ย้ายทั้งหมด ไม่ใช่ partial move
    let isActualPartialMove = isPartialMove
    if (isPartialMove && partial_quantities) {
      const allFullMove = balanceRecords.every(balance => {
        const requestedQty = partial_quantities[balance.sku_id]
        const totalQty = Number(balance.total_piece_qty) || 0
        // ถ้าไม่ได้ระบุจำนวน หรือ จำนวนเท่ากับ total = ย้ายทั้งหมด
        return requestedQty === undefined || requestedQty >= totalQty
      })
      if (allFullMove) {
        isActualPartialMove = false
        console.log('DEBUG: Detected full move (partial_quantities equals total), treating as regular move')
      }
    }
    
    // สำหรับ partial move ต้องสร้าง pallet_id ใหม่ในรูปแบบ ORIGINAL-01, -02, ...
    let newPalletId: string | null = null
    if (isActualPartialMove && pallet_id) {
      // Generate split pallet ID based on parent pallet ID for traceability
      const { data: generatedPalletId, error: palletIdError } = await receiveService.generateSplitPalletId(pallet_id)
      if (!palletIdError && generatedPalletId) {
        newPalletId = generatedPalletId
        console.log('DEBUG: Generated split pallet ID for partial move:', newPalletId, 'from parent:', pallet_id)
      } else {
        console.error('Failed to generate split pallet ID:', palletIdError)
      }
    }
    
    const moveItems = balanceRecords.map(balance => {
      // ถ้าเป็น partial move ให้ใช้จำนวนที่ระบุ
      const moveQty = isActualPartialMove && partial_quantities[balance.sku_id] !== undefined
        ? partial_quantities[balance.sku_id]
        : balance.total_piece_qty || 0
      
      // ถ้าเป็น partial move ให้ใช้ new_pallet_id และเก็บ parent_pallet_id
      const usePalletId = isActualPartialMove && newPalletId ? newPalletId : balance.pallet_id
      const parentPalletId = isActualPartialMove && newPalletId ? balance.pallet_id : null
      
      return {
        move_id: move.move_id,
        sku_id: balance.sku_id,
        ...(usePalletId ? { pallet_id: usePalletId } : {}),
        ...(parentPalletId ? { parent_pallet_id: parentPalletId } : {}),
        ...(newPalletId ? { new_pallet_id: newPalletId } : {}),
        move_method: balance.pallet_id ? 'pallet' : 'individual',
        status: 'completed',
        from_location_id,
        to_location_id,
        requested_pack_qty: balance.total_pack_qty || 0,
        requested_piece_qty: moveQty,
        confirmed_pack_qty: balance.total_pack_qty || 0,
        confirmed_piece_qty: moveQty,
        production_date: balance.production_date,
        expiry_date: balance.expiry_date,
        created_by: userId,
        executed_by: userId,
        completed_at: new Date().toISOString()
      }
    })

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

    // Backend-driven inventory: สร้าง movements จาก moveItems โดยตรง
    const { executeStockMovements } = await import('@/lib/database/inventory-transaction');
    const movements: any[] = [];

    for (const item of moveItems) {
      const outPalletId = (item as any).parent_pallet_id || item.pallet_id;
      const inPalletId = item.pallet_id;
      const balance = balanceRecords.find(b => b.sku_id === item.sku_id);

      if (item.from_location_id) {
        movements.push({
          direction: 'out',
          warehouse_id: warehouse_id,
          location_id: item.from_location_id,
          sku_id: item.sku_id,
          pallet_id: outPalletId,
          pallet_id_external: balance?.pallet_id_external || null,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          lot_no: balance?.lot_no || null,
          pack_qty: item.confirmed_pack_qty || 0,
          piece_qty: item.confirmed_piece_qty || 0,
          transaction_type: 'move',
          reference_no: move_no,
          reference_doc_type: 'move',
          created_by: userId,
        });
      }

      if (item.to_location_id) {
        movements.push({
          direction: 'in',
          warehouse_id: warehouse_id,
          location_id: item.to_location_id,
          sku_id: item.sku_id,
          pallet_id: inPalletId,
          pallet_id_external: balance?.pallet_id_external || null,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          lot_no: balance?.lot_no || null,
          pack_qty: item.confirmed_pack_qty || 0,
          piece_qty: item.confirmed_piece_qty || 0,
          transaction_type: 'move',
          reference_no: move_no,
          reference_doc_type: 'move',
          created_by: userId,
        });
      }
    }

    if (movements.length > 0) {
      const invResult = await executeStockMovements(movements);
      if (!invResult.success) {
        console.error('[quick-move] Failed to record inventory:', invResult.error);
      }
    }

    apiLog.success(txId, 'STOCK_QUICK_MOVE', {
      entityType: 'MOVE',
      entityId: move?.move_id?.toString(),
      entityNo: move?.move_no,
    })
    
    return NextResponse.json({
      success: true,
      data: move,
      message: 'ย้ายสินค้าสำเร็จ'
    })
  } catch (error: any) {
    console.error('Quick move error:', error)
    apiLog.failure(txId, 'STOCK_QUICK_MOVE', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการย้ายสินค้า' },
      { status: 500 }
    )
  }
}

export const POST = withShadowLog(_POST);
