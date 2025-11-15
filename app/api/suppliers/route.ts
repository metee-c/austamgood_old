import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch active suppliers with service_provider or both type
    const { data, error } = await supabase
      .from('master_supplier')
      .select('supplier_id, supplier_code, supplier_name, supplier_type, phone, service_category')
      .in('supplier_type', ['service_provider', 'both'])
      .eq('status', 'active')
      .order('supplier_name');

    if (error) {
      console.error('Error fetching suppliers:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
