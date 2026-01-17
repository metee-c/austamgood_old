# Developer Guide - Route Planning System

> **Module:** Receiving Routes  
> **Version:** 2.0  
> **Last Updated:** January 18, 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Structure](#component-structure)
3. [State Management](#state-management)
4. [API Layer](#api-layer)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5
- **State:** React useReducer + Custom Hooks
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Maps:** Mapbox GL
- **Testing:** Jest + React Testing Library

### Project Structure

```
app/receiving/routes/
├── page.tsx                    # Main page (~300 lines)
├── error.tsx                   # Error boundary
├── loading.tsx                 # Loading skeleton
│
├── components/                 # UI Components (~1,180 lines)
│   ├── RoutesPlanTable/       # Table components (5 files)
│   ├── CreatePlanModal/       # Create modal (3 files)
│   ├── ExcelEditor/           # Editor component (1 file)
│   └── [other components]
│
├── hooks/                      # Custom hooks (~846 lines)
│   ├── useRoutePlanState.ts   # State management (391 lines)
│   ├── useRoutePlans.ts       # Fetch plans (75 lines)
│   ├── useEditorData.ts       # Editor data (200 lines)
│   ├── useDebouncedSearch.ts  # Search (80 lines)
│   └── useOptimization.ts     # VRP optimization (90 lines)
│
├── api/                        # API layer (~520 lines)
│   ├── types.ts               # API types (120 lines)
│   ├── routePlans.ts          # Route plans API (280 lines)
│   ├── optimization.ts        # VRP API (100 lines)
│   └── index.ts               # Exports (20 lines)
│
├── types/                      # Type definitions
│   └── index.ts
│
└── utils/                      # Utilities
    ├── validators.ts
    ├── formatters.ts
    ├── exportExcel.ts
    └── errorHandler.ts
```

### Data Flow

```
┌─────────────┐
│   page.tsx  │ ← Main component
└──────┬──────┘
       │
       ├─→ useRoutePlanState() ← State management
       │   └─→ useReducer()
       │
       ├─→ useRoutePlans() ← Data fetching
       │   └─→ API Layer
       │       └─→ Supabase
       │
       └─→ Components ← UI rendering
           ├─→ RoutesPlanTable
           ├─→ CreatePlanModal
           └─→ ExcelEditor
```

---

## Component Structure

### Main Page (page.tsx)

**Purpose:** Orchestrate the entire route planning workflow

**Responsibilities:**
- Initialize state with `useRoutePlanState()`
- Fetch data with `useRoutePlans()`
- Render UI components
- Handle user interactions

**Example:**
```typescript
export default function RoutesPage() {
  const { state, actions } = useRoutePlanState();
  const { fetchPlans, isLoading } = useRoutePlans(
    state.filters,
    state.pagination
  );
  
  useEffect(() => {
    fetchPlans();
  }, [state.filters, state.pagination.page]);
  
  return (
    <div>
      <FilterBar
        filters={state.filters}
        onFilterChange={actions.setFilter}
      />
      <RoutesPlanTable
        plans={state.plans}
        onEdit={actions.openEditor}
      />
    </div>
  );
}
```

### RoutesPlanTable Component

**Location:** `components/RoutesPlanTable/index.tsx`

**Purpose:** Display list of route plans in a table

**Props:**
```typescript
interface RoutesPlanTableProps {
  plans: RoutePlan[];
  isLoading: boolean;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}
```

**Features:**
- Sortable columns
- Expandable rows (show trips)
- Bulk selection
- Action buttons (edit, delete, export)
- Loading skeleton

### CreatePlanModal Component

**Location:** `components/CreatePlanModal/index.tsx`

**Purpose:** Multi-step wizard for creating route plans

**Steps:**
1. **Select Orders** - Choose orders to include
2. **Configure VRP** - Set optimization parameters
3. **Preview Results** - Review and save

**Props:**
```typescript
interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: CreateModalState;
  actions: RoutePlanActions;
}
```

### ExcelEditor Component

**Location:** `components/ExcelEditor/index.tsx`

**Purpose:** Excel-like editor for modifying route plans

**Features:**
- Drag & drop stops between trips
- Reorder stops within trip
- Add orders from draft
- Split stops
- Cross-plan transfer
- Undo/redo support

**Props:**
```typescript
interface ExcelEditorProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string | null;
  onSaveSuccess: () => void;
}
```

---

## State Management

### useRoutePlanState Hook

**Location:** `hooks/useRoutePlanState.ts`

**Purpose:** Centralized state management using useReducer

**Why useReducer?**
- Replaces 50+ useState
- Predictable state updates
- Easier to debug
- Better performance

**State Interface:**
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
    hasUnsavedChanges: boolean;
    isSaving: boolean;
  };
}
```

**Actions:**
```typescript
type Action =
  | { type: 'SET_PLANS'; payload: RoutePlan[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FILTER'; payload: { key: string; value: any } }
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'OPEN_EDITOR'; payload: string }
  | { type: 'CLOSE_EDITOR' }
  // ... more actions
```

**Usage:**
```typescript
const { state, actions } = useRoutePlanState();

// Update filter
actions.setFilter('status', 'active');

// Open create modal
actions.openCreateModal();

// Open editor
actions.openEditor(planId);
```

### Other Hooks

#### useRoutePlans

**Purpose:** Fetch route plans with filters and pagination

```typescript
const { fetchPlans, isLoading, error } = useRoutePlans(
  filters,
  pagination
);
```

#### useEditorData

**Purpose:** Fetch and save editor data

```typescript
const { data, loading, error, save } = useEditorData(planId);
```

#### useDebouncedSearch

**Purpose:** Search with debounce to reduce API calls

```typescript
const { searchTerm, setSearchTerm, debouncedTerm, isSearching } = 
  useDebouncedSearch(searchFn, { delay: 300 });
```

#### useOptimization

**Purpose:** VRP optimization with timeout and progress

```typescript
const { optimize, isOptimizing, progress, error } = 
  useOptimization();
```

---

## API Layer

### Why API Layer?

- **Centralized** - All API calls in one place
- **Reusable** - Use across components
- **Testable** - Easy to mock and test
- **Type-safe** - Full TypeScript support

### API Structure

**Location:** `api/`

```
api/
├── types.ts           # Request/Response types
├── routePlans.ts      # Route plans API
├── optimization.ts    # VRP optimization API
└── index.ts           # Exports
```

### API Functions

#### fetchRoutePlans

```typescript
async function fetchRoutePlans(
  params: FetchRoutePlansParams
): Promise<PaginatedResponse<RoutePlan>> {
  const queryString = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
    ...params.filters,
  }).toString();
  
  const response = await fetch(`/api/route-plans?${queryString}`);
  
  if (!response.ok) {
    throw new ApiError('Failed to fetch plans', response.status);
  }
  
  return response.json();
}
```

#### createRoutePlan

```typescript
async function createRoutePlan(
  data: CreateRoutePlanRequest
): Promise<ApiResponse<RoutePlan>> {
  const response = await fetch('/api/route-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new ApiError('Failed to create plan', response.status);
  }
  
  return response.json();
}
```

#### optimizeRoutePlan

```typescript
async function optimizeRoutePlan(
  orders: string[],
  settings: VRPSettings
): Promise<ApiResponse<OptimizationResult>> {
  const response = await fetch('/api/route-plans/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders, settings }),
  });
  
  if (!response.ok) {
    throw new ApiError('Optimization failed', response.status);
  }
  
  return response.json();
}
```

### Error Handling

**ApiError Class:**
```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

