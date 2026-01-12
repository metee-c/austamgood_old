# ภารกิจ: ปรับสต็อก Bonus Face Sheet Packages ตามของจริง

## ⛔ กฎเหล็ก

1. **ต้อง** ยึดตามไฟล์ `ของค้างโลเคชั่น.xlsx` เป็นหลัก
2. **ต้อง** ใช้กระบวนการที่ถูกต้องในการปรับสต็อก (ผ่าน Ledger)
3. **ต้อง** Backup ข้อมูลก่อนแก้ไข
4. **ต้อง** อัพเดทสถานะ BFS ให้ถูกต้องด้วย
5. **ห้าม** แก้ไข Balance โดยตรง (ต้องผ่าน Ledger)

---

## 🎯 สถานการณ์

| กรณี | ในระบบ | ของจริง | สิ่งที่ต้องทำ |
|------|--------|---------|-------------|
| A | มี (ยังไม่โหลด) | ไม่มี | โหลดออกจากระบบ |
| B | โหลดแล้ว | ยังมีอยู่ | ถอยกลับ (Reverse) |
| C | มี | มี | ไม่ต้องทำอะไร |
| D | ไม่มี | มี | เพิ่มเข้าระบบ (ถ้าจำเป็น) |

---

## Phase 0: อ่านและวิเคราะห์ไฟล์ Excel

### 0.1 อ่านไฟล์ `ของค้างโลเคชั่น.xlsx`
```bash
# ดูไฟล์ที่ upload
ls -la /mnt/user-data/uploads/

# อ่านไฟล์ Excel
python3 << 'EOF'
import pandas as pd

# อ่านไฟล์
df = pd.read_excel('/mnt/user-data/uploads/ของค้างโลเคชั่น.xlsx')

# แสดงข้อมูล
print("=== Columns ===")
print(df.columns.tolist())

print("\n=== Shape ===")
print(df.shape)

print("\n=== First 20 rows ===")
print(df.head(20).to_string())

print("\n=== Data Types ===")
print(df.dtypes)

print("\n=== Unique Locations ===")
if 'location' in df.columns.str.lower():
    loc_col = [c for c in df.columns if 'location' in c.lower()][0]
    print(df[loc_col].unique())
EOF
```

### 0.2 สรุปข้อมูลจากไฟล์

**บันทึก:**
```
- จำนวน rows: ___
- Columns: ___
- Locations ที่มี: PQ01-PQ10, MR01-10
- ข้อมูลที่มี: barcode, SKU, quantity, location, etc.
```

---

## Phase 1: ตรวจสอบข้อมูลในระบบด้วย MCP

### 1.1 ดู Packages ที่อยู่ใน PQ01-PQ10, MR01-10
```sql
-- ดู packages ทั้งหมดที่อยู่ใน locations เหล่านี้
SELECT 
  p.id as package_id,
  p.barcode_id,
  p.package_number,
  p.face_sheet_id,
  bfs.face_sheet_no,
  p.storage_location,
  p.status as package_status,
  p.loadlist_id,
  p.shop_name,
  p.hub,
  l.loadlist_code,
  l.status as loadlist_status
FROM bonus_face_sheet_packages p
JOIN bonus_face_sheets bfs ON bfs.id = p.face_sheet_id
LEFT JOIN loadlists l ON l.id = p.loadlist_id
WHERE p.storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
ORDER BY p.storage_location, p.barcode_id;
```

### 1.2 สรุปจำนวนตาม Location
```sql
-- สรุปจำนวน packages ตาม location
SELECT 
  p.storage_location,
  COUNT(*) as total_packages,
  COUNT(p.loadlist_id) as loaded_packages,
  COUNT(*) - COUNT(p.loadlist_id) as pending_packages
FROM bonus_face_sheet_packages p
WHERE p.storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
GROUP BY p.storage_location
ORDER BY p.storage_location;
```

