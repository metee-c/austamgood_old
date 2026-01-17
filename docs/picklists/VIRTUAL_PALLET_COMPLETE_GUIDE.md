# 🎯 Virtual Pallet System - คู่มือฉบับสมบูรณ์

**วันที่:** 2026-01-17  
**สถานะ:** ✅ ทำงานปกติหลัง Migration 220-224

---

## 📋 ภาพรวม

Virtual Pallet System ยังคง**ทำงานเหมือนเดิม 100%** หลังจากแก้ไข race condition ด้วย Migration 220-224

**สิ่งที่เปลี่ยน:** เพิ่ม `FOR UPDATE` เพื่อป้องกัน race condition เท่านั้น  
**สิ่งที่ไม่เปลี่ยน:** Logic การทำงานของ Virtual Pallet ทั้งหมด

---

## 🎯 ใบปะหน้า (Face Sheet) - Virtual Pallet

### สถานการณ์: สต็อกไม่พอ

**ตัวอย่าง:**
- PK001 มีสต็อก SKU001 = 30 ชิ้น
- ต้องการจอง = 50 ชิ้น

### ขั้นตอนการทำงาน

```sql
-- STEP 1: จองจากพาเลทจริงก่อน (FEFO/FIFO)
FOR v_balance IN
    SELECT * FROM wms_inventory_balances
    WHERE sku_id = 'SKU001'
    AND location_id = 'PK001'
    AND pallet_id NOT LIKE 'VIRTUAL-%'
    ORDER BY expiry_date ASC, production_date ASC
    FOR UPDATE  -- ✅ Lock rows (ป้องกัน race condition)
LOOP
    -- จอง 30 ชิ้นจากพาเลทจริง
END LOOP;

-- STEP 2: สต็อกไม่พอ → สร้าง Virtual Pallet
IF v_qty_reserved < v_qty_needed THEN
    v_qty_short := 50 - 30 = 20 ชิ้น;
    
    -- สร้าง Virtual Pallet ID
    v_virtual_pallet_id := 'VIRTUAL-PK001-SKU001';
    
    -- สร้าง balance ติดลบ
    INSERT INTO wms_inventory_balances (
        location_id,
        sku_id,
        pallet_id,
        total_piece_qty,      -- -20 (ติดลบ!)
        reserved_piece_qty,   -- 20 (จองไว้)
        ...
    ) VALUES (
        'PK001',
        'SKU001',
        'VIRTUAL-PK001-SKU001',
        -20,  -- ติดลบ = "เป็นหนี้"
        20,   -- จองไว้
        ...
    );
    
    -- สร้าง reservation
    INSERT INTO face_sheet_item_reservations (
        face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        status
    ) VALUES (
        v_item.item_id,
        v_virtual_balance_id,
        20,
        'reserved'
    );
END IF;
```

**ผลลัพธ์:**
- ✅ ใบปะหน้าสร้างสำเร็จ
- ✅ จอง 30 ชิ้นจากพาเลทจริง
- ✅ จอง 20 ชิ้นจาก Virtual Pallet (ติดลบ)

---

## 🎁 ใบปะหน้าของแถม (Bonus Face Sheet) - Virtual Pallet

### ความแตกต่างจากใบปะหน้าปกติ

| หัวข้อ | ใบปะหน้าปกติ | ใบปะหน้าของแถม |
|--------|--------------|----------------|
| **จองจากที่ไหน** | Floor, Rack, Bulk | **Prep Area เท่านั้น** |
| **FEFO/FIFO** | ใช่ | ใช่ |
| **Virtual Pallet** | ใช่ | **ใช่** |
| **Auto Settle** | ใช่ | **ใช่** |

### สถานการณ์: สต็อกของแถมไม่พอ

**ตัวอย่าง:**
- PK001 (Prep Area) มีสต็อก SKU-BONUS = 15 ชิ้น
- ต้องการจอง = 25 ชิ้น

### ขั้นตอนการทำงาน

