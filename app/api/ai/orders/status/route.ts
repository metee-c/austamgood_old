/**
 * AI API: Order Status Query
 * GET /api/ai/orders/status
 * 
 * ดึงข้อมูลสถานะออเดอร์สำหรับ AI Assistant
 * READ-ONLY, SAFE for AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AIOrderStatusParams {
  order_code?: string;
  order_id?: number;
  customer_code?: string;
  order_type?: 'express' | 'special' | 'general';
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AIOrderItem {
  sku_id: string;
  sku_name: string;
  order_qty: number;
  picked_qty: number;
  shipped_qty: number;
  unit_price: number;
}

export interface AIOrderStatus {
  order_id: number;
  order_no: string;
  order_type: string;
  status: string;
  status_thai: string;
  customer_id: string;
  customer_name: string;
  shop_name: string | null;
  province: string | null;
  order_date: string;
  delivery_date: string | null;
  total_amount: number;
  total_items: number;
  total_qty: number;
  picked_qty: number;
  shipped_qty: number;
  pick_progress_percent: number;
  ship_progress_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: AIOrderItem[];
}

export interface AIOrderStatusResponse {
  success: boolean;
  data: AIOrderStatus[];
  summary: {
    total_orders: number;
    by_status: Record<string, number>;
    total_amount: number;
    avg_pick_progress: number;
  };
  query_params: AIOrderStatusParams;
  timestamp: string;
  error?: string;
}

// Status translation map
const STATUS_THAI: Record<string, string> = {
  draft: 'ร่าง',
  confirmed: 'ยืนยันแล้ว',
  in_picking: 'กำลังจัดสินค้า',
  picked: 'จัดสินค้าเสร็จ',
  loaded: 'โหลดขึ้นรถแล้ว',
  in_transit: 'กำลังจัดส่ง',
  delivered: 'ส่งมอบแล้ว',
  cancelled: 'ยกเลิก',
  returned: 'คืนสินค้า',
};

export async function GET(request: NextRequest): Promise<NextResponse<AIOrderStatusResponse>> {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: AIOrderStatusParams = {
      order_code: searchParams.get('order_code') || searchParams.get('order_no') || undefined,
      order_id: searchParams.get('order_id') ? parseInt(searchParams.get('order_id')!, 10) : undefined,
      customer_code: searchParams.get('customer_code') || searchParams.get('customer_id') || undefined,
      order_type: searchParams.get('order_type') as any || undefined,
      status: searchParams.get('status') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
    };

    // Build query
    let query = supabase
      .from('wms_orders')
      .select(`
        order_id,
        order_no,
        order_type,
        status,
        customer_id,
        shop_name,
        province,
        phone,
        order_date,
        delivery_date,
        total_amount,
        shipping_address,
        delivery_instructions,
        notes,
        created_at,
        updated_at,
        wms_order_items (
          sku_id,
          order_qty,
          picked_qty,
          shipped_qty,
          unit_price,
          master_sku (
            sku_name
          )
        ),
        master_customer!customer_id (
          customer_name
        )
      `)
      .order('order_date', { ascending: false });

    // Apply filters
    if (params.order_code) {
      // Support partial match
      if (params.order_code.includes('%')) {
        query = query.ilike('order_no', params.order_code);
      } else {
        query = query.eq('order_no', params.order_code);
      }
    }

    if (params.order_id) {
      query = query.eq('order_id', params.order_id);
    }

    if (params.customer_code) {
      query = query.eq('customer_id', params.customer_code);
    }

    if (params.order_type) {
      query = query.eq('order_type', params.order_type);
    }

    if (params.status) {
      if (params.status === 'pending') {
        // Pending = not yet delivered
        query = query.not('status', 'in', '("delivered","cancelled","returned")');
      } else {
        query = query.eq('status', params.status);
      }
    }

    if (params.date_from) {
      query = query.gte('order_date', params.date_from);
    }

    if (params.date_to) {
      query = query.lte('order_date', params.date_to);
    }

    // Apply limit
    if (params.limit && params.limit > 0) {
      query = query.limit(Math.min(params.limit, 200)); // Max 200 orders
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('[AI Order Status] Query error:', error);
      return NextResponse.json({
        success: false,
        data: [],
        summary: {
          total_orders: 0,
          by_status: {},
          total_amount: 0,
          avg_pick_progress: 0,
        },
        query_params: params,
        timestamp: new Date().toISOString(),
        error: error.message,
      }, { status: 500 });
    }

    // Transform data
    const transformedData: AIOrderStatus[] = (orders || []).map(order => {
      const items = (order.wms_order_items || []) as any[];
      const customer = order.master_customer as any;

      const totalQty = items.reduce((sum, item) => sum + (Number(item.order_qty) || 0), 0);
      const pickedQty = items.reduce((sum, item) => sum + (Number(item.picked_qty) || 0), 0);
      const shippedQty = items.reduce((sum, item) => sum + (Number(item.shipped_qty) || 0), 0);

      const pickProgress = totalQty > 0 ? Math.round((pickedQty / totalQty) * 100) : 0;
      const shipProgress = totalQty > 0 ? Math.round((shippedQty / totalQty) * 100) : 0;

      return {
        order_id: order.order_id,
        order_no: order.order_no,
        order_type: order.order_type,
        status: order.status,
        status_thai: STATUS_THAI[order.status] || order.status,
        customer_id: order.customer_id,
        customer_name: customer?.customer_name || order.customer_id,
        shop_name: order.shop_name,
        province: order.province,
        order_date: order.order_date,
        delivery_date: order.delivery_date,
        total_amount: Number(order.total_amount) || 0,
        total_items: items.length,
        total_qty: totalQty,
        picked_qty: pickedQty,
        shipped_qty: shippedQty,
        pick_progress_percent: pickProgress,
        ship_progress_percent: shipProgress,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: items.map(item => ({
          sku_id: item.sku_id,
          sku_name: item.master_sku?.sku_name || item.sku_id,
          order_qty: Number(item.order_qty) || 0,
          picked_qty: Number(item.picked_qty) || 0,
          shipped_qty: Number(item.shipped_qty) || 0,
          unit_price: Number(item.unit_price) || 0,
        })),
      };
    });

    // Calculate summary
    const byStatus: Record<string, number> = {};
    let totalPickProgress = 0;

    transformedData.forEach(order => {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      totalPickProgress += order.pick_progress_percent;
    });

    const summary = {
      total_orders: transformedData.length,
      by_status: byStatus,
      total_amount: transformedData.reduce((sum, o) => sum + o.total_amount, 0),
      avg_pick_progress: transformedData.length > 0 
        ? Math.round(totalPickProgress / transformedData.length) 
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      query_params: params,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AI Order Status] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      summary: {
        total_orders: 0,
        by_status: {},
        total_amount: 0,
        avg_pick_progress: 0,
      },
      query_params: {},
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    }, { status: 500 });
  }
}
