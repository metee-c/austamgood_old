# Partial Rollback Implementation Complete

## สรุปการ Implement

**วันที่เสร็จสิ้น**: 19 ธันวาคม 2025
**อัปเดตล่าสุด**: 19 ธันวาคม 2025 - แก้ไข CRITICAL gaps ตาม Verification Report

---

## ✅ สิ่งที่ Implement แล้ว

### 1. Database Migrations (Applied via MCP)

| Migration | Description | Status |
|-----------|-------------|--------|
| `add_order_tracking_to_ledger` | เพิ่ม `order_id`, `order_item_id`, `original_ledger_id` ใน `wms_inventory_ledger` | ✅ Applied |
| `add_rollback_columns_to_orders` | เพิ่ม rollback lock และ audit columns ใน `wms_orders` | ✅ Applied |
| `add_rollback_lock_functions` | สร้าง `lock_order_for_rollback`, `unlock_order_rollback` | ✅ Applied |
| `add_voided_status_to_document_items` | เพิ่ม `voided_at`, `voided_by`, `void_reason` | ✅ Applied |
| `create_rollback_audit_logs_table` | สร้างตาราง `wms_rollback_audit_logs` | ✅ Applied |
| `create_rollback_audit_functions` | สร้าง audit log functions | ✅ Applied |
| `create_release_reservation_functions` | สร้าง `release_all_order_reservations` | ✅ Applied |
| `create_void_document_items_functions` | สร้าง void functions สำหรับ document items | ✅ Applied |
| `create_remove_order_functions` | สร้าง `remove_order_loadlist_items`, `remove_order_from_route` | ✅ Applied |
| `create_void_empty_parent_documents` | สร้าง `void_empty_parent_documents` | ✅ Applied |
| `add_rollback_count_to_orders` | เพิ่ม `rollback_count` column | ✅ Applied |
| `add_rollback_reason_and_atomic_function` | เพิ่ม `rollback_reason` column และ `execute_order_rollback_atomic()` function | ✅ Applied |

### 2. Backend Service

**File**: `lib/database/order-rollback.ts`

| Method | Description | Status |
|--------|-------------|--------|
| `getRollbackPreview()` | ดึงข้อมูล Preview ก่อนทำ Rollback | ✅ Complete |
| `executeRollback()` | **✅ UPDATED** - ใช้ `execute_order_rollback_atomic()` RPC | ✅ Complete |
| `executeRollbackLegacy()` | Legacy method สำหรับ backward compatibility | ✅ Complete |
| `reverseLoading()` | Reverse Loading: Delivery-In-Progress → Dispatch | ✅ Complete |
| `reversePicking()` | Reverse Picking: Dispatch → Preparation Area | ✅ Complete |
| `getRollbackHistory()` | ดึงประวัติการ Rollback | ✅ Complete |
| `canRollback()` | ตรวจสอบว่า Order สามารถ Rollback ได้หรือไม่ | ✅ Complete |

### 3. API Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/orders/[id]/rollback-preview` | GET | Preview Rollback Impact | ✅ Complete |
| `/api/orders/[id]/rollback` | POST | Execute Rollback | ✅ Complete |
| `/api/orders/[id]/rollback` | GET | Check if can rollback | ✅ Complete |
| `/api/orders/[id]/rollback-history` | GET | Get Rollback History | ✅ Complete |

### 4. Frontend Components

| Component | Description | Status |
|-----------|-------------|--------|
| `RollbackButton.tsx` | ปุ่ม Rollback พร้อม permission check | ✅ Complete |
| `RollbackPreviewModal.tsx` | Modal แสดง Preview และ Confirm | ✅ Complete |
| `RollbackHistoryTable.tsx` | ตารางแสดงประวัติการ Rollback | ✅ Complete |

### 5. Integration

- ✅ Integrated `RollbackPreviewModal` into Orders page (`app/receiving/orders/page.tsx`)
- ✅ Replaced old simple rollback modal with new comprehensive modal

---

## 🔧 CRITICAL FIXES (19 ธันวาคม 2025)

### Fix 1: Pick API - Ledger Entries with order_id/order_item_id
**File**: `app/api/mobile/pick/scan/route.ts`
- ✅ OUT ledger entry มี `order_id` และ `order_item_id`
- ✅ IN ledger entry มี `order_id` และ `order_item_id`

### Fix 2: Face Sheet API - Ledger Entries with order_id/order_item_id
**File**: `app/api/mobile/face-sheet/scan/route.ts`
- ✅ OUT ledger entry มี `order_id` และ `order_item_id`
- ✅ IN ledger entry มี `order_id` และ `order_item_id`

### Fix 3: Bonus Face Sheet API - Ledger Entries with order_item_id
**File**: `app/api/mobile/bonus-face-sheet/scan/route.ts`
- ✅ OUT ledger entry มี `order_item_id`
- ✅ IN ledger entry มี `order_item_id`
- Note: Bonus items link via `order_item_id` → `wms_order_items.order_id`

### Fix 4: Atomic Transaction for Rollback
**File**: `lib/database/order-rollback.ts`
- ✅ `executeRollback()` ใช้ `execute_order_rollback_atomic()` RPC
- ✅ TRUE atomic transaction (DB-level BEGIN/COMMIT/ROLLBACK)
- ✅ Row-level locking (`FOR UPDATE`)
- ✅ `original_ledger_id` linking ใน reverse ledger entries
- ✅ `rollback_reason` ใน reverse ledger entries

