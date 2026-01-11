# ภารกิจ: Production Readiness - แก้ไขช่องโหว่โดยไม่ทำลาย Logic เดิม

## ⚠️ กฎเหล็ก (ห้ามละเมิดเด็ดขาด)

1. **ห้าม** แก้ไข Business Logic ที่ทำงานอยู่แล้ว
2. **ห้าม** เปลี่ยน Database Schema (ยกเว้นเพิ่ม columns ใหม่)
3. **ห้าม** เปลี่ยน API Response Format ที่ Frontend ใช้อยู่
4. **ต้อง** Test ทุกครั้งหลังแก้ไข
5. **ต้อง** Backup ก่อนแก้ไขทุกไฟล์
6. **ต้อง** ทำทีละ Phase ห้ามรวบ

---

## 🎯 เป้าหมาย

แก้ไข 30 Critical Issues + 73 High Issues โดย:
- ✅ Logic การทำงานเหมือนเดิม 100%
- ✅ API Responses เหมือนเดิม
- ✅ Frontend ใช้งานได้ปกติ
- ✅ Security ปลอดภัย
- ✅ พร้อมขายลูกค้า

---

## Phase 1: Low-Risk Security Fixes (ความเสี่ยงต่ำ)

### 1.1 Enable Rate Limiting (C07)

**ไฟล์:** `lib/auth/auth-service.ts`

**วิธีแก้ไข:** Uncomment rate limiting code ที่มีอยู่แล้ว
```typescript
// ❌ ก่อนแก้ไข (line 67-75)
// Check rate limiting (TEMPORARILY DISABLED FOR TESTING)
// const rateLimitCheck = await checkLoginRateLimit(email, ip_address || '127.0.0.1');
console.log('⚠️  [AUTH-SERVICE] Rate limiting is DISABLED for testing');

// ✅ หลังแก้ไข
// Check rate limiting
const rateLimitCheck = await checkLoginRateLimit(email, ip_address || '127.0.0.1');
if (!rateLimitCheck.allowed) {
  await logLoginAttempt({
    email,
    ip_address,
    user_agent,
    success: false,
    failure_reason: 'Rate limit exceeded'
  });
  return {
    success: false,
    error: 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
    error_code: 'RATE_LIMIT'
  };
}
```

**Test:** 
- [ ] Login ปกติยังใช้ได้
- [ ] Login ผิด 5+ ครั้งติดต่อกัน → ถูก block ชั่วคราว

---

### 1.2 Remove Password Reset Token from Response (C07 Related)

**ไฟล์:** `lib/auth/auth-service.ts`

**วิธีแก้ไข:** ไม่ return token ใน response
```typescript
// ❌ ก่อนแก้ไข
return {
  success: true,
  token: tokenResult.token  // ❌ ไม่ควร return
};

// ✅ หลังแก้ไข
// TODO: Send email with token instead
console.log(`[PROD] Password reset token generated for ${email}`);
return {
  success: true,
  message: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว'
};
```

**Test:**
- [ ] Request password reset → ไม่เห็น token ใน response

---

## Phase 2: Authentication Wrapper (ไม่แก้ Logic เดิม)

### 2.1 สร้าง Authentication Wrapper Function

**สร้างไฟล์ใหม่:** `lib/api/with-auth.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';

type ApiHandler = (
  request: NextRequest,
  context: { params?: any; user: { user_id: number; username: string; role_id: number } }
) => Promise<NextResponse>;

interface WithAuthOptions {
  requiredPermissions?: string[];
  allowedRoles?: number[];
  skipAuth?: boolean; // สำหรับ backward compatibility
}

export function withAuth(handler: ApiHandler, options: WithAuthOptions = {}) {
  return async (request: NextRequest, context?: { params?: any }) => {
    // Skip auth if explicitly disabled (for gradual migration)
    if (options.skipAuth) {
      // เรียก handler เดิมโดยไม่ตรวจสอบ auth
      return handler(request, { ...context, user: { user_id: 1, username: 'system', role_id: 1 } });
    }

    try {
      // ดึง session จาก cookie
      const session = await getCurrentSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'กรุณาเข้าสู่ระบบ', error_code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      // ตรวจสอบ role ถ้าระบุ
      if (options.allowedRoles && !options.allowedRoles.includes(session.role_id)) {
        return NextResponse.json(
          { error: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้', error_code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      // ✅ เรียก handler เดิมพร้อม user context
      return handler(request, { ...context, user: session });

    } catch (error) {
      console.error('[withAuth] Error:', error);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์', error_code: 'AUTH_ERROR' },
        { status: 500 }
      );
    }
  };
}

// Helper สำหรับ APIs ที่ต้องการ admin only
export function withAdminAuth(handler: ApiHandler) {
  return withAuth(handler, { allowedRoles: [1] }); // role_id = 1 คือ admin
}
```

