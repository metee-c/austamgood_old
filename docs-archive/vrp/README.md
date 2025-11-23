# 🚚 VRP (Vehicle Routing Problem) Documentation

เอกสารระบบจัดเส้นทางรถแบบอัตโนมัติ

## เอกสารในโฟลเดอร์นี้

### คู่มือหลัก
- **README_VRP.md** - คู่มือระบบ VRP ฉบับสมบูรณ์
  - อัลกอริทึม VRP ทั้ง 3 แบบ (Insertion Heuristic, Clarke-Wright Savings, Nearest Neighbor)
  - การใช้งาน VRP API
  - การตั้งค่า Optimization
  - ข้อจำกัดต่างๆ (น้ำหนัก, ปริมาตร, เวลา, จำนวนรถ)
  - Performance benchmarks

## VRP Algorithms

### 1. Insertion Heuristic (แนะนำ)
**เหมาะสำหรับ:** 20-100+ orders
**ความเร็ว:** เร็ว (2-15 วินาที)
**คุณภาพ:** ดีมาก (ใกล้เคียง optimal)
**ข้อดี:**
- เร็วและให้ผลลัพธ์ดี
- รองรับ orders จำนวนมาก (100+ orders)
- ใช้ memory น้อย

### 2. Clarke-Wright Savings
**เหมาะสำหรับ:** <70 orders
**ความเร็ว:** ช้า (5-60 วินาที)
**คุณภาพ:** ดีที่สุด (optimal/near-optimal)
**ข้อดี:**
- ผลลัพธ์ดีที่สุด
- เหมาะกับ orders น้อยๆ ที่ต้องการความแม่นยำสูง

### 3. Nearest Neighbor
**เหมาพสำหรับ:** Testing เท่านั้น
**ความเร็ว:** เร็วมาก (<2 วินาที)
**คุณภาพ:** ต่ำ
**ข้อดี:**
- เร็วที่สุด
- ใช้สำหรับทดสอบระบบเท่านั้น

## Performance Benchmarks

| Orders | Algorithm | Time | 2-opt | Quality |
|--------|-----------|------|-------|---------|
| <30    | Insertion | 2-5s | ✅ Yes | ดีมาก |
| 30-70  | Savings   | 5-15s | ✅ Yes | ดีที่สุด |
| 70-150 | Insertion | 15-60s | ❌ No | ดี |
| >150   | Insertion | 60-120s | ❌ No | ดี |

## ฟีเจอร์หลัก

### 1. Vehicle Constraints
- น้ำหนักสูงสุด (max_weight_kg)
- ปริมาตรสูงสุด (max_volume_cbm)
- จำนวนจุดส่งสูงสุด (max_stops)
- จำกัดจำนวนรถที่ใช้ (max_vehicles)

### 2. Time Windows
- กำหนดช่วงเวลาที่ต้องส่งถึง
- คำนวณ arrival time และ departure time
- ตรวจสอบ time window violations

### 3. Route Optimization
- ลดระยะทางรวม
- ลดเวลาเดินทาง
- กระจายภาระงานระหว่างรถ
- 2-opt local search สำหรับปรับปรุงเส้นทาง

### 4. Cost Calculation
- ระยะทางรวม (total_distance_km)
- เวลารวม (total_duration_minutes)
- จำนวนรถที่ใช้
- Objective value (ค่าใช้จ่ายรวม)

## API Endpoints

- `POST /api/route-plans/optimize` - สร้างแผนเส้นทางใหม่
- `GET /api/route-plans` - ดูรายการแผนเส้นทาง
- `GET /api/route-plans/[id]` - ดูรายละเอียดแผน
- `GET /api/route-plans/[id]/trips` - ดูรายละเอียดเที่ยว
- `PATCH /api/route-plans/[id]` - แก้ไขแผน (เช่น status, shipping_cost)

## Database Tables