```sql
-- STEP 1: จองจากพาเลทจริงใน Prep Area ก่อน
FOR v_balance IN
    SELECT * FROM wms_inventory_balances ib
    JOIN master_location ml ON ml.location_id = ib.location_id
    WHERE ib.sku_id = 'SKU-BONUS'
    AND ib.pallet_id NOT LIKE 'VIRTUAL-%'
    AND ml.location_type IN ('floor', 'rack', 'bulk')  -- Prep Area
    AND ib.location_id IN (
        -- เฉพาะ location ที่เป็น Prep Area
        SELECT area_code FROM preparation_area WHERE status = 'active'
    )
    ORDER BY 
        ib.expiry_date ASC NULLS LAST,
        ib.production_date ASC NULLS LAST
    FOR UPDATE  -- ✅ Lock rows
LOOP
    -- จอง 15 ชิ้นจากพาเลทจริง
END LOOP;

-- STEP 2: สต็อกไม่พอ → สร้าง Virtual Pallet
IF v_qty_reserved < v_qty_needed THEN
    v_qty_short := 25 - 15 = 10 ชิ้น;
    
    -- หา Prep Area location สำหรับ SKU นี้
    SELECT pa.area_code INTO v_prep_area_location
    FROM sku_preparation_area_mapping spam
    JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
    WHERE spam.sku_id = 'SKU-BONUS'
    AND spam.warehouse_id = 'WH001'
    AND pa.status = 'active'
    ORDER BY spam.priority ASC
    LIMIT 1;
    
    -- ถ้าไม่เจอ mapping ใช้ PK001 เป็น default
    IF v_prep_area_location IS NULL THEN
        v_prep_area_location := 'PK001';
    END IF;
    
    -- สร้าง Virtual Pallet ID
    v_virtual_pallet_id := 'VIRTUAL-PK001-SKU-BONUS';
    
    -- สร้าง balance ติดลบ
    v_virtual_balance_id := create_or_update_virtual_balance(
        'PK001',           -- location (Prep Area)
        'SKU-BONUS',       -- sku_id
        'WH001',           -- warehouse
        -10,               -- total_piece_qty (ติดลบ!)
        -0.5,              -- total_pack_qty
        10,                -- reserved_piece_qty
        0.5                -- reserved_pack_qty
    );
    
    -- สร้าง reservation
    INSERT INTO bonus_face_sheet_item_reservations (
        bonus_face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        status
    ) VALUES (
        v_item.item_id,
        v_virtual_balance_id,
        10,
        0.5,
        'reserved'
    );
    
    -- บันทึก Ledger
    INSERT INTO wms_inventory_ledger (
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        piece_qty,
        reference_no,
        remarks
    ) VALUES (
        'VIRTUAL_RESERVE',
        'out',
        'WH001',
        'PK001',
        'SKU-BONUS',
        'VIRTUAL-PK001-SKU-BONUS',
        10,
        'BFS-12345',
        'Virtual Reservation: Bonus Face Sheet, สต็อกไม่พอ 10 ชิ้น'
    );
END IF;
```

**ผลลัพธ์:**
- ✅ ใบปะหน้าของแถมสร้างสำเร็จ
- ✅ จอง 15 ชิ้นจากพาเลทจริงใน Prep Area
- ✅ จอง 10 ชิ้นจาก Virtual Pallet (ติดลบ)

---

## 🔄 Auto Settle - เมื่อเติมสต็อกเข้า Prep Area

### Trigger ทำงานอัตโนมัติ

```sql
-- Trigger: trg_z_settle_virtual_on_replenishment
-- ทำงานเมื่อ: INSERT INTO wms_inventory_ledger (direction = 'in')

CREATE TRIGGER trg_z_settle_virtual_on_replenishment
    AFTER INSERT ON wms_inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION trigger_settle_virtual_on_replenishment();
```

### ตัวอย่าง: เติมสต็อกเข้า PK001

**สมมติ:**
- Virtual Pallet: -20 ชิ้น (ติดลบ)
- เติมพาเลทใหม่: 30 ชิ้น

