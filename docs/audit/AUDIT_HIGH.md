# High Priority Issues Report
## วันที่: 11 มกราคม 2026

## รายการ Issues ระดับ High (42 รายการ)

---

## H01: Missing Input Validation (12 APIs)

### รายละเอียด
APIs ไม่มีการ validate input อย่างเพียงพอ อาจทำให้เกิด unexpected behavior หรือ security issues

### Files Affected

#### 1. `app/api/orders/route.ts`
```typescript
// ⚠️ searchTerm ไม่ได้ sanitize อย่างเต็มที่
if (searchTerm) {
  const hasSpecialChars = /[|,()\\]/.test(searchTerm);
  if (!hasSpecialChars) {
    query = query.or(`order_no.ilike.%${searchTerm}%`);
  }
}
// ❌ ไม่ได้ escape % และ _ ซึ่งเป็น LIKE wildcards
```

#### 2. `app/api/loadlists/[id]/route.ts`
```typescript
// ❌ รับ body ทั้งหมดโดยไม่ validate
export async function PUT(request: NextRequest, { params }) {
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('loadlists')
    .update({
      ...body,  // ⚠️ อาจมี fields ที่ไม่ควร update
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
}
```

#### 3. `app/api/mobile/loading/update-status/route.ts`
```typescript
// ❌ ไม่ validate scanned_code format
const { loadlist_id, picklist_id, scanned_code } = body;

if (!loadlist_id || !picklist_id || !scanned_code) {
  return NextResponse.json({ error: '...' }, { status: 400 });
}
// ⚠️ scanned_code อาจเป็นอะไรก็ได้
```

### Recommended Fix
```typescript
import { z } from 'zod';

const updateLoadlistSchema = z.object({
  vehicle_id: z.string().optional(),
  driver_employee_id: z.number().optional(),
  loading_queue_number: z.number().optional(),
  // ... only allowed fields
}).strict();  // Reject unknown fields

export async function PUT(request: NextRequest, { params }) {
  const body = await request.json();
  const validation = updateLoadlistSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json({ 
      error: 'Invalid payload', 
      details: validation.error.errors 
    }, { status: 400 });
  }
  
  // Use validated data
  const { data, error } = await supabase
    .from('loadlists')
    .update(validation.data)
    .eq('id', id);
}
```

---

## H02: Missing Authorization Checks (8 APIs)

### รายละเอียด
APIs ไม่ตรวจสอบว่า user มีสิทธิ์ทำ action นั้นหรือไม่

### Files Affected

#### 1. `app/api/stock-adjustments/[id]/route.ts`
```typescript
// ⚠️ ใช้ supabase.auth.getUser() แทน session validation
export async function GET(request: NextRequest, { params }) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ❌ ไม่ตรวจสอบว่า user มีสิทธิ์ดู adjustment นี้หรือไม่
  const { data: adjustment } = await stockAdjustmentService.getAdjustmentById(adjustmentId);
}
```

#### 2. `app/api/orders/[id]/route.ts`
```typescript
// ❌ ไม่ตรวจสอบ ownership/permission
export async function PATCH(request: NextRequest, { params }) {
  // ไม่มี auth check เลย
  const { data, error } = await supabase
    .from('wms_orders')
    .update(updateData)
    .eq('order_id', parseInt(id));
  // ใครก็ได้สามารถแก้ไข order ใดก็ได้
}
```

### Recommended Fix
```typescript
import { authenticateRequest } from '@/lib/auth/middleware';

export async function PATCH(request: NextRequest, { params }) {
  // 1. Authenticate
  const auth = await authenticateRequest(request, {
    requiredPermissions: ['orders.edit']
  });
  if (!auth.success) return auth.response;
  
  // 2. Check ownership/permission
  const { data: order } = await supabase
    .from('wms_orders')
    .select('created_by, warehouse_id')
    .eq('order_id', id)
    .single();
  
  // Check if user can edit this order
  const canEdit = await checkOrderPermission(auth.user, order);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // 3. Proceed with update
}
```

---

## H03: Inconsistent Authentication Methods (10 APIs)

### รายละเอียด
APIs ใช้วิธี authentication ที่แตกต่างกัน ทำให้ยากต่อการ maintain และอาจมี security gaps

### Comparison Table

| File | Method | Status |
|------|--------|--------|
| `app/api/stock-adjustments/route.ts` | Session cookie + RPC | ✅ ถูกต้อง |
| `app/api/stock-adjustments/[id]/route.ts` | `supabase.auth.getUser()` | ❌ ไม่ consistent |
| `app/api/stock-adjustments/[id]/approve/route.ts` | Session cookie + RPC | ✅ ถูกต้อง |
| `app/api/orders/route.ts` | ไม่มี | ❌ ไม่มี auth |
| `app/api/receives/route.ts` | ไม่มี | ❌ ไม่มี auth |
| `app/api/loadlists/route.ts` | ไม่มี | ❌ ไม่มี auth |
| `app/api/mobile/pick/scan/route.ts` | Cookie + fallback | ⚠️ มี fallback |
| `app/api/mobile/loading/complete/route.ts` | Cookie + fallback | ⚠️ มี fallback |

