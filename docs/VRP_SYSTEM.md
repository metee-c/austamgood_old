# ระบบจัดเส้นทางขนส่งอัตโนมัติ (VRP System)

## ภาพรวม

ระบบ Vehicle Routing Problem (VRP) ที่พัฒนาขึ้นสำหรับการจัดเส้นทางรับสินค้าอัตโนมัติ โดยใช้อัลกอริทึมขั้นสูงหลายแบบเพื่อหาเส้นทางที่เหมาะสมที่สุด

## ฟีเจอร์หลัก

### 1. Geographic Clustering (การแบ่งโซนพื้นที่)
- **K-Means Clustering**: แบ่งกลุ่มตามระยะทางที่ใกล้เคียงกัน
- **Grid-based Clustering**: แบ่งพื้นที่เป็นตารางกริด
- **Province-based Clustering**: แบ่งตามจังหวัด/พื้นที่

### 2. Routing Algorithms (อัลกอริทึมหาเส้นทาง)
- **Insertion Heuristic** (แนะนำ): เพิ่มจุดส่งทีละจุดในตำแหน่งที่เหมาะสมที่สุด
- **Clarke-Wright Savings**: รวมเส้นทางที่ประหยัดระยะทางมากที่สุด
- **Nearest Neighbor**: เลือกจุดส่งที่ใกล้ที่สุดถัดไป

### 3. Local Search Optimization (การปรับปรุงเส้นทาง)
- **2-opt**: สลับลำดับจุดส่งเพื่อลดระยะทาง (เร็ว)
- **3-opt**: ปรับปรุงแบบซับซ้อนกว่า (ช้าแต่ดีกว่า)

### 4. Route Consolidation (การรวมเส้นทาง)
- รวมเส้นทางที่มีจุดส่งน้อยเกินไปเพื่อลดจำนวนรถ
- ตรวจสอบข้อจำกัดด้านความจุและระยะทาง

### 5. Cost Calculation (การคำนวณต้นทุน)
- ต้นทุนต่อกิโลเมตร
- ต้นทุนคงที่ต่อคัน
- ค่าแรงคนขับต่อชั่วโมง
- เวลาเดินทางและเวลาให้บริการ

## โครงสร้างไฟล์

```
lib/vrp/
├── algorithms.ts           # อัลกอริทึม VRP ทั้งหมด

components/vrp/
├── OptimizationSidebar.tsx # UI สำหรับตั้งค่าการคำนวณ
└── RoutePlanDashboard.tsx  # Dashboard แสดงผลสรุป

app/api/route-plans/
└── optimize/
    └── route.ts            # API endpoint สำหรับคำนวณเส้นทาง
```

## การใช้งาน

### 1. สร้างแผนเส้นทางใหม่

```typescript
// 1. เลือกออเดอร์ที่ต้องการจัดส่ง
// 2. กดปุ่ม "สร้างแผนใหม่"
// 3. ตั้งค่าพารามิเตอร์ใน Optimization Sidebar
// 4. กดปุ่ม "จัดเส้นทางขนส่ง"
```

### 2. ตั้งค่าการคำนวณ

#### ข้อมูลทั่วไป
- **ความจุสูงสุดของรถ**: น้ำหนักสูงสุดที่รถสามารถบรรทุกได้ (กก.)
- **พิกัดคลังสินค้า**: ละติจูดและลองจิจูดของจุดเริ่มต้น/สิ้นสุด

#### ข้อจำกัดเวลา
- **ชั่วโมงทำงาน**: จำนวนชั่วโมงที่รถสามารถทำงานได้ต่อวัน
- **เวลาเริ่ม-สิ้นสุด**: ช่วงเวลาทำงาน
- **จำนวนจุดจอดสูงสุด**: จำนวนจุดส่งสูงสุดต่อเที่ยว
- **เวลาให้บริการ**: เวลาเฉลี่ยที่ใช้ในการส่งสินค้าแต่ละจุด (นาที)

#### การแบ่งโซน
- **วิธีการแบ่งโซน**: เลือกระหว่าง K-Means, Grid, Province, หรือไม่แบ่ง
- **จำนวนโซน**: จำนวนโซนที่ต้องการ (ใส่ 0 เพื่อให้คำนวณอัตโนมัติ)
- **ร้านค้าสูงสุดต่อโซน**: จำกัดจำนวนร้านค้าในแต่ละโซน

#### เกณฑ์การจัดเส้นทาง
- **เกณฑ์หาเส้นทาง**: ระยะทาง, เวลา, ต้นทุน, หรือจำนวนรถ
- **อัลกอริทึม**: Insertion, Savings, หรือ Nearest Neighbor
- **การปรับปรุง**: 2-opt, 3-opt, หรือไม่ใช้
- **ความเร็วเฉลี่ย**: ความเร็วเฉลี่ยของรถ (กม./ชม.)
- **เวลาทำการ**: เข้มงวด, ยืดหยุ่น, หรือไม่คำนึง

#### ต้นทุน
- **ต้นทุนต่อกิโลเมตร**: ค่าน้ำมันและค่าบำรุงรักษา (บาท/กม.)
- **ต้นทุนคงที่**: ค่าใช้จ่ายคงที่ต่อคัน (บาท)
- **ค่าแรงคนขับ**: อัตราค่าแรงต่อชั่วโมง (บาท/ชม.)
- **เวลาคำนวณสูงสุด**: จำกัดเวลาในการคำนวณ (วินาที)

## ตัวอย่างการตั้งค่า