### 1.3 ดู Inventory Balance ของ BFS Items
```sql
-- ดู balance ของสินค้าใน BFS packages
SELECT 
  b.balance_id,
  p.product_code,
  prod.product_name,
  l.location_code,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty
FROM wms_inventory_balances b
JOIN master_products prod ON prod.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
JOIN (
  SELECT DISTINCT i.product_code
  FROM bonus_face_sheet_items i
  JOIN bonus_face_sheet_packages pkg ON pkg.id = i.package_id
  WHERE pkg.storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
) p ON prod.product_code = p.product_code
WHERE l.location_code SIMILAR TO '(PQ|MR)[0-9]{1,2}'
ORDER BY l.location_code, p.product_code;
```

---

## Phase 2: เปรียบเทียบข้อมูล

### 2.1 Script เปรียบเทียบ
```python
import pandas as pd

# อ่านข้อมูลจากไฟล์ Excel
excel_df = pd.read_excel('/mnt/user-data/uploads/ของค้างโลเคชั่น.xlsx')

# ข้อมูลจากระบบ (ต้องดึงจาก MCP ก่อน)
# system_df = ... (จาก query 1.1)

# เปรียบเทียบ
# 1. ในระบบมี แต่ Excel ไม่มี → ต้องโหลดออก
in_system_not_excel = system_df[~system_df['barcode_id'].isin(excel_df['barcode'])]

# 2. ในระบบโหลดแล้ว แต่ Excel ยังมี → ต้อง reverse
loaded_but_exists = system_df[
    (system_df['loadlist_id'].notna()) & 
    (system_df['barcode_id'].isin(excel_df['barcode']))
]

# 3. ตรงกัน (ไม่ต้องทำอะไร)
matched = system_df[
    (system_df['loadlist_id'].isna()) & 
    (system_df['barcode_id'].isin(excel_df['barcode']))
]

print(f"=== สรุปผลเปรียบเทียบ ===")
print(f"1. ต้องโหลดออก: {len(in_system_not_excel)} packages")
print(f"2. ต้อง Reverse: {len(loaded_but_exists)} packages")
print(f"3. ตรงกันแล้ว: {len(matched)} packages")
```

---

## Phase 3: ดำเนินการแก้ไข

### กรณี A: โหลดออกจากระบบ (ในระบบมี แต่ของจริงไม่มี)
```sql
-- 3A.1 หา packages ที่ต้องโหลดออก
WITH packages_to_load AS (
  SELECT p.id, p.barcode_id, p.face_sheet_id, p.storage_location
  FROM bonus_face_sheet_packages p
  WHERE p.storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
    AND p.loadlist_id IS NULL
    AND p.barcode_id NOT IN (
      -- รายการ barcode จากไฟล์ Excel
      'BARCODE1', 'BARCODE2', ...
    )
)
SELECT * FROM packages_to_load;

-- 3A.2 สร้าง adjustment loadlist สำหรับโหลดออก
-- หรือใช้ stock adjustment

-- 3A.3 อัพเดท packages status
UPDATE bonus_face_sheet_packages
SET 
  status = 'shipped',
  loadlist_id = :adjustment_loadlist_id,
  updated_at = NOW()
WHERE id IN (SELECT id FROM packages_to_load);

-- 3A.4 สร้าง Ledger entries (stock out)
INSERT INTO wms_inventory_ledger (
  product_id,
  from_location_id,
  quantity,
  piece_qty,
  transaction_type,
  reference_type,
  reference_id,
  notes,
  created_by,
  created_at
)
SELECT 
  prod.product_id,
  loc.location_id,
  -i.quantity,
  -i.quantity,
  'adjust_out',
  'stock_reconciliation',
  p.id,
  'ปรับสต็อกตามการนับจริง - ไม่พบของ',
  :user_id,
  NOW()
FROM bonus_face_sheet_packages p
JOIN bonus_face_sheet_items i ON i.package_id = p.id
JOIN master_products prod ON prod.product_code = i.product_code
JOIN master_locations loc ON loc.location_code = p.storage_location
WHERE p.id IN (SELECT id FROM packages_to_load);

-- 3A.5 อัพเดท Inventory Balances
-- (ทำผ่าน trigger หรือ function)
```