---

### 2.2 แก้ไข API โดยใช้ Wrapper (ไม่แก้ Logic เดิม)

**ตัวอย่าง:** `app/api/orders/route.ts`
```typescript
// ❌ ก่อนแก้ไข
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // ... logic เดิมทั้งหมด
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    // ... logic เดิมทั้งหมด
  }
}

// ✅ หลังแก้ไข - Wrap function เดิม ไม่แก้ logic ข้างใน

import { withAuth } from '@/lib/api/with-auth';

// Logic เดิม 100% ไม่เปลี่ยน
async function handleGet(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    // ... logic เดิมทั้งหมด เหมือนเดิมทุกบรรทัด
  }
}

async function handlePost(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    // ... logic เดิมทั้งหมด เหมือนเดิมทุกบรรทัด
    
    // ✅ เพิ่มแค่บรรทัดนี้สำหรับ audit log (ถ้าต้องการ)
    // const userId = context.user.user_id;
  }
}

// Export พร้อม wrapper
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
```

---

### 2.3 รายการ APIs ที่ต้องเพิ่ม Auth (Priority Order)

#### Priority 1: Dangerous APIs (ต้องทำก่อน)

| # | ไฟล์ | วิธีแก้ไข |
|---|------|----------|
| 1 | `app/api/inventory-balances/reset-reservations/route.ts` | `withAdminAuth` |
| 2 | `app/api/moves/quick-move/route.ts` | `withAuth` |
| 3 | `app/api/admin/migrate-supplier/route.ts` | `withAdminAuth` |
| 4 | `app/api/stock-import/upload/route.ts` | `withAuth` |
| 5 | `app/api/stock-import/process/route.ts` | `withAuth` |

#### Priority 2: Master Data APIs

| # | ไฟล์ | วิธีแก้ไข |
|---|------|----------|
| 6 | `app/api/master-customer/route.ts` | `withAuth` (DELETE → `withAdminAuth`) |
| 7 | `app/api/master-supplier/route.ts` | `withAuth` (DELETE → `withAdminAuth`) |
| 8 | `app/api/master-employee/route.ts` | `withAuth` (DELETE → `withAdminAuth`) |
| 9 | `app/api/master-warehouse/route.ts` | `withAuth` (DELETE → `withAdminAuth`) |
| 10 | `app/api/master-sku/route.ts` | `withAuth` |
| 11 | `app/api/master-location/route.ts` | `withAuth` |

#### Priority 3: Operation APIs

| # | ไฟล์ | วิธีแก้ไข |
|---|------|----------|
| 12 | `app/api/orders/route.ts` | `withAuth` |
| 13 | `app/api/orders/[id]/route.ts` | `withAuth` |
| 14 | `app/api/receives/route.ts` | `withAuth` |
| 15 | `app/api/loadlists/route.ts` | `withAuth` |
| 16 | `app/api/picklists/route.ts` | `withAuth` |
| 17 | `app/api/bonus-face-sheets/route.ts` | `withAuth` |
| 18 | `app/api/face-sheets/generate/route.ts` | `withAuth` |

#### Priority 4: Mobile APIs (ระวังเป็นพิเศษ)

