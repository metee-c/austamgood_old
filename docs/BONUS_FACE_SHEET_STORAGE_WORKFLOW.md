# Bonus Face Sheet Storage Workflow

## Overview

ระบบจัดการใบปะหน้าของแถมแบบใหม่ที่รองรับการจัดวางสินค้าตามโลเคชั่นก่อนแมพสายรถ

## Workflow

### 1. สร้างใบปะหน้าของแถม (ไม่สนใจสายรถ)
- ไปที่ `/receiving/picklists/bonus-face-sheets`
- คลิก "สร้างใบปะหน้าของแถม"
- เลือกวันส่งของ
- เลือกออเดอร์พิเศษ (order_type = 'special') ที่ต้องการ
- ระบบจะสร้างใบปะหน้าของแถมโดยไม่สนใจสายรถ

### 2. จัดสรรโลเคชั่นจัดวาง
- ที่ตารางใบปะหน้าของแถม คลิกปุ่ม 📍 (MapPin) "จัดสรรโลเคชั่น"
- ระบบจะจัดสรรโลเคชั่นอัตโนมัติ:
  - **PQ01-PQ10**: สำหรับ Hub กรุงเทพ/ภาคกลาง
  - **MR01-MR10**: สำหรับ Hub ต่างจังหวัด
  - แต่ละโลเคชั่นรองรับไม่เกิน 10 แพ็ค

### 3. พิมพ์ใบจัดวางสินค้า (Storage Placement Form)
- คลิกปุ่ม 📄 (FileText) "พิมพ์ใบจัดวางสินค้า"
- ฟอร์ม A4 แสดง:
  - รายการแพ็คแยกตามโลเคชั่น (PQ/MR)
  - ตารางรายละเอียดแพ็คทั้งหมด
  - ช่องเช็คสำหรับยืนยันการจัดวาง

### 4. พิมพ์ใบปะหน้า (Label)
- คลิกปุ่ม 🖨️ (Printer) "พิมพ์ใบปะหน้า"
- ใบปะหน้าจะแสดง **โลเคชั่นจัดวาง** ที่ต้องนำไปวาง
- สีโลเคชั่น:
  - **น้ำเงิน**: PQ (ภาคกลาง)
  - **ชมพู**: MR (ต่างจังหวัด)

### 5. หยิบของแถมจาก Preparation Area ไป Storage Location
- ไปที่ `/mobile/pick` หรือ `/mobile/bonus-face-sheet`
- สแกนยืนยันหยิบสินค้า
- **ระบบจะย้ายสต็อกจาก Preparation Area → Storage Location (PQ01-PQ10, MR01-MR10)**

### 6. สร้างใบโหลดสินค้า (แมพสายรถ)
- ไปที่ `/receiving/loadlists`
- คลิก "สร้างใบโหลดใหม่"
- เลือกแท็บ "ใบปะหน้าของแถม"
- เลือกใบปะหน้าของแถมที่ต้องการ
- ระบบจะแมพร้านค้าที่ตรงกับสายรถที่จัดเส้นทางแล้ว

### 7. พิมพ์ใบหยิบสินค้า (Pick List)
- ที่ตารางใบโหลดสินค้า คลิกปุ่ม 📄 (FileText) "พิมพ์ใบหยิบสินค้า"
- ฟอร์ม A4 แสดง:
  - รายการแพ็คแยกตามสายรถ
  - โลเคชั่นที่ต้องไปหยิบ (PQ01-PQ10, MR01-MR10)
  - จุดหมายปลายทาง (PQTD หรือ MRTD)
  - ช่องเช็คสำหรับยืนยันการหยิบ

### 8. ยืนยันหยิบไปจุดพักรอโหลด (NEW!)
- ที่ตารางใบโหลดสินค้า คลิกปุ่ม ✅ (CheckCircle) "ยืนยันหยิบไปจุดพักรอโหลด"
- **ระบบจะย้ายสต็อกจาก Storage Location (PQ01-PQ10, MR01-MR10) → Staging (PQTD/MRTD)**
- หลังยืนยัน storage_location ของ packages จะถูกเคลียร์ (พร้อมรับแพ็คใหม่)

## Database Changes

### Migration: `add_storage_location_to_bonus_face_sheet_packages`

```sql
-- เพิ่มคอลัมน์ storage_location
ALTER TABLE bonus_face_sheet_packages
ADD COLUMN storage_location VARCHAR(10) DEFAULT NULL;

-- Function จัดสรรโลเคชั่นอัตโนมัติ
CREATE FUNCTION assign_bonus_face_sheet_storage_locations(p_face_sheet_id BIGINT)

-- Function ดึงสรุปโลเคชั่น
CREATE FUNCTION get_bonus_face_sheet_storage_summary(p_face_sheet_id BIGINT)
```

## API Endpoints

### POST /api/bonus-face-sheets/assign-locations
จัดสรรโลเคชั่นจัดวางให้แพ็คในใบปะหน้าของแถม

