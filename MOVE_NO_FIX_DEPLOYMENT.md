# Move Number Format Fix - Deployment Guide

## Problem Summary
Move numbers were being generated in incorrect format `MV0000000XXX` instead of the correct format `TRF-2026010001`, `PUT-2026010001`, etc.

## Root Cause
The `app/api/moves/quick-move/route.ts` file had its own manual move_no generation logic that was creating the wrong format. This was bypassing the database function `generate_move_no()` entirely.

## Fix Applied

### File: `app/api/moves/quick-move/route.ts`

**Before (Lines 175-223):**
```typescript
// Generate move_no and Insert with Retry logic
let move
let retryCount = 0
const maxRetries = 3

while (retryCount < maxRetries) {
  // Find latest move_no (re-query each time using Admin)
  const { data: lastMove } = await supabaseAdmin
    .from('wms_moves')
    .select('move_no')
    .order('move_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNumber = 1
  if (lastMove?.move_no) {
    const match = lastMove.move_no.match(/MV(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }

  const currentNumber = nextNumber + retryCount
  const move_no = `MV${String(currentNumber).padStart(10, '0')}`
  
  // ... rest of retry logic
}
```

**After:**
```typescript
// ✅ Generate move_no using database function (correct format: TRF-2026010001)
const { data: move_no, error: moveNoError } = await supabaseAdmin.rpc('generate_move_no', {
  p_move_type: 'transfer',
  p_pallet_id: pallet_id || null
})

if (moveNoError || !move_no) {
  console.error('Move number generation error:', moveNoError)
  return NextResponse.json(
    { error: 'ไม่สามารถสร้างเลขที่เอกสารได้: ' + (moveNoError?.message || 'Unknown error') },
    { status: 500 }
  )
}

// Insert move with generated move_no
const { data: move, error: moveError } = await supabase
  .from('wms_moves')
  .insert({
    move_no,
    move_type: 'transfer',
    status: 'completed',
    from_warehouse_id: warehouse_id,
    notes: notes || 'Quick move from misplaced inventory',
    created_by: userId,
    completed_at: new Date().toISOString()
  })
  .select()
  .single()
```

## Move Number Format Specification

The database function `generate_move_no()` creates move numbers in the format:

```
PREFIX-YYYYMM####
```

Where:
- **PREFIX**: Based on move type
  - `PUT` = Putaway (receiving to storage)
  - `TRF` = Transfer (location to location)
  - `REP` = Replenishment (bulk to picking)
  - `ADJ` = Adjustment (stock corrections)
- **YYYYMM**: Year and month (e.g., 202601 for January 2026)
- **####**: 4-digit sequence number (0001, 0002, etc.)

Examples:
- `TRF-2026010001` - First transfer in January 2026
- `PUT-2026010123` - 123rd putaway in January 2026
- `REP-2026020005` - 5th replenishment in February 2026

## Deployment Steps

1. **Verify the fix is in place:**
   ```bash
   node test-quick-move-fix.js
   ```

2. **Restart the development server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. **Test in UI:**
   - Go to Misplaced Inventory page
   - Select an item and move it to a new location
   - Verify the move_no format is `TRF-2026010XXX` (not `MV0000000XXX`)

4. **Check database:**
   ```sql
   SELECT move_id, move_no, move_type, created_at 
   FROM wms_moves 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## Verification Checklist

- [x] Database function `generate_move_no()` exists and works correctly
- [x] `lib/database/move.ts` calls database function (already fixed)
- [x] `app/api/moves/route.ts` uses `moveService.createMove()` (correct)
- [x] `app/api/moves/quick-move/route.ts` now calls database function (FIXED)
- [ ] Test creating move via UI - verify format is correct
- [ ] Test quick move via Misplaced Inventory - verify format is correct

## Historical Data

There are currently **719 moves** with the old format `MV0000000XXX` in the database. These are historical records and do not need to be updated. All new moves will use the correct format.

## Related Files

- `lib/database/move.ts` - Main move service (already fixed)
- `app/api/moves/route.ts` - Standard move creation API
- `app/api/moves/quick-move/route.ts` - Quick move API (FIXED)
- `supabase/migrations/001_complete_schema_from_production.sql` - Database function definition

## Status

✅ **FIX COMPLETE** - Ready for testing

The code fix has been applied. The next step is to restart the dev server and test creating a new move to verify the format is correct.
