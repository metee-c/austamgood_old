// Script to check route plan statuses in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRoutePlans() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking route plans in database...\n');

  // Get all route plans with their status
  const { data: plans, error } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_name, status, plan_date, total_trips')
    .order('plan_date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!plans || plans.length === 0) {
    console.log('⚠️  No route plans found');
    return;
  }

  console.log(`📊 Found ${plans.length} route plans:\n`);

  // Group by status
  const byStatus: Record<string, any[]> = {};
  plans.forEach(plan => {
    const status = plan.status || 'null';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(plan);
  });

  // Display summary
  console.log('📈 Summary by status:');
  Object.keys(byStatus).forEach(status => {
    console.log(`  - ${status}: ${byStatus[status].length} plans`);
  });

  console.log('\n📋 Recent plans:');
  plans.slice(0, 10).forEach(plan => {
    console.log(`  ${plan.plan_code} | ${plan.plan_name} | Status: ${plan.status || 'null'} | Date: ${plan.plan_date} | Trips: ${plan.total_trips || 0}`);
  });
}

checkRoutePlans().catch(console.error);
