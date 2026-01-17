# Sprint 3: RoutesPlanTable Integration Guide

**วันที่**: 17 มกราคม 2026  
**Component**: RoutesPlanTable  
**Status**: Ready for Integration

---

## 🎯 Overview

เอกสารนี้อธิบายวิธีการ integrate `RoutesPlanTable` component เข้ากับ `page.tsx`

---

## 📋 Pre-Integration Checklist

### ✅ Components Created
- [x] `RoutesPlanTable/index.tsx` - Main component
- [x] `RoutesPlanTable/TableHeader.tsx` - Header with sorting
- [x] `RoutesPlanTable/TableRow.tsx` - Plan row
- [x] `RoutesPlanTable/TableActions.tsx` - Action buttons
- [x] `RoutesPlanTable/ExpandedTrips.tsx` - Trips detail
- [x] `components/index.ts` - Export updated

### ✅ Dependencies
- [x] Types from `../../types`
- [x] Utils from `../../utils` (STATUSES)
- [x] UI components (Badge from `@/components/ui/Badge`)
- [x] Icons from `lucide-react`

---

## 🔧 Integration Steps

### Step 1: Add Import

**Location**: `app/receiving/routes/page.tsx` (top of file)

```typescript
// Add this import with other component imports
import { RoutesPlanTable } from './components';
```

### Step 2: Identify Section to Replace

**Location**: Lines ~2078-2552 in `page.tsx`

**Current Code** (to be replaced):
```typescript
{loading ? (
    <div className="p-12 text-center text-gray-500">กำลังโหลด...</div>
) : filteredPlans.length === 0 ? (
    <div className="p-12 text-center text-gray-500">ยังไม่มีแผนเส้นทาง</div>
) : (
    <table className="min-w-max w-full border-collapse text-sm">
        {/* ~470 lines of table code */}
    </table>
)}
```

### Step 3: Replace with Component

**New Code**:
```typescript
<RoutesPlanTable
    plans={filteredPlans}
    isLoading={loading}
    expandedPlanIds={expandedPlanIds}
    planTripsData={planTripsData}
    loadingTrips={loadingTrips}
    editingStatusPlanId={editingStatusPlanId}
    onToggleExpand={toggleExpandPlan}
    onStatusChange={handleStatusChange}
    onPreviewPlan={handlePreviewPlan}
    onOpenEditor={handleOpenEditor}
    onEditShippingCost={handleEditShippingCost}
    onPrintPlan={handlePrintPlan}
    onExportTMS={handleExportTMS}
    onApprovePlan={handleApprovePlan}
    onDeletePlan={handleCheckDeletePlan}
    sortField={sortField}
    sortDirection={sortDirection}
    onSort={handleSort}
/>
```

---

## 📝 Required Handler Functions

ตรวจสอบว่า functions เหล่านี้มีอยู่ใน `page.tsx`:

### 1. toggleExpandPlan
```typescript
const toggleExpandPlan = (planId: number) => {
    // Implementation
};
```

