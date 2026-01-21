
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const migrationFile = 'supabase/migrations/277_create_get_sku_inventory_summary.sql';
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Applying migration:', migrationFile);

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    // Alternative method if exec_sql RPC is not available or fails
    if (error) {
        console.log('RPC exec_sql failed or not found, trying raw query if possible (not supported by js client directly usually)');
        console.error('Error applying migration:', error);
        // Note: Supabase JS client doesn't support raw SQL query execution unless via RPC
        // Assuming the user has a setup for this or we rely on RPC.
        // Let's try to assume we have a `exec` or similar function if exec_sql fails?
        // Actually, standard practice here is to define the function.
        // But wait! We are defining a function. We can't define a function using another function easily if permissions are tricky.
        // Let's hope the user has a way to run SQL.
        // If this fails, I'll have to ask the user to run it or use a different method.

        // BUT, `get_sku_inventory_summary` creation is just a string.
        // Let's try to see if we can use the `postgres` tool if available? NO.

        // Let's just try to call a standard "exec" function if it exists.
        // Many projects have `exec_sql(query text)`
    } else {
        console.log('Migration applied successfully!');
    }
}

applyMigration();