---

## 🔄 Rollback Flow (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARTIAL ROLLBACK FLOW                        │
│                    (Atomic Transaction)                         │
│                                                                 │
│  1. User clicks Rollback button                                 │
│  2. System shows Preview Modal with:                            │
│     - Affected documents (Picklists, Face Sheets, Loadlists)    │
│     - Stock to restore                                          │
│     - Reservations to release                                   │
│     - Warnings                                                  │
│  3. User enters reason and confirms                             │
│  4. System calls execute_order_rollback_atomic() RPC:           │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ BEGIN TRANSACTION (DB-level)                            │ │
│     │   a. Lock Order row (FOR UPDATE)                        │ │
│     │   b. Create Audit Log                                   │ │
│     │   c. Reverse Loading (with original_ledger_id link)     │ │
│     │   d. Reverse Picking (with original_ledger_id link)     │ │
│     │   e. Release Reservations                               │ │
│     │   f. Void Document Items                                │ │
│     │   g. Remove from Route                                  │ │
│     │   h. Void Empty Parent Documents                        │ │
│     │   i. Reset Order Status to Draft                        │ │
│     │   j. Complete Audit Log                                 │ │
│     │ COMMIT (or ROLLBACK on error)                           │ │
│     └─────────────────────────────────────────────────────────┘ │
│  5. Show success summary                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 BRCGS Compliance

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Full Traceability | Reverse Ledger entries with `order_id`, `order_item_id` | ✅ |
| Audit Trail | `wms_rollback_audit_logs` table | ✅ |
| Original Entry Link | `original_ledger_id` in reverse entries | ✅ |
| Rollback Reason | `rollback_reason` column in ledger | ✅ |
| Atomic Transaction | `execute_order_rollback_atomic()` with row-level locking | ✅ |
| No Hard Delete | Reverse Ledger pattern (append-only) | ✅ |
| No Data Deletion | Void items instead of delete | ✅ |
| User Accountability | `created_by`, `voided_by` columns | ✅ |
| Timestamp Accuracy | `movement_at`, `voided_at` columns | ✅ |
| Reason Documentation | `reason`, `void_reason` columns | ✅ |

---

## 🧪 Testing Checklist

| Test Case | Description | Status |
|-----------|-------------|--------|
| TC-001 | Rollback Order ที่ยังไม่ได้ pick | ⏳ Pending |
| TC-002 | Rollback Order ที่ pick แล้ว | ⏳ Pending |
| TC-003 | Rollback Order ที่ load แล้ว | ⏳ Pending |
| TC-004 | Rollback Order ใน shared Picklist | ⏳ Pending |
| TC-005 | Rollback Order ใน shared Loadlist | ⏳ Pending |
| TC-006 | Concurrent rollback prevention | ⏳ Pending |
| TC-007 | Rollback Order ที่ in_transit (should fail) | ⏳ Pending |
| TC-008 | Re-process after rollback | ⏳ Pending |

---

## 📁 Files Created/Modified

### New Files
- `lib/database/order-rollback.ts`
- `app/api/orders/[id]/rollback-preview/route.ts`
- `app/api/orders/[id]/rollback/route.ts`
- `app/api/orders/[id]/rollback-history/route.ts`
- `components/orders/RollbackButton.tsx`
- `components/orders/RollbackPreviewModal.tsx`
- `components/orders/RollbackHistoryTable.tsx`
- `supabase/migrations/160_create_rollback_audit_functions.sql`
- `supabase/migrations/161_create_void_document_items_functions.sql`
- `supabase/migrations/162_create_release_all_order_reservations.sql`

### Modified Files
- `app/receiving/orders/page.tsx` - Added RollbackPreviewModal import and integration

---

## 🚀 Usage

### From Orders Page
1. ไปที่หน้า `/receiving/orders`
2. หา Order ที่ต้องการ Rollback (สถานะไม่ใช่ draft, in_transit, delivered)
3. คลิกปุ่ม Rollback (ไอคอน RotateCcw สีส้ม)
4. ตรวจสอบ Preview ที่แสดง
5. กรอกเหตุผลและยืนยัน

### Programmatically
```typescript
import { orderRollbackService } from '@/lib/database/order-rollback';

// Preview
const { data: preview } = await orderRollbackService.getRollbackPreview(orderId);

// Execute
const { data: result } = await orderRollbackService.executeRollback({
  orderId,
  userId,
  reason: 'ลูกค้าขอยกเลิก'
});

// History
const { data: history } = await orderRollbackService.getRollbackHistory(orderId);
```

---

## 📝 Notes

- Rollback ใช้ **Reverse Ledger Pattern** ไม่ใช่ Hard Delete เพื่อรองรับ BRCGS Audit
- ทุก Rollback จะถูกบันทึกใน `wms_rollback_audit_logs`
- Order ที่ถูก Rollback จะมี `rollback_count` เพิ่มขึ้น
- Document items จะถูก **Void** ไม่ใช่ลบ (มี `voided_at`, `voided_by`, `void_reason`)
- Parent documents ที่ไม่มี items เหลือจะถูก Void อัตโนมัติ
