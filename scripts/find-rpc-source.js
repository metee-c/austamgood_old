#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findRPCSource() {
  try {
    const dateFrom = '2026-02-01';
    const dateTo = '2026-02-28';

    console.log('\n🔎 ค้นหาแหล่งข้อมูลของ RPC sum_outbound_weight\n');

    // Test RPC
    const { data: rpcResult } = await supabase.rpc('sum_outbound_weight', {
      date_from: dateFrom,
      date_to: dateTo
    });
    console.log(`✅ RPC Result: ${(rpcResult / 1000).toFixed(1)} ตัน (${rpcResult} กรัม)\n`);

    // Test various table combinations
    console.log('📊 ทดสอบแหล่งข้อมูลต่างๆ:\n');

    // 1. wms_orders.total_weight (delivery_date)
    const { data: orders1 } = await supabase
      .from('wms_orders')
      .select('total_weight')
      .gte('delivery_date', dateFrom)
      .lte('delivery_date', dateTo);
    const sum1 = orders1.reduce((s, o) => s + (o.total_weight || 0), 0);
    const match1 = Math.abs(sum1 - rpcResult) < 100;
    console.log(`${match1 ? '✅' : '❌'} wms_orders.total_weight (delivery_date): ${(sum1 / 1000).toFixed(1)} ตัน`);

    // 2. wms_orders.total_weight (created_at)
    const { data: orders2 } = await supabase
      .from('wms_orders')
      .select('total_weight')
      .gte('created_at', dateFrom)
      .lt('created_at', '2026-03-01');
    const sum2 = orders2.reduce((s, o) => s + (o.total_weight || 0), 0);
    const match2 = Math.abs(sum2 - rpcResult) < 100;
    console.log(`${match2 ? '✅' : '❌'} wms_orders.total_weight (created_at): ${(sum2 / 1000).toFixed(1)} ตัน`);

    // 3. wms_order_items (pack_qty * unit_weight) with delivery_date
    const { data: items1, error: items1Error } = await supabase
      .from('wms_order_items')
      .select('pack_qty, unit_weight, wms_orders!inner(delivery_date)')
      .gte('wms_orders.delivery_date', dateFrom)
      .lte('wms_orders.delivery_date', dateTo);

    if (items1) {
      const sum3 = items1.reduce((s, i) => s + ((i.pack_qty || 0) * (i.unit_weight || 0)), 0);
      const match3 = Math.abs(sum3 - rpcResult) < 100;
      console.log(`${match3 ? '✅' : '❌'} wms_order_items (delivery_date): ${(sum3 / 1000).toFixed(1)} ตัน`);
    } else {
      console.log(`❌ wms_order_items (delivery_date): Error - ${items1Error?.message}`);
    }

    // 4. wms_order_items (pack_qty * unit_weight) with created_at
    const { data: items2 } = await supabase
      .from('wms_order_items')
      .select('pack_qty, unit_weight, wms_orders!inner(created_at)')
      .gte('wms_orders.created_at', dateFrom)
      .lt('wms_orders.created_at', '2026-03-01');

    const sum4 = items2.reduce((s, i) => s + ((i.pack_qty || 0) * (i.unit_weight || 0)), 0);
    const match4 = Math.abs(sum4 - rpcResult) < 100;
    console.log(`${match4 ? '✅' : '❌'} wms_order_items (created_at): ${(sum4 / 1000).toFixed(1)} ตัน`);

    // 5. wms_inventory_ledger (OUT movements)
    const { data: ledger } = await supabase
      .from('wms_inventory_ledger')
      .select('movement_qty_piece, unit_weight, reference_doc_type')
      .eq('transaction_type', 'OUT')
      .in('reference_doc_type', ['order', 'face_sheet', 'bonus_face_sheet'])
      .gte('created_at', dateFrom)
      .lt('created_at', '2026-03-01');

    if (ledger) {
      const sum5 = ledger.reduce((s, l) => s + (Math.abs(l.movement_qty_piece || 0) * (l.unit_weight || 0)), 0);
      const match5 = Math.abs(sum5 - rpcResult) < 100;
      console.log(`${match5 ? '✅' : '❌'} wms_inventory_ledger (OUT): ${(sum5 / 1000).toFixed(1)} ตัน`);
    }

    // 6. Combination: orders + face_sheets
    const { data: faceSheets } = await supabase
      .from('face_sheets')
      .select('total_items')
      .gte('delivery_date', dateFrom)
      .lte('delivery_date', dateTo);

    const { data: bonusFaceSheets } = await supabase
      .from('bonus_face_sheets')
      .select('total_items')
      .gte('delivery_date', dateFrom)
      .lte('delivery_date', dateTo);

    console.log(`\nℹ️  เพิ่มเติม:`);
    console.log(`   Face sheets: ${faceSheets?.length || 0} ใบ`);
    console.log(`   Bonus face sheets: ${bonusFaceSheets?.length || 0} ใบ`);

    console.log(`\n💡 สรุป:`);
    console.log(`   RPC function ใช้ข้อมูลจาก: ${match1 ? 'delivery_date' : match2 ? 'created_at' : match3 ? 'items+delivery' : match4 ? 'items+created' : match5 ? 'ledger' : 'ไม่ทราบ'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findRPCSource();
