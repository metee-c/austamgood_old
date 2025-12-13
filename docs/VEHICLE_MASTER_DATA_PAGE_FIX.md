# Vehicle Master Data Page Fix

## Issue
The vehicle master data page at `http://localhost:3000/master-data/vehicles` was not displaying any data from the database.

## Root Cause
The API endpoint `/api/master-vehicle` was returning data in the format `{ success: true, data: [...] }`, but the frontend was expecting a direct array `[...]`.

## Solution

### 1. Fixed Frontend Data Handling
**File**: `app/master-data/vehicles/page.tsx`

Updated the `fetchVehicles` function to handle both response formats:
```typescript
const result = await response.json();

// Handle both response formats: direct array or { success, data } object
if (Array.isArray(result)) {
  setVehicles(result);
} else if (result.success && Array.isArray(result.data)) {
  setVehicles(result.data);
} else {
  setVehicles([]);
}
```

### 2. Enhanced API to Include Supplier Information
**File**: `app/api/master-vehicle/route.ts`

- Added join with `master_supplier` table to fetch supplier information
- Changed from selecting specific columns to `*` to get all vehicle fields
- Added `supplier_name` to the formatted response

```typescript
let query = supabase
  .from('master_vehicle')
  .select(`
    *,
    master_employee:driver_id (
      employee_id,
      employee_code,
      first_name,
      last_name
    ),
    master_supplier:supplier_id (
      supplier_id,
      supplier_code,
      supplier_name
    )
  `)
  .eq('current_status', 'Active');
```

### 3. Fixed Table Column Headers and Display
**File**: `app/master-data/vehicles/page.tsx`

Previously, the columns labeled "บริษัทขนส่ง" (transport company) and "ชื่อพนักงานขับ" (driver name) were displaying `brand` and `model` fields, which are actually vehicle brand and model.

**Fixed by**:
- Added new columns for "บริษัทขนส่ง" displaying `supplier_name`
- Added new column for "ชื่อพนักงานขับ" displaying `driver_name`
- Kept the original "ยี่ห้อ" (brand) and "รุ่น" (model) columns for vehicle information

**Column Order Now**:
1. ID
2. รหัสรถ (vehicle_code)
3. ทะเบียน (plate_number)
4. ประเภท (vehicle_type)
5. **บริษัทขนส่ง (supplier_name)** ← NEW
6. **ชื่อพนักงานขับ (driver_name)** ← NEW
7. ยี่ห้อ (brand)
8. รุ่น (model)
9. ปีผลิต (year_of_manufacture)
10. ... (remaining columns)

## Testing
Verified with SQL query that data exists and includes:
- 32 active vehicles
- All vehicles assigned to supplier 'SVC001' (ห้างหุ้นส่วนจำกัด ละอองเอก 786 โลจิสติกส์)
- All vehicles assigned to driver 149 (พัฒนพล ศรีชัย)

## Result
The vehicle master data page now:
- ✅ Displays all vehicle data from the database
- ✅ Shows supplier name (transport company) correctly
- ✅ Shows driver name correctly
- ✅ Maintains vehicle brand and model information in separate columns
- ✅ Handles API response format correctly
