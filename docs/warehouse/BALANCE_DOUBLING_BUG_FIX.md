# Balance Doubling Bug Fix

## ปัญหา

เมื่อย้ายสินค้าผ่าน Quick Move API (`/mobile/transfer`) พบว่า balance เพิ่มขึ้นเป็น 2-3 เท่า:
- พาเลทที่รับมา 84 ชิ้น → หลังย้ายกลายเป็น 168 ชิ้น (2 เท่า)
- พาเลทที่รับมา 84 ชิ้น → หลังย้ายกลายเป็น 252 ชิ้น (3 เท่า)

## Root Cause Analysis

### ลำดับการทำงานที่ผิดพลาด

1. **API ย้าย balance โดยตรง**:
   ```typescript
   // app/api/moves/quick-move/route.ts
   await supabase
     .from('wms_inventory_balances')
     .update({ location_id: to_location_id })
     .eq('balance_id', balance.balance_id)
   ```

2. **Trigger สร้าง ledger entries**:
   - Migration 278 สร้าง trigger `sync_move_item_to_ledger()` ที่สร้าง 2 ledger entries:
     - 1 OUT entry (location: Receiving)
     - 1 IN entry (location: B10-04-003)

3. **Trigger sync balance**:
   - Migration 151 มี trigger `sync_inventory_ledger_to_balance()` ที่ทำงานเมื่อมี ledger entry ใหม่:
     - **OUT entry**: หา balance ที่ Receiving → **ไม่เจอ** (เพราะ API ย้ายไปแล้ว) → ไม่ลบอะไร
     - **IN entry**: หา balance ที่ B10-04-003 → **เจอ** → UPDATE เพิ่ม +84 ชิ้น

4. **ผลลัพธ์**: Balance เดิม 84 + 84 = **168 ชิ้น** (เป็น 2 เท่า)

### ทำไมถึงเป็น 3 เท่า?

ถ้ามีการย้ายซ้ำหรือมี ledger entries ซ้ำ (ก่อน Migration 288) จะทำให้ balance เพิ่มขึ้นเป็น 3 เท่า:
- Balance เดิม 84 + 84 (IN ครั้งที่ 1) + 84 (IN ครั้งที่ 2) = **252 ชิ้น**

## การแก้ไข

### 1. แก้ไข Quick Move API (Migration 289)

ลบโค้ดที่ UPDATE balance location โดยตรง ให้ trigger จัดการเอง:

```typescript
// ❌ เดิม: UPDATE balance location โดยตรง
await supabase
  .from('wms_inventory_balances')
  .update({ location_id: to_location_id })
  .eq('balance_id', balance.balance_id)

// ✅ ใหม่: ไม่ต้องทำอะไร ให้ trigger จัดการเอง
// Trigger จะ:
// 1. ลบ balance ที่ from_location (OUT entry)
// 2. เพิ่ม balance ที่ to_location (IN entry)
```

### 2. แก้ไข Balance Sync Trigger (Migration 289)

เพิ่มการลบ balance ที่เหลือ 0:

```sql
-- ✅ ถ้า balance เหลือ 0 ให้ลบทิ้ง
IF v_new_pack_qty = 0 AND v_new_piece_qty = 0 THEN
    DELETE FROM wms_inventory_balances
    WHERE balance_id = v_balance_id;
    
    RAISE NOTICE 'Deleted zero balance %', v_balance_id;
ELSE
    -- Update existing balance
    UPDATE wms_inventory_balances
    SET
        total_pack_qty = v_new_pack_qty,
        total_piece_qty = v_new_piece_qty,
        last_movement_at = NEW.movement_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_balance_id;
END IF;
```

### 3. แก้ไข Balance ที่ผิดพลาด

รันสคริปต์ `fix-all-doubled-balances.js` เพื่อแก้ไข balance ทั้งหมดที่ผิดพลาด:

```bash
node fix-all-doubled-balances.js
```

**ผลลัพธ์**:
- แก้ไข 3 pallets ที่มีปัญหา
- ลดจำนวนชิ้นรวม 252 ชิ้น (จาก 168 → 84 ต่อพาเลท)

## Files Changed

1. **app/api/moves/quick-move/route.ts**
   - ลบโค้ดที่ UPDATE balance location โดยตรง
   - ให้ trigger จัดการ balance อัตโนมัติ

2. **supabase/migrations/289_fix_balance_sync_delete_zero_balance.sql**
   - แก้ไข trigger `sync_inventory_ledger_to_balance()`
   - เพิ่มการลบ balance ที่เหลือ 0

3. **fix-all-doubled-balances.js**
   - สคริปต์แก้ไข balance ที่ผิดพลาดทั้งหมด
   - คำนวณ balance ที่ถูกต้องจาก ledger entries

## Testing

### ก่อนแก้ไข
```
Pallet: ATG20260122000000030
Location: B10-04-003
Balance: 168 pieces (ผิด - เป็น 2 เท่า)
Ledger: 2 entries (1 OUT + 1 IN) ✅
```

### หลังแก้ไข
```
Pallet: ATG20260122000000030
Location: B10-04-003
Balance: 84 pieces (ถูกต้อง) ✅
Ledger: 2 entries (1 OUT + 1 IN) ✅
```

## Related Issues

- **Migration 278**: สร้าง trigger `sync_move_item_to_ledger()`
- **Migration 288**: แก้ไข duplicate ledger entries
- **Migration 289**: แก้ไข balance doubling bug

## Prevention

เพื่อป้องกันปัญหานี้ในอนาคต:

1. **ไม่ควร UPDATE balance โดยตรง** - ให้ trigger จัดการผ่าน ledger entries เสมอ
2. **ตรวจสอบ balance หลังย้าย** - เปรียบเทียบกับ ledger entries
3. **ใช้ transaction** - ให้แน่ใจว่า ledger และ balance sync ทำงานพร้อมกัน

## Date

- **Created**: 2026-01-22
- **Fixed**: 2026-01-22
- **Status**: ✅ Resolved