```sql
-- Trigger จะตรวจสอบ:
-- 1. เป็น Prep Area หรือไม่? → ใช่ (PK001)
-- 2. มี Virtual Pallet ติดลบหรือไม่? → ใช่ (-20)
-- 3. พาเลทที่เติมมีสต็อกพอหรือไม่? → ใช่ (30)

-- Trigger เรียก settle_virtual_pallet()
SELECT * FROM settle_virtual_pallet(
    'PK001',           -- location
    'SKU001',          -- sku
    'WH001',           -- warehouse
    'PLT-NEW-001',     -- พาเลทที่เติมเข้ามา
    balance_id,        -- balance_id ของพาเลทจริง
    30,                -- available_qty
    ledger_id          -- ledger entry ที่เติมเข้ามา
);
```

### Settle Process

```sql
-- 1. หักจากพาเลทจริง
UPDATE wms_inventory_balances
SET 
    total_piece_qty = 30 - 20 = 10,
    updated_at = CURRENT_TIMESTAMP
WHERE pallet_id = 'PLT-NEW-001';

-- 2. เพิ่มให้ Virtual Pallet (คืนหนี้)
UPDATE wms_inventory_balances
SET 
    total_piece_qty = -20 + 20 = 0,  -- คืนหนี้ครบ!
    updated_at = CURRENT_TIMESTAMP
WHERE pallet_id = 'VIRTUAL-PK001-SKU001';

-- 3. บันทึก Ledger (2 entries)
-- Entry 1: หักจากพาเลทจริง
INSERT INTO wms_inventory_ledger (...) VALUES (
    'VIRTUAL_SETTLE', 'out', 'PLT-NEW-001', 20, ...
);

-- Entry 2: เพิ่มให้ Virtual
INSERT INTO wms_inventory_ledger (...) VALUES (
    'VIRTUAL_SETTLE', 'in', 'VIRTUAL-PK001-SKU001', 20, ...
);

-- 4. บันทึก Settlement Record
INSERT INTO virtual_pallet_settlements (...) VALUES (
    'VIRTUAL-PK001-SKU001',
    'PLT-NEW-001',
    20,  -- settled_qty
    -20, -- virtual_balance_before
    0,   -- virtual_balance_after
    ...
);
```

**ผลลัพธ์:**
- ✅ พาเลทจริง: 30 → 10 ชิ้น
- ✅ Virtual Pallet: -20 → 0 ชิ้น (คืนหนี้ครบ!)
- ✅ Reservation ยังคงอยู่ (20 ชิ้น)

---

## 📊 เปรียบเทียบ: ใบปะหน้า vs ใบปะหน้าของแถม

| หัวข้อ | ใบปะหน้า (Face Sheet) | ใบปะหน้าของแถม (Bonus Face Sheet) |
|--------|----------------------|----------------------------------|
| **Function** | `reserve_stock_for_face_sheet_items` | `reserve_stock_for_bonus_face_sheet_items` |
| **จองจากที่ไหน** | Floor, Rack, Bulk | **Prep Area เท่านั้น** |
| **Virtual Pallet** | ✅ รองรับ | ✅ รองรับ |
| **Location** | ทุก location type | **Prep Area only** |
| **FEFO/FIFO** | ✅ ใช่ | ✅ ใช่ |
| **Auto Settle** | ✅ ใช่ | ✅ ใช่ |
| **Reservation Table** | `face_sheet_item_reservations` | `bonus_face_sheet_item_reservations` |
| **Ledger Reference** | `FS-{id}` | `BFS-{id}` |

---

## 🔍 ตรวจสอบ Virtual Pallet

### Query: ดู Virtual Pallet ทั้งหมด

```sql
-- View: v_virtual_pallet_status
SELECT * FROM v_virtual_pallet_status
WHERE status = 'DEFICIT'  -- ติดลบ
ORDER BY deficit_qty DESC;
```

