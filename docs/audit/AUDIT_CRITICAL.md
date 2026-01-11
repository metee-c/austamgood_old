# Critical Issues Report
## วันที่: 11 มกราคม 2026 (Updated)

## รายการ Issues ระดับ Critical (21 รายการ)

---

## C01: Missing Authentication (15+ APIs)

### รายละเอียด
APIs ต่อไปนี้ไม่มีการตรวจสอบ authentication ทำให้ใครก็ได้สามารถเรียกใช้งานได้

### Files Affected

#### 1. `app/api/orders/route.ts`
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // ... query directly without auth
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    // ... insert directly without auth
  }
}
```

**Impact:** ใครก็ได้สามารถดูและสร้าง orders ได้

#### 2. `app/api/orders/[id]/route.ts`
```typescript
// ❌ ไม่มี authentication check
export async function PATCH(request: NextRequest, { params }) {
  // ... update directly without auth
}
```

**Impact:** ใครก็ได้สามารถแก้ไข order status ได้

#### 3. `app/api/receives/route.ts`
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) {
  // ... query directly without auth
}

export async function POST(request: NextRequest) {
  // ... insert directly without auth
}
```

**Impact:** ใครก็ได้สามารถดูและสร้างใบรับสินค้าได้

#### 4. `app/api/loadlists/route.ts`
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) {
  // ... query directly without auth
}

export async function POST(request: NextRequest) {
  // ... insert directly without auth
}
```

**Impact:** ใครก็ได้สามารถดูและสร้างใบโหลดได้

#### 5. `app/api/mobile/pick/tasks/route.ts`
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) {
  // ... query directly without auth
}
```

**Impact:** ใครก็ได้สามารถดูรายการงานหยิบสินค้าได้

#### 6. `app/api/mobile/loading/tasks/route.ts`
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) {
  // ... query directly without auth
}
```

**Impact:** ใครก็ได้สามารถดูรายการงานโหลดสินค้าได้

#### 7. `app/api/moves/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

**Impact:** ใครก็ได้สามารถดูและสร้างใบย้ายสินค้าได้

#### 8. `app/api/moves/quick-move/route.ts` (NEW - CRITICAL!)
```typescript
// ❌ ไม่มี authentication check - ย้ายสต็อคได้โดยไม่ต้อง login!
export async function POST(request: NextRequest) {
  const { pallet_id, to_location_id } = body;
  // ... move stock directly without auth
}
```

**Impact:** ใครก็ได้สามารถย้ายสต็อคได้โดยไม่ต้อง login - อันตรายมาก!

#### 9. `app/api/bonus-face-sheets/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

**Impact:** ใครก็ได้สามารถดูและสร้างใบปะหน้าของแถมได้

#### 10. `app/api/face-sheets/generate/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

**Impact:** ใครก็ได้สามารถสร้างใบปะหน้าและจองสต็อคได้

#### 11. `app/api/picklists/create-from-trip/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function POST(request: NextRequest) { ... }
```

**Impact:** ใครก็ได้สามารถสร้าง picklist และจองสต็อคได้

#### 12. `app/api/replenishment/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

**Impact:** ใครก็ได้สามารถดูและสร้างงานเติมสินค้าได้

#### 13. `app/api/route-plans/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: Request) { ... }
export async function POST(request: Request) { ... }
```

**Impact:** ใครก็ได้สามารถดูและสร้างแผนเส้นทางได้

#### 14. `app/api/stock-count/sessions/route.ts` (NEW)
```typescript
// ❌ ไม่มี authentication check
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

**Impact:** ใครก็ได้สามารถสร้าง stock count session ได้

### Recommended Fix
```typescript
import { authenticateRequest } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  // ✅ Add authentication
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return auth.response;
  }
  
  const supabase = await createClient();
  // ... continue with authenticated request
}
```

---

## C06: Dangerous Admin APIs Without Protection (NEW)

### รายละเอียด
Admin APIs ที่อันตรายมากไม่มี authentication หรือ authorization

### Files Affected

