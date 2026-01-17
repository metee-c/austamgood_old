# Sprint 3 Week 4 Day 1-2: Extract Hooks - เสร็จสมบูรณ์

> **วันที่:** 17 มกราคม 2026  
> **Sprint:** Sprint 3 Week 4 Day 1-2  
> **เป้าหมาย:** Extract Hooks (~8h)  
> **สถานะ:** ✅ เสร็จสมบูรณ์

---

## 📋 สรุปงานที่ทำ

### ✅ Hooks ที่สร้างเสร็จแล้ว (5 ไฟล์)

1. **`useRoutePlanState.ts`** - State management with useReducer
   - แทนที่ useState 50+ ตัวด้วย useReducer 1 ตัว
   - จัดการ state ทั้งหมดของหน้า routes
   - มี actions ครบถ้วนสำหรับทุก operation
   - ~391 บรรทัด

2. **`useRoutePlans.ts`** - Fetch plans with filters
   - ดึงข้อมูล route plans จาก API
   - รองรับ filters (warehouse, status, date, search)
   - รองรับ pagination
   - มี loading, error states
   - ~75 บรรทัด

3. **`useEditorData.ts`** - Fetch/save editor data
   - ดึงข้อมูล editor สำหรับแก้ไขแผน
   - Normalize ข้อมูล trips/stops/orders
   - บันทึกการเปลี่ยนแปลง
   - ตรวจสอบ unsaved changes
   - รองรับ AbortController
   - ~200 บรรทัด

4. **`useDebouncedSearch.ts`** - Search with debounce
   - Debounce search input (default 300ms)
   - รองรับ minLength
   - มี loading state
   - รองรับ AbortController
   - ~80 บรรทัด

5. **`useOptimization.ts`** - VRP optimization
   - เรียก VRP optimization API
   - ป้องกัน race condition ด้วย ref lock
   - แสดง progress (fake progress)
   - จัดการ error
   - ~90 บรรทัด

6. **`index.ts`** - Export all hooks
   - Export hooks ทั้งหมด
   - Re-export types
   - ~10 บรรทัด

---

## 📁 โครงสร้างไฟล์ที่สร้าง

```
app/receiving/routes/hooks/
├── index.ts                      # Export all hooks
├── useRoutePlanState.ts          # ✅ State management (391 lines)
├── useRoutePlans.ts              # ✅ Fetch plans (75 lines)
├── useEditorData.ts              # ✅ Editor data (200 lines)
├── useDebouncedSearch.ts         # ✅ Debounced search (80 lines)
└── useOptimization.ts            # ✅ VRP optimization (90 lines)
```

**รวม:** ~846 บรรทัด

---

## 🎯 ประโยชน์ที่ได้รับ

### 1. ลด useState จาก 50+ ตัว → 1 useReducer
**Before:**
```typescript
const [plans, setPlans] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [filters, setFilters] = useState({...});
const [pagination, setPagination] = useState({...});
const [selectedIds, setSelectedIds] = useState(new Set());
const [expandedIds, setExpandedIds] = useState(new Set());
const [createModal, setCreateModal] = useState({...});
const [editor, setEditor] = useState({...});
// ... 40+ more states
```

**After:**
```typescript
const { state, actions } = useRoutePlanState();
// ทุก state อยู่ใน state object
// ทุก action อยู่ใน actions object
```

### 2. แยก Business Logic ออกจาก Component
- Data fetching logic → `useRoutePlans`, `useEditorData`
- Optimization logic → `useOptimization`
- Search logic → `useDebouncedSearch`
- State management → `useRoutePlanState`

### 3. Reusable & Testable
- Hooks สามารถนำไปใช้ใน component อื่นได้
- เขียน unit tests ได้ง่าย
- แยก concerns ชัดเจน

### 4. ป้องกัน Bugs
- **Race Condition:** `useOptimization` ใช้ ref lock
- **Memory Leak:** ทุก hook ใช้ AbortController
- **Stale Closure:** ใช้ functional updates
- **Debounce:** `useDebouncedSearch` ป้องกัน API spam

---

## 🔧 วิธีใช้งาน Hooks

### 1. useRoutePlanState - State Management

```typescript
import { useRoutePlanState } from './hooks';

function RoutesPage() {
  const { state, actions } = useRoutePlanState();
  
  // ✅ ใช้ state
  const { plans, isLoading, filters, pagination, createModal, editor } = state;
  
  // ✅ ใช้ actions
  const handleSearch = (term: string) => {
    actions.setFilter('search', term);
  };
  
  const handleCreatePlan = () => {
    actions.openCreateModal();
  };
  
  const handleEditPlan = (planId: string) => {
    actions.openEditor(planId);
  };
  
  return (
    <div>
      {/* UI */}
    </div>
  );
}
```

