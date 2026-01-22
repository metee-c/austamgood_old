# แก้ไขปัญหา move_no เปลี่ยนรูปแบบ

## ปัญหา
- move_no เปลี่ยนจาก `MV-202601-1326` เป็น `MV0000000718`
- TypeScript code ใน `lib/database/move.ts` สร้าง move_no เอง แทนที่จะเรียก database function
- Database function `generate_move_no(p_move_type, p_pallet_id)` สร้าง format ที่ถูกต้อง: `TRF-202601-0001`, `PUT-202601-0001` ฯลฯ

## สาเหตุ
1. TypeScript method `generateMoveNo()` ใน `lib/database/move.ts` สร้าง format `MV-YYYYMM-XXXX` 
2. แต่ไม่ได้เรียก database function `generate_move_no()` ที่สร้าง format ถูกต้องตาม move_type
3. Database function ต้องการ parameter `p_move_type` เพื่อสร้าง prefix ที่ถูกต้อง:
   - `putaway` → `PUT-202601-0001`
   - `transfer` → `TRF-202601-0001`
   - `replenishment` → `REP-202601-0001`
   - `adjustment` → `ADJ-202601-0001`

## วิธีแก้ไข

### 1. แก้ไข `lib/database/move.ts`

เปลี่ยนจาก:
```typescript
async generateMoveNo(): Promise<{ data: string | null; error: string | null }> {
  try {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = 'MV-' + year + month + '-';
    const pattern = prefix + '%';

    const { data, error } = await this.supabase
      .from('wms_moves')
      .select('move_no')
      .like('move_no', pattern)
      .order('move_no', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[MoveService] Failed to fetch latest move_no', error);
      return { data: null, error: error.message };
    }

    let running = 1;
    if (data && data.length > 0) {
      const last = data[0].move_no;
      const lastDash = last.lastIndexOf('-');
      const suffix = lastDash >= 0 ? last.slice(lastDash + 1) : '';
      const parsed = parseInt(suffix, 10);
      running = Number.isNaN(parsed) ? 1 : parsed + 1;
    }

    const moveNo = prefix + String(running).padStart(4, '0');
    return { data: moveNo, error: null };
  } catch (err) {
    console.error('[MoveService] generateMoveNo error', err);
    return { data: null, error: 'Failed to generate move number' };
  }
}
```

เป็น:
```typescript
async generateMoveNo(moveType: MoveType, palletId?: string | null): Promise<{ data: string | null; error: string | null }> {
  try {
    // เรียก database function generate_move_no ที่สร้าง format ถูกต้องตาม move_type
    const { data, error } = await this.supabase.rpc('generate_move_no', {
      p_move_type: moveType,
      p_pallet_id: palletId || null
    });

    if (error) {
      console.error('[MoveService] Failed to generate move_no', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[MoveService] generateMoveNo error', err);
    return { data: null, error: 'Failed to generate move number' };
  }
}
```

### 2. แก้ไข `createMove` method

เปลี่ยนจาก:
```typescript
const generated = await this.generateMoveNo();
```

เป็น:
```typescript
// ส่ง move_type และ pallet_id (ถ้ามี) ไปยัง generateMoveNo
const firstPalletId = payload.items?.[0]?.pallet_id || null;
const generated = await this.generateMoveNo(payload.move_type, firstPalletId);
```

## ผลลัพธ์ที่คาดหวัง
- move_no จะกลับมาเป็น format ที่ถูกต้อง:
  - Putaway: `PUT-202601-0001`
  - Transfer: `TRF-202601-0001`
  - Replenishment: `REP-202601-0001`
  - Adjustment: `ADJ-202601-0001`
- แต่ละ move_type จะมี running number แยกกัน
- Format จะสอดคล้องกับ database function ที่มีอยู่แล้ว
