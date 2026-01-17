# 🔧 Integration Steps - RoutesPlanTable Component

**วันที่**: 17 มกราคม 2026  
**Component**: RoutesPlanTable  
**Target**: app/receiving/routes/page.tsx

---

## ⚠️ Important Notice

เนื่องจาก `page.tsx` มีขนาด **3,323 บรรทัด** การแก้ไขโดยตรงอาจมี risk สูง

**แนะนำ**: ทำทีละขั้นตอนและ test หลังแต่ละขั้นตอน

---

## 📋 Step-by-Step Integration

### Step 1: Backup Current File ✅

```bash
# สำรองไฟล์ก่อนแก้ไข
cp app/receiving/routes/page.tsx app/receiving/routes/page.tsx.backup
```

### Step 2: Add Import Statement

**Location**: Top of `page.tsx` (around line 30-40)

**Add this line**:
```typescript
import { RoutesPlanTable } from './components';
```

**Full import section should look like**:
```typescript
// ... existing imports ...
import { MetricCard, SplitStopModal, MultiPlanContractModal, MultiPlanTransportContractModal, CrossPlanTransferModal, ConfirmDialog } from './components';
import { RoutesPlanTable } from './components'; // ✅ ADD THIS LINE
import { 
    STATUSES, 
    STATUS_BADGE_MAP, 
    VRP_SETTINGS_STORAGE_KEY,
    resequenceTripStops,
    getStatusBadgeInfo,
    calculateTripShippingCost
} from './utils';
```

---

### Step 3: Create Handler Functions

**Location**: Inside `RoutesPage` component (before return statement)

**Add these handler functions** (if they don't exist):

```typescript
// Handler for status change
const handleStatusChange = useCallback(async (planId: number, newStatus: string) => {
    try {
        setEditingStatusPlanId(planId);
        const response = await fetch(`/api/route-plans/${planId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        if (result.error) {
            console.error('Error updating status:', result.error);
            alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + result.error);
        } else {
            await fetchRoutePlans();
        }
    } catch (error: any) {
        console.error('Error updating status:', error);
        alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message);
    } finally {
        setEditingStatusPlanId(null);
    }
}, []);

// Handler for shipping cost
const handleEditShippingCost = useCallback(async (planId: number) => {
    // ถ้าสถานะเป็น draft ให้เปลี่ยนเป็น optimizing ก่อน
    const plan = routePlans.find(p => p.plan_id === planId);
    if (plan && plan.status === 'draft') {
        try {
            const res = await fetch(`/api/route-plans/${planId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'optimizing' })
            });
            if (res.ok) {
                await fetchRoutePlans();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }
    setSelectedPlanIdForShippingCost(planId);
    setShowEditShippingCostModal(true);
}, [routePlans]);

// Handler for approve
const handleApprovePlan = useCallback(async (planId: number) => {
    if (confirm('อนุมัติใบว่าจ้างนี้หรือไม่?')) {
        try {
            const response = await fetch(`/api/route-plans/${planId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'approved',
                    approved_at: new Date().toISOString()
                })
            });
            if (response.ok) {
                alert('✅ อนุมัติเรียบร้อยแล้ว');
                await fetchRoutePlans();
            } else {
                const result = await response.json();
                alert('❌ เกิดข้อผิดพลาด: ' + (result.error || 'Unknown error'));
            }
        } catch (err: any) {
            alert('เกิดข้อผิดพลาด: ' + err.message);
        }
    }
}, []);

