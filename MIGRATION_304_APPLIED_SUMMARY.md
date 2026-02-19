# Migrations 304 & 305 Applied - Function Cache Refresh

## Status: ⚠️ REQUIRES SUPABASE RESTART

Migrations 304 and 305 have been successfully applied, but Supabase's PostgREST API layer still has a stale schema cache.

## Problem Fixed

**Error**: "Could not find the function public.split_balance_on_reservation(...) in the schema cache"

**Root Cause**: Supabase's schema cache had an outdated function signature, causing parameter order mismatch errors when creating picklists.

## Problem

**Error**: "Could not find the function public.split_balance_on_reservation(...) in the schema cache"

**Root Cause**: Supabase's PostgREST API layer caches function signatures. Even after dropping and recreating the function, PostgREST continues to use the old cached signature.

## Solutions Applied

### Migration 304
Drops all possible function signatures and recreates the function:

```sql
CREATE OR REPLACE FUNCTION public.split_balance_on_reservation(
  p_source_balance_id INTEGER,
  p_piece_qty_to_reserve INTEGER,
  p_pack_qty_to_reserve NUMERIC,
  p_reserved_by_user_id INTEGER,
  p_document_type VARCHAR,
  p_document_id INTEGER,
  p_document_code VARCHAR,
  p_picklist_item_id INTEGER DEFAULT NULL
)
```

### Migration 305
Recreates the function again to ensure PostgREST picks up the changes.

## Current Status

The function exists in the database with the correct signature (verified via SQL query), but PostgREST's schema cache still shows the old signature. This is a known PostgREST caching issue.

## Required Action: Restart Supabase

To clear PostgREST's schema cache, you need to restart the Supabase service:

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Click "Restart API" or "Reload schema cache"

### Option 2: Local Supabase (if using local development)
```bash
supabase stop
supabase start
```

### Option 3: Supabase CLI (for hosted projects)
```bash
supabase functions deploy --no-verify-jwt
# This forces a schema reload
```

### Option 4: Wait (Not Recommended)
PostgREST's schema cache typically refreshes every 10 minutes, but this is unreliable.

## Verification

After restarting, verify the function works:
```sql
SELECT * FROM split_balance_on_reservation(
  p_source_balance_id := 1,
  p_piece_qty_to_reserve := 10,
  p_pack_qty_to_reserve := 1,
  p_reserved_by_user_id := 1,
  p_document_type := 'picklist',
  p_document_id := 1,
  p_document_code := 'PL-TEST',
  p_picklist_item_id := NULL
);
```

## Next Steps (After Restart)

1. **Test Picklist Creation**: Try creating a picklist again at http://localhost:3000/receiving/picklists
2. **Address Insufficient Stock**: Many SKUs show negative available quantities in PK001 zone - this needs investigation
3. **Fix Capacity Trend Timeout**: The `/api/warehouse/capacity-trend` endpoint is timing out (20+ seconds) and needs optimization

## Related Issues

### Issue 1: Insufficient Stock Warnings
Multiple SKUs showing negative available stock in PK001:
- This suggests inventory discrepancies that need to be investigated
- May require stock count or adjustment to correct balances

### Issue 2: Capacity Trend API Timeout
The capacity trend API is slow because:
- Fetches all ledger records since start date (potentially 100k+ records)
- Makes multiple RPC calls in parallel for each date
- Missing database indexes on `movement_at` column

**Recommended Fix**:
- Add index on `wms_inventory_ledger(movement_at)`
- Consider caching or materialized views for historical data
- Add pagination or limit date range

## Files Modified

- `supabase/migrations/304_force_refresh_split_balance_function.sql` (NEW - APPLIED)

## Testing Required

1. Create a new picklist from a trip
2. Verify stock reservation works correctly
3. Check that insufficient stock warnings are displayed properly
4. Monitor for any new errors in the logs
