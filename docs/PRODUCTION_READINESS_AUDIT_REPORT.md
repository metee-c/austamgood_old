# PRODUCTION READINESS AUDIT REPORT

**Date:** 2026-01-11  
**Auditor:** Kiro AI  
**Reference:** edit17.md, edit18.md

---

## 1. Database Schema

| Metric | Value |
|--------|-------|
| Total Tables | 132 |
| Tables with RLS | 41 |
| Total RLS Policies | 80 |
| Functions/RPCs | 241 |

### Auth/Security Tables ✅
- `user_sessions` - Session management
- `login_attempts` - Login tracking
- `password_reset_tokens` - Password reset
- `audit_logs` - Audit trail

### master_system_user Columns ✅
- `password_hash` - Secure password storage
- `failed_login_attempts` - Brute force protection
- `locked_until` - Account lockout
- `password_changed_at` - Password age tracking
- `force_password_change` - Password policy
- `two_factor_enabled` - 2FA support

---

## 2. Data Integrity

| Check | Result | Status |
|-------|--------|--------|
| Balance vs Ledger Discrepancies | 502 records | ⚠️ WARNING |
| Negative Balances | 78 records | ⚠️ WARNING |
| Orphan Orders (no items) | 0 | ✅ PASS |
| Orphan Picklist Items | 0 | ✅ PASS |
| Orphan BFS Packages | 0 | ✅ PASS |
| Orphan Loadlists | 6 | ⚠️ MINOR |
| Orders without Customer | 2 | ⚠️ MINOR |
| Receives without Supplier | 0 | ✅ PASS |

### Notable Negative Balances (Top 5)
1. ถุง Buzz Netura แมวโต (Packaging): -4,575 packs
2. สติกเกอร์ ProteinX (Packaging): -4,575 packs
3. ถุงผ้าสปันบอนด์ (PK002): -334.62 packs
4. Buzz Beyond แมวโต ปลาทู (PK001): -172 packs
5. Buzz Balanced+ แมวโต Weight+ (PK001): -97.5 packs

---

## 3. Security

| Check | Result | Status |
|-------|--------|--------|
| Active Sessions | 20 (recent) | ✅ OK |
| Expired Sessions (not cleaned) | 255 | ⚠️ CLEANUP NEEDED |
| Locked Accounts | 0 | ✅ OK |
| Audit Logs | 339 records | ✅ OK |
| Failed Login Attempts | 0 (recent) | ✅ OK |

### Audit Log Summary
| Action | Entity Type | Count |
|--------|-------------|-------|
| LOGIN_SUCCESS | AUTHENTICATION | 326 |
| PASSWORD_RESET | AUTHENTICATION | 4 |
| USER_CREATE | USER | 4 |
| USER_DELETE | USER | 3 |
| USER_UPDATE | USER | 2 |

---

## 4. Implementation Verification (edit17.md)

### 4.1 Files with Auth Wrapper

| API Route | withAuth | withAdminAuth | Status |
|-----------|----------|---------------|--------|
| reset-reservations | - | ✅ | ✅ |
| quick-move | ✅ | - | ✅ |
| migrate-supplier | - | ✅ | ✅ |
| stock-import/upload | ✅ | - | ✅ |
| stock-import/process | ✅ | - | ✅ |
| master-customer | ✅ | ✅ (DELETE) | ✅ |
| master-supplier | ✅ | ✅ (DELETE) | ✅ |
| master-employee | ✅ | ✅ (DELETE) | ✅ |
| master-warehouse | ✅ | ✅ (DELETE) | ✅ |
| master-sku | ✅ | - | ✅ |
| master-location | ✅ | - | ✅ |
| orders | ✅ | - | ✅ |
| orders/[id] | ✅ | - | ✅ |
| receives | ✅ | - | ✅ |
| picklists | ✅ | - | ✅ |
| mobile/pick/scan | ✅ | - | ✅ |
| mobile/pick/tasks | ✅ | - | ✅ |
| mobile/loading/complete | ✅ | - | ✅ |
| mobile/loading/tasks | ✅ | - | ✅ |
| mobile/face-sheet/scan | ✅ | - | ✅ |
| mobile/bonus-face-sheet/scan | ✅ | - | ✅ |

