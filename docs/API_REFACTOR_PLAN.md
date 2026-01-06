# 🔧 API Refactor Plan for Process Consistency
**Date:** 2026-01-06  
**Author:** Lead Backend Engineer  
**Priority:** HIGH

---

## 📊 EXECUTIVE SUMMARY

This document outlines the required API changes to enforce process consistency across the WMS system. All APIs that modify entity status must validate state transitions and update related entities atomically.

---

## 1. CRITICAL API CHANGES

### 1.1 `/api/mobile/pick/scan/route.ts` - PRIORITY: CRITICAL

**Current Issues:**
- ❌ Allows negative balance deduction (fixed in migration 178)
- ❌ No stock availability check before picking
- ❌ Creates duplicate Dispatch balances

**Required Changes:**

```typescript
// ADD: Stock availability check BEFORE deducting
const { data: availability } = await supabase.rpc('check_stock_availability', {
    p_balance_id: balance.balance_id,
    p_required_qty: qtyToDeduct
});

if (!availability.is_available) {
    return NextResponse.json({
        error: `สต็อกไม่เพียงพอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${availability.available_qty} ชิ้น`,
        available_qty: availability.available_qty,
        shortage_qty: availability.shortage_qty
    }, { status: 400 });
}

// ADD: Use upsert_dispatch_balance function instead of manual INSERT/UPDATE
await supabase.rpc('upsert_dispatch_balance', {
    p_warehouse_id: warehouseId,
    p_location_id: dispatchLocation.location_id,
    p_sku_id: item.sku_id,
    p_piece_qty: quantity_picked,
    p_pack_qty: packQty
});
```

**Status:** Migration 178 added helper functions, API needs update

---

### 1.2 `/api/orders/[id]/route.ts` - PRIORITY: HIGH

**Current Issues:**
- ❌ No state transition validation
- ❌ No audit logging
- ❌ Allows any status change

**Required Changes:**

```typescript
// ADD: State transition validation
import { getOrderAllowedTransitions, isValidOrderTransition } from '@/lib/state-machine';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await request.json();
    
    if (body.status !== undefined) {
        // Get current status
        const { data: order } = await supabase
            .from('wms_orders')
            .select('status, order_no')
            .eq('order_id', parseInt(id))
            .single();
        
        // Validate transition
        if (!isValidOrderTransition(order.status, body.status)) {
            const allowed = getOrderAllowedTransitions(order.status);
            return NextResponse.json({
                error: `Invalid status transition from ${order.status} to ${body.status}`,
                current_status: order.status,
                allowed_transitions: allowed
            }, { status: 400 });
        }
    }
    
    // ... rest of update logic
}
```

---

### 1.3 `/api/picklists/[id]/route.ts` - PRIORITY: HIGH

**Required Changes:**
- Add state transition validation
- Add audit logging
- Ensure related orders are updated atomically

```typescript
// ADD: When picklist status changes to 'completed'
if (body.status === 'completed') {
    // Get all orders in this picklist
    const { data: orderIds } = await supabase
        .from('picklist_items')
        .select('order_id')
        .eq('picklist_id', id);
    
    // Check if all items for each order are picked
    for (const { order_id } of orderIds) {
        const { data: unpickedItems } = await supabase
            .from('picklist_items')
            .select('id')
            .eq('order_id', order_id)
            .neq('status', 'picked')
            .limit(1);
        
        if (!unpickedItems || unpickedItems.length === 0) {
            // All items picked - update order status
            await supabase
                .from('wms_orders')
                .update({ status: 'picked' })
                .eq('order_id', order_id)
                .eq('status', 'in_picking');
        }
    }
}
```

---

### 1.4 `/api/loadlists/[id]/route.ts` - PRIORITY: HIGH

**Required Changes:**
- Add state transition validation
- Update order status when loadlist status changes

```typescript
// ADD: When loadlist status changes to 'loaded'
if (body.status === 'loaded') {
    // Update all orders in this loadlist
    const { data: orderIds } = await supabase
        .from('loadlist_items')
        .select('order_id')
        .eq('loadlist_id', id);
    
    await supabase
        .from('wms_orders')
        .update({ status: 'loaded' })
        .in('order_id', orderIds.map(o => o.order_id))
        .eq('status', 'picked');
}
```

---

## 2. NEW UTILITY LIBRARY

### 2.1 Create `/lib/state-machine/index.ts`

