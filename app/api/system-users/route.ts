import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name, email')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching system users:', error);
      return NextResponse.json(
        { error: error.message, data: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error fetching system users:', error);
    return NextResponse.json(
      { error: 'Internal server error', data: [] },
      { status: 500 }
    );
  }
}
