import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { loadlist_id, picklist_id, scanned_code } = body;

    if (!loadlist_id || !picklist_id || !scanned_code) {
      return NextResponse.json(
        { error: 'loadlist_id, picklist_id, and scanned_code are required' },
        { status: 400 }
      );
    }

    // Verify the picklist belongs to this loadlist
    const { data: loadlistPicklist, error: verifyError } = await supabase
      .from('wms_loadlist_picklists')
      .select('*')
      .eq('loadlist_id', loadlist_id)
      .eq('picklist_id', picklist_id)
      .single();

    if (verifyError || !loadlistPicklist) {
      return NextResponse.json(
        { error: 'ไม่พบใบจัดสินค้านี้ในใบโหลด', details: verifyError?.message },
        { status: 404 }
      );
    }

    // Get picklist details to verify the scanned code
    const { data: picklist, error: picklistError } = await supabase
      .from('picklists')
      .select('picklist_code, status')
      .eq('id', picklist_id)
      .single();

    if (picklistError || !picklist) {
      return NextResponse.json(
        { error: 'ไม่พบใบจัดสินค้า', details: picklistError?.message },
        { status: 404 }
      );
    }

    // Verify the scanned code matches the picklist code
    if (picklist.picklist_code.toUpperCase() !== scanned_code.toUpperCase()) {
      return NextResponse.json(
        { error: 'รหัสที่สแกนไม่ตรงกับใบจัดสินค้า', details: `คาดหวัง: ${picklist.picklist_code}, สแกน: ${scanned_code}` },
        { status: 400 }
      );
    }

    // Check if picklist is completed
    if (picklist.status !== 'completed') {
      return NextResponse.json(
        { error: 'ใบจัดสินค้ายังไม่พร้อมโหลด', details: `สถานะปัจจุบัน: ${picklist.status}` },
        { status: 400 }
      );
    }

    // Check if already loaded
    if (loadlistPicklist.loaded_at) {
      return NextResponse.json(
        { error: 'ใบจัดสินค้านี้โหลดแล้ว', details: 'This picklist has already been loaded' },
        { status: 400 }
      );
    }

    // Update loading status in wms_loadlist_picklists
    const { error: updateError } = await supabase
      .from('wms_loadlist_picklists')
      .update({
        loaded_at: new Date().toISOString(),
        loaded_by_employee_id: null, // TODO: Get from auth
        updated_at: new Date().toISOString()
      })
      .eq('loadlist_id', loadlist_id)
      .eq('picklist_id', picklist_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'ไม่สามารถอัปเดตสถานะการโหลดได้', details: updateError.message },
        { status: 500 }
      );
    }

    // No need to update loadlist status - we only have 'pending' and 'loaded'
    // Status will be updated to 'loaded' when all picklists are loaded and confirmed

    return NextResponse.json({ 
      success: true,
      message: 'โหลดใบจัดสินค้าสำเร็จ'
    });

  } catch (error) {
    console.error('API error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
