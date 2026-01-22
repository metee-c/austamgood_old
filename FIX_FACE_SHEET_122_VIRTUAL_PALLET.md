# Fix Face Sheet 122 - Virtual Pallet Priority Issue

## 🔍 Problem Analysis

### Issue
Face Sheet 122 ไม่สามารถหยิบสินค้าได้ เพราะ:
- Item 11976 (SKU: B-NET-C|FNC|040) ต้องการ 4 ชิ้น
- Reservation 4704 จองจาก balance 34698 (pallet: ATG20260113000000042)
- **Balance 34698 มีสต็อค 0** - เป็นพาเลทจริงจาก replenishment ที่หมดสต็อกไปแล้ว
- เมื่อพยายามหยิบ API ตรวจสอบพบว่า `total_piece_qty = 0` จึงคืน error "insufficient stock"

### Root Cause
Function `reserve_stock_for_face_sheet_items` (migration 275) จองสต็อคตามลำดับ FEFO/FIFO จากพาเลทจริงก่อน:
```sql
-- Migration 275: จองจากพาเลทจริงก่อน (WRONG for Face Sheets)
FOR v_balance IN
    SELECT ...
    FROM wms_inventory_balances
    WHERE sku_id = v_item.sku_id
    AND (total_piece_qty - reserved_piece_qty) > 0
    ORDER BY
        COALESCE(expiry_date, '9999-12-31') ASC,  -- FEFO
        COALESCE(production_date, '1900-01-01') ASC,
        created_at ASC
```

เมื่อพาเลทจริงหมดสต็อก (เช่น ถูกหยิบไปแล้ว) reservation จะชี้ไปที่ balance ที่มีสต็อค 0 ทำให้หยิบไม่ได้

## ✅ Solution

### Design Decision
Face Sheet **ควรใช้ Virtual Pallet เท่านั้น** เพราะ:
1. **Virtual Pallet รองรับการติดลบ** - สามารถจองได้แม้สต็อกไม่พอ
2. **Auto Settlement** - เมื่อมีสินค้าเติมเข้า Prep Area, trigger จะ settle Virtual Pallet อัตโนมัติ
3. **Consistent Behavior** - Face Sheet ทุกใบใช้ Virtual Pallet เหมือนกัน ไม่ขึ้นกับว่ามีสต็อกจริงหรือไม่
4. **ใช้บ้านหยิบที่ถูกต้อง** - Virtual Pallet จะสร้างที่ prep area (บ้านหยิบ) ของ SKU นั้นๆ ตาม `sku_preparation_area_mapping`

### Migration 300: Fix reserve_stock_for_face_sheet_items

**เปลี่ยนจาก**: จองพาเลทจริงก่อน → ถ้าไม่พอค่อยสร้าง Virtual Pallet  
**เป็น**: **จอง Virtual Pallet เท่านั้น** (ติดลบได้) **ที่บ้านหยิบของ SKU**

```sql
-- Migration 300: ใช้ Virtual Pallet เท่านั้น ที่บ้านหยิบของ SKU
CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(...)
RETURNS TABLE(...)
LANGUAGE plpgsql
AS $
DECLARE
    v_virtual_pallet_id VARCHAR;
    v_virtual_balance_id BIGINT;
    v_prep_area_location VARCHAR;
BEGIN
    FOR v_item IN SELECT ... FROM face_sheet_items ...
    LOOP
        -- ✅ หา prep area (บ้านหยิบ) จาก sku_preparation_area_mapping
        SELECT pa.area_code INTO v_prep_area_location
        FROM sku_preparation_area_mapping spam
        JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
        WHERE spam.sku_id = v_item.sku_id
        AND spam.warehouse_id = p_warehouse_id
        AND pa.status = 'active'
        ORDER BY spam.is_primary DESC, spam.priority ASC
        LIMIT 1;
        
        -- ถ้าไม่เจอ mapping ให้ใช้ PK001 เป็น default
        IF v_prep_area_location IS NULL THEN
            v_prep_area_location := 'PK001';
        END IF;
        
        -- Generate Virtual Pallet ID
        v_virtual_pallet_id := 'VIRTUAL-' || v_item.sku_id;
        
        -- Check if Virtual Pallet exists
        SELECT balance_id INTO v_existing_balance
        FROM wms_inventory_balances
        WHERE pallet_id = v_virtual_pallet_id
        AND location_id = v_prep_area_location
        FOR UPDATE;
        
        IF v_existing_balance.balance_id IS NOT NULL THEN
            -- Update existing Virtual Pallet (can go negative)
            UPDATE wms_inventory_balances
            SET total_piece_qty = total_piece_qty - v_qty_to_reserve,
                reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve
            WHERE balance_id = v_existing_balance.balance_id;
        ELSE
            -- Create new Virtual Pallet (negative balance)
            INSERT INTO wms_inventory_balances (
                pallet_id, location_id, total_piece_qty, reserved_piece_qty, ...
            ) VALUES (
                v_virtual_pallet_id, v_prep_area_location, -v_qty_to_reserve, v_qty_to_reserve, ...
            );
        END IF;
        
        -- Create reservation for Virtual Pallet
        INSERT INTO face_sheet_item_reservations (...) VALUES (...);
    END LOOP;
END;
$;
```

**สำคัญ**: `hub` ใน `face_sheet_packages` เป็นแค่ข้อมูลปลายทาง (destination) ไม่เกี่ยวกับการจองสต็อก - ระบบจะใช้บ้านหยิบจาก `sku_preparation_area_mapping` แทน

## 📋 Deployment Steps

### Step 1: Apply Migration 300 via Supabase Dashboard

