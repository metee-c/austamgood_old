# Sprint 4: Testing & Polish - แผนงาน

> **วันที่เริ่ม:** 18 มกราคม 2026  
> **ระยะเวลา:** 1 สัปดาห์ (5 วันทำการ)  
> **เป้าหมาย:** เพิ่ม test coverage และแก้ Medium priority bugs

---

## 📋 Overview

Sprint 4 เป็น sprint สุดท้ายของการ refactor หน้า `/receiving/routes` โดยมีเป้าหมายหลัก:

1. **Unit Tests** - เขียน tests สำหรับ hooks และ utilities (เป้าหมาย 80% coverage)
2. **Integration Tests** - เขียน tests สำหรับ workflows (เป้าหมาย 70% coverage)
3. **Medium Priority Bugs** - แก้ bugs ที่เหลือ (#16-#20)
4. **Performance Testing** - ทดสอบและปรับปรุง performance
5. **Documentation** - เขียน user guide และ developer guide

---

## 📅 Sprint 4 Schedule

| Day | Task | Assignee | Hours | Status |
|-----|------|----------|-------|--------|
| **Mon** | Write unit tests for hooks | Dev 1 | 4h | ⏳ Pending |
| **Tue** | Write integration tests | Dev 2 | 4h | ⏳ Pending |
| **Wed** | Fix Medium bugs (#16-#20) | Both | 4h | ⏳ Pending |
| **Thu** | Performance testing | Dev 1 | 4h | ⏳ Pending |
| **Fri** | Documentation + Deploy | All | 4h | ⏳ Pending |

---

## 🎯 Goals & Success Criteria

### Unit Tests (80% coverage target)

**Coverage Areas:**
- ✅ Hooks (useRoutePlanState, useRoutePlans, useEditorData, etc.)
- ✅ API layer (routePlans.ts, optimization.ts)
- ✅ Utilities (validators.ts, formatters.ts, calculations.ts)
- ✅ Error handling (ApiError, error handlers)

**Success Criteria:**
- [ ] 80%+ code coverage
- [ ] All critical paths tested
- [ ] Edge cases covered
- [ ] Tests pass in CI/CD

### Integration Tests (70% coverage target)

**Test Scenarios:**
- ✅ Create new route plan workflow
- ✅ Edit existing plan workflow
- ✅ Delete plan workflow
- ✅ Optimize routes workflow
- ✅ Preview plan workflow
- ✅ Error scenarios

**Success Criteria:**
- [ ] 70%+ workflow coverage
- [ ] All happy paths tested
- [ ] Error paths tested
- [ ] Tests run in < 30 seconds

### Medium Priority Bugs

**Bugs to Fix:**
- [ ] #16: Add loading states to all async operations
- [ ] #17: Improve error messages
- [ ] #18: Add keyboard shortcuts
- [ ] #19: Improve mobile responsiveness
- [ ] #20: Add tooltips to complex features

### Performance Testing

**Metrics to Test:**
- [ ] Page load time < 1s
- [ ] API response time < 500ms
- [ ] Optimization time < 5 minutes
- [ ] Memory usage stable
- [ ] No memory leaks

### Documentation

**Documents to Create:**
- [x] User Guide (Thai) - `docs/VRP/USER_GUIDE.md`
- [x] Developer Guide (English) - `docs/VRP/DEVELOPER_GUIDE.md`
- [x] API Reference - `docs/VRP/API_REFERENCE.md`
- [x] Deployment Checklist - `docs/VRP/DEPLOYMENT_CHECKLIST.md`
- [x] Troubleshooting Guide (included in User Guide)

---

## 📝 Day 1: Unit Tests for Hooks (Monday)

### Tasks

#### 1. Setup Testing Infrastructure (1h)

**Install Dependencies:**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event @testing-library/react-hooks
npm install --save-dev jest-environment-jsdom
```

**Update jest.config.js:**
```javascript
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/receiving/routes/**/*.{ts,tsx}',
    '!app/receiving/routes/**/*.d.ts',
    '!app/receiving/routes/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

**Create jest.setup.js:**
```javascript
import '@testing-library/jest-dom';
```

#### 2. Test useRoutePlanState Hook (1.5h)

**File:** `app/receiving/routes/hooks/__tests__/useRoutePlanState.test.ts`

**Test Cases:**
- ✅ Initial state is correct
- ✅ SET_PLANS action updates plans
- ✅ SET_LOADING action updates loading state
- ✅ SET_ERROR action updates error state
- ✅ SET_FILTER action updates filters and resets page
- ✅ TOGGLE_PLAN_SELECTION toggles selection
- ✅ OPEN_CREATE_MODAL opens modal with clean state
- ✅ CLOSE_CREATE_MODAL resets modal state
- ✅ OPEN_EDITOR opens editor with plan ID
- ✅ UPDATE_EDITOR_TRIPS marks editor as dirty

#### 3. Test useRoutePlans Hook (1h)

**File:** `app/receiving/routes/hooks/__tests__/useRoutePlans.test.ts`

**Test Cases:**
- ✅ Fetches plans on mount
- ✅ Refetches when filters change
- ✅ Handles loading state correctly
- ✅ Handles error state correctly
- ✅ Aborts fetch on unmount
- ✅ Pagination works correctly

#### 4. Test useEditorData Hook (0.5h)

**File:** `app/receiving/routes/hooks/__tests__/useEditorData.test.ts`

**Test Cases:**
- ✅ Fetches editor data on mount
- ✅ Saves changes correctly
- ✅ Handles loading state
- ✅ Handles error state
- ✅ Aborts fetch on unmount

---

## 📝 Day 2: Integration Tests (Tuesday)

### Tasks

#### 1. Setup Integration Test Environment (0.5h)

**Install Dependencies:**
```bash
npm install --save-dev @testing-library/react @testing-library/user-event
npm install --save-dev msw
```

**Setup MSW (Mock Service Worker):**
```typescript
// app/receiving/routes/__tests__/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/route-plans', (req, res, ctx) => {
    return res(ctx.json({ data: mockPlans }));
  }),
  rest.post('/api/route-plans', (req, res, ctx) => {
    return res(ctx.json({ data: mockCreatedPlan }));
  }),
  // ... more handlers
];
```

#### 2. Test Create Plan Workflow (1.5h)

**File:** `app/receiving/routes/__tests__/integration/create-plan.test.tsx`

**Test Cases:**
- ✅ Opens create modal
- ✅ Selects orders
- ✅ Configures VRP settings
- ✅ Optimizes routes
- ✅ Previews results
- ✅ Saves plan
- ✅ Handles errors

#### 3. Test Edit Plan Workflow (1h)

**File:** `app/receiving/routes/__tests__/integration/edit-plan.test.tsx`

**Test Cases:**
- ✅ Opens editor
- ✅ Reorders stops
- ✅ Moves orders between trips
- ✅ Adds orders from draft
- ✅ Saves changes
- ✅ Handles unsaved changes warning

#### 4. Test Delete Plan Workflow (0.5h)

**File:** `app/receiving/routes/__tests__/integration/delete-plan.test.tsx`

**Test Cases:**
- ✅ Shows confirmation dialog
- ✅ Deletes plan
- ✅ Refreshes list
- ✅ Handles errors

#### 5. Test Error Scenarios (0.5h)

**File:** `app/receiving/routes/__tests__/integration/error-scenarios.test.tsx`

**Test Cases:**
- ✅ Network error
- ✅ Validation error
- ✅ Timeout error
- ✅ Permission error

---

## 📝 Day 3: Fix Medium Priority Bugs (Wednesday)

### Bug #16: Add Loading States

**Problem:** ไม่มี loading states ในบาง operations

**Solution:**
```typescript
// เพิ่ม loading states ใน components
const [isDeleting, setIsDeleting] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [isExporting, setIsExporting] = useState(false);

// แสดง loading indicators
{isDeleting && <Loader2 className="animate-spin" />}
{isSaving && <span>กำลังบันทึก...</span>}
```

**Files to Update:**
- `components/RoutesPlanTable/TableActions.tsx`
- `components/ExcelEditor/index.tsx`
- `components/CreatePlanModal/index.tsx`

### Bug #17: Improve Error Messages

**Problem:** Error messages ไม่ชัดเจน

**Solution:**
```typescript
// สร้าง error message mapper
const ERROR_MESSAGES: Record<string, string> = {
  'NETWORK_ERROR': 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
  'VALIDATION_ERROR': 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง',
  'TIMEOUT_ERROR': 'การประมวลผลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง',
  'PERMISSION_ERROR': 'คุณไม่มีสิทธิ์ในการทำรายการนี้',
  'NOT_FOUND': 'ไม่พบข้อมูลที่ต้องการ',
};

// ใช้ใน error handler
const getErrorMessage = (error: any): string => {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] || error.message;
  }
  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
};
```

**Files to Create:**
- `app/receiving/routes/utils/errorMessages.ts`

### Bug #18: Add Keyboard Shortcuts

**Problem:** ไม่มี keyboard shortcuts

**Solution:**
```typescript
// เพิ่ม keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    
    // Ctrl/Cmd + N = New Plan
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      handleCreatePlan();
    }
    
    // Escape = Close Modal
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Files to Update:**
- `app/receiving/routes/page.tsx`
- `components/ExcelEditor/index.tsx`

### Bug #19: Improve Mobile Responsiveness

**Problem:** บางส่วนไม่ responsive บน mobile

**Solution:**
```typescript
// เพิ่ม responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Metric cards */}
</div>

<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>

// เพิ่ม mobile menu
<div className="md:hidden">
  <MobileMenu />
</div>
```

**Files to Update:**
- `components/RoutesPlanTable/index.tsx`
- `components/CreatePlanModal/index.tsx`

### Bug #20: Add Tooltips

**Problem:** ไม่มี tooltips สำหรับ features ที่ซับซ้อน

**Solution:**
```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="icon">
        <HelpCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>คำอธิบายฟีเจอร์นี้</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Files to Update:**
- `components/CreatePlanModal/VRPSettings.tsx`
- `components/ExcelEditor/EditorToolbar.tsx`

---

## 📝 Day 4: Performance Testing (Thursday)

### Tasks

#### 1. Setup Performance Monitoring (0.5h)

**Install Dependencies:**
```bash
npm install --save-dev lighthouse
npm install --save-dev @testing-library/react-perf
```

#### 2. Page Load Performance (1h)

**Test:**
- Initial page load < 1s
- Time to interactive < 2s
- First contentful paint < 1s

**Tools:**
- Chrome DevTools Performance tab
- Lighthouse
- Web Vitals

**Optimizations:**
- Code splitting
- Lazy loading
- Image optimization
- Bundle size reduction

#### 3. API Performance (1h)

**Test:**
- API response time < 500ms
- Database query time < 100ms
- N+1 queries eliminated

**Tools:**
- Supabase logs
- Network tab
- API monitoring

**Optimizations:**
- Query optimization
- Caching
- Pagination
- Indexes

#### 4. Memory Leak Testing (1h)

**Test:**
- No memory leaks after 100 operations
- Memory usage stable
- No zombie listeners

**Tools:**
- Chrome DevTools Memory tab
- React DevTools Profiler

**Optimizations:**
- Cleanup functions
- AbortController
- Event listener cleanup

#### 5. Optimization Performance (0.5h)

**Test:**
- VRP optimization < 5 minutes
- Progress updates work
- Timeout works correctly

**Tools:**
- Console logs
- Performance monitoring

---

## 📝 Day 5: Documentation + Deploy (Friday)

### Tasks

#### 1. User Guide (Thai) (1.5h)

**File:** `docs/VRP/USER_GUIDE.md`

**Sections:**
- การเริ่มต้นใช้งาน
- การสร้างแผนเส้นทางใหม่
- การแก้ไขแผนเส้นทาง
- การลบแผนเส้นทาง
- การดูแผนที่
- การส่งออกข้อมูล
- คำถามที่พบบ่อย (FAQ)
- การแก้ปัญหา

#### 2. Developer Guide (English) (1h)

**File:** `docs/VRP/DEVELOPER_GUIDE.md`

**Sections:**
- Architecture Overview
- Component Structure
- State Management
- API Layer
- Testing
- Deployment
- Troubleshooting

#### 3. API Reference (0.5h)

**File:** `docs/VRP/API_REFERENCE.md`

**Sections:**
- Route Plans API
- Optimization API
- Types
- Error Codes
- Examples

#### 4. Deployment Checklist (0.5h)

**File:** `docs/VRP/DEPLOYMENT_CHECKLIST.md`

**Sections:**
- Pre-deployment checks
- Database migrations
- Environment variables
- Build process
- Deployment steps
- Post-deployment verification
- Rollback procedure

#### 5. Final Testing & Deploy (0.5h)

**Tasks:**
- Run all tests
- Check test coverage
- Build production bundle
- Deploy to staging
- Smoke test on staging
- Deploy to production
- Monitor for errors

---

## ✅ Definition of Done

### Unit Tests
- [ ] 80%+ code coverage
- [ ] All tests passing
- [ ] No flaky tests
- [ ] Tests run in CI/CD

### Integration Tests
- [ ] 70%+ workflow coverage
- [ ] All critical paths tested
- [ ] Error scenarios tested
- [ ] Tests run in < 30 seconds

### Bug Fixes
- [ ] All Medium bugs fixed
- [ ] No regressions
- [ ] Manual testing passed
- [ ] Code reviewed

### Performance
- [ ] Page load < 1s
- [ ] API response < 500ms
- [ ] No memory leaks
- [ ] Optimization < 5 minutes

### Documentation
- [ ] User guide complete
- [ ] Developer guide complete
- [ ] API reference complete
- [ ] Deployment guide complete

### Deployment
- [ ] All tests passing
- [ ] Build successful
- [ ] Deployed to staging
- [ ] Smoke tests passed
- [ ] Deployed to production
- [ ] Monitoring active

---

## 📊 Success Metrics

### Code Quality
- **Test Coverage:** 80%+ (unit), 70%+ (integration)
- **Type Coverage:** 100%
- **Linting:** 0 errors
- **Build:** Success

### Performance
- **Page Load:** < 1s
- **API Response:** < 500ms
- **Memory Usage:** Stable
- **Optimization:** < 5 minutes

### User Experience
- **Loading States:** All operations
- **Error Messages:** Clear and helpful
- **Keyboard Shortcuts:** Available
- **Mobile Responsive:** Yes
- **Tooltips:** Available

### Documentation
- **User Guide:** Complete
- **Developer Guide:** Complete
- **API Reference:** Complete
- **Deployment Guide:** Complete

---

## 🚀 Quick Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- useRoutePlanState.test.ts

# Run integration tests only
npm test -- --testPathPattern="integration"

# Watch mode
npm test -- --watch

# Update snapshots
npm test -- -u

# Check coverage
npm test -- --coverage --coverageReporters=text

# Build
npm run build

# Type check
npm run type-check

# Lint
npm run lint

# Deploy to staging
git push origin staging

# Deploy to production
git push origin main
```

---

## 📞 Support

**Questions or Issues:**
- **Project:** AustamGood WMS
- **Module:** Receiving Routes
- **Sprint:** Sprint 4 (Testing & Polish)
- **Contact:** Development Team

---

**สร้างโดย:** Kiro AI  
**วันที่:** 18 มกราคม 2026  
**Version:** 1.0  
**Status:** ⏳ In Progress