| # | ไฟล์ | วิธีแก้ไข |
|---|------|----------|
| 19 | `app/api/mobile/pick/scan/route.ts` | `withAuth` |
| 20 | `app/api/mobile/pick/tasks/route.ts` | `withAuth` |
| 21 | `app/api/mobile/loading/complete/route.ts` | `withAuth` |
| 22 | `app/api/mobile/loading/tasks/route.ts` | `withAuth` |
| 23 | `app/api/mobile/face-sheet/scan/route.ts` | `withAuth` |
| 24 | `app/api/mobile/bonus-face-sheet/scan/route.ts` | `withAuth` |
| 25 | `app/api/mobile/transfer/route.ts` | `withAuth` |

---

### 2.4 Template การแก้ไขแต่ละไฟล์
```typescript
// ===== TEMPLATE: แก้ไข API ให้มี Auth =====
// ไฟล์: app/api/[xxx]/route.ts

import { withAuth, withAdminAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ========================================
// STEP 1: ย้าย logic เดิมมาใส่ function แยก
// ห้ามแก้ไข logic ข้างใน!
// ========================================

async function handleGet(request: NextRequest, context: any) {
  // ===== BEGIN: ORIGINAL CODE - DO NOT MODIFY =====
  try {
    const supabase = await createClient();
    
    // ... โค้ดเดิมทั้งหมด copy มาวางตรงนี้ ...
    
  } catch (error) {
    // ... error handling เดิม ...
  }
  // ===== END: ORIGINAL CODE =====
}

async function handlePost(request: NextRequest, context: any) {
  // ===== BEGIN: ORIGINAL CODE - DO NOT MODIFY =====
  try {
    const supabase = await createClient();
    
    // ... โค้ดเดิมทั้งหมด copy มาวางตรงนี้ ...
    
  } catch (error) {
    // ... error handling เดิม ...
  }
  // ===== END: ORIGINAL CODE =====
}

// ========================================
// STEP 2: Export พร้อม Auth Wrapper
// ========================================

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);

// สำหรับ DELETE ที่ต้องการ admin only:
// export const DELETE = withAdminAuth(handleDelete);
```

---

## Phase 3: Fix Service Role Key Usage (C05, C09)

### 3.1 แก้ไข lib/database/*.ts

**วิธีแก้ไข:** เปลี่ยนจาก service role key เป็น server client
```typescript
// ❌ ก่อนแก้ไข (lib/database/receive.ts)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ❌ Bypass RLS
);

// ✅ หลังแก้ไข
import { createClient } from '@/lib/supabase/server';

export class ReceiveService {
  private supabase: any;
  
  async init() {
    this.supabase = await createClient();
  }
  
  // ... methods เดิม ใช้ this.supabase แทน
}

// หรือถ้าต้องการ service role สำหรับ admin operations:
import { createServiceClient } from '@/lib/supabase/service';

export class ReceiveService {
  // เฉพาะ operations ที่จำเป็นต้อง bypass RLS
  async adminOperation() {
    const adminClient = createServiceClient();
    // ...
  }
}
```

**ไฟล์ที่ต้องแก้ไข:**
- [ ] `lib/database/receive.ts`
- [ ] `lib/database/stock-adjustment.ts`
- [ ] `lib/database/move.ts`
- [ ] `lib/database/order-rollback.ts`
- [ ] `app/api/skus/route.ts`
- [ ] `app/api/file-uploads/route.ts`

---

## Phase 4: Fix userId Fallback (H07)

### 4.1 ลบ userId = 1 Fallback

**วิธีแก้ไข:** Return 401 แทน fallback
```typescript
// ❌ ก่อนแก้ไข
const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user

// ✅ หลังแก้ไข
const userId = await getUserIdFromCookie(cookieHeader);
if (!userId) {
  return NextResponse.json(
    { error: 'กรุณาเข้าสู่ระบบ', error_code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}
```

**ไฟล์ที่ต้องแก้ไข:**
- [ ] `app/api/mobile/pick/scan/route.ts`
- [ ] `app/api/mobile/loading/complete/route.ts`
- [ ] `app/api/mobile/face-sheet/scan/route.ts`
- [ ] `app/api/mobile/bonus-face-sheet/scan/route.ts`
- [ ] `app/api/stock-import/upload/route.ts`
- [ ] `app/api/stock-import/process/route.ts`

---

## Phase 5: Add Database Transactions (C02) - ระวังเป็นพิเศษ!

### ⚠️ คำเตือน: Phase นี้ความเสี่ยงสูง

