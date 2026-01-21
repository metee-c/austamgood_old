# รายงานบ้านหยิบผิดตำแหน่ง (Misplaced Inventory Report)

## Overview
รายงานนี้แสดงรายการพาเลทสินค้าที่ถูกเติมลงบ้านหยิบผิดตำแหน่ง โดยระบบจะตรวจสอบว่าสินค้าแต่ละตัวอยู่ในบ้านหยิบที่ถูกต้องหรือไม่

## Business Logic

### การตรวจสอบตำแหน่งที่ผิด
1. ดึงข้อมูล inventory ที่มี `default_location` กำหนดไว้ใน `master_sku`
2. ตรวจสอบว่า location ปัจจุบันเป็นบ้านหยิบหรือไม่ (อยู่ใน `preparation_area.area_code`)
3. ถ้าอยู่ในบ้านหยิบ แต่ไม่ใช่บ้านหยิบที่กำหนดไว้ → ถือว่าผิดตำแหน่ง

### Priority Levels
ระบบจะจัดลำดับความสำคัญตามจำนวนชิ้น:
- **สูง (High)**: ≥ 100 ชิ้น
- **กลาง (Medium)**: 50-99 ชิ้น
- **ต่ำ (Low)**: < 50 ชิ้น

## Features

### 1. Dashboard Summary
แสดงสรุปข้อมูล:
- จำนวนรายการทั้งหมด
- จำนวนชิ้นทั้งหมด
- จำนวน SKU ที่ไม่ซ้ำกัน
- แยกตามระดับความสำคัญ (สูง/กลาง/ต่ำ)

### 2. Filter Panel
- กรองตามระดับความสำคัญ (ทั้งหมด/สูง/กลาง/ต่ำ)

### 3. Data Table
แสดงข้อมูล:
- รหัสสินค้า (SKU ID)
- ชื่อสินค้า (SKU Name)
- ตำแหน่งปัจจุบัน (Current Location)
- บ้านหยิบที่ถูกต้อง (Designated Home)
- จำนวนชิ้น (Total Pieces)
- Pallet ID
- ระดับความสำคัญ (Priority)

### 4. Export to Excel
ส่งออกข้อมูลทั้งหมดเป็นไฟล์ Excel

### 5. Pagination
- เลือกจำนวนแถวต่อหน้า (50/100/200/500)
- นำทางระหว่างหน้า

## Technical Implementation

### API Endpoint
**Path**: `/api/inventory/misplaced-report`

**Method**: GET

**Query Parameters**:
- `page` (number): หน้าที่ต้องการ (default: 1)
- `limit` (number): จำนวนแถวต่อหน้า (default: 100)
- `priority` (string): กรองตามความสำคัญ ('all'|'1'|'2'|'3')

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "sku_id": "string",
      "sku_name": "string",
      "current_location": "string",
      "designated_home": "string",
      "designated_home_name": "string",
      "total_pieces": number,
      "pallet_id": "string",
      "move_priority": number
    }
  ],
  "summary": {
    "total_items": number,
    "total_pieces": number,
    "unique_skus": number,
    "priority_breakdown": {
      "high": number,
      "medium": number,
      "low": number
    }
  },
  "pagination": {
    "page": number,
    "limit": number,
    "totalCount": number,
    "totalPages": number
  }
}
```

### Database Tables Used
- `inventory_balance` - ข้อมูล stock ปัจจุบัน
- `master_sku` - ข้อมูล SKU และ default_location
- `master_location` - ข้อมูล location
- `preparation_area` - รายการบ้านหยิบทั้งหมด

### Frontend Page
**Path**: `/warehouse/misplaced-inventory`

**Components**:
- Full-height layout with gradient background
- Header with summary stats
- Collapsible filter panel
- Table with sticky header
- Pagination controls
- Excel export functionality

### Styling
ใช้สไตล์เดียวกับหน้า Production Report:
- Gradient background (blue to purple)
- Backdrop blur effects
- Sticky header table
- Color-coded priority badges
- Responsive design

## Menu Location
**เมนู**: รายงาน (Reports) → บ้านหยิบผิดตำแหน่ง

## Related Files
- API: `app/api/inventory/misplaced-report/route.ts`
- Page: `app/warehouse/misplaced-inventory/page.tsx`
- Script: `scripts/find-misplaced-inventory.js`
- Menu: `components/layout/Sidebar.tsx`

## Usage

### For Warehouse Staff
1. เข้าเมนู "รายงาน" → "บ้านหยิบผิดตำแหน่ง"
2. ดูสรุปข้อมูลด้านบน
3. กรองตามความสำคัญถ้าต้องการ
4. ดูรายการสินค้าที่ต้องย้าย
5. ส่งออก Excel เพื่อพิมพ์หรือแจกจ่ายให้ทีมงาน

### For Developers
Run the script to find misplaced items:
```bash
node scripts/find-misplaced-inventory.js
```

## Notes
- รายงานนี้แสดงเฉพาะสินค้าที่มี `default_location` กำหนดไว้
- สินค้าที่อยู่ใน bulk storage (ไม่ใช่บ้านหยิบ) จะไม่แสดงในรายงาน
- ข้อมูลเป็น real-time จาก `inventory_balance`
