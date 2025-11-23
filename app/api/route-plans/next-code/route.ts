import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Missing date parameter' },
        { status: 400 }
      );
    }

    // Format: RP-YYYYMMDD-XXX
    const dateObj = new Date(dateParam);
    const dateStr = format(dateObj, 'yyyyMMdd');
    const prefix = `RP-${dateStr}-`;

    // Get all plans for this date to find the max running number
    const { data: existingPlans, error } = await supabase
      .from('receiving_route_plans')
      .select('plan_code')
      .like('plan_code', `${prefix}%`)
      .order('plan_code', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching existing plans:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    let runningNumber = 1;

    if (existingPlans && existingPlans.length > 0) {
      // Extract the running number from the last plan code
      const lastCode = existingPlans[0].plan_code;
      const match = lastCode.match(/RP-\d{8}-(\d{3})$/);
      if (match) {
        runningNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Generate the new plan code
    const nextCode = `${prefix}${runningNumber.toString().padStart(3, '0')}`;

    // Generate the plan name based on running number
    // Format: "แผนจัดส่งประจำวัน รอบ X – DD/MM/YYYY"
    const thaiDate = format(dateObj, 'dd/MM/yyyy');
    const nextName = `แผนจัดส่งประจำวัน รอบ ${runningNumber} – ${thaiDate}`;

    return NextResponse.json({
      plan_code: nextCode,
      plan_name: nextName,
      running_number: runningNumber,
      date: dateStr
    });

  } catch (error) {
    console.error('Unexpected error generating plan code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
