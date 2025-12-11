# User Tracking Implementation Guide

## Overview
ระบบติดตามผู้ใช้ที่สร้างหรือแก้ไขข้อมูลใน `wms_inventory_ledger` โดยใช้ PostgreSQL session variables และ database triggers

## Architecture

### 1. Database Layer
- **Function**: `wms_set_config(setting_name, setting_value, is_local)` - ตั้งค่า session variable
- **Function**: `get_current_user_id()` - ดึง user_id จาก session variable
- **Triggers**: อัปเดตแล้วเพื่อบันทึก `created_by` จาก session

### 2. Application Layer
- **Helper**: `lib/database/user-context.ts` - Functions สำหรับจัดการ user context
- **Service Layer**: ต้องเรียก `setDatabaseUserContext()` ก่อนทำงาน

## How It Works

```
User Login → Session Cookie (wms_session) → API Request → Set DB Session → Trigger → created_by
```

1. ผู้ใช้ login → ระบบสร้าง session cookie ที่มี `user_id`
2. API request มาพร้อม cookie
3. API/Service เรียก `setDatabaseUserContext(supabase, userId)`
4. Database session variable `app.current_user_id` ถูก set
5. เมื่อ trigger ทำงาน จะเรียก `get_current_user_id()` เพื่อบันทึก `created_by`

## Implementation Steps

### Step 1: Import Helper Function

```typescript
import { setDatabaseUserContext, getUserIdFromCookie } from '@/lib/database/user-context';
```

### Step 2: Get User ID from Request

```typescript
// In API Route
export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  
  // ... rest of code
}
```

### Step 3: Set User Context Before Database Operations

```typescript
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const cookieHeader = request.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  
  // Set user context
  await setDatabaseUserContext(supabase, userId);
  
  // Now perform database operations
  // Triggers will automatically capture created_by
  const { data, error } = await supabase
    .from('wms_moves')
    .insert({ ... });
    
  return NextResponse.json({ data, error });
}
```

## Example: Complete API Route

```typescript
// app/api/moves/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext, getUserIdFromCookie } from '@/lib/database/user-context';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Get user ID from session cookie
    const cookieHeader = request.headers.get('cookie');
    const userId = getUserIdFromCookie(cookieHeader);
    
    // Set user context for audit trail
    await setDatabaseUserContext(supabase, userId);
    
    // Perform database operations
    // Triggers will automatically set created_by = userId
    const { data, error } = await supabase
      .from('wms_moves')
      .insert(body)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Testing

### 1. Test User Context Setting

```sql
-- In psql or Supabase SQL Editor
SELECT wms_set_config('app.current_user_id', '1', true);
SELECT get_current_user_id(); -- Should return 1
```

### 2. Test Trigger with User Context

```sql
-- Set user context
SELECT wms_set_config('app.current_user_id', '1', true);

-- Create a move (this will trigger ledger creation)
INSERT INTO wms_move_items (
  move_id, sku_id, move_method, status,
  from_location_id, to_location_id,
  requested_pack_qty, requested_piece_qty,
  planned_pack_qty, planned_piece_qty,
  confirmed_pack_qty, confirmed_piece_qty
) VALUES (
  1, 'SKU001', 'pallet', 'completed',
  'LOC-A', 'LOC-B',
  1, 10, 1, 10, 1, 10
);

-- Check ledger entries
SELECT ledger_id, transaction_type, created_by, created_at
FROM wms_inventory_ledger
ORDER BY created_at DESC
LIMIT 5;
-- created_by should be 1
```

### 3. Test via API

```bash
# Login first to get session cookie
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -c cookies.txt

# Make API request with session cookie
curl -X POST http://localhost:3000/api/moves \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "move_type": "transfer",
    "from_warehouse_id": "WH001",
    "to_warehouse_id": "WH001",
    "items": [{
      "sku_id": "SKU001",
      "move_method": "pallet",
      "from_location_id": "LOC-A",
      "to_location_id": "LOC-B",
      "requested_piece_qty": 10
    }]
  }'

# Check database
# SELECT * FROM wms_inventory_ledger ORDER BY created_at DESC LIMIT 5;
```

## Affected Tables

ตาราง `wms_inventory_ledger` จะมีการบันทึก `created_by` อัตโนมัติเมื่อ:
- สร้าง receive items (trigger: `create_ledger_from_receive_item`)
- เปลี่ยนสถานะ receive (trigger: `create_ledger_from_receive_status_change`)
- ย้ายสินค้า (trigger: `create_ledger_from_move_item`)

## Migration Files

- `132_add_user_tracking_to_ledger.sql` - สร้าง functions และอัปเดต triggers

## Troubleshooting

### created_by ยังเป็น NULL
1. ตรวจสอบว่า session cookie มี `user_id` หรือไม่
2. ตรวจสอบว่าเรียก `setDatabaseUserContext()` ก่อนทำงานหรือไม่
3. ตรวจสอบ logs ว่ามี error จาก `wms_set_config` หรือไม่

### Function not found error
- ตรวจสอบว่ารัน migration 132 แล้วหรือยัง
- ตรวจสอบว่า function `wms_set_config` และ `get_current_user_id` มีอยู่ใน database

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('wms_set_config', 'get_current_user_id');
```

## Best Practices

1. **Always set user context** - เรียก `setDatabaseUserContext()` ในทุก API ที่สร้าง/แก้ไขข้อมูล
2. **Handle errors gracefully** - ถ้า set user context ล้มเหลว ไม่ควร break operation
3. **Use service role key** - สำหรับ server-side operations ที่ต้องการ full access
4. **Log failures** - บันทึก error เมื่อ set user context ล้มเหลว

## Future Enhancements

- เพิ่ม `updated_by` tracking
- เพิ่ม middleware อัตโนมัติสำหรับทุก API routes
- สร้าง audit log table สำหรับ track ทุก changes
