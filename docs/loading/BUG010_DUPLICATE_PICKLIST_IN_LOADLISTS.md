# BUG010: Picklist ซ้ำซ้อนใน Loadlists

## สรุปปัญหา

พบว่ามี **28 picklists** ที่ถูกแมพกับ **หลาย loadlists พร้อมกัน** ซึ่งทำให้:
- Loadlist ที่สร้างทีหลังไม่สามารถยืนยันการโหลดได้ (error: "Picklists already loaded by another loadlist")
- เกิดความสับสนในการติดตาม picklist ว่าถูกโหลดไปแล้วหรือยัง

## ตัวอย่างกรณีที่พบ

### Picklist 292 (PL-20260115-004)
- **Trip**: 838 (TRIP-001, daily_trip_number: 2)
- **Loadlist 1**: LD-20260116-0008
  - สร้างเมื่อ: 2026-01-15 09:15:10
  - สถานะ: loaded
  - โหลดเมื่อ: 2026-01-16 06:51:49
- **Loadlist 2**: LD-20260116-0009
  - สร้างเมื่อ: 2026-01-15 09:18:09 (3 นาทีหลัง loadlist 1)
  - สถานะ: pending
  - ไม่สามารถยืนยันการโหลดได้เพราะ picklist ถูกโหลดไปแล้วโดย LD-20260116-0008

## สาเหตุ

### 1. ไม่มี Validation ป้องกันการสร้าง Loadlist ซ้ำ
API `/api/loadlists` (POST) ไม่มีการตรวจสอบว่า:
- Picklist ถูกแมพกับ loadlist อื่นแล้วหรือไม่
- Trip ถูกใช้สร้าง loadlist ไปแล้วหรือยัง

### 2. User สามารถสร้าง Loadlist จาก Trip เดียวกันได้หลายครั้ง
จากข้อมูล picklist 292:
- ทั้ง 2 loadlists มี `trip_id = 838` เหมือนกัน
- แสดงว่ามีการสร้าง loadlist จาก trip เดียวกัน 2 ครั้ง (ห่างกัน 3 นาที)

## สถิติปัญหา

จาก query ทั้งหมด พบ **28 picklists** ที่ซ้ำซ้อน แบ่งเป็น:

### กลุ่มที่ 1: ทั้ง 2 loadlists loaded แล้ว (17 picklists)
- ไม่มีปัญหาในการใช้งาน (แม้จะซ้ำ แต่โหลดเสร็จทั้งคู่แล้ว)
- Picklists: 257, 258, 260, 261, 262, 264, 265, 268, 270, 271, 272, 273, 274, 275, 276, 287, 288

### กลุ่มที่ 2: 1 loadlist loaded, 1 loadlist pending (11 picklists) ⚠️
- **มีปัญหา**: loadlist ที่ pending ไม่สามารถยืนยันการโหลดได้
- Picklists: 292, 294, 295, 297, 299, 301, 303, 304, 305, 306, 307, 308

## ผลกระทบ

1. **11 loadlists ที่ pending** ไม่สามารถยืนยันการโหลดได้
2. ข้อมูลไม่ถูกต้อง - picklist เดียวกันถูกบันทึกว่าโหลด 2 ครั้ง
3. สต็อคอาจถูกย้ายซ้ำซ้อน (ถ้าไม่มี validation ที่ loading complete API)

## แนวทางแก้ไข

### ระยะสั้น: แก้ไขข้อมูลที่มีอยู่

#### Option 1: ลบ mapping ที่ซ้ำออกจาก loadlist ที่ pending
- ลบ picklist mapping จาก loadlist ที่ pending (11 ใบ)
- ข้อดี: ง่าย รวดเร็ว
- ข้อเสีย: loadlist ที่ pending จะไม่มี picklist (อาจต้องลบ loadlist ทิ้ง)

#### Option 2: ลบ loadlist ที่ pending ทั้งหมด
- ลบ loadlist ที่ pending และ mapping ทั้งหมด
- ข้อดี: ทำความสะอาดข้อมูลได้หมด
- ข้อเสีย: ต้องแน่ใจว่าไม่มี BFS หรือ Face Sheet ที่แมพอยู่

### ระยะยาว: ป้องกันไม่ให้เกิดซ้ำ

#### 1. เพิ่ม Validation ใน API `/api/loadlists` (POST)
```typescript
// ตรวจสอบว่า picklist ถูกแมพกับ loadlist อื่นแล้วหรือไม่
const { data: existingMappings } = await supabase
  .from('wms_loadlist_picklists')
  .select('loadlist_id, loadlists!inner(loadlist_code, status)')
  .in('picklist_id', picklist_ids);

if (existingMappings && existingMappings.length > 0) {
  return NextResponse.json({
    error: 'Picklist ถูกแมพกับ loadlist อื่นแล้ว',
    existing_loadlists: existingMappings
  }, { status: 400 });
}
```

#### 2. เพิ่ม Database Constraint (ถ้าต้องการ strict)
```sql
-- ป้องกันไม่ให้ picklist เดียวกันอยู่ในหลาย loadlist
ALTER TABLE wms_loadlist_picklists
ADD CONSTRAINT unique_picklist_per_loadlist 
UNIQUE (picklist_id);
```
⚠️ **หมายเหตุ**: Constraint นี้จะป้องกันไม่ให้ picklist ซ้ำเลย แต่อาจไม่เหมาะกับ use case ที่ต้องการแก้ไข/ย้าย picklist ระหว่าง loadlist

## ข้อมูลเพิ่มเติม

### Picklists ที่มีปัญหา (11 รายการ)

| Picklist ID | Picklist Code | Loadlist 1 (loaded) | Loadlist 2 (pending) |
|-------------|---------------|---------------------|----------------------|
| 292 | PL-20260115-004 | LD-20260116-0008 | LD-20260116-0009 |
| 294 | PL-20260115-006 | LD-20260116-0006 | LD-20260116-0010 |
| 295 | PL-20260115-007 | LD-20260116-0005 | LD-20260116-0011 |
| 297 | PL-20260115-009 | LD-20260116-0003 | LD-20260116-0012 |
| 299 | PL-20260115-010 | LD-20260116-0013 | LD-20260116-0014 |
| 301 | PL-20260116-001 | LD-20260109-0020 | LD-20260119-0002 |
| 303 | PL-20260116-003 | LD-20260119-0001 | LD-20260119-0004 |
| 304 | PL-20260116-004 | LD-20260116-0018 | LD-20260119-0005 |
| 305 | PL-20260116-005 | LD-20260116-0019 | LD-20260119-0008 |
| 306 | PL-20260116-006 | LD-20260116-0020 | LD-20260119-0007 |
| 307 | PL-20260116-007 | LD-20260116-0021 | LD-20260119-0006 |
| 308 | PL-20260116-008 | LD-20260109-0021 | LD-20260117-0001 |

## สถานะ

- [x] วิเคราะห์ปัญหา
- [ ] ตัดสินใจแนวทางแก้ไข
- [ ] สร้าง migration แก้ไขข้อมูล
- [ ] เพิ่ม validation ใน API
- [ ] ทดสอบ

## Related Files

- `app/api/loadlists/route.ts` - API สร้าง loadlist
- `app/api/mobile/loading/complete/route.ts` - มี validation อยู่แล้ว (ป้องกันการโหลดซ้ำ)
- `docs/loading/BUG008_ANALYSIS.md` - ปัญหาสต็อคไม่พอ (related)