**กฎ:**
1. ต้อง Test อย่างละเอียดก่อน deploy
2. ถ้าไม่มั่นใจ ข้ามไปก่อนได้
3. ทำทีละไฟล์ ทดสอบทันที

### 5.1 สร้าง RPC Function สำหรับ Atomic Operations

**Migration:** `supabase/migrations/XXX_add_atomic_pick_scan.sql`
```sql
-- ⚠️ CAUTION: Test thoroughly before deploying

CREATE OR REPLACE FUNCTION atomic_pick_scan(
  p_picklist_item_id INT,
  p_balance_id INT,
  p_quantity INT,
  p_user_id INT,
  p_to_location_id INT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_balance RECORD;
  v_item RECORD;
BEGIN
  -- 1. Lock และดึงข้อมูล balance
  SELECT * INTO v_balance
  FROM wms_inventory_balances
  WHERE balance_id = p_balance_id
  FOR UPDATE;
  
  -- 2. ตรวจสอบ stock พอไหม
  IF v_balance.total_piece_qty < p_quantity THEN
    -- ตรวจสอบว่าเป็น Prep Area ไหม
    IF NOT EXISTS (
      SELECT 1 FROM master_locations 
      WHERE location_id = v_balance.location_id 
      AND is_prep_area = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'message', 'สต็อคไม่พอ'
      );
    END IF;
  END IF;
  
  -- 3. Update balance
  UPDATE wms_inventory_balances
  SET 
    total_piece_qty = total_piece_qty - p_quantity,
    reserved_piece_qty = GREATEST(0, reserved_piece_qty - p_quantity),
    updated_at = NOW()
  WHERE balance_id = p_balance_id;
  
  -- 4. Insert ledger
  INSERT INTO wms_inventory_ledger (
    product_id, from_location_id, to_location_id,
    transaction_type, quantity, reference_type,
    reference_id, created_by, created_at
  ) VALUES (
    v_balance.product_id, v_balance.location_id, p_to_location_id,
    'pick', -p_quantity, 'picklist_item',
    p_picklist_item_id, p_user_id, NOW()
  );
  
  -- 5. Update picklist_item
  UPDATE picklist_items
  SET 
    picked_quantity = COALESCE(picked_quantity, 0) + p_quantity,
    status = CASE 
      WHEN COALESCE(picked_quantity, 0) + p_quantity >= quantity THEN 'picked'
      ELSE 'partial'
    END,
    updated_at = NOW()
  WHERE id = p_picklist_item_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'picked_quantity', p_quantity
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;  -- Rollback entire transaction
END;
$$ LANGUAGE plpgsql;
```

### 5.2 แก้ไข API ให้ใช้ RPC (Optional - ถ้ามั่นใจ)
```typescript
// ใน app/api/mobile/pick/scan/route.ts

// ❌ ก่อนแก้ไข: หลาย queries แยกกัน
const { error: updateError } = await supabase
  .from('wms_inventory_balances')
  .update({...});

const { error: ledgerError } = await supabase
  .from('wms_inventory_ledger')
  .insert({...});

// ✅ หลังแก้ไข: ใช้ RPC atomic
const { data: result, error } = await supabase.rpc('atomic_pick_scan', {
  p_picklist_item_id: item.id,
  p_balance_id: balance.balance_id,
  p_quantity: qtyToDeduct,
  p_user_id: userId,
  p_to_location_id: toLocationId
});

if (error || !result.success) {
  return NextResponse.json({
    error: result?.message || 'เกิดข้อผิดพลาด',
    error_code: result?.error || 'UNKNOWN'
  }, { status: 400 });
}
```

---

## Phase 6: Testing Checklist

### 6.1 Test Cases สำหรับแต่ละ Phase

#### Phase 1 Tests (Rate Limiting)
```
□ Login ปกติสำเร็จ
□ Login ผิด 5 ครั้ง → ถูก block
□ รอ 5 นาที → login ได้อีก
□ Password reset → ไม่เห็น token ใน response
```

#### Phase 2 Tests (Authentication)
```
□ เรียก API โดยไม่ login → 401 Unauthorized
□ Login แล้วเรียก API → สำเร็จ
□ Admin API + user ธรรมดา → 403 Forbidden
□ Admin API + admin user → สำเร็จ
```

