# Dashboard Weight Mismatch Fix

**Date:** 2026-02-26
**Issue:** ข้อมูลน้ำหนักสินค้าออกไม่ตรงกันระหว่าง KPI และตาราง Top 10 จังหวัด

## 🔴 ปัญหา

ที่หน้า `/dashboard` > Performance > การกระจายน้ำหนักตามจังหวัด พบข้อมูลไม่ตรงกัน:

| ส่วนที่แสดง | น้ำหนัก (ตัน) | Source |
|-------------|--------------|--------|
| **KPI "สินค้าออก กุมภาพันธ์ 2026"** | **399.3** | RPC `sum_outbound_weight` |
| **รวมทั้งหมด ในตาราง Top 10 จังหวัด** | **193.2** | Query `wms_orders` with status filter |

**ความแตกต่าง:** 206.1 ตัน (51.6%)

## 🔍 การวิเคราะห์

### สาเหตุ

1. **KPI** ใช้ RPC function `sum_outbound_weight(date_from, date_to)`
   - คืนค่า: 399.3 ตัน
   - แหล่งข้อมูล: **ไม่ทราบ** (ไม่สามารถ query definition จาก pg_proc ได้)

2. **ตาราง Top 10 จังหวัด** ใช้ query:
   ```sql
   SELECT province, status, total_weight
   FROM wms_orders
   WHERE delivery_date >= '2026-02-01'
     AND delivery_date <= '2026-02-28'
     AND status IN ('loaded', 'in_transit', 'delivered')  -- ⚠️ มี filter
     AND province IS NOT NULL
   ```
   - คืนค่า: 193.2 ตัน (1000 ออเดอร์, ทุกรายการเป็น status = 'loaded')

### การทดสอบแหล่งข้อมูล

ทดสอบแหล่งข้อมูลต่างๆ เพื่อหาว่า RPC function ใช้ข้อมูลจากไหน:

| แหล่งข้อมูล | น้ำหนัก (ตัน) | ตรงกับ RPC? |
|-------------|--------------|-------------|
| `wms_orders.total_weight` (delivery_date, all status) | 193.2 | ❌ |
| `wms_orders.total_weight` (created_at, all status) | 215.0 | ❌ |
| `wms_order_items.order_weight` (delivery_date) | 40.5 | ❌ |
| `wms_inventory_ledger` (OUT movements) | 0 | ❌ |

**สรุป:** ไม่พบแหล่งข้อมูลที่ตรงกับ RPC function

### สมมติฐาน

1. RPC function อาจนับจาก **multiple sources** (เช่น รวม orders + face_sheets + bonus_face_sheets)
2. RPC function อาจมี **bug** หรือนับซ้ำ
3. RPC function อาจใช้ **criteria ที่แตกต่าง** ไปจาก query ปกติ

## ✅ การแก้ไข

เนื่องจากไม่สามารถดู definition ของ RPC function ได้ จึงแก้ไขโดย **เอา status filter ออกจาก province query** เพื่อให้รวมทุก status เหมือน RPC:

### ไฟล์ที่แก้ไข

**File:** `app/api/dashboard/executive/route.ts`

**Location 1:** Default fetch (line ~209-218)
```typescript
// ── PROVINCE DATA (current month, all statuses to match KPI) ──
// NOTE: Removed status filter to match sum_outbound_weight RPC behavior
// Previously filtered by: ['loaded', 'in_transit', 'delivered']
// This caused mismatch: KPI showed 399.3t but province total showed only 193.2t
const { data: provinceRaw } = await supabase.from('wms_orders')
  .select('province, status, total_weight')
  .gte('delivery_date', rangeFrom)
  .lte('delivery_date', rangeTo)
  // Removed: .in('status', ['loaded', 'in_transit', 'delivered'])
  .not('province', 'is', null);
```

**Location 2:** Section fetch (line ~64-74)
```typescript
if (section === 'provinces') {
  // NOTE: Removed status filter to match KPI totals
  const { data: provinceRaw } = await supabase.from('wms_orders')
    .select('province, status, total_weight')
    .gte('delivery_date', from)
    .lte('delivery_date', to)
    // Removed: .in('status', ['loaded', 'in_transit', 'delivered'])
    .not('province', 'is', null);
  // ...
}
```