**ผลลัพธ์:**
```
virtual_pallet_id          | location_id | sku_id    | balance_qty | status  | deficit_qty
---------------------------|-------------|-----------|-------------|---------|------------
VIRTUAL-PK001-SKU001       | PK001       | SKU001    | -20         | DEFICIT | 20
VIRTUAL-PK002-SKU-BONUS    | PK002       | SKU-BONUS | -10         | DEFICIT | 10
```

### Query: ดู Settlement History

```sql
-- View: v_virtual_pallet_settlement_history
SELECT * FROM v_virtual_pallet_settlement_history
WHERE settled_at > NOW() - INTERVAL '24 hours'
ORDER BY settled_at DESC;
```

**ผลลัพธ์:**
```
virtual_pallet_id      | source_pallet_id | settled_qty | virtual_balance_before | virtual_balance_after | settled_at
-----------------------|------------------|-------------|------------------------|----------------------|------------
VIRTUAL-PK001-SKU001   | PLT-NEW-001      | 20          | -20                    | 0                    | 2026-01-17 10:30
VIRTUAL-PK002-SKU-BONUS| PLT-NEW-002      | 10          | -10                    | 0                    | 2026-01-17 11:15
```

### Query: สรุป Virtual Pallet แยกตาม Location

```sql
SELECT * FROM get_virtual_pallet_summary('WH001');
```

**ผลลัพธ์:**
```
location_id | total_virtual_pallets | total_deficit_qty | skus_with_deficit
------------|----------------------|-------------------|------------------
PK001       | 3                    | 45                | {SKU001, SKU002, SKU003}
PK002       | 1                    | 10                | {SKU-BONUS}
```

---

## 🎯 สรุป

### ✅ สิ่งที่ยังเหมือนเดิม (Virtual Pallet)

1. ✅ **ติดลบได้** - Virtual Pallet สามารถมี `total_piece_qty < 0`
2. ✅ **Auto Settle** - Trigger ทำงานอัตโนมัติเมื่อเติมสต็อก
3. ✅ **Prep Area Only** - Virtual Pallet สร้างที่ Prep Area เท่านั้น
4. ✅ **FEFO/FIFO** - เรียงตาม expiry_date, production_date
5. ✅ **Ledger Tracking** - บันทึก settlement history ครบถ้วน
6. ✅ **รองรับทั้ง Face Sheet และ Bonus Face Sheet**

### ✅ สิ่งที่เปลี่ยน (Race Condition Fix)

1. ✅ **เพิ่ม `FOR UPDATE`** - Lock rows ระหว่างจอง
2. ✅ **Atomic Transaction** - รวม create + reserve ใน 1 transaction
3. ✅ **ไม่มี Delay** - ลบ `setTimeout(500ms)` ออก

---

## 📝 ตัวอย่างการใช้งานจริง

### Scenario 1: ใบปะหน้าปกติ

```
T0: PK001 มีสต็อก SKU001 = 30 ชิ้น
T1: สร้างใบปะหน้า (ต้องการ 50 ชิ้น)
    → จอง 30 จากพาเลทจริง
    → สร้าง Virtual -20 ชิ้น
T2: เติมพาเลทใหม่ 30 ชิ้น
    → Auto settle 20 ชิ้น
    → Virtual: -20 → 0 ✅
```

### Scenario 2: ใบปะหน้าของแถม

```
T0: PK002 มีสต็อก SKU-BONUS = 15 ชิ้น (Prep Area)
T1: สร้างใบปะหน้าของแถม (ต้องการ 25 ชิ้น)
    → จอง 15 จากพาเลทจริงใน Prep Area
    → สร้าง Virtual -10 ชิ้น
T2: ย้ายสต็อกจาก Bulk เข้า PK002 = 20 ชิ้น
    → Auto settle 10 ชิ้น
    → Virtual: -10 → 0 ✅
```

---

**สรุป:** Virtual Pallet System ทำงาน**เหมือนเดิม 100%** ทั้งสำหรับ **ใบปะหน้าปกติ** และ **ใบปะหน้าของแถม** ครับ! 🎉