#### 1. `app/api/inventory-balances/reset-reservations/route.ts`
```typescript
// ❌ CRITICAL: ล้างยอดจองทั้งหมดโดยไม่มี authentication!
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // ล้างยอดจองทั้งหมดในระบบ
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, ...')
    .or('reserved_pack_qty.gt.0,reserved_piece_qty.gt.0');
  
  for (const balance of balances) {
    await supabase
      .from('wms_inventory_balances')
      .update({
        reserved_pack_qty: 0,
        reserved_piece_qty: 0
      })
      .eq('balance_id', balance.balance_id);
  }
}
```

**Impact:** 
- ใครก็ได้สามารถล้างยอดจองทั้งหมดในระบบได้
- ทำให้ stock ที่จองไว้สำหรับ orders ถูกปล่อย
- อาจทำให้ orders ที่กำลัง process มีปัญหา

### Recommended Fix
```typescript
import { authenticateRequest } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  // ✅ Add authentication
  const auth = await authenticateRequest(request, {
    requiredRole: 'admin',  // Only admin can reset
    requiredPermissions: ['system.admin']
  });
  
  if (!auth.success) {
    return auth.response;
  }
  
  // Log who performed the reset
  await logAuditEntry({
    user_id: auth.user.user_id,
    action: 'RESET_ALL_RESERVATIONS',
    entity_type: 'INVENTORY',
    ip_address: getClientIP(request)
  });
  
  // ... proceed with reset
}
```

---

## C02: No Transaction Handling (3 APIs)

### รายละเอียด
Stock operations ไม่มี database transaction ทำให้ถ้าเกิด error ระหว่างทาง ข้อมูลจะไม่ consistent

### Files Affected

#### 1. `app/api/mobile/pick/scan/route.ts`
**Lines:** 1-500+
```typescript
// ❌ ไม่มี transaction - operations แยกกัน
// 1. Update balance (อาจสำเร็จ)
const { error: updateError } = await supabase
  .from('wms_inventory_balances')
  .update({...})
  .eq('balance_id', balance.balance_id);

// 2. Insert ledger (อาจ fail)
const { error: ledgerError } = await supabase
  .from('wms_inventory_ledger')
  .insert(ledgerEntries);

// 3. Update picklist_item (อาจ fail)
const { data: updatedItem, error: itemUpdateError } = await supabase
  .from('picklist_items')
  .update({...})
```

**Impact:** ถ้า step 2 หรือ 3 fail, balance จะถูก deduct แล้วแต่ ledger/item ไม่ถูก update

#### 2. `app/api/mobile/loading/complete/route.ts`
**Lines:** 1-953
```typescript
// ❌ Status update ก่อน stock movement
const { error: updateStatusError } = await supabase
  .from('loadlists')
  .update({ status: 'loaded', ... })
  .eq('id', loadlist.id);

// ... แล้วค่อย process stock movements
// ถ้า stock movement fail, loadlist จะเป็น 'loaded' แต่ stock ไม่ถูกย้าย
```

**Impact:** Loadlist status อาจไม่ตรงกับ actual stock state

### Recommended Fix
```sql
-- สร้าง RPC function สำหรับ atomic operation
CREATE OR REPLACE FUNCTION process_pick_scan(
  p_picklist_id INT,
  p_item_id INT,
  p_quantity_picked INT,
  p_user_id INT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- All operations in single transaction
  -- 1. Update balance
  -- 2. Insert ledger
  -- 3. Update picklist_item
  -- 4. Update picklist status
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql;
```

---

## C03: Race Condition in Stock Operations (2 APIs)

### รายละเอียด
ไม่มี row-level locking ทำให้ concurrent requests อาจทำให้ stock ติดลบหรือ double process

### Files Affected

#### 1. `app/api/mobile/pick/scan/route.ts`
```typescript
// ❌ ไม่มี locking - 2 users อาจ pick พร้อมกัน
const { data: balance } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, total_piece_qty, ...')
  .eq('balance_id', reservation.balance_id)
  .single();

// Time gap here - another request could read same balance

const { error: updateError } = await supabase
  .from('wms_inventory_balances')
  .update({
    total_piece_qty: balance.total_piece_qty - qtyToDeduct,
    ...
  })
  .eq('balance_id', balance.balance_id);
```

**Scenario:**
1. User A reads balance = 100
2. User B reads balance = 100
3. User A updates balance = 100 - 50 = 50
4. User B updates balance = 100 - 50 = 50 (should be 0!)

