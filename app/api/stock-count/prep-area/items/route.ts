import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// POST - บันทึก item ที่นับ
export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { session_id, sku_code, sku_name, quantity, prep_area_code, counted_by } = body;

    if (!session_id || !sku_code || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'กรุณาระบุข้อมูลให้ครบ'
      }, { status: 400 });
    }

    // บันทึกลง wms_prep_area_count_items
    const { data, error } = await supabase
      .from('wms_prep_area_count_items')
      .insert({
        session_id,
        sku_code,
        sku_name,
        quantity,
        prep_area_code: prep_area_code || null,
        counted_by,
        counted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // อัปเดต session matched_count (ใช้เป็น total items)
    const { count } = await supabase
      .from('wms_prep_area_count_items')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id);
    
    await supabase
      .from('wms_stock_count_sessions')
      .update({ matched_count: count || 0 })
      .eq('id', session_id);

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error saving item:', error);
    return NextResponse.json(
      { error: 'Failed to save item' },
      { status: 500 }
    );
  }
}
