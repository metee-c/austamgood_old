# BUG010: แก้ไขปัญหา Picklist ซ้ำซ้อนใน Loadlists - เสร็จสมบูรณ์

## สรุปการแก้ไข

แก้ไขปัญหา **Picklist เดียวกันถูกแมพกับหลาย loadlists** ซึ่งทำให้ไม่สามารถยืนยันการโหลดได้

## ปัญหาที่พบ

- มี **28 picklists** ที่ถูกแมพกับหลาย loadlists พร้อมกัน
- แบ่งเป็น 2 กลุ่ม:
  1. **17 picklists**: ทั้ง 2 loadlists loaded แล้ว (ไม่มีปัญหาในการใช้งาน)
  2. **11 picklists**: 1 loadlist loaded, 1 loadlist pending (**มีปัญหา** - ไม่สามารถยืนยันการโหลดได้)

### ตัวอย่างปัญหา
- Picklist 292 (PL-20260115-004) อยู่ใน:
  - LD-20260116-0008 (loaded) ✅
  - LD-20260116-0009 (pending) ❌ ไม่สามารถยืนยันได้

## สาเหตุ

1. **ไม่มี Validation**: API `/api/loadlists` ไม่มีการตรวจสอบว่า picklist ถูกใช้ไปแล้วหรือไม่
2. **User สามารถสร้างซ้ำได้**: สามารถสร้าง loadlist จาก trip/picklist เดียวกันได้หลายครั้ง

## การแก้ไข

### 1. Migration 235: ลบข้อมูลที่มีปัญหา

**ไฟล์**: `supabase/migrations/235_fix_duplicate_picklist_in_loadlists.sql`

**สิ่งที่ทำ**:
- ค้นหา loadlist ที่ pending และมี picklist ที่ loaded แล้วโดย loadlist อื่น
- ลบ mapping records (wms_loadlist_picklists, loadlist_face_sheets, wms_loadlist_bonus_face_sheets)
- ลบ loadlist records

**ผลลัพธ์**:
- ลบ loadlist ที่มีปัญหาทั้งหมด
- ไม่มี picklist ที่อยู่ใน loadlist ทั้ง loaded และ pending พร้อมกันอีกแล้ว

### 2. เพิ่ม Validation ใน API

**ไฟล์**: `app/api/loadlists/route.ts`

**Validation ที่เพิ่ม**:

#### A. ตรวจสอบ Picklist ซ้ำ
```typescript
if (hasPicklists) {
  const { data: existingPicklistMappings } = await supabase
    .from('wms_loadlist_picklists')
    .select(`
      picklist_id,
      loadlist_id,
      loadlists!inner(loadlist_code, status)
    `)
    .in('picklist_id', picklist_ids);

  if (existingPicklistMappings && existingPicklistMappings.length > 0) {
    return NextResponse.json({
      error: 'Picklist ถูกแมพกับ loadlist อื่นแล้ว',
      details: 'ไม่สามารถสร้าง loadlist ได้เพราะ picklist ถูกใช้ไปแล้ว',
      existing_mappings: mappedPicklists
    }, { status: 400 });
  }
}
```

#### B. ตรวจสอบ Face Sheet ซ้ำ
```typescript
if (hasFaceSheets) {
  const { data: existingFaceSheetMappings } = await supabase
    .from('loadlist_face_sheets')
    .select(`
      face_sheet_id,
      loadlist_id,
      loadlists!inner(loadlist_code, status)
    `)
    .in('face_sheet_id', face_sheet_ids);

  if (existingFaceSheetMappings && existingFaceSheetMappings.length > 0) {
    return NextResponse.json({
      error: 'Face Sheet ถูกแมพกับ loadlist อื่นแล้ว',
      details: 'ไม่สามารถสร้าง loadlist ได้เพราะ face sheet ถูกใช้ไปแล้ว',
      existing_mappings: mappedFaceSheets
    }, { status: 400 });
  }
}
```

## ผลลัพธ์

### ก่อนแก้ไข
- 28 picklists ซ้ำซ้อน
- 11 loadlists ไม่สามารถยืนยันการโหลดได้
- ไม่มี validation ป้องกัน

### หลังแก้ไข
- ✅ ไม่มี picklist ที่มีปัญหา (pending + loaded) เหลืออยู่
- ✅ เหลือเฉพาะ 17 picklists ที่ทั้ง 2 loadlists loaded แล้ว (ไม่มีปัญหา)
- ✅ มี validation ป้องกันไม่ให้เกิดซ้ำในอนาคต
- ✅ API จะ reject การสร้าง loadlist ถ้า picklist/face sheet ถูกใช้ไปแล้ว

## Verification

### ตรวจสอบว่าไม่มี picklist ที่มีปัญหา
```sql
SELECT 
  lp.picklist_id,
  p.picklist_code,
  COUNT(DISTINCT lp.loadlist_id) as loadlist_count,
  ARRAY_AGG(DISTINCT l.status) as statuses
FROM wms_loadlist_picklists lp
JOIN picklists p ON p.id = lp.picklist_id
JOIN loadlists l ON l.id = lp.loadlist_id
GROUP BY lp.picklist_id, p.picklist_code
HAVING COUNT(DISTINCT lp.loadlist_id) > 1
  AND 'pending' = ANY(ARRAY_AGG(DISTINCT l.status));
```

**ผลลัพธ์**: 0 rows (ไม่มีปัญหา)

### Picklists ที่ยังซ้ำอยู่ (แต่ไม่มีปัญหา)
- 17 picklists ที่ทั้ง 2 loadlists loaded แล้ว
- ไม่กระทบการใช้งาน เพราะโหลดเสร็จทั้งคู่แล้ว

## หมายเหตุสำคัญ

### BFS สามารถอยู่ได้หลาย Loadlist
- **BFS (Bonus Face Sheet)** สามารถแมพกับหลาย picklist/face sheet ได้
- เพราะแต่ละ picklist/face sheet อาจไม่ครบทุกร้านที่อยู่ใน BFS
- นี่เป็น **design ที่ตั้งใจไว้** และไม่ใช่ bug

### Picklist/Face Sheet ไม่ควรซ้ำ
- **Picklist** และ **Face Sheet** ไม่ควรอยู่ในหลาย loadlist พร้อมกัน
- ถ้าซ้ำ = bug ในการสร้าง loadlist
- ตอนนี้มี validation ป้องกันแล้ว

## Related Files

- `supabase/migrations/235_fix_duplicate_picklist_in_loadlists.sql` - Migration แก้ไขข้อมูล
- `app/api/loadlists/route.ts` - เพิ่ม validation
- `app/api/mobile/loading/complete/route.ts` - มี validation อยู่แล้ว (ป้องกันการโหลดซ้ำ)
- `docs/loading/BUG010_DUPLICATE_PICKLIST_IN_LOADLISTS.md` - Analysis document

## สถานะ

- [x] วิเคราะห์ปัญหา
- [x] สร้าง migration แก้ไขข้อมูล
- [x] รัน migration สำเร็จ
- [x] เพิ่ม validation ใน API
- [x] ตรวจสอบยืนยันว่าแก้ไขสำเร็จ
- [x] สร้าง documentation

## สรุป

แก้ไขปัญหา picklist ซ้ำซ้อนเสร็จสมบูรณ์ ตอนนี้:
1. ไม่มี loadlist ที่ไม่สามารถยืนยันการโหลดได้อีกแล้ว
2. มี validation ป้องกันไม่ให้เกิดปัญหาซ้ำในอนาคต
3. ระบบทำงานได้ปกติ
