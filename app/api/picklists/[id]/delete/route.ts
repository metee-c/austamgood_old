import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * DELETE /api/picklists/[id]/delete
 * ลบ Picklist และปลดล็อคยอดจองในบ้านหยิบ
 * เฉพาะผู้ใช้ metee.c@buzzpetsfood.com เท่านั้น
 */
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }>; user: any }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    // ตรวจสอบ user email
    const userEmail = context.user?.email;
    
    if (!userEmail || userEmail !== 'metee.c@buzzpetsfood.com') {
      return NextResponse.json(
        { error: 'Unauthorized: Only metee.c@buzzpetsfood.com can delete picklists' },
        { status: 403 }
      );
    }

    console.log(`🗑️ Deleting picklist ${id} by ${userEmail}`);

    // ✅ NEW: เรียกใช้ release_reservation_split_balance() แทนการลด reserved_piece_qty โดยตรง
    const { data: reservedBalances } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id')
      .eq('is_reserved_split', true)
      .eq('reserved_for_document_type', 'picklist')
      .eq('reserved_for_document_id', id);

    console.log(`📋 Found ${reservedBalances?.length || 0} reserved balances to release`);

    // Release each reserved balance
    if (reservedBalances && reservedBalances.length > 0) {
      for (const balance of reservedBalances) {
        const { data: releaseResult, error: releaseError } = await supabase
          .rpc('release_reservation_split_balance', {
            p_reserved_balance_id: balance.balance_id,
            p_released_by_user_id: context.user?.user_id || null,
            p_reason: 'ลบ Picklist'
          });

        if (releaseError) {
          console.error(`❌ Error releasing balance ${balance.balance_id}:`, releaseError);
          return NextResponse.json(
            { error: `Failed to release balance: ${releaseError.message}` },
            { status: 500 }
          );
        } else {
          console.log(`✅ Released balance ${balance.balance_id} → ${releaseResult[0].merged_to_balance_id}`);
        }
      }
    }

    // ลบ picklist_items
    const { error: deleteItemsError } = await supabase
      .from('picklist_items')
      .delete()
      .eq('picklist_id', id);

    if (deleteItemsError) {
      console.error('Error deleting picklist items:', deleteItemsError);
      return NextResponse.json(
        { error: 'Failed to delete picklist items: ' + deleteItemsError.message },
        { status: 500 }
      );
    }
    console.log(`✅ Deleted picklist items`);

    // ลบ picklist
    const { error: deletePicklistError } = await supabase
      .from('picklists')
      .delete()
      .eq('id', id);

    if (deletePicklistError) {
      console.error('Error deleting picklist:', deletePicklistError);
      return NextResponse.json(
        { error: 'Failed to delete picklist: ' + deletePicklistError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully deleted picklist ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Picklist deleted successfully',
      released_reservations: reservedBalances?.length || 0
    });

  } catch (error) {
    console.error('API Error in DELETE /api/picklists/[id]/delete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const DELETE = withShadowLog(withAuth(handleDelete));
