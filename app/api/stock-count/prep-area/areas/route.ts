import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงรายการบ้านหยิบทั้งหมด
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('preparation_area')
      .select('area_id, area_code, area_name')
      .eq('status', 'active')
      .order('area_code');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching prep areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prep areas' },
      { status: 500 }
    );
  }
}
