# Stock Adjustment System - Implementation Complete ✅

**วันที่:** 15 ธันวาคม 2025
**สถานะ:** พร้อมใช้งาน (Ready for Testing)
**ผู้พัฒนา:** System Development Team

---

## 📋 สรุปการพัฒนา

ระบบปรับสต็อก (Stock Adjustment System) ได้รับการพัฒนาเสร็จสมบูรณ์ครบทุก Phase ตามแผนที่วางไว้ พร้อมใช้งานทันที โดยมีการออกแบบให้รองรับการปรับสต็อกเพิ่ม/ลด ระดับ Location และ Pallet พร้อมระบบอนุมัติและบันทึก Audit Trail แบบสมบูรณ์

---

## ✅ Phase 1: Database Schema (เสร็จสมบูรณ์)

### Migration Files ที่สร้าง (5 ไฟล์)

#### 1. **148_create_adj_loss_location.sql**
- สร้าง ADJ-LOSS virtual location สำหรับการติดตาม
- เพิ่มคอลัมน์ `is_system_location` ใน `master_location`
- Location ID: `LOC-ADJ-LOSS-001`
- Location Code: `ADJ-LOSS`
- **FIX:** แก้ไข numeric overflow error (เปลี่ยน `max_capacity_weight_kg` จาก 999999999.999 → 9999999.999)

#### 2. **149_create_adjustment_reasons.sql**
- สร้างตาราง `wms_adjustment_reasons`
- เพิ่มข้อมูลเริ่มต้น 13 เหตุผล:
  - **Increase**: FOUND (พบสินค้าคงเหลือ), RETURN (รับคืนจากลูกค้า), RECOUNT (นับใหม่พบมากกว่า), PRODUCTION (รับจากการผลิต), OTHER-IN (อื่นๆ - เพิ่ม)
  - **Decrease**: DAMAGED (สินค้าเสียหาย), EXPIRED (หมดอายุ), LOST (สูญหาย), SAMPLE (ตัวอย่าง), SCRAP (ของเสีย), RECOUNT-SHORT (นับใหม่พบน้อยกว่า), OTHER-OUT (อื่นๆ - ลด)
  - **Both**: CORRECTION (แก้ไขข้อมูลผิดพลาด)
- มี flag `requires_approval` เพื่อกำหนดว่าต้องอนุมัติหรือไม่

#### 3. **150_create_stock_adjustments.sql**
- สร้างตาราง `wms_stock_adjustments` (header)
- Auto-generate เลขที่เอกสาร: `ADJ-YYYYMM-XXXX`
- Status workflow: `draft` → `pending_approval` → `approved` → `completed`
- เก็บข้อมูล approval workflow (approved_by, rejected_by, completed_by, cancelled_by)
- เก็บ timestamp และ reason สำหรับทุกการเปลี่ยนสถานะ

#### 4. **151_create_stock_adjustment_items.sql**
- สร้างตาราง `wms_stock_adjustment_items` (detail)
- เก็บ before/adjustment/after quantities
- Auto-calculate `after_qty = before_qty + adjustment_qty` ผ่าน trigger
- Validate: after quantity ต้องไม่ติดลบ
- Constraint: `adjustment_piece_qty != 0` (ต้องไม่เป็น 0)
- Link กับ `wms_inventory_ledger` (ledger_id) หลัง complete

#### 5. **152_create_adjustment_validation_trigger.sql**
- สร้าง function `validate_adjustment_reserved_stock()`
  - Validate การลดสต็อกไม่เกิน available quantity
  - ป้องกันการปรับสต็อกที่ถูก reserve ไว้แล้ว
  - แสดง error message ที่ชัดเจน (total/reserved/available quantities)
- สร้าง helper function `can_adjust_stock()`
  - ใช้สำหรับตรวจสอบก่อน submit form
  - Return: can_adjust, total_qty, reserved_qty, available_qty, error_message

### Type Definitions

**types/stock-adjustment-schema.ts** (413 บรรทัด)
- Enums: `AdjustmentType`, `AdjustmentStatus`, `ReasonType`
- Interfaces:
  - `AdjustmentReason`, `StockAdjustment`, `StockAdjustmentItem`
  - `AdjustmentRecord` (with joins), `AdjustmentItemRecord` (with joins)
  - `CreateAdjustmentPayload`, `UpdateAdjustmentPayload`
  - `ApprovalPayload`, `AdjustmentFilters`, `StockAvailability`
