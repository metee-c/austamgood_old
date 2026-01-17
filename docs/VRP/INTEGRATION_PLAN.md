# Sprint 2.5: Integration Plan

**วันที่**: 17 มกราคม 2026  
**สถานะ**: กำลังดำเนินการ

---

## 🎯 เป้าหมาย

Integrate ทุก hooks และ components ที่สร้างใน Sprint 2 เข้ากับ `app/receiving/routes/page.tsx`

---

## 📊 Current State Analysis

### useState Count in page.tsx
จากการวิเคราะห์ `page.tsx` พบว่ามี useState มากกว่า **40+ ตัว** รวมถึง:

**List & Filters (8 states)**:
- searchTerm
- selectedStatus
- startDate, endDate
- sortField, sortDirection
- routePlans
- loading

**Create Modal (6 states)**:
- showCreateModal
- planForm
- selectedOrders
- draftOrders, draftOrderFilter
- vrpSettings

**Preview Modal (5 states)**:
- isPreviewModalOpen
- previewLoading, previewError
- previewPlan, previewTrips

**Editor (15+ states)**:
- isEditorOpen
- editorLoading, editorError
- editorPlanId, editorPlan
- editorWarehouse
- editorTrips
- selectedEditorTripId
- selectedEditorStopId
- selectedEditorOrderId
- isSplitModalOpen
- transferTripId
- editingStatusPlanId

**Other Modals (10+ states)**:
- showPrintModal, selectedPlanIdForPrint
- showEditShippingCostModal, selectedPlanIdForShippingCost
- showTransportContractModal, selectedPlanIdForContract
- showMultiPlanContractModal
- showMultiPlanTransportContractModal, multiPlanSelectedTrips, multiPlanSupplierName
- showCrossPlanTransferModal, crossPlanTransferStop, crossPlanTransferTripId

**Total**: 40+ useState hooks

---

## 🔄 Integration Strategy

### Phase 1: Setup Context & Hooks ✅
1. ✅ Created `useRoutePlanState` hook (Sprint 2)
2. ✅ Created `useDebouncedSearch` hook (Sprint 2)
3. ✅ Created `RoutePlanContext` (Sprint 2)
4. ✅ Created validation schemas (Sprint 2)
5. ✅ Created loading components (Sprint 2)
6. ✅ Created Pagination component (Sprint 2)

### Phase 2: Gradual Migration (Current)

**Step 1: Wrap with Context Provider**
```typescript
// app/receiving/routes/layout.tsx (NEW)
import { RoutePlanProvider } from './contexts/RoutePlanContext';

export default function RoutesLayout({ children }: { children: React.ReactNode }) {
  return <RoutePlanProvider>{children}</RoutePlanProvider>;
}
```

**Step 2: Replace useState with useRoutePlanState**
```typescript
// Before (40+ useState)
const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
// ... 37+ more

// After (1 hook)
const { state, actions } = useRoutePlanState();
const { plans, isLoading, filters, pagination, createModal, editor, modals } = state;
```

**Step 3: Add Debounced Search**
```typescript
// Before
<input 
  value={searchTerm} 
  onChange={(e) => setSearchTerm(e.target.value)} 
/>

// After
const { searchTerm, setSearchTerm, isSearching } = useDebouncedSearch(
  async (term) => {
    actions.setFilter('search', term);
    await fetchPlans();
  },
  { delay: 300, minLength: 2 }
);
```

**Step 4: Add Validation**
```typescript
// Before
const handleOptimize = async () => {
  // No validation
  await fetch('/api/route-plans/optimize', { ... });
}

// After
import { CreateRoutePlanSchema } from './utils/validators';

const handleOptimize = async () => {
  const validation = CreateRoutePlanSchema.safeParse(planForm);
  if (!validation.success) {
    toast.error('ข้อมูลไม่ถูกต้อง');
    return;
  }
  await fetch('/api/route-plans/optimize', { ... });
}
```

**Step 5: Add Loading States**
```typescript
// Before
{loading && <div>Loading...</div>}

// After
import { TableSkeleton, LoadingIndicator } from './components';

{isLoading && <TableSkeleton rows={10} />}
{isOptimizing && <LoadingIndicator text="กำลังคำนวณเส้นทาง..." />}
```

