# Fix: Duplicate Stock on Receive Edit (2025-02-18)

## 🐛 ปัญหา

เมื่อผู้ใช้เข้าไปแก้ไขข้อมูลการรับสินค้า (ที่ไม่ใช่ส่วนสินค้า) และกดบันทึก ระบบจะบันทึก inventory ledger ซ้ำและทำให้สต็อกเพิ่มเป็น 2 เท่า

**ตัวอย่างกรณีที่เกิดปัญหา:**
- มีรายการรับสินค้า GR-202602-0154 ที่มีสถานะ "รับเข้าแล้ว" อยู่แล้ว
- ผู้ใช้เข้าไปแก้ไขข้อมูล เช่น ชื่อผู้ส่ง, หมายเหตุ, วันที่รับ
- กดบันทึก → สต็อกเพิ่มขึ้นเป็น 2 เท่า!

## 🔍 สาเหตุ

ใน API endpoint `/api/receives/[id]` ฟังก์ชัน `PATCH`:

```typescript
// โค้ดเดิม (มีปัญหา)
if (updateData.status === 'รับเข้าแล้ว' && data) {
  const invResult = await receiveService.createInventoryFromReceiveItems(
    id,
    data.warehouse_id,
    data.receive_no
  );
}
```

การเช็คนี้จะทำงานทุกครั้งที่ `status === 'รับเข้าแล้ว'` **แม้ว่า status จะเป็น 'รับเข้าแล้ว' อยู่แล้วตั้งแต่เดิม**

เมื่อผู้ใช้แก้ไขข้อมูลอื่นๆ:
1. Form ส่ง `status: 'รับเข้าแล้ว'` (ค่าเดิม) มาด้วยใน payload
2. API เช็คเจอว่า `status === 'รับเข้าแล้ว'`
3. เรียก `createInventoryFromReceiveItems()` **ซ้ำอีกครั้ง**
4. สร้าง ledger entries ใหม่ → สต็อกเพิ่มเป็น 2 เท่า!

## ✅ วิธีแก้ไข

เพิ่มการตรวจสอบว่า **status เปลี่ยนจากค่าเดิมหรือไม่**:

```typescript
// Get current receive data to check if status is changing
const { data: currentReceive, error: fetchError } = await receiveService.getReceiveById(id);
if (fetchError || !currentReceive) {
  apiLog.failure(txId, 'STOCK_RECEIVE_UPDATE', new Error('Failed to fetch current receive data'));
  return NextResponse.json(
    { data: null, error: 'Failed to fetch current receive data' },
    { status: 500 }
  );
}

const { data, error } = await receiveService.updateReceive(id, updateData);

// ... error handling ...

// CRITICAL FIX: Only create inventory entries when status CHANGES FROM another status TO 'รับเข้าแล้ว'
// This prevents duplicate inventory entries when editing other fields while status is already 'รับเข้าแล้ว'
const statusChanged = currentReceive.status !== updateData.status;
if (statusChanged && updateData.status === 'รับเข้าแล้ว' && data) {
  const invResult = await receiveService.createInventoryFromReceiveItems(
    id,
    data.warehouse_id,
    data.receive_no
  );
  // ... rest of the logic
}
```

## 📝 การเปลี่ยนแปลง

**ไฟล์ที่แก้ไข:**
- `app/api/receives/[id]/route.ts` - ฟังก์ชัน `PATCH`

**Logic ใหม่:**
1. Query ข้อมูล receive เดิมก่อน update → ได้ `currentReceive`
2. Check ว่า `status` เปลี่ยนหรือไม่: `statusChanged = currentReceive.status !== updateData.status`
3. **สร้าง inventory ledger เฉพาะเมื่อ:**
   - `statusChanged === true` (status เปลี่ยนจากเดิม) **AND**
   - `updateData.status === 'รับเข้าแล้ว'` (status ใหม่เป็น 'รับเข้าแล้ว') **AND**
   - `data` มีค่า

## ✅ ผลลัพธ์หลังแก้ไข

