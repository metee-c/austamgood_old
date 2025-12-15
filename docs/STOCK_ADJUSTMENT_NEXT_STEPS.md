# ขั้นตอนถัดไปสำหรับระบบปรับสต็อก (Stock Adjustment)

**วันที่:** 15 ธันวาคม 2025  
**สถานะ:** ✅ การตรวจสอบเสร็จสมบูรณ์ - พร้อมเริ่มพัฒนา

---

## 📋 สรุปสถานะปัจจุบัน

### ✅ สิ่งที่มีอยู่แล้ว (พร้อมใช้งาน)
- ตาราง `wms_inventory_ledger` พร้อม `skip_balance_sync` flag
- ตาราง `wms_inventory_balances` พร้อม CHECK constraints
- Trigger functions: `sync_inventory_ledger_to_balance()` และ `sync_location_qty_from_balance()`
- Enum types รองรับ 'adjustment' และ 'in'/'out' directions
- Permission modules (module_ids 211-215)
- Move service รองรับ adjustment type

### ❌ สิ่งที่ต้องสร้าง (ยังไม่มี)
1. โลเคชั่น ADJ-LOSS (Virtual location)
2. ตาราง `wms_adjustment_reasons`
3. ตาราง `wms_stock_adjustments` (Header)
4. ตาราง `wms_stock_adjustment_items` (Detail)
5. Validation trigger สำหรับ reserved stock
6. Service layer: `lib/database/stock-adjustment.ts`
7. API routes: `/api/stock-adjustment/*`
8. UI components และ pages

---

## 🚀 เริ่มพัฒนาได้เลย - ทำตามลำดับนี้

### Step 1: สร้าง Database Schema (1-2 วัน)

```bash
# สร้าง migrations ตามลำดับ
1. supabase/migrations/148_create_adj_loss_location.sql
2. supabase/migrations/149_create_adjustment_reasons.sql
3. supabase/migrations/150_create_stock_adjustments.sql
4. supabase/migrations/151_create_stock_adjustment_items.sql
5. supabase/migrations/152_create_adjustment_validation_trigger.sql
```

**SQL ทั้งหมดพร้อมใช้งานใน:**
- `docs/STOCK_ADJUSTMENT_MCP_VERIFICATION_REPORT.md` (Phase 1)

### Step 2: สร้าง Backend Service (3-4 วัน)

```bash
# สร้างไฟล์เหล่านี้
lib/database/stock-adjustment.ts          # Service layer
types/stock-adjustment-schema.ts          # Type definitions
app/api/stock-adjustment/route.ts         # List & Create
app/api/stock-adjustment/[id]/route.ts    # Detail, Update, Delete
app/api/stock-adjustment/[id]/submit/route.ts
app/api/stock-adjustment/[id]/approve/route.ts
app/api/stock-adjustment/[id]/reject/route.ts
app/api/stock-adjustment/[id]/complete/route.ts
app/api/stock-adjustment/reasons/route.ts
```

**Template code พร้อมใช้งานใน:**
- `docs/STOCK_ADJUSTMENT_MCP_VERIFICATION_REPORT.md` (Phase 2, Appendix B)

### Step 3: สร้าง Frontend UI (3-4 วัน)

```bash
# แก้ไขและสร้างไฟล์เหล่านี้
app/stock-management/adjustment/page.tsx                    # Main page (แก้ไข)
components/stock-adjustment/CreateAdjustmentModal.tsx       # Create form
components/stock-adjustment/AdjustmentItemsTable.tsx        # Items table
components/stock-adjustment/AdjustmentReasonSelect.tsx      # Reason dropdown
components/stock-adjustment/AdjustmentApprovalModal.tsx     # Approval modal
components/stock-adjustment/AdjustmentDetailModal.tsx       # Detail view
hooks/useStockAdjustment.ts                                 # Custom hooks
```

### Step 4: Testing (2-3 วัน)

```bash
# Test scenarios
1. Create increase adjustment
2. Create decrease adjustment
3. Validate reserved stock
4. Submit for approval
5. Approve/Reject workflow
6. Complete adjustment (record to ledger)
7. Cancel adjustment
```

---

## 📖 เอกสารที่สร้างเสร็จแล้ว

