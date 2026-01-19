# แก้ไขปัญหาหน้าสร้างใบโหลดแสดงใบหยิบเก่า

## สรุปปัญหา
หน้า `/receiving/loadlists` > "สร้างใบโหลดสินค้า" > แท็บ "ใบจัดสินค้า (0)" แสดงใบหยิบเก่าจากวันที่ 2026-01-16 (PL-20260116-003/005/006) แทนที่จะแสดงเฉพาะใบหยิบปัจจุบันจากวันที่ 2026-01-18 (PL-20260118-001/002/003)

## สาเหตุ
API `/api/loadlists/available-picklists` ใช้เงื่อนไขในการกรอง:
1. ✅ `status = 'completed'` - ใบหยิบที่จัดเสร็จแล้ว
2. ✅ `NOT IN wms_loadlist_picklists` - ยังไม่ได้เพิ่มเข้า loadlist

แต่ **ไม่ได้เช็ค** ว่าใบหยิบนั้นมี **active reservations ที่ Dispatch** หรือไม่

**ผลลัพธ์**: ใบหยิบเก่า (PL-20260116-003/005/006) ที่ reservations ถูก released แล้ว (migration 240) ยังคงแสดงอยู่ เพราะมัน:
- ✅ `status = 'completed'`
- ✅ ไม่อยู่ใน loadlist
- ❌ แต่ไม่มี reservations ที่ Dispatch แล้ว (ถูก released)

## การแก้ไข

### 1. เพิ่ม Query picklist_items และ reservations
**ไฟล์**: `app/api/loadlists/available-picklists/route.ts`

เพิ่ม nested query เพื่อดึงข้อมูล `picklist_items` และ `picklist_item_reservations`:

```typescript
const { data: picklists, error, count } = await supabase
  .from('picklists')
  .select(`
    id,
    picklist_code,
    status,
    ...,
    picklist_items (
      id,
      voided_at,
      status,
      picklist_item_reservations (
        reservation_id,
        staging_location_id,
        status
      )
    )
  `)
  .eq('status', 'completed')
  .not('id', 'in', `(${usedPicklistIds.length > 0 ? usedPicklistIds.join(',') : '0'})`)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

### 2. Filter Picklists ที่มี Active Dispatch Reservations
เพิ่ม filter logic หลังจาก query:

```typescript
// ✅ Filter picklists to only include those with active Dispatch reservations
const filteredPicklists = (picklists || []).filter((picklist: any) => {
  // Check if picklist has any items with active Dispatch reservations
  const hasDispatchReservations = (picklist.picklist_items || []).some((item: any) => {
    // Skip voided items
    if (item.voided_at || item.status === 'voided') return false;
    
    // Check if item has active reservation at Dispatch
    const reservations = Array.isArray(item.picklist_item_reservations) 
      ? item.picklist_item_reservations 
      : (item.picklist_item_reservations ? [item.picklist_item_reservations] : []);
    
    return reservations.some((res: any) => 
      res.staging_location_id === 'Dispatch' && res.status === 'picked'
    );
  });
  
  return hasDispatchReservations;
});
```

### 3. ใช้ Filtered Picklists ในการ Transform
เปลี่ยนจาก `picklists` เป็น `filteredPicklists`:

```typescript
// Transform to match expected format (use filtered picklists)
const transformedPicklists = filteredPicklists.map((picklist: any) => {
  // ... transformation logic
});
```

### 4. อัพเดท Pagination Count
ใช้ count จาก filtered picklists:

```typescript
// ✅ PAGINATION: Return with pagination metadata (use filtered count)
const filteredCount = filteredPicklists.length;
const totalPages = Math.ceil(filteredCount / limit);

return NextResponse.json({
  data: transformedPicklists,
  pagination: {
    page,
    limit,
    total: filteredCount,
    totalPages
  }
});
```

## Logic การกรอง

```
Picklist จะแสดงใน available-picklists ก็ต่อเมื่อ:
1. status = 'completed' ✅
2. ไม่อยู่ใน wms_loadlist_picklists ✅
3. มี picklist_items ที่:
   - ไม่ถูก void (voided_at IS NULL AND status != 'voided')
   - มี picklist_item_reservations ที่:
     - staging_location_id = 'Dispatch'
     - status = 'picked'
```

## ผลลัพธ์

### ใบหยิบเก่า (PL-20260116-003/005/006)
❌ **จะไม่แสดง** เพราะ:
- ✅ status = 'completed'
- ✅ ไม่อยู่ใน loadlist
- ❌ **ไม่มี reservations ที่ Dispatch** (ถูก released ใน migration 240)

### ใบหยิบใหม่ (PL-20260118-001/002/003)
✅ **จะแสดง** เพราะ:
- ✅ status = 'completed'
- ✅ ไม่อยู่ใน loadlist
- ✅ **มี reservations ที่ Dispatch** (ถูกตั้งค่าใน migration 239)

## Migrations ที่เกี่ยวข้อง
- **Migration 239**: อัพเดท reservations ของใบหยิบใหม่ให้มี `staging_location_id='Dispatch'`
- **Migration 240**: Release reservations ของใบหยิบเก่า (เปลี่ยน status เป็น 'released')

## ไฟล์ที่แก้ไข
- `app/api/loadlists/available-picklists/route.ts` - เพิ่ม filter logic สำหรับ Dispatch reservations
- `scripts/test-available-picklists-api.js` - สร้าง test script เพื่อ verify API

## การทดสอบ
```bash
# Test API endpoint
node scripts/test-available-picklists-api.js
```

**Expected Result**:
- แสดงเฉพาะ 3 ใบหยิบใหม่: PL-20260118-001, PL-20260118-002, PL-20260118-003
- ไม่แสดงใบหยิบเก่า: PL-20260116-003, PL-20260116-005, PL-20260116-006

## เปรียบเทียบกับ API อื่น

### `/api/warehouse/prepared-documents` (แท็บ "จัดสินค้าเสร็จ (PK,FS)")
- Query: `picklists` ที่ `status='completed'`
- Filter: มี items กับ reservations ที่ `staging_location_id='Dispatch'` AND `status='picked'`
- เช็ค loadlist: ข้ามถ้าอยู่ใน loadlist ที่ `status='loaded'` หรือ `'voided'`

### `/api/loadlists/available-picklists` (หน้าสร้างใบโหลด)
- Query: `picklists` ที่ `status='completed'` AND `NOT IN wms_loadlist_picklists`
- Filter: มี items กับ reservations ที่ `staging_location_id='Dispatch'` AND `status='picked'`
- เช็ค loadlist: ไม่อยู่ใน `wms_loadlist_picklists` เลย

**ความแตกต่าง**: 
- `prepared-documents` แสดงใบหยิบที่อยู่ใน loadlist ที่ยังไม่ loaded/voided
- `available-picklists` แสดงเฉพาะใบหยิบที่ยังไม่ได้เพิ่มเข้า loadlist เลย

## สถานะ
✅ **แก้ไขเสร็จสิ้น** - API กรองใบหยิบตาม Dispatch reservations แล้ว
⏳ **รอทดสอบ** - ต้องรัน dev server และทดสอบผ่าน browser

---
**วันที่**: 2026-01-19
**ผู้แก้ไข**: Kiro AI Assistant
