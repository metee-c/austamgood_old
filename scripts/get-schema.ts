import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://iwlkslewdgenckuejbit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bGtzbGV3ZGdlbmNrdWVqYml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNzUwNjksImV4cCI6MjA3MzY1MTA2OX0.eD-XwISz_SUllwKnsm8PNuMbiDPJ-gfX8wYFncknVNo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSchema() {
  console.log('🔍 Fetching database schema from Supabase...\n');

  const tables = [
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
    'permission_modules',
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
    'production_material_issues',
    'purchase_orders',
    'purchase_order_items',
    'storage_strategies',
    'preparation_areas',
    'preparation_order_item',
  ];

  const schemaData: any = {
    tables: {},
    summary: {
      totalTables: 0,
      tablesWithData: 0,
      totalRows: 0,
    }
  };

  for (const tableName of tables) {
    try {
      // Get row count
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        // Get sample data to understand structure
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        const columns = sampleData && sampleData.length > 0
          ? Object.keys(sampleData[0])
          : [];

        schemaData.tables[tableName] = {
          exists: true,
          rowCount: count || 0,
          columns: columns,
          sampleData: sampleData && sampleData.length > 0 ? sampleData[0] : null
        };

        schemaData.summary.totalTables++;
        if ((count || 0) > 0) {
          schemaData.summary.tablesWithData++;
          schemaData.summary.totalRows += (count || 0);
        }

        console.log(`✅ ${tableName}: ${count || 0} rows, ${columns.length} columns`);
      } else {
        console.log(`❌ ${tableName}: ${error.message}`);
      }
    } catch (err: any) {
      console.log(`❌ ${tableName}: ${err.message}`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`Total tables found: ${schemaData.summary.totalTables}`);
  console.log(`Tables with data: ${schemaData.summary.tablesWithData}`);
  console.log(`Total rows: ${schemaData.summary.totalRows}`);

  // Save to file
  const outputPath = 'supabase/DATABASE_SCHEMA.json';
  fs.writeFileSync(outputPath, JSON.stringify(schemaData, null, 2));
  console.log(`\n💾 Schema saved to: ${outputPath}`);

  return schemaData;
}

getSchema().then((schemaData) => {
  console.log('\n✨ Schema extraction complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
