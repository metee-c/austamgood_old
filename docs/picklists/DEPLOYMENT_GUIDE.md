# 🚀 Deployment Guide - Atomic Transactions

**Migrations:** 220, 221, 222  
**Priority:** P0 (Critical Bug Fix)  
**Estimated Downtime:** None (backward compatible)

---

## 📋 Pre-Deployment Checklist

- [ ] Code reviewed and approved
- [ ] TypeScript compilation successful (`npm run typecheck`)
- [ ] All tests passing locally
- [ ] Database backup completed
- [ ] Rollback plan prepared
- [ ] Team notified of deployment
- [ ] Monitoring tools ready

---

## 🧪 Step 1: Run Tests (Local/Staging)

### A. Run Automated Tests

```bash
# Run test script
node scripts/test-atomic-transactions.js
```

**Expected Output:**
```
✅ Functions Exist
✅ Successful Creation
✅ Rollback on Error
✅ Concurrent Requests
✅ No Orphaned Documents

Total: 5 | Passed: 5 | Failed: 0
🎉 ALL TESTS PASSED! Ready for deployment.
```

### B. Manual Testing (Optional)

Test in staging environment:

**Test Face Sheet Creation:**
```bash
curl -X POST https://staging.yourdomain.com/api/face-sheets/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "warehouse_id": "WH001",
    "delivery_date": "2026-01-20",
    "created_by": "test_user"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "face_sheet_id": 123,
  "face_sheet_no": "FS-20260120-001",
  "total_packages": 10,
  "small_size_count": 5,
  "large_size_count": 5,
  "items_reserved": 25,
  "message": "สร้างใบปะหน้าสำเร็จ"
}
```

---

## 🗄️ Step 2: Deploy Database Migrations

### A. Connect to Database

```bash
# Production database
psql -h your-db-host.supabase.co \
     -U postgres \
     -d postgres \
     -p 5432
```

### B. Apply Migrations (In Order!)

```sql
-- Migration 220: Row Locking
\i supabase/migrations/220_add_row_locking_to_reservations.sql

-- Migration 221: Atomic Face Sheet
\i supabase/migrations/221_create_atomic_face_sheet_creation.sql

-- Migration 222: Atomic Bonus Face Sheet
\i supabase/migrations/222_create_atomic_bonus_face_sheet_creation.sql
```

**Expected Output for Each:**
```
CREATE OR REPLACE FUNCTION
CREATE OR REPLACE FUNCTION
...
```

### C. Verify Deployment

```bash
# Run verification script
psql -h your-db-host.supabase.co \
     -U postgres \
     -d postgres \
     -f scripts/verify-deployment.sql
```

**Expected Output:**
```
✅ All 6 functions exist
✅ Reserve functions have FOR UPDATE
✅ Generate functions have advisory locks
✅ No orphaned documents
✅ No duplicate face sheet numbers
✅ All reservations complete
```

---

## 🌐 Step 3: Deploy Application Code

### A. Build Application

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build
```

### B. Deploy to Staging

```bash
# Deploy to staging (command depends on your setup)
# Example for Vercel:
vercel --prod --scope=staging

# Example for custom server:
pm2 restart austamgood-wms-staging
```

### C. Smoke Test in Staging

```bash
# Test Face Sheet API
curl -X POST https://staging.yourdomain.com/api/face-sheets/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"warehouse_id":"WH001","delivery_date":"2026-01-20","created_by":"test"}'

# Test Bonus Face Sheet API
curl -X POST https://staging.yourdomain.com/api/bonus-face-sheets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"warehouse_id":"WH001","delivery_date":"2026-01-20","packages":[],"created_by":"test"}'
```

### D. Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or for custom server:
pm2 restart austamgood-wms-production
```

---

## 📊 Step 4: Post-Deployment Verification

### A. Check Application Health

```bash
# Check application is running
curl https://yourdomain.com/api/health

# Check database connection
curl https://yourdomain.com/api/health/db
```

### B. Monitor for Errors

```bash
# Check application logs
pm2 logs austamgood-wms-production --lines 100

# Or for Vercel:
vercel logs --follow
```

### C. Verify No Orphaned Documents