### receiving_route_plans
ตารางหลักสำหรับแผนเส้นทาง
- `plan_id` - Primary key
- `plan_code` - Unique code
- `status` - draft/optimizing/published/pending_approval/approved/ready_to_load/in_transit/completed
- `algorithm` - insertion/savings/nearest_neighbor
- `objective_value` - ต้นทุนรวม

### receiving_route_trips
ตารางเที่ยวรถในแผน
- `trip_id` - Primary key
- `plan_id` - Foreign key to plans
- `vehicle_id` - รถที่ใช้
- `trip_sequence` - ลำดับเที่ยว
- `total_distance_km`, `total_duration_minutes` - ระยะทางและเวลา
- `shipping_cost` - ค่าขนส่ง (กรอกด้วยตนเอง)

### receiving_route_trip_stops
ตารางจุดหยุดในแต่ละเที่ยว
- `stop_id` - Primary key
- `trip_id` - Foreign key to trips
- `stop_sequence` - ลำดับจุดหยุด
- `customer_id` - ลูกค้า
- `order_ids` - รายการ orders ที่ส่งที่จุดนี้
- `arrival_time`, `departure_time` - เวลาถึงและออก

## Integration with Mapbox

ระบบใช้ Mapbox สำหรับ:
- คำนวณระยะทางจริง (driving distance)
- คำนวณเวลาเดินทางจริง (driving time)
- แสดงแผนที่และเส้นทาง
- Geocoding (แปลง address เป็น coordinates)

**Environment Variable:**
```
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

## Workflow Integration

VRP เชื่อมต่อกับ workflow หลัก:

1. **สร้างแผน** → status: draft
2. **เปลี่ยนเป็น optimizing** → เปิดให้กรอกค่าขนส่ง
3. **กรอกค่าขนส่งครบ** → status: published (อัตโนมัติ)
4. **พิมพ์ใบว่าจ้าง** → status: pending_approval
5. **อนุมัติ** → status: approved
6. **สร้าง Picklist** → status: ready_to_load
7. **รถออก** → status: in_transit
8. **ส่งครบ** → status: completed

## Migration Files

- `029_add_pending_approval_status.sql` - เพิ่มสถานะ pending_approval/approved
- `030_add_shipping_cost_validation_trigger.sql` - Trigger ตรวจสอบค่าขนส่งครบ

## ใช้เมื่อไหร่?

### สำหรับ Developer
ใช้เอกสารเหล่านี้เมื่อ:
- พัฒนาระบบจัดเส้นทาง
- เข้าใจ VRP algorithms
- ปรับแต่ง optimization parameters
- แก้ไข route calculation logic

### สำหรับ Logistics Manager
ใช้เอกสารเหล่านี้เมื่อ:
- ต้องการเข้าใจวิธีการจัดเส้นทาง
- เลือก algorithm ที่เหมาะสม
- กำหนด constraints (น้ำหนัก, ปริมาตร, จำนวนรถ)

## เอกสารที่เกี่ยวข้อง

### ใน /docs
- `docs/VRP_SYSTEM.md` - เอกสารระบบ VRP แบบละเอียด
- `docs/VRP_CHANGELOG.md` - ประวัติการแก้ไข VRP
- `docs/VRP_EXAMPLES.md` - ตัวอย่างการใช้งาน
- `docs/VRP_VEHICLE_LIMIT_FEATURE.md` - ฟีเจอร์จำกัดจำนวนรถ
- `docs/VRP_VEHICLE_LIMIT_EXAMPLE.md` - ตัวอย่างการจำกัดรถ

### Code Files
- `lib/vrp/algorithms.ts` - VRP algorithms implementation
- `lib/vrp/mapbox.ts` - Mapbox integration
- `components/vrp/OptimizationSidebar.tsx` - UI สำหรับตั้งค่า
- `components/maps/RouteMap.tsx` - แสดงแผนที่
- `app/receiving/routes/page.tsx` - หน้าจัดการเส้นทาง
- `app/api/route-plans/optimize/route.ts` - API endpoint
