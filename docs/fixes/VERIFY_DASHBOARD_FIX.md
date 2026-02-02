# Dashboard Fix Verification Guide

**Quick guide to verify the dashboard statistics fix is working correctly**

---

## Step 1: Hard Refresh Browser

1. Open http://localhost:3000/online-packing/dashboard
2. Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. Open browser console (F12)

---

## Step 2: Check Console Output

You should see:

```
🔄 [Dashboard] Code version: 3.0 - FINAL FIX (Use RPC data directly)
✅ [Dashboard] RPC returned XXX unique tracking numbers
✅ [Dashboard] Using RPC data directly: XXX unique orders
📊 [Dashboard] Total unique orders: XXX
```

**Key Check:** The two "XXX" numbers should be **EQUAL** (e.g., 596 = 596)

### ❌ Bad Output (v2.0 - Buggy):
```
✅ [Dashboard] RPC returned 596 unique tracking numbers
✅ [Dashboard] After deduplication: 399 unique orders  ← MISMATCH!
```

### ✅ Good Output (v3.0 - Fixed):
```
✅ [Dashboard] RPC returned 596 unique tracking numbers
✅ [Dashboard] Using RPC data directly: 596 unique orders  ← MATCH!
```

---

## Step 3: Verify Dashboard Statistics

For date **2026-02-02**, you should see approximately:

### Total Orders Card
```
ออเดอร์ทั้งหมด: ~798
ยังไม่แพ็ค: ~248
แพ็คแล้ว: ~550
สแกนจัดไปแล้ว: ~550
```

### Platform Breakdown
```
Shopee Thailand: ~508 orders (319 packed = 63%)
TikTok Shop: ~213 orders (171 packed = 80%)
Lazada Thailand: ~77 orders (57 packed = 74%)
```

**Note:** Exact numbers may vary slightly based on order status changes, but should be close to these values.

---

## Step 4: Compare with Main Page

1. Open http://localhost:3000/online-packing (main page)
2. Scroll to footer
3. Compare statistics:

### Main Page Footer (for 2026-02-02)
```
ออเดอร์ทั้งหมด/วัน: 798
สแกนจัดไปแล้ว: 579
คงเหลือ: 219
```

### Dashboard Should Match
```
Total: 798 (same as main page)
Packed: ~550-579 (close to main page "สแกนจัดไปแล้ว")
Pending: ~219-248 (close to main page "คงเหลือ")
```

**Acceptable variance:** ±5-10 orders due to timing/status differences

---

## Step 5: Test Date Picker

1. Change date to different day (e.g., yesterday)
2. Wait for data to load
3. Check console shows new RPC count
4. Verify statistics update

---

## Common Issues & Solutions

### Issue 1: Still seeing old numbers
**Solution:** Hard refresh browser (Ctrl+Shift+R)

### Issue 2: Console shows version 2.0
**Solution:**
```bash
# Restart dev server
npm run dev
```

### Issue 3: Console shows data mismatch
**Example:** "RPC returned 596" but "After deduplication: 399"
**Solution:** Code not updated - check git status and pull latest changes

### Issue 4: Platform stats still wrong
**Check:** Ensure console shows "Using RPC data directly" (not "After deduplication")

---

## Database Verification (Optional)

Run this query in Supabase SQL Editor:

```sql
-- Count unique packed orders for 2026-02-02
SELECT COUNT(*) as unique_packed_orders
FROM (
  SELECT DISTINCT ON (tracking_number)
    tracking_number
  FROM packing_backup_orders
  WHERE packed_at >= '2026-02-02T00:00:00.000Z'
    AND packed_at <= '2026-02-02T23:59:59.999Z'
    AND packed_at IS NOT NULL
    AND tracking_number IS NOT NULL
) as unique_orders;
```

**Expected Result:** ~550-600 orders

This should match the dashboard "แพ็คแล้ว" count.

---

## Success Criteria

✅ Console shows "Code version: 3.0"
✅ RPC count = Final packed count (no data loss)
✅ Total orders ≈ 798 (for 2026-02-02)
✅ Platform breakdown shows realistic numbers (Shopee > TikTok > Lazada)
✅ Main page footer and dashboard show similar numbers
✅ Date picker updates statistics correctly

---

## If Still Not Working

1. Check git status - ensure latest code is pulled
2. Clear browser cache completely
3. Restart Next.js dev server
4. Check Supabase RPC function exists:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name = 'get_packed_orders_count_by_date';
   ```
5. Check browser console for JavaScript errors

---

## Report Back

When reporting results, please include:

1. Console output (screenshot or text)
2. Dashboard statistics (screenshot)
3. Main page footer statistics (screenshot)
4. Code version shown in console

This will help diagnose any remaining issues quickly.
