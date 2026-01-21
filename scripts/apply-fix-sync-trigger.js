
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260121100000_fix_sync_location_qty_trigger.sql');
    console.log(`Applying migration: ${migrationPath}`);

    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // We can't execute raw SQL directly via JS client usually, unless we have a specific RPC or use edge functions.
        // However, if the user has a setup to run SQL, we might use that.
        // If not, we can assume Supabase 'postgres' level access via connection string, but we only have JS client here.
        // Often in these environments, there's a helper or we create an RPC.

        // Let's try to wrap it in an RPC call if "exec_sql" or similar exists, otherwise we warn.
        // Actually, checking previous history, often we use `run-migrations.js` or similar if available, or just direct SQL if pg client is available.
        // Since we only see supabase-js, let's look for a generic `exec_sql` rpc which is common in dev setups.

        /* 
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); 
        */

        // If no such RPC, we might need to instruct the user or use a direct connection string if available (it is not in the env vars usually exposed).
        // Wait, let's check if there is a known way to run migrations in this project.
        // 'npm run db:migrate' is available in package.json! 
        // "db:migrate": "supabase db migrate"

        console.log('Please run "npm run db:migrate" or push this migration via Supabase CLI.');
        console.log('For immediate persistence, I will try to use the `exec_sql` RPC if available, otherwise manual execution is needed.');

        const { data, error } = await supabase.rpc('exec_sql', { query: sql });

        if (error) {
            console.log('RPC execution failed (maybe exec_sql does not exist):', error.message);
            console.log('You should run current migration manually via Supabase dashboard SQL editor or CLI.');
        } else {
            console.log('Migration applied successfully via RPC!');
        }

    } catch (err) {
        console.error('Error reading migration file:', err);
    }
}

// Check if we can run via RPC - searching for a helper script pattern
// Previous scripts used 'exec_sql' RPC in 'rollback-17-orders-to-draft.js' (implied) or similar? 
// No, looking at file list, 'run-migration-244.js' seems relevant. Let's see how it does it.

applyMigration();