### 2. useRoutePlans - Fetch Plans

```typescript
import { useRoutePlans } from './hooks';

function RoutesPage() {
  const { state } = useRoutePlanState();
  
  const { 
    plans, 
    isLoading, 
    error, 
    total, 
    fetchPlans, 
    refetch 
  } = useRoutePlans(state.filters, state.pagination);
  
  useEffect(() => {
    fetchPlans();
  }, [state.filters, state.pagination.page]);
  
  return (
    <div>
      {isLoading && <Loading />}
      {error && <Error message={error} />}
      {plans.map(plan => <PlanRow key={plan.plan_id} plan={plan} />)}
    </div>
  );
}
```

### 3. useEditorData - Editor Data

```typescript
import { useEditorData } from './hooks';

function ExcelEditor({ planId }: { planId: number }) {
  const {
    data,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    fetchEditorData,
    updateTrips,
    saveEditorData,
    resetChanges,
  } = useEditorData();
  
  useEffect(() => {
    if (planId) {
      fetchEditorData(planId);
    }
  }, [planId]);
  
  const handleSave = async () => {
    const result = await saveEditorData(planId);
    if (result.success) {
      alert('บันทึกสำเร็จ');
    }
  };
  
  return (
    <div>
      {isLoading && <Loading />}
      {data.trips.map(trip => (
        <TripRow key={trip.trip_id} trip={trip} />
      ))}
      <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving}>
        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </div>
  );
}
```

### 4. useDebouncedSearch - Debounced Search

```typescript
import { useDebouncedSearch } from './hooks';

function SearchBar() {
  const { state, actions } = useRoutePlanState();
  
  const { searchTerm, setSearchTerm, isSearching } = useDebouncedSearch(
    async (term) => {
      actions.setFilter('search', term);
      await fetchPlans();
    },
    { delay: 300, minLength: 2 }
  );
  
  return (
    <div className="relative">
      <Input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหาแผน..."
      />
      {isSearching && <Loader className="absolute right-3" />}
    </div>
  );
}
```

### 5. useOptimization - VRP Optimization

```typescript
import { useOptimization } from './hooks';

function CreatePlanModal() {
  const { state, actions } = useRoutePlanState();
  
  const { 
    isOptimizing, 
    progress, 
    result, 
    error, 
    optimize 
  } = useOptimization();
  
  const handleOptimize = async () => {
    const planData = {
      plan_code: 'PLAN-001',
      plan_name: 'แผนทดสอบ',
      plan_date: '2026-01-17',
      warehouse_id: 'WH001',
    };
    
    const orderIds = Array.from(state.createModal.selectedOrders).map(Number);
    const settings = state.createModal.vrpSettings;
    
    const result = await optimize(planData, orderIds, settings);
    
    if (result.success) {
      actions.setPreviewData(result.data);
    } else {
      alert(result.error);
    }
  };
  
  return (
    <div>
      <Button onClick={handleOptimize} disabled={isOptimizing}>
        {isOptimizing ? `กำลังคำนวณ... ${progress}%` : 'Optimize'}
      </Button>
      {error && <Error message={error} />}
      {result && <PreviewResults data={result} />}
    </div>
  );
}
```

---

## 🎨 State Structure (useRoutePlanState)

```typescript
interface RoutePlanState {
  // List view
  plans: RoutePlan[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: {
    warehouseId: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    search: string;
  };
  
  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  
  // Selected items
  selectedPlanIds: Set<string>;
  expandedPlanIds: Set<string>;
  
  // Create modal
  createModal: {
    isOpen: boolean;
    step: 'select' | 'configure' | 'preview';
    selectedOrders: Set<string>;
    vrpSettings: VRPSettings;
    isOptimizing: boolean;
    previewData: any | null;
  };
  
  // Editor
  editor: {
    isOpen: boolean;
    planId: string | null;
    data: RoutePlan | null;
    originalData: RoutePlan | null;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
    isSaving: boolean;
  };
  
  // Other modals
  modals: {
    splitStop: { isOpen: boolean; stopId: string | null };
    crossPlanTransfer: { isOpen: boolean; orderId: string | null };
    confirmDelete: { isOpen: boolean; planId: string | null };
  };
}
```

