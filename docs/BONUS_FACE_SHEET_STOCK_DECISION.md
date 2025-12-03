# 🎯 การตัดสินใจเรื่อง Stock Reservation สำหรับสินค้าของแถม

**วันที่:** 2 ธันวาคม 2025  
**ปัญหา:** สินค้าของแถม (Tester SKU: TT-*) ไม่มีสต็อคในระบบ

---

## 📊 สถานการณ์ปัจจุบัน

### **Orders ประเภท 'special'**
- Order No: PQ25100043, PQ25100088
- SKU: `TT-BEY-C|MNB|0005`, `TT-BEY-C|LAM|0005`, `TT-NET-C|FNC|0005`, etc.
- จำนวน: 20-50 ชิ้นต่อ SKU

### **สต็อคในระบบ (WH001)**
- มีเฉพาะ SKU ปกติ: `B-BEY-C|MNB|010`, `B-NET-C|FHC|010`, etc.
- **ไม่มี** SKU แบบ Tester (TT-*)

### **ผลกระทบ**
- ✅ สร้างใบปะหน้าของแถมได้
- ❌ จองสต็อคไม่ได้ (เพราะไม่มีสต็อค)
- ⚠️ หยิบสินค้าไม่ได้ (เพราะไม่มี reservations)

---

## 🔀 ตัวเลือกการแก้ไข

### **ตัวเลือก 1: ไม่ต้องจองสต็อค (แนะนำ)** ⭐

**เหตุผล:**
- สินค้าของแถมมักไม่ต้องติดตามสต็อคเข้มงวด
- ลดความซับซ้อนของระบบ
- เหมาะกับสินค้าที่มีจำนวนน้อยและแจกฟรี

**การแก้ไข:**

#### 1.1 แก้ไข Trigger ให้ข้ามการจองสต็อค
```sql
-- supabase/migrations/107_skip_reservation_for_tester_skus.sql

-- แก้ไข trigger function ให้ตรวจสอบ SKU ก่อนจอง
CREATE OR REPLACE FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_result RECORD;
  v_has_non_tester_items BOOLEAN;
BEGIN
  RAISE NOTICE '🎯 Trigger activated for bonus face sheet %: status=%', NEW.id, NEW.status;

  -- ตรวจสอบว่ามี items ที่ไม่ใช่ Tester หรือไม่
  SELECT EXISTS (
    SELECT 1 FROM bonus_face_sheet_items
    WHERE face_sheet_id = NEW.id
    AND sku_id NOT LIKE 'TT-%'
    AND quantity_to_pick > 0
  ) INTO v_has_non_tester_items;

  -- ถ้าไม่มี items ที่ต้องจอง (ทั้งหมดเป็น Tester) ให้ข้าม
  IF NOT v_has_non_tester_items THEN
    RAISE NOTICE '⏭️  Skipping stock reservation: All items are Tester SKUs (TT-*)';
    RETURN NEW;
  END IF;

  -- เรียกใช้ function จองสต็อคอัตโนมัติ
  SELECT * INTO v_result
  FROM reserve_stock_for_bonus_face_sheet_items(
    NEW.id,
    NEW.warehouse_id,
    COALESCE(NEW.created_by, 'System')
  );

  IF v_result.success THEN
    RAISE NOTICE '✅ Stock reservation successful: %', v_result.message;
  ELSE
    RAISE WARNING '⚠️  Stock reservation had issues: %', v_result.message;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error in stock reservation: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created IS 
  'Trigger function: จองสต็อคอัตโนมัติเมื่อสร้างใบปะหน้าของแถม (ข้าม Tester SKUs)';
```

#### 1.2 แก้ไข Mobile Pick API ให้ไม่ต้องมี Reservations
```typescript
// app/api/mobile/bonus-face-sheet/scan/route.ts

// เพิ่มการตรวจสอบว่าเป็น Tester SKU หรือไม่
const isTesterSKU = item.sku_id?.startsWith('TT-');

if (isTesterSKU) {
  // สำหรับ Tester: ไม่ต้องจองสต็อค ไม่ต้องย้ายสต็อค
  // แค่อัปเดตสถานะว่าหยิบแล้ว
  await supabase
    .from('bonus_face_sheet_items')
    .update({
      quantity_picked: quantity_picked,
      status: 'picked',
      picked_at: now
    })
    .eq('id', item_id);
    
  return NextResponse.json({
    success: true,
    message: 'บันทึกการหยิบสินค้าของแถมสำเร็จ (Tester - ไม่ต้องจองสต็อค)',
    is_tester: true
  });
}

// สำหรับ SKU ปกติ: ใช้ logic เดิม (มี reservations)
```

