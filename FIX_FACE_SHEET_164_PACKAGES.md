# แก้ไขปัญหาใบปะหน้าสร้างแพ็คไม่ครบ (87 → 164 แพ็ค)

## 🔍 สาเหตุของปัญหา

ปัจจุบันระบบสร้าง **1 package ต่อ 1 order_item** แทนที่จะเป็น **1 package ต่อ 1 pack**

### ตัวอย่าง:
- Order Item: 120 ชิ้น, qty_per_pack = 12
- **ที่ถูกต้อง**: 120 ÷ 12 = **10 packages**
- **ที่เกิดขึ้น**: สร้างแค่ **1 package**

### ผลลัพธ์:
- 17 ออเดอร์ มี 87 order_items
- **ที่ถูกต้อง**: ควรได้ **164 packages**
- **ที่เกิดขึ้น**: ได้แค่ **87 packages**

## ✅ วิธีแก้ไข

Migration 263 ได้ถูกสร้างแล้ว แต่**ยังไม่ได้ Apply เข้าฐานข้อมูล**

### วิธีที่ 1: Apply ผ่าน Supabase Dashboard (แนะนำ)

1. **เปิด Supabase Dashboard**
   - ไปที่: https://supabase.com/dashboard
   - เลือก Project ของคุณ
   - ไปที่: **SQL Editor**

2. **Copy SQL Migration**
   - เปิดไฟล์: `supabase/migrations/263_fix_face_sheet_create_packages_per_pack.sql`
   - Copy เนื้อหาทั้งหมด (ประมาณ 300+ บรรทัด)

3. **Paste และ Run**
   - Paste ใน SQL Editor
   - กด **Run** หรือ **Ctrl+Enter**
   - รอจนเห็นข้อความ "Success"

4. **ตรวจสอบว่า Apply สำเร็จ**
   ```bash
   node verify-migration-263.js
   ```

### วิธีที่ 2: Apply ผ่าน Script (ถ้าวิธีที่ 1 ไม่ได้)

```bash
node apply-migration-263.js
```

**หมายเหตุ**: Script อาจไม่ทำงานถ้า Supabase ไม่อนุญาตให้ execute SQL ผ่าน API  
ในกรณีนี้ให้ใช้วิธีที่ 1 แทน

## 🧪 ทดสอบหลัง Apply Migration

### 1. ลบใบปะหน้าทดสอบ (ถ้ามี)

ถ้าคุณมี FS-20260119-001 ที่สร้างไว้แล้ว:

```bash
node rollback-fs-20260119-001.js
```

หรือลบผ่าน UI ที่: http://localhost:3000/receiving/picklists/face-sheets

### 2. สร้างใบปะหน้าใหม่

1. ไปที่: http://localhost:3000/receiving/picklists/face-sheets
2. กดปุ่ม "สร้างใบปะหน้า"
3. เลือก 17 ออเดอร์เดิม
4. กด "สร้าง"

### 3. ตรวจสอบผลลัพธ์

**ที่ถูกต้อง**:
- ✅ Total Packages: **164 แพ็ค**
- ✅ แต่ละ order_item จะถูกแยกเป็นหลาย packages ตามจำนวน packs

**ถ้ายังผิด**:
- ❌ Total Packages: **87 แพ็ค**
- ❌ แสดงว่า Migration 263 ยังไม่ได้ Apply

### 4. ตรวจสอบด้วย Script

```bash
node check-face-sheet-logic.js
```

ควรเห็น:
```
✅ Expected: 164 packs
✅ Actual: 164 packages
✅ MATCH! Face sheet logic is correct
```

## 📋 สิ่งที่ Migration 263 แก้ไข

### Before (ผิด):
```sql
-- สร้าง 1 package ต่อ 1 order_item
INSERT INTO face_sheet_packages (...)
SELECT ... FROM wms_order_items
```

### After (ถูก):
```sql
-- คำนวณจำนวน packs ที่ต้องการ
packs_needed = CEIL(order_qty / qty_per_pack)

-- สร้างหลาย packages ด้วย generate_series
CROSS JOIN LATERAL generate_series(1, packs_needed)

-- ผลลัพธ์: 1 package ต่อ 1 pack
```

## 🔧 Troubleshooting

### ปัญหา: ยังได้ 87 packages อยู่

**สาเหตุ**: Migration 263 ยังไม่ได้ Apply

**วิธีแก้**:
1. ตรวจสอบว่า Apply แล้วหรือยัง:
   ```bash
   node verify-migration-263.js
   ```

2. ถ้ายังไม่ได้ Apply ให้ทำตามวิธีที่ 1 ข้างต้น

### ปัญหา: Cannot execute SQL

**สาเหตุ**: Supabase ไม่อนุญาตให้ execute SQL ผ่าน API

**วิธีแก้**:
- ใช้วิธีที่ 1 (Supabase Dashboard) แทน
- นี่คือวิธีที่แน่นอนที่สุด

### ปัญหา: Face Sheet ถูกยืนยันหยิบแล้ว

**สาเหตุ**: ไม่สามารถลบ Face Sheet ที่ยืนยันหยิบแล้ว

**วิธีแก้**:
1. ใช้ Rollback Script:
   ```bash
   node rollback-fs-20260119-001.js
   ```

2. หรือ Rollback ออเดอร์กลับเป็น draft:
   - ไปที่หน้า Orders
   - เลือก 17 ออเดอร์
   - กด "Rollback to Draft"

## 📊 ข้อมูลเพิ่มเติม

### 17 ออเดอร์ที่ทดสอบ:

| Order No | Customer | Items | Expected Packs |
|----------|----------|-------|----------------|
| IV26011042 | เพ็ทคอมเพล็กซ์ จันทบุรี | 5 | 9 |
| IV26011048 | เพ็ทคอมเพล็กซ์ จันทบุรี | 11 | 18 |
| IV26011039 | ผลส้ม เพ็ทมอลล์ | 4 | 4 |
| ... | ... | ... | ... |
| **TOTAL** | **17 orders** | **87 items** | **164 packs** |

### การคำนวณ Packs:

```javascript
// สำหรับแต่ละ order_item:
packs_needed = Math.ceil(order_qty / qty_per_pack)

// ตัวอย่าง:
// - 120 pieces, qty_per_pack = 12 → 120/12 = 10 packs
// - 125 pieces, qty_per_pack = 12 → 125/12 = 10.42 → 11 packs (ปัดขึ้น)
```

## ✨ สรุป

1. **Apply Migration 263** ผ่าน Supabase Dashboard (วิธีที่แน่นอนที่สุด)
2. **ตรวจสอบ** ด้วย `verify-migration-263.js`
3. **ลบ Face Sheet เก่า** (ถ้ามี)
4. **สร้างใหม่** และควรได้ 164 packages
5. **ยืนยัน** ด้วย `check-face-sheet-logic.js`

---

**หมายเหตุ**: Migration นี้จะแก้ไขเฉพาะการสร้างใบปะหน้าใหม่เท่านั้น  
ใบปะหน้าที่สร้างไว้แล้วจะไม่เปลี่ยนแปลง (ต้องสร้างใหม่)