### สำหรับการจัดส่งในเมือง (Urban Delivery)
```typescript
{
  vehicleCapacityKg: 1000,
  maxWorkingHours: 8,
  maxStops: 15,
  serviceTime: 15,
  zoneMethod: 'kmeans',
  numZones: 5,
  routingAlgorithm: 'insertion',
  localSearchMethod: '2opt',
  avgSpeedKmh: 40,
  respectTimeWindows: 'flexible',
  consolidationEnabled: true
}
```

### สำหรับการจัดส่งระหว่างจังหวัด (Inter-province)
```typescript
{
  vehicleCapacityKg: 2000,
  maxWorkingHours: 10,
  maxStops: 8,
  serviceTime: 20,
  zoneMethod: 'province',
  routingAlgorithm: 'savings',
  localSearchMethod: '2opt',
  avgSpeedKmh: 80,
  respectTimeWindows: 'strict',
  consolidationEnabled: true,
  distanceThreshold: 200
}
```

## API Reference

### POST /api/route-plans/optimize

คำนวณเส้นทางที่เหมาะสมสำหรับแผนที่ระบุ

**Request Body:**
```json
{
  "planId": 123
}
```

**Response:**
```json
{
  "data": {
    "planId": 123,
    "trips": 5,
    "summary": {
      "totalVehicles": 5,
      "totalDistance": 245.8,
      "totalDriveTime": 368,
      "totalCost": 3250.50,
      "totalWeight": 4500,
      "totalDeliveries": 45
    }
  },
  "error": null
}
```

## อัลกอริทึมที่ใช้

### 1. Haversine Distance
คำนวณระยะทางระหว่างสองจุดบนพื้นผิวโลก

```typescript
distance = 2 * R * arcsin(sqrt(
  sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
))
```

### 2. K-Means Clustering
แบ่งกลุ่มจุดส่งตามระยะทาง

```
1. เลือกจุดศูนย์กลางเริ่มต้น k จุด
2. จัดกลุ่มจุดส่งตามจุดศูนย์กลางที่ใกล้ที่สุด
3. คำนวณจุดศูนย์กลางใหม่
4. ทำซ้ำจนกว่าจะลู่เข้า
```

### 3. Insertion Heuristic
เพิ่มจุดส่งทีละจุดในตำแหน่งที่เพิ่มระยะทางน้อยที่สุด

```
1. เริ่มด้วยจุดส่งที่ไกลที่สุดหรือมี priority สูงสุด
2. สำหรับแต่ละจุดส่งที่เหลือ:
   - ลองแทรกในทุกตำแหน่งของเส้นทาง
   - เลือกตำแหน่งที่เพิ่มระยะทางน้อยที่สุด
3. ทำซ้ำจนกว่าจะครบทุกจุดหรือเต็มความจุ
```

### 4. 2-opt Optimization
ปรับปรุงเส้นทางโดยการสลับลำดับ

```
1. สำหรับแต่ละคู่ของจุดส่ง (i, j):
   - กลับลำดับจุดส่งระหว่าง i ถึง j
   - ถ้าระยะทางลดลง ให้ใช้ลำดับใหม่
2. ทำซ้ำจนกว่าจะไม่มีการปรับปรุง
```

## Performance Tips

1. **ใช้ K-Means สำหรับพื้นที่กว้าง**: ช่วยลดเวลาคำนวณและได้ผลลัพธ์ที่ดี
2. **เปิด Consolidation**: ลดจำนวนรถที่ใช้
3. **ใช้ 2-opt แทน 3-opt**: เร็วกว่าและได้ผลลัพธ์ใกล้เคียงกัน
4. **จำกัด maxStops**: ลดความซับซ้อนของการคำนวณ
5. **ใช้ Mapbox API**: ได้ระยะทางที่แม่นยำกว่า Haversine

## Troubleshooting

### ปัญหา: คำนวณช้าเกินไป
- ลด `numZones` หรือ `maxStoresPerZone`
- เปลี่ยนจาก `3opt` เป็น `2opt` หรือ `none`
- เพิ่ม `maxComputationTime`
- ลด `maxStops`

### ปัญหา: ได้เส้นทางที่ไม่เหมาะสม
- เปลี่ยนอัลกอริทึมเป็น `savings` หรือ `insertion`
- เปิด `localSearchMethod` เป็น `2opt`
- เปิด `consolidationEnabled`
- ปรับ `detourFactor` ให้สูงขึ้น

### ปัญหา: รถเกินความจุ
- ลด `vehicleCapacityKg`
- เปิด `ignoreSmallDeliveries` สำหรับสินค้าน้ำหนักเบา
- ตรวจสอบข้อมูลน้ำหนักของออเดอร์

## Future Enhancements

- [ ] Time Window Constraints (Hard/Soft)
- [ ] Multi-depot Support
- [ ] Driver Skills/Preferences
- [ ] Vehicle Types (Different capacities)
- [ ] Real-time Traffic Integration
- [ ] Dynamic Re-optimization
- [ ] Machine Learning for Parameter Tuning
- [ ] 3D Visualization
- [ ] Mobile App for Drivers

## References

- Clarke, G., & Wright, J. W. (1964). "Scheduling of Vehicles from a Central Depot to a Number of Delivery Points"
- Christofides, N. (1976). "Worst-Case Analysis of a New Heuristic for the Travelling Salesman Problem"
- Solomon, M. M. (1987). "Algorithms for the Vehicle Routing and Scheduling Problems with Time Window Constraints"

## License

Copyright © 2024 AustamGood WMS. All rights reserved.