#### 2. `app/api/mobile/loading/complete/route.ts`
```typescript
// ❌ Status check ไม่ atomic
if (loadlist.status === 'loaded') {
  return NextResponse.json({ already_completed: true });
}

// Time gap here - another request could pass the check

const { error: updateStatusError } = await supabase
  .from('loadlists')
  .update({ status: 'loaded' })
  .eq('id', loadlist.id)
  .eq('status', 'pending'); // ✅ มี conditional update แต่ไม่ handle failure
```

### Recommended Fix
```sql
-- Option 1: Use SELECT FOR UPDATE
SELECT * FROM wms_inventory_balances 
WHERE balance_id = $1 
FOR UPDATE;

-- Option 2: Use optimistic locking with version column
UPDATE wms_inventory_balances 
SET total_piece_qty = total_piece_qty - $1,
    version = version + 1
WHERE balance_id = $2 
AND version = $3;  -- Fail if version changed
```

---

## C04: Negative Stock Allowed Outside Prep Areas

### รายละเอียด
Logic ป้องกัน negative stock อาจถูก bypass ได้ในบาง cases

### File: `app/api/mobile/pick/scan/route.ts`
**Lines:** ~280

```typescript
// ⚠️ Protection มีแต่อาจไม่ครอบคลุมทุก case
if (balance.total_piece_qty < qtyToDeduct) {
  const isPrepArea = await isPreparationArea(supabase, balance.location_id || item.source_location_id);
  
  if (!isPrepArea) {
    return NextResponse.json({
      error: 'สต็อคไม่พอ',
      error_code: 'INSUFFICIENT_STOCK'
    }, { status: 400 });
  }
  
  // ✅ Prep Area อนุญาตติดลบ
}

// ❌ แต่ใน FEFO fallback path (line ~350) อาจไม่มี check นี้
```

**Issue:** ใน fallback path ที่ไม่มี reservations, การ check negative stock อาจไม่ครบถ้วน

### Recommended Fix
```typescript
// สร้าง helper function ที่ใช้ทุกที่
async function validateAndDeductStock(
  supabase: any,
  balanceId: number,
  qtyToDeduct: number,
  locationId: string
): Promise<{ success: boolean; error?: string }> {
  const isPrepArea = await isPreparationArea(supabase, locationId);
  
  // Get current balance with lock
  const { data: balance } = await supabase.rpc('get_balance_for_update', {
    p_balance_id: balanceId
  });
  
  const newQty = balance.total_piece_qty - qtyToDeduct;
  
  if (newQty < 0 && !isPrepArea) {
    return { success: false, error: 'INSUFFICIENT_STOCK' };
  }
  
  // Proceed with update
  return { success: true };
}
```

---

## C05: Service Role Key Exposed

### รายละเอียด
ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรงใน application code ซึ่งมี full access ไม่ผ่าน RLS

### Files Affected

#### 1. `lib/database/receive.ts`
```typescript
// ❌ ใช้ service role key โดยตรง
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ⚠️ Full access, bypass RLS
);
```

#### 2. `lib/database/stock-adjustment.ts`
```typescript
// ❌ ใช้ service role key โดยตรง
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ⚠️ Full access, bypass RLS
);
```

#### 3. `lib/database/move.ts` (NEW)
```typescript
// ❌ ใช้ service role key โดยตรง (Line 1-6)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ⚠️ Full access, bypass RLS
);
```

**Impact:** 
- Bypass Row Level Security (RLS)
- ถ้า key leak จะมี full database access
- ไม่มี audit trail ว่าใครทำอะไร

### Recommended Fix
```typescript
// ✅ ใช้ server client ที่ respect RLS
import { createClient } from '@/lib/supabase/server';

export class ReceiveService {
  async createReceive(payload: CreateReceivePayload) {
    const supabase = await createClient();
    // ... operations will respect RLS
  }
}
```

---

## C07: Rate Limiting Disabled (NEW)

### รายละเอียด
Rate limiting ถูก disable ไว้ใน auth service ทำให้สามารถ brute force password ได้