**Step 6: Add Pagination**
```typescript
// Before
// No pagination - shows all data

// After
import { Pagination } from './components';

<Pagination
  currentPage={pagination.page}
  totalPages={Math.ceil(pagination.total / pagination.pageSize)}
  pageSize={pagination.pageSize}
  totalItems={pagination.total}
  onPageChange={(page) => actions.setPagination({ page })}
  onPageSizeChange={(size) => actions.setPagination({ pageSize: size, page: 1 })}
/>
```

---

## 📝 Implementation Checklist

### Phase 2.1: Basic Setup
- [ ] Create `app/receiving/routes/layout.tsx` with RoutePlanProvider
- [ ] Import useRoutePlanState in page.tsx
- [ ] Replace list-related useState (plans, loading, error)
- [ ] Test: List view still works

### Phase 2.2: Filters & Search
- [ ] Replace filter useState (searchTerm, selectedStatus, dates)
- [ ] Add useDebouncedSearch hook
- [ ] Update filter UI to use new state
- [ ] Test: Filters and search work

### Phase 2.3: Create Modal
- [ ] Replace create modal useState
- [ ] Add Zod validation
- [ ] Update modal to use new state
- [ ] Test: Create flow works

### Phase 2.4: Editor
- [ ] Replace editor useState
- [ ] Update editor to use new state
- [ ] Test: Editor works

### Phase 2.5: Other Modals
- [ ] Replace modal useState (print, shipping cost, contract, etc.)
- [ ] Update modals to use new state
- [ ] Test: All modals work

### Phase 2.6: Loading & Pagination
- [ ] Add TableSkeleton to list view
- [ ] Add LoadingIndicator to async operations
- [ ] Add Pagination component
- [ ] Update API to support pagination
- [ ] Test: Loading states and pagination work

### Phase 2.7: Testing & Cleanup
- [ ] Test all features end-to-end
- [ ] Remove old useState code
- [ ] Remove unused imports
- [ ] Update documentation
- [ ] Performance testing

---

## 🚧 Challenges & Solutions

### Challenge 1: Large File Size
**Problem**: page.tsx มี 3,323 บรรทัด ยากต่อการ refactor ทีเดียว

**Solution**: Gradual migration - แทนที่ทีละส่วน ไม่ต้อง refactor ทั้งหมดพร้อมกัน

### Challenge 2: Complex State Dependencies
**Problem**: State หลายตัวมี dependencies ซับซ้อน

**Solution**: ใช้ useReducer ที่จัดการ state transitions แบบ centralized

### Challenge 3: Existing Features Must Work
**Problem**: ต้องไม่ทำให้ features เดิมพัง

**Solution**: 
- Test ทุกขั้นตอน
- Keep old code ไว้ก่อน (comment out)
- Rollback ได้ทันทีถ้ามีปัญหา

---

## 📈 Expected Results

### Before Integration
```
State Management: 40+ useState
Code Lines: 3,323 lines
Complexity: Very High
Maintainability: Low
Type Safety: 80%
```

### After Integration
```
State Management: 1 useReducer + context
Code Lines: ~2,500 lines (after cleanup)
Complexity: Medium
Maintainability: High
Type Safety: 100%
```

### Performance Improvements
- Search: -90% API calls (debounce)
- Loading UX: Better (skeletons)
- Pagination: Scalable (handles 1000+ plans)

---

## 🎯 Success Criteria

- [ ] All features work as before
- [ ] No regression bugs
- [ ] Performance improved (debounce, pagination)
- [ ] Code is more maintainable
- [ ] Type safety 100%
- [ ] Loading states everywhere
- [ ] Tests pass

---

## 📅 Timeline

**Phase 2.1-2.2**: Day 1 (4 hours)
**Phase 2.3-2.4**: Day 2 (4 hours)
**Phase 2.5-2.6**: Day 3 (4 hours)
**Phase 2.7**: Day 4 (4 hours)

**Total**: 4 days (16 hours)

---

## 🔄 Rollback Plan

ถ้ามีปัญหา:
1. Git revert to before integration
2. Keep old page.tsx as `page.tsx.backup`
3. Gradual rollback - revert ทีละส่วน

---

**สร้างโดย**: Kiro AI  
**วันที่**: 17 มกราคม 2026  
**Status**: In Progress
