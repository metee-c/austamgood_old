import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iwlkslewdgenckuejbit.supabase.co';
// Using anon key from .env.local
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bGtzbGV3ZGdlbmNrdWVqYml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNzUwNjksImV4cCI6MjA3MzY1MTA2OX0.eD-XwISz_SUllwKnsm8PNuMbiDPJ-gfX8wYFncknVNo';

console.log('Using URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting Supabase Database Schema...\n');

    // Query to get all tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('*')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);

      // Try alternative method using RPC
      const { data: rpcTables, error: rpcError } = await supabase.rpc('get_all_tables');
      if (rpcError) {
        console.log('Attempting direct query method...\n');
        await inspectWithDirectQueries();
        return;
      }
    }

    console.log('Tables found:', tables);
  } catch (error) {
    console.error('Error:', error);
    await inspectWithDirectQueries();
  }
}

async function inspectWithDirectQueries() {
  console.log('📊 Inspecting tables using direct queries...\n');

  const knownTables = [
    'master_sku',
    'bom_sku',
    'master_warehouse',
    'master_location',
    'master_supplier',
    'master_customer',
    'master_vehicle',
    'master_warehouse_asset',
    'master_freight_rate',
    'master_employee',
    'master_iv_document_type',
    'master_customer_no_price_goods',
    'file_uploads',
    'import_jobs',
    'export_jobs',
    'users',
    'roles',
    'user_roles',
    'permissions',
    'role_permissions',
    'wms_receive_universal',
    'wms_receives',
    'wms_receive_items',
    'wms_inventory',
    'wms_inventory_transactions',
    'wms_orders',
    'wms_order_items',
    'wms_picklists',
    'wms_picklist_items',
    'wms_loadlists',
    'wms_loadlist_items',
    'wms_moves',
    'wms_move_items',
    'face_sheets',
    'face_sheet_items',
    'receiving_route_plans',
    'receiving_route_trips',
    'receiving_route_stops',
    'receiving_route_stop_items',
    'receiving_route_clusters',
    'receiving_route_plan_inputs',
    'receiving_route_plan_metrics',
    'production_orders',
    'production_order_items',
    'production_bom_items',
    'purchase_orders',
    'purchase_order_items',
    'storage_strategies',
    'preparation_areas',
  ];

  const results: any = {};

  for (const tableName of knownTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        results[tableName] = {
          exists: true,
          rowCount: count || 0
        };
        console.log(`✅ ${tableName}: ${count || 0} rows`);
      } else {
        results[tableName] = {
          exists: false,
          error: error.message
        };
        console.log(`❌ ${tableName}: ${error.message}`);
      }
    } catch (err: any) {
      results[tableName] = {
        exists: false,
        error: err.message
      };
      console.log(`❌ ${tableName}: ${err.message}`);
    }
  }

  console.log('\n📝 Generating summary...\n');
  console.log(JSON.stringify(results, null, 2));
}

inspectDatabase().then(() => {
  console.log('\n✨ Database inspection complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