```sql
-- Connect to production database
psql -h your-db-host.supabase.co -U postgres -d postgres

-- Check for orphaned face sheets (should be 0)
SELECT COUNT(*) as orphaned_count
FROM face_sheets fs
LEFT JOIN face_sheet_items fsi ON fsi.face_sheet_id = fs.id
LEFT JOIN face_sheet_item_reservations fsir ON fsir.face_sheet_item_id = fsi.id
WHERE fs.created_at > NOW() - INTERVAL '1 hour'
  AND fsi.id IS NOT NULL
  AND fsir.reservation_id IS NULL;

-- Expected: orphaned_count = 0
```

### D. Monitor Performance

```sql
-- Check face sheet creation performance
SELECT 
    COUNT(*) as total_created,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds,
    MIN(EXTRACT(EPOCH FROM (updated_at - created_at))) as min_seconds,
    MAX(EXTRACT(EPOCH FROM (updated_at - created_at))) as max_seconds
FROM face_sheets
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Expected: avg_seconds < 1.0 (faster than before)
```

---

## 🔄 Rollback Plan

If issues occur, follow this rollback procedure:

### A. Rollback Application Code

```bash
# Revert to previous deployment
vercel rollback

# Or for custom server:
git checkout <previous-commit>
npm run build
pm2 restart austamgood-wms-production
```

### B. Keep Database Migrations

**IMPORTANT:** Do NOT rollback database migrations!

The new functions are backward compatible. Old API code will still work (just won't use the new atomic functions).

### C. Monitor After Rollback

```bash
# Check application logs
pm2 logs austamgood-wms-production --lines 100

# Verify old API still works
curl -X POST https://yourdomain.com/api/face-sheets/generate \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id":"WH001","delivery_date":"2026-01-20"}'
```

---

## 📈 Success Criteria

Deployment is successful if:

- ✅ All migrations applied without errors
- ✅ All 6 functions exist in database
- ✅ Application builds and deploys successfully
- ✅ Smoke tests pass in staging
- ✅ No errors in production logs (first 30 minutes)
- ✅ Zero orphaned documents created
- ✅ No duplicate face sheet numbers
- ✅ Performance improved (faster response times)
- ✅ No user complaints

---

## 🚨 Troubleshooting

### Issue: Migration fails with "function already exists"

**Solution:**
```sql
-- Drop existing function and reapply
DROP FUNCTION IF EXISTS create_face_sheet_with_reservation CASCADE;
\i supabase/migrations/221_create_atomic_face_sheet_creation.sql
```

### Issue: API returns "function not found"

**Cause:** Database connection using wrong schema or database

**Solution:**
```sql
-- Check which database you're connected to
SELECT current_database();

-- Check if functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%face_sheet%reservation%';
```

### Issue: Orphaned documents still being created

**Cause:** API code not updated or using old function

**Solution:**
1. Verify API code is using new atomic functions
2. Check `app/api/face-sheets/generate/route.ts` line ~200
3. Should call `create_face_sheet_with_reservation()` not `create_face_sheet_packages()`

### Issue: Performance degradation

**Cause:** Advisory locks causing contention

**Solution:**
```sql
-- Check for lock contention
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- If many locks, increase lock timeout
ALTER DATABASE postgres SET lock_timeout = '10s';
```

---

## 📞 Support Contacts

- **Database Issues:** DBA Team
- **Application Issues:** Dev Team
- **Infrastructure Issues:** DevOps Team
- **Emergency Rollback:** On-call Engineer

---

## 📝 Deployment Log Template

```
Deployment Date: _______________
Deployed By: _______________
Environment: [ ] Staging [ ] Production

Pre-Deployment:
[ ] Tests passed
[ ] Backup completed
[ ] Team notified

Deployment:
[ ] Migration 220 applied at: _______
[ ] Migration 221 applied at: _______
[ ] Migration 222 applied at: _______
[ ] Verification script passed
[ ] Application deployed at: _______
[ ] Smoke tests passed

Post-Deployment:
[ ] No errors in logs (30 min)
[ ] No orphaned documents
[ ] Performance verified
[ ] Users notified

Issues Encountered:
_________________________________
_________________________________

Resolution:
_________________________________
_________________________________

Sign-off: _______________
```

---

## 🎉 Conclusion

This deployment fixes critical P0 bugs:
- ✅ BUG-001: Race conditions (Migration 220)
- ✅ BUG-002: Orphaned documents (Migrations 221-222)
- ✅ BUG-003: Artificial delays (removed in API)

**Expected Impact:**
- 0% orphaned documents (down from 5-10%)
- ~500ms faster response time
- Better error handling
- Improved system reliability

---

**End of Deployment Guide**
