import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
/**
 * DELETE /api/bonus-face-sheets/[id]/delete
 * ลบ Bonus Face Sheet และปลดล็อคยอดจองในบ้านหยิบ
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
        { error: 'Unauthorized: Only metee.c@buzzpetsfood.com can delete bonus face sheets' },
        { status: 403 }
      );
    }

    console.log(`🗑️ Deleting bonus face sheet ${id} by ${userEmail}`);

    // 1. ดึง bonus_face_sheet_item_reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('bonus_face_sheet_item_reservations')
      .select(`
        reservation_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        bonus_face_sheet_item_id,
        bonus_face_sheet_items!inner (
          face_sheet_id
        )
      `)
      .eq('bonus_face_sheet_items.face_sheet_id', id);

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError);
      return NextResponse.json(
        { error: 'Failed to fetch reservations: ' + reservationsError.message },
        { status: 500 }
      );
    }

    console.log(`📋 Found ${reservations?.length || 0} reservations to release`);

    // 2. ลดยอดจองใน wms_inventory_balances
    if (reservations && reservations.length > 0) {
      for (const reservation of reservations) {
        // ดึงยอดปัจจุบันก่อน
        const { data: currentBalance } = await supabase
          .from('wms_inventory_balances')
          .select('reserved_piece_qty, reserved_pack_qty')
          .eq('balance_id', reservation.balance_id)
          .single();

        if (currentBalance) {
          const newReservedPiece = Math.max(0, (currentBalance.reserved_piece_qty || 0) - (reservation.reserved_piece_qty || 0));
          const newReservedPack = Math.max(0, (currentBalance.reserved_pack_qty || 0) - (reservation.reserved_pack_qty || 0));

          const { error: updateError } = await supabase
            .from('wms_inventory_balances')
            .update({
              reserved_piece_qty: newReservedPiece,
              reserved_pack_qty: newReservedPack,
              updated_at: new Date().toISOString()
            })
            .eq('balance_id', reservation.balance_id);

          if (updateError) {
            console.error(`Error updating balance ${reservation.balance_id}:`, updateError);
          } else {
            console.log(`✅ Released reservation from balance ${reservation.balance_id}`);
          }
        }
      }
    }

    // 3. ลบ bonus_face_sheet_item_reservations
    if (reservations && reservations.length > 0) {
      const reservationIds = reservations.map(r => r.reservation_id);
      const { error: deleteReservationsError } = await supabase
        .from('bonus_face_sheet_item_reservations')
        .delete()
        .in('reservation_id', reservationIds);

      if (deleteReservationsError) {
        console.error('Error deleting reservations:', deleteReservationsError);
        return NextResponse.json(
          { error: 'Failed to delete reservations: ' + deleteReservationsError.message },
          { status: 500 }
        );
      }
      console.log(`✅ Deleted ${reservationIds.length} reservation records`);
    }

    // 4. ลบ bonus_face_sheet_items
    const { error: deleteItemsError } = await supabase
      .from('bonus_face_sheet_items')
      .delete()
      .eq('face_sheet_id', id);

    if (deleteItemsError) {
      console.error('Error deleting bonus face sheet items:', deleteItemsError);
      return NextResponse.json(
        { error: 'Failed to delete bonus face sheet items: ' + deleteItemsError.message },
        { status: 500 }
      );
    }
    console.log(`✅ Deleted bonus face sheet items`);

    // 5. ลบ bonus_face_sheets
    const { error: deleteBonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .delete()
      .eq('id', id);

    if (deleteBonusFaceSheetError) {
      console.error('Error deleting bonus face sheet:', deleteBonusFaceSheetError);
      return NextResponse.json(
        { error: 'Failed to delete bonus face sheet: ' + deleteBonusFaceSheetError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully deleted bonus face sheet ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Bonus face sheet deleted successfully',
      released_reservations: reservations?.length || 0
    });

  } catch (error) {
    console.error('API Error in DELETE /api/bonus-face-sheets/[id]/delete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const DELETE = withAuth(handleDelete);