#### Phase 3 Tests (Service Role Key)
```
□ APIs ทำงานปกติหลังเปลี่ยน
□ RLS policies ทำงาน
□ User เห็นเฉพาะข้อมูลที่มีสิทธิ์
```

#### Phase 4 Tests (userId Fallback)
```
□ Mobile API โดยไม่ login → 401
□ Mobile API หลัง login → สำเร็จ
□ Audit log บันทึก user ถูกต้อง
```

#### Phase 5 Tests (Transactions) - สำคัญมาก!
```
□ Pick scan ปกติสำเร็จ
□ Pick scan → error ระหว่างทาง → rollback ทั้งหมด
□ 2 users pick พร้อมกัน → ไม่มี race condition
□ Stock ไม่ติดลบ (ยกเว้น Prep Area)
□ Ledger และ Balance ตรงกัน
```

### 6.2 Regression Test - Logic เดิมต้องทำงาน
```
✅ CRITICAL: ทดสอบทุกข้อก่อน deploy

□ นำเข้าออเดอร์ (/receiving/orders)
□ สร้างใบหยิบ (/receiving/picklists)
□ หยิบสินค้า Mobile (/mobile/pick)
□ สร้างใบปะหน้าของแถม (/receiving/picklists/bonus-face-sheets)
□ สร้างใบโหลด (/receiving/loadlists)
□ แมพ BFS กับ Picklist
□ ย้ายสินค้าไปจุดพักรอโหลด
□ ยืนยันโหลด Mobile (/mobile/loading)
□ ตรวจสอบ Inventory Ledger
□ ตรวจสอบ Inventory Balances
□ รับสินค้าเข้า (/warehouse/inbound)
□ ย้ายสินค้า (/mobile/transfer)
```

---

## Execution Order

### Week 1: Low-Risk Fixes
```
Day 1: Phase 1 (Rate Limiting, Password Reset)
Day 2: สร้าง withAuth wrapper
Day 3-4: Phase 2 Priority 1 (Dangerous APIs)
Day 5: Test + Deploy
```

### Week 2: Medium-Risk Fixes
```
Day 1-2: Phase 2 Priority 2 (Master Data APIs)
Day 3-4: Phase 2 Priority 3 (Operation APIs)
Day 5: Test + Deploy
```

### Week 3: Higher-Risk Fixes
```
Day 1-2: Phase 2 Priority 4 (Mobile APIs) - ระวัง!
Day 3: Phase 3 (Service Role Key)
Day 4: Phase 4 (userId Fallback)
Day 5: Full Regression Test + Deploy
```

### Week 4: Optional High-Risk Fixes
```
Day 1-3: Phase 5 (Transactions) - ถ้ามั่นใจ
Day 4-5: Full Test + Final Deploy
```

---

## Rollback Plan

### ถ้ามีปัญหา:

1. **Revert Git Commit ทันที**
```bash
git revert HEAD
git push
```

2. **Database Migration Rollback** (ถ้ามี)
```bash
supabase db reset --linked
```

3. **แจ้ง Team ทันที**
- ปัญหาที่พบ
- ขั้นตอนที่ทำ
- ผลกระทบ

---

## สรุป Checklist ก่อน Production
```
□ Phase 1: Rate Limiting enabled
□ Phase 1: Password reset ไม่ expose token
□ Phase 2: Dangerous APIs มี auth
□ Phase 2: Master Data APIs มี auth
□ Phase 2: Operation APIs มี auth
□ Phase 2: Mobile APIs มี auth
□ Phase 3: ไม่มี service role key ใน API routes
□ Phase 4: ไม่มี userId = 1 fallback
□ Phase 5: (Optional) Transactions สำหรับ stock operations

□ ALL: Regression test ผ่านทั้งหมด
□ ALL: Logic เดิมทำงานได้ 100%
□ ALL: Frontend ใช้งานได้ปกติ
```

---

เริ่มทำงานได้เลย ทำทีละ Phase ตาม Checklist
**ห้ามรวบหลาย Phase พร้อมกัน!**