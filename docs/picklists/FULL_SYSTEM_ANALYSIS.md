# 🔍 Full System Analysis: Picklist, Face Sheet & Loadlist Module

**Date:** January 17, 2026  
**Analyst:** Kiro AI  
**Status:** ⚠️ CRITICAL BUGS IDENTIFIED

---

## 📋 Executive Summary

This document provides a comprehensive analysis of the Picklist, Face Sheet, and Loadlist system in the AustamGood WMS. The analysis reveals **critical race conditions and stock management bugs** that cause "insufficient stock" errors in production.

### Key Findings:
1. ✅ **Virtual Pallet System** - Implemented to handle stock shortages
2. ❌ **Race Conditions** - Multiple concurrent requests can oversell stock
3. ❌ **Transaction Isolation** - Multi-step operations lack atomic transactions
4. ❌ **Timing Issues** - Delays between validation and reservation
5. ⚠️ **Missing Rollback** - Failed operations don't properly release stock

---

## 🎯 System Overview

### Document Types
| Document | Purpose | Order Type | Stock Operation |
|----------|---------|------------|-----------------|
| **Picklist** | จัดเส้นทาง (Route-based) | จัดเส้นทาง | Reserve on create |
| **Face Sheet** | ส่งรายชิ้น (Individual delivery) | ส่งรายชิ้น | Reserve on create |
| **Bonus Face Sheet** | ของแถม (Bonus items) | พิเศษ | Reserve on create |
| **Loadlist** | รวมเอกสารเพื่อโหลด | All types | No stock operation |

### URLs
- Picklist: `http://localhost:3000/receiving/picklists`
- Face Sheet: `http://localhost:3000/receiving/picklists/face-sheets`
- Bonus Face Sheet: `http://localhost:3000/receiving/picklists/bonus-face-sheets`
- Loadlist: `http://localhost:3000/receiving/loadlists`
- Mobile Pick: `http://localhost:3000/mobile/pick`
- Mobile Loading: `http://localhost:3000/mobile/loading`

---

## 📊 Complete Data Flow


### Phase 1: Order Creation → Document Generation

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ORDER CREATION                                               │
│    - wms_orders table                                           │
│    - status: draft → confirmed → picked → loaded                │
│    - order_type: 'express' (regular) or 'special' (bonus)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ROUTE PLANNING (for จัดเส้นทาง orders)                      │
│    - /api/route-plans/optimize                                  │
│    - Creates: receiving_route_plans, receiving_route_trips      │
│    - Status: draft → approved → published                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3A. PICKLIST CREATION (from trips)                             │
│     API: POST /api/picklists/create-from-trip                   │
│     ✅ STOCK RESERVATION HAPPENS HERE                           │
│     - Validates stock availability                              │
│     - Creates picklist + picklist_items                         │
│     - Reserves stock (FEFO/FIFO)                                │
│     - Supports Virtual Pallet if insufficient                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3B. FACE SHEET CREATION (for ส่งรายชิ้น orders)                │
│     API: POST /api/face-sheets/generate                         │
│     ✅ STOCK RESERVATION HAPPENS HERE                           │
│     - Validates customer hub                                    │
│     - Creates face_sheet + face_sheet_items                     │
│     - Calls reserve_stock_for_face_sheet_items()                │
│     - Updates order status: draft → confirmed                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3C. BONUS FACE SHEET CREATION (for พิเศษ orders)               │
│     API: POST /api/bonus-face-sheets                            │
│     ✅ STOCK RESERVATION HAPPENS HERE                           │
│     - Validates SKU preparation area mappings                   │
│     - Creates bonus_face_sheets + packages + items              │
│     - Calls reserve_stock_for_bonus_face_sheet_items()          │
│     - Updates order status: draft → confirmed                   │
└─────────────────────────────────────────────────────────────────┘

### Phase 2: Picking & Loading

