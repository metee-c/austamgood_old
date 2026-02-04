import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
interface UpdateHubRequest {
  updates: Array<{
    customer_id: string;
    hub: string;
  }>;
}

export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body: UpdateHubRequest = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อมูล hub ที่ต้องการอัปเดต' },
        { status: 400 }
      );
    }

    // Validate all updates have required fields
    const invalidUpdates = updates.filter(u => !u.customer_id || !u.hub?.trim());
    if (invalidUpdates.length > 0) {
      return NextResponse.json(
        { error: 'กรุณากรอก Hub ให้ครบทุกลูกค้า' },
        { status: 400 }
      );
    }

    // Update each customer's hub
    const results = [];
    const errors = [];

    for (const update of updates) {
      const { data, error } = await supabase
        .from('master_customer')
        .update({ hub: update.hub.trim() })
        .eq('customer_id', update.customer_id)
        .select('customer_id, customer_name, hub');

      if (error) {
        errors.push({
          customer_id: update.customer_id,
          error: error.message
        });
      } else if (data && data.length > 0) {
        results.push(data[0]);
      } else {
        errors.push({
          customer_id: update.customer_id,
          error: 'ไม่พบลูกค้าในระบบ'
        });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ไม่สามารถอัปเดต Hub ได้', 
          details: errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `อัปเดต Hub สำเร็จ ${results.length} รายการ`,
      updated: results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error updating customer hubs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
