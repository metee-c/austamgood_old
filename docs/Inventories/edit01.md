# งาน: ตรวจสอบและแก้ไขปัญหา Inventory Balance ติดลบที่ Location "Dispatch"

## สถานการณ์ปัจจุบัน
ระบบแสดงยอด Inventory ที่ Location "Dispatch" ผิดปกติ:
- ปัจจุบัน(ชิ้น) = **-5972** (ติดลบ)
- ปัจจุบัน(กก.) = **-6425.4** (ติดลบ)

## ข้อเท็จจริงจากการตรวจสอบ
1. หน้า `/mobile/pick` - ยืนยันหยิบหมดแล้ว (ไม่มีรายการค้าง)
2. หน้า `/mobile/loading` - ยืนยันโหลดหมดแล้ว (ไม่มีรายการค้าง)
3. หน้า `/receiving/picklists` - มีเพียง 3 Picklist ที่ยืนยันหยิบแล้ว แต่ยังไม่ได้โหลด:
   - `PL-20260118-001`
   - `PL-20260118-002`
   - `PL-20260118-003`

## ผลลัพธ์ที่ถูกต้องควรเป็น
- Location "Dispatch" ควรมี Inventory เฉพาะสินค้าจาก 3 Picklist ข้างต้นเท่านั้น
- ยอดต้องเป็น **บวก** และตรงกับผลรวมของ 3 Picklist ที่ยังไม่โหลด

---

## ขั้นตอนการตรวจสอบ (ใช้ MCP Tools)

### Step 1: ตรวจสอบ Database Schema
ใช้ MCP tool เพื่อ query หา tables ที่เกี่ยวข้อง:
- inventory_balances / stock_balances
- locations
- picklists / picklist_items
- transactions / inventory_transactions

### Step 2: ตรวจสอบยอด Inventory ที่ Location "Dispatch"
```sql
-- Query ตรวจสอบยอดปัจจุบัน
SELECT * FROM inventory_balances 
WHERE location_id = (SELECT id FROM locations WHERE name = 'Dispatch');
```

### Step 3: ตรวจสอบรายการใน 3 Picklist ที่ยังไม่โหลด
```sql
-- Query หารายการสินค้าใน 3 Picklist
SELECT pl.picklist_no, pli.product_id, pli.quantity, pli.weight
FROM picklists pl
JOIN picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_no IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
  AND pl.picked_at IS NOT NULL 
  AND pl.loaded_at IS NULL;
```

### Step 4: ตรวจสอบ Transaction History
```sql
-- หา transactions ที่ทำให้ยอดติดลบ
SELECT * FROM inventory_transactions 
WHERE location_id = (SELECT id FROM locations WHERE name = 'Dispatch')
ORDER BY created_at DESC
LIMIT 100;
```

### Step 5: หาสาเหตุความไม่สอดคล้อง
ตรวจสอบว่า:
1. มี transaction ซ้ำหรือไม่?
2. มีการหักยอดโดยไม่มีการเพิ่มก่อนหรือไม่?
3. มี race condition ในการอัพเดทยอดหรือไม่?

### Step 6: คำนวณยอดที่ถูกต้อง
```sql
-- คำนวณยอดที่ควรจะเป็นจาก 3 Picklist
SELECT 
    SUM(pli.quantity) as expected_quantity,
    SUM(pli.weight) as expected_weight
FROM picklists pl
JOIN picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_no IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
  AND pl.picked_at IS NOT NULL 
  AND pl.loaded_at IS NULL;
```

### Step 7: แก้ไขยอด (ถ้าจำเป็น)
ถ้าพบว่ายอดผิดพลาด ให้:
1. สำรองข้อมูลเดิมก่อน
2. Recalculate จาก transaction history หรือ
3. Reset และคำนวณใหม่จาก 3 Picklist ที่ค้างอยู่

---

## URLs สำหรับตรวจสอบผลลัพธ์
- Inventory Balances: `http://localhost:3000/warehouse/inventory-balances`
- Location Master: `http://localhost:3000/master-data/locations`
- Picklist List: `http://localhost:3000/receiving/picklists`
- Mobile Pick: `http://localhost:3000/mobile/pick`
- Mobile Loading: `http://localhost:3000/mobile/loading`

---

## Output ที่ต้องการ
1. **Root Cause Analysis**: สาเหตุที่ยอดติดลบ
2. **ยอดที่ถูกต้อง**: ผลรวมจาก 3 Picklist
3. **SQL Script แก้ไข**: (ถ้าจำเป็น)
4. **Recommendation**: วิธีป้องกันไม่ให้เกิดซ้ำ