```
┌─────────────────────────────────────────────────────────────────┐
│ 4. LOADLIST CREATION                                            │
│    API: POST /api/loadlists                                     │
│    ⚠️ NO STOCK OPERATIONS - Just links documents                │
│    - Links picklists, face_sheets, bonus_face_sheets           │
│    - Creates wms_loadlist_bonus_face_sheets mapping             │
│    - Two modes:                                                 │
│      a) Normal: Maps BFS to picklist/face sheet                 │
│      b) Skip mapping: Direct BFS loadlist (no mapping)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. MOBILE PICK (Worker confirms picking)                       │
│    Page: /mobile/pick/[id]                                     │
│    API: POST /api/mobile/pick/scan                              │
│    ✅ STOCK DEDUCTION HAPPENS HERE                              │
│    - Worker scans items                                         │
│    - Validates reservation exists                               │
│    - Deducts from source location (Prep Area)                   │
│    - Adds to Dispatch location                                  │
│    - Updates picklist_items status: pending → picked            │
│    - Inserts wms_inventory_ledger entries                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. MOBILE LOADING (Worker confirms loading)                    │
│    Page: /mobile/loading/[code]                                │
│    API: POST /api/mobile/loading/complete                       │
│    ✅ STOCK TRANSFER HAPPENS HERE                               │
│    - Worker confirms loading                                    │
│    - Validates stock in Dispatch                                │
│    - Deducts from Dispatch                                      │
│    - Adds to Delivery-In-Progress                               │
│    - Updates loadlist status: pending → loaded                  │
│    - Updates picklist/face sheet status: picked → loaded        │
│    - Inserts wms_inventory_ledger entries                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Core Stock Tables

#### wms_inventory_balances
```sql
CREATE TABLE wms_inventory_balances (
  balance_id BIGSERIAL PRIMARY KEY,
  warehouse_id VARCHAR(50) NOT NULL,
  location_id VARCHAR(50) NOT NULL,
  sku_id VARCHAR(50) NOT NULL,
  pallet_id VARCHAR(100),
  total_piece_qty NUMERIC(18,2) DEFAULT 0,
  reserved_piece_qty NUMERIC(18,2) DEFAULT 0,  -- ✅ Reserved stock
  total_pack_qty NUMERIC(18,2) DEFAULT 0,
  reserved_pack_qty NUMERIC(18,2) DEFAULT 0,
  production_date DATE,
  expiry_date DATE,
  lot_no VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Available stock = total_piece_qty - reserved_piece_qty
```

#### wms_inventory_ledger
```sql
CREATE TABLE wms_inventory_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  movement_at TIMESTAMP NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,  -- 'PICK', 'LOAD', 'VIRTUAL_RESERVE', etc.
  direction VARCHAR(10) NOT NULL,         -- 'in' or 'out'
  warehouse_id VARCHAR(50) NOT NULL,
  location_id VARCHAR(50) NOT NULL,
  sku_id VARCHAR(50) NOT NULL,
  pallet_id VARCHAR(100),
  pack_qty NUMERIC(18,2),
  piece_qty NUMERIC(18,2),
  reference_no VARCHAR(100),
  remarks TEXT,
  skip_balance_sync BOOLEAN DEFAULT FALSE,  -- ✅ For Virtual Pallet entries
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### virtual_pallet_settlements
```sql
CREATE TABLE virtual_pallet_settlements (
  settlement_id BIGSERIAL PRIMARY KEY,
  virtual_pallet_id VARCHAR(100) NOT NULL,  -- 'VIRTUAL-{location}-{sku}'
  location_id VARCHAR(50) NOT NULL,
  sku_id VARCHAR(50) NOT NULL,
  warehouse_id VARCHAR(50) NOT NULL,
  source_pallet_id VARCHAR(100) NOT NULL,   -- Real pallet that settled
  source_balance_id BIGINT NOT NULL,
  settled_piece_qty NUMERIC(18,2) NOT NULL,
  settled_pack_qty NUMERIC(18,2) NOT NULL,
  virtual_balance_before NUMERIC(18,2) NOT NULL,
  virtual_balance_after NUMERIC(18,2) NOT NULL,
  settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_by BIGINT,
  ledger_id_in BIGINT,
  ledger_id_out BIGINT,
  ledger_id_virtual BIGINT
);
```

### Reservation Tables

#### picklist_item_reservations
```sql
CREATE TABLE picklist_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  picklist_item_id BIGINT NOT NULL REFERENCES picklist_items(id),
  balance_id BIGINT NOT NULL REFERENCES wms_inventory_balances(balance_id),
  reserved_piece_qty NUMERIC(18,2) NOT NULL,
  reserved_pack_qty NUMERIC(18,2) NOT NULL,
  reserved_by BIGINT,
  status VARCHAR(20) DEFAULT 'reserved',  -- 'reserved', 'consumed', 'released'
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### face_sheet_item_reservations
```sql
CREATE TABLE face_sheet_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  face_sheet_item_id BIGINT NOT NULL REFERENCES face_sheet_items(id),
  balance_id BIGINT NOT NULL REFERENCES wms_inventory_balances(balance_id),
  reserved_piece_qty NUMERIC(18,2) NOT NULL,
  reserved_pack_qty NUMERIC(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'reserved',
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### bonus_face_sheet_item_reservations
```sql
CREATE TABLE bonus_face_sheet_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  bonus_face_sheet_item_id BIGINT NOT NULL REFERENCES bonus_face_sheet_items(id),
  balance_id BIGINT NOT NULL REFERENCES wms_inventory_balances(balance_id),
  reserved_piece_qty NUMERIC(18,2) NOT NULL,
  reserved_pack_qty NUMERIC(18,2) NOT NULL,
  reserved_by VARCHAR(100),
  status VARCHAR(20) DEFAULT 'reserved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Stock Reservation Logic

### FEFO/FIFO Algorithm

All reservation functions follow this priority:
1. **FEFO** (First Expired, First Out) - Earliest expiry_date first
2. **FIFO** (First In, First Out) - Earliest production_date first
3. **Oldest balance_id** - Tie-breaker

```sql
ORDER BY 
  expiry_date ASC NULLS LAST,      -- FEFO
  production_date ASC NULLS LAST,  -- FIFO
  balance_id ASC                   -- Oldest first
```

### Reservation Flow (Picklist Example)

```typescript
// File: app/api/picklists/create-from-trip/route.ts (lines 514-690)

// STEP 1: Query available balances (FEFO/FIFO)
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('*')
  .eq('warehouse_id', warehouseId)
  .in('location_id', locationIdsToReserve)
  .eq('sku_id', item.sku_id)
  .not('pallet_id', 'like', 'VIRTUAL-%')  // ✅ Exclude Virtual Pallets
  .order('expiry_date', { ascending: true, nullsFirst: false })
  .order('production_date', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: true });

// STEP 2: Reserve from real pallets
for (const balance of balances || []) {
  const availableQty = balance.total_piece_qty - balance.reserved_piece_qty;
  const qtyToReserve = Math.min(availableQty, remainingQty);
  
  // Update balance
  await supabase
    .from('wms_inventory_balances')
    .update({
      reserved_piece_qty: balance.reserved_piece_qty + qtyToReserve,
      reserved_pack_qty: balance.reserved_pack_qty + packToReserve
    })
    .eq('balance_id', balance.balance_id);
  
  // Record reservation
  reservationsToInsert.push({
    picklist_item_id: picklistItem.id,
    balance_id: balance.balance_id,
    reserved_piece_qty: qtyToReserve,
    reserved_pack_qty: packToReserve,
    status: 'reserved'
  });
  
  remainingQty -= qtyToReserve;
}

// STEP 3: If insufficient, create Virtual Pallet reservation
if (remainingQty > 0) {
  const { data: virtualResult } = await supabase
    .rpc('create_or_update_virtual_balance', {
      p_location_id: prepAreaCode,
      p_sku_id: item.sku_id,
      p_warehouse_id: warehouseId,
      p_piece_qty: -remainingQty,  // ✅ Negative balance
      p_pack_qty: -packShort,
      p_reserved_piece_qty: remainingQty,  // ✅ Reserved = shortage
      p_reserved_pack_qty: packShort
    });
  
  // Record Virtual Pallet reservation
  reservationsToInsert.push({
    picklist_item_id: picklistItem.id,
    balance_id: virtualBalanceId,
    reserved_piece_qty: remainingQty,
    reserved_pack_qty: packShort,
    status: 'reserved'
  });
}
```

---

## 🐛 Critical Bugs Identified

### Bug #1: Race Condition in Stock Reservation

**Location:** `app/api/picklists/create-from-trip/route.ts` (lines 514-690)

**Problem:**
```typescript
// STEP 1: Query available stock (NOT LOCKED)
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('*')
  .eq('sku_id', item.sku_id);

// STEP 2: Calculate in application code
const availableQty = balance.total_piece_qty - balance.reserved_piece_qty;

// STEP 3: Update reservation (RACE CONDITION HERE!)
await supabase
  .from('wms_inventory_balances')
  .update({
    reserved_piece_qty: balance.reserved_piece_qty + qtyToReserve
  })
  .eq('balance_id', balance.balance_id);
```

**Issue:** Between STEP 1 and STEP 3, another request can reserve the same stock.

**Example Scenario:**
```
Time  Request A                    Request B
----  -------------------------    -------------------------
T1    Query: available = 100
T2                                 Query: available = 100
T3    Reserve 80 (available = 20)
T4                                 Reserve 80 (available = -60) ❌ OVERSOLD!
```

**Impact:** ⚠️ **CRITICAL** - Causes "insufficient stock" errors and overselling

### Bug #2: Multi-Step Transaction Without Atomicity

**Location:** `app/api/face-sheets/generate/route.ts` (lines 256-310)

**Problem:**
```typescript
// STEP 1: Create face sheet (SEPARATE RPC CALL)
const { data: result } = await supabase.rpc('create_face_sheet_packages', {
  p_warehouse_id: warehouse_id,
  p_delivery_date: delivery_date,
  p_order_ids: order_ids
});

// STEP 2: Reserve stock (SEPARATE RPC CALL - NOT IN TRANSACTION!)
const { data: reserveResult } = await supabase.rpc('reserve_stock_for_face_sheet_items', {
  p_face_sheet_id: result.face_sheet_id,
  p_warehouse_id: warehouse_id,
  p_reserved_by: created_by
});

// ❌ If STEP 2 fails, STEP 1 already committed!
if (reserveError) {
  return NextResponse.json({
    error: 'ไม่สามารถจองสต็อคได้',
    face_sheet_id: result.face_sheet_id,  // ❌ Face sheet exists but no reservation!
    reservation_failed: true
  }, { status: 500 });
}
```

**Issue:** Two separate RPC calls without transaction wrapping
- If reservation fails, face sheet already created
- Stock may be reserved by another request between calls
- No rollback mechanism

**Impact:** ⚠️ **HIGH** - Orphaned face sheets without reservations

---

### Bug #3: Bonus Face Sheet Reservation Timing

**Location:** `app/api/bonus-face-sheets/route.ts` (lines 348-390)

**Problem:**
```typescript
// Create packages and items first
for (let i = 0; i < packages.length; i++) {
  await supabase.from('bonus_face_sheet_packages').insert({ ... });
  await supabase.from('bonus_face_sheet_items').insert(items);
}

// ❌ 500ms delay before reservation!
await new Promise(resolve => setTimeout(resolve, 500));

// THEN call reservation
const { data: reservationResult } = await supabase
  .rpc('reserve_stock_for_bonus_face_sheet_items', {
    p_bonus_face_sheet_id: faceSheet.id
  });
```

**Issue:** 
- 500ms delay between item creation and reservation
- Other requests can reserve same stock during this window
- No atomic operation

**Impact:** ⚠️ **HIGH** - Race condition window of 500ms

---

### Bug #4: Virtual Pallet Settlement Timing

**Location:** `supabase/migrations/209_create_virtual_pallet_system.sql` (lines 414-500)

**Problem:**
```sql
-- Trigger fires AFTER INSERT on wms_inventory_ledger
CREATE TRIGGER trg_z_settle_virtual_on_replenishment
    AFTER INSERT ON wms_inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION trigger_settle_virtual_on_replenishment();
```

**Issue:** 
- Trigger runs AFTER balance sync trigger
- If multiple ledger entries inserted rapidly, settlement may not complete before next reservation
- Virtual Pallet balance may still be negative when new reservation queries it

**Impact:** ⚠️ **MEDIUM** - Delayed settlement can cause temporary stock shortages

---

### Bug #5: Missing Row Locking

**Location:** All reservation functions

**Problem:** No `SELECT ... FOR UPDATE` to lock rows during transaction

**Current Code:**
```sql
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
AND sku_id = p_sku_id
AND total_piece_qty > reserved_piece_qty;
-- ❌ No row lock!
```

**Should Be:**
```sql
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
AND sku_id = p_sku_id
AND total_piece_qty > reserved_piece_qty
FOR UPDATE;  -- ✅ Lock rows until transaction commits
```

**Impact:** ⚠️ **CRITICAL** - Allows concurrent modifications

---

## 🔧 Recommended Fixes

### Fix #1: Implement Row-Level Locking

```sql
-- Update all reservation functions to use FOR UPDATE
CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(...)
RETURNS TABLE(...) AS $
DECLARE
  v_balance RECORD;
BEGIN
  FOR v_balance IN
    SELECT * FROM wms_inventory_balances
    WHERE warehouse_id = p_warehouse_id
    AND sku_id = v_item.sku_id
    AND total_piece_qty > reserved_piece_qty
    FOR UPDATE  -- ✅ Lock rows
    ORDER BY expiry_date ASC, production_date ASC
  LOOP
    -- Safe to update now
    UPDATE wms_inventory_balances
    SET reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve
    WHERE balance_id = v_balance.balance_id;
  END LOOP;
END;
$ LANGUAGE plpgsql;
```

### Fix #2: Wrap Multi-Step Operations in Single Transaction

```typescript
// Create single RPC function that does both create + reserve
const { data, error } = await supabase.rpc('create_and_reserve_face_sheet', {
  p_warehouse_id: warehouse_id,
  p_delivery_date: delivery_date,
  p_order_ids: order_ids,
  p_reserved_by: created_by
});

// Database function (atomic transaction):
CREATE OR REPLACE FUNCTION create_and_reserve_face_sheet(...)
RETURNS TABLE(...) AS $
BEGIN
  -- STEP 1: Create face sheet
  INSERT INTO face_sheets (...) RETURNING * INTO v_face_sheet;
  
  -- STEP 2: Create items
  INSERT INTO face_sheet_items (...);
  
  -- STEP 3: Reserve stock (all in same transaction)
  FOR v_item IN SELECT * FROM face_sheet_items WHERE face_sheet_id = v_face_sheet.id LOOP
    -- Reserve logic here
  END LOOP;
  
  -- If any step fails, entire transaction rolls back
  RETURN QUERY SELECT ...;
END;
$ LANGUAGE plpgsql;
```

### Fix #3: Remove Artificial Delays

```typescript
// BEFORE (with delay):
await supabase.from('bonus_face_sheet_items').insert(items);
await new Promise(resolve => setTimeout(resolve, 500));  // ❌ Remove this!
await supabase.rpc('reserve_stock_for_bonus_face_sheet_items', ...);

// AFTER (immediate):
await supabase.from('bonus_face_sheet_items').insert(items);
await supabase.rpc('reserve_stock_for_bonus_face_sheet_items', ...);
```

### Fix #4: Implement Optimistic Locking

```sql
-- Add version column to wms_inventory_balances
ALTER TABLE wms_inventory_balances ADD COLUMN version INT DEFAULT 1;

-- Update with version check
UPDATE wms_inventory_balances
SET 
  reserved_piece_qty = reserved_piece_qty + p_qty_to_reserve,
  version = version + 1
WHERE balance_id = p_balance_id 
AND version = p_expected_version;  -- ✅ Fails if version changed

-- Check rows affected
GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
IF v_rows_affected = 0 THEN
  RAISE EXCEPTION 'Concurrent modification detected - retry';
END IF;
```

### Fix #5: Add Reservation Validation Before Deduction

```typescript
// In mobile pick API: /api/mobile/pick/scan
// BEFORE deducting stock, verify reservation still exists
const { data: reservation } = await supabase
  .from('picklist_item_reservations')
  .select('reserved_piece_qty, balance_id')
  .eq('picklist_item_id', item.id)
  .eq('status', 'reserved')
  .single();

if (!reservation || reservation.reserved_piece_qty < qty_to_deduct) {
  throw new Error('Reservation no longer valid - stock may have been released');
}

// Proceed with deduction
await supabase.from('wms_inventory_balances')
  .update({
    total_piece_qty: total_piece_qty - qty_to_deduct,
    reserved_piece_qty: reserved_piece_qty - qty_to_deduct
  })
  .eq('balance_id', reservation.balance_id);
```

---

## 📈 Stock Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STOCK LIFECYCLE                                                 │
└─────────────────────────────────────────────────────────────────┘

1. RECEIVE (Inbound)
   Location: Receiving Area
   Balance: total_piece_qty += qty
   Ledger: direction='in', transaction_type='RECEIVE'

2. TRANSFER TO PREP AREA
   From: Receiving Area
   To: Preparation Area (PK001, PK002, etc.)
   Balance: 
     - Receiving: total_piece_qty -= qty
     - Prep Area: total_piece_qty += qty
   Ledger: 2 entries (out from receiving, in to prep)

3. RESERVE (Picklist/Face Sheet Creation)
   Location: Preparation Area
   Balance: reserved_piece_qty += qty
   Reservation: picklist_item_reservations record created
   ⚠️ CRITICAL POINT: Race condition risk

4. PICK (Mobile Pick)
   From: Preparation Area
   To: Dispatch
   Balance:
     - Prep Area: total_piece_qty -= qty, reserved_piece_qty -= qty
     - Dispatch: total_piece_qty += qty
   Reservation: status = 'consumed'
   Ledger: 2 entries (out from prep, in to dispatch)

5. LOAD (Mobile Loading)
   From: Dispatch
   To: Delivery-In-Progress
   Balance:
     - Dispatch: total_piece_qty -= qty
     - Delivery: total_piece_qty += qty
   Ledger: 2 entries (out from dispatch, in to delivery)

6. DELIVER (Complete)
   From: Delivery-In-Progress
   To: (Out of system)
   Balance: Delivery: total_piece_qty -= qty
   Ledger: direction='out', transaction_type='DELIVER'
```

---

## 🔍 Virtual Pallet System

### Concept
Virtual Pallet = "Credit Account" for stock
- When real stock insufficient → Create reservation on Virtual Pallet (can go negative)
- When new stock arrives in Prep Area → Trigger auto-settles Virtual Pallet

### Example Scenario

```
Initial State:
  PK001 (Real Pallet): 30 pieces
  VIRTUAL-PK001-SKU001: 0 pieces

Step 1: Create picklist needing 35 pieces
  - Reserve 30 from Real Pallet
  - Reserve 5 from Virtual Pallet (balance = -5)
  
  PK001: total=30, reserved=30, available=0
  VIRTUAL-PK001-SKU001: total=-5, reserved=5, available=-10

Step 2: Replenish 10 pieces to PK001
  - Trigger: trigger_settle_virtual_on_replenishment()
  - Settle 5 pieces to Virtual Pallet
  
  PK001: total=5, reserved=0, available=5
  VIRTUAL-PK001-SKU001: total=0, reserved=5, available=-5
  
  Settlement Record:
    - source_pallet_id: PK001-NEW
    - settled_piece_qty: 5
    - virtual_balance_before: -5
    - virtual_balance_after: 0
```

### Settlement Trigger

```sql
-- File: supabase/migrations/209_create_virtual_pallet_system.sql

CREATE OR REPLACE FUNCTION trigger_settle_virtual_on_replenishment()
RETURNS TRIGGER AS $
DECLARE
  v_virtual_pallet_id VARCHAR(100);
  v_virtual_balance RECORD;
  v_qty_to_settle NUMERIC;
BEGIN
  -- Only process if:
  -- 1. Direction = 'in' (stock coming in)
  -- 2. Location is a preparation area
  -- 3. skip_balance_sync = FALSE
  IF NEW.direction = 'in' 
     AND is_preparation_area(NEW.location_id) 
     AND NOT COALESCE(NEW.skip_balance_sync, FALSE) THEN
    
    -- Generate Virtual Pallet ID
    v_virtual_pallet_id := generate_virtual_pallet_id(NEW.location_id, NEW.sku_id);
    
    -- Check if Virtual Pallet exists with negative balance
    SELECT * INTO v_virtual_balance
    FROM wms_inventory_balances
    WHERE pallet_id = v_virtual_pallet_id
    AND warehouse_id = NEW.warehouse_id
    AND total_piece_qty < 0;  -- ✅ Negative = needs settlement
    
    IF FOUND THEN
      -- Calculate settlement amount
      v_qty_to_settle := LEAST(
        ABS(v_virtual_balance.total_piece_qty),  -- Virtual deficit
        NEW.piece_qty                             -- Available qty
      );
      
      -- Deduct from real pallet
      UPDATE wms_inventory_balances
      SET total_piece_qty = total_piece_qty - v_qty_to_settle
      WHERE balance_id = (
        SELECT balance_id FROM wms_inventory_balances
        WHERE location_id = NEW.location_id
        AND sku_id = NEW.sku_id
        AND pallet_id = NEW.pallet_id
      );
      
      -- Add to Virtual Pallet
      UPDATE wms_inventory_balances
      SET total_piece_qty = total_piece_qty + v_qty_to_settle
      WHERE balance_id = v_virtual_balance.balance_id;
      
      -- Record settlement
      INSERT INTO virtual_pallet_settlements (...) VALUES (...);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trg_z_settle_virtual_on_replenishment
  AFTER INSERT ON wms_inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION trigger_settle_virtual_on_replenishment();
```

---

## 🔧 Recommended Fixes (Detailed)


### Fix #6: Add Transaction Isolation Level

```sql
-- Set transaction isolation level to SERIALIZABLE for critical operations
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Perform reservation operations
SELECT * FROM wms_inventory_balances WHERE ... FOR UPDATE;
UPDATE wms_inventory_balances SET reserved_piece_qty = ...;
INSERT INTO picklist_item_reservations (...) VALUES (...);

COMMIT;

-- If concurrent modification detected, PostgreSQL will automatically rollback
-- and return error: "could not serialize access due to concurrent update"
```

### Fix #7: Implement Retry Logic

```typescript
// Wrapper function with exponential backoff
async function reserveStockWithRetry(params: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabase.rpc('reserve_stock_for_picklist_items', params);
      return result;  // Success
    } catch (error: any) {
      if (error.message.includes('concurrent') && attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;  // Retry
      }
      throw error;  // Give up
    }
  }
}
```

### Fix #8: Add Stock Availability Check Before Reservation

```typescript
// Pre-flight check to fail fast
const { data: stockCheck } = await supabase.rpc('check_stock_availability', {
  p_warehouse_id: warehouseId,
  p_items: items.map(i => ({ sku_id: i.sku_id, qty_needed: i.quantity }))
});

if (!stockCheck.all_available) {
  return NextResponse.json({
    error: 'สต็อกไม่เพียงพอ',
    insufficient_items: stockCheck.insufficient_items
  }, { status: 400 });
}

// Proceed with reservation (still needs locking!)
```

---

## 📝 API Endpoints Summary

### Picklist APIs

| Endpoint | Method | Purpose | Stock Operation |
|----------|--------|---------|-----------------|
| `/api/picklists` | GET | List picklists | None |
| `/api/picklists` | POST | Create picklist (deprecated) | Reserve |
| `/api/picklists/create-from-trip` | POST | Create from trip | Reserve |
| `/api/picklists/create-from-trips-batch` | POST | Batch create | Reserve |
| `/api/picklists/[id]` | GET | Get details | None |
| `/api/picklists/[id]` | PATCH | Update status | Release (if cancelled) |
| `/api/picklists/[id]/items` | GET | Get items | None |

### Face Sheet APIs

| Endpoint | Method | Purpose | Stock Operation |
|----------|--------|---------|-----------------|
| `/api/face-sheets/generate` | POST | Create face sheet | Reserve |
| `/api/face-sheets/[id]` | GET | Get details | None |
| `/api/face-sheets/[id]` | PATCH | Update status | Release (if cancelled) |
| `/api/face-sheets/checklist` | POST | Generate checklist PDF | None |
| `/api/face-sheets/delivery-document` | POST | Generate delivery doc | None |

### Bonus Face Sheet APIs

| Endpoint | Method | Purpose | Stock Operation |
|----------|--------|---------|-----------------|
| `/api/bonus-face-sheets` | POST | Create bonus face sheet | Reserve |
| `/api/bonus-face-sheets/[id]` | GET | Get details | None |
| `/api/bonus-face-sheets/[id]` | PATCH | Update status | Release (if cancelled) |
| `/api/bonus-face-sheets/packages` | GET | Get packages | None |
| `/api/bonus-face-sheets/pick-list` | POST | Generate pick list PDF | None |
| `/api/bonus-face-sheets/checklist` | POST | Generate checklist PDF | None |

### Loadlist APIs

| Endpoint | Method | Purpose | Stock Operation |
|----------|--------|---------|-----------------|
| `/api/loadlists` | GET | List loadlists | None |
| `/api/loadlists` | POST | Create loadlist | None |
| `/api/loadlists/[id]` | GET | Get details | None |
| `/api/loadlists/[id]` | PATCH | Update status | None |
| `/api/loadlists/available-picklists` | GET | Get available picklists | None |
| `/api/loadlists/available-face-sheets` | GET | Get available face sheets | None |
| `/api/loadlists/available-bfs` | GET | Get available BFS | None |

### Mobile APIs

| Endpoint | Method | Purpose | Stock Operation |
|----------|--------|---------|-----------------|
| `/api/mobile/pick/tasks` | GET | List pick tasks | None |
| `/api/mobile/pick/tasks/[id]` | GET | Get pick task details | None |
| `/api/mobile/pick/scan` | POST | Confirm pick | Deduct + Transfer |
| `/api/mobile/loading/tasks` | GET | List loading tasks | None |
| `/api/mobile/loading/loadlist-detail` | GET | Get loadlist details | None |
| `/api/mobile/loading/complete` | POST | Confirm loading | Deduct + Transfer |
| `/api/mobile/loading/related-bonus-loadlists` | GET | Get related BFS | None |

---

## 🧪 Testing Recommendations

### Unit Tests

```typescript
// Test: Concurrent reservation should not oversell
describe('Stock Reservation Race Condition', () => {
  it('should not oversell when multiple requests reserve simultaneously', async () => {
    // Setup: Create balance with 100 pieces
    await createBalance({ sku_id: 'TEST-001', total_piece_qty: 100 });
    
    // Execute: 3 concurrent requests each trying to reserve 80 pieces
    const promises = [
      reserveStock({ sku_id: 'TEST-001', qty: 80 }),
      reserveStock({ sku_id: 'TEST-001', qty: 80 }),
      reserveStock({ sku_id: 'TEST-001', qty: 80 })
    ];
    
    const results = await Promise.allSettled(promises);
    
    // Assert: Only 1 should succeed, others should fail
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    expect(succeeded).toBe(1);
    
    // Assert: Total reserved should not exceed available
    const balance = await getBalance('TEST-001');
    expect(balance.reserved_piece_qty).toBeLessThanOrEqual(100);
  });
});
```

### Integration Tests

```typescript
// Test: Complete flow from picklist creation to loading
describe('Complete Picklist Flow', () => {
  it('should handle full lifecycle without stock errors', async () => {
    // 1. Create order
    const order = await createOrder({ items: [{ sku_id: 'TEST-001', qty: 50 }] });
    
    // 2. Create route plan
    const plan = await createRoutePlan({ order_ids: [order.id] });
    
    // 3. Create picklist
    const picklist = await createPicklist({ trip_id: plan.trips[0].id });
    expect(picklist.status).toBe('pending');
    
    // 4. Verify reservation
    const reservations = await getReservations(picklist.id);
    expect(reservations.length).toBeGreaterThan(0);
    expect(reservations[0].reserved_piece_qty).toBe(50);
    
    // 5. Mobile pick
    await mobilePick({ picklist_id: picklist.id, item_id: picklist.items[0].id });
    
    // 6. Verify stock moved to Dispatch
    const dispatchBalance = await getBalance('TEST-001', 'Dispatch');
    expect(dispatchBalance.total_piece_qty).toBe(50);
    
    // 7. Create loadlist
    const loadlist = await createLoadlist({ picklist_ids: [picklist.id] });
    
    // 8. Mobile loading
    await mobileLoading({ loadlist_code: loadlist.loadlist_code });
    
    // 9. Verify stock moved to Delivery
    const deliveryBalance = await getBalance('TEST-001', 'Delivery-In-Progress');
    expect(deliveryBalance.total_piece_qty).toBe(50);
  });
});
```

### Load Tests

```bash
# Use k6 or artillery for load testing
# Test: 100 concurrent picklist creations
k6 run --vus 100 --duration 30s load-test-picklist-creation.js

# Expected: No overselling, all requests either succeed or fail gracefully
```

---

## 📈 Monitoring & Alerts

### Key Metrics to Monitor

1. **Overselling Detection**
```sql
-- Alert if reserved > total
SELECT 
  balance_id,
  sku_id,
  location_id,
  total_piece_qty,
  reserved_piece_qty,
  (reserved_piece_qty - total_piece_qty) as oversold_qty
FROM wms_inventory_balances
WHERE reserved_piece_qty > total_piece_qty;
```

2. **Virtual Pallet Growth**
```sql
-- Alert if Virtual Pallet deficit growing
SELECT 
  pallet_id,
  sku_id,
  location_id,
  total_piece_qty,
  reserved_piece_qty
FROM wms_inventory_balances
WHERE pallet_id LIKE 'VIRTUAL-%'
AND total_piece_qty < -100;  -- Threshold
```

3. **Orphaned Reservations**
```sql
-- Alert if reservations without corresponding documents
SELECT 
  r.reservation_id,
  r.picklist_item_id,
  r.reserved_piece_qty,
  r.reserved_at
FROM picklist_item_reservations r
LEFT JOIN picklist_items pi ON pi.id = r.picklist_item_id
LEFT JOIN picklists p ON p.id = pi.picklist_id
WHERE p.id IS NULL
OR p.status = 'cancelled';
```

4. **Settlement Delays**
```sql
-- Alert if Virtual Pallet not settled within 1 hour
SELECT 
  balance_id,
  pallet_id,
  sku_id,
  total_piece_qty,
  created_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/3600 as hours_old
FROM wms_inventory_balances
WHERE pallet_id LIKE 'VIRTUAL-%'
AND total_piece_qty < 0
AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
```

---

## 🎓 Developer Guide

### How to Add New Document Type

1. **Create Tables**
```sql
CREATE TABLE new_document_type (
  id BIGSERIAL PRIMARY KEY,
  document_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  ...
);

CREATE TABLE new_document_type_items (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES new_document_type(id),
  sku_id VARCHAR(50) NOT NULL,
  quantity_to_pick NUMERIC(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  ...
);

CREATE TABLE new_document_type_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  document_item_id BIGINT REFERENCES new_document_type_items(id),
  balance_id BIGINT REFERENCES wms_inventory_balances(balance_id),
  reserved_piece_qty NUMERIC(18,2) NOT NULL,
  reserved_pack_qty NUMERIC(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'reserved',
  ...
);
```

2. **Create Reservation Function**
```sql
CREATE OR REPLACE FUNCTION reserve_stock_for_new_document_items(
  p_document_id BIGINT,
  p_warehouse_id VARCHAR DEFAULT 'WH001',
  p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(...) AS $
BEGIN
  -- Follow same pattern as reserve_stock_for_picklist_items
  -- 1. Loop through items
  -- 2. Query balances with FEFO/FIFO + FOR UPDATE
  -- 3. Update balances
  -- 4. Insert reservations
  -- 5. Handle Virtual Pallet if needed
END;
$ LANGUAGE plpgsql;
```

3. **Create API Endpoint**
```typescript
// app/api/new-document-type/route.ts
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  
  // 1. Validate input
  // 2. Create document + items in single RPC
  // 3. Call reservation function
  // 4. Handle errors (rollback if needed)
  
  return NextResponse.json({ success: true, document_id: ... });
}
```

4. **Add Mobile Support**
```typescript
// app/mobile/new-document-type/[id]/page.tsx
// Follow pattern from mobile/pick/[id]/page.tsx
```

---

## 📚 References

### Key Files

**Frontend:**
- `app/receiving/picklists/page.tsx` - Picklist list page
- `app/receiving/picklists/face-sheets/page.tsx` - Face Sheet creation
- `app/receiving/picklists/bonus-face-sheets/page.tsx` - Bonus Face Sheet creation
- `app/receiving/loadlists/page.tsx` - Loadlist management
- `app/mobile/pick/[id]/page.tsx` - Mobile pick interface
- `app/mobile/loading/[code]/page.tsx` - Mobile loading interface

**Backend APIs:**
- `app/api/picklists/create-from-trip/route.ts` - Picklist creation with reservation
- `app/api/face-sheets/generate/route.ts` - Face Sheet creation with reservation
- `app/api/bonus-face-sheets/route.ts` - Bonus Face Sheet creation with reservation
- `app/api/loadlists/route.ts` - Loadlist creation (no stock ops)
- `app/api/mobile/pick/scan/route.ts` - Mobile pick stock deduction
- `app/api/mobile/loading/complete/route.ts` - Mobile loading stock transfer

**Database:**
- `supabase/migrations/143_fix_face_sheet_stock_reservation_include_bulk.sql` - Face Sheet reservation function
- `supabase/migrations/188_fix_bonus_fs_reservation_prep_areas_only.sql` - Bonus Face Sheet reservation function
- `supabase/migrations/209_create_virtual_pallet_system.sql` - Virtual Pallet system
- `supabase/migrations/216_fix_face_sheet_missing_reservations.sql` - Fix missing reservations

### Related Documentation
- `docs/VRP/` - Vehicle Routing Problem documentation
- `.kiro/steering/product.md` - Product overview
- `.kiro/steering/structure.md` - Project structure
- `.kiro/steering/tech.md` - Technology stack

---

## ✅ Action Items

### Immediate (P0 - Critical)
- [ ] Implement row-level locking (`FOR UPDATE`) in all reservation functions
- [ ] Wrap multi-step operations in single database transactions
- [ ] Remove artificial delays (500ms) in bonus face sheet creation
- [ ] Add retry logic with exponential backoff for concurrent modifications

### Short-term (P1 - High)
- [ ] Implement optimistic locking with version column
- [ ] Add pre-flight stock availability checks
- [ ] Set transaction isolation level to SERIALIZABLE
- [ ] Add comprehensive error handling and rollback logic

### Medium-term (P2 - Medium)
- [ ] Add monitoring alerts for overselling detection
- [ ] Implement load testing for concurrent scenarios
- [ ] Add audit logging for all stock operations
- [ ] Create dashboard for Virtual Pallet monitoring

### Long-term (P3 - Low)
- [ ] Consider implementing distributed locking (Redis)
- [ ] Evaluate event sourcing for stock movements
- [ ] Add automated reconciliation jobs
- [ ] Implement stock reservation timeout/expiry

---

## 📞 Support

For questions or issues related to this analysis:
- **Developer:** Contact development team
- **Database:** Contact DBA team
- **Production Issues:** Create incident ticket

---

**Document Version:** 1.0  
**Last Updated:** January 17, 2026  
**Next Review:** February 17, 2026
