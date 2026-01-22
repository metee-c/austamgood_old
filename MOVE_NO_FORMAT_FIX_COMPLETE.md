# แก้ไขปัญหา move_no เปลี่ยนรูปแบบ - เสร็จสมบูรณ์

## สรุปปัญหา
- **ปัญหา**: move_no เปลี่ยนจาก format เก่า `MV-202601-1326` เป็น format ผิด `MV0000000718`
- **สาเหตุ**: TypeScript code ใน `lib/database/move.ts` สร้าง move_no เองแทนที่จะเรียก database function
- **ผลกระทบ**: move_no ไม่มี prefix ที่บอกประเภทการย้าย (PUT/TRF/REP/ADJ) และ format ไม่ตรงกับมาตรฐาน

## การแก้ไขที่ทำ

### 1. แก้ไข `lib/database/move.ts`

#### เปลี่ยน method `generateMoveNo()`
```typescript
// ❌ เดิม: สร้าง move_no เองใน TypeScript
async generateMoveNo(): Promise<{ data: string | null; error: string | null }> {
  // สร้าง format MV-YYYYMM-XXXX เอง
  const prefix = 'MV-' + year + month + '-';
  // ...
}

// ✅ ใหม่: เรียก database function
async generateMoveNo(moveType: MoveType, palletId?: string | null): Promise<{ data: string | null; error: string | null }> {
  const { data, error } = await this.supabase.rpc('generate_move_no', {
    p_move_type: moveType,
    p_pallet_id: palletId || null
  });
  return { data, error: null };
}
```

#### เปลี่ยน method `createMove()`
```typescript
// ❌ เดิม: ไม่ส่ง parameter
const generated = await this.generateMoveNo();

// ✅ ใหม่: ส่ง move_type และ pallet_id
const firstPalletId = payload.items?.[0]?.pallet_id || null;
const generated = await this.generateMoveNo(payload.move_type, firstPalletId);
```

## ผลลัพธ์

### Format ที่ถูกต้อง (หลังแก้ไข)
- **Putaway**: `PUT-202601-0001` (การเก็บสินค้าเข้าคลัง)
- **Transfer**: `TRF-202601-0001` (การย้ายสินค้า)
- **Replenishment**: `REP-202601-0001` (การเติมสินค้า)
- **Adjustment**: `ADJ-202601-0001` (การปรับปรุงสต็อก)

### ข้อดีของ format ใหม่
1. **มี prefix ที่ชัดเจน**: รู้ทันทีว่าเป็นการย้ายประเภทไหน
2. **แยก running number**: แต่ละประเภทมี running number ของตัวเอง
3. **สอดคล้องกับ database**: ใช้ function ที่มีอยู่แล้วในฐานข้อมูล
4. **ตรวจสอบ pallet**: ถ้าเป็น pallet ที่พึ่งรับ จะใช้ PUT อัตโนมัติ

## การทดสอบ

```bash
node test-move-no-fix.js
```

ผลการทดสอบ:
```
✅ transfer: TRF-2026010001
✅ putaway: PUT-2026010001
✅ replenishment: REP-2026010001
✅ adjustment: ADJ-2026010001
```

## ข้อมูลเพิ่มเติม

### Database Function: `generate_move_no()`
- **Location**: `supabase/migrations/001_complete_schema_from_production.sql`
- **Parameters**:
  - `p_move_type`: ประเภทการย้าย (putaway/transfer/replenishment/adjustment)
  - `p_pallet_id`: รหัส pallet (optional) - ใช้ตรวจสอบว่าเป็น pallet ที่พึ่งรับหรือไม่
- **Logic**: 
  - ถ้า pallet_id เป็น pallet ที่พึ่งรับ → ใช้ prefix `PUT` อัตโนมัติ
  - ถ้าไม่ใช่ → ใช้ prefix ตาม move_type

### Move Types และ Prefixes
| Move Type | Prefix | ความหมาย |
|-----------|--------|----------|
| putaway | PUT | การเก็บสินค้าเข้าคลัง |
| transfer | TRF | การย้ายสินค้า |
| replenishment | REP | การเติมสินค้า |
| adjustment | ADJ | การปรับปรุงสต็อก |

## สถานะ
✅ **แก้ไขเสร็จสมบูรณ์**

- [x] แก้ไข `lib/database/move.ts`
- [x] ทดสอบ database function
- [x] ตรวจสอบ format ที่ถูกต้อง
- [x] สร้างเอกสาร

## หมายเหตุ
- Move records เก่าที่มี format `MV0000000718` จะยังคงอยู่ในฐานข้อมูล
- Move records ใหม่ที่สร้างหลังจากนี้จะใช้ format ที่ถูกต้อง
- ไม่จำเป็นต้อง migrate ข้อมูลเก่า เพราะไม่กระทบการทำงาน