**ข้อดี:**
- ✅ ไม่ต้องเพิ่มสต็อค Tester เข้าระบบ
- ✅ ลดความซับซ้อน
- ✅ เหมาะกับสินค้าของแถม

**ข้อเสีย:**
- ❌ ไม่สามารถติดตามสต็อคของแถมได้
- ❌ ไม่รู้ว่ามีสินค้าเหลือหรือไม่

---

### **ตัวเลือก 2: เพิ่มสต็อค Tester เข้าระบบ**

**เหตุผล:**
- ต้องการติดตามสต็อคของแถมอย่างเข้มงวด
- ต้องการรู้ว่ามีสินค้าเหลือเท่าไร
- ต้องการ flow เดียวกันกับสินค้าปกติ

**การแก้ไข:**

#### 2.1 เพิ่ม SKU Tester ใน master_sku
```sql
INSERT INTO master_sku (
  sku_id, 
  sku_name, 
  category, 
  qty_per_pack,
  active_status
) VALUES
('TT-BEY-C|MNB|0005', 'Tester | Buzz Beyond แม่และลูกแมว รสแซลมอน ทูน่า และนม | 50 กรัม', 'Tester', 1, 'active'),
('TT-BEY-C|LAM|0005', 'Tester | Buzz Beyond แมวโต รสแกะ | 50 กรัม', 'Tester', 1, 'active'),
-- ... เพิ่ม SKU อื่นๆ
```

#### 2.2 เพิ่มสต็อคใน wms_inventory_balances
```sql
INSERT INTO wms_inventory_balances (
  warehouse_id,
  location_id,
  sku_id,
  total_piece_qty,
  total_pack_qty,
  reserved_piece_qty,
  reserved_pack_qty
) VALUES
('WH001', 'WH001-02646', 'TT-BEY-C|MNB|0005', 100, 100, 0, 0),
('WH001', 'WH001-02646', 'TT-BEY-C|LAM|0005', 100, 100, 0, 0),
-- ... เพิ่มสต็อคอื่นๆ
```

**ข้อดี:**
- ✅ ติดตามสต็อคได้เต็มรูปแบบ
- ✅ ใช้ flow เดียวกันกับสินค้าปกติ
- ✅ รู้ว่ามีสินค้าเหลือเท่าไร

**ข้อเสีย:**
- ❌ ต้องเพิ่มข้อมูลเข้าระบบ
- ❌ ต้องบำรุงรักษาสต็อค Tester
- ❌ ซับซ้อนกว่า

---

## 🎯 คำแนะนำ

### **แนะนำ: ตัวเลือก 1 (ไม่ต้องจองสต็อค)** ⭐

**เหตุผล:**
1. สินค้าของแถมมักไม่ต้องติดตามสต็อคเข้มงวด
2. ลดความซับซ้อนของระบบ
3. ไม่ต้องเพิ่มข้อมูลสต็อคเข้าระบบ
4. เหมาะกับธุรกิจที่แจกของแถมฟรี

### **ขั้นตอนถัดไป:**
1. ✅ สร้าง Migration 107: แก้ไข trigger ให้ข้าม Tester SKUs
2. ✅ แก้ไข Mobile Pick API ให้รองรับ Tester (ไม่ต้องมี reservations)
3. ✅ ทดสอบ end-to-end
4. ✅ อัปเดตเอกสาร

---

## 📝 สรุป

**ปัญหา:** สินค้าของแถม (Tester) ไม่มีสต็อคในระบบ  
**แนะนำ:** ไม่ต้องจองสต็อค - แก้ไข trigger และ mobile API ให้ข้าม Tester SKUs  
**ผลลัพธ์:** ระบบทำงานได้โดยไม่ต้องเพิ่มสต็อค Tester เข้าระบบ

---

**หมายเหตุ:** ถ้าในอนาคตต้องการติดตามสต็อค Tester สามารถเปลี่ยนเป็นตัวเลือก 2 ได้ทีหลัง
