# Debug: Picklist Creation Error (400 Bad Request)

**เวลา**: 2025-11-29
**ปัญหา**: สร้างใบหยิบสินค้าไม่ได้ ระบบแจ้ง 400 Bad Request

---

## 🔍 วิธีดู Error Message ที่แท้จริง

### **วิธีที่ 1: ดูใน Browser Console (แนะนำ)**

1. เปิด Browser Developer Tools (กด F12)
2. ไปที่ tab **Console**
3. กดปุ่ม "สร้างใบหยิบสินค้า" อีกครั้ง
4. ดู error message ที่ขึ้น

**จุดสำคัญ:** ดูที่ Response body ของ API call

---

### **วิธีที่ 2: ดูใน Network Tab**

1. เปิด Developer Tools (F12)
2. ไปที่ tab **Network**
3. กดปุ่ม "สร้างใบหยิบสินค้า" อีกครั้ง
4. หา request `create-from-trip`
5. คลิกที่ request นั้น
6. ดูที่ tab **Response** หรือ **Preview**

**ตัวอย่าง error messages ที่อาจพบ:**

```json
{
  "error": "Cannot create picklist: Some SKUs do not have preparation area configured",
  "missing_locations": [
    {
      "sku_id": "B-BEY-C|MNB|010",
      "sku_name": "สินค้า A",
      "reason": "SKU does not have preparation area (default_location) configured"
    }
  ],
  "instructions": "Please configure default_location for these SKUs..."
}
```

หรือ

```json
{
  "error": "Cannot create picklist: Insufficient stock for some items",
  "insufficient_items": [
    {
      "sku_id": "B-BEY-C|MNB|010",
      "sku_name": "สินค้า A",
      "location": "PK001",
      "required": 100,
      "available": 50,
      "shortage": 50
    }
  ]
}
```

---

### **วิธีที่ 3: ดูใน Terminal (Dev Server Logs)**

1. เปิด Terminal ที่รัน `npm run dev`
2. กดปุ่ม "สร้างใบหยิบสินค้า" อีกครั้ง
3. ดู error logs ที่ปรากฏ

---

## 🐛 สาเหตุที่เป็นไปได้

### **สาเหตุที่ 1: SKU ไม่มี default_location (preparation area)**

**อาการ:**
```json
{
  "error": "Cannot create picklist: Some SKUs do not have preparation area configured"
}
```

**วิธีแก้:**
1. ไปที่ `/master-data/products`
2. หา SKU ที่มีปัญหา (ตาม error message)
3. กดแก้ไข SKU นั้น
4. เลือก "Preparation Area" (default_location)
5. บันทึก

**ตรวจสอบใน Database:**
```sql
-- หา SKU ที่ไม่มี default_location
SELECT
    sku_id,
    sku_code,
    sku_name,
    default_location
FROM master_sku
WHERE sku_id IN (
    -- ใส่ sku_id ที่ต้องการตรวจสอบ
    'B-BEY-C|MNB|010',
    'B-BEY-C|MNB|011'
)
AND (default_location IS NULL OR default_location = '');
```

**แก้ไขใน Database (ถ้าจำเป็น):**
```sql
UPDATE master_sku
SET default_location = 'PK001'  -- เปลี่ยนเป็น location ที่ต้องการ
WHERE sku_id = 'B-BEY-C|MNB|010'
AND (default_location IS NULL OR default_location = '');
```

---

### **สาเหตุที่ 2: สต็อคไม่พอ**

**อาการ:**
```json
{
  "error": "Cannot create picklist: Insufficient stock for some items",
  "insufficient_items": [...]
}
```

**วิธีแก้:**
1. เช็คสต็อคที่ preparation area (default_location)
2. เพิ่มสต็อคหรือย้ายสต็อคจาก location อื่น
3. ลองสร้าง picklist อีกครั้ง

**ตรวจสอบสต็อค:**
```sql
-- ตรวจสอบสต็อคที่ preparation area
SELECT
    b.location_id,
    b.sku_id,
    s.sku_name,
    b.total_piece_qty,
    b.reserved_piece_qty,
    b.total_piece_qty - b.reserved_piece_qty AS available_qty
FROM wms_inventory_balances b
JOIN master_sku s ON s.sku_id = b.sku_id
WHERE b.sku_id IN (
    -- ใส่ sku_id ที่มีปัญหา
    'B-BEY-C|MNB|010'
)
AND b.location_id = (
    SELECT default_location
    FROM master_sku
    WHERE sku_id = b.sku_id
)
ORDER BY b.sku_id;
```

---

### **สาเหตุที่ 3: Trip ไม่มี Orders**

**อาการ:**
```json
{
  "error": "No orders found in this trip"
}
```

**วิธีแก้:**
1. ตรวจสอบว่า trip มี stops และ orders หรือไม่
2. ตรวจสอบว่า route plan ถูก publish หรือยัง

**ตรวจสอบ:**
```sql
-- ตรวจสอบ stops และ orders ใน trip
SELECT
    s.stop_id,
    s.sequence_no,
    s.stop_name,
    s.order_id,
    s.tags
FROM receiving_route_stops s
WHERE s.trip_id = 123  -- เปลี่ยนเป็น trip_id ที่ต้องการ
ORDER BY s.sequence_no;
```

---

### **สาเหตุที่ 4: Migration ยังไม่ถูก Deploy**

**อาการ:**
```json
{
  "error": "relation \"picklist_item_reservations\" does not exist"
}
```

**วิธีแก้:**
รัน migrations:
```bash
npm run db:migrate
```

หรือ check ว่า table มีอยู่หรือยัง:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'picklist_item_reservations';
```

---

## 📋 Checklist การแก้ปัญหา

### **ขั้นตอนที่ 1: ดู Error Message**
- [ ] เปิด Browser Console (F12)
- [ ] ดูที่ Network tab → Response
- [ ] บันทึก error message ที่ได้

### **ขั้นตอนที่ 2: ตรวจสอบข้อมูลพื้นฐาน**
- [ ] ตรวจสอบว่า SKU มี default_location หรือยัง
- [ ] ตรวจสอบว่ามีสต็อคเพียงพอหรือไม่
- [ ] ตรวจสอบว่า trip มี orders หรือไม่

### **ขั้นตอนที่ 3: แก้ไขตามสาเหตุ**
- [ ] แก้ไข master data (เพิ่ม default_location)
- [ ] เพิ่ม/ย้ายสต็อค (ถ้าจำเป็น)
- [ ] ตรวจสอบ route plan setup

### **ขั้นตอนที่ 4: ทดสอบอีกครั้ง**
- [ ] Refresh หน้าเว็บ
- [ ] ลองสร้าง picklist อีกครั้ง
- [ ] ตรวจสอบว่าสำเร็จหรือไม่

---

## 💡 Tips

1. **อ่าน error message ให้ละเอียด** - API ออกแบบให้แจ้ง error ที่ชัดเจน
2. **ตรวจสอบ default_location ก่อน** - นี่คือสาเหตุที่พบบ่อยที่สุด
3. **ใช้ SQL queries ตรวจสอบ** - เร็วกว่าไล่หาทาง UI
4. **Refresh หน้าเว็บ** - หลังแก้ไข master data

---

## 📞 ถ้ายังแก้ไม่ได้

ให้ส่ง **error message ที่ได้จาก Browser Console** มาให้ดูครับ จะช่วยแก้ไขให้

---

**End of Debug Guide**