---

## 📊 Actions Available (useRoutePlanState)

### List Actions
- `setPlans(plans)` - Set route plans
- `setLoading(loading)` - Set loading state
- `setError(error)` - Set error message
- `setPagination(pagination)` - Update pagination

### Filter Actions
- `setFilter(key, value)` - Set single filter
- `resetFilters()` - Reset all filters

### Selection Actions
- `togglePlanSelection(planId)` - Toggle plan selection
- `selectAllPlans(planIds)` - Select all plans
- `clearSelection()` - Clear selection
- `togglePlanExpand(planId)` - Toggle plan expand

### Create Modal Actions
- `openCreateModal()` - Open create modal
- `closeCreateModal()` - Close create modal
- `setCreateStep(step)` - Set modal step
- `toggleOrderSelection(orderId)` - Toggle order selection
- `selectAllOrders(orderIds)` - Select all orders
- `clearOrderSelection()` - Clear order selection
- `setVrpSettings(settings)` - Update VRP settings
- `setOptimizing(optimizing)` - Set optimizing state
- `setPreviewData(data)` - Set preview data

### Editor Actions
- `openEditor(planId)` - Open editor
- `closeEditor()` - Close editor
- `setEditorData(data)` - Set editor data
- `setEditorLoading(loading)` - Set editor loading
- `setEditorSaving(saving)` - Set editor saving
- `updateEditorTrips(trips)` - Update trips
- `markEditorDirty()` - Mark as dirty
- `markEditorClean()` - Mark as clean

### Modal Actions
- `openSplitModal(stopId)` - Open split modal
- `closeSplitModal()` - Close split modal
- `openTransferModal(orderId)` - Open transfer modal
- `closeTransferModal()` - Close transfer modal
- `openDeleteModal(planId)` - Open delete modal
- `closeDeleteModal()` - Close delete modal

---

## ✅ Checklist

- [x] สร้าง `useRoutePlanState.ts` - State management
- [x] สร้าง `useRoutePlans.ts` - Fetch plans
- [x] สร้าง `useEditorData.ts` - Editor data
- [x] สร้าง `useDebouncedSearch.ts` - Debounced search
- [x] สร้าง `useOptimization.ts` - VRP optimization
- [x] สร้าง `index.ts` - Export all hooks
- [x] เขียนเอกสาร usage examples
- [x] ตรวจสอบ TypeScript types

---

## 🔜 Next Steps (Week 4 Day 3-4)

### Extract API Layer (~8h)

สร้างไฟล์:
1. `api/routePlans.ts` - API functions
   - `fetchRoutePlans(filters, pagination)`
   - `createRoutePlan(data)`
   - `updateRoutePlan(id, data)`
   - `deleteRoutePlan(id)`
   - `fetchRoutePlanById(id)`

2. `api/optimization.ts` - VRP API
   - `optimizeRoutePlan(data)`
   - `previewOptimization(data)`

3. `api/types.ts` - API types
   - Request/Response types
   - Error types

เป้าหมาย:
- แยก fetch logic ออกจาก hooks
- Centralize API calls
- Type-safe API layer
- Error handling

---

## 📈 Progress Summary

### Sprint 3 Overall Progress

| Week | Task | Status | Lines Extracted |
|------|------|--------|----------------|
| W3-D1-2 | Extract RoutesPlanTable | ✅ Done | ~720 lines |
| W3-D3-4 | Extract CreatePlanModal | ✅ Done | ~330 lines |
| W3-D5 | Extract ExcelEditor | ✅ Done | ~130 lines |
| **W4-D1-2** | **Extract Hooks** | **✅ Done** | **~846 lines** |
| W4-D3-4 | Extract API Layer | ⏳ Next | ~200 lines (est.) |
| W4-D5 | Final Integration | ⏳ Pending | - |

**Total Extracted:** ~2,026 lines  
**page.tsx Size:** ~2,569 lines → Target ~200-300 lines

---

## 🎉 สรุป

✅ **สร้าง hooks ครบ 5 ตัว** (~846 บรรทัด)  
✅ **ลด useState จาก 50+ → 1 useReducer**  
✅ **แยก business logic ออกจาก component**  
✅ **Reusable & Testable**  
✅ **ป้องกัน bugs (race condition, memory leak, stale closure)**  

**Next:** Extract API Layer (W4-D3-4)

---

**สร้างโดย:** Kiro AI  
**วันที่:** 17 มกราคม 2026  
**Version:** 1.0
