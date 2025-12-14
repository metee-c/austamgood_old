# Deployment Checklist - Build Warnings Fix

## วันที่: 14 ธันวาคม 2025

## Pre-Deployment Checklist

### ✅ Code Quality
- [x] TypeScript compilation passes (`npm run typecheck`)
- [x] ESLint passes (`npm run lint`)
- [x] Build completes successfully (`npm run build`)
- [x] No critical warnings in build output
- [x] All tests pass (if applicable)

### ✅ Dependencies
- [x] Removed @supabase/auth-helpers-nextjs
- [x] Updated to @supabase/ssr
- [x] No critical security vulnerabilities
- [x] package-lock.json updated

### ✅ Code Changes
- [x] lib/supabase/client.ts - Migrated to @supabase/ssr
- [x] hooks/usePermission.ts - Fixed loading states
- [x] components/auth/PermissionGuard.tsx - Added loadingFallback
- [x] All API routes updated to new Supabase client
- [x] middleware.ts - Added migration TODO

### ✅ Documentation
- [x] BUILD_WARNINGS_FIX_SUMMARY.md created
- [x] REMAINING_WARNINGS_ROADMAP.md created
- [x] DEPLOYMENT_CHECKLIST.md created (this file)
- [x] Code comments updated

### ✅ Testing
- [x] Local build successful
- [x] TypeScript types correct
- [x] No runtime errors in development

---

## Deployment Steps

### 1. Pre-Deployment
```bash
# 1. ตรวจสอบ branch
git status
git log --oneline -5

# 2. รัน tests ทั้งหมด
npm run typecheck
npm run lint
npm run build

# 3. ตรวจสอบ warnings
node scripts/check-build-warnings.js

# 4. ตรวจสอบ dependencies
npm audit
```

### 2. Commit & Push
```bash
# Already done:
git add .
git commit -m "fix: migrate from @supabase/auth-helpers to @supabase/ssr..."
git push origin main
```

### 3. Deploy to Vercel
```bash
# Option 1: Auto-deploy (recommended)
# Vercel จะ deploy อัตโนมัติเมื่อ push to main

# Option 2: Manual deploy
vercel --prod
```

### 4. Post-Deployment Verification
```bash
# 1. ตรวจสอบ deployment status
# https://vercel.com/[your-project]/deployments

# 2. ตรวจสอบ build logs
# - ไม่มี critical errors
# - ไม่มี @supabase/auth-helpers warnings
# - Middleware warning เป็นเรื่องปกติ (รอ Next.js 17)

# 3. ตรวจสอบ production site
# - Login/Logout ทำงาน
# - Permission checks ทำงาน
# - ไม่มี console errors
# - Loading states แสดงถูกต้อง
```

---

## Testing Checklist (Production)

### 🔐 Authentication Flow
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Logout
- [ ] Session persistence (refresh page)
- [ ] Session timeout (after 30 minutes)
- [ ] Password change
- [ ] Password reset

### 🔒 Permission System
- [ ] Admin user sees all features
- [ ] Regular user sees limited features
- [ ] Permission guards work correctly
- [ ] Loading states show properly
- [ ] No "No user" warnings in console
- [ ] Unauthorized access redirects correctly

### 📱 Mobile Pages
- [ ] Mobile pick page works
- [ ] Mobile loading page works
- [ ] Mobile face sheet page works
- [ ] Barcode scanning works

### 📊 Dashboard & Reports
- [ ] Dashboard loads correctly
- [ ] Charts render properly
- [ ] Data fetching works
- [ ] No permission errors

### 🏭 Warehouse Operations
- [ ] Receiving works
- [ ] Picking works
- [ ] Loading works
- [ ] Inventory updates correctly

---

## Rollback Plan

### If Issues Found:

#### Option 1: Quick Fix
```bash
# 1. Fix the issue locally
# 2. Test thoroughly
# 3. Commit and push
git add .
git commit -m "hotfix: [description]"
git push origin main
```

#### Option 2: Rollback to Previous Version
```bash
# 1. ใน Vercel Dashboard
# - ไปที่ Deployments
# - เลือก deployment ก่อนหน้า
# - คลิก "Promote to Production"

# 2. หรือใช้ git revert
git revert HEAD
git push origin main
```

