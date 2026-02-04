/**
 * AI API: Stock Movements Query
 * GET /api/ai/stock/movements
 * 
 * ดึงข้อมูลการเคลื่อนไหวสต็อกสำหรับ AI Assistant
 * READ-ONLY, SAFE for AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export interface AIStockMovementParams {
  sku_id?: string;
  location_id?: string;
  warehouse_id?: string;
  movement_type?: 'receive' | 'ship' | 'transfer' | 'putaway' | 'replenishment' | 'adjustment';
  direction?: 'in' | 'out';
  date_from?: string;
  date_to?: string;
  reference_no?: string;
  limit?: number;
}

export interface AIStockMovement {
  ledger_id: number;
  movement_at: string;
  transaction_type: string;
  transaction_type_thai: string;
  direction: string;
  direction_thai: string;
  warehouse_id: string;
  warehouse_name: string;
  location_id: string;
  location_name: string;
  sku_id: string;
  sku_name: string;
  pallet_id: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  pack_qty: number;
  piece_qty: number;
  reference_no: string | null;
  order_id: number | null;
  order_no: string | null;
  remarks: string | null;
  created_by: number | null;
  created_by_name: string | null;
}

export interface AIStockMovementResponse {
  success: boolean;
  data: AIStockMovement[];
  summary: {
    total_movements: number;
    total_in_qty: number;
    total_out_qty: number;
    net_qty: number;
    by_type: Record<string, { count: number; qty: number }>;
    by_date: Record<string, { in_qty: number; out_qty: number }>;
  };
  query_params: AIStockMovementParams;
  timestamp: string;
  error?: string;
}

// Transaction type translation
const TRANSACTION_TYPE_THAI: Record<string, string> = {
  receive: 'รับสินค้า',
  ship: 'จ่ายสินค้า',
  transfer: 'โอนย้าย',
  putaway: 'จัดเก็บ',
  replenishment: 'เติมสต็อก',
  adjustment: 'ปรับปรุง',
  pick: 'หยิบสินค้า',
};

const DIRECTION_THAI: Record<string, string> = {
  in: 'เข้า',
  out: 'ออก',
};

async function _GET(request: NextRequest): Promise<NextResponse<AIStockMovementResponse>> {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: AIStockMovementParams = {
      sku_id: searchParams.get('sku_id') || undefined,
      location_id: searchParams.get('location_id') || undefined,
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      movement_type: searchParams.get('movement_type') as any || searchParams.get('transaction_type') as any || undefined,
      direction: searchParams.get('direction') as any || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      reference_no: searchParams.get('reference_no') || undefined,
      limit: parseInt(searchParams.get('limit') || '100', 10),
    };

    // Default date range: last 30 days if not specified
    if (!params.date_from && !params.date_to) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      params.date_from = thirtyDaysAgo.toISOString().split('T')[0];
    }

    // Build query
    let query = supabase
      .from('wms_inventory_ledger')
      .select(`
        ledger_id,
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        lot_no,
        production_date,
        expiry_date,
        pack_qty,
        piece_qty,
        reference_no,
        order_id,
        remarks,
        created_by,
        master_location!location_id (
          location_name
        ),
        master_sku!sku_id (
          sku_name
        ),
        master_warehouse!warehouse_id (
          warehouse_name
        ),
        master_employee!created_by (
          first_name,
          last_name
        ),
        wms_orders!order_id (
          order_no
        )
      `)
      .order('movement_at', { ascending: false });

    // Apply filters
    if (params.sku_id) {
      if (params.sku_id.includes('%')) {
        query = query.ilike('sku_id', params.sku_id);
      } else {
        query = query.eq('sku_id', params.sku_id);
      }
    }

    if (params.location_id) {
      query = query.eq('location_id', params.location_id);
    }

    if (params.warehouse_id) {
      query = query.eq('warehouse_id', params.warehouse_id);
    }

    if (params.movement_type) {
      query = query.eq('transaction_type', params.movement_type);
    }

    if (params.direction) {
      query = query.eq('direction', params.direction);
    }

    if (params.date_from) {
      query = query.gte('movement_at', params.date_from);
    }

    if (params.date_to) {
      // Add time to include the entire day
      query = query.lte('movement_at', params.date_to + 'T23:59:59');
    }

    if (params.reference_no) {
      query = query.ilike('reference_no', `%${params.reference_no}%`);
    }

    // Apply limit
    if (params.limit && params.limit > 0) {
      query = query.limit(Math.min(params.limit, 500)); // Max 500 movements
    }

    const { data: movements, error } = await query;

    if (error) {
      console.error('[AI Stock Movements] Query error:', error);
      return NextResponse.json({
        success: false,
        data: [],
        summary: {
          total_movements: 0,
          total_in_qty: 0,
          total_out_qty: 0,
          net_qty: 0,
          by_type: {},
          by_date: {},
        },
        query_params: params,
        timestamp: new Date().toISOString(),
        error: error.message,
      }, { status: 500 });
    }

    // Transform data
    const transformedData: AIStockMovement[] = (movements || []).map(m => {
      const location = m.master_location as any;
      const sku = m.master_sku as any;
      const warehouse = m.master_warehouse as any;
      const employee = m.master_employee as any;
      const order = m.wms_orders as any;

      return {
        ledger_id: m.ledger_id,
        movement_at: m.movement_at,
        transaction_type: m.transaction_type,
        transaction_type_thai: TRANSACTION_TYPE_THAI[m.transaction_type] || m.transaction_type,
        direction: m.direction,
        direction_thai: DIRECTION_THAI[m.direction] || m.direction,
        warehouse_id: m.warehouse_id,
        warehouse_name: warehouse?.warehouse_name || m.warehouse_id,
        location_id: m.location_id,
        location_name: location?.location_name || m.location_id,
        sku_id: m.sku_id,
        sku_name: sku?.sku_name || m.sku_id,
        pallet_id: m.pallet_id,
        lot_no: m.lot_no,
        production_date: m.production_date,
        expiry_date: m.expiry_date,
        pack_qty: Number(m.pack_qty) || 0,
        piece_qty: Number(m.piece_qty) || 0,
        reference_no: m.reference_no,
        order_id: m.order_id,
        order_no: order?.order_no || null,
        remarks: m.remarks,
        created_by: m.created_by,
        created_by_name: employee ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() : null,
      };
    });

    // Calculate summary
    const byType: Record<string, { count: number; qty: number }> = {};
    const byDate: Record<string, { in_qty: number; out_qty: number }> = {};
    let totalInQty = 0;
    let totalOutQty = 0;

    transformedData.forEach(m => {
      const qty = m.piece_qty;
      const date = m.movement_at.split('T')[0];

      // By type
      if (!byType[m.transaction_type]) {
        byType[m.transaction_type] = { count: 0, qty: 0 };
      }
      byType[m.transaction_type].count++;
      byType[m.transaction_type].qty += qty;

      // By date
      if (!byDate[date]) {
        byDate[date] = { in_qty: 0, out_qty: 0 };
      }

      // Totals
      if (m.direction === 'in') {
        totalInQty += qty;
        byDate[date].in_qty += qty;
      } else {
        totalOutQty += qty;
        byDate[date].out_qty += qty;
      }
    });

    const summary = {
      total_movements: transformedData.length,
      total_in_qty: totalInQty,
      total_out_qty: totalOutQty,
      net_qty: totalInQty - totalOutQty,
      by_type: byType,
      by_date: byDate,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      query_params: params,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AI Stock Movements] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      summary: {
        total_movements: 0,
        total_in_qty: 0,
        total_out_qty: 0,
        net_qty: 0,
        by_type: {},
        by_date: {},
      },
      query_params: {},
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
