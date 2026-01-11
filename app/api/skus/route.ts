import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || 'active';

    let query = supabase
      .from('master_sku')
      .select(`
        sku_id,
        sku_name,
        sku_description,
        category,
        sub_category,
        brand,
        product_type,
        uom_base,
        qty_per_pack,
        qty_per_pallet,
        weight_per_piece_kg,
        weight_per_pack_kg,
        barcode,
        pack_barcode,
        pallet_barcode,
        storage_condition,
        shelf_life_days,
        lot_tracking_required,
        expiry_date_required,
        reorder_point,
        safety_stock,
        default_location,
        status,
        created_at,
        updated_at
      `)
      .eq('status', status)
      .order('sku_name');

    // Add search filter if provided
    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`sku_id.ilike.%${search}%,sku_name.ilike.%${search}%,barcode.ilike.%${search}%`);
      }
    }

    // Add category filter if provided
    if (category) {
      query = query.eq('category', category);
    }

    const { data: skus, error } = await query;

    if (error) {
      console.error('Error fetching SKUs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch SKUs', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      skus: skus || [],
      count: skus?.length || 0 
    });

  } catch (error) {
    console.error('Error in SKUs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}