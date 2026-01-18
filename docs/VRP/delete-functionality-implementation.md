# Delete Functionality Implementation

## Overview
เพิ่มฟีเจอร์ลบ Picklists, Face Sheets และ Bonus Face Sheets พร้อมปลดล็อคยอดจองในบ้านหยิบอัตโนมัติ

## User Restriction
- **เฉพาะผู้ใช้:** `metee.c@buzzpetsfood.com` เท่านั้นที่เห็นและใช้ปุ่มลบได้
- ผู้ใช้อื่นจะไม่เห็นปุ่มลบในหน้า UI

## API Endpoints Created

### 1. DELETE /api/picklists/[id]/delete
**ไฟล์:** `app/api/picklists/[id]/delete/route.ts`

**ขั้นตอนการทำงาน:**
1. ตรวจสอบ user email = `metee.c@buzzpetsfood.com`
2. ดึง `picklist_item_reservations` ที่เกี่ยวข้อง
3. ลดยอดจอง (`reserved_piece_qty`, `reserved_pack_qty`) ใน `wms_inventory_balances`
4. ลบ `picklist_item_reservations`
5. ลบ `picklist_items`
6. ลบ `picklists`

**Response:**
```json
{
  "success": true,
  "message": "Picklist deleted successfully",
  "released_reservations": 10
}
```

### 2. DELETE /api/face-sheets/[id]/delete
**ไฟล์:** `app/api/face-sheets/[id]/delete/route.ts`

**ขั้นตอนการทำงาน:**
1. ตรวจสอบ user email = `metee.c@buzzpetsfood.com`
2. ดึง `face_sheet_item_reservations` ที่เกี่ยวข้อง
3. ลดยอดจอง (`reserved_piece_qty`, `reserved_pack_qty`) ใน `wms_inventory_balances`
4. ลบ `face_sheet_item_reservations`
5. ลบ `face_sheet_items`
6. ลบ `face_sheets`

**Response:**
```json
{
  "success": true,
  "message": "Face sheet deleted successfully",
  "released_reservations": 15
}
```

### 3. DELETE /api/bonus-face-sheets/[id]/delete
**ไฟล์:** `app/api/bonus-face-sheets/[id]/delete/route.ts`

**ขั้นตอนการทำงาน:**
1. ตรวจสอบ user email = `metee.c@buzzpetsfood.com`
2. ดึง `bonus_face_sheet_item_reservations` ที่เกี่ยวข้อง
3. ลดยอดจอง (`reserved_piece_qty`, `reserved_pack_qty`) ใน `wms_inventory_balances`
4. ลบ `bonus_face_sheet_item_reservations`
5. ลบ `bonus_face_sheet_items`
6. ลบ `bonus_face_sheets`

**Response:**
```json
{
  "success": true,
  "message": "Bonus face sheet deleted successfully",
  "released_reservations": 8
}
```

## UI Changes

### 1. Picklists Page
**ไฟล์:** `app/receiving/picklists/page.tsx`

**การเปลี่ยนแปลง:**
- เพิ่ม import `Trash2` icon และ `useAuthContext`
- เพิ่ม state `deletingId` และ `canDelete`
- เพิ่มฟังก์ชัน `handleDeletePicklist()`
- เพิ่มปุ่มลบในคอลัมน์ "การดำเนินการ" (แสดงเฉพาะ `canDelete === true`)

**ตำแหน่งปุ่ม:**
```tsx
<Table.Cell>
  <div className="flex items-center space-x-1">
    <Link href={`/receiving/picklists/${picklist.id}`}>
      <Eye className="w-3.5 h-3.5" />
    </Link>
    {canDelete && (
      <button onClick={() => handleDeletePicklist(picklist.id, picklist.picklist_code)}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
</Table.Cell>
```

### 2. Face Sheets Page
**ไฟล์:** `app/receiving/picklists/face-sheets/page.tsx`

**การเปลี่ยนแปลง:**
- เพิ่ม import `Trash2` icon และ `useAuthContext`
- เพิ่ม state `deletingId` และ `canDelete`
- เพิ่มฟังก์ชัน `handleDeleteFaceSheet()`
- เพิ่มปุ่มลบในคอลัมน์ "จัดการ" (แสดงเฉพาะ `canDelete === true`)

