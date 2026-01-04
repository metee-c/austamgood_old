require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('master_system_user')
    .select('user_id, username, full_name, employee_id')
    .eq('is_active', true)
    .order('user_id')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('System Users with employee_id:');
  console.table(data);
}

main();