- Zod schemas: validation สำหรับทุก payload
- Helper functions: 13 functions (canEditAdjustment, getStatusColor, ฯลฯ)

### Service Layer

**lib/database/stock-adjustment.ts** (650+ บรรทัด)
- Class: `StockAdjustmentService`
- Methods (12+):
  - **Query**: `getAdjustments()`, `getAdjustmentById()`, `getAdjustmentReasons()`
  - **CRUD**: `createAdjustment()`, `updateAdjustment()`
  - **Workflow**: `submitForApproval()`, `approveAdjustment()`, `rejectAdjustment()`, `completeAdjustment()`, `cancelAdjustment()`
  - **Helper**: `getCurrentBalance()`, `checkStockAvailability()`
- การทำงาน:
  - `createAdjustment()`: สร้าง header + items พร้อม capture before_qty
  - `completeAdjustment()`: บันทึก ledger entries + sync balances

---

## ✅ Phase 2: Backend API (เสร็จสมบูรณ์)

### API Routes ที่สร้าง (9 endpoints)

#### 1. **GET /api/stock-adjustments**
- List adjustments with filters
- Filters: `adjustment_type`, `status`, `warehouse_id`, `reason_id`, `created_by`, `searchTerm`, `startDate`, `endDate`, `limit`, `offset`
- Validation: Zod schema
- Authentication: Required

#### 2. **POST /api/stock-adjustments**
- Create new adjustment
- Validation: `createAdjustmentSchema`
- Auto-capture `before_qty` from current balance

#### 3. **GET /api/stock-adjustments/[id]**
- Get adjustment by ID
- Include joins: reason, warehouse, items, users

#### 4. **PATCH /api/stock-adjustments/[id]**
- Update adjustment (draft only)
- Validation: `updateAdjustmentSchema`

#### 5. **DELETE /api/stock-adjustments/[id]**
- Delete adjustment (draft only)
- Cascade delete items

#### 6. **POST /api/stock-adjustments/[id]/submit**
- Submit for approval
- Change status: `draft` → `pending_approval`

#### 7. **POST /api/stock-adjustments/[id]/approve**
- Approve adjustment
- Change status: `pending_approval` → `approved`

#### 8. **POST /api/stock-adjustments/[id]/reject**
- Reject adjustment
- Require rejection reason
- Change status: `pending_approval` → `rejected`

#### 9. **POST /api/stock-adjustments/[id]/complete**
- Complete adjustment (record to ledger)
- Change status: `approved` → `completed`
- Create ledger entries
- Update `wms_inventory_balances` via trigger

#### 10. **POST /api/stock-adjustments/[id]/cancel**
- Cancel adjustment
- Require cancellation reason
- Allowed for: draft, pending_approval, approved

#### 11. **GET /api/stock-adjustments/reasons**
- Get adjustment reasons
- Optional filter: `activeOnly` (default: true)

#### 12. **POST /api/stock-adjustments/check-availability**
- Check stock availability before adjustment
- Validate against reserved quantities
- Return: can_adjust, total_qty, reserved_qty, available_qty

---

## ✅ Phase 3: Frontend UI (เสร็จสมบูรณ์)

### Custom Hook

**hooks/useStockAdjustment.ts**
- Built with SWR for data fetching + caching
- Methods:
  - Data: `adjustments`, `reasons`
  - Mutations: `createAdjustment`, `updateAdjustment`, `deleteAdjustment`
  - Workflow: `submitForApproval`, `approveAdjustment`, `rejectAdjustment`, `completeAdjustment`, `cancelAdjustment`
  - Helper: `checkAvailability`
  - Revalidation: `mutate`, `mutateReasons`
- Hook ย่อย: `useAdjustmentById(id)` สำหรับดึงข้อมูลรายการเดียว

### Components ที่สร้าง

#### 1. **components/forms/StockAdjustmentForm.tsx** (650+ บรรทัด)
**ฟีเจอร์:**
- Form สำหรับ Create และ Edit adjustment
- React Hook Form + Zod validation
- **Header section:**
  - Adjustment type (increase/decrease) - disabled เมื่อ edit
  - Warehouse selector
  - Reason selector (filtered by type)
  - Reference No (optional)
  - Remarks (optional)
- **Items section:**
  - Dynamic item array with useFieldArray
  - แต่ละรายการ: SKU, Location, Pallet ID, Quantity, Remarks
  - เพิ่ม/ลบรายการได้
  - Validate: quantity ต้องไม่เป็น 0
- **Stock validation:**
  - เรียก `checkAvailability()` ก่อน submit (สำหรับ decrease)
  - แสดง error ถ้า available quantity ไม่พอ
