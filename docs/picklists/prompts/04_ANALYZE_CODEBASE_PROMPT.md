# 🔍 Prompt #4: Analyze Actual Codebase for Bug Confirmation

## 📋 Task Overview
วิเคราะห์ code จริงในโปรเจคเพื่อยืนยัน bugs ที่ระบุไว้ใน Analysis Report

---

## 🎯 Instructions for AI

### Step 1: Map Project Structure

```bash
# First, understand the project structure
ls -la
ls -la app/
ls -la app/api/
ls -la supabase/
ls -la supabase/migrations/
```

### Step 2: Locate and Analyze Key Files

#### 2.1 API Routes for Stock Reservation

```bash
# Find all API routes related to picklists, face sheets, bonus face sheets
find app/api -name "*.ts" | xargs grep -l "reserve\|stock\|inventory"
```

**Files to analyze:**
```
app/api/picklists/create-from-trip/route.ts
app/api/face-sheets/generate/route.ts
app/api/bonus-face-sheets/route.ts
app/api/loadlists/route.ts
app/api/mobile/pick/scan/route.ts
app/api/mobile/loading/complete/route.ts
```

#### 2.2 Database Functions

```bash
# Find migration files with reservation functions
grep -rn "reserve_stock" supabase/migrations/ --include="*.sql"
grep -rn "FOR UPDATE" supabase/migrations/ --include="*.sql"
```

### Step 3: Bug Verification Checklist

For each bug identified, find the actual code and confirm:

#### Bug #1: Race Condition (Missing FOR UPDATE)

```
Location: supabase/migrations/xxx_face_sheet_reservation.sql

Search for:
- SELECT statements that read wms_inventory_balances
- Check if FOR UPDATE is present

Expected Bug Pattern:
  SELECT * FROM wms_inventory_balances
  WHERE warehouse_id = p_warehouse_id
  AND sku_id = v_sku_id
  ORDER BY expiry_date ASC;  -- NO FOR UPDATE!

Confirmation: [YES/NO]
File: ___________________
Line: ___________________
```

#### Bug #2: Non-Atomic Transaction

```
Location: app/api/face-sheets/generate/route.ts

Search for:
- Multiple supabase.rpc() calls
- Separate create and reserve operations

Expected Bug Pattern:
  const { data: createResult } = await supabase.rpc('create_face_sheet', ...);
  // Gap here!
  const { data: reserveResult } = await supabase.rpc('reserve_stock', ...);

Confirmation: [YES/NO]
File: ___________________
Line: ___________________
```

#### Bug #3: Artificial Delay

```
Location: app/api/bonus-face-sheets/route.ts

Search for:
- setTimeout
- await new Promise(resolve => setTimeout
- delay
- sleep

Expected Bug Pattern:
  await new Promise(resolve => setTimeout(resolve, 500));
  await supabase.rpc('reserve_stock_for_bonus_face_sheet_items', ...);

Confirmation: [YES/NO]
File: ___________________
Line: ___________________
```

---

## 📝 Output Template

```markdown
# Codebase Analysis Report: Stock Management Bugs

**Date:** [CURRENT_DATE]
**Analyzed By:** [AI NAME]
**Project:** AustamGood WMS

---

## 1. Project Structure Overview

### Directory Structure
```
[tree output]
```

### Key Files
| File | Purpose | Bug Status |
|------|---------|------------|
| | | |

---

## 2. Bug Confirmation

### BUG-001: Race Condition in Stock Reservation

**Status:** ✅ CONFIRMED / ❌ NOT FOUND

**Location:**
- File: `supabase/migrations/xxx.sql`
- Function: `reserve_stock_for_face_sheet_items`
- Line: 45-78

**Evidence:**
```sql
-- Actual code from file
SELECT 
  balance_id,
  total_piece_qty,
  reserved_piece_qty
FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
ORDER BY expiry_date ASC;
-- ❌ NO FOR UPDATE CLAUSE
```

**Impact:** High - Can cause overselling

**Fix:**
```sql
SELECT ...
FROM wms_inventory_balances
...
FOR UPDATE OF wms_inventory_balances;
```

---

**Analysis Complete**
```
