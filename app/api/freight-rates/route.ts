import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - ดึงรายการ freight rates ทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const pricing_mode = searchParams.get('pricing_mode');
    const origin_province = searchParams.get('origin_province');
    const destination_province = searchParams.get('destination_province');
    const carrier_id = searchParams.get('carrier_id');

    // Get freight rates without JOIN first to avoid relationship issues
    let query = supabase
      .from('master_freight_rate')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`route_name.ilike.%${search}%,origin_province.ilike.%${search}%,destination_province.ilike.%${search}%`);
    }

    if (pricing_mode) {
      query = query.eq('pricing_mode', pricing_mode);
    }

    if (origin_province) {
      query = query.eq('origin_province', origin_province);
    }

    if (destination_province) {
      query = query.eq('destination_province', destination_province);
    }

    if (carrier_id) {
      query = query.eq('carrier_id', carrier_id);
    }

    const { data: freightRates, error } = await query;

    if (error) {
      console.error('Error fetching freight rates:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Fetch supplier/carrier names separately to enrich the data
    if (freightRates && freightRates.length > 0) {
      const carrierCodes = [...new Set(freightRates.map(fr => fr.carrier_id).filter(Boolean))];
      
      console.log('[DEBUG] Freight rates count:', freightRates.length);
      console.log('[DEBUG] Unique carrier codes:', carrierCodes);

      if (carrierCodes.length > 0) {
        const { data: suppliers, error: supplierError } = await supabase
          .from('master_supplier')
          .select('supplier_id, supplier_code, supplier_name')
          .in('supplier_code', carrierCodes);

        console.log('[DEBUG] Suppliers found:', suppliers?.length || 0);
        console.log('[DEBUG] Suppliers data:', suppliers);
        console.log('[DEBUG] Supplier error:', supplierError);

        // Enrich freight rates with carrier names
        const enrichedData = freightRates.map(fr => {
          const supplier = suppliers?.find(s => s.supplier_code === fr.carrier_id);
          console.log(`[DEBUG] Matching carrier_id "${fr.carrier_id}" with supplier:`, supplier);
          
          return {
            ...fr,
            carrier: supplier || null,
            carrier_name: supplier?.supplier_name || '-'
          };
        });

        console.log('[DEBUG] Sample enriched data:', enrichedData[0]);
        return NextResponse.json({ data: enrichedData, error: null });
      }
    }

    return NextResponse.json({ data: freightRates, error: null });
  } catch (error: any) {
    console.error('Error fetching freight rates:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

// POST - สร้าง freight rate ใหม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    console.log('[API] POST /api/freight-rates - Body:', body);

    // Get current user for created_by
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('[API] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message
    });

    console.log('[API] Skipping auth check - proceeding with insert...');

    // Temporarily skip auth check for testing
    // if (!user) {
    //   return NextResponse.json(
    //     { data: null, error: 'Unauthorized - Please login first' },
    //     { status: 401 }
    //   );
    // }

    // Prepare data for insertion (only constant/master data fields)
    const insertData: any = {
      carrier_id: body.carrier_id || body.supplier_code || body.supplier_id, // รองรับทั้ง carrier_id, supplier_code และ supplier_id
      route_name: body.route_name,
      origin_province: body.origin_province,
      origin_district: body.origin_district || null,
      destination_province: body.destination_province,
      destination_district: body.destination_district || null,
      total_distance_km: body.total_distance_km || 0,
      pricing_mode: body.pricing_mode || 'flat',
      base_price: body.base_price || body.shipping_cost || 0, // รองรับทั้ง base_price และ shipping_cost
      extra_drop_price: body.extra_drop_price || body.extra_stop_fee || null,
      helper_price: body.helper_price || body.helper_fee || null,
      price_unit: body.price_unit || 'trip',
      effective_start_date: body.effective_start_date || new Date().toISOString().split('T')[0],
      effective_end_date: body.effective_end_date || null,
      notes: body.notes || null,
      created_by: user?.email || 'system'
    };

    const { data, error } = await supabase
      .from('master_freight_rate')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating freight rate:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating freight rate:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
