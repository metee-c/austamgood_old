# User Tracking Fix for Mobile APIs

## Problem
หน้า mobile ไม่บันทึกข้อมูลผู้ใช้ที่ดำเนินการ ทำให้ในตาราง `wms_inventory_ledger` คอลัมน `created_by` เป็น NULL

**หน้าที่มีปัญหา:**
- http://localhost:3000/mobile/bonus-face-sheet/18
- http://localhost:3000/mobile/loading/LD-20251211-0001
- http://localhost:3000/mobile/face-sheet/[id]
- http://localhost:3000/mobile/pick/[id]

## Root Cause
API endpoints ที่เกี่ยวข้องกับการหยิบและโหลดสินค้าไม่ได้ตั้งค่า user context ก่อนบันทึก inventory ledger:

1. `app/api/mobile/bonus-face-sheet/scan/route.ts` - หยิบสินค้าของแถม
2. `app/api/mobile/loading/complete/route.ts` - ยืนยันการโหลดสินค้า
3. `app/api/mobile/face-sheet/scan/route.ts` - หยิบสินค้าตามใบปะหน้า
4. `app/api/mobile/pick/scan/route.ts` - หยิบสินค้าตาม picklist

## Solution Implemented

เพิ่ม user context tracking ในทุก API ที่บันทึก inventory ledger:

### 1. app/api/mobile/bonus-face-sheet/scan/route.ts

```typescript
import { getUserIdFromCookie, setDatabaseUserContext } from '@/lib/database/user-context';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ✅ Set user context for audit trail
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    // ... rest of the code
  }
}
```

### 2. app/api/mobile/loading/complete/route.ts

```typescript
import { getUserIdFromCookie, setDatabaseUserContext } from '@/lib/database/user-context';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ✅ Set user context for audit trail
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    // ... rest of the code
  }
}
```

### 3. app/api/mobile/face-sheet/scan/route.ts

```typescript
import { getUserIdFromCookie, setDatabaseUserContext } from '@/lib/database/user-context';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ✅ Set user context for audit trail
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    // ... rest of the code
  }
}
```

### 4. app/api/mobile/pick/scan/route.ts

```typescript
import { getUserIdFromCookie, setDatabaseUserContext } from '@/lib/database/user-context';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ✅ Set user context for audit trail
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
    await setDatabaseUserContext(supabase, userId);
    
    // ... rest of the code
  }
}
```

## How It Works

1. **Get User ID from Cookie**: อ่าน `session_token` จาก cookie header
2. **Validate Session**: ตรวจสอบ session token กับฐานข้อมูล
3. **Set Database Context**: เรียก `wms_set_config()` เพื่อตั้งค่า `app.current_user_id`
4. **Trigger Captures User**: Database triggers จะอ่านค่า `app.current_user_id` และบันทึกใน `created_by`
5. **Fallback to System User**: ถ้าไม่มี session ใช้ user_id = 1 (system user)

## Database Triggers

Triggers ที่จะจับค่า `created_by` อัตโนมัติ:

```sql
-- ตัวอย่าง trigger
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::INTEGER,
    1  -- Fallback to system user
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger สำหรับ inventory_ledger
CREATE TRIGGER set_created_by_on_inventory_ledger
  BEFORE INSERT ON wms_inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by_from_context();
```

## Testing

### Before Fix
```sql
SELECT COUNT(*) FROM wms_inventory_ledger WHERE created_by IS NULL;
-- Result: 20 rows with NULL created_by
```

### After Fix
ทดสอบโดย:
1. เข้าสู่ระบบด้วย user (เช่น metee, user_id=2)
2. ไปที่หน้า mobile/bonus-face-sheet/[id] และสแกนสินค้า
3. ไปที่หน้า mobile/loading/[code] และยืนยันการโหลด
4. ตรวจสอบ inventory_ledger:

```sql
SELECT 
  ledger_id,
  transaction_type,
  sku_id,
  created_by,
  created_at
FROM wms_inventory_ledger
WHERE created_at > '2025-12-11 04:00:00'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Result**: ทุกรายการควรมี `created_by = 2` (metee)

## Benefits

1. **Complete Audit Trail**: ทุกการเคลื่อนไหวสต็อคจะมีข้อมูลผู้ดำเนินการ
2. **Mobile User Tracking**: พนักงานที่ใช้ mobile app จะถูกบันทึกชื่อ
3. **Accountability**: สามารถตรวจสอบได้ว่าใครเป็นคนหยิบ/โหลดสินค้า
4. **Debugging**: ง่ายต่อการตรวจสอบปัญหาจากการดำเนินการของ user
5. **Compliance**: ตรงตามข้อกำหนดการตรวจสอบย้อนหลัง

## Related Files

**Modified:**
- `app/api/mobile/bonus-face-sheet/scan/route.ts`
- `app/api/mobile/loading/complete/route.ts`
- `app/api/mobile/face-sheet/scan/route.ts`
- `app/api/mobile/pick/scan/route.ts`

**Helper Functions:**
- `lib/database/user-context.ts` - `getUserIdFromCookie()`, `setDatabaseUserContext()`
- `lib/supabase/session.ts` - Session management utilities

**Database:**
- `supabase/migrations/132_add_user_tracking_to_ledger.sql` - Triggers and functions

## Display in UI

หน้า inventory-ledger จะแสดงชื่อผู้ใช้:

```typescript
// app/warehouse/inventory-ledger/page.tsx
<Table.Cell>
  <span className="text-xs text-gray-700 font-thai">
    {ledger.created_by_user?.full_name || 
     ledger.created_by_user?.username || 
     (ledger.created_by ? `User #${ledger.created_by}` : '-')}
  </span>
</Table.Cell>
```

## Future Enhancements

พิจารณาเพิ่ม user tracking ใน:
- การรับสินค้า (receiving)
- การย้ายสต็อค (stock moves)
- การปรับสต็อค (stock adjustments)
- การผลิต (production)

---

**Status**: ✅ Fixed
**Date**: December 11, 2025
**Fixed By**: Kiro AI Assistant