### Issues with `supabase.auth.getUser()`
```typescript
// ❌ ใช้ Supabase Auth แทน custom session
const { data: { user }, error: authError } = await supabase.auth.getUser();

// Problems:
// 1. ไม่ใช้ custom session system ที่สร้างไว้
// 2. ไม่มี session timeout control
// 3. ไม่มี audit logging
```

### Issues with Fallback
```typescript
// ⚠️ Fallback to system user ถ้าไม่มี session
const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user

// Problems:
// 1. ถ้า cookie หาย จะใช้ system user
// 2. Audit trail จะไม่ถูกต้อง
```

### Recommended Fix
```typescript
// สร้าง standard authentication pattern
import { authenticateRequest } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  // ✅ ใช้ standard authentication
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return auth.response;
  }
  
  // ✅ ใช้ user_id จาก session
  const userId = auth.user!.user_id;
  
  // ... continue with authenticated request
}
```

---

## H04: Missing Duplicate Prevention (6 APIs)

### รายละเอียด
APIs ไม่ป้องกัน duplicate submissions ทำให้อาจสร้าง records ซ้ำ

### Files Affected

#### 1. `app/api/orders/route.ts`
```typescript
// ❌ ไม่มี idempotency key
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // ไม่มีการตรวจสอบว่า order นี้ถูกสร้างไปแล้วหรือไม่
  const { data: orderData } = await supabase
    .from('wms_orders')
    .insert({...})
    .select()
    .single();
}
```

#### 2. `app/api/loadlists/route.ts`
```typescript
// ❌ ไม่มี idempotency key
export async function POST(request: NextRequest) {
  // ถ้า user กด submit 2 ครั้ง จะสร้าง 2 loadlists
}
```

### Recommended Fix
```typescript
// Option 1: Idempotency Key
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('X-Idempotency-Key');
  
  if (idempotencyKey) {
    // Check if request was already processed
    const { data: existing } = await supabase
      .from('idempotency_keys')
      .select('response')
      .eq('key', idempotencyKey)
      .single();
    
    if (existing) {
      return NextResponse.json(existing.response);
    }
  }
  
  // Process request and store result
  const result = await processRequest(body);
  
  if (idempotencyKey) {
    await supabase
      .from('idempotency_keys')
      .insert({ key: idempotencyKey, response: result });
  }
  
  return NextResponse.json(result);
}

// Option 2: Unique Constraint + Upsert
const { data, error } = await supabase
  .from('wms_orders')
  .upsert({
    order_no: generatedOrderNo,
    ...body
  }, {
    onConflict: 'order_no',
    ignoreDuplicates: true
  });
```

---

## H05: Missing Foreign Key Validation (5 APIs)

### รายละเอียด
APIs ไม่ validate ว่า foreign key references มีอยู่จริงหรือไม่

### Files Affected

#### 1. `app/api/orders/route.ts`
```typescript
// ❌ ไม่ validate customer_id
const { data: orderData } = await supabase
  .from('wms_orders')
  .insert({
    customer_id: body.customer_id,  // อาจไม่มีอยู่จริง
    ...
  });
// Database จะ error ถ้า FK constraint มี แต่ error message ไม่ user-friendly
```

#### 2. `app/api/receives/route.ts`
```typescript
// ❌ ไม่ validate supplier_id, warehouse_id
const { data: header } = await this.supabase
  .from('wms_receives')
  .insert({
    supplier_id: payload.supplier_id,  // อาจไม่มีอยู่จริง
    warehouse_id: payload.warehouse_id,  // อาจไม่มีอยู่จริง
    ...
  });
```

### Recommended Fix
```typescript
// Validate foreign keys before insert
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Validate customer exists
  const { data: customer } = await supabase
    .from('master_customer')
    .select('customer_id')
    .eq('customer_id', body.customer_id)
    .single();
  
  if (!customer) {
    return NextResponse.json({
      error: 'Invalid customer_id',
      details: `Customer ${body.customer_id} not found`
    }, { status: 400 });
  }
  
  // Validate warehouse exists
  const { data: warehouse } = await supabase
    .from('master_warehouse')
    .select('warehouse_id')
    .eq('warehouse_id', body.warehouse_id)
    .single();
  
  if (!warehouse) {
    return NextResponse.json({
      error: 'Invalid warehouse_id',
      details: `Warehouse ${body.warehouse_id} not found`
    }, { status: 400 });
  }
  
  // Proceed with insert
}
```

---

## H06: No Transaction Handling in Face Sheet/Bonus Face Sheet Creation (NEW)

### รายละเอียด
Face Sheet และ Bonus Face Sheet creation ไม่มี database transaction ทำให้อาจมี orphan records

### Files Affected

#### 1. `app/api/bonus-face-sheets/route.ts`
```typescript
// ❌ สร้าง packages และ items แยกกัน
export async function POST(request: NextRequest) {
  // Step 1: Create package
  const { data: packageData } = await supabase
    .from('bonus_face_sheet_packages')
    .insert({...})
    .select()
    .single();
  
  // Step 2: Create items (อาจ fail)
  const { data: itemsData, error: itemsError } = await supabase
    .from('bonus_face_sheet_items')
    .insert(items);
  
  // ถ้า Step 2 fail, package จะถูกสร้างแล้วแต่ไม่มี items
}
```

