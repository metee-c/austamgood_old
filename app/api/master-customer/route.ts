import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { customerSchema } from '@/types/customer-schema';
import { withAuth, withAdminAuth } from '@/lib/api/with-auth';
async function handleGet(request: NextRequest, context: any) {
  const { searchParams } = new URL(request.url);
    
  const search = searchParams.get('search');
  console.log('[API master-customer] Search term:', search);
  const supabase = await createClient();
  
  // ดึงข้อมูลหลายรอบเพื่อ bypass limit 1000 ของ Supabase
  const allCustomers: any[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('master_customer')
      .select('*')
      .eq('status', 'active')
      .order('customer_name')
      .range(offset, offset + batchSize - 1);

    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`customer_code.ilike.%${search}%,customer_name.ilike.%${search}%`);
      }
    }

    const { data: batch, error } = await query;
    
    if (error) {
      console.error('[API master-customer] Query Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (batch && batch.length > 0) {
      allCustomers.push(...batch);
      offset += batchSize;
      hasMore = batch.length === batchSize;
    } else {
      hasMore = false;
    }

    // Safety limit - max 10 batches (10000 records)
    if (offset >= 10000) {
      hasMore = false;
    }
  }

  console.log('[API master-customer] Loaded customers:', allCustomers.length);

  return NextResponse.json({
    data: allCustomers
  });
}

async function handlePost(request: NextRequest, context: any) {
  const supabase = await createClient();
  const body = await request.json();

  const result = customerSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_customer')
    .insert([result.data])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

async function handlePut(request: NextRequest, context: any) {
  const supabase = await createClient();
  const body = await request.json();

  const result = customerSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_customer')
    .update(result.data)
    .eq('customer_id', result.data.customer_id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

async function handleDelete(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const customer_id = searchParams.get('id');

  if (!customer_id) {
    return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('master_customer')
    .delete()
    .eq('customer_id', customer_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Customer deleted successfully' });
}

// Export with auth wrappers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAdminAuth(handleDelete);
