/**
 * Food Stock API for Production Orders
 * API สำหรับดึงสต็อกอาหาร (วัตถุดิบหลัก) แบบ FEFO สำหรับการสร้างใบสั่งผลิต
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface FoodStockByDate {
  sku_id: string;
  sku_name: string;
  production_date: string | null;
  expiry_date: string | null;
  total_qty: number;
  pallets: FoodStockPallet[];
}

export interface FoodStockPallet {
  balance_id: number;
  pallet_id: string;
  location_id: string;
  location_name: string;
  warehouse_id: string;
  total_piece_qty: number;
  reserved_piece_qty: number;
  available_qty: number;
  production_date: string | null;
  expiry_date: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get('sku_id');

    if (!skuId) {
      return NextResponse.json({ error: 'sku_id is required' }, { status: 400 });
    }

    // Only allow food materials (starting with 00-)
    if (!skuId.startsWith('00-')) {
      return NextResponse.json({ 
        error: 'This API is only for food materials (SKU starting with 00-)',
        data: [] 
      }, { status: 200 });
    }

    const supabase = await createClient();

    // Locations to exclude (preparation areas, dispatch, delivery-in-progress)
    const excludeLocations = [
      'Dispatch',
      'Delivery-In-Progress',
      'RCV',
      'SHIP',
    ];

    // Get preparation area codes
    const { data: prepAreas } = await supabase
      .from('preparation_area')
      .select('area_code')
      .eq('status', 'active');

    const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
    const allExcludeLocations = [...excludeLocations, ...prepAreaCodes];

    // Fetch inventory balances for this food material SKU
    let query = supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        warehouse_id,
        location_id,
        pallet_id,
        production_date,
        expiry_date,
        total_piece_qty,
        reserved_piece_qty,
        master_location!location_id (
          location_name
        ),
        master_sku!sku_id (
          sku_name
        )
      `)
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0) // Only show stock with qty > 0
      .order('expiry_date', { ascending: true, nullsFirst: false }) // FEFO
      .order('production_date', { ascending: true, nullsFirst: false });

    // Exclude preparation areas and temporary locations
    if (allExcludeLocations.length > 0) {
      query = query.not('location_id', 'in', `(${allExcludeLocations.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching food stock:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by production_date + expiry_date
    const groupedByDate = new Map<string, FoodStockByDate>();

    (data || []).forEach((item: any) => {
      const dateKey = `${item.production_date || 'null'}_${item.expiry_date || 'null'}`;
      
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, {
          sku_id: skuId,
          sku_name: item.master_sku?.sku_name || skuId,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          total_qty: 0,
          pallets: [],
        });
      }

      const group = groupedByDate.get(dateKey)!;
      const availableQty = Number(item.total_piece_qty) - Number(item.reserved_piece_qty || 0);
      
      group.total_qty += availableQty;
      group.pallets.push({
        balance_id: item.balance_id,
        pallet_id: item.pallet_id || '-',
        location_id: item.location_id,
        location_name: item.master_location?.location_name || item.location_id,
        warehouse_id: item.warehouse_id,
        total_piece_qty: Number(item.total_piece_qty),
        reserved_piece_qty: Number(item.reserved_piece_qty || 0),
        available_qty: availableQty,
        production_date: item.production_date,
        expiry_date: item.expiry_date,
      });
    });

    // Convert to array and sort by expiry_date (FEFO)
    const result = Array.from(groupedByDate.values()).sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
    });

    // Calculate total available
    const totalAvailable = result.reduce((sum, group) => sum + group.total_qty, 0);

    return NextResponse.json({
      data: result,
      totalAvailable,
      skuId,
    });
  } catch (error: any) {
    console.error('Error in GET /api/production/orders/food-stock:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch food stock' },
      { status: 500 }
    );
  }
}
