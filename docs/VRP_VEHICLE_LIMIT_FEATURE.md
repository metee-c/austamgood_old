# Vehicle Limit Feature - VRP System

## Overview
Added vehicle limit feature to the VRP optimization system, allowing users to constrain the number of vehicles used in route planning. This feature supports two modes:
1. **Unlimited vehicles** (default) - System calculates optimal number based on capacity
2. **Fixed maximum vehicles** - Forces all orders into specified number of trips, allowing weight to exceed capacity

## Changes Made

### 1. UI Components

#### OptimizationSidebar.tsx
- Added `maxVehicles` field to `OptimizationSettings` interface (0 = unlimited)
- Added `enforceVehicleLimit` boolean field to allow overweight trips
- Added new UI section "จำนวนรถสูงสุด" with:
  - Number input for max vehicles (0 = unlimited)
  - Checkbox to enforce vehicle limit (allow overweight)
  - Warning message when enforcement is enabled

### 2. Algorithm Implementation

#### lib/vrp/algorithms.ts
- Added `isOverweight` field to `Trip` interface
- Created new function `enforceVehicleLimit()`:
  - Consolidates trips when count exceeds max vehicles
  - Merges trips with smallest combined weight first
  - Marks trips as overweight when exceeding capacity
  - Logs consolidation process for debugging

### 3. API Integration

#### app/api/route-plans/optimize/route.ts
- Imported `enforceVehicleLimit` function
- Added step 8 in optimization pipeline: "Enforce vehicle limit if specified"
- Calls `enforceVehicleLimit()` after stop reordering and before cost calculation
- Saves `is_overweight` flag to database

### 4. Database Schema

#### New Migration: 20241111_add_is_overweight_to_trips.sql
- Added `is_overweight` boolean column to `receiving_route_trips` table
- Default value: false
- Comment: "แฟล็กบ่งชี้ว่าเที่ยวนี้มีน้ำหนักเกินความจุรถ (เกิดจากการบังคับจำนวนรถสูงสุด)"

#### Updated full_schema.sql
- Added `is_overweight` column definition

### 5. UI Display

#### app/receiving/routes/page.tsx
- Updated `EditorTrip` interface to include:
  - `is_overweight?: boolean`
  - `vehicle_name?: string | null`
  - `driver_name?: string | null`
- **Preview Modal**: Added overweight warning display
  - Red background on trip header when overweight
  - Warning badge "⚠️ น้ำหนักเกิน" next to trip number
- **Editor Modal**: Added overweight warning display
  - Red border and background on overweight trips
  - Warning badge in trip header

### 6. Default Settings

#### app/receiving/routes/page.tsx
- Added default values in `vrpSettings` state:
  - `maxVehicles: 0` (unlimited)
  - `enforceVehicleLimit: false`

## Usage

### Setting Vehicle Limit
1. Go to route planning page: `/receiving/routes`
2. Click "สร้างแผนใหม่" (Create New Plan)
3. Open "⚙️ การตั้งค่าการคำนวณเส้นทาง (VRP)"
4. In "จำนวนรถสูงสุด" section:
   - Enter number of vehicles (e.g., 10)
   - Check "บังคับใช้จำนวนรถที่กำหนด" to enforce limit
5. Run optimization

### Behavior
- **Unlimited (maxVehicles = 0)**: System creates optimal number of trips based on capacity
- **Fixed limit (maxVehicles > 0, enforceVehicleLimit = true)**:
  - System consolidates trips to fit within vehicle limit
  - Trips may exceed weight capacity
  - Overweight trips are marked with red warning
  - Uses fewer vehicles than max if possible

### Visual Indicators
- **Normal trip**: Gray background, no warning
- **Overweight trip**: 
  - Red/pink background on header
  - Red border (in editor)
  - Warning badge "⚠️ น้ำหนักเกิน"

## Technical Details

### Consolidation Algorithm
1. Sort trips by total weight (ascending)
2. While trip count > max vehicles:
   - Find two trips with smallest combined weight
   - Merge them into one trip
   - Mark as overweight if exceeds capacity
   - Remove merged trip from list
3. Return consolidated trips

### Optimization Pipeline Order
1. Cluster deliveries into zones
2. Apply routing algorithm (insertion/savings/nearest)
3. Apply local search optimization (2-opt)
4. Consolidate routes (if enabled)
5. Reorder stops by method (optimized/nearest-to-farthest/circular-return)
6. **Enforce vehicle limit (if specified)** ← NEW
7. Calculate costs and metrics
8. Save trips to database

## Database Schema

```sql
ALTER TABLE "public"."receiving_route_trips"
ADD COLUMN IF NOT EXISTS "is_overweight" boolean DEFAULT false;
```

## Files Modified
- `components/vrp/OptimizationSidebar.tsx`
- `lib/vrp/algorithms.ts`
- `app/api/route-plans/optimize/route.ts`
- `app/receiving/routes/page.tsx`
- `supabase/migrations/full_schema.sql`

## Files Created
- `supabase/migrations/20241111_add_is_overweight_to_trips.sql`
- `docs/VRP_VEHICLE_LIMIT_FEATURE.md`

## Testing
Build completed successfully with no TypeScript errors or warnings.

## Future Enhancements
- Add vehicle capacity override per trip
- Show weight percentage (e.g., "120% capacity")
- Add warning threshold (e.g., warn at 90% capacity)
- Export overweight trips report
