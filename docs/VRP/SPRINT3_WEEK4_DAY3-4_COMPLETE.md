# Sprint 3 Week 4 Day 3-4: Extract API Layer - เสร็จสมบูรณ์

> **วันที่:** 17 มกราคม 2026  
> **Sprint:** Sprint 3 Week 4 Day 3-4  
> **เป้าหมาย:** Extract API Layer (~8h)  
> **สถานะ:** ✅ เสร็จสมบูรณ์

---

## 📋 สรุปงานที่ทำ

### ✅ API Layer ที่สร้างเสร็จแล้ว (4 ไฟล์)

1. **`api/types.ts`** - API Types
   - Request types (FetchRoutePlansParams, CreateRoutePlanRequest, etc.)
   - Response types (ApiResponse, PaginatedResponse, etc.)
   - Error types (ApiError, ErrorResponse)
   - ~120 บรรทัด

2. **`api/routePlans.ts`** - Route Plans API
   - fetchRoutePlans() - ดึงรายการแผน
   - fetchRoutePlanById() - ดึงแผนเดียว
   - createRoutePlan() - สร้างแผนใหม่
   - updateRoutePlan() - อัปเดตแผน
   - deleteRoutePlan() - ลบแผน
   - checkCanDelete() - ตรวจสอบก่อนลบ
   - fetchEditorData() - ดึงข้อมูล editor
   - saveEditorData() - บันทึก editor
   - fetchDraftOrders() - ดึงออเดอร์ร่าง
   - fetchNextPlanCode() - ดึงรหัสแผนถัดไป
   - และอื่นๆ อีก 10+ functions
   - ~280 บรรทัด

3. **`api/optimization.ts`** - VRP Optimization API
   - optimizeRoutePlan() - คำนวณเส้นทาง
   - previewOptimization() - ดูตัวอย่างผลลัพธ์
   - reoptimizePlan() - คำนวณใหม่
   - calculateRouteMetrics() - คำนวณ metrics
   - validateOptimizationSettings() - ตรวจสอบ settings
   - ~100 บรรทัด

4. **`api/index.ts`** - Export all API functions
   - Export ทุก function
   - Re-export commonly used functions
   - ~20 บรรทัด

**รวม:** ~520 บรรทัด

---

## 📁 โครงสร้างไฟล์ที่สร้าง

```
app/receiving/routes/api/
├── index.ts                  # ✅ Export all (20 lines)
├── types.ts                  # ✅ API types (120 lines)
├── routePlans.ts             # ✅ Route plans API (280 lines)
└── optimization.ts           # ✅ VRP optimization API (100 lines)
```

---

## 🎯 ประโยชน์ที่ได้รับ

### 1. Centralize API Calls
**Before:**
```typescript
// ใน hook แต่ละตัว
const response = await fetch('/api/route-plans', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
if (!response.ok) {
  throw new Error('Failed');
}
const result = await response.json();
```

**After:**
```typescript
// ใช้ API layer
import { fetchRoutePlans } from '../api';

const result = await fetchRoutePlans(params, signal);
// Error handling ทำใน API layer แล้ว
```

### 2. Type-Safe API Layer
- ทุก request/response มี types ชัดเจน
- TypeScript จะ catch errors ตอน compile
- Autocomplete ใน IDE

### 3. Consistent Error Handling
- Error handling อยู่ใน API layer
- Custom ApiError class
- Status codes และ error details

### 4. Reusable & Testable
- API functions สามารถ test แยกได้
- Mock ได้ง่าย
- ใช้ซ้ำได้ในหลาย hooks

### 5. Easy to Maintain
- แก้ API endpoint ที่เดียว
- เพิ่ม logging/monitoring ที่เดียว
- เปลี่ยน error handling ที่เดียว

---

## 🔧 API Functions

### Route Plans API (routePlans.ts)

#### Core CRUD Operations
```typescript
// Fetch plans with filters & pagination
fetchRoutePlans(params, signal?)

// Fetch single plan
fetchRoutePlanById(planId, signal?)

// Create new plan
createRoutePlan(data)

// Update plan
updateRoutePlan(planId, data)

// Delete plan
deleteRoutePlan(planId)

// Check if can delete
checkCanDelete(planId)
```

