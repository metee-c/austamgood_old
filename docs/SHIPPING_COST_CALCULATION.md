# ระบบคำนวณค่าขนส่ง (Shipping Cost Calculation)

## ภาพรวม

ระบบรองรับการคำนวณค่าขนส่ง 2 รูปแบบ:
1. **แบบเหมา (Flat Rate)** - ใส่ราคาเดียวจบ
2. **แบบคำนวณ (Formula-based)** - คำนวณจากราคาเริ่มต้น + ค่าเด็กติดรถ + ค่าจุดเพิ่ม

## Database Schema

### ตาราง: `receiving_route_trips`

คอลัมน์ที่เกี่ยวข้อง:

| Column | Type | Description |
|--------|------|-------------|
| `shipping_cost` | NUMERIC(12,2) | ค่าขนส่งรวม (บาท) |
| `pricing_mode` | VARCHAR(20) | โหมดการคิดราคา: 'flat' หรือ 'formula' |
| `base_price` | NUMERIC(12,2) | ราคาเริ่มต้นตามจังหวัด (ใช้ในโหมด formula) |
| `helper_fee` | NUMERIC(12,2) | ค่าเด็กติดรถ (ใช้ในโหมด formula) |
| `extra_stop_fee` | NUMERIC(12,2) | ค่าจุดเพิ่ม ต่อจุด (ใช้ในโหมด formula) |
| `extra_stops_count` | INTEGER | จำนวนจุดเพิ่ม (total_stops - 1) - คำนวณอัตโนมัติ |
| `notes` | TEXT | หมายเหตุเพิ่มเติม (JSON format) |

## การใช้งาน

### 1. แบบเหมา (Flat Rate)

เหมาะสำหรับ:
- เส้นทางที่ตกลงราคาเหมามาแล้ว
- เส้นทางข้ามหลายจังหวัด
- กรณีพิเศษที่ไม่ต้องการคำนวณแบบละเอียด

**ตัวอย่าง:**
```
เที่ยวที่ 1: เชียงใหม่ 3 จุด + เชียงราย 2 จุด
ราคาเหมา: 8,500 บาท
```

**SQL:**
```sql
UPDATE receiving_route_trips 
SET 
  pricing_mode = 'flat',
  shipping_cost = 8500
WHERE trip_id = 1;
```

### 2. แบบคำนวณ (Formula-based)

เหมาะสำหรับ:
- เส้นทางที่มีราคามาตรฐานตามจังหวัด
- ต้องการความโปร่งใสในการคำนวณ
- มีค่าเด็กติดรถและค่าจุดเพิ่ม

**สูตรการคำนวณ:**
```
ค่าขนส่งรวม = ราคาเริ่มต้น + ค่าเด็กติดรถ + (จำนวนจุดเพิ่ม × ค่าจุดเพิ่ม)
```

**ตัวอย่าง:**
```
เที่ยวที่ 2: กรุงเทพฯ 5 จุด
- ราคาเริ่มต้น: 1,700 บาท
- ค่าเด็กติดรถ: 500 บาท
- ค่าจุดเพิ่ม: 100 บาท/จุด
- จำนวนจุดเพิ่ม: 4 จุด (5 - 1)

คำนวณ: 1,700 + 500 + (4 × 100) = 2,600 บาท
```

**SQL:**
```sql
UPDATE receiving_route_trips 
SET 
  pricing_mode = 'formula',
  base_price = 1700,
  helper_fee = 500,
  extra_stop_fee = 100,
  total_stops = 5
WHERE trip_id = 2;

-- shipping_cost จะถูกคำนวณอัตโนมัติโดย trigger
```

## Database Triggers

### 1. Auto-calculate extra_stops_count
```sql
CREATE TRIGGER trigger_update_extra_stops_count
    BEFORE INSERT OR UPDATE OF total_stops
    ON receiving_route_trips
    FOR EACH ROW
    EXECUTE FUNCTION update_extra_stops_count();
```

คำนวณ: `extra_stops_count = MAX(0, total_stops - 1)`

### 2. Auto-calculate shipping_cost (formula mode)
```sql
CREATE TRIGGER trigger_calculate_shipping_cost_formula
    BEFORE INSERT OR UPDATE OF pricing_mode, base_price, helper_fee, extra_stop_fee, extra_stops_count
    ON receiving_route_trips
    FOR EACH ROW
    EXECUTE FUNCTION calculate_shipping_cost_formula();
```

คำนวณ: `shipping_cost = base_price + helper_fee + (extra_stops_count × extra_stop_fee)`

## API Endpoint

### PATCH `/api/route-plans/trips/[id]`

**Request Body (Flat Rate):**
```json
{
  "pricing_mode": "flat",
  "shipping_cost": 8500,
  "notes": "{\"vehicle_label\":\"กข 1234\",\"driver_label\":\"สมชาย\"}"
}
```