**Auth Wrapper Coverage:** 20/20 APIs ✅

### 4.2 Service Role Key in API Routes

| File | Status |
|------|--------|
| storage-strategies/import/route.ts | ⚠️ FOUND |
| sku-options/route.ts | ⚠️ FOUND |
| orders/[id]/items/route.ts | ⚠️ FOUND |
| receive/update-external-pallet/route.ts | ⚠️ FOUND |
| orders/returnable/route.ts | ⚠️ FOUND |
| preparation-areas/route.ts | ⚠️ FOUND |
| preparation-areas/[id]/route.ts | ⚠️ FOUND |
| moves/items/[id]/route.ts | ⚠️ FOUND |
| preparation-areas/import/route.ts | ⚠️ FOUND |
| file-uploads/route.ts | ⚠️ FOUND (check only) |

**Service Role Key Occurrences:** 10 files ⚠️

### 4.3 userId = 1 Fallback

| File | Status |
|------|--------|
| stock-import/picking-area/process/route.ts | ⚠️ FOUND |
| orders/[id]/rollback/route.ts | ⚠️ FOUND |
| orders/import/route.ts | ⚠️ FOUND |
| bonus-face-sheets/confirm-pick-to-staging/route.ts | ⚠️ FOUND |

**userId Fallback Occurrences:** 4 files ⚠️

### 4.4 Rate Limiting

**Status:** ✅ ENABLED

Rate limiting is properly implemented in `lib/auth/auth-service.ts` using `checkLoginRateLimit()`.

---

## 5. Overall Status

| Category | Status |
|----------|--------|
| Database Schema | ✅ PASS |
| Auth Tables | ✅ PASS |
| Data Integrity | ⚠️ WARNING (502 discrepancies, 78 negative) |
| Security Implementation | ✅ PASS |
| Auth Wrapper (edit17.md) | ✅ PASS (20/20 APIs) |
| Service Role Key Cleanup | ⚠️ PARTIAL (10 files remaining) |
| userId Fallback Cleanup | ⚠️ PARTIAL (4 files remaining) |
| Rate Limiting | ✅ ENABLED |

### Ready for Production: ⚠️ CONDITIONAL

---

## 6. Remaining Issues

### Critical (Must Fix)
- None

### High Priority
1. **502 Balance vs Ledger Discrepancies** - Stock integrity issues
2. **78 Negative Balances** - Invalid stock states
3. **255 Expired Sessions** - Need cleanup job

### Medium Priority
1. **10 API files with Service Role Key** - Should migrate to `createServiceRoleClient()`
2. **4 API files with userId = 1 fallback** - Should use auth context

### Low Priority
1. **6 Orphan Loadlists** - Empty loadlists without linked documents
2. **2 Orders without Customer** - Data cleanup needed

---

## 7. Recommendations

### Immediate Actions
1. ✅ Auth wrapper implementation complete for critical APIs
2. ✅ Rate limiting enabled
3. ⚠️ Run session cleanup job to remove 255 expired sessions

### Short-term (1-2 weeks)
1. Investigate and fix 502 balance vs ledger discrepancies
2. Fix 78 negative balance records
3. Migrate remaining 10 API files to use `createServiceRoleClient()`
4. Remove userId = 1 fallback from 4 remaining files

### Long-term
1. Add RLS policies to remaining tables (91 tables without RLS)
2. Implement automated session cleanup cron job
3. Add more comprehensive audit logging for data operations

---

## Appendix: Files Requiring Attention

### Service Role Key Files
```
app/api/storage-strategies/import/route.ts
app/api/sku-options/route.ts
app/api/orders/[id]/items/route.ts
app/api/receive/update-external-pallet/route.ts
app/api/orders/returnable/route.ts
app/api/preparation-areas/route.ts
app/api/preparation-areas/[id]/route.ts
app/api/moves/items/[id]/route.ts
app/api/preparation-areas/import/route.ts
app/api/file-uploads/route.ts
```

### userId Fallback Files
```
app/api/stock-import/picking-area/process/route.ts
app/api/orders/[id]/rollback/route.ts
app/api/orders/import/route.ts
app/api/bonus-face-sheets/confirm-pick-to-staging/route.ts
```

---

*Report generated by Kiro AI Audit System*