#### Option 3: Emergency Rollback
```bash
# 1. Revert commit
git revert 750f367
git push origin main

# 2. Reinstall old dependencies
npm install @supabase/auth-helpers-nextjs@^0.8.7
npm install

# 3. Revert code changes
git checkout HEAD~1 -- lib/supabase/client.ts
git checkout HEAD~1 -- hooks/usePermission.ts
# ... etc

# 4. Commit and deploy
git add .
git commit -m "revert: rollback auth migration"
git push origin main
```

---

## Monitoring (First 24 Hours)

### Metrics to Watch:
1. **Error Rate**
   - Should be < 1%
   - Watch for auth errors
   - Watch for permission errors

2. **Response Time**
   - Should be similar to before
   - Watch for slow API routes

3. **User Reports**
   - Login issues
   - Permission issues
   - Loading issues

4. **Console Errors**
   - Check browser console
   - Check Vercel logs
   - Check Supabase logs

### Where to Monitor:
- Vercel Dashboard: https://vercel.com/[project]/analytics
- Supabase Dashboard: https://supabase.com/dashboard/project/[id]
- Browser DevTools Console
- User feedback channels

---

## Known Issues & Workarounds

### 1. Middleware Deprecation Warning
**Issue**: `The "middleware" file convention is deprecated`
**Impact**: None (still works in Next.js 15/16)
**Workaround**: None needed now, plan migration for Next.js 17
**Status**: ✅ Documented, not blocking

### 2. npm Deprecated Packages
**Issue**: rimraf, glob, inflight warnings
**Impact**: None (transitive dependencies)
**Workaround**: Will be fixed in Sprint 2
**Status**: ⏳ Planned for next sprint

### 3. ESLint 8 Deprecated
**Issue**: ESLint 8 no longer supported
**Impact**: No security updates
**Workaround**: Version locked, migration planned
**Status**: ⏳ Planned for Q1 2025

---

## Success Criteria

### ✅ Deployment Successful If:
1. Build completes without errors
2. No critical warnings in build output
3. All authentication flows work
4. All permission checks work
5. No console errors in production
6. No increase in error rate
7. User reports no issues

### ❌ Rollback If:
1. Authentication broken
2. Permission system broken
3. Critical errors in console
4. Error rate > 5%
5. Major functionality broken
6. User complaints > 10

---

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Verify all critical flows
- [ ] Update team on deployment status

### Week 1
- [ ] Review analytics
- [ ] Check for any edge cases
- [ ] Document any issues found
- [ ] Plan Sprint 2 (dependency updates)

### Week 2
- [ ] Final review
- [ ] Update documentation if needed
- [ ] Close deployment ticket
- [ ] Start Sprint 2 planning

---

## Contact & Support

### If Issues Found:
1. **Critical Issues**: Rollback immediately
2. **High Priority**: Fix within 24 hours
3. **Medium Priority**: Fix in next sprint
4. **Low Priority**: Add to backlog

### Team Contacts:
- **Tech Lead**: [Name]
- **DevOps**: [Name]
- **QA**: [Name]

### Resources:
- Vercel Dashboard: https://vercel.com/[project]
- Supabase Dashboard: https://supabase.com/dashboard
- GitHub Repo: https://github.com/[org]/[repo]
- Documentation: /docs/

---

## Lessons Learned

### What Went Well:
- Comprehensive planning
- Thorough testing
- Good documentation
- Systematic approach

### What Could Be Improved:
- Earlier detection of deprecated packages
- More automated testing
- Better monitoring setup

### Action Items:
- [ ] Set up automated dependency checks
- [ ] Add more E2E tests
- [ ] Improve monitoring/alerting
- [ ] Create CI/CD pipeline

---

**Deployment Status**: ⏳ Ready to Deploy
**Risk Level**: 🟢 LOW
**Estimated Downtime**: 0 minutes (zero-downtime deployment)
**Rollback Time**: < 5 minutes

**Approved By**: [Name]
**Date**: 14 ธันวาคม 2025
**Next Review**: หลัง deployment 24 ชั่วโมง
