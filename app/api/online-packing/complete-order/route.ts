import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

/**
 * POST /api/online-packing/complete-order
 * Move stock from E-Commerce to Dispatch when order packing is complete
 * 
 * ✅ รองรับ 5+ เครื่องสแกนพร้อมกัน:
 * - ใช้ atomic_online_pack_stock_move RPC function
 * - Row-level locking ป้องกัน race condition
 * - Idempotency key ป้องกัน process ซ้ำ
 */
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { order_number, tracking_number, platform, items } = body;
    
    if (!order_number || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'order_number and items are required' },
        { status: 400 }
      );
    }

    // Get idempotency key from header or generate from order_number
    const idempotencyKey = request.headers.get('X-Idempotency-Key') || `pack_${order_number}_${tracking_number}`;
    
    // Check idempotency - ป้องกัน process ซ้ำ
    const { data: idempotencyCheck } = await supabase.rpc('check_idempotency', {
      p_idempotency_key: idempotencyKey,
      p_api_endpoint: 'online-packing/complete-order'
    });
    
    if (idempotencyCheck?.[0]?.is_duplicate) {
      console.log(`⚠️ Duplicate request detected for order ${order_number}`);
      return NextResponse.json({
        ...idempotencyCheck[0].previous_response,
        is_duplicate: true
      }, { status: idempotencyCheck[0].previous_status || 200 });
    }

    // Get user_id from session for created_by (FK references master_system_user.user_id)
    const sessionResult = await getCurrentSession();
    const userId = sessionResult.session?.user_id || null;
    
    // Prepare items for atomic function
    const itemsJson = items.map((item: any) => ({
      sku_id: item.sku_id,
      quantity: item.quantity
    }));

    // ✅ ใช้ atomic function ที่มี row-level locking
    const { data: result, error: rpcError } = await supabase.rpc('atomic_online_pack_stock_move', {
      p_order_number: order_number,
      p_tracking_number: tracking_number,
      p_platform: platform || 'Unknown',
      p_items: itemsJson,
      p_user_id: userId
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      
      // Save failed result for idempotency
      await supabase.rpc('save_idempotency_result', {
        p_idempotency_key: idempotencyKey,
        p_api_endpoint: 'online-packing/complete-order',
        p_request_hash: null,
        p_response_status: 500,
        p_response_body: { error: rpcError.message }
      });
      
      return NextResponse.json(
        { error: rpcError.message },
        { status: 500 }
      );
    }

    const atomicResult = result?.[0] || result;
    
    const response = {
      success: atomicResult?.success ?? true,
      message: atomicResult?.message || `Moved items from E-Commerce to Dispatch`,
      items_moved: atomicResult?.items_moved || items.length,
      negative_balance_items: atomicResult?.negative_balance_items || 0,
      order_number,
      tracking_number,
      results: atomicResult?.results || []
    };

    // Save successful result for idempotency
    await supabase.rpc('save_idempotency_result', {
      p_idempotency_key: idempotencyKey,
      p_api_endpoint: 'online-packing/complete-order',
      p_request_hash: null,
      p_response_status: 200,
      p_response_body: response
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error in POST /api/online-packing/complete-order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