### 1. รายงานการตรวจสอบ MCP (หลัก)
**ไฟล์:** `docs/STOCK_ADJUSTMENT_MCP_VERIFICATION_REPORT.md`

**เนื้อหา:**
- ✅ สรุปผลการตรวจสอบ (Executive Summary)
- ✅ การตรวจสอบรายละเอียด 15 ข้อ (Detailed Verification)
- ✅ แผนการพัฒนา 5 Phase (Implementation Roadmap)
- ✅ ข้อแนะนำสำหรับการพัฒนา (Development Guidelines)
- ✅ SQL Migrations พร้อมใช้งาน
- ✅ TypeScript Type Definitions
- ✅ Service Layer Template
- ✅ ประมาณการเวลาพัฒนา

### 2. เอกสารนี้
**ไฟล์:** `docs/STOCK_ADJUSTMENT_NEXT_STEPS.md`

**เนื้อหา:**
- สรุปสถานะปัจจุบัน
- ขั้นตอนการพัฒนาแบบ step-by-step
- Checklist สำหรับแต่ละ phase

---

## ⚠️ ข้อควรระวังสำคัญ

### 1. Single-Entry vs Dual-Entry
- **Adjustment เป็น single-entry** (location ↔ ADJ-LOSS)
- **Move service ออกแบบสำหรับ dual-entry** (from_location → to_location)
- ต้องปรับ logic ให้รองรับทั้งสองแบบ

### 2. Reserved Stock Validation
- **ต้องตรวจสอบ reserved_qty ก่อน decrease**
- ใช้ trigger `validate_adjustment_reserved_stock()` (มี SQL ใน report แล้ว)
- แสดง error message ที่ชัดเจนถ้า validation ไม่ผ่าน

### 3. Approval Workflow
- ตัดสินใจว่า approval เป็น **required** หรือ **optional**
- ถ้า required: draft → pending_approval → approved → completed
- ถ้า optional: draft → completed (skip approval)

### 4. Ledger Entry Pattern
```typescript
// Increase (เพิ่มสต็อก)
{
  direction: 'in',
  location_id: 'LOC-A-01-01', // actual location
  // ADJ-LOSS เป็น virtual location ไม่ต้องบันทึกใน ledger
}

// Decrease (ลดสต็อก)
{
  direction: 'out',
  location_id: 'LOC-A-01-01', // actual location
  // ADJ-LOSS เป็น virtual location ไม่ต้องบันทึกใน ledger
}
```

---

## 📊 ประมาณการเวลา

| Phase | งาน | เวลา |
|-------|-----|------|
| 1 | Database Schema | 1-2 วัน |
| 2 | Backend Service + API | 3-4 วัน |
| 3 | Frontend UI | 3-4 วัน |
| 4 | Testing | 2-3 วัน |
| 5 | Documentation | 1-2 วัน |
| **รวม** | | **10-15 วันทำการ** |

---

## ✅ Checklist ก่อนเริ่ม

- [ ] อ่าน `STOCK_ADJUSTMENT_MCP_VERIFICATION_REPORT.md` ทั้งหมด
- [ ] Review database schema design (Phase 1)
- [ ] ตัดสินใจเรื่อง approval workflow (required/optional)
- [ ] เตรียม test data (SKUs, Locations, Warehouses)
- [ ] Create feature branch: `feature/stock-adjustment`
- [ ] เริ่มจาก Step 1: สร้าง migrations

---

## 🎯 เริ่มได้เลย!

**คำสั่งแรก:**
```bash
# 1. สร้าง migration file
touch supabase/migrations/148_create_adj_loss_location.sql

# 2. Copy SQL จาก report (Phase 1.1)
# 3. Run migration
npm run db:migrate

# 4. ทำต่อไปตาม Step 1-4
```

**หากมีคำถาม:**
- ดูรายละเอียดใน `STOCK_ADJUSTMENT_MCP_VERIFICATION_REPORT.md`
- SQL migrations พร้อมใช้งานทั้งหมด
- TypeScript types พร้อมใช้งาน
- Service layer template พร้อมใช้งาน

---

**สถานะ:** ✅ พร้อมเริ่มพัฒนาได้ทันที  
**เอกสารครบถ้วน:** ✅ 100%  
**SQL Migrations:** ✅ พร้อมใช้งาน  
**Type Definitions:** ✅ พร้อมใช้งาน

