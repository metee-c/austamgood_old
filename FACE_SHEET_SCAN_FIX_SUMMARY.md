# Face Sheet Scan Fix Summary

## ปัญหาที่พบ

### 1. Face Sheet Items มี quantity_to_pick เป็น null
- **ปัญหา**: Face Sheet 83 มี items ทั้งหมดที่ `quantity_to_pick = null`
- **สาเหตุ**: เมื่อสร้าง face sheet ไม่ได้ set `quantity_to_pick` ให้เท่ากับ `quantity`
- **แก้ไข**: 
  ```sql
  UPDATE face_sheet_items 
  SET quantity_to_pick = quantity
  WHERE face_sheet_id = 83 
  AND quantity_to_pick IS NULL;
  ```

### 2. API Validation ไม่รองรับ quantity_to_pick = null
- **ปัญหา**: API ตรวจสอบ `quantity_picked > item.quantity_to_pick` แต่ `quantity_to_pick` เป็น null
- **แก้ไข**: เพิ่ม fallback logic ใน `app/api/mobile/face-sheet/scan/route.ts`
  ```typescript
  const expectedQuantity = item.quantity_to_pick || item.quantity || 0;
  if (quantity_picked > expectedQuantity) {
    return NextResponse.json({ error: `จำนวนที่หยิบ (${quantity_picked}) มากกว่าที่ต้องการ (${expectedQuantity})` });
  }
  
  if (expectedQuantity <= 0) {
    return NextResponse.json({ error: `ไม่พบจำนวนที่ต้องหยิบสำหรับรายการนี้` });
  }
  ```

### 3. Stock Reservations ใช้ Balance ที่มีสต็อคติดลบ
- **ปัญหา**: Balance 34052 มี `total_piece_qty = -132` แต่ยังมี `reserved_piece_qty = 24`
- **สาเหตุ**: ข้อมูลสต็อคไม่สอดคล้องกันจากการ pick ที่ผ่านมา
- **แก้ไข**: 
  1. ลบ reservations ที่อ้างอิงถึง balance ที่มีปัญหา
  2. ลบ balance ที่มีสต็อคติดลบ
  3. ให้ระบบสร้าง Virtual Pallet ใหม่

### 4. Virtual Pallet System ทำงานถูกต้อง
- **สถานะ**: ระบบสร้าง Virtual Pallet เมื่อไม่พบสต็อคจริงใน preparation area
- **ผลลัพธ์**: Item 5775 ตอนนี้มี reservation จาก Virtual Pallet `VIRTUAL-PK001-B-BEY-D|SAL|012`

## การแก้ไขที่ทำแล้ว

### 1. แก้ไข API Validation
- ✅ เพิ่ม fallback logic สำหรับ `quantity_to_pick = null`
- ✅ เพิ่มการตรวจสอบ `expectedQuantity <= 0`

### 2. แก้ไขข้อมูล Face Sheet 83
- ✅ Update `quantity_to_pick` ให้เท่ากับ `quantity` สำหรับทุก items
- ✅ ลบ balance ที่มีสต็อคติดลบ (balance_id: 34052)
- ✅ สร้าง reservation ใหม่สำหรับ item 5775

### 3. แก้ไข Build Error
- ✅ แก้ไข TypeScript error ใน `app/api/face-sheets/generate/route.ts`
- ✅ เปลี่ยน `verifyReservations?.[0]?.count` เป็น `verifyReservations?.[0]?.COUNT`

## สถานะปัจจุบัน

### Face Sheet 83 (FS-20260115-000)
- **Status**: `picking`
- **Items**: 185 รายการ
- **Picked**: หลายรายการหยิบแล้ว
- **Remaining**: รายการที่เหลือรอการหยิบ รวมถึง item 5775

### Item 5775 (B-BEY-D|SAL|012)
- **Status**: `reserved`
- **Quantity to pick**: 12 ชิ้น
- **Reservation**: 1 รายการจาก Virtual Pallet
- **Balance**: `VIRTUAL-PK001-B-BEY-D|SAL|012` (total: -12, reserved: 12)

## การทดสอบ

ใช้ไฟล์ `test-face-sheet-scan.js` เพื่อทดสอบการสแกน:

```bash
node test-face-sheet-scan.js
```

**หมายเหตุ**: ต้องแทนที่ `session_token` ด้วย token จริงจากการ login

## ข้อเสนอแนะ

### 1. ป้องกันปัญหาในอนาคต
- เพิ่มการตรวจสอบ `quantity_to_pick` ใน face sheet generation
- เพิ่ม validation ใน database schema ให้ `quantity_to_pick` ไม่เป็น null

### 2. ตรวจสอบ Stock Integrity
- รัน stock audit เป็นประจำเพื่อหา balance ที่มีสต็อคติดลบ
- แก้ไขข้อมูลสต็อคที่ไม่สอดคล้องกัน

### 3. Virtual Pallet Management
- ตรวจสอบว่า Virtual Pallet ถูกใช้งานอย่างถูกต้อง
- เพิ่มการ monitor Virtual Pallet ที่มีสต็อคติดลบมาก

## สรุป

ปัญหาหลักคือข้อมูลสต็อคไม่สอดคล้องกันและ API validation ไม่รองรับ edge case ตอนนี้แก้ไขแล้วและ Face Sheet 83 ควรสามารถยืนยันหยิบได้ปกติ