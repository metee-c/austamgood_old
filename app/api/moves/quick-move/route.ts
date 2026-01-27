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
    
    const moveItems = balanceRecords.map(balance => {
      // ถ้าเป็น partial move ให้ใช้จำนวนที่ระบุ
      const moveQty = isPartialMove && partial_quantities[balance.sku_id] !== undefined
        ? partial_quantities[balance.sku_id]
        : balance.total_piece_qty || 0
      
      return {
        move_id: move.move_id,
        sku_id: balance.sku_id,
        ...(balance.pallet_id ? { pallet_id: balance.pallet_id } : {}),
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

    // ✅ ไม่ต้อง UPDATE balance location โดยตรง
    // ให้ trigger sync_inventory_ledger_to_balance จัดการเอง
    // Trigger จะ:
    // 1. ลบ balance ที่ from_location (OUT entry)
    // 2. เพิ่ม balance ที่ to_location (IN entry)
    // 
    // หมายเหตุ: Balance จะถูกจัดการโดย trigger อัตโนมัติ
    // ไม่ต้องทำอะไรเพิ่มเติมที่นี่

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