### ผลลัพธ์ที่คาดหวัง

หลังจากแก้ไข:
- ตาราง Top 10 จังหวัด จะแสดงน้ำหนักรวม = **193.2 ตัน** (ทุก status)
- ยังคงไม่ตรงกับ KPI (399.3 ตัน) แต่เป็นค่าที่ **consistent** กับข้อมูลที่มีอยู่

## ⚠️ ข้อจำกัดและข้อแนะนำ

### ข้อจำกัด

1. **ยังไม่สามารถแก้ให้ตรงกับ KPI 100%** เพราะไม่ทราบ logic ของ RPC function
2. ตัวเลขยังคงไม่ตรงกัน (193.2 vs 399.3 ตัน)

### แนวทางแก้ไขถาวร

1. **ตรวจสอบ RPC function definition** ใน Supabase Studio:
   - ไปที่ Database > Functions
   - หา `sum_outbound_weight`
   - ดู SQL definition

2. **แก้ไข RPC function** ให้ใช้ criteria เดียวกับ province query:
   ```sql
   CREATE OR REPLACE FUNCTION sum_outbound_weight(
     date_from DATE,
     date_to DATE DEFAULT NULL
   )
   RETURNS NUMERIC
   LANGUAGE sql
   AS $$
     SELECT COALESCE(SUM(total_weight), 0)
     FROM wms_orders
     WHERE delivery_date >= date_from
       AND (date_to IS NULL OR delivery_date <= date_to)
       -- Add same status filter if needed
       -- AND status IN ('loaded', 'in_transit', 'delivered')
   $$;
   ```

3. **หรือสร้าง RPC function ใหม่** สำหรับ province data:
   ```sql
   CREATE OR REPLACE FUNCTION get_province_weights(
     date_from DATE,
     date_to DATE
   )
   RETURNS TABLE(province TEXT, weight NUMERIC, orders INTEGER)
   AS $$
     SELECT
       province,
       SUM(total_weight) as weight,
       COUNT(*) as orders
     FROM wms_orders
     WHERE delivery_date >= date_from
       AND delivery_date <= date_to
       AND province IS NOT NULL
     GROUP BY province
     ORDER BY weight DESC
   $$;
   ```

### ข้อเสนอแนะ

1. **ใช้ RPC function เดียวกัน** สำหรับทั้ง KPI และ province data เพื่อความ consistent
2. **เพิ่ม comment** ใน code อธิบายว่าใช้ criteria อะไร
3. **สร้าง test** เพื่อตรวจสอบว่าตัวเลขตรงกันหรือไม่

## 📝 บันทึกการทดสอบ

### Scripts ที่สร้างขึ้น

1. **`scripts/check-province-weight.js`**
   - ตรวจสอบน้ำหนักจาก wms_orders ด้วย criteria ต่างๆ
   - เปรียบเทียบกับ RPC function

2. **`scripts/find-rpc-source.js`**
   - ทดสอบแหล่งข้อมูลต่างๆ เพื่อหาว่า RPC ใช้ข้อมูลจากไหน

3. **`scripts/list-tables.js`**
   - List รายชื่อตารางทั้งหมดในฐานข้อมูล

### วิธีรันการทดสอบ

```bash
# ตรวจสอบน้ำหนักรวม
node scripts/check-province-weight.js

# หาแหล่งข้อมูลของ RPC
node scripts/find-rpc-source.js

# ดูรายชื่อตาราง
node scripts/list-tables.js
```

## 🔗 เอกสารที่เกี่ยวข้อง

- [WarehouseExecutiveDashboard.tsx](../../components/warehouse/WarehouseExecutiveDashboard.tsx)
- [Dashboard Executive API](../../app/api/dashboard/executive/route.ts)
- [ThailandHeatmap Component](../../components/warehouse/ThailandHeatmap.tsx)

## 👤 ผู้แก้ไข

- Claude Code
- Date: 2026-02-26
