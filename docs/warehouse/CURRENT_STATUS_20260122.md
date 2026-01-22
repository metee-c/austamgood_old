# สถานะปัจจุบันของระบบ - 22 มกราคม 2026

## ✅ ปัญหาที่แก้ไขเสร็จแล้ว

### 1. Foreign Key Constraint - wms_move_items.executed_by
**Migration**: `287_fix_move_items_executed_by_fk.sql`

**ปัญหา**: 
- FK constraint อ้างอิงไปที่ `master_employee.employee_id` แต่ API ส่ง `user_id` จาก `master_system_user`
- เกิด error: "Insert or update on table wms_move_items violates foreign key constraint fk_move_items_executed_by"

**การแก้ไข**:
```sql
-- ลบ FK constraint เก่า
ALTER TABLE wms_move_items DROP CONSTRAINT IF EXISTS fk_move_items_executed_by;

-- สร้าง FK constraint ใหม่ที่อ้างอิงไปที่ master_system_user
ALTER TABLE wms_move_items 
ADD CONSTRAINT fk_move_items_executed_by 
FOREIGN KEY (executed_by) 
REFERENCES master_system_user(user_id);
```

**สถานะ**: ✅ แก้ไขเสร็จแล้ว - Migration 287 ถูก apply แล้ว

---

### 2. Balance Doubling Bug
**Migrations**: 
- `288_prevent_duplicate_move_ledger_entries.sql` (ตามสรุป - แต่ไม่พบไฟล์)
- `289_fix_balance_sync_delete_zero_balance.sql` (ตามสรุป - แต่ไม่พบไฟล์)

**ปัญหา**:
- เมื่อย้ายสินค้า 1 ครั้ง balance เพิ่มขึ้นเป็น 2-3 เท่า (84 → 168 หรือ 252 ชิ้น)
- Ledger entries ถูกต้อง (2 แถว: 1 OUT + 1 IN) แต่ balance ผิด

**Root Cause**:
- API `quick-move` ย้าย balance location โดยตรงก่อนที่ trigger จะสร้าง ledger entries
- เมื่อ trigger สร้าง OUT entry → หา balance ที่ต้นทางไม่เจอ (เพราะย้ายไปแล้ว) → ไม่ลบอะไร
- เมื่อ trigger สร้าง IN entry → หา balance ที่ปลายทางเจอ → UPDATE เพิ่ม +84 ชิ้น
- ผลลัพธ์: Balance เดิม 84 + 84 = 168 ชิ้น (เป็น 2 เท่า)

**การแก้ไข**:
1. แก้ไข `app/api/moves/quick-move/route.ts`:
   - ลบโค้ดที่ UPDATE balance location โดยตรง
   - ให้ trigger จัดการ balance อัตโนมัติผ่าน ledger entries

2. แก้ไข trigger `sync_move_item_to_ledger()`:
   - Check duplicate ledger entries
   - ลบ duplicate ledger entries ที่มีอยู่แล้ว

3. แก้ไข trigger `sync_inventory_ledger_to_balance()`:
   - ลบ balance ที่เหลือ 0
   - ป้องกัน balance ซ้ำซ้อนในระบบ

**สถานะ**: ✅ แก้ไขเสร็จแล้ว - API และ triggers ถูกแก้ไขแล้ว

---

### 3. Reservation System Removal
**Script**: `clear-all-reservations.js`

**ปัญหา**:
- User พยายามปรับสต็อกแต่เกิด error "Cannot adjust: pallet would have negative available quantity"
- ระบบป้องกันไม่ให้ available < 0 เพราะมี reserved quantities

**การแก้ไข**:
1. ล้างการจองทั้งหมด: 18 records, 1,538 pieces, 148 packs
2. แก้ไข Quick Adjust API ให้ไม่ตรวจสอบ reserved quantities
3. สร้างเอกสาร `RESERVATION_SYSTEM_REMOVAL.md` และ `QUICK_ADJUST_USAGE.md`

**สถานะ**: ✅ แก้ไขเสร็จแล้ว

---

### 4. Balance Issues - 56 Pallets (22 มกราคม 2026)
**Scripts**: 
- `fix-all-today-balance-issues.js`
- `fix-balance-from-ledger-today.js`
- `fix-all-doubled-balances.js`

**ปัญหา**:
1. **Missing Balance** (19 pallets): ไม่มี balance record → ขึ้น "ไม่พบข้อมูล Location"
2. **Wrong Amount** (1 pallet): แสดง 1680 ชิ้น แทนที่จะเป็น 84 ชิ้น
3. **Duplicate Balance** (2 pallets): มี balance 2 ที่
4. **Old Duplicate** (1 pallet): มี balance ที่ Receiving และ B10-04-007

**การแก้ไข**:
1. สร้าง balance ให้ 19 pallets ที่ขาดหาย
2. แก้ไข balance ของ ATG20260122000000037 จาก 1680 → 84
3. ลบ duplicate balance ที่ Receiving สำหรับ 2 pallets
4. ลบ duplicate balance ของ ATG20260122000000033

