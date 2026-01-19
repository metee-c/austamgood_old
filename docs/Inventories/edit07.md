# การแก้ไข Loading Complete API - ย้ายการอัปเดตสถานะไปหลังหักสต็อค

**วันที่**: 2026-01-19  
**ปัญหา**: Loadlist ถูกอัปเดตสถานะเป็น 'loaded' ก่อนหักสต็อค ถ้าหักสต็อคล้มเหลว loadlist จะติดอยู่ในสถานะ 'loaded' แต่สต็อคยังไม่ถูกหัก

## 🔴 ปัญหาที่พบ

### สถานการณ์
1. ผู้ใช้กดยืนยันโหลดที่หน้า `/mobile/loading/LD-20260120-0001`
2. API ทำงานตามลำดับ:
   - ✅ ปล่อย reservations (เปลี่ยน status เป็น 'loaded')
   - ✅ อัปเดตสถานะ loadlist เป็น 'loaded'
   - ❌ หักสต็อค → **ล้มเหลว** (constraint violation)
3. **ผลลัพธ์**: Loadlist เป็น 'loaded' แต่สต็อคยังไม่ถูกหัก!
4. ผู้ใช้ไม่สามารถยืนยันโหลดซ้ำได้ เพราะ loadlist เป็น 'loaded' แล้ว

### Root Cause
API อัปเดตสถานะ loadlist **ก่อน** หักสต็อค:

```typescript
// ❌ ลำดับเดิม (ผิด)
1. ปล่อย reservations
2. อัปเดตสถานะ loadlist เป็น 'loaded' ← ทำก่อน!
3. หักสต็อค ← ถ้าล้มเหลว loadlist ติดอยู่ใน 'loaded'
```

## ✅ วิธีแก้ไข

### ย้ายการอัปเดตสถานะไปหลังหักสต็อค

```typescript
// ✅ ลำดับใหม่ (ถูกต้อง)
1. ปล่อย reservations
2. หักสต็อค ← ทำก่อน!
3. อัปเดตสถานะ loadlist เป็น 'loaded' ← ทำหลัง (เมื่อหักสต็อคสำเร็จแล้ว)
```

### การเปลี่ยนแปลงใน Code

**ก่อนแก้ไข** (บรรทัด ~820):
```typescript
// ❌ อัปเดตสถานะก่อนหักสต็อค
console.log(`🔄 Updating loadlist status to loaded...`);
const { error: updateStatusError } = await supabase
  .from('loadlists')
  .update({ status: 'loaded', updated_at: now })
  .eq('id', loadlist.id);

// ... จากนั้นค่อยหักสต็อค (ถ้าล้มเหลว loadlist ติดอยู่ใน 'loaded')
```

**หลังแก้ไข** (บรรทัด ~1050):
```typescript
// ✅ หักสต็อคก่อน
for (const [key, itemData] of groupedItems) {
  // ... หักสต็อค ...
  itemsProcessed++;
}

// ✅ หักสต็อคสำเร็จแล้ว → ค่อยอัปเดตสถานะ
console.log(`🔄 Updating loadlist status to loaded...`);
const { error: updateStatusError } = await supabase
  .from('loadlists')
  .update({ status: 'loaded', updated_at: now })
  .eq('id', loadlist.id)
  .eq('status', 'pending'); // เช็คว่ายังเป็น pending อยู่

if (updateStatusError) {
  throw new Error(`Failed to update loadlist status`);
}
```

## 🔄 ขั้นตอนการทำงานใหม่

### เดิม (มีปัญหา):
1. ปล่อย reservations ✅
2. **อัปเดตสถานะ loadlist เป็น 'loaded'** ✅
3. หักสต็อค ❌ → **ล้มเหลว แต่ loadlist เป็น 'loaded' แล้ว!**

### ใหม่ (แก้ไขแล้ว):
1. ปล่อย reservations ✅
2. หักสต็อค ✅ → **สำเร็จ**
3. **อัปเดตสถานะ loadlist เป็น 'loaded'** ✅

ถ้าหักสต็อคล้มเหลว:
- Loadlist ยังคงเป็น 'pending' ✅
- Reservations ถูกปล่อยแล้ว (status='loaded')
- ผู้ใช้สามารถลองยืนยันโหลดใหม่ได้ ✅

## 📁 ไฟล์ที่เกี่ยวข้อง

- `app/api/mobile/loading/complete/route.ts` - ย้ายการอัปเดตสถานะจากบรรทัด ~820 ไปบรรทัด ~1050

## 🎯 สรุป

**ปัญหา**: อัปเดตสถานะ loadlist ก่อนหักสต็อค ทำให้ถ้าหักสต็อคล้มเหลว loadlist จะติดอยู่ในสถานะ 'loaded'

**วิธีแก้**: ย้ายการอัปเดตสถานะไปหลังหักสต็อคสำเร็จ

**ผลลัพธ์**: ถ้าหักสต็อคล้มเหลว loadlist จะยังคงเป็น 'pending' และผู้ใช้สามารถลองใหม่ได้ ✅