**ตำแหน่งปุ่ม:**
```tsx
<td className="px-4 py-3 text-xs whitespace-nowrap">
  <div className="flex items-center space-x-1">
    <button onClick={() => handleViewDetails(sheet.id)}>
      <Eye className="w-4 h-4" />
    </button>
    <button onClick={() => handlePrintFaceSheet(sheet.id)}>
      <Printer className="w-4 h-4" />
    </button>
    <button onClick={() => handleGenerateChecklist(sheet.id)}>
      <ClipboardCheck className="w-4 h-4" />
    </button>
    {canDelete && (
      <button onClick={() => handleDeleteFaceSheet(sheet.id, sheet.face_sheet_no)}>
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
</td>
```

### 3. Bonus Face Sheets Page
**ไฟล์:** `app/receiving/picklists/bonus-face-sheets/page.tsx`

**การเปลี่ยนแปลง:**
- เพิ่ม import `Trash2` icon และ `useAuthContext`
- เพิ่ม state `deletingId` และ `canDelete`
- เพิ่มฟังก์ชัน `handleDeleteBonusFaceSheet()`
- เพิ่มปุ่มลบในคอลัมน์ action buttons (แสดงเฉพาะ `canDelete === true`)

**ตำแหน่งปุ่ม:**
```tsx
<td className="px-4 py-3 text-xs whitespace-nowrap">
  <div className="flex items-center space-x-1">
    <button onClick={() => router.push(`/receiving/picklists/bonus-face-sheets/pack-form?id=${sheet.id}`)}>
      <Eye className="w-4 h-4" />
    </button>
    <button onClick={() => handleAssignLocations(sheet.id)}>
      <MapPin className="w-4 h-4" />
    </button>
    <button onClick={() => handlePrintStoragePlacement(sheet.id)}>
      <FileText className="w-4 h-4" />
    </button>
    <button onClick={() => handlePrintBonusFaceSheet(sheet.id)}>
      <Printer className="w-4 h-4" />
    </button>
    <button onClick={() => handleGenerateChecklist(sheet.id)}>
      <ClipboardCheck className="w-4 h-4" />
    </button>
    <button onClick={() => handleCheckUnloadedPackages(sheet.id)}>
      <PackageSearch className="w-4 h-4" />
    </button>
    {canDelete && (
      <button onClick={() => handleDeleteBonusFaceSheet(sheet.id, sheet.face_sheet_no)}>
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
</td>
```

## Security Features

### Authorization Check
ทุก DELETE endpoint ตรวจสอบ user email ก่อนดำเนินการ:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user || user.email !== 'metee.c@buzzpetsfood.com') {
  return NextResponse.json(
    { error: 'Unauthorized: Only metee.c@buzzpetsfood.com can delete' },
    { status: 403 }
  );
}
```

### UI Conditional Rendering
ปุ่มลบแสดงเฉพาะเมื่อ:

```typescript
const { user } = useAuthContext();
const canDelete = user?.email === 'metee.c@buzzpetsfood.com';

// ใน JSX
{canDelete && (
  <button onClick={handleDelete}>
    <Trash2 />
  </button>
)}
```

## User Experience

### Confirmation Dialog
ก่อนลบจะแสดง confirmation dialog:

```javascript
if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบ ${documentType} ${documentNo}?\n\nการลบจะปลดล็อคยอดจองในบ้านหยิบด้วย`)) {
  return;
}
```

### Loading Modal
ขณะลบจะแสดง loading modal แบบเต็มหน้าจอพร้อมไอคอนหมุน:

**Component:** `components/ui/DeleteLoadingModal.tsx`

**Features:**
- แสดงไอคอน Loader2 หมุนขนาดใหญ่
- แสดงชื่อเอกสารที่กำลังลบ
- ข้อความ "กำลังลบข้อมูลและปลดล็อคยอดจอง..."
- คำเตือน "กรุณารอสักครู่ อย่าปิดหน้านี้"
- พื้นหลังสีดำโปร่งแสง (backdrop)
- ไม่สามารถปิดได้จนกว่าจะลบเสร็จ

**Usage:**
```tsx
<DeleteLoadingModal
  isOpen={!!deletingInfo}
  documentType="Picklist"
  documentNo={deletingInfo?.code || ''}
/>
```

### Success Feedback
หลังลบสำเร็จจะแสดง alert พร้อมจำนวนยอดจองที่ปลดล็อค:

```javascript
alert(`ลบ ${documentType} สำเร็จ!\nปลดล็อคยอดจอง: ${result.released_reservations} รายการ`);
```

## Database Impact

### Tables Affected
1. **wms_inventory_balances** - ลดยอดจอง (`reserved_piece_qty`, `reserved_pack_qty`)
2. **picklist_item_reservations** - ลบ records
3. **face_sheet_item_reservations** - ลบ records
4. **bonus_face_sheet_item_reservations** - ลบ records
5. **picklist_items** - ลบ records
6. **face_sheet_items** - ลบ records
7. **bonus_face_sheet_items** - ลบ records
8. **picklists** - ลบ record
9. **face_sheets** - ลบ record
10. **bonus_face_sheets** - ลบ record

### Reservation Release Logic
สำหรับแต่ละ reservation:

```typescript
await supabase
  .from('wms_inventory_balances')
  .update({
    reserved_piece_qty: Math.max(0, current_reserved_piece_qty - reservation.reserved_piece_qty),
    reserved_pack_qty: Math.max(0, current_reserved_pack_qty - reservation.reserved_pack_qty),
    updated_at: new Date().toISOString()
  })
  .eq('balance_id', reservation.balance_id);
```

## Testing Checklist

- [ ] ผู้ใช้ `metee.c@buzzpetsfood.com` เห็นปุ่มลบทั้ง 3 หน้า
- [ ] ผู้ใช้อื่นไม่เห็นปุ่มลบ
- [ ] ลบ Picklist สำเร็จและปลดล็อคยอดจอง
- [ ] ลบ Face Sheet สำเร็จและปลดล็อคยอดจอง
- [ ] ลบ Bonus Face Sheet สำเร็จและปลดล็อคยอดจอง
- [ ] Confirmation dialog แสดงก่อนลบ
- [ ] Success message แสดงจำนวนยอดจองที่ปลดล็อค
- [ ] Loading state แสดงขณะลบ
- [ ] รายการหายจากตารางหลังลบสำเร็จ
- [ ] ยอดจองใน `wms_inventory_balances` ลดลงถูกต้อง
- [ ] ผู้ใช้อื่นไม่สามารถเรียก DELETE API ได้ (403 Forbidden)

## Implementation Fixes Applied

### Authentication Fix (2026-01-18)
**ปัญหา:** API endpoints คืน "Unauthorized: No session found" error

**สาเหตุ:**
1. พยายามใช้ `cookies().get('wms_session')` แต่ระบบใช้ `session_token` cookie
2. ไม่ได้ใช้ `withAuth` wrapper ที่เป็น standard pattern ของระบบ
3. พยายาม query `user_sessions` table โดยตรงแทนที่จะใช้ auth middleware

**การแก้ไข:**
1. ✅ เปลี่ยนจาก `export async function DELETE` เป็น `async function handleDelete` 
2. ✅ ใช้ `withAuth` wrapper จาก `lib/api/with-auth.ts`
3. ✅ เปลี่ยน function signature เป็น `handleDelete(request, context)` โดย `context.user` มี email
4. ✅ Export ด้วย `export const DELETE = withAuth(handleDelete)`
5. ✅ ตรวจสอบ email จาก `context.user?.email` แทน manual session query

**ตัวอย่างโค้ดที่แก้ไข:**
```typescript
import { withAuth } from '@/lib/api/with-auth';

async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }>; user: any }
) {
  const userEmail = context.user?.email;
  
  if (!userEmail || userEmail !== 'metee.c@buzzpetsfood.com') {
    return NextResponse.json(
      { error: 'Unauthorized: Only metee.c@buzzpetsfood.com can delete' },
      { status: 403 }
    );
  }
  // ... rest of logic
}

export const DELETE = withAuth(handleDelete);
```

### Stock Balance Update Fix (2026-01-18)
**ปัญหา:** ใช้ `supabase.raw()` และ `supabase.rpc('greatest')` ที่ไม่มีอยู่จริง

**การแก้ไข:**
1. ✅ Query ยอดปัจจุบันก่อน: `select('reserved_piece_qty, reserved_pack_qty')`
2. ✅ คำนวณยอดใหม่ด้วย JavaScript: `Math.max(0, current - reserved)`
3. ✅ Update ด้วยค่าที่คำนวณแล้ว

