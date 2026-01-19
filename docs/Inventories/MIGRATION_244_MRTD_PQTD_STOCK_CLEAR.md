# Migration 244: Clear MRTD/PQTD Stock After Loading

## ปัญหา
ที่หน้า http://localhost:3000/warehouse/inventory-balances โลเคชั่น MRTD และ PQTD ยังแสดงยอดคงเหลือ แต่ของจริงไม่มีแล้วเพราะยืนยันโหลดไปแล้ว

## การวิเคราะห์

### ข้อมูลที่พบ
- **ยอดคงเหลือใน wms_inventory_balances**: 78 รายการ
  - MRTD: 4,866 แพ็ค + 73,370 ชิ้น
  - PQTD: รวมอยู่ในยอดข้างต้น
- **Packages ที่ storage_location = MRTD/PQTD**: 0 รายการ
- **Ledger ล่าสุด**: transaction_type = 'ship' (ยืนยันโหลดแล้ว)

### สาเหตุ
เมื่อยืนยันการโหลด (loading confirmation) ระบบได้:
1. ✅ อัปเดต `bonus_face_sheet_packages.loaded_at`
2. ✅ เคลียร์ `bonus_face_sheet_packages.storage_location`
3. ✅ สร้าง ledger entry ประเภท 'ship'
4. ❌ **แต่ไม่ได้ลดสต็อกใน wms_inventory_balances**

## การแก้ไข

### Migration 244
สร้าง migration เพื่อ:
1. บันทึกสต็อกปัจจุบันสำหรับ audit trail
2. สร้าง ledger entries ประเภท 'ship' สำหรับการลดสต็อก
3. ลดสต็อกใน wms_inventory_balances เป็น 0
4. ตรวจสอบผลลัพธ์

### การรัน Migration

```bash
node run-migration-244.js
```

### ผลลัพธ์

```
📊 Step 1: Checking current stock...
Found 78 records with stock
Total: 4866.069999999998 packs + 73370 pieces

📝 Step 2: Creating ledger entries...
  Inserted batch 1 (78 entries)
✅ Created 78 ledger entries

🧹 Step 3: Clearing stock from wms_inventory_balances...
✅ Stock cleared

🔍 Step 4: Verifying results...
✅ All stock cleared from MRTD/PQTD

✅ Migration 244 completed successfully!
```

## การตรวจสอบหลัง Migration

```bash
node check-mrtd-pqtd-stock.js
```

### ผลการตรวจสอบ
- ✅ ยอดคงเหลือใน wms_inventory_balances: 0 รายการ
- ✅ Ledger entries: สร้างครบ 78 รายการ (transaction_type = 'ship', direction = 'out')
- ✅ Packages: ไม่มี packages ที่ storage_location = MRTD/PQTD

## ไฟล์ที่เกี่ยวข้อง

### Migration Files
- `supabase/migrations/244_clear_mrtd_pqtd_stock_after_loading.sql` - SQL migration file
- `run-migration-244.js` - Node.js script สำหรับรัน migration

### Verification Scripts
- `check-mrtd-pqtd-stock.js` - Script ตรวจสอบสต็อกที่ MRTD/PQTD

## Technical Details

### Tables Modified
1. **wms_inventory_balances**
   - Updated 78 records
   - Set `total_pack_qty = 0`, `total_piece_qty = 0`
   - Set `reserved_pack_qty = 0`, `reserved_piece_qty = 0`

2. **wms_inventory_ledger**
   - Inserted 78 new records
   - Fields:
     - `transaction_type = 'ship'`
     - `direction = 'out'`
     - `pack_qty` = ยอดที่ลด
     - `piece_qty` = ยอดที่ลด
     - `reference_doc_type = 'migration'`
     - `reference_doc_id = 244`
     - `remarks = 'Clear MRTD/PQTD stock after loading confirmation (Migration 244)'`
   - **Note**: ตาราง `wms_inventory_ledger` ไม่มีคอลัมน์ `lot_no` (แก้ไขใน SQL migration แล้ว)

### Data Integrity
- ✅ Audit trail: บันทึกทุก transaction ใน ledger
- ✅ Traceability: สามารถตรวจสอบย้อนหลังได้จาก ledger
- ✅ Balance consistency: ยอดคงเหลือตรงกับความเป็นจริง

## การป้องกันปัญหาในอนาคต

### Root Cause
ปัญหาเกิดจากการยืนยันโหลด BFS ไม่ได้ลดสต็อกที่ MRTD/PQTD

### แนวทางแก้ไข
ควรเพิ่ม logic ในการยืนยันโหลด BFS:
1. เมื่อ `bfs_confirmed_to_staging = 'yes'`
2. ต้องลดสต็อกที่ MRTD/PQTD ออกทันที
3. สร้าง ledger entry ประเภท 'ship'

### API ที่ควรแก้ไข
- `app/api/mobile/loading/complete/route.ts` - API ยืนยันโหลด
- หรือ trigger ใน database ที่จัดการ BFS loading confirmation

## สรุป

✅ **สำเร็จ**: ลดสต็อกที่ MRTD และ PQTD ออกทั้งหมด 78 รายการ (4,866 แพ็ค + 73,370 ชิ้น)

✅ **Audit Trail**: บันทึกทุก transaction ใน wms_inventory_ledger

✅ **Data Integrity**: ยอดคงเหลือตรงกับความเป็นจริง (ไม่มีของที่ MRTD/PQTD แล้ว)

## Status
✅ **COMPLETE** - Migration 244 executed successfully on 2026-01-19

### Execution History
1. **Node.js Script** (`run-migration-244.js`): รันสำเร็จ - ลดสต็อก 78 รายการ
2. **SQL Migration Fix**: แก้ไข error `lot_no` column ที่ไม่มีในตาราง `wms_inventory_ledger`
3. **SQL Migration** (`244_clear_mrtd_pqtd_stock_after_loading.sql`): รันสำเร็จ - No rows returned (เพราะ script รันไปแล้ว)
