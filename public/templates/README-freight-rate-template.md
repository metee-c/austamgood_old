# คู่มือการใช้งานไฟล์เทมเพลตนำเข้าอัตราค่าขนส่ง (Freight Rate Import Template)

## คำอธิบายคอลัมน์

### คอลัมน์บังคับ (Required)
1. **carrier_id** - รหัสผู้ให้บริการขนส่ง (ต้องมีอยู่ในระบบ)
2. **route_name** - ชื่อเส้นทาง เช่น "กรุงเทพฯ-เชียงใหม่"
3. **origin_province** - จังหวัดต้นทาง
4. **destination_province** - จังหวัดปลายทาง
5. **total_distance_km** - ระยะทางรวม (กิโลเมตร)
6. **pricing_mode** - โหมดการคิดราคา
   - `flat` = แบบเหมา (ใส่ราคาเดียวจบ)
   - `formula` = แบบคำนวณ (ราคาเริ่มต้น + ค่าเด็ก + ค่าจุดเพิ่ม)
7. **base_price** - ราคาหลัก/ราคาเริ่มต้น (บาท)
8. **price_unit** - หน่วยคิดราคา
   - `trip` = ต่อเที่ยว
   - `kg` = ต่อกิโลกรัม
   - `pallet` = ต่อพาเลท
   - `other` = อื่นๆ
9. **effective_start_date** - วันที่เริ่มใช้ราคา (รูปแบบ: YYYY-MM-DD)
10. **created_by** - ผู้สร้างข้อมูล

### คอลัมน์ไม่บังคับ (Optional)
- **origin_district** - อำเภอต้นทาง
- **destination_district** - อำเภอปลายทาง
- **extra_drop_price** - ค่าจุดส่งเพิ่ม (บาท) - ใช้กับ formula mode
- **helper_price** - ค่าเด็กติดรถ (บาท) - ใช้กับ formula mode
- **porterage_fee** - ค่าแบกน้ำหนัก (บาท)
- **other_fees** - ค่าใช้จ่ายอื่นๆ (JSON format)
  - รูปแบบ: `[{"label":"ค่าทางด่วน","amount":120},{"label":"ค่าจอดรถ","amount":50}]`
- **min_charge** - ค่าขนส่งขั้นต่ำ (บาท)
- **fuel_surcharge_rate** - อัตราค่าน้ำมัน (%)
- **effective_end_date** - วันที่สิ้นสุดการใช้ราคา (รูปแบบ: YYYY-MM-DD)
- **notes** - หมายเหตุ

## ตัวอย่างการกรอกข้อมูล

### ตัวอย่างที่ 1: แบบคำนวณ (Formula Mode)
```
carrier_id: 1
route_name: กรุงเทพฯ-เชียงใหม่
origin_province: กรุงเทพมหานคร
destination_province: เชียงใหม่
total_distance_km: 700
pricing_mode: formula
base_price: 5000
extra_drop_price: 150
helper_price: 800
porterage_fee: 300
other_fees: [{"label":"ค่าทางด่วน","amount":120}]
price_unit: trip
effective_start_date: 2025-01-01
```

**การคำนวณ:**
- ราคาเริ่มต้น: 5,000 บาท
- ค่าเด็กติดรถ: 800 บาท
- ค่าจุดเพิ่ม (สมมติ 5 จุด): 4 × 150 = 600 บาท
- ค่าแบกน้ำหนัก: 300 บาท
- ค่าทางด่วน: 120 บาท
- **รวม: 6,820 บาท**

### ตัวอย่างที่ 2: แบบเหมา (Flat Mode)
```
carrier_id: 2
route_name: กรุงเทพฯ-ภูเก็ต
origin_province: กรุงเทพมหานคร
destination_province: ภูเก็ต
total_distance_km: 850
pricing_mode: flat
base_price: 15000
porterage_fee: 500
other_fees: [{"label":"ค่าจอดรถ","amount":50}]
price_unit: trip
effective_start_date: 2025-01-01
```

**ราคารวม: 15,000 บาท** (ค่าเหมา - ไม่คำนวณเพิ่ม)

## หมายเหตุสำคัญ
1. ไฟล์ต้องเป็นรูปแบบ CSV (UTF-8)
2. ห้ามมีช่องว่างหรือตัวอักษรพิเศษในชื่อคอลัมน์
3. วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD เท่านั้น
4. ค่า other_fees ต้องเป็น JSON ที่ถูกต้อง
5. pricing_mode ต้องเป็น `flat` หรือ `formula` เท่านั้น
6. ตัวเลขทศนิยมใช้จุด (.) ไม่ใช่จุลภาค (,)
