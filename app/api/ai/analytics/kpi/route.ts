/**
 * AI API: KPI Analytics Query
 * GET /api/ai/analytics/kpi
 * 
 * ดึงข้อมูล KPI และตัวชี้วัดประสิทธิภาพสำหรับ AI Assistant
 * READ-ONLY, SAFE for AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export interface AIKPIParams {
  date_from?: string;
  date_to?: string;
  warehouse_id?: string;
  kpi_type?: 'efficiency' | 'accuracy' | 'utilization' | 'throughput' | 'all';
}

export interface AIKPIData {
  // Throughput KPIs
  throughput: {
    total_received_qty: number;
    total_shipped_qty: number;
    total_movements: number;
    avg_daily_received: number;
    avg_daily_shipped: number;
    receiving_orders_count: number;
    shipping_orders_count: number;
  };
  // Efficiency KPIs
  efficiency: {
    orders_completed: number;
    orders_pending: number;
    orders_in_progress: number;
    completion_rate_percent: number;
    avg_order_processing_days: number;
    picking_completion_rate: number;
  };
  // Utilization KPIs
  utilization: {
    total_locations: number;
    occupied_locations: number;
    location_utilization_percent: number;
    total_capacity_qty: number;
    current_stock_qty: number;
    capacity_utilization_percent: number;
    unique_skus_in_stock: number;
    unique_pallets: number;
  };
  // Inventory KPIs
  inventory: {
    total_stock_value: number;
    total_piece_qty: number;
    total_reserved_qty: number;
    available_qty: number;
    expiring_soon_qty: number;
    expired_qty: number;
    low_stock_skus: number;
  };
  // Period info
  period: {
    date_from: string;
    date_to: string;
    days_in_period: number;
  };
}

export interface AIKPIResponse {
  success: boolean;
  data: AIKPIData;
  query_params: AIKPIParams;
  timestamp: string;
  error?: string;
}

async function _GET(request: NextRequest): Promise<NextResponse<AIKPIResponse>> {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const params: AIKPIParams = {
      date_from: searchParams.get('date_from') || thirtyDaysAgo.toISOString().split('T')[0],
      date_to: searchParams.get('date_to') || today.toISOString().split('T')[0],
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      kpi_type: (searchParams.get('kpi_type') as any) || 'all',
    };

    const dateFrom = params.date_from!;
    const dateTo = params.date_to! + 'T23:59:59';
    const daysInPeriod = Math.ceil(
      (new Date(params.date_to!).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Initialize KPI data
    const kpiData: AIKPIData = {
      throughput: {
        total_received_qty: 0,
        total_shipped_qty: 0,
        total_movements: 0,
        avg_daily_received: 0,
        avg_daily_shipped: 0,
        receiving_orders_count: 0,
        shipping_orders_count: 0,
      },
      efficiency: {
        orders_completed: 0,
        orders_pending: 0,
        orders_in_progress: 0,
        completion_rate_percent: 0,
        avg_order_processing_days: 0,
        picking_completion_rate: 0,
      },
      utilization: {
        total_locations: 0,
        occupied_locations: 0,
        location_utilization_percent: 0,
        total_capacity_qty: 0,
        current_stock_qty: 0,
        capacity_utilization_percent: 0,
        unique_skus_in_stock: 0,
        unique_pallets: 0,
      },
      inventory: {
        total_stock_value: 0,
        total_piece_qty: 0,
        total_reserved_qty: 0,
        available_qty: 0,
        expiring_soon_qty: 0,
        expired_qty: 0,
        low_stock_skus: 0,
      },
      period: {
        date_from: dateFrom,
        date_to: params.date_to!,
        days_in_period: daysInPeriod,
      },
    };

    // === THROUGHPUT KPIs ===
    if (params.kpi_type === 'all' || params.kpi_type === 'throughput') {
      // Get inventory movements
      let movementQuery = supabase
        .from('wms_inventory_ledger')
        .select('transaction_type, direction, piece_qty')
        .gte('movement_at', dateFrom)
        .lte('movement_at', dateTo);

      if (params.warehouse_id) {
        movementQuery = movementQuery.eq('warehouse_id', params.warehouse_id);
      }

      const { data: movements } = await movementQuery;

      let totalReceived = 0;
      let totalShipped = 0;
      let totalMovements = 0;

      (movements || []).forEach(m => {
        const qty = Number(m.piece_qty) || 0;
        totalMovements++;
        
        if (m.transaction_type === 'receive' && m.direction === 'in') {
          totalReceived += qty;
        } else if (m.transaction_type === 'ship' && m.direction === 'out') {
          totalShipped += qty;
        }
      });

      // Count receiving orders
      let receiveQuery = supabase
        .from('wms_receives')
        .select('receive_id', { count: 'exact', head: true })
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (params.warehouse_id) {
        receiveQuery = receiveQuery.eq('warehouse_id', params.warehouse_id);
      }

      const { count: receiveCount } = await receiveQuery;

      // Count shipping orders
      let orderQuery = supabase
        .from('wms_orders')
        .select('order_id', { count: 'exact', head: true })
        .gte('order_date', dateFrom)
        .lte('order_date', params.date_to!);

      const { count: orderCount } = await orderQuery;

      kpiData.throughput = {
        total_received_qty: totalReceived,
        total_shipped_qty: totalShipped,
        total_movements: totalMovements,
        avg_daily_received: daysInPeriod > 0 ? Math.round(totalReceived / daysInPeriod) : 0,
        avg_daily_shipped: daysInPeriod > 0 ? Math.round(totalShipped / daysInPeriod) : 0,
        receiving_orders_count: receiveCount || 0,
        shipping_orders_count: orderCount || 0,
      };
    }

    // === EFFICIENCY KPIs ===
    if (params.kpi_type === 'all' || params.kpi_type === 'efficiency') {
      // Get orders by status
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('status, order_date, updated_at')
        .gte('order_date', dateFrom)
        .lte('order_date', params.date_to!);

      let completed = 0;
      let pending = 0;
      let inProgress = 0;
      let totalProcessingDays = 0;
      let processedOrders = 0;

      (orders || []).forEach(o => {
        if (o.status === 'delivered') {
          completed++;
          // Calculate processing time
          if (o.order_date && o.updated_at) {
            const orderDate = new Date(o.order_date);
            const completedDate = new Date(o.updated_at);
            const days = Math.ceil((completedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
            totalProcessingDays += days;
            processedOrders++;
          }
        } else if (['draft', 'confirmed'].includes(o.status)) {
          pending++;
        } else if (['in_picking', 'picked', 'loaded', 'in_transit'].includes(o.status)) {
          inProgress++;
        }
      });

      const totalOrders = (orders || []).length;
      const completionRate = totalOrders > 0 ? Math.round((completed / totalOrders) * 100) : 0;
      const avgProcessingDays = processedOrders > 0 ? Math.round(totalProcessingDays / processedOrders) : 0;

      // Get picking completion rate
      const { data: picklists } = await supabase
        .from('picklists')
        .select('status')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      const totalPicklists = (picklists || []).length;
      const completedPicklists = (picklists || []).filter(p => p.status === 'completed').length;
      const pickingRate = totalPicklists > 0 ? Math.round((completedPicklists / totalPicklists) * 100) : 0;

      kpiData.efficiency = {
        orders_completed: completed,
        orders_pending: pending,
        orders_in_progress: inProgress,
        completion_rate_percent: completionRate,
        avg_order_processing_days: avgProcessingDays,
        picking_completion_rate: pickingRate,
      };
    }

    // === UTILIZATION KPIs ===
    if (params.kpi_type === 'all' || params.kpi_type === 'utilization') {
      // Get location data
      let locationQuery = supabase
        .from('master_location')
        .select('location_id, max_capacity_qty, current_qty')
        .eq('active_status', 'active');

      if (params.warehouse_id) {
        locationQuery = locationQuery.eq('warehouse_id', params.warehouse_id);
      }

      const { data: locations } = await locationQuery;

      let totalLocations = 0;
      let occupiedLocations = 0;
      let totalCapacity = 0;
      let currentStock = 0;

      (locations || []).forEach(l => {
        totalLocations++;
        const capacity = Number(l.max_capacity_qty) || 0;
        const current = Number(l.current_qty) || 0;
        
        totalCapacity += capacity;
        currentStock += current;
        
        if (current > 0) {
          occupiedLocations++;
        }
      });

      // Get unique SKUs and pallets
      let balanceQuery = supabase
        .from('wms_inventory_balances')
        .select('sku_id, pallet_id')
        .gt('total_piece_qty', 0);

      if (params.warehouse_id) {
        balanceQuery = balanceQuery.eq('warehouse_id', params.warehouse_id);
      }

      const { data: balances } = await balanceQuery;

      const uniqueSkus = new Set((balances || []).map(b => b.sku_id));
      const uniquePallets = new Set((balances || []).filter(b => b.pallet_id).map(b => b.pallet_id));

      kpiData.utilization = {
        total_locations: totalLocations,
        occupied_locations: occupiedLocations,
        location_utilization_percent: totalLocations > 0 ? Math.round((occupiedLocations / totalLocations) * 100) : 0,
        total_capacity_qty: totalCapacity,
        current_stock_qty: currentStock,
        capacity_utilization_percent: totalCapacity > 0 ? Math.round((currentStock / totalCapacity) * 100) : 0,
        unique_skus_in_stock: uniqueSkus.size,
        unique_pallets: uniquePallets.size,
      };
    }

    // === INVENTORY KPIs ===
    if (params.kpi_type === 'all') {
      // Get inventory balances
      let invQuery = supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty, reserved_piece_qty, expiry_date')
        .gt('total_piece_qty', 0);

      if (params.warehouse_id) {
        invQuery = invQuery.eq('warehouse_id', params.warehouse_id);
      }

      const { data: inventory } = await invQuery;

      let totalQty = 0;
      let reservedQty = 0;
      let expiringQty = 0;
      let expiredQty = 0;

      const todayDate = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      (inventory || []).forEach(i => {
        const qty = Number(i.total_piece_qty) || 0;
        const reserved = Number(i.reserved_piece_qty) || 0;
        
        totalQty += qty;
        reservedQty += reserved;

        if (i.expiry_date) {
          const expiryDate = new Date(i.expiry_date);
          if (expiryDate < todayDate) {
            expiredQty += qty;
          } else if (expiryDate <= thirtyDaysFromNow) {
            expiringQty += qty;
          }
        }
      });

      // Count low stock SKUs (using safety_stock from master_sku)
      const { data: lowStockData } = await supabase.rpc('count_low_stock_skus').single();

      const lowStockCount = (lowStockData as { count?: number } | null)?.count || 0;

      kpiData.inventory = {
        total_stock_value: 0, // Would need price data
        total_piece_qty: totalQty,
        total_reserved_qty: reservedQty,
        available_qty: totalQty - reservedQty,
        expiring_soon_qty: expiringQty,
        expired_qty: expiredQty,
        low_stock_skus: lowStockCount,
      };
    }

    return NextResponse.json({
      success: true,
      data: kpiData,
      query_params: params,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AI KPI Analytics] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      data: {
        throughput: {
          total_received_qty: 0,
          total_shipped_qty: 0,
          total_movements: 0,
          avg_daily_received: 0,
          avg_daily_shipped: 0,
          receiving_orders_count: 0,
          shipping_orders_count: 0,
        },
        efficiency: {
          orders_completed: 0,
          orders_pending: 0,
          orders_in_progress: 0,
          completion_rate_percent: 0,
          avg_order_processing_days: 0,
          picking_completion_rate: 0,
        },
        utilization: {
          total_locations: 0,
          occupied_locations: 0,
          location_utilization_percent: 0,
          total_capacity_qty: 0,
          current_stock_qty: 0,
          capacity_utilization_percent: 0,
          unique_skus_in_stock: 0,
          unique_pallets: 0,
        },
        inventory: {
          total_stock_value: 0,
          total_piece_qty: 0,
          total_reserved_qty: 0,
          available_qty: 0,
          expiring_soon_qty: 0,
          expired_qty: 0,
          low_stock_skus: 0,
        },
        period: {
          date_from: '',
          date_to: '',
          days_in_period: 0,
        },
      },
      query_params: {},
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
