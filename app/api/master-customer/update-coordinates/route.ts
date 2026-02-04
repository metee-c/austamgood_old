import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _PATCH(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();

    const { customer_id, order_no, latitude, longitude } = body;

    // Debug: Log received data
    console.log('📥 API received:', { customer_id, order_no, latitude, longitude });

    // Validate inputs
    if (!customer_id && !order_no) {
      return NextResponse.json({
        error: 'Either customer_id or order_no is required'
      }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }

    // Validate coordinate ranges
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinate values' }, { status: 400 });
    }

    if (lat < -90 || lat > 90) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 });
    }

    if (lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Longitude must be between -180 and 180' }, { status: 400 });
    }

    // Get customer_id and order info
    let finalCustomerId = customer_id;
    let orderInfo = null;

    if (order_no) {
      const { data: orderData, error: orderError } = await supabase
        .from('wms_orders')
        .select('customer_id, shop_name, text_field_long_1, province, phone')
        .eq('order_no', order_no)
        .single();

      if (orderError || !orderData) {
        console.error(`❌ Order not found: "${order_no}"`, orderError);
        return NextResponse.json({
          error: `Order not found (order_no: "${order_no}")`
        }, { status: 404 });
      }

      finalCustomerId = orderData.customer_id;
      orderInfo = orderData;
      console.log(`📋 Found customer_id from order: ${finalCustomerId}`);
    }

    // Try to update existing customer
    const { data, error } = await supabase
      .from('master_customer')
      .update({
        latitude: lat,
        longitude: lng,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', finalCustomerId)
      .select();

    if (error) {
      console.error('Error updating customer coordinates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If customer not found, create new customer record
    if (!data || data.length === 0) {
      console.log(`⚠️ Customer not found, creating new record for: "${finalCustomerId}"`);

      // Create new customer with data from order
      const newCustomer = {
        customer_id: finalCustomerId,
        customer_code: finalCustomerId,
        customer_name: orderInfo?.shop_name || finalCustomerId,
        shipping_address: orderInfo?.text_field_long_1 || '',
        province: orderInfo?.province || '',
        phone: orderInfo?.phone || '',
        latitude: lat,
        longitude: lng,
        status: 'active',
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdData, error: createError } = await supabase
        .from('master_customer')
        .insert(newCustomer)
        .select();

      if (createError) {
        console.error('Error creating customer:', createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      console.log('✅ Successfully created new customer with coordinates:', finalCustomerId);
      return NextResponse.json({ data: createdData[0], error: null, created: true });
    }

    console.log('✅ Successfully updated coordinates for customer:', finalCustomerId);
    return NextResponse.json({ data: data[0], error: null, created: false });
  } catch (error) {
    console.error('API Error in PATCH /api/master-customer/update-coordinates:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const PATCH = withShadowLog(_PATCH);