#### 2. `app/api/face-sheets/generate/route.ts`
```typescript
// ❌ Stock reservation แยกจาก face sheet creation
// ถ้า reservation fail หลัง face sheet สร้างแล้ว จะมี face sheet ที่ไม่มี stock
```

### Recommended Fix
```sql
-- สร้าง RPC function สำหรับ atomic operation
CREATE OR REPLACE FUNCTION create_bonus_face_sheet_with_items(
  p_package_data JSONB,
  p_items_data JSONB[]
) RETURNS JSONB AS $
DECLARE
  v_package_id INT;
  v_result JSONB;
BEGIN
  -- Insert package
  INSERT INTO bonus_face_sheet_packages (...)
  VALUES (...)
  RETURNING id INTO v_package_id;
  
  -- Insert items
  INSERT INTO bonus_face_sheet_items (package_id, ...)
  SELECT v_package_id, ...
  FROM unnest(p_items_data);
  
  RETURN jsonb_build_object('package_id', v_package_id);
EXCEPTION WHEN OTHERS THEN
  RAISE;  -- Rollback entire transaction
END;
$ LANGUAGE plpgsql;
```

---

## H07: Inconsistent User Context Tracking (NEW)

### รายละเอียด
หลาย APIs ใช้ `userId = 1` เป็น fallback ทำให้ audit trail ไม่ถูกต้อง

### Files Affected

| File | Line | Issue |
|------|------|-------|
| `app/api/mobile/face-sheet/scan/route.ts` | ~10 | `userId = 1` fallback |
| `app/api/mobile/bonus-face-sheet/scan/route.ts` | ~10 | `userId = 1` fallback |
| `app/api/stock-import/process/route.ts` | ~30 | `userId = 1` fallback |
| `app/api/stock-import/upload/route.ts` | ~70 | `userId = 1` hardcoded |
| `app/api/moves/quick-move/route.ts` | - | ไม่มี user context เลย |
| `app/api/file-uploads/route.ts` | ~100 | `created_by: 'system'` hardcoded |

### Example
```typescript
// ❌ Fallback to system user
const userId = await getUserIdFromCookie(cookieHeader) || 1;

// Problems:
// 1. ถ้า cookie หาย จะใช้ system user
// 2. Audit trail จะไม่ถูกต้อง
// 3. ไม่รู้ว่าใครทำจริงๆ
```

### Recommended Fix
```typescript
// ✅ ต้อง return 401 ถ้าไม่มี session
const userId = await getUserIdFromCookie(cookieHeader);

if (!userId) {
  return NextResponse.json({
    error: 'Unauthorized',
    error_code: 'NO_SESSION'
  }, { status: 401 });
}

// ✅ ใช้ userId จาก session เท่านั้น
await setDatabaseUserContext(supabase, userId);
```

---

## H08: Missing Rate Limiting on Critical APIs (NEW)

### รายละเอียด
Critical APIs ไม่มี rate limiting ทำให้สามารถ abuse ได้

### Files Affected

| File | Issue |
|------|-------|
| `app/api/auth/login/route.ts` | Rate limiting ถูก disable ใน auth-service.ts |
| `app/api/mobile/pick/scan/route.ts` | ไม่มี rate limiting |
| `app/api/mobile/loading/complete/route.ts` | ไม่มี rate limiting |
| `app/api/stock-import/upload/route.ts` | ไม่มี rate limiting |
| `app/api/file-uploads/route.ts` | ไม่มี rate limiting |

### Recommended Fix
```typescript
import { rateLimit } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, {
    maxRequests: 10,
    windowMs: 60000  // 10 requests per minute
  });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json({
      error: 'Too many requests',
      retryAfter: rateLimitResult.retryAfter
    }, { status: 429 });
  }
  
  // ... continue
}
```

---

## Updated Summary

| Issue Code | Count | Severity | Effort to Fix |
|------------|-------|----------|---------------|
| H01 | 12 APIs | High | Medium |
| H02 | 8 APIs | High | Medium |
| H03 | 10 APIs | High | Low |
| H04 | 6 APIs | High | Medium |
| H05 | 5 APIs | High | Low |
| H06 | 3 APIs | High | High |
| H07 | 6 APIs | High | Low |
| H08 | 5 APIs | High | Low |

**Total High Issues: 55**

### Priority Order for Fixing:
1. **H07 - User Context Tracking** (Low effort - ลบ fallback, return 401)
2. **H08 - Rate Limiting** (Low effort - enable rate limiting)
3. **H03 - Inconsistent Auth** (Low effort - standardize)
4. **H05 - FK Validation** (Low effort - add checks)
5. **H01 - Input Validation** (Medium effort - add Zod schemas)
6. **H02 - Authorization** (Medium effort - add permission checks)
7. **H04 - Duplicate Prevention** (Medium effort - add idempotency)
8. **H06 - Transactions** (High effort - requires RPC functions)
