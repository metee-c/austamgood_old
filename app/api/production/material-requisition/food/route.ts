/**
 * Food Material Requisition API Route
 * API สำหรับดึงรายการวัตถุดิบอาหารที่ต้องเบิกจากใบสั่งผลิต
 * เฉพาะ SKU ที่เป็นอาหาร (category = 'วัตถุดิบ' และ sub_category LIKE '%อาหาร%')
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว

    const status = searchParams.get('status') || 'all';
    const productionOrderId = searchParams.get('production_order_id') || '';
    // Build query for production_order_items with food materials only
    let query = supabase
      .from('production_order_items')
      .select(
        `
        id,
        production_order_id,
        material_sku_id,
        required_qty,
        issued_qty,
        remaining_qty,
        uom,
        status,
        issued_date,
        remarks,
        created_at,
        updated_at,
        production_order:production_orders!production_order_items_production_order_id_fkey(
          id,
          production_no,
          sku_id,
          quantity,
          status,
          start_date,
          due_date,
          created_by
        ),
        material_sku:master_sku!production_order_items_material_sku_id_fkey(
          sku_id,
          sku_name,
          uom_base,
          category,
          sub_category
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (productionOrderId) {
      query = query.eq('production_order_id', productionOrderId);
    }

    // Pagination
    query = query;

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching food material requisition:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter only food materials (category = 'วัตถุดิบ' and sub_category contains 'อาหาร')
    const foodMaterials = (data || []).filter((item: any) => {
      const category = item.material_sku?.category || '';
      const subCategory = item.material_sku?.sub_category || '';
      return (
        category === 'วัตถุดิบ' &&
        (subCategory.includes('อาหาร') || item.material_sku_id.startsWith('00-'))
      );
    });

    // Transform data for frontend
    const transformedData = foodMaterials.map((item: any) => ({
      id: item.id,
      production_order_id: item.production_order_id,
      production_order_no: item.production_order?.production_no || 'N/A',
      production_order_status: item.production_order?.status || 'N/A',
      material_sku_id: item.material_sku_id,
      material_sku_name: item.material_sku?.sku_name || item.material_sku_id,
      category: item.material_sku?.category || '',
      sub_category: item.material_sku?.sub_category || '',
      required_qty: Number(item.required_qty) || 0,
      issued_qty: Number(item.issued_qty) || 0,
      remaining_qty:
        Number(item.remaining_qty) ||
        Number(item.required_qty) - Number(item.issued_qty) ||
        0,
      uom: item.uom || item.material_sku?.uom_base || '',
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      remarks: item.remarks
    }));

    // Get summary counts
    const summary = {
      total: transformedData.length,
      pending: transformedData.filter((o: any) => o.status === 'pending').length,
      partial: transformedData.filter((o: any) => o.status === 'partial').length,
      issued: transformedData.filter((o: any) => o.status === 'issued').length,
      completed: transformedData.filter((o: any) => o.status === 'completed').length
    };

    return NextResponse.json({
      data: transformedData,
      summary
    });
  } catch (error: any) {
    console.error('Error in GET /api/production/material-requisition/food:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch food material requisition' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/production/material-requisition/food
 * สร้างงานเบิกเติมวัตถุดิบอาหารลง replenishment_queue
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { production_order_item_id, from_location_id, to_location_id, pallet_id, notes } = body;

    if (!production_order_item_id) {
      return NextResponse.json(
        { error: 'production_order_item_id is required' },
        { status: 400 }
      );
    }

    // Get production order item details
    const { data: itemData, error: itemError } = await supabase
      .from('production_order_items')
      .select(
        `
        *,
        production_order:production_orders!production_order_items_production_order_id_fkey(
          production_no
        ),
        material_sku:master_sku!production_order_items_material_sku_id_fkey(
          sku_id,
          sku_name
        )
      `
      )
      .eq('id', production_order_item_id)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json(
        { error: 'Production order item not found' },
        { status: 404 }
      );
    }

    // Calculate remaining qty to issue
    const remainingQty =
      Number(itemData.remaining_qty) ||
      Number(itemData.required_qty) - Number(itemData.issued_qty);

    if (remainingQty <= 0) {
      return NextResponse.json(
        { error: 'No remaining quantity to issue' },
        { status: 400 }
      );
    }

    // Create replenishment queue entry
    const { data: queueData, error: queueError } = await supabase
      .from('replenishment_queue')
      .insert({
        warehouse_id: 'WH001', // Default warehouse
        sku_id: itemData.material_sku_id,
        from_location_id: from_location_id || null,
        to_location_id: to_location_id || null,
        pallet_id: pallet_id || null,
        requested_qty: remainingQty,
        priority: 3, // High priority for production
        status: 'pending',
        trigger_source: 'production_order',
        trigger_reference: itemData.production_order?.production_no || production_order_item_id,
        notes: notes || `เบิกวัตถุดิบอาหารสำหรับใบสั่งผลิต ${itemData.production_order?.production_no}`
      })
      .select()
      .single();

    if (queueError) {
      console.error('Error creating replenishment queue:', queueError);
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: queueData,
      message: 'สร้างงานเบิกเติมวัตถุดิบสำเร็จ'
    });
  } catch (error: any) {
    console.error('Error in POST /api/production/material-requisition/food:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create food material requisition' },
      { status: 500 }
    );
  }
}