เนื่องจาก Supabase CLI ไม่สามารถใช้ได้ ให้ apply ผ่าน Dashboard:

1. ไปที่ Supabase Dashboard → SQL Editor
2. Copy content จาก `supabase/migrations/300_fix_face_sheet_prioritize_virtual_pallet.sql`
3. Execute SQL
4. ตรวจสอบว่า function ถูก replace สำเร็จ:
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'reserve_stock_for_face_sheet_items';
```

### Step 2: Fix Existing Face Sheet 122

ใช้ SQL โดยตรงใน Supabase Dashboard:

```sql
-- 1. Delete invalid reservations
DELETE FROM face_sheet_item_reservations
WHERE face_sheet_item_id IN (
    SELECT id FROM face_sheet_items WHERE face_sheet_id = 122
)
AND status = 'reserved';

-- 2. Reset item status
UPDATE face_sheet_items
SET status = 'pending'
WHERE face_sheet_id = 122
AND status != 'picked';

-- 3. Re-run reservation function (ใช้ function ใหม่)
SELECT * FROM reserve_stock_for_face_sheet_items(122, 'WH001', 'System');
```

### Step 3: Verify Fix

```sql
-- Check item 11976 reservations
SELECT 
    fsr.reservation_id,
    fsr.balance_id,
    fsr.reserved_piece_qty,
    ib.pallet_id,
    ib.location_id,
    ib.total_piece_qty,
    ib.reserved_piece_qty,
    CASE 
        WHEN ib.pallet_id LIKE 'VIRTUAL-%' THEN 'Virtual Pallet ✅'
        ELSE 'Real Pallet ⚠️'
    END as pallet_type
FROM face_sheet_item_reservations fsr
JOIN wms_inventory_balances ib ON ib.balance_id = fsr.balance_id
WHERE fsr.face_sheet_item_id = 11976
AND fsr.status = 'reserved';
```

Expected output:
```
pallet_id: VIRTUAL-B-NET-C|FNC|040
location_id: PK001 (หรือบ้านหยิบของ SKU นี้)
total_piece_qty: -4 (ติดลบได้)
pallet_type: Virtual Pallet ✅
```

### Step 4: Test Picking

ลองหยิบ item 11976 จาก Face Sheet 122 ผ่าน mobile app หรือ API:
```
POST /api/mobile/face-sheet/scan
{
  "face_sheet_id": 122,
  "item_id": 11976,
  "quantity_picked": 4
}
```

Expected: ✅ Success (Virtual Pallet allows negative balance)

## 📊 Impact Analysis

### Why Virtual Pallet Works
1. **Location**: Virtual Pallet สร้างที่บ้านหยิบ (prep area) ของ SKU จาก `sku_preparation_area_mapping`
2. **Negative Balance**: Virtual Pallet สามารถติดลบได้ (constraint อนุญาตใน migration 209)
3. **Auto Settlement**: เมื่อมีสินค้าเติมเข้าบ้านหยิบ trigger จะ settle Virtual Pallet อัตโนมัติ
4. **Picking**: API `/api/mobile/face-sheet/scan` รองรับ Virtual Pallet แล้ว (ตรวจสอบ `isVirtualPallet`)

### Benefits of Migration 300
1. **No more "insufficient stock" errors** - Virtual Pallet can go negative
2. **Correct location** - ใช้บ้านหยิบจาก mapping ไม่ใช่ hub
3. **Consistent behavior** - All face sheets use same reservation logic
4. **Simpler logic** - No need to check real stock availability

## 🎯 Next Steps

1. ✅ Apply migration 300 via Supabase Dashboard
2. ✅ Fix Face Sheet 122 reservations (run SQL above)
3. ✅ Test picking from Face Sheet 122
4. 🔄 Monitor other face sheets for similar issues

## 📝 Related Files

- `supabase/migrations/300_fix_face_sheet_prioritize_virtual_pallet.sql` - New migration (FIXED)
- `supabase/migrations/275_fix_face_sheet_items_no_updated_at.sql` - Old function (to be replaced)
- `supabase/migrations/209_create_virtual_pallet_system.sql` - Virtual Pallet system
- `app/api/mobile/face-sheet/scan/route.ts` - Picking API (already supports Virtual Pallet)
- `check-face-sheet-122-issue.js` - Diagnostic script

## 🚨 Important Notes

1. **Virtual Pallet Format**: `VIRTUAL-{SKU_ID}` (e.g., `VIRTUAL-B-NET-C|FNC|040`)
2. **Location**: Virtual Pallet ใช้บ้านหยิบจาก `sku_preparation_area_mapping` **ไม่ใช่ hub**
3. **Hub vs Prep Area**: 
   - `hub` ใน `face_sheet_packages` = ปลายทาง (destination) สำหรับใบปะหน้า
   - `prep area` จาก `sku_preparation_area_mapping` = บ้านหยิบ (picking home) สำหรับจองสต็อค
4. **Settlement**: Automatic via trigger `trg_z_settle_virtual_on_replenishment` when stock arrives
5. **Negative Balance**: Allowed for Virtual Pallet (constraint updated in migration 209)

## ✅ Success Criteria

- [ ] Migration 300 applied successfully
- [ ] Face Sheet 122 item 11976 has Virtual Pallet reservation at correct prep area
- [ ] Picking item 11976 succeeds (no "insufficient stock" error)
- [ ] Virtual Pallet balance shows negative value (e.g., -4)
- [ ] All pending items in Face Sheet 122 use Virtual Pallet at their respective prep areas

---

**Status**: Ready for deployment  
**Priority**: High (blocking Face Sheet 122 picking)  
**Estimated Time**: 10 minutes
