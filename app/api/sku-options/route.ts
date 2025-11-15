import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field');

    if (!field) {
      return NextResponse.json(
        { error: 'Field parameter is required' },
        { status: 400 }
      );
    }

    // Validate allowed fields
    const allowedFields = [
      'category', 
      'sub_category', 
      'brand', 
      'product_type', 
      'uom_base',
      'storage_condition'
    ];

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: 'Invalid field parameter' },
        { status: 400 }
      );
    }

    // Get distinct values for the specified field
    const { data, error } = await supabase
      .from('master_sku')
      .select(field)
      .not(field, 'is', null)
      .neq(field, '')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching distinct values:', error);
      return NextResponse.json(
        { error: 'Failed to fetch options', details: error.message },
        { status: 500 }
      );
    }

    // Extract unique values and sort them
    const uniqueValues = [...new Set(data.map(item => (item as any)[field]))]
      .filter(value => value !== null && value !== '')
      .sort();

    return NextResponse.json({ 
      field,
      options: uniqueValues
    });

  } catch (error) {
    console.error('Error in SKU options API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}