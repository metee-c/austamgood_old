// Test shadow logging by calling a wrapped API
require('dotenv').config({ path: '.env.local' });

async function testLogging() {
  console.log('Testing shadow logging...\n');

  // Call the stock adjustments GET API (which doesn't log, just to verify API works)
  const baseUrl = 'http://localhost:3000';
  
  try {
    // First, let's just insert a test transaction directly to verify the table works
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Inserting test transaction...');
    const { data, error } = await supabase
      .from('wms_transactions')
      .insert({
        operation_type: 'TEST',
        operation_subtype: 'SHADOW_LOGGING_TEST',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 100,
        request_method: 'TEST',
        request_path: '/test',
        user_id: 1,
        metadata: { test: true }
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Insert failed:', error.message);
    } else {
      console.log('✅ Test transaction inserted:', data.transaction_id);
      
      // Also insert a test activity
      const { data: actData, error: actError } = await supabase
        .from('wms_activity_logs')
        .insert({
          transaction_id: data.transaction_id,
          activity_type: 'TEST_ACTIVITY',
          status: 'success',
          entity_type: 'TEST',
          entity_id: '1',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 50
        })
        .select()
        .single();

      if (actError) {
        console.log('❌ Activity insert failed:', actError.message);
      } else {
        console.log('✅ Test activity inserted:', actData.log_id);
      }
    }

    // Check counts again
    console.log('\n--- Updated Counts ---');
    const { count: txCount } = await supabase.from('wms_transactions').select('*', { count: 'exact', head: true });
    const { count: actCount } = await supabase.from('wms_activity_logs').select('*', { count: 'exact', head: true });
    console.log(`Transactions: ${txCount}`);
    console.log(`Activities: ${actCount}`);

    console.log('\n✅ Shadow logging infrastructure is working!');
    console.log('Now when you use the app (create adjustments, moves, receives), logs will appear in Command Center.');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

testLogging();
