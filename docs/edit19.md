# ภารกิจ: แก้ไขปัญหาที่เหลือจาก Audit Report

## ⚠️ กฎสำคัญ

1. **ห้าม** แก้ไข Business Logic ที่ทำงานอยู่แล้ว
2. **ต้อง** Test ทุกครั้งหลังแก้ไข
3. **ทำทีละไฟล์** ห้ามรวบ

---

## 🎯 เป้าหมาย

แก้ไข 14 ไฟล์ที่เหลือ + Cleanup Sessions

---

## Task 1: แก้ไข Service Role Key (10 ไฟล์)

### วิธีแก้ไข: เปลี่ยนจาก direct service role key เป็น createServiceRoleClient()

**ไฟล์ที่ต้องแก้ไข:**

1. `app/api/storage-strategies/import/route.ts`
2. `app/api/sku-options/route.ts`
3. `app/api/orders/[id]/items/route.ts`
4. `app/api/receive/update-external-pallet/route.ts`
5. `app/api/orders/returnable/route.ts`
6. `app/api/preparation-areas/route.ts`
7. `app/api/preparation-areas/[id]/route.ts`
8. `app/api/moves/items/[id]/route.ts`
9. `app/api/preparation-areas/import/route.ts`
10. `app/api/file-uploads/route.ts`

**Template การแก้ไข:**
```typescript
// ❌ ก่อนแก้ไข
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ หลังแก้ไข
import { createServiceRoleClient } from '@/lib/supabase/service';

// ใน function
const supabase = createServiceRoleClient();
```

**ถ้ายังไม่มี createServiceRoleClient ให้สร้างใหม่:**
```typescript
// lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js';

let serviceRoleClient: ReturnType<typeof createClient> | null = null;

export function createServiceRoleClient() {
  if (!serviceRoleClient) {
    serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return serviceRoleClient;
}
```

---

## Task 2: แก้ไข userId = 1 Fallback (4 ไฟล์)

**ไฟล์ที่ต้องแก้ไข:**

1. `app/api/stock-import/picking-area/process/route.ts`
2. `app/api/orders/[id]/rollback/route.ts`
3. `app/api/orders/import/route.ts`
4. `app/api/bonus-face-sheets/confirm-pick-to-staging/route.ts`

**Template การแก้ไข:**
```typescript
// ❌ ก่อนแก้ไข
const userId = await getUserIdFromCookie(cookieHeader) || 1;

// ✅ หลังแก้ไข (Option 1: Return 401)
const userId = await getUserIdFromCookie(cookieHeader);
if (!userId) {
  return NextResponse.json(
    { error: 'กรุณาเข้าสู่ระบบ', error_code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

// ✅ หลังแก้ไข (Option 2: ใช้ withAuth wrapper)
import { withAuth } from '@/lib/api/with-auth';

async function handlePost(request: NextRequest, context: any) {
  const userId = context.user.user_id; // ได้จาก wrapper แล้ว
  // ... logic เดิม
}

export const POST = withAuth(handlePost);
```

---

## Task 3: Cleanup Expired Sessions

**สร้าง API หรือ Script สำหรับ cleanup:**
```typescript
// app/api/admin/cleanup-sessions/route.ts
import { withAdminAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';

async function handlePost(request: NextRequest, context: any) {
  const supabase = await createClient();
  
  // ลบ expired sessions
  const { data, error } = await supabase
    .from('user_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('session_id');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    deleted_sessions: data?.length || 0
  });
}

export const POST = withAdminAuth(handlePost);
```

**หรือใช้ SQL โดยตรง:**
```sql
-- Cleanup expired sessions
DELETE FROM user_sessions
WHERE expires_at < NOW();

-- ดูผลลัพธ์
SELECT COUNT(*) as remaining_sessions FROM user_sessions WHERE is_active = true;
```

---

## Task 4: เพิ่ม Auth ให้ไฟล์ที่เหลือ (Optional)

ถ้าต้องการเพิ่ม auth ให้ 10 ไฟล์ที่ใช้ service role key:
```typescript
// Template: เพิ่ม auth + ใช้ service role client

import { withAuth } from '@/lib/api/with-auth';
import { createServiceRoleClient } from '@/lib/supabase/service';

async function handleGet(request: NextRequest, context: any) {
  // ✅ มี auth แล้ว (จาก wrapper)
  const userId = context.user.user_id;
  
  // ใช้ service role client สำหรับ admin operations
  const supabase = createServiceRoleClient();
  
  // ... logic เดิม
}

export const GET = withAuth(handleGet);
```

---

## Checklist

### Task 1: Service Role Key (10 ไฟล์)
- [ ] storage-strategies/import/route.ts
- [ ] sku-options/route.ts
- [ ] orders/[id]/items/route.ts
- [ ] receive/update-external-pallet/route.ts
- [ ] orders/returnable/route.ts
- [ ] preparation-areas/route.ts
- [ ] preparation-areas/[id]/route.ts
- [ ] moves/items/[id]/route.ts
- [ ] preparation-areas/import/route.ts
- [ ] file-uploads/route.ts

### Task 2: userId Fallback (4 ไฟล์)
- [ ] stock-import/picking-area/process/route.ts
- [ ] orders/[id]/rollback/route.ts
- [ ] orders/import/route.ts
- [ ] bonus-face-sheets/confirm-pick-to-staging/route.ts

### Task 3: Cleanup
- [ ] Cleanup 255 expired sessions
- [ ] ตรวจสอบว่า session cleanup ทำงาน

### Task 4: Verify
- [ ] Test APIs ที่แก้ไขทั้งหมด
- [ ] ตรวจสอบว่า Logic เดิมทำงานปกติ

---

## Test Cases

### Test Service Role Key Change
```
□ API ทำงานปกติหลังเปลี่ยน
□ ไม่มี permission errors
□ RLS policies ทำงาน (ถ้ามี)
```

### Test userId Fallback Removal
```
□ เรียก API โดยไม่ login → 401 Unauthorized
□ Login แล้วเรียก API → สำเร็จ
□ Audit log บันทึก user ถูกต้อง
```

### Test Session Cleanup
```
□ Expired sessions ถูกลบ
□ Active sessions ยังอยู่
□ ไม่กระทบ user ที่ login อยู่
```

---

เริ่มทำงานได้เลย ทำทีละ Task
**รายงานผลทุกไฟล์ที่แก้ไข**
```

---