- **Empty state:** แสดงเมื่อยังไม่มีรายการ
- **Loading state:** แสดงขณะบันทึกข้อมูล

#### 2. **components/forms/StockAdjustmentDetailModal.tsx** (700+ บรรทัด)
**ฟีเจอร์:**
- แสดงรายละเอียด adjustment แบบเต็ม
- **Status & Type badges:** แสดงสถานะและประเภทด้วยสี
- **Header information:**
  - วันที่ปรับสต็อก
  - คลังสินค้า
  - เหตุผลการปรับ
  - เลขที่อ้างอิง
- **Workflow tracking:**
  - แสดงประวัติการดำเนินการทั้งหมด
  - สร้างโดย / อนุมัติโดย / ปฏิเสธโดย / ดำเนินการโดย
  - แสดง timestamp และ reason
- **Items table:**
  - แสดงรายการสินค้าพร้อม before/adjustment/after quantities
  - สีเขียว (+) และสีแดง (-) สำหรับ adjustment_qty
- **Workflow actions:**
  - Draft: แก้ไข, ลบ, ส่งอนุมัติ
  - Pending: อนุมัติ, ไม่อนุมัติ (ต้องใส่เหตุผล)
  - Approved: ดำเนินการเสร็จสิ้น
  - All: ยกเลิก (ต้องใส่เหตุผล)
- **Reason modals:** สำหรับ reject และ cancel

#### 3. **app/stock-management/adjustment/page.tsx** (อัปเดตแล้ว)
**ฟีเจอร์:**
- **Header:** ชื่อหน้า + ปุ่ม "สร้างใบปรับสต็อก"
- **Filters:**
  - Search (เลขที่เอกสาร, Reference No)
  - Status filter (all, draft, pending, approved, rejected, completed, cancelled)
  - Type filter (all, increase, decrease)
- **Adjustments table:**
  - คอลัมน์: เลขที่เอกสาร, ประเภท, คลัง, เหตุผล, วันที่, สถานะ, จัดการ
  - Status badges ตามสี (gray, yellow, green, red, blue)
  - Type badges (เขียว = increase, แดง = decrease)
  - Actions: ดูรายละเอียด (Eye), แก้ไข (Edit - draft only)
- **Stats cards:**
  - รอดำเนินการ (draft)
  - รออนุมัติ (pending_approval)
  - อนุมัติแล้ว (approved)
  - เสร็จสิ้น (completed)
- **States:**
  - Loading state
  - Error state
  - Empty state
- **Modals:**
  - Create/Edit: `StockAdjustmentForm`
  - Detail view: `StockAdjustmentDetailModal`

---

## 🔑 Key Features

### 1. Single-Entry Bookkeeping
- ต่างจาก Move (dual-entry)
- **Increase:** สร้าง ledger entry direction='in' ที่ location จริง
- **Decrease:** สร้าง ledger entry direction='out' ที่ location จริง
- **ADJ-LOSS:** ไม่บันทึกใน ledger (ใช้เป็น concept เท่านั้น)

### 2. Reserved Stock Protection
- Database trigger: `validate_adjustment_reserved_stock()`
- ป้องกันการลดสต็อกที่ถูก reserve ไว้สำหรับ order
- Validate: `adjustment_qty <= (total_qty - reserved_qty)`
- Error message ชัดเจน พร้อม total/reserved/available quantities

### 3. Approval Workflow
```
draft → pending_approval → approved → completed
  ↓           ↓              ↓
cancelled  rejected      cancelled
             ↓
           draft (ส่งใหม่)
```

### 4. Auto-Number Generation
- Format: `ADJ-YYYYMM-XXXX`
- Example: `ADJ-202512-0001`
- Counter reset ทุกเดือน

### 5. Audit Trail
- เก็บ user tracking:
  - created_by + created_at
  - approved_by + approved_at
  - rejected_by + rejected_at + rejection_reason
  - completed_by + completed_at
  - cancelled_by + cancelled_at + cancellation_reason
- แสดงประวัติการดำเนินการทั้งหมดใน Detail Modal

### 6. Ledger Integration
- บันทึกลง `wms_inventory_ledger` เมื่อ status = 'completed'
- Auto-sync กับ `wms_inventory_balances` ผ่าน trigger
- เก็บ `reference_doc_type = 'stock_adjustment'`
- เก็บ `reference_doc_id = adjustment_id`

---

## 📊 Database Schema Summary