### File: `lib/auth/auth-service.ts`
```typescript
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  // ...
  
  // Check rate limiting (TEMPORARILY DISABLED FOR TESTING)
  // const rateLimitCheck = await checkLoginRateLimit(email, ip_address || '127.0.0.1');
  // ...
  // if (!rateLimitCheck.allowed) {
  //   ...
  // }

  console.log('⚠️  [AUTH-SERVICE] Rate limiting is DISABLED for testing');
  
  // ... continues without rate limiting
}
```

**Impact:**
- สามารถ brute force password ได้ไม่จำกัด
- ไม่มีการป้องกัน credential stuffing attacks
- Account lockout mechanism ยังทำงาน แต่ rate limiting ไม่ทำงาน

### Recommended Fix
```typescript
// ✅ Enable rate limiting
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

---

## Summary

| Issue Code | Count | Severity | Effort to Fix |
|------------|-------|----------|---------------|
| C01 | 15+ APIs | Critical | Medium |
| C02 | 3 APIs | Critical | High |
| C03 | 2 APIs | Critical | High |
| C04 | 1 API | Critical | Low |
| C05 | 5 Files | Critical | Low |
| C06 | 1 API | Critical | Low |
| C07 | 1 File | Critical | Low |
| C08 | 11 APIs | Critical | Medium |
| C09 | 2 Files | Critical | Low |
| C10 | 3 APIs | Critical | Low |

**Total Critical Issues: 30**

---

## C08: ALL Master Data APIs Missing Authentication (NEW)

### รายละเอียด
Master Data APIs ทั้งหมดไม่มี authentication ทำให้ใครก็ได้สามารถแก้ไข/ลบข้อมูลหลักของระบบได้

### Files Affected

#### 1. `app/api/master-customer/route.ts`
```typescript
// ❌ ไม่มี authentication - GET/POST/PUT/DELETE ทั้งหมด
export async function GET(request: Request) { ... }
export async function POST(request: Request) { ... }
export async function PUT(request: Request) { ... }
export async function DELETE(request: Request) { ... }
```
**Impact:** ใครก็ได้สามารถดู/สร้าง/แก้ไข/ลบข้อมูลลูกค้าได้

#### 2. `app/api/master-supplier/route.ts`
```typescript
// ❌ ไม่มี authentication - GET/POST/PUT/DELETE ทั้งหมด
```
**Impact:** ใครก็ได้สามารถดู/สร้าง/แก้ไข/ลบข้อมูล supplier ได้

#### 3. `app/api/master-employee/route.ts`
```typescript
// ❌ ไม่มี authentication - GET/POST/PUT/DELETE ทั้งหมด
```
**Impact:** ใครก็ได้สามารถดู/สร้าง/แก้ไข/ลบข้อมูลพนักงานได้

#### 4. `app/api/master-warehouse/route.ts`
```typescript
// ❌ ไม่มี authentication - GET/POST/PUT/DELETE ทั้งหมด
```
**Impact:** ใครก็ได้สามารถดู/สร้าง/แก้ไข/ลบข้อมูลคลังสินค้าได้

#### 5. `app/api/master-sku/route.ts`
```typescript
// ❌ ไม่มี authentication - GET/POST ทั้งหมด
```
**Impact:** ใครก็ได้สามารถดู/สร้างข้อมูล SKU ได้

#### 6. `app/api/master-location/route.ts`
```typescript
// ❌ ไม่มี authentication
```
**Impact:** ใครก็ได้สามารถดู/สร้าง/แก้ไข/ลบข้อมูล location ได้

#### 7. `app/api/master-vehicle/route.ts`
```typescript
// ❌ ไม่มี authentication - GET
```
**Impact:** ใครก็ได้สามารถดูข้อมูลรถได้

#### 8-11. Other Master Data APIs
- `app/api/employees/route.ts` - ไม่มี authentication
- `app/api/locations/route.ts` - ไม่มี authentication
- `app/api/warehouses/route.ts` - ไม่มี authentication
- `app/api/suppliers/route.ts` - ไม่มี authentication

### Recommended Fix
```typescript
import { authenticateRequest } from '@/lib/auth/middleware';

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return auth.response;
  }
  // ... continue
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request, {
    requiredPermissions: ['master_data.create']
  });
  if (!auth.success) {
    return auth.response;
  }
  // ... continue
}

