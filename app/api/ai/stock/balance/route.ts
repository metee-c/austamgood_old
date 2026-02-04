/**
 * AI API: Stock Balance Query
 * GET /api/ai/stock/balance
 * 
 * ดึงข้อมูลสต็อกคงเหลือสำหรับ AI Assistant
 * READ-ONLY, SAFE for AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export interface AIStockBalanceParams {
  sku_id?: string;
  location_id?: string;
  warehouse_id?: string;
  zone?: string;
  include_reserved?: boolean;
  include_expired?: boolean;
  limit?: number;
}

export interface AIStockBalanceItem {
  sku_id: string;
  sku_name: string;
  location_id: string;
  location_name: string;
  warehouse_id: string;
  warehouse_name: string;
  zone: string | null;
  pallet_id: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  total_piece_qty: number;
  reserved_piece_qty: number;
  available_piece_qty: number;
  total_pack_qty: number;
  is_expired: boolean;
}

export interface AIStockBalanceResponse {
  success: boolean;
  data: AIStockBalanceItem[];
  summary: {
    total_items: number;
    total_piece_qty: number;
    total_reserved_qty: number;
    total_available_qty: number;
    unique_skus: number;
    unique_locations: number;
  };
  query_params: AIStockBalanceParams;
  timestamp: string;
  error?: string;
}

async function _GET(request: NextRequest): Promise<NextResponse<AIStockBalanceResponse>> {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: AIStockBalanceParams = {
      sku_id: searchParams.get('sku_id') || undefined,
      location_id: searchParams.get('location_id') || undefined,
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      zone: searchParams.get('zone') || undefined,
      include_reserved: searchParams.get('include_reserved') !== 'false',
      include_expired: searchParams.get('include_expired') === 'true',
      limit: parseInt(searchParams.get('limit') || '100', 10),
    };

    // Build query
    let query = supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        lot_no,
        production_date,
        expiry_date,
        total_pack_qty,
        total_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        master_location!location_id (
          location_name,
          zone
        ),
        master_sku!sku_id (
          sku_name
        ),
        master_warehouse!warehouse_id (
          warehouse_name
        )
      `)
      .gt('total_piece_qty', 0)
      .order('updated_at', { ascending: false });

    // Apply filters
    if (params.sku_id) {
      // Support partial match for SKU
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

    // Filter expired items
    if (!params.include_expired) {
      const today = new Date().toISOString().split('T')[0];
      query = query.or(`expiry_date.is.null,expiry_date.gte.${today}`);
    }

    // Apply limit
    if (params.limit && params.limit > 0) {
      query = query.limit(Math.min(params.limit, 500)); // Max 500 items
    }

    const { data: balances, error } = await query;

    if (error) {
      console.error('[AI Stock Balance] Query error:', error);
      return NextResponse.json({
        success: false,
        data: [],
        summary: {
          total_items: 0,
          total_piece_qty: 0,
          total_reserved_qty: 0,
          total_available_qty: 0,
          unique_skus: 0,
          unique_locations: 0,
        },
        query_params: params,
        timestamp: new Date().toISOString(),
        error: error.message,
      }, { status: 500 });
    }

    // Transform data
    const today = new Date();
    const transformedData: AIStockBalanceItem[] = (balances || [])
      .filter(b => {
        // Filter by zone if specified
        if (params.zone) {
          const location = b.master_location as any;
          return location?.zone === params.zone;
        }
        return true;
      })
      .map(b => {
        const location = b.master_location as any;
        const sku = b.master_sku as any;
        const warehouse = b.master_warehouse as any;
        
        const totalPiece = Number(b.total_piece_qty) || 0;
        const reservedPiece = Number(b.reserved_piece_qty) || 0;
        const isExpired = b.expiry_date ? new Date(b.expiry_date) < today : false;

        return {
          sku_id: b.sku_id,
          sku_name: sku?.sku_name || b.sku_id,
          location_id: b.location_id,
          location_name: location?.location_name || b.location_id,
          warehouse_id: b.warehouse_id,
          warehouse_name: warehouse?.warehouse_name || b.warehouse_id,
          zone: location?.zone || null,
          pallet_id: b.pallet_id,
          lot_no: b.lot_no,
          production_date: b.production_date,
          expiry_date: b.expiry_date,
          total_piece_qty: totalPiece,
          reserved_piece_qty: reservedPiece,
          available_piece_qty: Math.max(0, totalPiece - reservedPiece),
          total_pack_qty: Number(b.total_pack_qty) || 0,
          is_expired: isExpired,
        };
      });

    // Calculate summary
    const uniqueSkus = new Set(transformedData.map(d => d.sku_id));
    const uniqueLocations = new Set(transformedData.map(d => d.location_id));
    
    const summary = {
      total_items: transformedData.length,
      total_piece_qty: transformedData.reduce((sum, d) => sum + d.total_piece_qty, 0),
      total_reserved_qty: transformedData.reduce((sum, d) => sum + d.reserved_piece_qty, 0),
      total_available_qty: transformedData.reduce((sum, d) => sum + d.available_piece_qty, 0),
      unique_skus: uniqueSkus.size,
      unique_locations: uniqueLocations.size,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      query_params: params,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AI Stock Balance] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      summary: {
        total_items: 0,
        total_piece_qty: 0,
        total_reserved_qty: 0,
        total_available_qty: 0,
        unique_skus: 0,
        unique_locations: 0,
      },
      query_params: {},
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