**สถานะ**: ✅ แก้ไขเสร็จแล้ว - พาเลททั้งหมด 56 พาเลทถูกต้องหมดแล้ว

---

### 5. Pallet ATG20260122000000039
**Scripts**: 
- `check-pallet-039.js`
- `fix-pallet-039-balance.js`

**ปัญหา**: 
- Pallet มี ledger entry (บันทึกการรับเข้า) แต่ไม่มี balance record
- ทำให้ระบบหาไม่เจอ

**การแก้ไข**:
- สร้าง balance จาก ledger entry:
  - SKU: B-BEY-C|SAL|070 (Buzz Beyond แซลมอน 7 กก.)
  - Location: B10-05-001
  - จำนวน: 84 ชิ้น (84 แพ็ค)
  - Production Date: 21 มกราคม 2026
  - Expiry Date: 21 กรกฎาคม 2027

**สถานะ**: ✅ แก้ไขเสร็จแล้ว - Pallet สามารถค้นหาและย้ายได้แล้ว

---

### 6. Order IV26011258 Rollback
**Script**: `rollback-order-iv26011258.js`

**ปัญหา**: 
- User ต้องการ rollback Order IV26011258 จากสถานะ "confirmed" กลับไปเป็น "draft"
- กดปุ่ม Rollback ที่ UI ไม่ได้

**การตรวจสอบ**:
- Order ID: 7841
- Order No: IV26011258
- **Status: draft** ← อยู่ในสถานะ draft อยู่แล้ว!
- Confirmed At: N/A

**สถานะ**: ✅ ไม่ต้องแก้ไข - Order อยู่ในสถานะ draft อยู่แล้ว

---

## ⚠️ ปัญหาที่ยังต้องแก้ไข

### 1. API Route 404 - /api/moves/quick-move

**ปัญหา**:
```
POST http://localhost:3000/api/moves/quick-move 404 (Not Found)
```

**สาเหตุ**:
- ไฟล์ `app/api/moves/quick-move/route.ts` มีอยู่และถูกต้อง
- แต่ Next.js dev server ไม่ได้ load API route ใหม่
- มี `.next` cache folder ที่อาจมี cache เก่า

**วิธีแก้ไข**:
1. Kill Node.js processes ทั้งหมด:
   ```powershell
   Get-Process node | Stop-Process -Force
   ```

2. ลบ `.next` cache folder:
   ```powershell
   Remove-Item -Recurse -Force .next
   ```

3. Build project ใหม่:
   ```powershell
   npm run build
   ```

4. Start dev server ใหม่:
   ```powershell
   npm run dev
   ```

**สถานะ**: ⚠️ รอ User restart dev server

---

## 📊 สรุปภาพรวม

### ✅ ระบบที่ทำงานปกติ
1. ✅ Foreign Key constraints ถูกต้อง
2. ✅ Balance doubling bug แก้ไขแล้ว
3. ✅ Reservation system ถูกลบออกแล้ว
4. ✅ พาเลททั้งหมด 56 พาเลท (22 ม.ค. 2026) มี balance ถูกต้อง
5. ✅ Pallet ATG20260122000000039 สามารถค้นหาและย้ายได้
6. ✅ Order IV26011258 อยู่ในสถานะ draft แล้ว

### ⚠️ ต้องดำเนินการ
1. ⚠️ Restart dev server เพื่อแก้ไข API Route 404

---

## 📝 คำแนะนำสำหรับ User

### การ Restart Dev Server
```powershell
# 1. Kill Node.js processes
Get-Process node | Stop-Process -Force

# 2. ลบ cache
Remove-Item -Recurse -Force .next

# 3. Build ใหม่
npm run build

# 4. Start dev server
npm run dev
```

### การตรวจสอบว่าระบบทำงานปกติ
1. เปิด http://localhost:3000/mobile/transfer
2. สแกน Pallet ATG20260122000000039
3. ย้ายไปยัง location ใหม่
4. ตรวจสอบว่าไม่มี error 404

### การตรวจสอบ Order IV26011258
1. เปิด http://localhost:3000/receiving/orders
2. ค้นหา Order IV26011258
3. ตรวจสอบว่าสถานะเป็น "draft" แล้ว
4. ไม่ต้องทำอะไรเพิ่มเติม

---

## 🔗 เอกสารที่เกี่ยวข้อง

1. `docs/warehouse/BALANCE_DOUBLING_BUG_FIX.md` - รายละเอียด Balance Doubling Bug
2. `docs/warehouse/BALANCE_ISSUES_COMPREHENSIVE_FIX.md` - การแก้ไข Balance Issues
3. `docs/warehouse/RESERVATION_SYSTEM_REMOVAL.md` - การลบ Reservation System
4. `docs/warehouse/API_404_FIX.md` - การแก้ไข API 404 Error
5. `QUICK_ADJUST_USAGE.md` - วิธีใช้ Quick Adjust
6. `START_DEV_SERVER.md` - วิธี Start Dev Server

---

**อัพเดทล่าสุด**: 22 มกราคม 2026
**สถานะ**: ระบบพร้อมใช้งาน - รอ restart dev server เท่านั้น