export async function DELETE(request: Request) {
  const auth = await authenticateRequest(request, {
    requiredPermissions: ['master_data.delete']
  });
  if (!auth.success) {
    return auth.response;
  }
  // ... continue
}
```

---

## C09: Service Role Key Used Directly in API Routes (NEW)

### รายละเอียด
ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรงใน API routes ซึ่ง bypass RLS ทั้งหมด

### Files Affected

#### 1. `app/api/skus/route.ts`
```typescript
// ❌ ใช้ service role key โดยตรงใน API route
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  // ... bypass RLS ทั้งหมด
}
```
**Impact:** 
- Bypass Row Level Security (RLS) ทั้งหมด
- ไม่มี authentication check
- ถ้า key leak จะมี full database access

#### 2. `app/api/file-uploads/route.ts`
```typescript
// ❌ ใช้ service role key สำหรับ file upload
const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```
**Impact:** ใครก็ได้สามารถ upload ไฟล์ได้โดยไม่ต้อง login

### Recommended Fix
```typescript
// ✅ ใช้ server client ที่ respect RLS
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  // ... operations will respect RLS
}
```

---

## C10: Admin/Migration APIs Without Protection (NEW)

### รายละเอียด
Admin APIs ที่อันตรายไม่มี authentication หรือ authorization

### Files Affected

#### 1. `app/api/admin/migrate-supplier/route.ts`
```typescript
// ❌ Admin API ไม่มี authentication
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // Insert sample data โดยไม่ตรวจสอบ
  const { data: sampleData, error: sampleError } = await supabase
    .from('master_supplier')
    .insert([...sample data...]);
}
```
**Impact:** ใครก็ได้สามารถ insert sample data เข้าระบบได้

#### 2. `app/api/stock-import/upload/route.ts`
```typescript
// ❌ ไม่มี authentication - upload stock data ได้
export async function POST(request: NextRequest) {
  // ... upload และ process stock data โดยไม่ตรวจสอบ
  const userId = 1; // ❌ Hardcoded user ID
}
```
**Impact:** ใครก็ได้สามารถ upload stock data เข้าระบบได้

#### 3. `app/api/stock-import/process/route.ts`
```typescript
// ใช้ userId = 1 fallback
const userId = await getUserIdFromCookie(cookieHeader) || 1;
```
**Impact:** ถ้าไม่มี session จะใช้ system user แทน - ไม่รู้ว่าใครทำ

### Recommended Fix
```typescript
import { authenticateRequest } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, {
    requiredRole: 'admin',
    requiredPermissions: ['system.admin']
  });
  
  if (!auth.success) {
    return auth.response;
  }
  
  // Log admin action
  await logAuditEntry({
    user_id: auth.user.user_id,
    action: 'ADMIN_MIGRATION',
    entity_type: 'SYSTEM',
    ip_address: getClientIP(request)
  });
  
  // ... proceed
}
```

---

## Updated Summary

| Issue Code | Count | Severity | Effort to Fix |
|------------|-------|----------|---------------|
| C01 | 15+ APIs | Critical | Medium |
| C02 | 3 APIs | Critical | High |
| C03 | 2 APIs | Critical | High |
| C04 | 1 API | Critical | Low |
| C05 | 5 Files | Critical | Low |
| C06 | 1 API | Critical | Low |
| C07 | 1 File | Critical | Low |
| C08 | 11 APIs | Critical | Medium |
| C09 | 2 Files | Critical | Low |
| C10 | 3 APIs | Critical | Low |

**Total Critical Issues: 30**

### Priority Order for Fixing:
1. **C06 - Dangerous Admin API** (Quick fix, highest risk - reset-reservations)
2. **C10 - Admin/Migration APIs** (Quick fix - migrate-supplier, stock-import)
3. **C07 - Rate Limiting Disabled** (Quick fix - just uncomment code)
4. **C09 - Service Role Key in API Routes** (Quick fix - skus, file-uploads)
5. **C05 - Service Role Key in Lib** (Quick fix - receive, stock-adjustment, move)
6. **C08 - Master Data APIs** (Medium effort - 11 APIs need auth)
7. **C01 - Missing Authentication** (Medium effort - 15+ APIs)
8. **C04 - Negative Stock** (Quick fix)
9. **C02 - Transactions** (High effort, requires RPC functions)
10. **C03 - Race Conditions** (High effort, requires locking strategy)
