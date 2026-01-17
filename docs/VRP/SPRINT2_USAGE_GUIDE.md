# Sprint 2 Components - Usage Guide

คู่มือการใช้งาน components และ hooks ที่สร้างใน Sprint 2

---

## 📚 Table of Contents

1. [State Management](#state-management)
2. [Context API](#context-api)
3. [Validation](#validation)
4. [Search](#search)
5. [Loading States](#loading-states)
6. [Pagination](#pagination)

---

## 1. State Management

### useRoutePlanState Hook

Hook สำหรับจัดการ state ทั้งหมดของหน้า routes ด้วย useReducer

#### การใช้งานพื้นฐาน

```typescript
import { useRoutePlanState } from './hooks/useRoutePlanState';

function RoutesPage() {
  const { state, actions } = useRoutePlanState();
  
  // เข้าถึง state
  const { plans, isLoading, filters, pagination } = state;
  
  // เรียกใช้ actions
  actions.setFilter('search', 'แผน001');
  actions.setPagination({ page: 2 });
  actions.openCreateModal();
}
```

#### State Structure

```typescript
{
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
  
  // Selection
  selectedPlanIds: Set<string>;
  expandedPlanIds: Set<string>;
  
  // Modals
  createModal: { ... };
  editor: { ... };
  modals: { ... };
}
```

#### Available Actions

```typescript
// List
actions.setPlans(plans);
actions.setLoading(true);
actions.setError('Error message');
actions.setPagination({ page: 1, pageSize: 20 });

// Filters
actions.setFilter('search', 'keyword');
actions.resetFilters();

// Selection
actions.togglePlanSelection(planId);
actions.selectAllPlans(planIds);
actions.clearSelection();
actions.togglePlanExpand(planId);

// Create Modal
actions.openCreateModal();
actions.closeCreateModal();
actions.setCreateStep('preview');
actions.toggleOrderSelection(orderId);
actions.setVrpSettings({ maxStopsPerTrip: 10 });

// Editor
actions.openEditor(planId);
actions.closeEditor();
actions.updateEditorTrips(trips);
actions.markEditorDirty();

// Other Modals
actions.openSplitModal(stopId);
actions.openTransferModal(orderId);
actions.openDeleteModal(planId);
```

---

## 2. Context API

### RoutePlanContext

Context สำหรับแชร์ state โดยไม่ต้องส่ง props

#### Setup

```typescript
// app/receiving/routes/page.tsx
import { RoutePlanProvider } from './contexts/RoutePlanContext';

export default function RoutesPage() {
  return (
    <RoutePlanProvider>
      <RoutesContent />
    </RoutePlanProvider>
  );
}
```

#### การใช้งานใน Components

```typescript
// ใช้ main context
import { useRoutePlanContext } from './contexts/RoutePlanContext';

function MyComponent() {
  const { state, actions } = useRoutePlanContext();
  // ...
}
```

#### Convenience Hooks

```typescript
// ใช้เฉพาะส่วนที่ต้องการ
import { 
  useRoutePlanFilters,
  useRoutePlanPagination,
  useRoutePlanSelection,
  useRoutePlanCreateModal,
  useRoutePlanEditor,
  useRoutePlanModals
} from './contexts/RoutePlanContext';

// Example: Filters
function FilterBar() {
  const { filters, setFilter, resetFilters } = useRoutePlanFilters();
  
  return (
    <div>
      <input 
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
      />
      <button onClick={resetFilters}>รีเซ็ต</button>
    </div>
  );
}

// Example: Pagination
function PaginationBar() {
  const { pagination, setPagination } = useRoutePlanPagination();
  
  return (
    <Pagination
      currentPage={pagination.page}
      pageSize={pagination.pageSize}
      totalItems={pagination.total}
      onPageChange={(page) => setPagination({ page })}
    />
  );
}
```

---

## 3. Validation

### Zod Schemas

Schemas สำหรับ validate input data

#### การใช้งาน

```typescript
import { 
  VRPSettingsSchema,
  CreateRoutePlanSchema,
  FilterSchema,
  PaginationSchema
} from './utils/validators';

// Validate VRP settings
const result = VRPSettingsSchema.safeParse(settings);
if (!result.success) {
  console.error(result.error.errors);
  return;
}

// Validate before API call
const handleCreatePlan = async (data: unknown) => {
  const validation = CreateRoutePlanSchema.safeParse(data);
  
  if (!validation.success) {
    // แสดง error messages
    validation.error.errors.forEach(err => {
      toast.error(`${err.path.join('.')}: ${err.message}`);
    });
    return;
  }
  
  // ส่งไปยัง API
  await fetch('/api/route-plans', {
    method: 'POST',
    body: JSON.stringify(validation.data)
  });
};
```

#### Available Schemas

```typescript
// VRP Settings
VRPSettingsSchema.parse({
  maxStopsPerTrip: 10,
  maxWeightPerTrip: 1000,
  startTime: '08:00',
  endTime: '18:00',
  algorithm: 'genetic'
});

// Create Plan
CreateRoutePlanSchema.parse({
  warehouse_id: 'WH001',
  plan_date: '2026-01-17',
  settings: { ... }
});

// Filters
FilterSchema.parse({
  warehouseId: 'WH001',
  status: 'draft',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  search: 'แผน'
});

// Pagination
PaginationSchema.parse({
  page: 1,
  pageSize: 20
});
```

---

## 4. Search

### useDebouncedSearch Hook

Hook สำหรับ search พร้อม debounce

#### การใช้งาน

```typescript
import { useDebouncedSearch } from './hooks/useDebouncedSearch';

function SearchBar() {
  const { 
    searchTerm, 
    setSearchTerm, 
    debouncedTerm,
    isSearching,
    clearSearch 
  } = useDebouncedSearch(
    async (term) => {
      // ฟังก์ชันที่จะถูกเรียกหลัง debounce
      await fetchPlans({ search: term });
    },
    { 
      delay: 300,      // debounce delay (ms)
      minLength: 2     // minimum characters
    }
  );
  
  return (
    <div className="relative">
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหา..."
      />
      {isSearching && <Spinner />}
      {searchTerm && (
        <button onClick={clearSearch}>✕</button>
      )}
    </div>
  );
}
```

#### Options

```typescript
interface UseDebouncedSearchOptions {
  delay?: number;      // Default: 300ms
  minLength?: number;  // Default: 0
}
```

---

## 5. Loading States

### TableSkeleton

Skeleton loading สำหรับ table

```typescript
import { TableSkeleton, CompactTableSkeleton } from './components';

function PlansTable() {
  const { isLoading, plans } = useRoutePlanContext();
  
  if (isLoading) {
    return <TableSkeleton rows={8} columns={6} />;
  }
  
  return <table>...</table>;
}

// Compact version
function CompactList() {
  if (isLoading) {
    return <CompactTableSkeleton rows={5} />;
  }
  
  return <div>...</div>;
}
```

### LoadingIndicator

Various loading indicators

```typescript
import { 
  LoadingIndicator,
  FullPageLoader,
  InlineLoader,
  ButtonLoader
} from './components';

// Small inline loader
<LoadingIndicator size="sm" text="กำลังโหลด..." />

// Medium (default)
<LoadingIndicator size="md" />

// Large
<LoadingIndicator size="lg" text="กำลังประมวลผล..." />

// Full page
<FullPageLoader text="กำลังโหลดข้อมูล..." />

// Inline in text
<div>
  กำลังโหลด <InlineLoader />
</div>

// In button
<Button disabled>
  <ButtonLoader />
  กำลังบันทึก...
</Button>
```

### ProgressBar

Progress indicators

```typescript
import { 
  ProgressBar,
  CircularProgress,
  StepProgress
} from './components';

// Linear progress bar
<ProgressBar 
  value={progress} 
  max={100}
  showLabel
  label="กำลังคำนวณเส้นทาง..."
  variant="default" // 'success' | 'warning' | 'error'
/>

// Circular progress
<CircularProgress 
  value={75}
  size={48}
  strokeWidth={4}
  showLabel
/>

// Step progress
<StepProgress
  steps={['เลือกออเดอร์', 'ตั้งค่า VRP', 'ดูผลลัพธ์']}
  currentStep={1}
/>
```

---

## 6. Pagination

### Pagination Component

Full-featured pagination

```typescript
import { Pagination } from './components';

function PlansTable() {
  const { pagination, setPagination } = useRoutePlanPagination();
  
  return (
    <>
      <table>...</table>
      
      <Pagination
        currentPage={pagination.page}
        totalPages={Math.ceil(pagination.total / pagination.pageSize)}
        pageSize={pagination.pageSize}
        totalItems={pagination.total}
        onPageChange={(page) => setPagination({ page })}
        onPageSizeChange={(pageSize) => setPagination({ pageSize, page: 1 })}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </>
  );
}
```

#### Features

- First/Previous/Next/Last buttons
- Page numbers with ellipsis
- Page size selector
- Items count display
- Fully accessible
- Responsive design

---

## 🎯 Complete Example

ตัวอย่างการใช้งานทั้งหมดรวมกัน:

```typescript
'use client';

import { useEffect } from 'react';
import { RoutePlanProvider, useRoutePlanContext } from './contexts/RoutePlanContext';
import { useDebouncedSearch } from './hooks/useDebouncedSearch';
import { 
  TableSkeleton,
  LoadingIndicator,
  ProgressBar,
  Pagination
} from './components';

function RoutesContent() {
  const { state, actions } = useRoutePlanContext();
  
  // Debounced search
  const { searchTerm, setSearchTerm, isSearching } = useDebouncedSearch(
    async (term) => {
      actions.setFilter('search', term);
      await fetchPlans();
    },
    { delay: 300, minLength: 2 }
  );
  
  // Fetch plans
  const fetchPlans = async () => {
    actions.setLoading(true);
    try {
      const response = await fetch('/api/route-plans?' + new URLSearchParams({
        page: state.pagination.page.toString(),
        pageSize: state.pagination.pageSize.toString(),
        search: state.filters.search,
        // ... other filters
      }));
      const { data, meta } = await response.json();
      actions.setPlans(data);
      actions.setPagination({ total: meta.total });
    } catch (error) {
      actions.setError('เกิดข้อผิดพลาด');
    } finally {
      actions.setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchPlans();
  }, [state.pagination.page, state.pagination.pageSize]);
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Search */}
      <div className="relative">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาแผน..."
        />
        {isSearching && <LoadingIndicator size="sm" />}
      </div>
      
      {/* Table */}
      {state.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <table>
          {/* ... table content ... */}
        </table>
      )}
      
      {/* Pagination */}
      <Pagination
        currentPage={state.pagination.page}
        totalPages={Math.ceil(state.pagination.total / state.pagination.pageSize)}
        pageSize={state.pagination.pageSize}
        totalItems={state.pagination.total}
        onPageChange={(page) => actions.setPagination({ page })}
        onPageSizeChange={(pageSize) => actions.setPagination({ pageSize, page: 1 })}
      />
    </div>
  );
}

export default function RoutesPage() {
  return (
    <RoutePlanProvider>
      <RoutesContent />
    </RoutePlanProvider>
  );
}
```

---

## 📝 Best Practices

### 1. State Management
- ใช้ `useRoutePlanState` สำหรับ complex state
- ใช้ convenience hooks เมื่อต้องการเฉพาะส่วน
- อย่า mutate state โดยตรง ให้ใช้ actions

### 2. Validation
- Validate ก่อนส่ง API เสมอ
- แสดง error messages ที่ชัดเจน
- ใช้ `safeParse` แทน `parse` เพื่อ handle errors

### 3. Search
- ใช้ debounce สำหรับ search/filter
- ตั้ง `minLength` เพื่อลด unnecessary calls
- แสดง loading indicator ขณะ searching

### 4. Loading States
- ใส่ loading indicators ทุกที่ที่มี async operation
- ใช้ skeleton สำหรับ initial load
- ใช้ progress bar สำหรับ long operations

### 5. Pagination
- ใช้ pagination เมื่อมีข้อมูลมากกว่า 20 รายการ
- Reset page เป็น 1 เมื่อเปลี่ยน filters
- แสดงจำนวนรายการทั้งหมด

---

**เอกสารนี้สร้างโดย**: Kiro AI  
**วันที่**: 17 มกราคม 2026
