# Inventory Ledger Page Troubleshooting

## Issue Report
Date: 2026-02-19
Page: http://localhost:3000/warehouse/inventory-ledger
Status: No transaction history showing despite 129,000+ records in database

## Investigation Results

### Database Verification ✅
- Table: `wms_inventory_ledger`
- Total records: 129,331
- RLS Status: Disabled (rowsecurity: false)
- Recent data: Records exist from today (2026-02-19)
- Query test: Backend queries work perfectly

### Frontend Query Test ✅
Tested with `test-inventory-ledger-query.js`:
- Count query: ✅ Returns 129,331 records
- Data fetch with joins: ✅ Returns 10 records with all relations
- Recent records: ✅ Returns latest 5 records

### Root Cause Analysis

The page uses client-side Supabase queries directly (not API routes). Possible causes:

1. **Authentication Issue** - User might not be logged in or session expired
2. **Silent Error** - Error state not being displayed properly
3. **Loading State** - Page stuck in loading state
4. **Browser Console Errors** - JavaScript errors preventing data fetch

## Recommended Solutions

### Solution 1: Check Browser Console (Immediate)
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any errors related to:
   - Supabase authentication
   - Network requests
   - JavaScript errors

### Solution 2: Add Error Logging (Quick Fix)
Add console.log statements to track the fetch process:

```typescript
const fetchLedgerData = async (page: number = 1) => {
  try {
    console.log('🔍 Fetching ledger data, page:', page);
    setLoading(true);
    const supabase = createClient();
    
    console.log('📊 Supabase client created');
    
    // ... rest of the code
    
    const { data, error } = await dataQuery;
    
    console.log('📦 Data received:', data?.length, 'records');
    console.log('❌ Error:', error);
    
    if (error) {
      console.error('Full error object:', error);
      setError(error.message);
    } else {
      console.log('✅ Setting ledger data');
      setLedgerData(data || []);
      setCurrentPage(page);
    }
  } catch (err: any) {
    console.error('💥 Catch block error:', err);
    setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  } finally {
    setLoading(false);
  }
};
```

### Solution 3: Check Authentication Status
Add authentication check at the top of the component:

```typescript
useEffect(() => {
  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('🔐 Session:', session);
    console.log('❌ Auth error:', error);
  };
  checkAuth();
}, []);
```

### Solution 4: Simplify Initial Query (Testing)
Temporarily simplify the query to isolate the issue:

```typescript
// Replace the complex query with a simple one
const { data, error } = await supabase
  .from('wms_inventory_ledger')
  .select('*')
  .order('ledger_id', { ascending: false })
  .limit(10);
```

## Next Steps

1. **User Action Required**: Open browser console and check for errors
2. **If no errors visible**: Add logging code (Solution 2)
3. **If authentication error**: Check login status and session
4. **If query error**: Simplify query to identify problematic join

## Test Script Available

Run `node test-inventory-ledger-query.js` to verify backend connectivity.

## Related Files
- Page: `app/warehouse/inventory-ledger/page.tsx`
- Client: `lib/supabase/client.ts`
- Test: `test-inventory-ledger-query.js`
