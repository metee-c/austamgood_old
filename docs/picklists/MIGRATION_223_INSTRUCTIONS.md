# 🚀 Migration 223 - Deployment Instructions

## 📋 Overview

Migration 223 fixes a critical bug in Migrations 221 and 222 where `PG_EXCEPTION_DETAIL` was used but doesn't exist in PostgreSQL.

## ⚠️ Why This Migration is Needed

**Problem:**
- Migrations 221 and 222 are deployed and working
- BUT they reference `PG_EXCEPTION_DETAIL` in exception handling
- This causes errors when exceptions occur
- Face sheet creation fails with: `column "pg_exception_detail" does not exist`

**Impact:**
- ❌ Face sheet creation fails when there are errors
- ❌ Error messages are not properly returned
- ✅ Happy path still works (no exceptions = no problem)

## 🎯 What Migration 223 Does

Replaces the exception handling in both functions to remove `PG_EXCEPTION_DETAIL`:

### Before (Broken):
```sql
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            FALSE,
            ...
            jsonb_build_object(
                'error_code', SQLSTATE,
                'error_message', SQLERRM,
                'error_detail', COALESCE(PG_EXCEPTION_DETAIL, ''),  -- ❌ DOESN'T EXIST
                'error_hint', COALESCE(PG_EXCEPTION_HINT, '')
            );
```

### After (Fixed):
```sql
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            FALSE,
            ...
            jsonb_build_object(
                'error_code', SQLSTATE,
                'error_message', SQLERRM,
                'error_hint', COALESCE(PG_EXCEPTION_HINT, '')  -- ✅ REMOVED PG_EXCEPTION_DETAIL
            );
```

## 📝 Deployment Steps

### Step 1: Open Supabase Dashboard

1. Go to your Supabase project
2. Navigate to **SQL Editor**

### Step 2: Copy Migration SQL

Open the file: `supabase/migrations/223_fix_pg_exception_detail.sql`

### Step 3: Execute Migration

1. Paste the entire SQL content into SQL Editor
2. Click **Run** or press `Ctrl+Enter`
3. Wait for confirmation: "Success. No rows returned"

### Step 4: Verify Deployment

Run this query to check the functions were updated:

```sql
-- Check function exists and was updated
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'create_face_sheet_with_reservation',
    'create_bonus_face_sheet_with_reservation'
)
ORDER BY p.proname;
```

Expected: Both functions should be listed.

### Step 5: Test the Fix

Run the concurrent test script:

```bash
node scripts/test-concurrent-reservations.js
```

Expected output:
```
✅ ALL TESTS PASSED!
   ✓ No overselling detected
   ✓ No orphaned documents
   ✓ Stock reservations are atomic and consistent

🎉 Migrations 220, 221, 222, 223 are working correctly!
```

## 🧪 Testing Checklist

After deployment, verify:

- [ ] Migration 223 applied successfully
- [ ] No SQL errors in Supabase logs
- [ ] Face sheet creation works (happy path)
- [ ] Face sheet creation fails gracefully (error path)
- [ ] Error messages are returned properly
- [ ] Concurrent test passes
- [ ] No orphaned documents
- [ ] No overselling detected

## 🔄 Rollback Plan

If issues occur, you can rollback by re-applying migrations 221 and 222 from their original files (though this will reintroduce the bug).

**Better approach:** Fix forward by modifying migration 223 if needed.

## 📊 Migration History

| Migration | Status | Description |
|-----------|--------|-------------|
| 220 | ✅ Deployed | Row-level locking (FOR UPDATE) |
| 221 | ✅ Deployed | Atomic face sheet creation |
| 222 | ✅ Deployed | Atomic bonus face sheet creation |
| 223 | ⏳ Pending | Fix PG_EXCEPTION_DETAIL error |

## 🎯 Success Criteria

Migration 223 is successful when:

1. ✅ SQL executes without errors
2. ✅ Both functions are updated
3. ✅ Face sheet creation works
4. ✅ Error handling works (no PG_EXCEPTION_DETAIL error)
5. ✅ Concurrent tests pass
6. ✅ No data integrity issues

## 📞 Support

If you encounter issues:

1. Check Supabase logs for errors
2. Verify the migration SQL was copied completely
3. Ensure you have proper permissions
4. Review the error message carefully

## 🎉 Next Steps After Deployment

Once Migration 223 is deployed and tested:

1. ✅ Mark as complete in deployment checklist
2. ✅ Update DEPLOYMENT_SUCCESS.md
3. ✅ Monitor production for 24 hours
4. ✅ Document any issues found
5. ✅ Celebrate! 🎊

---

**Migration File:** `supabase/migrations/223_fix_pg_exception_detail.sql`  
**Created:** 2026-01-17  
**Priority:** High (fixes error handling)  
**Risk Level:** Low (only fixes exception handling, doesn't change logic)