| สถานการณ์ | Status เดิม | Status ใหม่ | สร้าง Ledger? |
|-----------|------------|------------|---------------|
| แก้ไขข้อมูลทั่วไป | รับเข้าแล้ว | รับเข้าแล้ว | ❌ ไม่สร้าง (statusChanged = false) |
| เปลี่ยน status | รอรับเข้า | รับเข้าแล้ว | ✅ สร้าง (statusChanged = true) |
| เปลี่ยน status | รับเข้าแล้ว | สำเร็จ | ❌ ไม่สร้าง (status ไม่ใช่ 'รับเข้าแล้ว') |
| เปลี่ยน status | สำเร็จ | รับเข้าแล้ว | ✅ สร้าง (statusChanged = true) |

## 🧪 วิธีทดสอบ

### Test Case 1: แก้ไขข้อมูลทั่วไป (ไม่แก้สินค้า)
1. สร้างรายการรับสินค้าใหม่ สถานะ "รับเข้าแล้ว"
2. ตรวจสอบสต็อกใน `wms_inventory_balances` และ `wms_inventory_ledger`
3. แก้ไขข้อมูล เช่น:
   - เปลี่ยนชื่อผู้ส่ง
   - เปลี่ยนหมายเหตุ
   - เปลี่ยนวันที่รับ
4. **คงสถานะเป็น "รับเข้าแล้ว"** (ไม่เปลี่ยน status)
5. กดบันทึก
6. ✅ **ผ่าน:** สต็อกไม่เปลี่ยนแปลง (ไม่มี ledger ใหม่)
7. ❌ **ไม่ผ่าน:** สต็อกเพิ่มเป็น 2 เท่า (มี ledger ซ้ำ)

### Test Case 2: เปลี่ยนสถานะจาก "รอรับเข้า" → "รับเข้าแล้ว"
1. สร้างรายการรับสินค้าใหม่ สถานะ "รอรับเข้า"
2. ตรวจสอบสต็อก (ควรยังไม่มี)
3. แก้ไขและเปลี่ยนสถานะเป็น "รับเข้าแล้ว"
4. กดบันทึก
5. ✅ **ผ่าน:** สต็อกเพิ่มขึ้นตามจำนวนที่รับ (มี ledger ใหม่)

### Test Case 3: เปลี่ยนสถานะจาก "รับเข้าแล้ว" → "สำเร็จ"
1. มีรายการสถานะ "รับเข้าแล้ว" ที่มีสต็อกแล้ว
2. ตรวจสอบสต็อก
3. เปลี่ยนสถานะเป็น "สำเร็จ"
4. กดบันทึก
5. ✅ **ผ่าน:** สต็อกไม่เปลี่ยนแปลง (ไม่มี ledger ใหม่)

## 🔒 Verification Queries

```sql
-- ตรวจสอบ ledger entries สำหรับ receive ที่แก้ไข
SELECT
  il.ledger_id,
  il.receive_id,
  il.transaction_type,
  il.piece_qty_change,
  il.created_at,
  r.receive_no,
  r.status
FROM wms_inventory_ledger il
JOIN wms_receives r ON il.receive_id = r.receive_id
WHERE r.receive_no = 'GR-202602-0154'
ORDER BY il.created_at DESC;

-- ตรวจสอบว่ามี receive_id ไหนที่มี ledger ซ้ำ
SELECT
  receive_id,
  COUNT(*) as ledger_count,
  SUM(piece_qty_change) as total_qty
FROM wms_inventory_ledger
WHERE reference_doc_type = 'receive'
GROUP BY receive_id
HAVING COUNT(*) > (
  SELECT COUNT(*)
  FROM wms_receive_items
  WHERE receive_id = wms_inventory_ledger.receive_id
);
```

## 📚 Related Files
- `app/api/receives/[id]/route.ts` - API endpoint (แก้ไขแล้ว)
- `components/forms/AddReceiveForm.tsx` - Form component
- `lib/database/receive.ts` - Database service

## ⚠️ Important Notes

1. **ไม่ควร** ลบ ledger entries ที่ซ้ำออกโดยตรง เพราะอาจกระทบกับ balance
2. ถ้ามี ledger ซ้ำอยู่แล้ว ให้ใช้ stock adjustment เพื่อปรับยอดให้ถูกต้อง
3. Fix นี้ป้องกันปัญหาใหม่ แต่ไม่ได้แก้ไขข้อมูลเก่าที่ซ้ำอยู่แล้ว

## ✅ Build Status
- TypeScript: ✅ Pass
- Production Build: ✅ Compiled successfully in 12.1s
- Date: 2025-02-18 14:01
