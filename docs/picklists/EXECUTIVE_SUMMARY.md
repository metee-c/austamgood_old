# 📊 Executive Summary: Stock Management Bug Analysis

**Date:** January 17, 2026  
**Status:** ⚠️ CRITICAL BUGS IDENTIFIED  
**Priority:** P0 - Immediate Action Required

---

## 🎯 Key Findings

### Critical Issues Discovered

1. **Race Condition in Stock Reservation** (P0 - CRITICAL)
   - Multiple concurrent requests can oversell stock
   - No row-level locking during reservation
   - Impact: "Insufficient stock" errors in production

2. **Multi-Step Transaction Without Atomicity** (P0 - CRITICAL)
   - Face sheet creation and stock reservation are separate operations
   - If reservation fails, face sheet already exists
   - Impact: Orphaned documents without stock reservations

3. **Artificial Timing Delays** (P0 - HIGH)
   - 500ms delay between item creation and reservation in bonus face sheets
   - Creates race condition window
   - Impact: Stock can be reserved by other requests during delay

4. **Missing Rollback Mechanisms** (P1 - HIGH)
   - Failed operations don't properly release reserved stock
   - No automatic cleanup of orphaned reservations
   - Impact: Stock permanently locked

5. **Virtual Pallet Settlement Timing** (P2 - MEDIUM)
   - Settlement trigger runs after balance sync
   - Rapid insertions may cause temporary shortages
   - Impact: Delayed stock availability

---

## 📈 System Overview

### Document Flow
```
Orders → Route Planning → Picklist/Face Sheet/Bonus Face Sheet → Loadlist → Pick → Load → Deliver
         (จัดเส้นทาง)     (✅ RESERVE STOCK)                      (NO STOCK)  (✅ DEDUCT)  (✅ TRANSFER)
```

### Stock Reservation Points
- **Picklist Creation:** Reserves from Prep Areas (FEFO/FIFO)
- **Face Sheet Creation:** Reserves from Storage/Picking Areas
- **Bonus Face Sheet Creation:** Reserves from Prep Areas only
- **Mobile Pick:** Deducts from source, adds to Dispatch
- **Mobile Loading:** Deducts from Dispatch, adds to Delivery

### Virtual Pallet System
- Allows negative balances when stock insufficient
- Auto-settles when new stock arrives
- Format: `VIRTUAL-{location}-{sku}`

---

## 🔧 Recommended Fixes (Priority Order)

### P0 - Immediate (Deploy within 24 hours)

1. **Add Row-Level Locking**
```sql
SELECT * FROM wms_inventory_balances
WHERE ... 
FOR UPDATE;  -- ✅ Lock rows during transaction
```

2. **Wrap Operations in Single Transaction**
```sql
CREATE FUNCTION create_and_reserve_face_sheet(...) AS $
BEGIN
  -- Create document
  -- Create items
  -- Reserve stock
  -- All in one transaction
END;
$ LANGUAGE plpgsql;
```

3. **Remove Artificial Delays**
```typescript
// REMOVE THIS:
await new Promise(resolve => setTimeout(resolve, 500));
```

### P1 - Short-term (Deploy within 1 week)

4. **Implement Optimistic Locking**
```sql
ALTER TABLE wms_inventory_balances ADD COLUMN version INT DEFAULT 1;

UPDATE wms_inventory_balances
SET reserved_piece_qty = ..., version = version + 1
WHERE balance_id = ? AND version = ?;
```

5. **Add Retry Logic**
```typescript
async function reserveWithRetry(params, maxRetries = 3) {
  // Exponential backoff: 100ms, 200ms, 400ms
}
```

6. **Pre-flight Stock Check**
```typescript
const stockCheck = await checkAvailability(items);
if (!stockCheck.all_available) {
  return error('สต็อกไม่เพียงพอ');
}
```

### P2 - Medium-term (Deploy within 1 month)

7. **Set Transaction Isolation Level**
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

8. **Add Monitoring Alerts**
- Overselling detection
- Virtual Pallet growth
- Orphaned reservations
- Settlement delays

---

