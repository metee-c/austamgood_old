import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const warehouse_id = searchParams.get('warehouse_id');
    const location_type = searchParams.get('location_type');
    const zone = searchParams.get('zone');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '100');

    const supabase = await createClient();
    
    let query = supabase
      .from('master_location')
      .select(`
        location_id,
        warehouse_id,
        location_code,
        location_name,
        location_type,
        max_capacity_qty,
        max_capacity_weight_kg,
        current_qty,
        current_weight_kg,
        putaway_strategy,
        zone,
        aisle,
        rack,
        shelf,
        bin,
        temperature_controlled,
        humidity_controlled,
        active_status,
        created_at,
        updated_at,
        remarks,
        master_warehouse!inner (
          warehouse_name
        )
      `)
      .order('location_code', { ascending: true });

    // Apply filters
    if (search) {
      query = query.or(`
        location_code.ilike.%${search}%,
        location_name.ilike.%${search}%,
        zone.ilike.%${search}%
      `);
    }

    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }

    // Handle location_type filter - be flexible with database constraints
    if (location_type) {
      try {
        query = query.eq('location_type', location_type);
      } catch (error) {
        console.warn('Location type filter error, skipping:', error);
      }
    }

    if (zone) {
      query = query.eq('zone', zone);
    }

    if (status) {
      query = query.eq('active_status', status);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ 
        locations: [], 
        count: 0, 
        error: error.message 
      }, { status: 500 });
    }

    // Transform data to include warehouse_name
    const transformedData = data?.map(item => ({
      location_id: item.location_id,
      warehouse_id: item.warehouse_id,
      warehouse_name: (item as any).master_warehouse?.warehouse_name,
      location_code: item.location_code,
      location_name: item.location_name,
      location_type: item.location_type,
      max_capacity_qty: item.max_capacity_qty,
      max_capacity_weight_kg: item.max_capacity_weight_kg,
      current_qty: item.current_qty,
      current_weight_kg: item.current_weight_kg,
      putaway_strategy: item.putaway_strategy,
      zone: item.zone,
      aisle: item.aisle,
      rack: item.rack,
      shelf: item.shelf,
      bin: item.bin,
      temperature_controlled: item.temperature_controlled,
      humidity_controlled: item.humidity_controlled,
      active_status: item.active_status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      remarks: item.remarks
    })) || [];

    return NextResponse.json({ 
      locations: transformedData, 
      count: transformedData.length,
      error: null 
    });

  } catch (error) {
    console.error('Unexpected error fetching locations:', error);
    return NextResponse.json(
      { 
        locations: [], 
        count: 0, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}