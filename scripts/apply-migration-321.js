// Apply migration 321 - Shadow ledger sync trigger
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('Applying migration 321: Shadow ledger sync trigger...\n');

  // Step 1: Create the function
  const createFunction = `
    CREATE OR REPLACE FUNCTION sync_ledger_to_shadow_activity()
    RETURNS TRIGGER AS $$
    BEGIN
        BEGIN
            INSERT INTO wms_activity_logs (
                activity_type,
                activity_status,
                entity_type,
                entity_id,
                entity_no,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                qty_delta,
                remarks,
                metadata
            ) VALUES (
                CASE NEW.movement_type
                    WHEN 'IN' THEN 'LEDGER_IN'
                    WHEN 'OUT' THEN 'LEDGER_OUT'
                    WHEN 'TRANSFER_IN' THEN 'LEDGER_TRANSFER_IN'
                    WHEN 'TRANSFER_OUT' THEN 'LEDGER_TRANSFER_OUT'
                    WHEN 'ADJUSTMENT' THEN 'LEDGER_ADJUSTMENT'
                    WHEN 'RESERVE' THEN 'LEDGER_RESERVE'
                    WHEN 'UNRESERVE' THEN 'LEDGER_UNRESERVE'
                    ELSE 'LEDGER_' || COALESCE(NEW.movement_type, 'UNKNOWN')
                END,
                'success',
                'LEDGER',
                NEW.ledger_id::TEXT,
                NEW.reference_no,
                NEW.warehouse_id,
                NEW.location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.piece_qty,
                NEW.remarks,
                jsonb_build_object(
                    'ledger_id', NEW.ledger_id,
                    'movement_type', NEW.movement_type,
                    'reference_type', NEW.reference_type,
                    'reference_id', NEW.reference_id,
                    'reference_no', NEW.reference_no,
                    'pack_qty', NEW.pack_qty,
                    'piece_qty', NEW.piece_qty,
                    'production_date', NEW.production_date,
                    'expiry_date', NEW.expiry_date,
                    'created_by', NEW.created_by,
                    'created_at', NEW.created_at
                )
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[ShadowSync] Failed to sync ledger % to shadow: %', NEW.ledger_id, SQLERRM;
        END;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Step 2: Drop existing trigger if exists
  const dropTrigger = `DROP TRIGGER IF EXISTS trg_sync_ledger_to_shadow ON wms_inventory_ledger;`;

  // Step 3: Create trigger
  const createTrigger = `
    CREATE TRIGGER trg_sync_ledger_to_shadow
        AFTER INSERT ON wms_inventory_ledger
        FOR EACH ROW
        EXECUTE FUNCTION sync_ledger_to_shadow_activity();
  `;

  // Step 4: Backfill recent entries
  const backfill = `
    INSERT INTO wms_activity_logs (
        activity_type,
        activity_status,
        entity_type,
        entity_id,
        entity_no,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        qty_delta,
        remarks,
        logged_at,
        metadata
    )
    SELECT 
        CASE movement_type
            WHEN 'IN' THEN 'LEDGER_IN'
            WHEN 'OUT' THEN 'LEDGER_OUT'
            WHEN 'TRANSFER_IN' THEN 'LEDGER_TRANSFER_IN'
            WHEN 'TRANSFER_OUT' THEN 'LEDGER_TRANSFER_OUT'
            WHEN 'ADJUSTMENT' THEN 'LEDGER_ADJUSTMENT'
            WHEN 'RESERVE' THEN 'LEDGER_RESERVE'
            WHEN 'UNRESERVE' THEN 'LEDGER_UNRESERVE'
            ELSE 'LEDGER_' || COALESCE(movement_type, 'UNKNOWN')
        END,
        'success',
        'LEDGER',
        ledger_id::TEXT,
        reference_no,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        piece_qty,
        remarks,
        created_at,
        jsonb_build_object(
            'ledger_id', ledger_id,
            'movement_type', movement_type,
            'reference_type', reference_type,
            'reference_id', reference_id,
            'reference_no', reference_no,
            'backfilled', true
        )
    FROM wms_inventory_ledger
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 500;
  `;

  try {
    // Execute each step
    console.log('1. Creating function...');
    let { error } = await supabase.from('wms_transactions').select('transaction_id').limit(0);
    // Use raw SQL via postgres function
    
    // Actually we need to use the REST API differently
    // Let's just do the backfill for now since we can't create functions via REST
    
    console.log('Note: Cannot create functions via Supabase REST API.');
    console.log('Please run the migration SQL directly in Supabase Dashboard SQL Editor.\n');
    
    console.log('2. Backfilling recent ledger entries to shadow...');
    
    // Get recent ledger entries
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (ledgerError) {
      console.error('Error fetching ledger:', ledgerError.message);
      return;
    }

    console.log(`Found ${ledgerData.length} ledger entries in last 24 hours`);

    if (ledgerData.length === 0) {
      console.log('No recent ledger entries to backfill');
      return;
    }

    // Map to activity logs format
    const activityLogs = ledgerData.map(entry => ({
      activity_type: mapMovementType(entry.movement_type),
      activity_status: 'success',
      entity_type: 'LEDGER',
      entity_id: String(entry.ledger_id),
      entity_no: entry.reference_no,
      warehouse_id: entry.warehouse_id,
      location_id: entry.location_id,
      sku_id: entry.sku_id,
      pallet_id: entry.pallet_id,
      qty_delta: entry.piece_qty,
      remarks: entry.remarks,
      logged_at: entry.created_at,
      metadata: {
        ledger_id: entry.ledger_id,
        movement_type: entry.movement_type,
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        reference_no: entry.reference_no,
        backfilled: true
      }
    }));

    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < activityLogs.length; i += batchSize) {
      const batch = activityLogs.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('wms_activity_logs')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError.message);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`\n✅ Backfilled ${inserted} ledger entries to shadow activity logs`);

    // Check counts
    const { count: actCount } = await supabase
      .from('wms_activity_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nTotal activity logs now: ${actCount}`);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

function mapMovementType(type) {
  const map = {
    'IN': 'LEDGER_IN',
    'OUT': 'LEDGER_OUT',
    'TRANSFER_IN': 'LEDGER_TRANSFER_IN',
    'TRANSFER_OUT': 'LEDGER_TRANSFER_OUT',
    'ADJUSTMENT': 'LEDGER_ADJUSTMENT',
    'RESERVE': 'LEDGER_RESERVE',
    'UNRESERVE': 'LEDGER_UNRESERVE'
  };
  return map[type] || 'LEDGER_' + (type || 'UNKNOWN');
}

applyMigration();
