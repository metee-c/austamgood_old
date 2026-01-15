# Bonus Face Sheet Virtual Pallet Fix

## วันที่: 15 มกราคม 2569

## สรุปการแก้ไข

### ปัญหาเดิม
- Bonus Face Sheet ไม่มีการจองสต็อคที่แข็งแรงเหมือน Picklist และ Face Sheet
- เมื่อสต็อคที่บ้านหยิบไม่พอ ระบบสร้าง balance ติดลบโดยไม่มี Virtual Pallet ID
- ไม่มีการบันทึก Ledger สำหรับ Virtual Reservation
- API ไม่มี error handling ที่เหมาะสมเมื่อการจองสต็อคล้มเหลว

### การแก้ไข

#### 1. Migration: `fix_bonus_face_sheet_reservation_use_virtual_pallet`
อัปเดต function `reserve_stock_for_bonus_face_sheet_items`:
- ✅ ไม่รวม Virtual Pallet ในการค้นหาสต็อคจริง (`pallet_id NOT LIKE 'VIRTUAL-%'`)
- ✅ ใช้ `create_or_update_virtual_balance()` เมื่อสต็อคไม่พอ
- ✅ สร้าง Virtual Pallet ID: `VIRTUAL-{location}-{sku_id}`
- ✅ บันทึก Ledger ด้วย `transaction_type = 'VIRTUAL_RESERVE'`
- ✅ อัปเดต item status เป็น 'reserved'

#### 2. API: `/api/bonus-face-sheets/route.ts`
- ✅ เพิ่ม error handling ที่แข็งแรงสำหรับการจองสต็อค
- ✅ Return error ถ้าการจองสต็อคล้มเหลว (ไม่ return success)
- ✅ แสดงจำนวน items ที่จองได้ใน response

#### 3. API: `/api/mobile/bonus-face-sheet/scan/route.ts`
- ✅ รองรับ Virtual Pallet ในการหยิบสินค้า
- ✅ ตรวจสอบ `pallet_id.startsWith('VIRTUAL-')` 
- ✅ อนุญาตให้หักสต็อคติดลบสำหรับ Virtual Pallet
- ✅ บันทึก pallet_id ใน Ledger entry

## Flow การทำงาน

### การสร้าง Bonus Face Sheet
```
1. สร้าง bonus_face_sheets header
2. สร้าง bonus_face_sheet_packages
3. สร้าง bonus_face_sheet_items
4. เรียก reserve_stock_for_bonus_face_sheet_items()
   - STEP 1: จองจากพาเลทจริงก่อน (FEFO/FIFO)
   - STEP 2: ถ้าไม่พอ → สร้าง Virtual Pallet reservation
5. ตรวจสอบผลลัพธ์ - ถ้าล้มเหลวให้ return error
```

### การหยิบสินค้า (Scan)
```
1. ดึง reservations สำหรับ item
2. Loop ผ่าน reservations:
   - ตรวจสอบว่าเป็น Virtual Pallet หรือไม่
   - หักสต็อคจาก balance (Virtual Pallet ยอมให้ติดลบ)
   - บันทึก Ledger (OUT)
3. เพิ่มสต็อคที่ Storage Location (PQ01-PQ10, MR01-MR10)
4. บันทึก Ledger (IN)
5. อัปเดต item status เป็น 'picked'
```

## ไฟล์ที่แก้ไข
- `supabase/migrations/217_fix_bonus_face_sheet_reservation_use_virtual_pallet.sql`
- `app/api/bonus-face-sheets/route.ts`
- `app/api/mobile/bonus-face-sheet/scan/route.ts`

## การทดสอบ
1. สร้าง Bonus Face Sheet ใหม่ → ตรวจสอบว่ามี Virtual Pallet reservations
2. หยิบสินค้าจาก Virtual Pallet → ตรวจสอบว่าสต็อคถูกหักถูกต้อง
3. ตรวจสอบ Ledger entries มี pallet_id และ transaction_type ถูกต้อง

## เปรียบเทียบกับ Face Sheet และ Picklist

| Feature | Picklist | Face Sheet | Bonus Face Sheet |
|---------|----------|------------|------------------|
| Virtual Pallet Support | ✅ | ✅ | ✅ (แก้ไขแล้ว) |
| Strong Error Handling | ✅ | ✅ | ✅ (แก้ไขแล้ว) |
| Ledger Logging | ✅ | ✅ | ✅ (แก้ไขแล้ว) |
| FEFO/FIFO Reservation | ✅ | ✅ | ✅ |
