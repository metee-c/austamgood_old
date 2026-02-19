# Picklist Creation Error - Function Cache Issue

## ปัญหา
เมื่อสร้าง Picklist ที่หน้า http://localhost:3000/receiving/picklists เกิด error:

```
Failed to reserve stock: Could not find the function public.split_balance_on_reservation(
  p_document_code, 
  p_document_id, 
  p_document_type, 
  p_pack_qty_to_reserve, 
  p_picklist_item_id, 
  p_piece_qty_to_reserve, 
  p_source_balance_id
) in the schema cache
```

## สาเหตุ
Supabase มี **schema cache** ที่เก็บ function signatures ไว้ ซึ่งอาจจะยังเป็น signature เก่าที่ไม่ตรงกับ function ที่อัพเดตแล้ว

### Function Signature ที่ถูกต้อง (ตาม Migration 302):
```sql
split_balance_on_reservation(
  p_source_balance_id INTEGER,
  p_piece_qty_to_reserve INTEGER,
  p_pack_qty_to_reserve NUMERIC,
  p_reserved_by_user_id INTEGER,
  p_document_type VARCHAR,
  p_document_id INTEGER,
  p_document_code VARCHAR,
  p_picklist_item_id INTEGER DEFAULT NULL
)
```

### การเรียกใช้ในโค้ด (ถูกต้อง):
```typescript
// app/api/picklists/create-from-trip/route.ts
const { data: splitResult, error: splitError } = await supabase
  .rpc('split_balance_on_reservation', {
    p_source_balance_id: balance.balance_id,
    p_piece_qty_to_reserve: qtyToReserve,
    p_pack_qty_to_reserve: packToReserve,
    p_reserved_by_user_id: user?.id,
    p_document_type: 'picklist',
    p_document_id: picklist.id,
    p_document_code: picklistCode,
    p_picklist_item_id: picklistItem.id
  });
```

## วิธีแก้ไข

### วิธีที่ 1: Supabase CLI (แนะนำ)
```bash
supabase db reset
```

หรือถ้าไม่ต้องการ reset ทั้งหมด:
```bash
supabase migration repair 302
supabase db push
```

### วิธีที่ 2: ใช้ psql โดยตรง
```bash
psql -h <your-supabase-host> -U postgres -d postgres \
  -f supabase/migrations/302_create_split_balance_on_reservation.sql
```

### วิธีที่ 3: Supabase Dashboard (ง่ายที่สุด)
1. เปิด Supabase Dashboard
2. ไปที่ **SQL Editor**
3. เปิดไฟล์ `supabase/migrations/302_create_split_balance_on_reservation.sql`
4. Copy ทั้งหมดแล้ว Paste ใน SQL Editor
5. กด **Run** เพื่อ execute

### วิธีที่ 4: รอให้ Cache หมดอายุ (Supabase Cloud)
ถ้าใช้ Supabase Cloud:
- Cache จะหมดอายุเองใน 5-10 นาที
- ลองสร้าง Picklist อีกครั้งหลังจากรอสักครู่

### วิธีที่ 5: Restart Supabase (Local Development)
ถ้าใช้ Supabase Local:
```bash
supabase stop
supabase start
```

## การตรวจสอบว่าแก้ไขสำเร็จ

### 1. ตรวจสอบ Function Signature
```sql
SELECT 
  proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND proname = 'split_balance_on_reservation';
```

ผลลัพธ์ที่ถูกต้อง:
```
function_name: split_balance_on_reservation
arguments: p_source_balance_id integer, p_piece_qty_to_reserve integer, 
           p_pack_qty_to_reserve numeric, p_reserved_by_user_id integer, 
           p_document_type character varying, p_document_id integer, 
           p_document_code character varying, p_picklist_item_id integer DEFAULT NULL
```

### 2. ทดสอบสร้าง Picklist
1. ไปที่ http://localhost:3000/receiving/picklists
2. คลิก "สร้าง Picklist"
3. เลือก Trip
4. กด "สร้าง"
5. ควรสำเร็จโดยไม่มี error

## Scripts ที่ช่วยแก้ปัญหา

### ตรวจสอบปัญหา:
```bash
node fix-split-balance-function-cache.js
```

### Re-apply Migration (ถ้าจำเป็น):
```bash
node reapply-migration-302.js
```

## ไฟล์ที่เกี่ยวข้อง
- `supabase/migrations/302_create_split_balance_on_reservation.sql` - Migration ที่สร้างฟังก์ชัน
- `app/api/picklists/create-from-trip/route.ts` - ไฟล์ที่เรียกใช้ฟังก์ชัน
- `docs/warehouse/SPLIT_BALANCE_IMPLEMENTATION_COMPLETE.md` - เอกสารการ implement

## หมายเหตุ
- ปัญหานี้เกิดจาก Supabase caching mechanism
- Function signature ต้องตรงกันทั้ง parameter names และ order
- การใช้ named parameters (p_xxx) ช่วยลดปัญหานี้
- ถ้าเจอปัญหาซ้ำ ให้ clear cache ด้วยวิธีข้างต้น

## สถานะ
- ✅ Function มีอยู่ในฐานข้อมูล
- ✅ โค้ดเรียกใช้ถูกต้อง
- ⚠️  Schema cache ยังเป็นเวอร์ชันเก่า
- 🔧 ต้อง refresh cache ด้วยวิธีข้างต้น
