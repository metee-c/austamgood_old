# Preparation Area Inventory System - API Authentication Fix

## Problem
The preparation area inventory page was failing to load data with the error:
```
Failed to fetch preparation area inventory
Failed to fetch premium area inventory
```

The API was returning HTML (login page) instead of JSON, indicating an authentication issue.

## Root Cause
The UI page was using plain `fetch()` calls without authentication headers. When the API endpoint required authentication (via `createClient()` from `@/lib/supabase/server`), the requests were being redirected to the login page.

## Solution
Updated all API fetch calls in `app/warehouse/preparation-area-inventory/page.tsx` to use `fetchJsonWithAuth()` utility function instead of plain `fetch()`.

### Changes Made

1. **Added import for authenticated fetch utility**:
   ```typescript
   import { fetchJsonWithAuth } from '@/lib/api/fetch-with-auth';
   ```

2. **Updated `fetchBalanceData()` function**:
   - Changed from `fetch()` to `fetchJsonWithAuth<{ success: boolean; data: any[]; error?: string }>()`
   - Removed manual response.ok checking (handled by utility)
   - Removed manual JSON parsing (handled by utility)

3. **Updated `fetchPremiumData()` function**:
   - Same changes as fetchBalanceData()

4. **Updated `fetchDispatchData()` function**:
   - Changed from `fetch()` to `fetchJsonWithAuth<{ data: any[] }>()`

5. **Updated `fetchBfsStagingData()` function**:
   - Changed from `fetch()` to `fetchJsonWithAuth<{ data: any[] }>()`

6. **Updated `fetchDeliveryData()` function**:
   - Changed from `fetch()` to `fetchJsonWithAuth<{ data: any[] }>()`

## Benefits of fetchJsonWithAuth

The `fetchJsonWithAuth` utility provides:
- Automatic session management with `credentials: 'include'`
- Detection of session expiration (HTML responses)
- Automatic dispatch of SESSION_EXPIRED_EVENT for UI handling
- Proper error handling for authentication failures
- Type-safe JSON parsing

## Testing

### Database Verification
Test script `test-prep-area-api.js` confirmed:
- ✅ View `vw_preparation_area_inventory` is working correctly
- ✅ 154 rows of aggregated SKU-level data
- ✅ PK001 (regular prep area) has data
- ✅ PK002 (premium prep area) has data
- ✅ Latest pallet dates are being tracked correctly

### Expected UI Behavior
After this fix, the page at `/warehouse/preparation-area-inventory` should:
1. Load successfully without authentication errors
2. Display aggregated inventory by SKU (1 row per SKU)
3. Show latest production/expiry dates from most recent pallet
4. Separate data between "บ้านหยิบ" (PK001) and "บ้านหยิบพรีเมี่ยม" (PK002) tabs

## Related Files
- `app/warehouse/preparation-area-inventory/page.tsx` - UI page (fixed)
- `app/api/inventory/prep-area-balances/route.ts` - API endpoint
- `lib/api/fetch-with-auth.ts` - Authentication utility
- `supabase/migrations/281_fix_prep_area_inventory_aggregate_by_sku.sql` - Database migration
- `test-prep-area-api.js` - Test script

## Migration Status
- ✅ Migration 280: Initial pallet-level table (superseded)
- ✅ Migration 281: SKU-level aggregation (current)
- ✅ Table `preparation_area_inventory` created with 154 rows
- ✅ View `vw_preparation_area_inventory` created
- ✅ Trigger `trg_sync_prep_area_inventory` active

## Next Steps
1. Test the page in browser at `http://localhost:3000/warehouse/preparation-area-inventory`
2. Verify both tabs load correctly:
   - "บ้านหยิบ" (excludes PK002)
   - "บ้านหยิบพรีเมี่ยม" (only PK002)
3. Verify data shows 1 row per SKU with aggregated quantities
4. Verify latest pallet dates are displayed correctly
5. Test that trigger updates data when inventory changes

## Date
January 22, 2026
