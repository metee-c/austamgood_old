# Bonus Face Sheet - Insufficient Stock Warning

## สรุปการเปลี่ยนแปลง

เพิ่มการแจ้งเตือนรายละเอียดเมื่อสต็อกไม่พอในการสร้างใบปะหน้าของแถม

## ปัญหาเดิม

เมื่อสร้างใบปะหน้าของแถมและสต็อกไม่พอ:
- ระบบจะสร้าง Virtual Pallet โดยอัตโนมัติ
- ผู้ใช้ไม่ทราบว่า SKU ไหนสต็อกไม่พอ
- ต้องไปตรวจสอบในระบบภายหลังว่ามี Virtual Pallet อะไรบ้าง

## การแก้ไข

### 1. Database Migration (303)

ปรับปรุง function `reserve_stock_for_bonus_face_sheet_items` เพื่อ:
- เพิ่ม return column `insufficient_stock_items` (JSONB)
- บันทึกรายละเอียด SKU ที่สต็อกไม่พอ:
  - `sku_id`: รหัสสินค้า
  - `product_name`: ชื่อสินค้า
  - `required_qty`: จำนวนที่ต้องการ
  - `available_qty`: จำนวนที่มีอยู่
  - `shortage_qty`: จำนวนที่ขาด

### 2. API Enhancement

ปรับปรุง `/api/bonus-face-sheets` POST endpoint:
- รับ `insufficient_stock_items` จาก database function
- ส่งกลับใน response:
  ```json
  {
    "success": true,
    "face_sheet_no": "BFS-20260219-001",
    "has_insufficient_stock": true,
    "insufficient_stock_items": [
      {
        "sku_id": "PRE-BIB-PURPLE-M",
        "product_name": "ผ้ากันเปื้อนสีม่วง M",
        "required_qty": 100,
        "available_qty": 50,
        "shortage_qty": 50
      }
    ]
  }
  ```

### 3. UI Enhancement

ปรับปรุงหน้า Pack Form (`/receiving/picklists/bonus-face-sheets/pack-form`):
- แสดง error alert พร้อมรายละเอียด SKU ที่สต็อกไม่พอ
- ใช้ `whitespace-pre-line` เพื่อแสดงข้อความหลายบรรทัด
- เพิ่มขนาด font และ padding ให้อ่านง่าย
- รอ 5 วินาทีก่อนไปหน้ารายการ (ให้ผู้ใช้อ่านข้อความ)

## ตัวอย่างการแจ้งเตือน

```
⚠️ สร้างใบปะหน้าสำเร็จ แต่มีสินค้าที่สต็อกไม่พอ:

• ผ้ากันเปื้อนสีม่วง M (PRE-BIB-PURPLE-M): ต้องการ 100 ชิ้น, มีอยู่ 50 ชิ้น, ขาด 50 ชิ้น
• แปรงสีฟัน (PRE-BRUSH): ต้องการ 30 ชิ้น, มีอยู่ 10 ชิ้น, ขาด 20 ชิ้น

ระบบได้สร้าง Virtual Pallet ไว้แล้ว กรุณาเติมสต็อกให้ครบก่อนยืนยันโหลด
```

## ประโยชน์

1. **ความโปร่งใส**: ผู้ใช้ทราบทันทีว่า SKU ไหนสต็อกไม่พอ
2. **ประหยัดเวลา**: ไม่ต้องไปตรวจสอบในระบบภายหลัง
3. **ป้องกันข้อผิดพลาด**: ผู้ใช้สามารถเติมสต็อกก่อนยืนยันโหลด
4. **ติดตามง่าย**: มีรายละเอียดครบถ้วน (ต้องการ, มีอยู่, ขาด)

## Virtual Pallet System

ระบบยังคงใช้ Virtual Pallet เหมือนเดิม:
- สร้างใบปะหน้าสำเร็จแม้สต็อกไม่พอ
- จองสต็อคติดลบใน Virtual Pallet
- ระบบจะ settle เมื่อมีสต็อกเข้า
- ไม่ block การทำงาน แต่แจ้งเตือนให้ผู้ใช้ทราบ

## Files Changed

1. `supabase/migrations/303_improve_bonus_fs_insufficient_stock_message.sql`
2. `app/api/bonus-face-sheets/route.ts`
3. `app/receiving/picklists/bonus-face-sheets/pack-form/page.tsx`

## Testing

1. สร้างใบปะหน้าของแถมที่มี SKU สต็อกไม่พอ
2. ตรวจสอบว่าแสดง error alert พร้อมรายละเอียด
3. ตรวจสอบว่าระบบสร้าง Virtual Pallet สำเร็จ
4. ตรวจสอบว่าหลัง 5 วินาที redirect ไปหน้ารายการ

## Date

19 กุมภาพันธ์ 2569 (February 19, 2026)
