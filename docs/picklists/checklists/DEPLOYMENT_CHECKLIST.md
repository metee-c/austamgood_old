# 📋 Deployment Checklist: Stock Management Bug Fixes

## 🎯 Overview

Checklist สำหรับการ deploy fixes สำหรับ race conditions และ stock management bugs

**Target Date:** _____________  
**Responsible:** _____________  
**Approver:** _____________

---

## 📅 Pre-Deployment (D-3 to D-1)

### 1. Code Preparation

| # | Task | Owner | Status | Date |
|---|------|-------|--------|------|
| 1.1 | Code review completed | Dev Lead | ☐ | |
| 1.2 | All unit tests passing | QA | ☐ | |
| 1.3 | All integration tests passing | QA | ☐ | |
| 1.4 | Concurrent tests passing (100%) | QA | ☐ | |
| 1.5 | No security vulnerabilities | Security | ☐ | |
| 1.6 | Documentation updated | Dev | ☐ | |

### 2. Database Preparation

| # | Task | Owner | Status | Date |
|---|------|-------|--------|------|
| 2.1 | Migration scripts reviewed | DBA | ☐ | |
| 2.2 | Rollback scripts prepared | DBA | ☐ | |
| 2.3 | Staging migration successful | DBA | ☐ | |
| 2.4 | Performance benchmarks completed | DBA | ☐ | |
| 2.5 | Index optimization applied | DBA | ☐ | |

### 3. Environment Preparation

| # | Task | Owner | Status | Date |
|---|------|-------|--------|------|
| 3.1 | Staging environment mirrors production | DevOps | ☐ | |
| 3.2 | Staging tests passed | QA | ☐ | |
| 3.3 | Load tests passed (100 concurrent) | QA | ☐ | |
| 3.4 | Monitoring alerts configured | DevOps | ☐ | |
| 3.5 | Error tracking ready (Sentry/etc) | DevOps | ☐ | |

### 4. Communication

| # | Task | Owner | Status | Date |
|---|------|-------|--------|------|
| 4.1 | Stakeholders notified of deployment window | PM | ☐ | |
| 4.2 | Support team briefed on changes | PM | ☐ | |
| 4.3 | Customer notification prepared (if needed) | PM | ☐ | |
| 4.4 | On-call schedule confirmed | DevOps | ☐ | |

---

## 🌙 Deployment Day (D-Day)

### Recommended Time: 02:00 - 04:00 (Off-peak hours)

### 5. Pre-Deployment Checks

| # | Task | Owner | Status | Time |
|---|------|-------|--------|------|
| 5.1 | Production database backup completed | DBA | ☐ | |
| 5.2 | Backup verified (restore test) | DBA | ☐ | |
| 5.3 | Current error rate baseline captured | DevOps | ☐ | |
| 5.4 | Current response time baseline captured | DevOps | ☐ | |
| 5.5 | All team members available | Lead | ☐ | |

**Backup Location:** `___________________________`  
**Backup Size:** `_________ GB`  
**Backup Verified By:** `___________________________`

### 6. Database Migration

| # | Task | Owner | Status | Time |
|---|------|-------|--------|------|
| 6.1 | Put application in maintenance mode | DevOps | ☐ | |
| 6.2 | Stop all background jobs | DevOps | ☐ | |
| 6.3 | Wait for active transactions to complete | DBA | ☐ | |
| 6.4 | Apply migration 220 (Row Locking) | DBA | ☐ | |
| 6.5 | Verify function reserve_stock_for_face_sheet_items | DBA | ☐ | |
| 6.6 | Apply migration 221 (Atomic Face Sheet) | DBA | ☐ | |
| 6.7 | Verify function create_face_sheet_with_reservation | DBA | ☐ | |
| 6.8 | Apply migration 222 (Atomic Bonus FS) | DBA | ☐ | |
| 6.9 | Verify function create_bonus_face_sheet_with_reservation | DBA | ☐ | |
| 6.10 | Run database consistency check | DBA | ☐ | |

**Migration Start Time:** `___________`  
**Migration End Time:** `___________`  
**Duration:** `___________ minutes`

### 7. Application Deployment

| # | Task | Owner | Status | Time |
|---|------|-------|--------|------|
| 7.1 | Deploy API changes | DevOps | ☐ | |
| 7.2 | Verify API endpoints responding | DevOps | ☐ | |
| 7.3 | Deploy frontend changes (if any) | DevOps | ☐ | |
| 7.4 | Clear application cache | DevOps | ☐ | |
| 7.5 | Restart background jobs | DevOps | ☐ | |
| 7.6 | Remove maintenance mode | DevOps | ☐ | |

**Deployment Start Time:** `___________`  
**Deployment End Time:** `___________`  
**Duration:** `___________ minutes`

### 8. Smoke Tests

| # | Test | Expected Result | Status | Time |
|---|------|-----------------|--------|------|
| 8.1 | Create picklist with available stock | Success | ☐ | |
| 8.2 | Create face sheet with available stock | Success | ☐ | |
| 8.3 | Create bonus face sheet with available stock | Success | ☐ | |
| 8.4 | Create face sheet with insufficient stock | Proper error | ☐ | |
| 8.5 | 3 concurrent face sheet creations | No overselling | ☐ | |
| 8.6 | Mobile pick flow | Success | ☐ | |
| 8.7 | Mobile loading flow | Success | ☐ | |
| 8.8 | Loadlist creation | Success | ☐ | |

**All Smoke Tests Passed:** ☐ Yes ☐ No

### 9. Verification Queries

Run these queries to verify deployment success:

```sql
-- 1. Verify functions updated
SELECT 
  proname, 
  pg_get_function_result(oid) as return_type,
  obj_description(oid) as description
FROM pg_proc 
WHERE proname IN (
  'reserve_stock_for_face_sheet_items',
  'reserve_stock_for_bonus_face_sheet_items',
  'create_face_sheet_with_reservation',
  'create_bonus_face_sheet_with_reservation'
);

-- 2. Check for any overselling
SELECT 
  COUNT(*) as oversold_count
FROM wms_inventory_balances
WHERE reserved_piece_qty > total_piece_qty;
-- Expected: 0

-- 3. Check for orphaned reservations
SELECT 
  COUNT(*) as orphaned_count
FROM face_sheet_item_reservations r
LEFT JOIN face_sheet_items fsi ON r.face_sheet_item_id = fsi.id
WHERE fsi.id IS NULL;
-- Expected: 0

-- 4. Check Virtual Pallet health
SELECT 
  COUNT(*) as virtual_pallets,
  SUM(CASE WHEN total_piece_qty < 0 THEN 1 ELSE 0 END) as negative_balance
FROM wms_inventory_balances
WHERE pallet_id LIKE 'VIRTUAL-%';
```

| Query | Expected | Actual | Status |
|-------|----------|--------|--------|
| Functions updated | All 4 functions | | ☐ |
| Oversold count | 0 | | ☐ |
| Orphaned count | 0 | | ☐ |
| Virtual Pallets | N/A | | ☐ |

---

## 📊 Post-Deployment Monitoring (D+1 to D+7)

### 10. Immediate Monitoring (First 24 Hours)

| # | Metric | Alert Threshold | Current | Status |
|---|--------|-----------------|---------|--------|
| 10.1 | API Error Rate | < 0.5% | | ☐ |
| 10.2 | Response Time (p95) | < 500ms | | ☐ |
| 10.3 | Overselling Incidents | 0 | | ☐ |
| 10.4 | Failed Reservations | < 5% | | ☐ |
| 10.5 | Database Lock Waits | < 100ms avg | | ☐ |
| 10.6 | Deadlock Count | 0 | | ☐ |

**Hour 1 Review:** ☐ Completed by ___________  
**Hour 4 Review:** ☐ Completed by ___________  
**Hour 12 Review:** ☐ Completed by ___________  
**Hour 24 Review:** ☐ Completed by ___________  

### 11. Daily Checks (D+1 to D+7)

| Day | Overselling | Error Rate | Response Time | Sign-off |
|-----|-------------|------------|---------------|----------|
| D+1 | | | | |
| D+2 | | | | |
| D+3 | | | | |
| D+7 | | | | |

### 12. Weekly Review (D+7)

| # | Task | Owner | Status |
|---|------|-------|--------|
| 12.1 | Review all metrics from past week | DevOps | ☐ |
| 12.2 | Compare with pre-deployment baseline | DevOps | ☐ |
| 12.3 | Document any issues encountered | Dev | ☐ |
| 12.4 | Update runbook if needed | Dev | ☐ |
| 12.5 | Close deployment ticket | PM | ☐ |

---

## 🚨 Rollback Procedure

### Trigger Conditions
Rollback immediately if ANY of these occur:
- [ ] Overselling incidents detected (reserved > total)
- [ ] API error rate > 5%
- [ ] Response time > 2 seconds (p95)
- [ ] Multiple deadlock errors
- [ ] Data corruption detected

### Rollback Steps

| # | Step | Command/Action | Status |
|---|------|----------------|--------|
| R1 | Put app in maintenance mode | `./scripts/maintenance-on.sh` | ☐ |
| R2 | Stop all API servers | `./scripts/stop-api.sh` | ☐ |
| R3 | Restore database functions | See below | ☐ |
| R4 | Verify function rollback | Run verification queries | ☐ |
| R5 | Deploy previous API version | `./scripts/deploy-previous.sh` | ☐ |
| R6 | Start API servers | `./scripts/start-api.sh` | ☐ |
| R7 | Run smoke tests | See Section 8 | ☐ |
| R8 | Remove maintenance mode | `./scripts/maintenance-off.sh` | ☐ |
| R9 | Notify stakeholders | Email + Slack | ☐ |

### Database Rollback Commands

```sql
-- Rollback to previous functions (stored in backup)
-- Option 1: Restore from backup
pg_restore -h host -d dbname -t pg_proc backup_file.sql

-- Option 2: Re-run previous migration
\i supabase/migrations/previous_version.sql

-- Verify rollback
SELECT proname, obj_description(oid)
FROM pg_proc 
WHERE proname LIKE '%face_sheet%';
```

**Rollback Initiated:** ☐ Yes (Time: ___________)  
**Rollback Reason:** _________________________________  
**Rollback Completed:** ☐ Yes (Time: ___________)  
**Post-Rollback Verification:** ☐ Passed

---

## 📝 Sign-off

### Pre-Deployment Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Dev Lead | | | |
| QA Lead | | | |
| DBA | | | |
| DevOps Lead | | | |
| Product Owner | | | |

### Post-Deployment Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Dev Lead | | | |
| QA Lead | | | |
| Operations | | | |

---

## 📞 Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| On-Call Engineer | | | |
| DBA | | | |
| DevOps Lead | | | |
| Product Owner | | | |
| Escalation Manager | | | |

---

## 📎 Attachments

- [ ] Migration Scripts: `supabase/migrations/220_*.sql`, `221_*.sql`, `222_*.sql`
- [ ] Rollback Scripts: `supabase/rollback/220_*.sql`, `221_*.sql`, `222_*.sql`
- [ ] Test Results: `test-results/concurrent-tests-*.html`
- [ ] Performance Benchmarks: `benchmarks/pre-deploy-*.json`
- [ ] Runbook: `docs/runbook/stock-management.md`

---

**Document Version:** 1.0  
**Created:** January 17, 2026  
**Last Updated:** January 17, 2026
