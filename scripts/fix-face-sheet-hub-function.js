/**
 * Fix create_face_sheet_packages function to use ONLY master_customer.hub
 * If hub is empty/null, leave it as NULL (don't fallback to notes or province)
 * 
 * Usage: node scripts/fix-face-sheet-hub-function.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFunction() {
  console.log('Getting current function definition...');
  
  // Get function definition
  const { data: funcData, error: funcError } = await supabase
    .rpc('get_function_definition', { func_name: 'create_face_sheet_packages' });
  
  if (funcError) {
    // Try direct SQL
    const { data, error } = await supabase.from('_temp').select('*').limit(0);
  }
  
  // Execute the fix using regexp_replace in SQL
  const fixSql = `
    DO $$
    DECLARE
      v_func_def TEXT;
      v_new_func TEXT;
    BEGIN
      -- Get current function definition
      SELECT pg_get_functiondef(oid) INTO v_func_def
      FROM pg_proc
      WHERE proname = 'create_face_sheet_packages';
      
      -- Replace all COALESCE patterns with just NULLIF(shop_rec.hub, '')
      v_new_func := regexp_replace(
        v_func_def,
        E'COALESCE\\(NULLIF\\(shop_rec\\.hub, ''''\\), NULLIF\\(TRIM\\([^)]+\\), ''''\\), [^)]+\\)',
        E'NULLIF(shop_rec.hub, '''')',
        'g'
      );
      
      -- Execute the modified function
      EXECUTE v_new_func;
      
      RAISE NOTICE 'Function updated successfully';
    END $$;
  `;
  
  console.log('Executing fix...');
  const { error } = await supabase.rpc('exec_sql', { sql: fixSql });
  
  if (error) {
    console.error('Error:', error.message);
    console.log('');
    console.log('Please run this SQL manually in Supabase SQL Editor:');
    console.log(fixSql);
  } else {
    console.log('Function updated successfully!');
  }
}

fixFunction().catch(console.error);