**Request:**
```json
{ "face_sheet_id": 123 }
```

**Response:**
```json
{
  "success": true,
  "message": "จัดสรรโลเคชั่นสำเร็จ 15 แพ็ค",
  "assigned_packages": [...],
  "location_summary": [...]
}
```

### GET /api/bonus-face-sheets/storage-placement?id=xxx
ดึงข้อมูลสำหรับพิมพ์ใบจัดวางสินค้า

### GET /api/bonus-face-sheets/pick-list?id=xxx&loadlist_id=xxx
ดึงข้อมูลสำหรับพิมพ์ใบหยิบสินค้า

### POST /api/bonus-face-sheets/confirm-pick-to-staging (NEW!)
ยืนยันหยิบของแถมจาก Storage Location ไป Staging

**Request:**
```json
{ 
  "loadlist_id": 123,
  "bonus_face_sheet_id": 456
}
```

**Response:**
```json
{
  "success": true,
  "message": "ย้ายสินค้าไปจุดพักรอโหลดสำเร็จ 150 ชิ้น",
  "total_moved": 150,
  "packages_processed": 15,
  "ledger_entries": 30
}
```

## Stock Movement Flow

### New Workflow (หลัง 8 ม.ค. 2026)
```
┌─────────────────────┐
│  Preparation Area   │  (บ้านหยิบ - สต็อกจองไว้)
└──────────┬──────────┘
           │ สแกนยืนยันหยิบ (mobile/pick)
           ▼
┌─────────────────────┐
│  Storage Location   │  (PQ01-PQ10, MR01-MR10)
│  (โลพักของแถม)      │
└──────────┬──────────┘
           │ ยืนยันหยิบไปจุดพักรอโหลด (loadlists page)
           ▼
┌─────────────────────┐
│  Staging Location   │  (PQTD, MRTD)
│  (จุดพักรอโหลด)     │
└──────────┬──────────┘
           │ ยืนยันโหลดสินค้า (mobile/loading)
           ▼
┌─────────────────────┐
│ Delivery-In-Progress│  (กำลังจัดส่ง)
└─────────────────────┘
```

### Legacy Workflow (ก่อน 8 ม.ค. 2026) - Backward Compatible
```
┌─────────────────────┐
│  Preparation Area   │  (บ้านหยิบ - สต็อกจองไว้)
└──────────┬──────────┘
           │ สแกนยืนยันหยิบ (mobile/pick)
           ▼
┌─────────────────────┐
│      Dispatch       │  (จุดจัดส่ง - flow เก่า)
└──────────┬──────────┘
           │ ยืนยันโหลดสินค้า (mobile/loading)
           ▼
┌─────────────────────┐
│ Delivery-In-Progress│  (กำลังจัดส่ง)
└─────────────────────┘
```

**หมายเหตุ**: API `/api/mobile/loading/complete` รองรับทั้งสอง workflow โดยจะตรวจสอบสต็อกที่ PQTD/MRTD ก่อน ถ้าไม่มีจะ fallback ไปตรวจที่ Dispatch (สำหรับ loadlist เก่า)

## Components

### BonusStoragePlacementDocument.tsx
ฟอร์ม A4 "ใบจัดวางสินค้า" แสดงรายการแพ็คแยกตามโลเคชั่น

### BonusPickListDocument.tsx
ฟอร์ม A4 "ใบหยิบสินค้า" แสดงรายการแพ็คที่ต้องหยิบจากโลเคชั่นไปยัง PQTD/MRTD

### BonusFaceSheetLabelDocument.tsx (Updated)
เพิ่มการแสดงโลเคชั่นจัดวางในใบปะหน้า

## Location Mapping

| Hub | Storage Locations | Staging Location |
|-----|-------------------|------------------|
| กรุงเทพ/ภาคกลาง | PQ01-PQ10 | PQTD |
| ต่างจังหวัด | MR01-MR10 | MRTD |

## Files Modified/Created

### New Files:
- `app/api/bonus-face-sheets/assign-locations/route.ts`
- `app/api/bonus-face-sheets/storage-placement/route.ts`
- `app/api/bonus-face-sheets/pick-list/route.ts`
- `app/api/bonus-face-sheets/confirm-pick-to-staging/route.ts` (NEW!)
- `components/receiving/BonusStoragePlacementDocument.tsx`
- `components/receiving/BonusPickListDocument.tsx`

### Modified Files:
- `app/receiving/picklists/bonus-face-sheets/page.tsx` - เพิ่มปุ่มจัดสรรโลเคชั่นและพิมพ์ใบจัดวาง
- `app/receiving/loadlists/page.tsx` - เพิ่มปุ่มพิมพ์ใบหยิบสินค้าและยืนยันหยิบ
- `app/api/mobile/bonus-face-sheet/scan/route.ts` - ย้ายสต็อกไป storage_location แทน Dispatch
- `components/receiving/BonusFaceSheetLabelDocument.tsx` - เพิ่มแสดงโลเคชั่นจัดวาง
