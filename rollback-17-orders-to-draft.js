/**
 * Rollback 17 Orders to Draft Status
 * 
 * This script resets the 17 orders from 2026-01-19 back to 'draft' status
 * so they can be selected for creating a new face sheet.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The 17 order numbers from the face sheet
const ORDER_NUMBERS = [
  'IV26011042',
  'IV26011048',
  'IV26011039',
  'IV26011023',
  'IV26011043',
  'IV26011021',
  'IV26011052',
  'IV26011044',
  'IV26011013',
  'IV26011014',
  'IV26011022',
  'IV26010978',
  'IV26010977',
  'IV26011056',
  'IV26011041',
  'IV26011038',
  'IV26011045'
];

async function rollbackOrders() {
  console.log('🔄 Rolling back 17 orders to draft status...\n');
  console.log('='.repeat(70));
  console.log('\n');
  
  try {
    // Step 1: Check current status
    console.log('📋 Step 1: Checking current order status...\n');
    
    const { data: orders, error: fetchError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status, delivery_date')
      .in('order_no', ORDER_NUMBERS)
      .eq('order_type', 'express');
    
    if (fetchError) {
      console.error('❌ Error fetching orders:', fetchError.message);
      return;
    }
    
    if (!orders || orders.length === 0) {
      console.log('⚠️  No orders found!');
      return;
    }
    
    console.log(`   Found ${orders.length} orders:\n`);
    
    const statusCounts = {};
    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      console.log(`   - ${order.order_no}: ${order.status}`);
    });
    
    console.log('\n   Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} orders`);
    });
    console.log('\n');
    
    // Get delivery date from found orders
    const deliveryDate = orders[0]?.delivery_date;
    console.log(`   Delivery Date: ${deliveryDate}\n`);
    
    // Step 2: Update to draft
    console.log('📋 Step 2: Updating orders to draft status...\n');
    
    const { data: updated, error: updateError } = await supabase
      .from('wms_orders')
      .update({ 
        status: 'draft',
        updated_at: new Date().toISOString()
      })
      .in('order_no', ORDER_NUMBERS)
      .eq('order_type', 'express')
      .select('order_id, order_no, status');
    
    if (updateError) {
      console.error('❌ Error updating orders:', updateError.message);
      return;
    }
    
    console.log(`   ✅ Updated ${updated.length} orders to draft\n`);
    
    // Step 3: Verify
    console.log('📋 Step 3: Verifying update...\n');
    
    const { data: verified, error: verifyError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status, delivery_date')
      .in('order_no', ORDER_NUMBERS)
      .eq('order_type', 'express');
    
    if (verifyError) {
      console.error('❌ Error verifying:', verifyError.message);
      return;
    }
    
    const draftCount = verified.filter(o => o.status === 'draft').length;
    const otherCount = verified.filter(o => o.status !== 'draft').length;
    
    console.log(`   Draft: ${draftCount} orders`);
    if (otherCount > 0) {
      console.log(`   Other: ${otherCount} orders`);
      console.log('\n   Orders not in draft:');
      verified.filter(o => o.status !== 'draft').forEach(o => {
        console.log(`   - ${o.order_no}: ${o.status}`);
      });
    }
    console.log('\n');
    
    // Final result
    console.log('='.repeat(70));
    if (draftCount === ORDER_NUMBERS.length) {
      console.log('✅ SUCCESS: All 17 orders are now in draft status!\n');
      console.log('🔄 Next steps:');
      console.log('   1. Go to: http://localhost:3000/receiving/picklists/face-sheets');
      console.log('   2. Click "สร้างใบปะหน้า"');
      console.log(`   3. Select date: ${deliveryDate ? new Date(deliveryDate).toLocaleDateString('th-TH') : '19/01/2569'}`);
      console.log('   4. Select all 17 orders');
      console.log('   5. Click "สร้าง"');
      console.log('   6. Should create 196 packages (not 87)');
    } else {
      console.log(`⚠️  WARNING: Only ${draftCount}/${ORDER_NUMBERS.length} orders are in draft`);
      console.log('   Some orders may have dependencies that prevent status change');
    }
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

rollbackOrders();
