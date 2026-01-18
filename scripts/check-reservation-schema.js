require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  // ดึง reservation 1 รายการเพื่อดู columns
  const { data, error } = await supabase
    .from('picklist_item_reservations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Columns in picklist_item_reservations:');
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log('No data found - checking schema from empty table');
  }
}

checkSchema();
