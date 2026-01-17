# 🔧 Prompt #2: Fix Non-Atomic Multi-Step Transaction

## 📋 Task Overview
รวม Face Sheet creation และ Stock reservation ให้อยู่ใน transaction เดียวกัน เพื่อป้องกัน orphaned documents

---

## 🎯 Instructions for AI

### Step 1: Understand the Problem

**Current Flow (BUG):**
```
API Call 1: create_face_sheet_packages() → ✅ Committed
                ↓ (Gap - Race condition window!)
API Call 2: reserve_stock_for_face_sheet_items() → ❌ May fail

Result: Face sheet exists but no stock reserved!
```

**Target Flow (FIX):**
```
API Call: create_face_sheet_with_reservation()
  BEGIN TRANSACTION
    → Create face sheet
    → Create items  
    → Reserve stock
    → All succeed → COMMIT
    → Any fail → ROLLBACK (nothing created)
  END TRANSACTION
```

### Step 2: Locate Files to Modify

```
1. app/api/face-sheets/generate/route.ts - Main API endpoint
2. supabase/migrations/ - Create new combined function
```

### Step 3: Create Combined Database Function

สร้าง `supabase/migrations/221_create_atomic_face_sheet_creation.sql`

### Step 4: Update API Endpoint

**File:** `app/api/face-sheets/generate/route.ts`

```typescript
// BEFORE (2 separate RPC calls - BUG!)
const { data: result } = await supabase.rpc('create_face_sheet_packages', {...});
const { data: reserveResult } = await supabase.rpc('reserve_stock_for_face_sheet_items', {...});

// AFTER (1 atomic RPC call - FIX!)
const { data: result, error } = await supabase.rpc('create_face_sheet_with_reservation', {
  p_warehouse_id: warehouse_id,
  p_delivery_date: delivery_date,
  p_order_ids: order_ids,
  p_created_by: created_by
});
```

---

## 📝 Checklist Before Commit

- [ ] สร้าง combined function สำหรับ Face Sheet
- [ ] สร้าง combined function สำหรับ Bonus Face Sheet
- [ ] Update API endpoints ให้ใช้ function ใหม่
- [ ] ลบ code เก่าที่เรียก RPC แยก 2 calls
- [ ] Test ว่า rollback ทำงานถูกต้อง
- [ ] Test concurrent requests
- [ ] Code review

---

## ⚠️ Important Notes

1. **Backward Compatibility:** Function เก่ายังคงอยู่ แต่ควรเลิกใช้
2. **Error Handling:** ต้อง handle INSUFFICIENT_STOCK error ใน frontend
3. **Transaction:** PostgreSQL auto-rollback เมื่อมี exception
4. **Testing:** ต้อง test scenario ที่ stock ไม่พอ