**Usage:**
```typescript
try {
  const result = await fetchRoutePlans(params);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      // Handle not found
    } else if (error.status === 500) {
      // Handle server error
    }
  }
}
```

---

## Testing

### Test Structure

```
app/receiving/routes/
├── hooks/
│   └── __tests__/
│       ├── useRoutePlanState.test.ts
│       ├── useRoutePlans.test.ts
│       └── useEditorData.test.ts
│
├── api/
│   └── __tests__/
│       ├── routePlans.test.ts
│       └── optimization.test.ts
│
└── __tests__/
    ├── integration/
    │   ├── create-plan.test.tsx
    │   ├── edit-plan.test.tsx
    │   └── delete-plan.test.tsx
    └── mocks/
        └── handlers.ts
```

### Unit Tests

#### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useRoutePlanState } from '../useRoutePlanState';

describe('useRoutePlanState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useRoutePlanState());
    
    expect(result.current.state.plans).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });
  
  it('should update plans', () => {
    const { result } = renderHook(() => useRoutePlanState());
    const mockPlans = [{ plan_id: '1', /* ... */ }];
    
    act(() => {
      result.current.actions.setPlans(mockPlans);
    });
    
    expect(result.current.state.plans).toEqual(mockPlans);
  });
});
```

#### Testing API Functions

```typescript
import { fetchRoutePlans } from '../routePlans';

