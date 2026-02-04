import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

// GET - ตรวจสอบ SKU
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'กรุณาระบุรหัส SKU'
      }, { status: 400 });
    }

    // ค้นหา SKU จาก sku_id หรือ barcode
    const { data: sku, error } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, barcode')
      .or(`sku_id.eq.${code},barcode.eq.${code}`)
      .maybeSingle();

    if (error) throw error;

    if (!sku) {
      return NextResponse.json({
        success: false,
        error: 'ไม่พบ SKU ในระบบ'
      });
    }

    return NextResponse.json({
      success: true,
      sku
    });
  } catch (error) {
    console.error('Error checking SKU:', error);
    return NextResponse.json(
      { error: 'Failed to check SKU' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
