# Stock Replenishment Alerts System Implementation

> **Implementation Date:** 2025-01-25
> **Migration:** 037_create_stock_replenishment_alerts.sql
> **Status:** ✅ Code Complete (pending database deployment)

---

## 📋 Overview

This system automatically monitors stock levels in picking areas and creates alerts when stock is insufficient for picklist reservations. It uses FEFO (First Expire First Out) + FIFO (First In First Out) logic to suggest optimal replenishment sources across the warehouse.

---

## 🎯 Key Features

### 1. Automatic Stock Sufficiency Checking
When a picklist is created, the system:
- ✅ Checks if total stock at `source_location_id` is sufficient
- ✅ Compares against `quantity_to_pick` + `min_stock_qty` (from replenishment_rules)
- ✅ Creates alerts if insufficient

### 2. FEFO + FIFO Source Recommendations
The alert system:
- ✅ Searches entire warehouse using FEFO (expiry_date ascending)
- ✅ Falls back to FIFO (production_date ascending) for same expiry dates
- ✅ Stores top 10 recommended source locations in `suggested_sources` JSONB field

### 3. Pallet Calculation
Automatically calculates:
- ✅ `pallets_needed` based on `master_sku.qty_per_pallet`
- ✅ Uses actual available quantities from `wms_inventory_balances`
- ✅ Excludes reserved stock from calculations

### 4. Priority-Based Alerts
Alert priority (1-10 scale):
- **10 (Urgent)**: No stock at all (`current_qty <= 0`)
- **8 (High)**: Insufficient for picklist reservation
- **7 (Medium)**: Below min threshold
- **5 (Normal)**: Other cases

---

## 🗄️ Database Schema

### New Table: `wms_stock_replenishment_alerts`

```sql
CREATE TABLE wms_stock_replenishment_alerts (
    alert_id uuid PRIMARY KEY,
    warehouse_id varchar(50) NOT NULL,
    sku_id varchar(50) NOT NULL,
    pick_location_id varchar(50) NOT NULL,  -- source_location_id from picklist

    -- Stock info
    required_qty numeric(18,2) NOT NULL,     -- reserved + min threshold
    current_qty numeric(18,2) NOT NULL,
    shortage_qty numeric(18,2) NOT NULL,
    pallets_needed integer NOT NULL,

    -- Replenishment rules
    min_stock_qty numeric(18,2),
    max_stock_qty numeric(18,2),
    replen_qty numeric(18,2),

    -- FEFO source recommendations
    suggested_sources jsonb,  -- Array of {location_id, available_qty, expiry_date, pallet_id}

    -- Metadata
    alert_reason text,
    picklist_id uuid,
    priority integer DEFAULT 5,
    status stock_alert_status_enum DEFAULT 'pending',

    -- Audit
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    created_by varchar(100),
    resolved_at timestamp,
    resolved_by varchar(100),
    notes text
);
```

### New Enum: `stock_alert_status_enum`
- `pending` - แจ้งเตือนใหม่ ยังไม่ดำเนินการ
- `in_progress` - กำลังดำเนินการเติมสต็อก
- `completed` - เติมสต็อกเสร็จแล้ว
- `cancelled` - ยกเลิกการแจ้งเตือน

### New View: `vw_active_stock_alerts`

Provides full details for active alerts including:
- Warehouse, SKU, and location names
- Suggested sources (JSONB)
- Picklist reference
- Hours since alert created

---

## 🔧 Database Function

### `check_and_create_replenishment_alert()`

**Purpose:** Automatically check stock sufficiency and create alerts

**Parameters:**
- `p_warehouse_id` - Warehouse to check
- `p_sku_id` - SKU to check
- `p_pick_location_id` - Source location from picklist
- `p_required_qty` - Quantity needed (from picklist)
- `p_picklist_id` - Optional picklist reference
- `p_created_by` - User creating the alert

**Returns:**
```typescript
{
  alert_created: boolean,
  alert_id: uuid,
  shortage_qty: numeric,
  message: text
}
```

**Logic:**
1. Get current stock at pick location
2. Get replenishment rules (min/max) for the location/SKU
3. Calculate target quantity: `MAX(required_qty, min_stock_qty)`
4. If insufficient → Create alert with:
   - Shortage calculation
   - Pallet calculation (from master_sku)
   - FEFO source search (top 10 locations)
   - Priority assignment
5. If sufficient → Return success without creating alert

---

## 🚀 API Endpoints

### GET `/api/stock-alerts`

**Description:** Fetch active stock alerts

