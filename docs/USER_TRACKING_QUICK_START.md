# User Tracking - Quick Start Guide

## สรุปสั้นๆ

ระบบติดตามผู้ใช้ที่สร้างข้อมูลใน `wms_inventory_ledger` พร้อมใช้งานแล้ว!

## สิ่งที่ทำเสร็จแล้ว ✅

1. ✅ สร้าง database functions (`wms_set_config`, `get_current_user_id`)
2. ✅ อัปเดต triggers ทั้งหมดให้บันทึก `created_by`
3. ✅ สร้าง helper functions (`lib/database/user-context.ts`)
4. ✅ ทดสอบ functions ทำงานได้ถูกต้อง

## วิธีใช้งาน (3 ขั้นตอน)

### 1. Import Helper

```typescript
import { setDatabaseUserContext, getUserIdFromCookie } from '@/lib/database/user-context';
```

### 2. ดึง User ID จาก Cookie

```typescript
const cookieHeader = request.headers.get('cookie');
const userId = getUserIdFromCookie(cookieHeader);
```

### 3. Set User Context ก่อนทำงาน Database

```typescript
await setDatabaseUserContext(supabase, userId);

// ตอนนี้ทุก operation จะบันทึก created_by อัตโนมัติ
await supabase.from('wms_moves').insert(...);
```

## ตัวอย่างโค้ดสมบูรณ์

```typescript
// app/api/moves/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext, getUserIdFromCookie } from '@/lib/database/user-context';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  
  // ดึง user_id และ set context
  const userId = getUserIdFromCookie(request.headers.get('cookie'));
  await setDatabaseUserContext(supabase, userId);
  
  // ทำงานปกติ - created_by จะถูกบันทึกอัตโนมัติ
  const { data, error } = await supabase
    .from('wms_moves')
    .insert(body);
    
  return NextResponse.json({ data, error });
}
```

## ทดสอบระบบ

```sql
-- 1. Set user context
SELECT wms_set_config('app.current_user_id', '1', true);

-- 2. ตรวจสอบว่า set สำเร็จ
SELECT get_current_user_id(); -- ควรได้ 1

-- 3. ดูข้อมูลล่าสุดใน ledger
SELECT 
  ledger_id,
  transaction_type,
  created_by,
  created_at
FROM wms_inventory_ledger
ORDER BY created_at DESC
LIMIT 10;
```

## API ที่ต้องอัปเดต

เพิ่ม user tracking ใน API เหล่านี้:
- ✅ `/api/moves` - ย้ายสินค้า
- ⏳ `/api/receives` - รับสินค้า
- ⏳ `/api/warehouse/transfer` - โอนย้าย
- ⏳ APIs อื่นๆ ที่สร้าง inventory transactions

## หมายเหตุสำคัญ

- ⚠️ ต้องเรียก `setDatabaseUserContext()` **ก่อน** ทำ database operations
- ⚠️ ถ้าไม่ set user context, `created_by` จะเป็น `NULL`
- ✅ ระบบจะไม่ error ถ้า set ล้มเหลว (เพื่อไม่ให้กระทบการทำงาน)

## เอกสารเพิ่มเติม

ดูรายละเอียดเพิ่มเติมที่: `docs/USER_TRACKING_IMPLEMENTATION.md`
