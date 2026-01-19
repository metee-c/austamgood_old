# แก้ไขปัญหาแท็บ "จัดสินค้าเสร็จ (PK,FS)" แสดงใบหยิบเก่า

## สรุปปัญหา
แท็บ "จัดสินค้าเสร็จ (PK,FS)" ที่หน้า `/warehouse/preparation-area-inventory` แสดงใบหยิบเก่าจากวันที่ 2026-01-16 (PL-20260116-003/005/006) แทนที่จะแสดงเฉพาะใบหยิบปัจจุบันจากวันที่ 2026-01-18 (PL-20260118-001/002/003)

## สาเหตุ
1. **API Query ผิดพลาด**: API `/api/warehouse/prepared-documents` เคยใช้ `!inner` join กับ `picklist_item_reservations` แต่ query structure ไม่ถูกต้อง
2. **Data Structure Mismatch**: การเปลี่ยน query จาก `picklists` เป็น `picklist_items` ทำให้ data structure เปลี่ยน แต่โค้ดที่ process data ยังไม่ได้ update
3. **Error "picklists is not defined"**: เกิดจากการพยายามเข้าถึง variable `picklists` ที่ไม่มีอยู่ใน scope

## การแก้ไข

### 1. แก้ไข API Query Structure
**ไฟล์**: `app/api/warehouse/prepared-documents/route.ts`

**เปลี่ยนจาก**: Query `picklist_items` ด้วย `!inner` join
```typescript
const { data: picklistReservations, error: picklistError } = await supabase
  .from('picklist_items')
  .select(`
    ...,
    picklist_item_reservations!inner (...)
  `)
  .eq('picklist_item_reservations.staging_location_id', 'Dispatch')
```

**เป็น**: Query `picklists` โดยตรงและ filter ใน JavaScript
```typescript
const { data: picklists, error: picklistError } = await supabase
  .from('picklists')
  .select(`
    id,
    picklist_code,
    status,
    ...,
    picklist_items (
      id,
      sku_id,
      ...,
      picklist_item_reservations (
        reservation_id,
        staging_location_id,
        status,
        reserved_piece_qty
      )
    )
  `)
  .eq('status', 'completed')
  .order('created_at', { ascending: false });
```

### 2. แก้ไข Data Processing Logic
**เปลี่ยนจาก**: Group picklist items by picklist_id
```typescript
const picklistMap = new Map<number, any>();
for (const item of picklistReservations) {
  const picklist = Array.isArray(item.picklists) ? item.picklists[0] : item.picklists;
  // ...
}
```

**เป็น**: Loop through picklists และ filter items
```typescript
for (const pl of picklists) {
  // Filter items that have active reservations at Dispatch
  const picklistItems = (pl.picklist_items || []).filter(item => {
    if (item.voided_at || item.status === 'voided') return false;
    
    const reservations = Array.isArray(item.picklist_item_reservations) 
      ? item.picklist_item_reservations 
      : [item.picklist_item_reservations];
    
    return reservations.some(res => 
      res.staging_location_id === 'Dispatch' && res.status === 'picked'
    );
  });
  // ...
}
```

### 3. แก้ไข TypeScript Error
**ปัญหา**: `loadlistData?.loadlists` อาจเป็น array ทำให้ไม่สามารถเข้าถึง properties ได้โดยตรง

**แก้ไข**:
```typescript
const loadlistData = pl.wms_loadlist_picklists?.[0];
const loadlist = Array.isArray(loadlistData?.loadlists) 
  ? loadlistData.loadlists[0] 
  : loadlistData?.loadlists;
const loadlistCode = loadlist?.loadlist_code;
const loadlistStatus = loadlist?.status;
```

## ผลลัพธ์
✅ API จะ query picklists ที่ `status='completed'` ทั้งหมด
✅ Filter เฉพาะ picklists ที่มี items กับ reservations ที่ `staging_location_id='Dispatch'` และ `status='picked'`
✅ ใบหยิบเก่า (PL-20260116-003/005/006) จะไม่แสดงเพราะ reservations ถูก released แล้ว (migration 240)
✅ ใบหยิบใหม่ (PL-20260118-001/002/003) จะแสดงเพราะมี reservations ที่ Dispatch (migration 239)
✅ ไม่มี TypeScript errors

## Migrations ที่เกี่ยวข้อง
- **Migration 239**: อัพเดท reservations ของใบหยิบใหม่ให้มี `staging_location_id='Dispatch'`
- **Migration 240**: Release reservations ของใบหยิบเก่า (เปลี่ยน status เป็น 'released')

## ไฟล์ที่แก้ไข
- `app/api/warehouse/prepared-documents/route.ts` - แก้ไข query และ data processing logic
- `scripts/test-prepared-documents-api.js` - สร้าง test script เพื่อ verify API

## การทดสอบ
```bash
# Test API endpoint
node scripts/test-prepared-documents-api.js
```

**Expected Result**:
- แสดงเฉพาะ 3 ใบหยิบใหม่: PL-20260118-001, PL-20260118-002, PL-20260118-003
- ไม่แสดงใบหยิบเก่า: PL-20260116-003, PL-20260116-005, PL-20260116-006

## สถานะ
✅ **แก้ไขเสร็จสิ้น** - API query และ data processing logic ถูกต้องแล้ว
⏳ **รอทดสอบ** - ต้องรัน dev server และทดสอบผ่าน browser

---
**วันที่**: 2026-01-19
**ผู้แก้ไข**: Kiro AI Assistant