describe('fetchRoutePlans', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  
  it('should fetch plans successfully', async () => {
    const mockResponse = {
      data: [{ plan_id: '1' }],
      meta: { total: 1 },
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });
    
    const result = await fetchRoutePlans({ page: 1, pageSize: 20 });
    
    expect(result).toEqual(mockResponse);
  });
  
  it('should throw ApiError on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    
    await expect(
      fetchRoutePlans({ page: 1, pageSize: 20 })
    ).rejects.toThrow(ApiError);
  });
});
```

### Integration Tests

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import RoutesPage from '../page';

const server = setupServer(
  rest.get('/api/route-plans', (req, res, ctx) => {
    return res(ctx.json({ data: mockPlans }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Create Plan Workflow', () => {
  it('should create plan successfully', async () => {
    render(<RoutesPage />);
    
    // Click create button
    const createButton = screen.getByText('สร้างแผนใหม่');
    await userEvent.click(createButton);
    
    // Select orders
    const order1 = screen.getByText('Order #001');
    await userEvent.click(order1);
    
    // Click next
    const nextButton = screen.getByText('ถัดไป');
    await userEvent.click(nextButton);
    
    // Configure VRP
    const maxStops = screen.getByLabelText('จุดส่งสูงสุด');
    await userEvent.clear(maxStops);
    await userEvent.type(maxStops, '10');
    
    // Optimize
    const optimizeButton = screen.getByText('คำนวณเส้นทาง');
    await userEvent.click(optimizeButton);
    
    // Wait for result
    await waitFor(() => {
      expect(screen.getByText('สร้างแผนสำเร็จ')).toBeInTheDocument();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- useRoutePlanState.test.ts

# Watch mode
npm test -- --watch

# Update snapshots
npm test -- -u
```

---

## Deployment

### Pre-deployment Checklist

- [ ] All tests passing
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] Build succeeds
- [ ] Environment variables configured
- [ ] Database migrations applied

### Build Process

```bash
# Install dependencies
npm install

# Run type check
npm run type-check

# Run linting
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=xxx

# API
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Deployment Steps

1. **Staging Deployment**
   ```bash
   git push origin staging
   ```

2. **Smoke Testing**
   - Test create plan workflow
   - Test edit plan workflow
   - Test delete plan workflow
   - Check performance

3. **Production Deployment**
   ```bash
   git push origin main
   ```

4. **Post-deployment Monitoring**
   - Check error logs
   - Monitor performance
   - Watch for user reports

---

## Troubleshooting

### Common Issues

#### Issue: Memory Leak

**Symptoms:** Page becomes slow over time

**Solution:**
- Check for missing cleanup in useEffect
- Use AbortController for fetch
- Clear intervals/timeouts

```typescript
useEffect(() => {
  const controller = new AbortController();
  
  fetchData(controller.signal);
  
  return () => {
    controller.abort(); // ✅ Cleanup
  };
}, []);
```

#### Issue: Race Condition

**Symptoms:** Stale data or duplicate requests

**Solution:**
- Use ref to lock operations
- Use AbortController
- Use functional updates

```typescript
const lockRef = useRef(false);

const handleClick = async () => {
  if (lockRef.current) return; // ✅ Prevent race
  
  lockRef.current = true;
  try {
    await doSomething();
  } finally {
    lockRef.current = false;
  }
};
```

#### Issue: Stale Closure

**Symptoms:** Using old state in callbacks

**Solution:**
- Use functional updates
- Add dependencies to useCallback

```typescript
// ❌ Bad
setCount(count + 1);

// ✅ Good
setCount(prev => prev + 1);
```

### Debugging Tips

1. **Use React DevTools**
   - Inspect component tree
   - Check props and state
   - Profile performance

2. **Use Browser DevTools**
   - Check network requests
   - Monitor console errors
   - Profile memory usage

3. **Add Logging**
   ```typescript
   console.log('[RoutesPage] Fetching plans', { filters, pagination });
   ```

4. **Use TypeScript**
   - Catch errors at compile time
   - Better IDE autocomplete
   - Self-documenting code

---

## Best Practices

### Code Style

- Use TypeScript for type safety
- Use functional components
- Use hooks for state management
- Use async/await for promises
- Use early returns to reduce nesting

### Performance

- Use React.memo for expensive components
- Use useCallback for event handlers
- Use useMemo for expensive calculations
- Lazy load components
- Optimize images

### Testing

- Write tests for critical paths
- Mock external dependencies
- Use integration tests for workflows
- Aim for 80% coverage
- Keep tests simple and readable

### Documentation

- Document complex logic
- Add JSDoc comments
- Keep README up to date
- Write user guides
- Document API endpoints

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Testing Library](https://testing-library.com/docs)

---

**Created by:** Kiro AI  
**Date:** January 18, 2026  
**Version:** 2.0
