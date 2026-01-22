// Fix balance from ledger for pallets moved today
// ปัญหา: Balance เพิ่มขึ้น 3 เท่า (84 → 252) เพราะ balance sync trigger มีปัญหา
// วิธีแก้: คำนวณ balance ใหม่จาก ledger และอัปเดต

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixBalanceFromLedger() {
  console.log('🔍 กำลังตรวจสอบ balance ที่ผิดพลาดจาก ledger วันนี้...\n');

  // หา pallets ที่ถูกย้ายวันนี้
  const { data: todayMoves, error: moveError } = await supabase
    .from('wms_inventory_ledger')
    .select('pallet_id')
    .gte('movement_at', new Date().toISOString().split('T')[0])
    .eq('transaction_type', 'move')
    .not('pallet_id', 'is', null);

  if (moveError) {
    console.error('❌ Error fetching today moves:', moveError);
    return;
  }

  const uniquePallets = [...new Set(todayMoves.map(m => m.pallet_id))];
  console.log(`📦 พบ ${uniquePallets.length} pallets ที่ถูกย้ายวันนี้\n`);

  for (const palletId of uniquePallets) {
    console.log(`\n🔍 ตรวจสอบ pallet: ${palletId}`);

    // คำนวณ balance จาก ledger
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .select('*')
      .eq('pallet_id', palletId)
      .order('movement_at', { ascending: true });

    if (ledgerError) {
      console.error(`❌ Error fetching ledger for ${palletId}:`, ledgerError);
      continue;
    }

    // คำนวณ balance ตาม location
    const balanceByLocation = {};
    
    for (const entry of ledgerEntries) {
      const loc = entry.location_id;
      if (!balanceByLocation[loc]) {
        balanceByLocation[loc] = {
          location_id: loc,
          sku_id: entry.sku_id,
          pallet_id: entry.pallet_id,
          warehouse_id: entry.warehouse_id,
          production_date: entry.production_date,
          expiry_date: entry.expiry_date,
          pack_qty: 0,
          piece_qty: 0
        };
      }

      if (entry.direction === 'in') {
        balanceByLocation[loc].pack_qty += parseFloat(entry.pack_qty || 0);
        balanceByLocation[loc].piece_qty += parseFloat(entry.piece_qty || 0);
      } else if (entry.direction === 'out') {
        balanceByLocation[loc].pack_qty -= parseFloat(entry.pack_qty || 0);
        balanceByLocation[loc].piece_qty -= parseFloat(entry.piece_qty || 0);
      }
    }

    console.log('📊 Balance ที่คำนวณจาก ledger:');
    for (const [loc, bal] of Object.entries(balanceByLocation)) {
      console.log(`  ${loc}: ${bal.piece_qty} ชิ้น`);
    }

    // ดึง balance ปัจจุบันจาก database
    const { data: currentBalances, error: balError } = await supabase
      .from('wms_inventory_balances')
      .select('*')
      .eq('pallet_id', palletId);

    if (balError) {
      console.error(`❌ Error fetching balance for ${palletId}:`, balError);
      continue;
    }

    console.log('💾 Balance ปัจจุบันใน database:');
    for (const bal of currentBalances) {
      console.log(`  ${bal.location_id}: ${bal.total_piece_qty} ชิ้น`);
    }

    // เปรียบเทียบและแก้ไข
    for (const [loc, expectedBal] of Object.entries(balanceByLocation)) {
      const currentBal = currentBalances.find(b => b.location_id === loc);

      if (!currentBal && expectedBal.piece_qty > 0) {
        console.log(`⚠️  ไม่พบ balance ที่ ${loc} แต่ควรมี ${expectedBal.piece_qty} ชิ้น`);
        // ไม่สร้างใหม่ เพราะอาจมีปัญหาอื่น
        continue;
      }

      if (currentBal) {
        const currentQty = parseFloat(currentBal.total_piece_qty);
        const expectedQty = expectedBal.piece_qty;

        if (Math.abs(currentQty - expectedQty) > 0.01) {
          console.log(`🔧 แก้ไข balance ที่ ${loc}:`);
          console.log(`   จาก: ${currentQty} ชิ้น`);
          console.log(`   เป็น: ${expectedQty} ชิ้น`);

          if (expectedQty === 0) {
            // ลบ balance ถ้าเป็น 0
            const { error: deleteError } = await supabase
              .from('wms_inventory_balances')
              .delete()
              .eq('balance_id', currentBal.balance_id);

            if (deleteError) {
              console.error(`   ❌ Error deleting balance:`, deleteError);
            } else {
              console.log(`   ✅ ลบ balance สำเร็จ`);
            }
          } else {
            // อัปเดต balance
            const { error: updateError } = await supabase
              .from('wms_inventory_balances')
              .update({
                total_pack_qty: expectedBal.pack_qty,
                total_piece_qty: expectedBal.piece_qty,
                updated_at: new Date().toISOString()
              })
              .eq('balance_id', currentBal.balance_id);

            if (updateError) {
              console.error(`   ❌ Error updating balance:`, updateError);
            } else {
              console.log(`   ✅ อัปเดต balance สำเร็จ`);
            }
          }
        } else {
          console.log(`✅ Balance ที่ ${loc} ถูกต้องแล้ว (${currentQty} ชิ้น)`);
        }
      }
    }

    // ลบ balance ที่ไม่ควรมี (ไม่มีใน ledger)
    for (const currentBal of currentBalances) {
      if (!balanceByLocation[currentBal.location_id]) {
        console.log(`⚠️  พบ balance ที่ ${currentBal.location_id} แต่ไม่มีใน ledger - ลบออก`);
        
        const { error: deleteError } = await supabase
          .from('wms_inventory_balances')
          .delete()
          .eq('balance_id', currentBal.balance_id);

        if (deleteError) {
          console.error(`   ❌ Error deleting orphan balance:`, deleteError);
        } else {
          console.log(`   ✅ ลบ orphan balance สำเร็จ`);
        }
      }
    }
  }

  console.log('\n✅ เสร็จสิ้น!');
}

fixBalanceFromLedger().catch(console.error);