## 📊 Impact Assessment

### Current State
- ❌ Race conditions causing overselling
- ❌ Orphaned documents without reservations
- ❌ Stock permanently locked after failures
- ⚠️ Virtual Pallet settlement delays

### After Fixes
- ✅ Atomic stock reservations
- ✅ Automatic rollback on failures
- ✅ Proper error handling
- ✅ Monitoring and alerts

---

## 🧪 Testing Strategy

### Unit Tests
- Concurrent reservation (3+ simultaneous requests)
- Transaction rollback on failure
- Virtual Pallet settlement

### Integration Tests
- Complete flow: Order → Pick → Load
- Multi-document scenarios
- Error recovery

### Load Tests
- 100 concurrent picklist creations
- Stress test Virtual Pallet system
- Peak hour simulation

---

## 📈 Metrics to Monitor

1. **Overselling Rate**
   - Target: 0%
   - Alert: Any instance of `reserved_piece_qty > total_piece_qty`

2. **Orphaned Reservations**
   - Target: < 1% of total reservations
   - Alert: Reservations without valid documents

3. **Virtual Pallet Deficit**
   - Target: < 100 pieces per SKU
   - Alert: Deficit > 100 pieces for > 1 hour

4. **API Error Rate**
   - Target: < 0.1%
   - Alert: "Insufficient stock" errors > 1% of requests

---

## 💰 Business Impact

### Current Issues Cost
- Lost sales due to "insufficient stock" errors
- Manual intervention to fix orphaned reservations
- Customer complaints about delayed orders
- Staff time spent troubleshooting

### Expected Benefits After Fixes
- ✅ Eliminate overselling errors
- ✅ Reduce manual interventions by 90%
- ✅ Improve order fulfillment rate
- ✅ Increase customer satisfaction

---

## 📅 Implementation Timeline

| Phase | Tasks | Duration | Status |
|-------|-------|----------|--------|
| **Phase 1** | Row locking, Single transaction, Remove delays | 1-2 days | 🔴 Not Started |
| **Phase 2** | Optimistic locking, Retry logic, Pre-flight checks | 3-5 days | 🔴 Not Started |
| **Phase 3** | Monitoring, Alerts, Load testing | 1-2 weeks | 🔴 Not Started |
| **Phase 4** | Documentation, Training, Rollout | 1 week | 🔴 Not Started |

**Total Estimated Time:** 3-4 weeks

---

## 🚨 Risk Assessment

### High Risk (Without Fixes)
- Continued overselling in production
- Data integrity issues
- Customer trust erosion
- Potential financial losses

### Medium Risk (During Implementation)
- Temporary performance impact during migration
- Need for thorough testing before deployment
- Possible downtime for database changes

### Low Risk (After Implementation)
- Well-tested solution
- Gradual rollout possible
- Easy rollback if issues arise

---

## 👥 Stakeholders

### Development Team
- Implement fixes
- Write tests
- Deploy changes

### QA Team
- Test concurrent scenarios
- Validate fixes
- Sign off on deployment

### Operations Team
- Monitor production
- Set up alerts
- Handle incidents

### Business Team
- Approve timeline
- Communicate with customers
- Track metrics

---

## 📞 Next Steps

1. **Immediate:** Review this analysis with development team
2. **Day 1:** Start implementing P0 fixes
3. **Day 2:** Deploy to staging environment
4. **Day 3:** Load testing and validation
5. **Day 4:** Deploy to production (off-peak hours)
6. **Week 1:** Monitor metrics closely
7. **Week 2:** Implement P1 fixes
8. **Month 1:** Complete P2 fixes and monitoring

---

## 📚 Related Documents

- **Full Analysis:** `docs/picklists/FULL_SYSTEM_ANALYSIS.md`
- **API Reference:** `docs/VRP/API_REFERENCE.md`
- **Database Schema:** `types/database/supabase.ts`
- **Migration Files:** `supabase/migrations/`

---

**Prepared by:** Kiro AI  
**Reviewed by:** [Pending]  
**Approved by:** [Pending]  
**Next Review:** January 24, 2026
