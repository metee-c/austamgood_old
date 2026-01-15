// Fix Face Sheet 83 over-reservations
// ปัญหา: มี 158 items ที่จองเกิน (reservation_count = 2-3 แต่ต้องการแค่ 1)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOverReservations() {
  console.log('🔧 Fixing Face Sheet 83 over-reservations...\n');

  try {
    // 1. ดึงรายการ items ที่มี over-reservation
    const { data: overReservedItems, error: fetchError } = await supabase
      .from('face_sheet_items')
      .select(`
        id,
        sku_id,
        quantity_to_pick,
        status,
        face_sheet_item_reservations!inner(
          reservation_id,
          balance_id,
          reserved_piece_qty,
          status
        )
      `)
      .eq('face_sheet_id', 83)
      .eq('face_sheet_item_reservations.status', 'reserved');

    if (fetchError) {
      console.error('❌ Error fetching over-reserved items:', fetchError);
      return;
    }

    // Group reservations by item
    const itemsMap = new Map();
    overReservedItems.forEach(item => {
      if (!itemsMap.has(item.id)) {
        itemsMap.set(item.id, {
          id: item.id,
          sku_id: item.sku_id,
          quantity_to_pick: parseFloat(item.quantity_to_pick),
          status: item.status,
          reservations: []
        });
      }
      itemsMap.get(item.id).reservations.push(item.face_sheet_item_reservations);
    });

    let fixedCount = 0;
    let totalReservationsDeleted = 0;
    let totalBalanceAdjusted = 0;

    // 2. แก้ไขแต่ละ item ที่มี over-reservation
    for (const [itemId, itemData] of itemsMap) {
      const reservations = itemData.reservations;
      const requiredQty = itemData.quantity_to_pick;
      const totalReserved = reservations.reduce((sum, res) => sum + parseFloat(res.reserved_piece_qty), 0);

      // ตรวจสอบว่ามี over-reservation หรือไม่
      if (totalReserved > requiredQty && reservations.length > 1) {
        console.log(`\n📦 Item ${itemId} (${itemData.sku_id})`);
        console.log(`   Required: ${requiredQty}, Reserved: ${totalReserved}, Count: ${reservations.length}`);

        // เรียงลำดับ reservations ตาม reservation_id (เก็บอันเก่าที่สุด)
        reservations.sort((a, b) => a.reservation_id - b.reservation_id);

        let remainingQty = requiredQty;
        const reservationsToKeep = [];
        const reservationsToDelete = [];

        // เลือก reservations ที่จะเก็บไว้
        for (const reservation of reservations) {
          const reservedQty = parseFloat(reservation.reserved_piece_qty);
          
          if (remainingQty > 0) {
            const qtyToKeep = Math.min(reservedQty, remainingQty);
            if (qtyToKeep === reservedQty) {
              // เก็บ reservation นี้ทั้งหมด
              reservationsToKeep.push(reservation);
              remainingQty -= qtyToKeep;
            } else if (qtyToKeep > 0) {
              // แก้ไข reservation นี้ให้เหลือแค่ที่ต้องการ
              reservationsToKeep.push({
                ...reservation,
                reserved_piece_qty: qtyToKeep,
                needsUpdate: true
              });
              remainingQty = 0;
              
              // ส่วนที่เหลือจะถูกลบ
              reservationsToDelete.push({
                ...reservation,
                excess_qty: reservedQty - qtyToKeep
              });
            }
          } else {
            // ลบ reservation นี้ทั้งหมด
            reservationsToDelete.push({
              ...reservation,
              excess_qty: reservedQty
            });
          }
        }

        console.log(`   ✅ Keep: ${reservationsToKeep.length}, Delete: ${reservationsToDelete.length}`);

        // 3. ลบ reservations ที่เกิน
        for (const reservation of reservationsToDelete) {
          const excessQty = reservation.excess_qty || parseFloat(reservation.reserved_piece_qty);
          
          // ลบ reservation
          const { error: deleteError } = await supabase
            .from('face_sheet_item_reservations')
            .delete()
            .eq('reservation_id', reservation.reservation_id);

          if (deleteError) {
            console.error(`   ❌ Error deleting reservation ${reservation.reservation_id}:`, deleteError);
            continue;
          }

          // ลด reserved_piece_qty ใน balance
          const { error: balanceError } = await supabase
            .from('wms_inventory_balances')
            .update({
              reserved_piece_qty: supabase.raw(`reserved_piece_qty - ${excessQty}`),
              reserved_pack_qty: supabase.raw(`reserved_pack_qty - ${excessQty}`),
              updated_at: new Date().toISOString()
            })
            .eq('balance_id', reservation.balance_id);

          if (balanceError) {
            console.error(`   ❌ Error updating balance ${reservation.balance_id}:`, balanceError);
          } else {
            console.log(`   🔄 Deleted reservation ${reservation.reservation_id}, reduced balance by ${excessQty}`);
            totalReservationsDeleted++;
            totalBalanceAdjusted++;
          }
        }

        // 4. อัปเดต reservations ที่ต้องแก้ไขจำนวน
        for (const reservation of reservationsToKeep) {
          if (reservation.needsUpdate) {
            const originalQty = parseFloat(reservation.reserved_piece_qty);
            const newQty = reservation.reserved_piece_qty;
            const reduction = originalQty - newQty;

            // อัปเดต reservation
            const { error: updateResError } = await supabase
              .from('face_sheet_item_reservations')
              .update({
                reserved_piece_qty: newQty,
                reserved_pack_qty: newQty,
                updated_at: new Date().toISOString()
              })
              .eq('reservation_id', reservation.reservation_id);

            if (updateResError) {
              console.error(`   ❌ Error updating reservation ${reservation.reservation_id}:`, updateResError);
              continue;
            }

            // ลด reserved_piece_qty ใน balance
            const { error: balanceError } = await supabase
              .from('wms_inventory_balances')
              .update({
                reserved_piece_qty: supabase.raw(`reserved_piece_qty - ${reduction}`),
                reserved_pack_qty: supabase.raw(`reserved_pack_qty - ${reduction}`),
                updated_at: new Date().toISOString()
              })
              .eq('balance_id', reservation.balance_id);

            if (balanceError) {
              console.error(`   ❌ Error updating balance ${reservation.balance_id}:`, balanceError);
            } else {
              console.log(`   🔄 Updated reservation ${reservation.reservation_id}, reduced balance by ${reduction}`);
              totalBalanceAdjusted++;
            }
          }
        }

        fixedCount++;
      }
    }

    console.log(`\n✅ Fix completed:`);
    console.log(`   📦 Items fixed: ${fixedCount}`);
    console.log(`   🗑️ Reservations deleted: ${totalReservationsDeleted}`);
    console.log(`   ⚖️ Balances adjusted: ${totalBalanceAdjusted}`);

    // 5. ตรวจสอบผลลัพธ์
    console.log('\n🔍 Verification after fix:');
    const { data: verifyData } = await supabase.rpc('exec', {
      sql: `
        SELECT 
          COUNT(*) FILTER (WHERE total_reserved_qty > quantity_to_pick) as over_reserved_count,
          COUNT(*) FILTER (WHERE total_reserved_qty = quantity_to_pick) as correct_count,
          COUNT(*) FILTER (WHERE total_reserved_qty < quantity_to_pick) as under_reserved_count
        FROM (
          SELECT 
            fsi.id,
            fsi.quantity_to_pick,
            COALESCE(SUM(fsir.reserved_piece_qty), 0) as total_reserved_qty
          FROM face_sheet_items fsi
          LEFT JOIN face_sheet_item_reservations fsir ON fsir.face_sheet_item_id = fsi.id AND fsir.status = 'reserved'
          WHERE fsi.face_sheet_id = 83 AND fsi.status = 'reserved'
          GROUP BY fsi.id, fsi.quantity_to_pick
        ) summary
      `
    });

    if (verifyData && verifyData.length > 0) {
      const result = verifyData[0];
      console.log(`   ✅ Correct reservations: ${result.correct_count}`);
      console.log(`   ⚠️ Over-reserved: ${result.over_reserved_count}`);
      console.log(`   ❌ Under-reserved: ${result.under_reserved_count}`);
    }

  } catch (error) {
    console.error('💥 Error fixing over-reservations:', error);
  }
}

// Run the fix
fixOverReservations().catch(console.error);