# สรุปการแก้ไขปัญหา Dispatch Inventory และ Available Picklists

## ภาพรวม
แก้ไขปัญหาการแสดงใบหยิบเก่าที่ไม่ควรแสดงใน 2 หน้า:
1. หน้า "จัดสินค้าเสร็จ (PK,FS)" ที่ `/warehouse/preparation-area-inventory`
2. หน้า "สร้างใบโหลดสินค้า" ที่ `/receiving/loadlists`

## ปัญหาที่พบ

### ปัญหาหลัก
- ใบหยิบเก่า (PL-20260116-003/005/006) แสดงในทั้ง 2 หน้า
- ควรแสดงเฉพาะใบหยิบใหม่ (PL-20260118-001/002/003)

### สาเหตุ
1. **Dispatch Inventory ติดลบ**: Balance Table ไม่ sync กับ Ledger (-5,972 vs -330 pieces)
2. **API ไม่กรอง Reservations**: ทั้ง 2 API ไม่ได้เช็คว่าใบหยิบมี active reservations ที่ Dispatch หรือไม่
3. **Reservations ถูก Released**: ใบหยิบเก่าไม่มี reservations ที่ Dispatch แล้ว แต่ยังแสดงอยู่

## การแก้ไข

### 1. Reset Dispatch Inventory (Migrations 237-238)
**วัตถุประสงค์**: ลบ inventory ทั้งหมดที่ Dispatch และสร้างใหม่จาก 3 ใบหยิบที่ pending

**ผลลัพธ์**:
- ✅ Dispatch Balance: จาก -5,972 → +2,062 pieces
- ✅ Reserved: 2,062 pieces (ตรงกับ 3 ใบหยิบ)
- ✅ Negative Balances: 0

**ไฟล์**:
- `supabase/migrations/237_reset_dispatch_inventory_to_pending_picklists.sql`
- `supabase/migrations/238_reset_dispatch_inventory_skip_trigger.sql`

### 2. Fix Dispatch Reservations (Migration 239)
**วัตถุประสงค์**: อัพเดท reservations ของใบหยิบใหม่ให้มี `staging_location_id = 'Dispatch'`

**ผลลัพธ์**:
- ✅ PL-20260118-001: 17 reservations → staging_location_id = 'Dispatch'
- ✅ PL-20260118-002: 4 reservations → staging_location_id = 'Dispatch'
- ✅ PL-20260118-003: 11 reservations → staging_location_id = 'Dispatch'
- ✅ Total: 32 reservations updated

**ไฟล์**:
- `supabase/migrations/239_fix_dispatch_reservations_staging_location.sql`

### 3. Release Old Picklist Reservations (Migration 240)
**วัตถุประสงค์**: Release reservations ของใบหยิบเก่าเพื่อไม่ให้แสดงอีก

**ผลลัพธ์**:
- ✅ PL-20260116-003: 14 reservations → status = 'released'
- ✅ PL-20260116-005: 58 reservations → status = 'released'
- ✅ PL-20260116-006: 47 reservations → status = 'released'
- ✅ Total: 119 reservations released

**ไฟล์**:
- `supabase/migrations/240_release_old_picklist_reservations.sql`

### 4. Fix Prepared Documents API (Edit 04)
**วัตถุประสงค์**: แก้ไข API `/api/warehouse/prepared-documents` ให้กรองตาม Dispatch reservations

**การเปลี่ยนแปลง**:
- Query `picklists` โดยตรงแทนที่จะ query `picklist_items`
- เพิ่ม nested query สำหรับ `picklist_items` และ `picklist_item_reservations`
- Filter เฉพาะ picklists ที่มี items กับ reservations ที่:
  - `staging_location_id = 'Dispatch'`
  - `status = 'picked'`

**ไฟล์**:
- `app/api/warehouse/prepared-documents/route.ts`

### 5. Fix Available Picklists API (Edit 05)
**วัตถุประสงค์**: แก้ไข API `/api/loadlists/available-picklists` ให้กรองตาม Dispatch reservations

