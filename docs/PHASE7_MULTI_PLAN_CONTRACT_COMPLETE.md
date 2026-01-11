# Phase 7 - รวมใบว่าจ้างข้ามแผน (เสร็จสมบูรณ์)

**วันที่:** 11 มกราคม 2569  
**สถานะ:** ✅ เสร็จสมบูรณ์  
**Build:** ผ่าน 100%

---

## สรุปการดำเนินการ

ดำเนินการตาม `docs/edit22.md` Part A ทั้งหมด 4 Tasks + เพิ่ม Modal พิมพ์ใบว่าจ้างรวม

---

## ไฟล์ที่สร้างใหม่

### 1. API: `app/api/route-plans/trips-by-supplier/route.ts`

**วัตถุประสงค์:** ดึงข้อมูล trips ตาม supplier_id พร้อม filter วันที่และสถานะ

**Endpoint:** `GET /api/route-plans/trips-by-supplier`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| supplier_id | string | ✅ | รหัสขนส่ง |
| start_date | string | ❌ | วันที่เริ่มต้น (YYYY-MM-DD) |
| end_date | string | ❌ | วันที่สิ้นสุด (YYYY-MM-DD) |
| status | string | ❌ | สถานะแผน (comma-separated) |

**Response:**
```json
{
  "success": true,
  "data": [...trips],
  "grouped": { [plan_id]: { plan, trips } },
  "summary": {
    "total_trips": 10,
    "total_stops": 45,
    "total_weight_kg": 5000,
    "total_shipping_cost": 25000,
    "plans_count": 3
  }
}
```

---

### 2. Component: `app/receiving/routes/components/MultiPlanContractModal.tsx`

**วัตถุประสงค์:** Modal สำหรับเลือก trips ข้ามแผนเพื่อรวมใบว่าจ้าง

**Features:**
- เลือกขนส่ง (dropdown) - ใช้ API `/api/master-supplier?type=service_provider`
- เลือกช่วงวันที่ (date range picker)
- แสดงรายการ trips ที่ตรงเงื่อนไข
- เลือก/ยกเลิกเลือก trips (checkbox)
- เลือกทั้งหมด/ยกเลิกทั้งหมด
- แสดง Summary (จำนวนคัน, จุดส่ง, น้ำหนัก, ค่าขนส่ง)
- Export Excel (มีราคา/ไม่มีราคา)
- สร้างใบว่าจ้าง → เปิด MultiPlanTransportContractModal

---

### 3. Component: `app/receiving/routes/components/MultiPlanTransportContractModal.tsx`

**วัตถุประสงค์:** Modal สำหรับพิมพ์ใบว่าจ้างรวมจากหลายแผน

**Features:**
- แสดง Summary ของ trips ที่เลือก
- แสดงตัวอย่างใบว่าจ้าง (Print Preview)
- จัดกลุ่ม trips ตามวันที่
- พิมพ์ใบว่าจ้างรวม (react-to-print)
- สร้างเลขเอกสาร MULTI-YYYYMMDD-HHMM

---

## ไฟล์ที่แก้ไข

### 4. `app/receiving/routes/components/index.ts`

เพิ่ม export:
```typescript
export { MultiPlanContractModal } from './MultiPlanContractModal';
export { MultiPlanTransportContractModal } from './MultiPlanTransportContractModal';
```

---

### 5. `app/receiving/routes/page.tsx`

**เพิ่ม:**
- Import `MultiPlanContractModal`, `MultiPlanTransportContractModal`
- State: `showMultiPlanContractModal`, `showMultiPlanTransportContractModal`
- State: `multiPlanSelectedTrips`, `multiPlanSupplierName`
- Handler: `handleGenerateMultiPlanContract` - เปิด modal พิมพ์ใบว่าจ้างรวม
- Handler: `handleMultiPlanExport` - Export Excel
- ปุ่ม "รวมใบว่าจ้างข้ามแผน" (ใกล้ปุ่มสร้างแผนใหม่)
- `<MultiPlanContractModal />` component
- `<MultiPlanTransportContractModal />` component

---

## วิธีใช้งาน

1. เปิดหน้า **รับสินค้า > เส้นทาง** (`/receiving/routes`)
2. กดปุ่ม **"รวมใบว่าจ้างข้ามแผน"**
3. เลือกขนส่งจาก dropdown
4. เลือกช่วงวันที่ (default: 7 วันย้อนหลัง)
5. กด **"ค้นหา"**
6. เลือก trips ที่ต้องการ (checkbox)
7. กด **"สร้างใบว่าจ้าง"** → เปิด Modal พิมพ์
8. กด **"พิมพ์ใบว่าจ้าง"** เพื่อพิมพ์

---

## Test Checklist

```
✅ กดปุ่ม "รวมใบว่าจ้างข้ามแผน" → Modal เปิด
✅ เลือกขนส่ง → dropdown ทำงาน
✅ เลือกช่วงวันที่ → date picker ทำงาน
✅ กดค้นหา → แสดงรายการ trips
✅ เลือก/ยกเลิกเลือก trips → checkbox ทำงาน
✅ เลือกทั้งหมด → เลือกทุก trips
✅ ตรวจสอบ Summary → แสดงถูกต้อง
✅ กด Export (มีราคา) → ดาวน์โหลด Excel มีคอลัมน์ราคา
✅ กด Export (ไม่มีราคา) → ดาวน์โหลด Excel ไม่มีคอลัมน์ราคา
✅ กดสร้างใบว่าจ้าง → เปิด Modal พิมพ์ใบว่าจ้างรวม
✅ กดพิมพ์ใบว่าจ้าง → พิมพ์เอกสาร
✅ กดยกเลิก → Modal ปิด
```

---

## Bug Fixes Applied

1. ✅ Button import path: `@/components/ui/Button` (capital B, default export)
2. ✅ API endpoint: `/api/master-supplier?type=service_provider` (ไม่ใช่ `/api/suppliers?type=transport`)
3. ✅ Supabase order clause: ใช้ `trip_id` แทน `plan.plan_date` (Supabase ไม่รองรับ order by nested relation)

---

## Related Files

- `docs/edit22.md` - Specification
- `docs/edit21.md` - Previous refactor (Phase 1-6, 8)
- `docs/ROUTES_PAGE_REFACTOR_COMPLETE.md` - Previous completion report