**Query Parameters:**
- `warehouse_id` - Filter by warehouse
- `status` - `pending` | `in_progress` | `all` (default: pending)
- `priority` - Minimum priority level

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "alert_id": "...",
      "warehouse_name": "คลังหลัก",
      "sku_name": "น้ำดื่ม 600ml",
      "pick_location_code": "A-01-01-01",
      "shortage_qty": 240,
      "pallets_needed": 2,
      "suggested_sources": [
        {
          "location_id": "LOC-XXX",
          "location_code": "B-02-03-01",
          "available_qty": 500,
          "expiry_date": "2025-06-30",
          "pallet_id": "PLT-123"
        }
      ],
      "priority": 8,
      "hours_since_alert": 2.5
    }
  ],
  "total": 1
}
```

### PATCH `/api/stock-alerts`

**Description:** Update alert status

**Body:**
```json
{
  "alert_id": "uuid",
  "status": "in_progress" | "completed" | "cancelled",
  "notes": "Optional notes"
}
```

---

## 💻 Code Changes

### 1. Picklist Creation API
**File:** `app/api/picklists/create-from-trip/route.ts`

**Added:** Lines 301-331
```typescript
// 12. ตรวจสอบสต็อกและสร้างการแจ้งเตือนหากไม่เพียงพอ
for (const item of itemsToInsert) {
  const { data: alertResult } = await supabase.rpc('check_and_create_replenishment_alert', {
    p_warehouse_id: warehouseId,
    p_sku_id: item.sku_id,
    p_pick_location_id: item.source_location_id,
    p_required_qty: item.quantity_to_pick,
    p_picklist_id: picklist.id,
    p_created_by: user?.id
  });

  if (alertResult[0].alert_created) {
    stockCheckResults.push({
      sku_id: item.sku_id,
      alert_id: alertResult[0].alert_id,
      shortage_qty: alertResult[0].shortage_qty,
      message: alertResult[0].message
    });
  }
}
```

**Response Modified:**
```json
{
  "success": true,
  "picklist_id": "...",
  "stock_alerts": [...],  // ← NEW
  "warnings": [
    "⚠️ สต็อกไม่เพียงพอ 2 รายการ - สร้างการแจ้งเตือนแล้ว"
  ]
}
```

### 2. Stock Alerts API
**New File:** `app/api/stock-alerts/route.ts`
- GET endpoint for fetching alerts
- PATCH endpoint for updating alert status

### 3. TypeScript Types
**New File:** `types/stock-alerts.ts`
- `StockAlertStatus`
- `SuggestedSource`
- `StockReplenishmentAlert`
- `ActiveStockAlert`
- `AlertCheckResult`

---

## 📊 Integration with Existing Workflow

### Picklist Creation Flow
```
1. Create picklist from trip/route
   ↓
2. Reserve stock using FEFO+FIFO
   ↓
3. Check stock sufficiency ← NEW
   ↓ (if insufficient)
4. Create alert with FEFO source search
   ↓
5. Return picklist + alert warnings
```

### Stock Reservation Flow (Existing)
```
create-from-trip → Reserve stock (FEFO+FIFO)
      ↓
picklist.status = 'assigned'
      ↓
reserved_piece_qty updated
      ↓
complete → Unreserve (FEFO+FIFO)
      ↓
Move stock to Dispatch
```

---

## 🎯 Next Steps

### 1. Mobile Transfer Page Integration
**Location:** `/mobile/transfer`

**Requirements:**
- [ ] Display active alerts from `GET /api/stock-alerts`
- [ ] Show suggested sources (FEFO ordered)
- [ ] Show pallet count and shortage quantity
- [ ] Allow marking alerts as in_progress/completed
- [ ] Filter by warehouse
- [ ] Sort by priority

**UI Components Needed:**
```typescript
<AlertList>
  <AlertCard priority={8}>
    <SKUInfo name="น้ำดื่ม 600ml" />
    <LocationInfo code="A-01-01" shortage={240} />
    <PalletCount needed={2} />
    <SuggestedSources sources={[...]} />  ← FEFO ordered
    <ActionButtons onStart={} onComplete={} />
  </AlertCard>
</AlertList>
```

### 2. Alert Display in Inventory Page
**Location:** `/warehouse/inventory-balances`

**Optional Enhancement:**
- Show alert badge/icon for SKUs with active alerts
- Quick link to /mobile/transfer filtered by SKU

### 3. Dashboard Widget
**Location:** `/dashboard`

**Optional Enhancement:**
- Summary card showing pending alerts count
- High priority alerts (priority >= 8)
- Link to /mobile/transfer

---

## 🔍 Testing Checklist

### Unit Tests
- [ ] Test `check_and_create_replenishment_alert()` function
  - [ ] Sufficient stock → No alert
  - [ ] Insufficient stock → Create alert
  - [ ] FEFO ordering of suggested sources
  - [ ] Pallet calculation accuracy

### Integration Tests
- [ ] Create picklist with insufficient stock
  - [ ] Verify alert is created
  - [ ] Check suggested_sources JSONB structure
  - [ ] Verify priority assignment
- [ ] GET /api/stock-alerts
  - [ ] Filter by warehouse
  - [ ] Filter by status
  - [ ] Sort by priority
- [ ] PATCH /api/stock-alerts
  - [ ] Update status to in_progress
  - [ ] Mark as completed
  - [ ] Add notes

### E2E Tests
- [ ] Full workflow: Create route → Create picklist → View alerts → Resolve alert
- [ ] Mobile transfer page displays alerts correctly
- [ ] FEFO source recommendations are accurate

---

## 📝 Related Documentation

- **Picklist Workflow:** [WORKFLOW_IMPLEMENTATION_SUMMARY.md](../workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md)
- **Stock Reservation:** Lines 245-304 in `app/api/picklists/create-from-trip/route.ts`
- **Stock Unreservation:** Lines 112-183 in `app/api/picklists/[id]/complete/route.ts`
- **Replenishment Rules:** Table `replenishment_rules` (existing)
- **FEFO + FIFO Logic:** ORDER BY `expiry_date ASC`, `production_date ASC`, `created_at ASC`

---

## ⚠️ Important Notes

1. **Database Deployment Required:** Migration 037 must be deployed to Supabase
2. **Type Generation:** Run `npm run db:generate-types` after deployment
3. **Min/Max Configuration:** Ensure `replenishment_rules` table is populated for picking areas
4. **FEFO Logic:** System prioritizes expiry_date first, then production_date
5. **Pallet Calculation:** Requires `master_sku.qty_per_pallet` to be accurate

---

**Last Updated:** 2025-01-25
**Author:** Claude Code
**Status:** ✅ Code Complete | ⏳ Awaiting Database Deployment
