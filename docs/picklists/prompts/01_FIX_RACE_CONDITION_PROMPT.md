# 🔧 Prompt #1: Fix Race Condition with Row-Level Locking

## 📋 Task Overview
แก้ไข Race Condition ในการจองสต็อกโดยเพิ่ม Row-Level Locking (`FOR UPDATE`) ในทุก function ที่เกี่ยวข้องกับการจองสต็อก

---

## 🎯 Instructions for AI

### Step 1: Locate Files to Modify
ใช้ MCP tools ค้นหาและอ่านไฟล์เหล่านี้:

```
1. supabase/migrations/ - หาไฟล์ที่มี function:
   - reserve_stock_for_face_sheet_items
   - reserve_stock_for_bonus_face_sheet_items
   - reserve_stock_for_picklist_items

2. app/api/picklists/create-from-trip/route.ts
3. app/api/face-sheets/generate/route.ts
4. app/api/bonus-face-sheets/route.ts
```

### Step 2: Identify Bug Pattern
หา pattern นี้ในทุก reservation function:

```sql
-- ❌ BUG: ไม่มี row lock
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
AND sku_id = p_sku_id
AND total_piece_qty > reserved_piece_qty
ORDER BY expiry_date ASC, production_date ASC;
```

### Step 3: Apply Fix
เปลี่ยนเป็น:

```sql
-- ✅ FIX: เพิ่ม FOR UPDATE เพื่อ lock rows
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
AND sku_id = p_sku_id
AND total_piece_qty > reserved_piece_qty
ORDER BY expiry_date ASC, production_date ASC
FOR UPDATE OF wms_inventory_balances;  -- CRITICAL: Lock rows
```

### Step 4: Create Migration File
สร้าง `supabase/migrations/220_add_row_locking_to_reservations.sql`

### Step 5: Verify Changes
หลังแก้ไขให้ตรวจสอบ:

1. **Function signature ไม่เปลี่ยน** - Input/Output เหมือนเดิม
2. **มี FOR UPDATE ในทุก SELECT** ที่อ่าน stock เพื่อจอง
3. **FEFO/FIFO ordering ยังคงอยู่** - ORDER BY expiry_date, production_date
4. **Test กับ concurrent requests** - ดู Test Cases

---

## 📝 Checklist Before Commit

- [ ] ค้นหา function ที่ต้องแก้ทั้งหมด
- [ ] เพิ่ม `FOR UPDATE` ในทุก SELECT ที่อ่าน inventory_balances
- [ ] สร้าง migration file ใหม่
- [ ] Test ใน local environment
- [ ] Run concurrent test
- [ ] Code review

---

## ⚠️ Important Notes

1. **อย่า** เปลี่ยน logic การคำนวณ - แค่เพิ่ม lock เท่านั้น
2. **อย่า** เปลี่ยน return type ของ function
3. **ต้อง** ใช้ `FOR UPDATE OF table_alias` ถ้ามี JOIN
4. **ต้อง** test กับ concurrent requests ก่อน deploy
