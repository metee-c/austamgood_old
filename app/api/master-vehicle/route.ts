
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { vehicleSchema } from '@/types/vehicle-schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const supabase = await createClient();
  
  let query = supabase.from('master_vehicle').select('*');

  if (search) {
    query = query.or(`vehicle_code.ilike.%${search}%,plate_number.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const result = vehicleSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_vehicle')
    .insert([result.data])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const result = vehicleSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_vehicle')
    .update(result.data)
    .eq('vehicle_id', result.data.vehicle_id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const vehicle_id = searchParams.get('id');

  if (!vehicle_id) {
    return NextResponse.json({ error: 'Missing vehicle_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('master_vehicle')
    .delete()
    .eq('vehicle_id', vehicle_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Vehicle deleted successfully' });
}
