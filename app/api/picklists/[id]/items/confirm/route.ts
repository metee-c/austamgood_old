import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/picklists/[id]/items/confirm
 * อัพเดต quantity_picked สำหรับ picklist items ตาม order_id
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    // ดึง picklist items ที่ตรงกับ order_id
    const { data: items, error: fetchError } = await supabase
      .from('picklist_items')
      .select('id, quantity_to_pick, quantity_picked')
      .eq('picklist_id', id)
      .eq('order_id', order_id);

    if (fetchError) {
      console.error('Error fetching picklist items:', fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items found for this order' },
        { status: 404 }
      );
    }

    // อัพเดต quantity_picked = quantity_to_pick สำหรับทุก item
    const updates = items.map(item => 
      supabase
        .from('picklist_items')
        .update({
          quantity_picked: item.quantity_to_pick
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(updates);

    // ตรวจสอบ errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors updating items:', errors);
      return NextResponse.json(
        { error: 'Failed to update some items' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${items.length} items`,
      items_updated: items.length
    });

  } catch (error) {
    console.error('API Error in POST /api/picklists/[id]/items/confirm:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