#### Editor Operations
```typescript
// Fetch editor data
fetchEditorData(planId, signal?)

// Save editor changes (batch update)
saveEditorData(planId, data)

// Fetch draft orders
fetchDraftOrders(warehouseId, planDate?, forEditor?, signal?)

// Fetch next plan code
fetchNextPlanCode(planDate)
```

#### Additional Operations
```typescript
// Fetch trips for plan
fetchPlanTrips(planId, signal?)

// Add order to plan
addOrderToPlan(planId, orderId)

// Split stop
splitStop(planId, data)

// Cross-plan transfer
crossPlanTransfer(data)

// Fetch trips by supplier
fetchTripsBySupplier(supplierName, signal?)

// Fetch all trips
fetchAllTrips(signal?)

// Fetch published plans
fetchPublishedPlans(signal?)
```

### Optimization API (optimization.ts)

```typescript
// Optimize route plan
optimizeRoutePlan(data)

// Preview optimization
previewOptimization(data)

// Re-optimize existing plan
reoptimizePlan(planId, settings?)

// Calculate route metrics
calculateRouteMetrics(trips)

// Validate settings
validateOptimizationSettings(settings)
```

---

## 📊 API Types

### Request Types

```typescript
interface FetchRoutePlansParams {
  page?: number;
  pageSize?: number;
  warehouseId?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string;
}

interface CreateRoutePlanRequest {
  plan_code: string;
  plan_name: string;
  plan_date: string;
  warehouse_id: string;
  order_ids: number[];
  settings?: Record<string, any>;
}

interface OptimizeRoutePlanRequest {
  plan: {
    plan_code: string;
    plan_name: string;
    plan_date: string;
    warehouse_id: string;
  };
  order_ids: number[];
  settings: Record<string, any>;
}
```

### Response Types

```typescript
interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface EditorDataResponse {
  plan: any;
  warehouse: {
    latitude: number;
    longitude: number;
    name?: string | null;
  } | null;
  trips: EditorTrip[];
}
```

### Error Types

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

---

## 🔄 Hooks Integration

### Before (Direct Fetch)

```typescript
// useRoutePlans.ts
const fetchPlans = async () => {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  // ... build params
  
  const response = await fetch(`/api/route-plans?${params}`, { signal });
  if (!response.ok) throw new Error('Failed');
  const result = await response.json();
  setPlans(result.data);
};
```

### After (API Layer)

```typescript
// useRoutePlans.ts
import { fetchRoutePlans, ApiError } from '../api';

const fetchPlans = async () => {
  try {
    const result = await fetchRoutePlans(
      { page, pageSize, ...filters },
      signal
    );
    setPlans(result.data);
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.message);
    }
  }
};
```

---

## 📝 Usage Examples

### Example 1: Fetch Route Plans

```typescript
import { fetchRoutePlans } from '@/app/receiving/routes/api';

// Simple fetch
const result = await fetchRoutePlans();

// With filters
const result = await fetchRoutePlans({
  page: 1,
  pageSize: 20,
  warehouseId: 'WH001',
  status: 'draft',
  search: 'PLAN-001',
});

// With AbortSignal
const controller = new AbortController();
const result = await fetchRoutePlans(params, controller.signal);
```

### Example 2: Create Route Plan

```typescript
import { createRoutePlan } from '@/app/receiving/routes/api';

const result = await createRoutePlan({
  plan_code: 'PLAN-001',
  plan_name: 'แผนทดสอบ',
  plan_date: '2026-01-17',
  warehouse_id: 'WH001',
  order_ids: [1, 2, 3],
  settings: { maxStops: 10 },
});

if (result.error) {
  console.error(result.error);
} else {
  console.log('Created:', result.data);
}
```

### Example 3: Optimize Route Plan