### กรณี B: ถอยกลับ (Reverse) - โหลดแล้วแต่ของจริงยังมี
```sql
-- 3B.1 หา packages ที่โหลดแล้วแต่ยังมีของจริง
WITH packages_to_reverse AS (
  SELECT 
    p.id, 
    p.barcode_id, 
    p.face_sheet_id, 
    p.storage_location,
    p.loadlist_id,
    l.loadlist_code
  FROM bonus_face_sheet_packages p
  JOIN loadlists l ON l.id = p.loadlist_id
  WHERE p.storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
    AND p.loadlist_id IS NOT NULL
    AND p.barcode_id IN (
      -- รายการ barcode จากไฟล์ Excel ที่ยังมีอยู่
      'BARCODE1', 'BARCODE2', ...
    )
)
SELECT * FROM packages_to_reverse;

-- 3B.2 ถอย packages กลับ
UPDATE bonus_face_sheet_packages
SET 
  status = 'pending',  -- หรือ status เดิมก่อนโหลด
  loadlist_id = NULL,
  is_mapped = false,
  updated_at = NOW()
WHERE id IN (SELECT id FROM packages_to_reverse);

-- 3B.3 สร้าง Ledger entries (stock in - reverse)
INSERT INTO wms_inventory_ledger (
  product_id,
  to_location_id,
  quantity,
  piece_qty,
  transaction_type,
  reference_type,
  reference_id,
  notes,
  created_by,
  created_at
)
SELECT 
  prod.product_id,
  loc.location_id,
  i.quantity,
  i.quantity,
  'adjust_in',
  'stock_reconciliation_reverse',
  p.id,
  'ปรับสต็อกตามการนับจริง - พบของที่โหลดไปแล้ว',
  :user_id,
  NOW()
FROM bonus_face_sheet_packages p
JOIN bonus_face_sheet_items i ON i.package_id = p.id
JOIN master_products prod ON prod.product_code = i.product_code
JOIN master_locations loc ON loc.location_code = p.storage_location
WHERE p.id IN (SELECT id FROM packages_to_reverse);

-- 3B.4 ลบจาก wms_loadlist_bonus_face_sheets ถ้าจำเป็น
DELETE FROM wms_loadlist_bonus_face_sheets
WHERE bonus_face_sheet_id IN (
  SELECT face_sheet_id FROM packages_to_reverse
)
AND loadlist_id IN (
  SELECT loadlist_id FROM packages_to_reverse
);
```

---

## Phase 4: อัพเดท BFS Status

### 4.1 คำนวณสถานะ BFS ใหม่
```sql
-- อัพเดท BFS status ตามสถานะ packages
WITH bfs_status AS (
  SELECT 
    bfs.id,
    bfs.face_sheet_no,
    COUNT(p.id) as total_packages,
    COUNT(CASE WHEN p.status = 'picked' THEN 1 END) as picked_packages,
    COUNT(CASE WHEN p.status = 'shipped' OR p.loadlist_id IS NOT NULL THEN 1 END) as shipped_packages
  FROM bonus_face_sheets bfs
  LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
  GROUP BY bfs.id, bfs.face_sheet_no
)
UPDATE bonus_face_sheets bfs
SET status = CASE 
  WHEN bs.shipped_packages = bs.total_packages AND bs.total_packages > 0 THEN 'completed'
  WHEN bs.shipped_packages > 0 THEN 'in_progress'
  WHEN bs.picked_packages = bs.total_packages AND bs.total_packages > 0 THEN 'picked'
  WHEN bs.picked_packages > 0 THEN 'in_progress'
  ELSE 'pending'
END,
updated_at = NOW()
FROM bfs_status bs
WHERE bfs.id = bs.id
  AND bfs.id IN (
    SELECT DISTINCT face_sheet_id 
    FROM bonus_face_sheet_packages 
    WHERE storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
  );
```