// Handler for sort
const handleSort = useCallback((field: keyof RoutePlan) => {
    if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDirection('asc');
    }
}, [sortField]);
```

---

### Step 4: Find and Replace Table Section

**Location**: Around line 2078-2552 in `page.tsx`

**Find this code block**:
```typescript
{loading ? (
    <div className="p-12 text-center text-gray-500">กำลังโหลด...</div>
) : filteredPlans.length === 0 ? (
    <div className="p-12 text-center text-gray-500">ยังไม่มีแผนเส้นทาง</div>
) : (
    <table className="min-w-max w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-gray-100">
            {/* ... ~470 lines of table code ... */}
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
            {/* ... table body ... */}
        </tbody>
    </table>
)}
```

**Replace with**:
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

### Step 5: Verify Required Functions Exist

**Check these functions exist in `page.tsx`**:

- [x] `toggleExpandPlan` - Toggle expand/collapse
- [x] `handlePreviewPlan` - Open preview modal
- [x] `handleOpenEditor` - Open editor modal
- [x] `handlePrintPlan` - Open print modal
- [x] `handleExportTMS` - Export to Excel
- [x] `handleCheckDeletePlan` - Check and delete plan

**If any function is missing**, you need to create it or find its equivalent name.

---

### Step 6: Test in Browser

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Open browser**: http://localhost:3000/receiving/routes

3. **Check console** for errors

4. **Test features**:
   - [ ] Table renders
   - [ ] Loading state works
   - [ ] Empty state works
   - [ ] Sorting works
   - [ ] Expand/collapse works
   - [ ] Status change works
   - [ ] All action buttons work

---

### Step 7: Fix Common Issues

#### Issue 1: "Cannot find module './components'"
**Fix**: Check `components/index.ts` exports `RoutesPlanTable`

#### Issue 2: "Property 'plan_id' does not exist"
**Fix**: Import `RoutePlan` type from `./types`

#### Issue 3: "Handler function not found"
**Fix**: Create missing handler or find equivalent function

#### Issue 4: TypeScript errors
**Fix**: Check all props match the interface

---

## 🧪 Testing Checklist

### Visual Tests
- [ ] Table displays correctly
- [ ] Columns aligned properly
- [ ] Loading spinner shows
- [ ] Empty state shows
- [ ] Sorting icons appear
- [ ] Action buttons visible
- [ ] Status dropdown works

### Functional Tests
- [ ] Click expand → trips show/hide
- [ ] Click sort → data sorts correctly
- [ ] Change status → updates in database
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
- [ ] Status change error → error message
- [ ] Delete disabled → button disabled

---

## 🔄 Rollback Plan

If something goes wrong:

```bash
# Restore backup
cp app/receiving/routes/page.tsx.backup app/receiving/routes/page.tsx

# Or use git
git checkout app/receiving/routes/page.tsx
```

---

## 📊 Expected Results

### Before Integration
```
page.tsx: 3,323 lines
- Table code inline (~470 lines)
- Hard to maintain
```

### After Integration
```
page.tsx: ~2,860 lines (-463 lines)
RoutesPlanTable: 720 lines (separate)
- Easy to maintain
- Reusable
- Type-safe
```

---

## 🎯 Success Criteria

- ✅ No console errors
- ✅ All features work as before
- ✅ No visual regressions
- ✅ Performance same or better
- ✅ Code more maintainable

---

## 📞 Need Help?

If you encounter issues:

1. Check console for errors
2. Verify all props are passed correctly
3. Check handler functions exist
4. Review `SPRINT3_INTEGRATION_GUIDE.md`
5. Check `SPRINT3_DAY1-2_COMPLETE.md`

---

**สร้างโดย**: Kiro AI  
**วันที่**: 17 มกราคม 2026  
**Status**: Ready for Integration

---

## 🚀 Quick Start

```bash
# 1. Backup
cp app/receiving/routes/page.tsx app/receiving/routes/page.tsx.backup

# 2. Edit page.tsx
# - Add import: import { RoutesPlanTable } from './components';
# - Add handlers (if missing)
# - Replace table section with <RoutesPlanTable ... />

# 3. Test
npm run dev
# Open http://localhost:3000/receiving/routes

# 4. If issues, rollback
cp app/receiving/routes/page.tsx.backup app/receiving/routes/page.tsx
```

Good luck! 🎉