**Request Body (Formula):**
```json
{
  "pricing_mode": "formula",
  "base_price": 1700,
  "helper_fee": 500,
  "extra_stop_fee": 100,
  "notes": "{\"vehicle_label\":\"กข 1234\",\"driver_label\":\"สมชาย\"}"
}
```

**Response:**
```json
{
  "data": {
    "trip_id": 1,
    "pricing_mode": "formula",
    "base_price": 1700,
    "helper_fee": 500,
    "extra_stop_fee": 100,
    "extra_stops_count": 4,
    "shipping_cost": 2600,
    ...
  },
  "error": null
}
```

## UI Component

### EditShippingCostModal

ตำแหน่ง: `components/receiving/EditShippingCostModal.tsx`

**Features:**
- เลือกโหมดการคิดราคา (Radio buttons)
- แบบเหมา: ช่องกรอกราคาเดียว
- แบบคำนวณ: ช่องกรอก 3 ค่า + แสดงสรุปการคำนวณแบบเรียลไทม์
- แสดงการ์ดสรุปข้อมูลเที่ยว (ระยะทาง, จุดส่ง, ออเดอร์, ชิ้น, น้ำหนัก, % การใช้รถ)
- ตารางรายละเอียดออเดอร์พร้อมช่องหมายเหตุ

## Migration

รันไฟล์ migration:
```bash
# ใน Supabase Dashboard > SQL Editor
# รันไฟล์: supabase/migrations/003_add_shipping_cost_breakdown.sql
```

หรือใช้ Supabase CLI:
```bash
supabase db push
```

## ตัวอย่างราคาเริ่มต้นตามจังหวัด

| จังหวัด | ราคาเริ่มต้น (บาท) |
|---------|-------------------|
| กรุงเทพฯ | 1,700 |
| นนทบุรี | 1,800 |
| ปทุมธานี | 1,900 |
| สมุทรปราการ | 1,800 |
| เชียงใหม่ | 5,000 |
| เชียงราย | 5,500 |
| ภูเก็ต | 6,000 |
| สงขลา | 5,500 |

*หมายเหตุ: ราคาเป็นเพียงตัวอย่าง ควรปรับตามข้อมูลจริงของบริษัท*

## Best Practices

1. **ใช้แบบเหมา** เมื่อ:
   - มีการตกลงราคาพิเศษกับผู้ขนส่ง
   - เส้นทางข้ามหลายจังหวัด
   - ไม่ต้องการแสดงรายละเอียดการคำนวณ

2. **ใช้แบบคำนวณ** เมื่อ:
   - ต้องการความโปร่งใสในการคำนวณ
   - มีราคามาตรฐานตามจังหวัด
   - ต้องการตรวจสอบความถูกต้องของราคา

3. **การบันทึกข้อมูล:**
   - บันทึกทะเบียนรถและชื่อผู้ขับทุกครั้ง
   - ใส่หมายเหตุเพิ่มเติมสำหรับออเดอร์พิเศษ
   - ตรวจสอบ % การใช้รถก่อนบันทึก (ไม่ควรเกิน 100%)

## Troubleshooting

### ปัญหา: shipping_cost ไม่อัปเดตอัตโนมัติ

**สาเหตุ:** Trigger อาจยังไม่ถูกสร้าง

**วิธีแก้:**
```sql
-- ตรวจสอบ trigger
SELECT * FROM pg_trigger WHERE tgname LIKE '%shipping_cost%';

-- ถ้าไม่มี ให้รัน migration อีกครั้ง
```

### ปัญหา: extra_stops_count ไม่ถูกต้อง

**สาเหตุ:** total_stops ยังไม่ถูกอัปเดต

**วิธีแก้:**
```sql
-- อัปเดต total_stops ให้ตรงกับจำนวนจุดจริง
UPDATE receiving_route_trips 
SET total_stops = (
  SELECT COUNT(*) 
  FROM receiving_route_stops 
  WHERE trip_id = receiving_route_trips.trip_id
)
WHERE trip_id = YOUR_TRIP_ID;
```

## การทดสอบ

```sql
-- Test Case 1: Flat Rate
INSERT INTO receiving_route_trips (
  plan_id, trip_code, pricing_mode, shipping_cost, total_stops
) VALUES (
  1, 'TRIP-001', 'flat', 8500, 5
);

-- Test Case 2: Formula
INSERT INTO receiving_route_trips (
  plan_id, trip_code, pricing_mode, 
  base_price, helper_fee, extra_stop_fee, total_stops
) VALUES (
  1, 'TRIP-002', 'formula', 1700, 500, 100, 5
);

-- Verify
SELECT 
  trip_code,
  pricing_mode,
  base_price,
  helper_fee,
  extra_stop_fee,
  total_stops,
  extra_stops_count,
  shipping_cost,
  -- Manual calculation for verification
  CASE 
    WHEN pricing_mode = 'formula' 
    THEN base_price + helper_fee + (extra_stops_count * extra_stop_fee)
    ELSE shipping_cost
  END as calculated_cost
FROM receiving_route_trips
WHERE trip_code IN ('TRIP-001', 'TRIP-002');
```
