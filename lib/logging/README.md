# Shadow Command Center - Logging Library

## 🔒 Golden Rule

> **Shadow system ห้ามทำให้ business operation fail ไม่ว่ากรณีใด**

- ❌ ไม่ block business logic
- ❌ ไม่ raise exception
- ❌ ไม่ rethrow error จาก logger
- ✅ fail silently (log to console only)
- ✅ timeout 2 วินาที
- ✅ fire-and-forget pattern

---

## 📁 Files

| File | Description |
|------|-------------|
| `shadow-logger.ts` | Core logger with fail-silent guarantee |
| `with-activity-log.ts` | Function wrapper for activity logging |
| `service-wrappers.ts` | Pre-wrapped service instances |
| `api-middleware.ts` | API route middleware |
| `index.ts` | All exports |

---

## 🚀 Usage

### Option 1: Use Wrapped Services (Recommended)

Replace original service imports with wrapped versions:

```typescript
// ❌ Before (no logging)
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';

// ✅ After (with automatic logging)
import { wrappedStockAdjustmentService as stockAdjustmentService } from '@/lib/logging';
```

Available wrapped services:
- `wrappedStockAdjustmentService`
- `wrappedMoveService`
- `wrappedReceiveService`
- `wrappedOrderRollbackService`

### Option 2: Quick Log (Manual)

For existing code where you can't change imports:

```typescript
import { quickLog } from '@/lib/logging';

async function someOperation() {
  const txId = await quickLog.start('MOVE', 'quick_move');
  
  try {
    // business logic เดิม 100%
    const result = await doSomething();
    quickLog.success(txId, 'STOCK_MOVE', { entityId: result.id });
    return result;
  } catch (err) {
    quickLog.failure(txId, 'STOCK_MOVE', err);
    throw err; // preserve original behavior
  }
}
```

### Option 3: API Route Middleware

For API routes:

```typescript
import { apiLog } from '@/lib/logging';

export async function POST(request: NextRequest) {
  const txId = await apiLog.start('PICK', request);
  
  try {
    // ... business logic ...
    apiLog.success(txId, 'PICK_CONFIRM', { entityId: picklistId });
    return NextResponse.json({ data: result });
  } catch (err) {
    apiLog.failure(txId, 'PICK_CONFIRM', err);
    throw err;
  }
}
```

Or wrap entire handler:

```typescript
import { withApiLog } from '@/lib/logging';

export const POST = withApiLog(
  async (request: NextRequest) => {
    // Original handler - unchanged
    return NextResponse.json({ data: result });
  },
  {
    operationType: 'ADJUSTMENT',
    activityType: 'STOCK_ADJUST_CREATE',
  }
);
```

### Option 4: Wrap Custom Functions

```typescript
import { withActivityLog } from '@/lib/logging';

const myFunctionWithLog = withActivityLog(
  async (ctx, payload) => {
    // Original logic - unchanged
    return await originalFunction(payload);
  },
  {
    operationType: 'CUSTOM',
    activityType: 'CUSTOM_ACTION',
    entityType: 'CUSTOM_ENTITY',
  }
);
```

---

## 📊 Shadow Tables

| Table | Purpose |
|-------|---------|
| `wms_transactions` | Transaction correlation registry |
| `wms_activity_logs` | Activity records |
| `wms_activity_log_items` | Item-level details |
| `wms_user_intents` | Business intent layer |
| `wms_errors` | Error capture |
| `wms_stock_snapshots` | Stock state snapshots |

---

## ⚠️ Important Notes

1. **Never await in hot paths** - Use `*Async` methods for fire-and-forget
2. **Transaction ID reuse** - Pass `transactionId` through context to avoid double-logging
3. **Don't double-log** - If service is wrapped, don't wrap API route too
4. **Read-only methods** - Not logged to reduce noise

---

## 🔍 Querying Logs

```sql
-- Recent transactions
SELECT * FROM wms_transactions 
ORDER BY started_at DESC 
LIMIT 100;

-- Errors by operation type
SELECT operation_type, COUNT(*) 
FROM wms_errors 
GROUP BY operation_type 
ORDER BY COUNT(*) DESC;

-- Failed activities
SELECT * FROM wms_activity_logs 
WHERE activity_status = 'failed' 
ORDER BY logged_at DESC;

-- User intents with failures
SELECT * FROM wms_user_intents 
WHERE items_failed > 0 
ORDER BY requested_at DESC;
```