---

## Phase 5: ตรวจสอบผลลัพธ์

### 5.1 ตรวจสอบ Packages หลังปรับ
```sql
-- ตรวจสอบ packages หลังปรับ
SELECT 
  p.storage_location,
  COUNT(*) as total,
  COUNT(CASE WHEN p.loadlist_id IS NOT NULL THEN 1 END) as loaded,
  COUNT(CASE WHEN p.loadlist_id IS NULL THEN 1 END) as pending
FROM bonus_face_sheet_packages p
WHERE p.storage_location SIMILAR TO '(PQ|MR)[0-9]{1,2}'
GROUP BY p.storage_location
ORDER BY p.storage_location;
```

### 5.2 ตรวจสอบ Inventory Balance
```sql
-- ตรวจสอบ balance หลังปรับ
SELECT 
  l.location_code,
  prod.product_code,
  b.total_piece_qty
FROM wms_inventory_balances b
JOIN master_products prod ON prod.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE l.location_code SIMILAR TO '(PQ|MR)[0-9]{1,2}'
ORDER BY l.location_code, prod.product_code;
```

### 5.3 เปรียบเทียบกับไฟล์ Excel อีกครั้ง
```python
# ตรวจสอบว่าตรงกันแล้ว
# ...
```

---

## Checklist
```
Phase 0: อ่านไฟล์ Excel
□ 0.1 อ่านไฟล์และดูโครงสร้าง
□ 0.2 สรุปข้อมูล (จำนวน, locations, barcodes)

Phase 1: ตรวจสอบระบบ
□ 1.1 ดึง packages จากระบบ
□ 1.2 สรุปจำนวนตาม location
□ 1.3 ดู inventory balance

Phase 2: เปรียบเทียบ
□ 2.1 หารายการที่ต้องโหลดออก
□ 2.2 หารายการที่ต้อง reverse
□ 2.3 หารายการที่ตรงกัน

Phase 3: ดำเนินการ
□ 3A โหลดออก packages ที่ไม่มีของจริง
□ 3B Reverse packages ที่ของจริงยังมี
□ สร้าง Ledger entries ถูกต้อง
□ อัพเดท Inventory Balances

Phase 4: อัพเดท BFS
□ 4.1 คำนวณสถานะ BFS ใหม่
□ 4.2 อัพเดท status

Phase 5: ตรวจสอบ
□ 5.1 ตรวจสอบ packages
□ 5.2 ตรวจสอบ balance
□ 5.3 เปรียบเทียบกับ Excel

Backup
□ Backup ก่อนทุกขั้นตอน
```

---

## Output ที่ต้องการ

### รายงานสรุป
```
=== Stock Reconciliation Report ===
วันที่: ___
ไฟล์อ้างอิง: ของค้างโลเคชั่น.xlsx

1. สรุปข้อมูลจากไฟล์ Excel:
   - จำนวน barcodes: ___
   - Locations: ___

2. สรุปข้อมูลจากระบบ (ก่อนปรับ):
   - จำนวน packages: ___
   - Loaded: ___
   - Pending: ___

3. ผลการเปรียบเทียบ:
   - ต้องโหลดออก: ___ packages
   - ต้อง Reverse: ___ packages
   - ตรงกันแล้ว: ___ packages

4. การดำเนินการ:
   - Loaded out: ___ packages
   - Reversed: ___ packages
   - Ledger entries created: ___

5. สรุปหลังปรับ:
   - Total packages: ___
   - ตรงกับ Excel: ✅/❌
```

---

เริ่มจาก **Phase 0** - อ่านไฟล์ Excel ก่อน!
รายงานผลทุกขั้นตอน!