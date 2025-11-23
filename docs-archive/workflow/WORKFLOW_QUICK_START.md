# Workflow Status Management - Quick Start Guide

## 🚀 เริ่มต้นใช้งาน

คู่มือฉบับย่อสำหรับการใช้งานระบบ Workflow Status Management

---

## 📋 เช็คลิสต์ก่อนใช้งาน

- [x] รัน Migration 026 และ 027 เรียบร้อยแล้ว
- [ ] ระบบมี Orders ที่เป็น `draft`
- [ ] ระบบมี Route Plans
- [ ] Mapbox Token ตั้งค่าถูกต้อง

---

## 🔄 Workflow ทีละขั้นตอน

### ขั้นตอนที่ 1: นำเข้า Orders
**หน้า:** `/receiving/orders`
**ปุ่ม:** "สร้างคำสั่งซื้อใหม่"

1. กดปุ่ม "สร้างคำสั่งซื้อใหม่"
2. Import จากไฟล์ Excel หรือกรอกข้อมูลเอง
3. Orders ที่นำเข้าจะมีสถานะ `draft` (สีเทา)

**✅ ผลลัพธ์:** Orders สถานะ `draft`

---

### ขั้นตอนที่ 2: สร้างและ Publish Route Plan
**หน้า:** `/receiving/routes`

1. กดปุ่ม "สร้างแผนเส้นทางใหม่"
2. เลือก Orders ที่มีสถานะ `draft`
3. ตั้งค่าพารามิเตอร์ VRP (รถ, น้ำหนักสูงสุด, เวลา)
4. กด "คำนวณเส้นทาง" (Optimize)
5. **กด "Publish"** 🎯

**⚡ Trigger อัตโนมัติ:**
- Route Plan: `draft` → `published` (สีเขียว)
- **Orders: `draft` → `confirmed` (สีฟ้า)** ✅

---

### ขั้นตอนที่ 3: สร้าง Picklist
**หน้า:** `/receiving/picklists`

1. กดปุ่ม "สร้าง Picklist จากแผนรถ"
2. เลือก Route Plan ที่มีสถานะ `published`
3. กด "สร้าง Picklist"

**⚡ Trigger อัตโนมัติ:**
- Picklist: สร้างใหม่ สถานะ `pending` (สีเทา)
- **Orders: `confirmed` → `in_picking` (สีส้ม)** ✅

---

### ขั้นตอนที่ 4: พิมพ์เอกสาร Picklist 🖨️
**หน้า:** `/receiving/picklists`
**ปุ่ม:** ไอคอน Printer (เฉพาะ Picklist ที่ status = `pending`)

1. ค้นหา Picklist ที่ต้องการพิมพ์
2. **กดปุ่ม Printer (สีเขียว)**
3. ยืนยันการพิมพ์

**📝 API Call:**
```bash
POST /api/picklists/{id}/print
```

**✅ ผลลัพธ์:**
- Picklist: `pending` → `picking` (สีส้ม)
- Orders: ยังคง `in_picking`
- พนักงานสามารถหยิบสินค้าได้

---

### ขั้นตอนที่ 5: Complete Picklist (หยิบเสร็จ)
**หน้า:** `/receiving/picklists/{id}` (หน้ารายละเอียด)

1. เข้าไปที่หน้ารายละเอียด Picklist
2. เช็คว่าหยิบครบทุกรายการแล้ว
3. กดปุ่ม "เสร็จสิ้น" หรืออัปเดตสถานะเป็น `completed`

**⚡ Trigger อัตโนมัติ:**
- Picklist: `picking` → `completed` (สีเขียว)
- **Orders: `in_picking` → `picked` (สีน้ำเงิน)** ✅
- **ถ้าทุก Picklist ใน Route Plan เสร็จ:**
  - **Route Plan: `published` → `ready_to_load` (สีน้ำเงิน)** ✅

---

### ขั้นตอนที่ 6: สแกนขึ้นรถ 📦
**หน้า:** `/mobile/loading` (หรือ API)
**API:** `POST /api/loadlists/{id}/scan`

#### วิธีที่ 1: ผ่าน Mobile App
1. เปิดหน้า Mobile Loading
2. สแกน QR Code ของ Order
3. ระบบจะเพิ่ม Order เข้า Loadlist

#### วิธีที่ 2: ผ่าน API
```bash
curl -X POST http://localhost:3000/api/loadlists/1/scan \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 123,
    "order_no": "IV25010001",
    "employee_id": 456
  }'
```

**⚡ Trigger อัตโนมัติ:**
- Loadlist: `pending` → `loading` (สีส้ม)
- **Orders: `picked` → `loaded` (สีน้ำเงิน)** ✅

---

### ขั้นตอนที่ 7: รถออกจัดส่ง 🚚
**API:** `POST /api/loadlists/{id}/depart`

1. ตรวจสอบว่าขึ้นรถครบแล้ว
2. กดปุ่ม "ออกจัดส่ง" หรือเรียก API

```bash
curl -X POST http://localhost:3000/api/loadlists/1/depart
```

**⚡ Trigger อัตโนมัติ:**
- Loadlist: `loading` → `loaded` (สีน้ำเงิน)
- **Orders: `loaded` → `in_transit` (สีฟ้า)** ✅
- **Route Plan: `ready_to_load` → `in_transit` (สีฟ้า)** ✅

---

### ขั้นตอนที่ 8: ส่งถึงลูกค้า ✅
**หน้า:** `/mobile/delivery` หรือ `/receiving/orders`