```typescript
import { optimizeRoutePlan } from '@/app/receiving/routes/api';

try {
  const result = await optimizeRoutePlan({
    plan: {
      plan_code: 'PLAN-001',
      plan_name: 'แผนทดสอบ',
      plan_date: '2026-01-17',
      warehouse_id: 'WH001',
    },
    order_ids: [1, 2, 3, 4, 5],
    settings: {
      maxStopsPerTrip: 10,
      algorithm: 'genetic',
    },
  });
  
  console.log('Optimization result:', result.data);
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 408) {
      console.error('Timeout:', err.message);
    } else {
      console.error('Error:', err.message);
    }
  }
}
```

### Example 4: Error Handling

```typescript
import { fetchRoutePlans, ApiError } from '@/app/receiving/routes/api';

try {
  const result = await fetchRoutePlans(params);
  // Success
} catch (err) {
  if (err instanceof ApiError) {
    // API error with status code
    console.error(`Error ${err.status}: ${err.message}`);
    if (err.details) {
      console.error('Details:', err.details);
    }
  } else if (err.name === 'AbortError') {
    // Request was aborted
    console.log('Request cancelled');
  } else {
    // Other errors
    console.error('Unknown error:', err);
  }
}
```

---

## ✅ Checklist

- [x] สร้าง `api/types.ts` - API types
- [x] สร้าง `api/routePlans.ts` - Route plans API (20+ functions)
- [x] สร้าง `api/optimization.ts` - VRP optimization API
- [x] สร้าง `api/index.ts` - Export all
- [x] อัปเดต `useRoutePlans` ให้ใช้ API layer
- [x] อัปเดต `useEditorData` ให้ใช้ API layer
- [x] อัปเดต `useOptimization` ให้ใช้ API layer
- [x] เพิ่ม error handling ด้วย ApiError
- [x] เพิ่ม TypeScript types ครบถ้วน
- [x] เขียนเอกสาร usage examples

---

## 🔜 Next Steps (Week 4 Day 5)

### Final Integration + Testing (~4h)

Tasks:
1. **Integration Testing**
   - Test API layer กับ hooks
   - Test error handling
   - Test AbortController

2. **Bug Fixes**
   - แก้ bugs ที่เจอจาก testing
   - ตรวจสอบ TypeScript errors

3. **Documentation**
   - อัปเดต README
   - เขียน API documentation
   - สรุป Sprint 3 ทั้งหมด

4. **Final Polish**
   - Code review
   - Performance check
   - Clean up unused code

เป้าหมาย:
- ✅ API layer ทำงานได้ 100%
- ✅ Hooks ใช้ API layer แทน direct fetch
- ✅ Error handling consistent
- ✅ TypeScript types ครบถ้วน
- ✅ Documentation ครบ

---

## 📈 Progress Summary

### Sprint 3 Overall Progress

| Week | Task | Status | Lines |
|------|------|--------|-------|
| W3-D1-2 | Extract RoutesPlanTable | ✅ Done | ~720 |
| W3-D3-4 | Extract CreatePlanModal | ✅ Done | ~330 |
| W3-D5 | Extract ExcelEditor | ✅ Done | ~130 |
| W4-D1-2 | Extract Hooks | ✅ Done | ~846 |
| **W4-D3-4** | **Extract API Layer** | **✅ Done** | **~520** |
| W4-D5 | Final Integration | ⏳ Next | - |

**Total Extracted:** ~2,546 lines  
**page.tsx Size:** ~2,569 lines → Target ~200-300 lines

---

## 🎉 สรุป

✅ **สร้าง API layer ครบ 4 ไฟล์** (~520 บรรทัด)  
✅ **Centralize API calls** (20+ functions)  
✅ **Type-safe API layer** (TypeScript types ครบถ้วน)  
✅ **Consistent error handling** (ApiError class)  
✅ **อัปเดต hooks ให้ใช้ API layer**  
✅ **Reusable & Testable**  

**Benefits:**
- แก้ API endpoint ที่เดียว
- Error handling consistent
- Type-safe
- Easy to test
- Easy to maintain

**Next:** Final Integration + Testing (W4-D5)

---

**สร้างโดย:** Kiro AI  
**วันที่:** 17 มกราคม 2026  
**Version:** 1.0