### 2. handleStatusChange
```typescript
const handleStatusChange = async (planId: number, newStatus: string) => {
    try {
        setEditingStatusPlanId(planId);
        const response = await fetch(`/api/route-plans/${planId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
            await fetchRoutePlans();
        }
    } finally {
        setEditingStatusPlanId(null);
    }
};
```

### 3. handlePreviewPlan
```typescript
const handlePreviewPlan = (planId: number) => {
    // Open preview modal
};
```

### 4. handleOpenEditor
```typescript
const handleOpenEditor = (planId: number) => {
    // Open editor modal
};
```

### 5. handleEditShippingCost
```typescript
const handleEditShippingCost = async (planId: number) => {
    // Update status if needed
    setSelectedPlanIdForShippingCost(planId);
    setShowEditShippingCostModal(true);
};
```

### 6. handlePrintPlan
```typescript
const handlePrintPlan = (planId: number) => {
    setSelectedPlanIdForPrint(planId);
    setShowPrintModal(true);
};
```

### 7. handleExportTMS
```typescript
const handleExportTMS = (planId: number, planCode: string, planDate: string) => {
    // Export to Excel
};
```

### 8. handleApprovePlan
```typescript
const handleApprovePlan = async (planId: number) => {
    if (confirm('อนุมัติใบว่าจ้างนี้หรือไม่?')) {
        const response = await fetch(`/api/route-plans/${planId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'approved',
                approved_at: new Date().toISOString()
            })
        });
        if (response.ok) {
            await fetchRoutePlans();
        }
    }
};
```

### 9. handleCheckDeletePlan
```typescript
const handleCheckDeletePlan = (planId: number) => {
    // Check if can delete, then show confirm dialog
};
```

### 10. handleSort
```typescript
const handleSort = (field: keyof RoutePlan) => {
    if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDirection('asc');
    }
};
```

---

## 🧪 Testing Checklist

### Visual Tests
- [ ] Table renders correctly
- [ ] Loading state shows spinner
- [ ] Empty state shows message
- [ ] All columns display data
- [ ] Sorting icons appear
- [ ] Action buttons visible

### Functional Tests
- [ ] Click expand button → trips show/hide
- [ ] Click sort header → data sorts
- [ ] Change status dropdown → status updates
- [ ] Click preview → modal opens
- [ ] Click edit → editor opens
- [ ] Click shipping cost → modal opens
- [ ] Click print → print modal opens
- [ ] Click export → Excel downloads
- [ ] Click approve → status changes
- [ ] Click delete → confirm dialog shows

### Edge Cases
- [ ] No plans → empty state
- [ ] Loading → spinner
- [ ] Plan with no trips → empty message
- [ ] Plan with many trips → scrollable
- [ ] Status change error → error handling
- [ ] Delete disabled plans → button disabled

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module './components'"
**Solution**: Check that `components/index.ts` exports `RoutesPlanTable`

### Issue 2: "Property 'plan_id' does not exist"
**Solution**: Check that `RoutePlan` type is imported from `./types`

### Issue 3: "Handler function not found"
**Solution**: Create missing handler functions in `page.tsx`

### Issue 4: "Trips not loading"
**Solution**: Check that `planTripsData` Map is populated correctly

### Issue 5: "Status change not working"
**Solution**: Check `handleStatusChange` implementation and API endpoint

---

## 📊 Before & After Comparison

### Before Integration
```
page.tsx: 3,323 lines
- Table code: ~470 lines (inline)
- Hard to maintain
- Hard to test
- Tightly coupled
```

### After Integration
```
page.tsx: ~2,860 lines (-463 lines)
RoutesPlanTable: 720 lines (separate)
- Easy to maintain
- Easy to test
- Loosely coupled
- Reusable
```

**Total Reduction**: -463 lines in page.tsx  
**Code Organization**: Much better

---

## 🚀 Next Steps After Integration

1. **Test Thoroughly**
   - Manual testing of all features
   - Check console for errors
   - Test edge cases

2. **Monitor Performance**
   - Check render times
   - Monitor memory usage
   - Test with large datasets

3. **Document Changes**
   - Update SPRINT3_PROGRESS.md
   - Note any issues found
   - Document solutions

4. **Proceed to Next Component**
   - Extract CreatePlanModal (Day 3-4)
   - Extract ExcelEditor (Day 5)

---

## 📞 Support

หากพบปัญหาในการ integrate:
1. ตรวจสอบ console errors
2. ตรวจสอบว่า props ถูกส่งครบ
3. ตรวจสอบว่า handler functions มีอยู่
4. ดู documentation ใน SPRINT3_PROGRESS.md

---

**สร้างโดย**: Kiro AI  
**วันที่**: 17 มกราคม 2026  
**Status**: Ready for Integration