### Tables Created
1. **wms_adjustment_reasons** (13 default reasons)
2. **wms_stock_adjustments** (header table)
3. **wms_stock_adjustment_items** (detail table)
4. **master_location** (enhanced with `is_system_location`)

### Triggers Created
1. **generate_adjustment_no()** - Auto-number generation
2. **calculate_adjustment_after_qty()** - Auto-calculate after quantities
3. **validate_adjustment_reserved_stock()** - Reserved stock validation
4. **update_wms_stock_adjustments_updated_at()** - Auto-update timestamp
5. **update_wms_stock_adjustment_items_updated_at()** - Auto-update timestamp

### Functions Created
1. **can_adjust_stock()** - Helper function for availability check

### Indexes Created
- `idx_master_location_is_system` - System location lookup
- `idx_adjustment_items_adjustment` - Item lookup by adjustment
- `idx_adjustment_items_sku` - Item lookup by SKU
- `idx_adjustment_items_location` - Item lookup by location
- `idx_adjustment_items_pallet` - Item lookup by pallet
- `idx_adjustment_items_ledger` - Item lookup by ledger

---

## 🧪 Testing Guide

### 1. Create Adjustment (Draft)
```
1. ไปที่ /stock-management/adjustment
2. คลิก "สร้างใบปรับสต็อก"
3. เลือกประเภท: เพิ่มสต็อก
4. เลือกคลัง: WH001
5. เลือกเหตุผล: FOUND (พบสินค้าคงเหลือ)
6. เพิ่มรายการ:
   - SKU: [เลือก SKU ที่มีอยู่]
   - Location: [เลือก location ที่มีอยู่]
   - Quantity: +100
7. คลิก "สร้างใบปรับสต็อก"
8. ✅ ควรสร้างสำเร็จ status = draft
```

### 2. Submit for Approval
```
1. คลิกที่ adjustment ที่สร้างไว้
2. ในหน้า Detail Modal คลิก "ส่งอนุมัติ"
3. Confirm
4. ✅ Status เปลี่ยนเป็น pending_approval
```

### 3. Approve Adjustment
```
1. เปิด adjustment ที่ status = pending_approval
2. คลิก "อนุมัติ"
3. Confirm
4. ✅ Status เปลี่ยนเป็น approved
```

### 4. Complete Adjustment
```
1. เปิด adjustment ที่ status = approved
2. คลิก "ดำเนินการเสร็จสิ้น"
3. Confirm
4. ✅ Status เปลี่ยนเป็น completed
5. ✅ ตรวจสอบ wms_inventory_ledger มี entry ใหม่
6. ✅ ตรวจสอบ wms_inventory_balances ถูกอัปเดต
```

### 5. Test Reserved Stock Protection (Decrease)
```
1. สร้าง adjustment ประเภท "ลดสต็อก"
2. เลือก SKU/Location ที่มี reserved_qty > 0
3. ใส่ adjustment_qty = -(total_qty - reserved_qty + 1)
4. พยายาม submit
5. ✅ ควรแสดง error "Cannot decrease stock: exceeds available quantity"
```

### 6. Test Workflow Actions
```
- Draft → ส่งอนุมัติ → Pending
- Pending → อนุมัติ → Approved
- Pending → ไม่อนุมัติ (ใส่เหตุผล) → Rejected
- Approved → ดำเนินการเสร็จสิ้น → Completed
- Draft/Pending/Approved → ยกเลิก (ใส่เหตุผล) → Cancelled
```

---

## 📁 Files Created/Modified

### Database Migrations (5 files)
- `supabase/migrations/148_create_adj_loss_location.sql`
- `supabase/migrations/149_create_adjustment_reasons.sql`
- `supabase/migrations/150_create_stock_adjustments.sql`
- `supabase/migrations/151_create_stock_adjustment_items.sql`
- `supabase/migrations/152_create_adjustment_validation_trigger.sql`

### Type Definitions (1 file)
- `types/stock-adjustment-schema.ts`

### Service Layer (1 file)
- `lib/database/stock-adjustment.ts`

### API Routes (9 files)
- `app/api/stock-adjustments/route.ts`
- `app/api/stock-adjustments/[id]/route.ts`
- `app/api/stock-adjustments/[id]/submit/route.ts`
- `app/api/stock-adjustments/[id]/approve/route.ts`
- `app/api/stock-adjustments/[id]/reject/route.ts`
- `app/api/stock-adjustments/[id]/complete/route.ts`
- `app/api/stock-adjustments/[id]/cancel/route.ts`
- `app/api/stock-adjustments/reasons/route.ts`
- `app/api/stock-adjustments/check-availability/route.ts`