**ตัวอย่างโค้ดที่แก้ไข:**
```typescript
// ดึงยอดปัจจุบันก่อน
const { data: currentBalance } = await supabase
  .from('wms_inventory_balances')
  .select('reserved_piece_qty, reserved_pack_qty')
  .eq('balance_id', reservation.balance_id)
  .single();

if (currentBalance) {
  const newReservedPiece = Math.max(0, (currentBalance.reserved_piece_qty || 0) - (reservation.reserved_piece_qty || 0));
  const newReservedPack = Math.max(0, (currentBalance.reserved_pack_qty || 0) - (reservation.reserved_pack_qty || 0));

  await supabase
    .from('wms_inventory_balances')
    .update({
      reserved_piece_qty: newReservedPiece,
      reserved_pack_qty: newReservedPack,
      updated_at: new Date().toISOString()
    })
    .eq('balance_id', reservation.balance_id);
}
```

**ไฟล์ที่แก้ไข:**
- ✅ `app/api/picklists/[id]/delete/route.ts`
- ✅ `app/api/face-sheets/[id]/delete/route.ts`
- ✅ `app/api/bonus-face-sheets/[id]/delete/route.ts`

**สถานะ:** ✅ แก้ไขเสร็จสมบูรณ์ - ไม่มี TypeScript errors

### Loading Modal Enhancement (2026-01-18)
**เพิ่มฟีเจอร์:** Loading modal แบบเต็มหน้าจอขณะลบ

**การเปลี่ยนแปลง:**
1. ✅ สร้าง `components/ui/DeleteLoadingModal.tsx` - Modal component สำหรับแสดงสถานะการลบ
2. ✅ เพิ่ม state `deletingInfo` ในทั้ง 3 หน้า เพื่อเก็บข้อมูลเอกสารที่กำลังลบ
3. ✅ แสดง modal เมื่อ `deletingInfo` ไม่เป็น null
4. ✅ Modal จะปิดอัตโนมัติเมื่อลบเสร็จ (success หรือ error)

**Features ของ Modal:**
- ไอคอน Loader2 หมุนขนาดใหญ่ (16x16)
- แสดงชื่อประเภทเอกสาร (Picklist, Face Sheet, Bonus Face Sheet)
- แสดงเลขที่เอกสาร
- ข้อความ "กำลังลบข้อมูลและปลดล็อคยอดจอง..."
- คำเตือน "กรุณารอสักครู่ อย่าปิดหน้านี้"
- พื้นหลังสีดำโปร่งแสง 60% (backdrop)
- Header สีแดง gradient (red-500 to red-600)
- ไม่สามารถปิดได้จนกว่าจะลบเสร็จ

**ไฟล์ที่เพิ่ม/แก้ไข:**
- ✅ `components/ui/DeleteLoadingModal.tsx` (ไฟล์ใหม่)
- ✅ `app/receiving/picklists/page.tsx` (เพิ่ม modal)
- ✅ `app/receiving/picklists/face-sheets/page.tsx` (เพิ่ม modal)
- ✅ `app/receiving/picklists/bonus-face-sheets/page.tsx` (เพิ่ม modal)

**สถานะ:** ✅ เสร็จสมบูรณ์ - ไม่มี TypeScript errors

## Notes

- การลบจะลบข้อมูลถาวร ไม่ใช่ soft delete
- ยอดจองจะถูกปลดล็อคทันทีเมื่อลบ
- ไม่มีการ rollback หากเกิดข้อผิดพลาดระหว่างการลบ (ควรพิจารณาใช้ transaction ในอนาคต)
- ปุ่มลบอยู่ท้ายสุดของ action buttons ในแต่ละแถว
- สีปุ่มลบเป็นสีแดง (red-600) เพื่อบ่งบอกว่าเป็นการกระทำที่อันตราย

## Future Improvements

1. **Transaction Support**: ใช้ database transaction เพื่อให้แน่ใจว่าการลบทั้งหมดสำเร็จหรือ rollback ทั้งหมด
2. **Soft Delete**: พิจารณาใช้ soft delete แทนการลบถาวร
3. **Audit Log**: บันทึก log การลบเพื่อตรวจสอบย้อนหลัง
4. **Batch Delete**: เพิ่มฟีเจอร์ลบหลายรายการพร้อมกัน
5. **Undo Feature**: เพิ่มฟีเจอร์ยกเลิกการลบภายในระยะเวลาที่กำหนด
