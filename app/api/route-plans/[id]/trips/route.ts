import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;

    // Fetch trips for this plan
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select('*')
      .eq('plan_id', planId)
      .order('trip_sequence', { ascending: true });

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return NextResponse.json(
        { data: null, error: tripsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: trips || [], error: null });
  } catch (error: any) {
    console.error('Error in trips API:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