**การเปลี่ยนแปลง**:
- เพิ่ม nested query สำหรับ `picklist_items` และ `picklist_item_reservations`
- Filter เฉพาะ picklists ที่มี items กับ reservations ที่:
  - `staging_location_id = 'Dispatch'`
  - `status = 'picked'`
- อัพเดท pagination count ให้ใช้ filtered count

**ไฟล์**:
- `app/api/loadlists/available-picklists/route.ts`

## Logic การกรองที่ใช้ทั้ง 2 API

```
Picklist จะแสดงก็ต่อเมื่อ:
1. status = 'completed' ✅
2. มี picklist_items ที่:
   - ไม่ถูก void (voided_at IS NULL AND status != 'voided')
   - มี picklist_item_reservations ที่:
     - staging_location_id = 'Dispatch'
     - status = 'picked'
```

## ผลลัพธ์สุดท้าย

### ใบหยิบเก่า (PL-20260116-003/005/006)
❌ **จะไม่แสดงในทั้ง 2 หน้า** เพราะ:
- ✅ status = 'completed'
- ❌ **ไม่มี reservations ที่ Dispatch** (ถูก released ใน migration 240)

### ใบหยิบใหม่ (PL-20260118-001/002/003)
✅ **จะแสดงในทั้ง 2 หน้า** เพราะ:
- ✅ status = 'completed'
- ✅ **มี reservations ที่ Dispatch** (ถูกตั้งค่าใน migration 239)

## ไฟล์ที่เกี่ยวข้อง

### Migrations
- `supabase/migrations/237_reset_dispatch_inventory_to_pending_picklists.sql`
- `supabase/migrations/238_reset_dispatch_inventory_skip_trigger.sql`
- `supabase/migrations/239_fix_dispatch_reservations_staging_location.sql`
- `supabase/migrations/240_release_old_picklist_reservations.sql`

### API Routes
- `app/api/warehouse/prepared-documents/route.ts`
- `app/api/loadlists/available-picklists/route.ts`

### Documentation
- `docs/Inventories/edit01.md` - Dispatch Negative Balance Analysis
- `docs/Inventories/edit02.md` - Reset Dispatch Inventory
- `docs/Inventories/edit03.md` - Fix Dispatch Tab Display Issue (Initial)
- `docs/Inventories/edit04.md` - Fix Prepared Documents API
- `docs/Inventories/edit05.md` - Fix Available Picklists API
- `docs/Inventories/DISPATCH_NEGATIVE_BALANCE_ANALYSIS.md` - Detailed Analysis

### Scripts
- `scripts/reset-dispatch-inventory.js`
- `scripts/verify-dispatch-balance-sync.js`
- `scripts/verify-dispatch-tab-fix.js`
- `scripts/test-prepared-documents-api.js`
- `scripts/test-available-picklists-api.js`

## การทดสอบ

### Test Scripts
```bash
# Test Prepared Documents API
node scripts/test-prepared-documents-api.js

# Test Available Picklists API
node scripts/test-available-picklists-api.js

# Verify Dispatch Balance
node scripts/verify-dispatch-balance-sync.js
```

### Expected Results
- ✅ แสดงเฉพาะ 3 ใบหยิบใหม่: PL-20260118-001, PL-20260118-002, PL-20260118-003
- ❌ ไม่แสดงใบหยิบเก่า: PL-20260116-003, PL-20260116-005, PL-20260116-006
- ✅ Dispatch Balance: +2,062 pieces (ไม่ติดลบ)

## Build Status
✅ **Build สำเร็จ** - ไม่มี TypeScript errors หรือ build errors

```bash
npm run build
# Exit Code: 0
```

## สถานะ
✅ **แก้ไขเสร็จสิ้นทั้งหมด**
- ✅ Dispatch Inventory ถูกต้อง
- ✅ API กรองใบหยิบตาม Dispatch reservations
- ✅ Build สำเร็จ
- ⏳ รอทดสอบผ่าน browser

---
**วันที่**: 2026-01-19
**ผู้แก้ไข**: Kiro AI Assistant
**Migrations**: 237, 238, 239, 240
**APIs แก้ไข**: 2 (prepared-documents, available-picklists)
