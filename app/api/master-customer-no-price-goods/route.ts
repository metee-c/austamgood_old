import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabase
        .from('master_customer_no_price_goods')
        .select('*')
        .eq('record_id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from('master_customer_no_price_goods')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching customer no price goods:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('master_customer_no_price_goods')
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating customer no price goods:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function _PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { record_id, ...updateData } = body;

    const { data, error } = await supabase
      .from('master_customer_no_price_goods')
      .update(updateData)
      .eq('record_id', record_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating customer no price goods:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function _DELETE(request: NextRequest) {
try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('master_customer_no_price_goods')
      .delete()
      .eq('record_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Customer no price goods record deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer no price goods:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
export const PUT = withShadowLog(_PUT);
export const DELETE = withShadowLog(_DELETE);