### Hooks (1 file)
- `hooks/useStockAdjustment.ts`

### Components (2 files)
- `components/forms/StockAdjustmentForm.tsx`
- `components/forms/StockAdjustmentDetailModal.tsx`

### Pages (1 file modified)
- `app/stock-management/adjustment/page.tsx` (updated from placeholder)

### Documentation (1 file)
- `docs/STOCK_ADJUSTMENT_IMPLEMENTATION_COMPLETE.md` (this file)

**Total:** 21 files created/modified

---

## 🚀 Next Steps (Optional Enhancements)

### Phase 4: Advanced Features (Future)
1. **Batch Import:**
   - Import adjustments from Excel
   - Validate stock availability in batch
   - Create multiple adjustments at once

2. **Reports:**
   - Adjustment summary report (by reason, by warehouse, by period)
   - Stock movement report (including adjustments)
   - Audit trail report

3. **Mobile Interface:**
   - `/mobile/stock-adjustment` for mobile scanning
   - Quick adjustment entry with barcode scanner

4. **Notifications:**
   - Email notification เมื่อมี adjustment รออนุมัติ
   - Alert เมื่อ adjustment ถูก approve/reject

5. **Advanced Validation:**
   - Minimum/maximum adjustment quantity per reason
   - Location-specific adjustment rules
   - SKU category-specific approval rules

---

## ⚠️ Important Notes

### 1. Database Type Regeneration
หลังรัน migration แล้ว ต้องรัน:
```bash
npm run db:generate-types
```
เพื่ออัปเดต `types/database/supabase.ts` ให้ตรงกับ schema ล่าสุด

### 2. Single-Entry vs Dual-Entry
- **Stock Adjustment:** Single-entry (เพิ่ม/ลดที่ location เดียว)
- **Stock Move:** Dual-entry (ออกจาก source + เข้า destination)
- **ADJ-LOSS:** ไม่ได้บันทึกใน ledger (เป็น concept เท่านั้น)

### 3. Reserved Stock Handling
- ระบบจะ **ป้องกัน** การลดสต็อกที่ถูก reserve ไว้
- ถ้าต้องการลด ต้อง unreserve ก่อน
- หรือเพิ่ม available quantity ก่อน

### 4. Status Transitions
```
draft:
  - สามารถ: แก้ไข, ลบ, ส่งอนุมัติ, ยกเลิก

pending_approval:
  - สามารถ: อนุมัติ, ไม่อนุมัติ, ยกเลิก

approved:
  - สามารถ: ดำเนินการเสร็จสิ้น, ยกเลิก

completed:
  - ไม่สามารถแก้ไขได้ (final state)

cancelled:
  - ไม่สามารถแก้ไขได้ (final state)
```

### 5. Ledger Entry Pattern
เมื่อ complete adjustment:
- **Increase:**
  - direction = 'in'
  - location_id = actual location
  - reference_doc_type = 'stock_adjustment'

- **Decrease:**
  - direction = 'out'
  - location_id = actual location
  - reference_doc_type = 'stock_adjustment'

---

## ✅ Completion Checklist

- [x] Phase 1: Database Schema
  - [x] 5 Migration files created
  - [x] All migrations tested and verified
  - [x] Type definitions created
  - [x] Service layer implemented

- [x] Phase 2: Backend API
  - [x] 9 API routes created
  - [x] All endpoints tested
  - [x] Authentication implemented
  - [x] Validation with Zod

- [x] Phase 3: Frontend UI
  - [x] Custom hook created
  - [x] StockAdjustmentForm component
  - [x] StockAdjustmentDetailModal component
  - [x] Main page updated
  - [x] All workflows integrated

- [x] Documentation
  - [x] Implementation summary
  - [x] Testing guide
  - [x] Important notes

---

## 📞 Support & Contact

หากพบปัญหาหรือต้องการความช่วยเหลือ:
1. ตรวจสอบ error logs ใน browser console และ Supabase logs
2. ตรวจสอบ database triggers ว่าทำงานถูกต้อง
3. ทดสอบตาม Testing Guide ด้านบน
4. Review code ใน files ที่สร้าง/แก้ไข

---

**สรุป:** Stock Adjustment System พร้อมใช้งานครบทุกฟีเจอร์ ตามที่ออกแบบไว้ในเอกสาร STOCK_ADJUSTMENT_NEXT_STEPS.md 🎉
