# Vehicle Selection for Route Plan - Implementation Summary

## Overview
Implemented vehicle selection dropdown in the Edit Shipping Cost modal that filters vehicles by the selected transport company (supplier).

## Changes Made

### 1. Database Migration (137_add_supplier_id_to_master_vehicle.sql)
- Added `supplier_id` column to `master_vehicle` table
- Added foreign key constraint to `master_supplier` table
- Added index for performance
- Column is nullable to support existing data

**Status:** ✅ Migration executed successfully

### 2. API Enhancement (app/api/master-vehicle/route.ts)
**Changes:**
- Added `supplier_id` query parameter support
- Added join with `master_employee` table to fetch driver information
- Returns formatted vehicle data with driver names
- Filters vehicles by supplier when `supplier_id` is provided

**API Usage:**
```typescript
// Get all active vehicles
GET /api/master-vehicle

// Get vehicles for specific supplier
GET /api/master-vehicle?supplier_id=SVC001
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "vehicle_id": 1,
      "vehicle_code": "VH001",
      "plate_number": "กข 1234 กรุงเทพ",
      "driver_id": 5,
      "driver_name": "สมชาย ใจดี",
      "supplier_id": "SVC001",
      "capacity_kg": 2200,
      ...
    }
  ]
}
```

### 3. Component Update (components/receiving/EditShippingCostModal.tsx)
**Changes:**
- Added `Vehicle` interface for type safety
- Added state for vehicles list and loading status
- Added `vehicle_id` to form data
- Added `useEffect` to fetch vehicles when supplier changes
- Replaced text inputs with dropdown selects for vehicle selection
- Auto-populates driver name when vehicle is selected
- Driver name field is now read-only (auto-filled from vehicle selection)
- Shows appropriate messages when:
  - No supplier selected: "กรุณาเลือกผู้ให้บริการขนส่งก่อน"
  - Loading vehicles: "กำลังโหลดรถ..."
  - No vehicles available: "ไม่มีรถสำหรับผู้ให้บริการนี้"

**Updated in both pricing modes:**
- Flat pricing mode (lines ~660-680)
- Formula pricing mode (lines ~970-990)

## User Flow

1. User opens Edit Shipping Cost modal from route plan page
2. User selects "ผู้ให้บริการขนส่ง" (Transport Company/Supplier)
3. System automatically fetches vehicles for that supplier
4. User selects vehicle from "ทะเบียนรถ" dropdown
5. System automatically fills "ชื่อผู้ขับ" (Driver Name) field
6. User completes other shipping cost details and saves

## Data Requirements

### To use this feature, you need to:
1. **Assign vehicles to suppliers** - Update existing vehicles in `master_vehicle` table:
   ```sql
   UPDATE master_vehicle 
   SET supplier_id = 'SVC001' 
   WHERE vehicle_id IN (1, 2, 3);
   ```

2. **Link drivers to vehicles** - Ensure vehicles have `driver_id` set:
   ```sql
   UPDATE master_vehicle 
   SET driver_id = 5 
   WHERE vehicle_id = 1;
   ```

3. **Ensure driver data exists** - Drivers should be in `master_employee` table with proper names

## Testing Checklist

- [ ] Migration 137 executed successfully
- [ ] API returns vehicles without supplier filter
- [ ] API returns filtered vehicles with supplier_id parameter
- [ ] API returns driver names correctly
- [ ] Dropdown shows "กรุณาเลือกผู้ให้บริการขนส่งก่อน" when no supplier selected
- [ ] Dropdown loads vehicles when supplier is selected
- [ ] Driver name auto-fills when vehicle is selected
- [ ] Works in both flat and formula pricing modes
- [ ] Saves vehicle_id and labels correctly to trip notes
- [ ] Build passes without TypeScript errors

## Files Modified

1. `supabase/migrations/137_add_supplier_id_to_master_vehicle.sql` - New migration
2. `app/api/master-vehicle/route.ts` - Enhanced API endpoint
3. `components/receiving/EditShippingCostModal.tsx` - Updated UI component

## Next Steps

1. **Populate supplier_id for existing vehicles** - Run SQL updates to assign vehicles to suppliers
2. **Test with real data** - Verify the dropdown works with actual supplier and vehicle data
3. **User acceptance testing** - Have users test the new vehicle selection workflow
4. **Consider adding vehicle management UI** - Create a page to manage vehicle-supplier relationships

## Notes

- The `vehicle_label` and `driver_label` fields are still stored in trip notes for backward compatibility
- The `vehicle_id` is now also stored for future reference and data integrity
- The driver name field is read-only to prevent manual edits that would conflict with vehicle selection
- If no vehicles are available for a supplier, users will see a warning message