1. อัปเดตสถานะ Order เป็น `delivered` (ทีละ order)
2. หรือใช้ระบบ TMS (Transport Management System)

**⚡ Trigger อัตโนมัติ:**
- Orders: `in_transit` → `delivered` (สีเขียว)
- **ถ้าทุก Order ใน Loadlist ส่งถึงแล้ว:**
  - **Loadlist: `loaded` → `completed` (สีเขียว)** ✅
- **ถ้าทุก Loadlist ใน Route Plan เสร็จแล้ว:**
  - **Route Plan: `in_transit` → `completed` (สีเขียว)** ✅

---

## 📊 สรุปการเปลี่ยนสถานะ

| ขั้นตอน | Manual Action | Auto Trigger |
|---------|--------------|--------------|
| 1. นำเข้า Orders | Import → `draft` | - |
| 2. Publish Route | กดปุ่ม Publish | Orders: `draft` → `confirmed` ✅ |
| 3. สร้าง Picklist | กดปุ่ม Create | Orders: `confirmed` → `in_picking` ✅ |
| 4. พิมพ์เอกสาร | กดปุ่ม Print | Picklist: `pending` → `picking` |
| 5. Complete Picklist | กดปุ่ม Complete | Orders: `in_picking` → `picked` ✅<br/>Route: `published` → `ready_to_load` ✅ |
| 6. สแกนขึ้นรถ | สแกน QR Code | Orders: `picked` → `loaded` ✅<br/>Loadlist: `pending` → `loading` ✅ |
| 7. รถออก | กดปุ่ม Depart | Orders: `loaded` → `in_transit` ✅<br/>Route: `ready_to_load` → `in_transit` ✅ |
| 8. ส่งถึง | อัปเดตสถานะ | Loadlist: `loaded` → `completed` ✅<br/>Route: `in_transit` → `completed` ✅ |

---

## 🎨 สีของสถานะ (Badge)

### Orders
- 🔘 `draft` - เทา (default)
- 🔵 `confirmed` - ฟ้า (info)
- 🟠 `in_picking` - ส้ม/เหลือง (warning)
- 🔵 `picked` - น้ำเงิน (primary)
- 🔵 `loaded` - น้ำเงิน (primary)
- 🔵 `in_transit` - ฟ้า (info)
- 🟢 `delivered` - เขียว (success)
- 🔴 `cancelled` - แดง (danger)

### Route Plans
- 🔘 `draft` - เทา (default)
- 🟡 `optimizing` - เหลือง (warning)
- 🟢 `published` - เขียว (success)
- 🔵 `ready_to_load` - น้ำเงิน (primary) **[ใหม่]**
- 🔵 `in_transit` - ฟ้า (info) **[ใหม่]**
- 🟢 `completed` - เขียว (success)
- 🔴 `cancelled` - แดง (danger)

### Picklists
- 🔘 `pending` - เทา (default)
- 🔵 `assigned` - ฟ้า (info)
- 🟠 `picking` - ส้ม/เหลือง (warning)
- 🟢 `completed` - เขียว (success)
- 🔴 `cancelled` - แดง (danger)

### Loadlists **[ใหม่]**
- 🔘 `pending` - เทา (default)
- 🟠 `loading` - ส้ม/เหลือง (warning)
- 🔵 `loaded` - น้ำเงิน (primary)
- 🟢 `completed` - เขียว (success)
- 🔴 `cancelled` - แดง (danger)

---

## 🔍 Troubleshooting

### ❌ Orders ไม่เปลี่ยนเป็น confirmed หลัง Publish Route
**สาเหตุ:**
- Orders ไม่ได้อยู่ใน Route Plan
- Orders status ไม่ใช่ `draft`
- Trigger ไม่ทำงาน

**วิธีแก้:**
1. ตรวจสอบว่า Orders อยู่ใน `receiving_route_trip_stops`
2. ตรวจสอบ Trigger ทำงานหรือไม่ (ดู Logs ใน Supabase)
3. อัปเดต manual: `UPDATE wms_orders SET status = 'confirmed' WHERE ...`

---

### ❌ Picklist พิมพ์ไม่ได้
**สาเหตุ:**
- Status ไม่ใช่ `pending`
- API endpoint ไม่ทำงาน

**วิธีแก้:**
1. เช็คสถานะ Picklist ต้องเป็น `pending`
2. ตรวจสอบ API: `curl -X POST http://localhost:3000/api/picklists/{id}/print`
3. ดู Console ใน Browser (F12)

---

### ❌ Route Plan ไม่เปลี่ยนเป็น ready_to_load
**สาเหตุ:**
- Picklists ยังไม่เสร็จทั้งหมด
- มี Picklist ที่ไม่ได้ `completed` หรือ `cancelled`

**วิธีแก้:**
1. เช็คว่า Picklists ทั้งหมดใน Route Plan เป็น `completed` หรือ `cancelled`
2. SQL Query:
```sql
SELECT status, COUNT(*)
FROM picklists
WHERE plan_id = 123
GROUP BY status;
```

---

## 📞 ติดต่อ/สอบถาม

- **Documentation:** `WORKFLOW_STATUS_DESIGN.md`
- **Implementation:** `WORKFLOW_IMPLEMENTATION_SUMMARY.md`
- **Migrations:** `supabase/migrations/026*.sql`, `027*.sql`

---

**Happy Workflow! 🚀**
