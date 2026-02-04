// API Route for Checking Stock Availability
// POST: Check if stock adjustment is possible

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
export const dynamic = 'force-dynamic';

// POST: Check stock availability for adjustment
export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();

    // Check authentication from session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token');
    
    if (!sessionToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session
    const { data: sessionData, error: sessionError } = await supabase.rpc('validate_session_token', {
      p_token: sessionToken.value
    });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { warehouse_id, location_id, sku_id, pallet_id, adjustment_piece_qty } = body;

    // Validate required fields
    if (!warehouse_id || !location_id || !sku_id || adjustment_piece_qty === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For increase adjustments, always allow
    if (adjustment_piece_qty >= 0) {
      return NextResponse.json({
        can_adjust: true,
        available_qty: null,
        message: 'Increase adjustment is always allowed',
      });
    }

    // For decrease adjustments, check available quantity
    let query = supabase
      .from('wms_inventory_balances')
      .select('total_piece_qty, reserved_piece_qty')
      .eq('warehouse_id', warehouse_id)
      .eq('location_id', location_id)
      .eq('sku_id', sku_id);

    if (pallet_id) {
      query = query.eq('pallet_id', pallet_id);
    } else {
      query = query.is('pallet_id', null);
    }

    const { data: balances, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No balance found
        return NextResponse.json({
          can_adjust: false,
          available_qty: 0,
          error_message: 'ไม่พบสต็อกในโลเคชั่นนี้',
        });
      }
      console.error('Error checking availability:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const availableQty = parseFloat(balances.total_piece_qty) - parseFloat(balances.reserved_piece_qty);
    const requestedDecrease = Math.abs(adjustment_piece_qty);

    if (availableQty < requestedDecrease) {
      return NextResponse.json({
        can_adjust: false,
        available_qty: availableQty,
        error_message: `สต็อกไม่เพียงพอ (มีอยู่ ${availableQty} ชิ้น, ต้องการลด ${requestedDecrease} ชิ้น)`,
      });
    }

    return NextResponse.json({
      can_adjust: true,
      available_qty: availableQty,
      message: 'สามารถลดสต็อกได้',
    });
  } catch (error: any) {
    console.error('Error checking stock availability:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