```typescript
// Order state machine
export const ORDER_TRANSITIONS: Record<string, string[]> = {
    'draft': ['confirmed', 'cancelled'],
    'confirmed': ['in_picking', 'cancelled'],
    'in_picking': ['picked', 'confirmed', 'cancelled'],
    'picked': ['loaded', 'in_picking', 'cancelled'],
    'loaded': ['in_transit', 'picked', 'cancelled'],
    'in_transit': ['delivered', 'loaded'],
    'delivered': [],
    'cancelled': []
};

export function isValidOrderTransition(from: string, to: string): boolean {
    return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getOrderAllowedTransitions(status: string): string[] {
    return ORDER_TRANSITIONS[status] ?? [];
}

// Picklist state machine
export const PICKLIST_TRANSITIONS: Record<string, string[]> = {
    'pending': ['assigned', 'picking', 'cancelled'],
    'assigned': ['picking', 'pending', 'cancelled'],
    'picking': ['completed', 'assigned', 'cancelled'],
    'completed': ['voided'],
    'cancelled': [],
    'voided': []
};

export function isValidPicklistTransition(from: string, to: string): boolean {
    return PICKLIST_TRANSITIONS[from]?.includes(to) ?? false;
}

// Loadlist state machine
export const LOADLIST_TRANSITIONS: Record<string, string[]> = {
    'pending': ['loaded', 'cancelled'],
    'loaded': ['in_transit', 'pending', 'cancelled', 'completed'],
    'in_transit': ['completed', 'loaded'],
    'completed': ['voided'],
    'cancelled': [],
    'voided': []
};

export function isValidLoadlistTransition(from: string, to: string): boolean {
    return LOADLIST_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## 3. API ENDPOINTS TO UPDATE

| API | Priority | Changes Required |
|-----|----------|------------------|
| `/api/mobile/pick/scan` | 🔴 CRITICAL | Stock check, upsert dispatch |
| `/api/orders/[id]` | 🔴 HIGH | State validation |
| `/api/picklists/[id]` | 🔴 HIGH | State validation, order sync |
| `/api/loadlists/[id]` | 🔴 HIGH | State validation, order sync |
| `/api/picklists/create-from-trip` | 🟡 MEDIUM | Already has validation |
| `/api/face-sheets/[id]` | 🟡 MEDIUM | State validation |
| `/api/bonus-face-sheets/[id]` | 🟡 MEDIUM | State validation |
| `/api/route-plans/[id]` | 🟡 MEDIUM | State validation |

---

## 4. TESTING CHECKLIST

### 4.1 Order State Machine Tests

- [ ] `draft` → `confirmed` ✓
- [ ] `draft` → `cancelled` ✓
- [ ] `draft` → `picked` ✗ (should fail)
- [ ] `confirmed` → `in_picking` ✓
- [ ] `in_picking` → `picked` ✓
- [ ] `in_picking` → `confirmed` ✓ (rollback)
- [ ] `picked` → `loaded` ✓
- [ ] `picked` → `in_picking` ✓ (rollback)
- [ ] `delivered` → any ✗ (terminal)
- [ ] `cancelled` → any ✗ (terminal)

### 4.2 Picklist State Machine Tests

- [ ] `pending` → `assigned` ✓
- [ ] `pending` → `picking` ✓
- [ ] `picking` → `completed` ✓
- [ ] `completed` → `voided` ✓
- [ ] `completed` → `cancelled` ✗ (should fail)

### 4.3 Integration Tests

- [ ] Create picklist → Order becomes `in_picking`
- [ ] Complete picklist → Order becomes `picked`
- [ ] Load loadlist → Order becomes `loaded`
- [ ] Delete picklist → Order reverts to `confirmed`

---

## 5. ROLLBACK STRATEGY

### 5.1 Order Rollback

When rolling back an order:
1. Check current status
2. Validate rollback is allowed
3. Release any reservations
4. Void related documents (picklists, face sheets)
5. Update order status
6. Log to audit table

### 5.2 Picklist Rollback

When voiding a picklist:
1. Release all reservations
2. Reverse inventory movements (Dispatch → Source)
3. Update picklist status to `voided`
4. Check if order should revert to `confirmed`

---

## 6. IMPLEMENTATION TIMELINE

| Phase | Tasks | Duration |
|-------|-------|----------|
| Phase 1 | Create state-machine library | 1 day |
| Phase 2 | Update critical APIs (pick/scan, orders) | 2 days |
| Phase 3 | Update secondary APIs (picklists, loadlists) | 2 days |
| Phase 4 | Integration testing | 2 days |
| Phase 5 | Enable database triggers | 1 day |

**Total Estimated Time:** 8 days

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-06
