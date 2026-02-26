#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProvinceWeight() {
  try {
    const dateFrom = '2026-02-01';
    const dateTo = '2026-02-28';

    console.log('\n🔍 ตรวจสอบน้ำหนักสินค้าออกตามจังหวัด');
    console.log(`📅 ช่วงเวลา: ${dateFrom} ถึง ${dateTo}\n`);

    // Test RPC function
    console.log('📊 ทดสอบ RPC function sum_outbound_weight:');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('sum_outbound_weight', {
      date_from: dateFrom,
      date_to: dateTo
    });

    if (rpcError) {
      console.log('   ❌ Error:', rpcError.message);
    } else {
      console.log(`   ✅ ผลลัพธ์: ${(rpcResult / 1000).toFixed(1)} ตัน\n`);
    }

    // Query with filter (loaded, in_transit, delivered)
    const { data: filtered } = await supabase.from('wms_orders')
      .select('province, status, total_weight, delivery_date')
      .gte('delivery_date', dateFrom)
      .lte('delivery_date', dateTo)
      .in('status', ['loaded', 'in_transit', 'delivered'])
      .not('province', 'is', null);

    const totalFiltered = filtered.reduce((sum, o) => sum + (o.total_weight || 0), 0);
    console.log('📊 น้ำหนักรวม (loaded+in_transit+delivered):');
    console.log(`   ${(totalFiltered / 1000).toFixed(1)} ตัน`);
    console.log(`   ${filtered.length} ออเดอร์\n`);

    // Query ALL orders with delivery_date
    const { data: all } = await supabase.from('wms_orders')
      .select('order_id, province, status, total_weight, delivery_date, created_at')
      .gte('delivery_date', dateFrom)
      .lte('delivery_date', dateTo);

    const totalAll = all.reduce((sum, o) => sum + (o.total_weight || 0), 0);
    console.log('📊 น้ำหนักรวม (ทุก status, delivery_date):');
    console.log(`   ${(totalAll / 1000).toFixed(1)} ตัน`);
    console.log(`   ${all.length} ออเดอร์\n`);

    // Query ALL orders with created_at (ตาม KPI อาจใช้ created_at)
    const { data: allCreated } = await supabase.from('wms_orders')
      .select('order_id, province, status, total_weight, delivery_date, created_at')
      .gte('created_at', dateFrom)
      .lt('created_at', '2026-03-01');

    const totalCreated = allCreated.reduce((sum, o) => sum + (o.total_weight || 0), 0);
    console.log('📊 น้ำหนักรวม (created_at):');
    console.log(`   ${(totalCreated / 1000).toFixed(1)} ตัน`);
    console.log(`   ${allCreated.length} ออเดอร์\n`);

    // Show status breakdown
    console.log('📋 แยกตาม status (delivery_date):');
    const statusMap = {};
    all.forEach(o => {
      if (!statusMap[o.status]) {
        statusMap[o.status] = { count: 0, weight: 0 };
      }
      statusMap[o.status].count++;
      statusMap[o.status].weight += o.total_weight || 0;
    });

    Object.entries(statusMap)
      .sort((a, b) => b[1].weight - a[1].weight)
      .forEach(([status, data]) => {
        const tons = (data.weight / 1000).toFixed(1);
        const percent = totalAll > 0 ? ((data.weight / totalAll) * 100).toFixed(1) : 0;
        console.log(`   ${status.padEnd(15)} ${data.count.toString().padStart(4)} ออเดอร์  ${tons.padStart(6)} ตัน  (${percent}%)`);
      });

    console.log('\n💡 สรุป:');
    console.log(`   RPC sum_outbound_weight: ${(rpcResult / 1000).toFixed(1)} ตัน`);
    console.log(`   wms_orders (delivery_date, all status): ${(totalAll / 1000).toFixed(1)} ตัน`);
    console.log(`   wms_orders (delivery_date, loaded+in_transit+delivered): ${(totalFiltered / 1000).toFixed(1)} ตัน`);
    console.log(`   wms_orders (created_at, all status): ${(totalCreated / 1000).toFixed(1)} ตัน`);

    console.log('\n⚠️  ปัญหา:');
    console.log('   KPI "สินค้าออก" แสดง: 399.3 ตัน');
    console.log(`   ตาราง "Top 10 จังหวัด" แสดง: ${(totalFiltered / 1000).toFixed(1)} ตัน`);
    console.log(`   ต่างกัน: ${(rpcResult - totalFiltered) / 1000} ตัน`);

    console.log('\n🔎 สาเหตุที่เป็นไปได้:');
    console.log('   1. RPC function อาจใช้ created_at แทน delivery_date');
    console.log('   2. RPC function อาจรวม order ที่ไม่มี province');
    console.log('   3. RPC function อาจใช้ตาราง/field อื่น (เช่น wms_order_items)');

    console.log('\n✅ แนวทางแก้ไข:');
    console.log('   1. ตรวจสอบ definition ของ RPC function sum_outbound_weight');
    console.log('   2. แก้ province query ให้ใช้ criteria เดียวกับ RPC');
    console.log('   3. หรือแก้ RPC ให้ใช้ criteria เดียวกับ province query\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProvinceWeight();
