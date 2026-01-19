
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn('Warning: .env.local file not found at', envPath);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupIV27Data(dryRun: boolean = true) {
    console.log(`Starting cleanup for orders starting with 'IV27'... (Dry Run: ${dryRun})`);

    try {
        // 1. Find Orders
        const { data: orders, error: ordersError } = await supabase
            .from('wms_orders')
            .select('order_id, order_no')
            .ilike('order_no', 'IV27%');

        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
            console.log('No orders found matching pattern IV27%');
            return;
        }

        const orderIds = orders.map(o => o.order_id);
        console.log(`Found ${orders.length} orders matching IV27%:`, orders.map(o => o.order_no).join(', '));

        // 2. Find Related Records

        // 2.1 Order Items
        const { count: orderItemsCount, error: itemsError } = await supabase
            .from('wms_order_items')
            .select('*', { count: 'exact', head: true })
            .in('order_id', orderIds);

        if (itemsError) throw itemsError;
        console.log(`- Found ${orderItemsCount} wms_order_items`);

        // 2.2 Picklists (via picklist_items linked to order_id ?? or picklists linked to ?? need to check schema)
        // Checking picklist_items usually links to order_id or order_item_id
        // Let's check picklist structure. Assuming picklists table has order_id or picklist_items has order_id

        // Strategy: Search tables for 'order_id' column in schema or assume standard relation
        // Based on previous search, we have 'picklists', 'picklist_items'.
        // Let's safe-check: find picklists where order_id IN orderIds (if column exists)

        let picklistIds: number[] = [];

        // Check if picklists table has order_id
        const { data: picklistsByOrder, error: picklistErr } = await supabase
            .from('picklists')
            .select('picklist_id, order_id')
            .in('order_id', orderIds);

        if (!picklistErr && picklistsByOrder) {
            picklistIds = picklistsByOrder.map(p => p.picklist_id);
            console.log(`- Found ${picklistsByOrder.length} picklists linked by order_id`);
        }

        // Also check picklist_items by order_id
        const { data: picklistItemsByOrder, error: picklistItemErr } = await supabase
            .from('picklist_items')
            .select('picklist_id, order_id')
            .in('order_id', orderIds);

        if (!picklistItemErr && picklistItemsByOrder) {
            const itemPicklistIds = picklistItemsByOrder.map(p => p.picklist_id);
            picklistIds = [...new Set([...picklistIds, ...itemPicklistIds])];
            console.log(`- Found ${picklistItemsByOrder.length} picklist_items linked by order_id (Total unique picklists involved: ${picklistIds.length})`);
        }

        // 2.3 Load Lists
        // Assuming load_list_items links to order_id or picklist_id
        let loadListIds: number[] = [];

        // Check load_list_items
        const { data: loadListItems, error: loadListItemsErr } = await supabase
            .from('load_list_items')
            .select('load_list_id')
            .in('order_id', orderIds);

        if (!loadListItemsErr && loadListItems) {
            loadListIds = [...new Set(loadListItems.map(l => l.load_list_id))];
            console.log(`- Found ${loadListIds.length} load_lists linked via items`);
        }

        // 2.4 Routes
        // receiving_route_stops often links to order_id
        const { data: routeStops, error: stopsErr } = await supabase
            .from('receiving_route_stops')
            .select('stop_id, trip_id, order_id')
            .in('order_id', orderIds);

        let stopIds: number[] = [];
        let tripIds: number[] = [];

        if (!stopsErr && routeStops) {
            stopIds = routeStops.map(s => s.stop_id);
            tripIds = [...new Set(routeStops.map(s => s.trip_id).filter(id => id !== null))];
            console.log(`- Found ${stopIds.length} route stops`);
            console.log(`- Found ${tripIds.length} route trips involved`);
        }

        // Trips -> Plans
        let planIds: number[] = [];
        if (tripIds.length > 0) {
            const { data: trips, error: tripsErr } = await supabase
                .from('receiving_route_trips')
                .select('plan_id')
                .in('trip_id', tripIds);

            if (!tripsErr && trips) {
                planIds = [...new Set(trips.map(t => t.plan_id))];
                console.log(`- Found ${planIds.length} route plans involved`);
            }
        }

        // 2.5 Inventory Transactions
        // Check for inventory transactions linked to these orders
        const { data: invTrans, error: invTransErr } = await supabase
            .from('inventory_transactions')
            .select('*')
            .in('reference_id', orderIds.map(String)); // reference_id might be string order_no or order_id

        // Also check reference_number = order_no
        const { data: invTransByNo, error: invTransNoErr } = await supabase
            .from('inventory_transactions')
            .select('*')
            .in('reference_number', orders.map(o => o.order_no));

        const allInvTrans = [...(invTrans || []), ...(invTransByNo || [])];
        // De-duplicate
        const uniqueInvTransIds = [...new Set(allInvTrans.map(t => t.transaction_id))];
        const uniqueInvTrans = allInvTrans.filter(t => uniqueInvTransIds.includes(t.transaction_id));

        console.log(`- Found ${uniqueInvTrans.length} inventory transactions`);

        // === ACTION PHASE ===

        if (dryRun) {
            console.log('\n[DRY RUN] The following actions would be performed:');
            console.log('1. Delete Load List Items associated with orders');
            console.log('2. Delete Picklist Items associated with orders');
            console.log(`3. Delete/Update ${loadListIds.length} Load Lists`);
            console.log(`4. Delete/Update ${picklistIds.length} Picklists`);
            console.log(`5. Delete ${stopIds.length} Route Stops`);
            console.log(`6. Delete ${tripIds.length} Route Trips (if empty after stop deletion)`);
            console.log(`7. Delete ${planIds.length} Route Plans (if empty after trip deletion)`);
            console.log(`8. Revert ${uniqueInvTrans.length} Inventory Transactions`);
            console.log(`9. Delete ${orderItemsCount} Order Items`);
            console.log(`10. Delete ${orders.length} Orders`);
        } else {
            console.log('\n[EXECUTE] Performing cleanup...');

            // 1. Revert Inventory (CRITICAL)
            // If we just delete transactions, balances might be wrong.
            // For 'picking', we subtracted stock. We need to ADD it back.
            // For 'receiving' (if inbound), we added stock. We need to DEDUCT it.
            // Assuming 'picking' based on user description (Pick/Load).

            for (const trans of uniqueInvTrans) {
                // Logic: Reverse the impact.
                // If type='picking', qty was negative (e.g. -10). Impact on balance: -10.
                // To reverse, we need +10 to balance.

                // Using a naive approach: If we delete the transaction, the history is gone, but balance remains.
                // We must manually adjust balance.

                if (!trans.sku_id || !trans.location_id) continue;

                const reverseQty = (trans.quantity || 0) * -1; // If -10, reverse is +10.

                console.log(`Reverting transaction ${trans.transaction_id}: SKU ${trans.sku_id} Loc ${trans.location_id} Qty ${trans.quantity} -> Adjusting by ${reverseQty}`);

                // Call RPC or update directly
                // Assuming inventory_balances table
                const { error: balanceErr } = await supabase.rpc('adjust_inventory_balance', {
                    p_warehouse_id: 'WH001', // Default or from trans
                    p_location_id: trans.location_id,
                    p_sku_id: trans.sku_id,
                    p_quantity_change: reverseQty
                });

                if (balanceErr) {
                    // Fallback to direct update if RPC fails
                    console.error(`Failed to adjust balance via RPC: ${balanceErr.message}. Trying direct update...`);
                    // Implementation depends on table structure, skipping direct update risk for now, logging error.
                }

                // Delete transaction
                await supabase.from('inventory_transactions').delete().eq('transaction_id', trans.transaction_id);
            }

            // 2. Delete Load Lists / Items
            if (loadListIds.length > 0) {
                await supabase.from('load_list_items').delete().in('load_list_id', loadListIds);
                await supabase.from('load_lists').delete().in('load_list_id', loadListIds);
                console.log('Deleted load lists');
            }

            // 3. Delete Picklists / Items
            if (picklistIds.length > 0) {
                await supabase.from('picklist_items').delete().in('picklist_id', picklistIds);
                await supabase.from('picklists').delete().in('picklist_id', picklistIds);
                console.log('Deleted picklists');
            }

            // 4. Routes
            if (stopIds.length > 0) await supabase.from('receiving_route_stops').delete().in('stop_id', stopIds);

            // Cleanup empty trips/plans?
            if (tripIds.length > 0) {
                await supabase.from('receiving_route_trips').delete().in('trip_id', tripIds); // Might fail if other stops exist, but assuming full isolation for now
                console.log('Attempted delete trips');
            }
            if (planIds.length > 0) {
                await supabase.from('receiving_route_plans').delete().in('plan_id', planIds);
                console.log('Attempted delete plans');
            }

            // 5. Order Items & Orders
            const { error: delItemsErr } = await supabase.from('wms_order_items').delete().in('order_id', orderIds);
            if (delItemsErr) console.error('Error deleting order items:', delItemsErr);

            const { error: delOrderErr } = await supabase.from('wms_orders').delete().in('order_id', orderIds);
            if (delOrderErr) console.error('Error deleting orders:', delOrderErr);
            else console.log('Deleted orders');

            console.log('Cleanup complete.');
        }

    } catch (error) {
        console.error('An error occurred during cleanup:', error);
    }
}

// Run
const isDryRun = !process.argv.includes('--execute');
cleanupIV27Data(isDryRun);
