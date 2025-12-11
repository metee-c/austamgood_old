# Vehicle Selection in Loadlist Form - Implementation Summary

## Overview
Implemented vehicle selection functionality in the loadlist creation form to populate vehicle data from the `master_vehicle` table, with auto-population of vehicle type and driver information.

## Changes Made

### 1. Created Master Vehicle API Endpoint
**File**: `app/api/master-vehicle/route.ts`

- Created new GET endpoint to fetch active vehicles from `master_vehicle` table
- Returns vehicle data including:
  - `vehicle_id`, `vehicle_code`, `plate_number`
  - `vehicle_type` (e.g., "4 ล้อ", "6 ล้อ")
  - `brand` (บริษัทขนส่ง - transport company name)
  - `model` (ชื่อพนักงานขับรถ - driver name)
  - `driver_id` (employee ID of assigned driver)
  - `current_status`, capacity, fuel type, etc.
- Filters by `current_status = 'Active'`
- Orders by `vehicle_code` ascending

### 2. Updated Loadlist Form - Vehicle Selection
**File**: `app/receiving/loadlists/page.tsx`

#### Auto-Population Logic
When a vehicle is selected from the "ทะเบียนรถ" (plate number) dropdown:
1. **Vehicle Type** (`vehicleType`) is automatically populated from `vehicle.vehicle_type`
2. **Driver** (`driverEmployeeId`) is automatically populated from `vehicle.driver_id`

#### Enhanced Vehicle Dropdown Display
Vehicle dropdown now shows:
- Plate number (e.g., "1ฒณ5153")
- Transport company in parentheses (e.g., "(บริษัท แอกริเกต จำกัด)")
- Driver name after dash (e.g., "- พลกฤต")

Example display: `1ฒณ5153 (บริษัท แอกริเกต จำกัด) - พลกฤต`

#### Vehicle Type Options Standardized
Updated vehicle type dropdown options to match database format:
- "4 ล้อ" (not "รถ 4 ล้อ")
- "6 ล้อ" (not "รถ 6 ล้อ")
- "10 ล้อ" (not "รถ 10 ล้อ")
- "กระบะ" (not "รถกระบะ")
- "ตู้" (not "รถตู้")
- "เทรลเลอร์" (not "รถเทรลเลอร์")

This ensures consistency between the form and database values.

## Database Schema Reference

### master_vehicle Table
Key fields used:
- `vehicle_id` (bigint, PK) - Unique vehicle identifier
- `vehicle_code` (varchar) - Vehicle code (e.g., "V-LAONG-001")
- `plate_number` (varchar) - License plate number
- `vehicle_type` (varchar) - Type of vehicle (e.g., "4 ล้อ")
- `brand` (varchar) - **Transport company name** (not actual vehicle brand)
- `model` (varchar) - **Driver name** (not actual vehicle model)
- `driver_id` (bigint, FK) - References `master_employee.employee_id`
- `current_status` (varchar) - "Active", "Under Maintenance", "Inactive"

**Important Note**: 
- `brand` field = "ชื่อบริษัทขนส่ง" (transport company name)
- `model` field = "ชื่อพนักงานขับรถ" (driver name)

## User Workflow

### Creating a Loadlist with Vehicle Selection

1. User opens "สร้างใบโหลดสินค้า" modal
2. User selects picklists/face sheets to include
3. In the form row (first row only):
   - **ผู้เช็ค** (Checker): Select employee manually
   - **ประเภทรถ** (Vehicle Type): Can select manually OR auto-populated when vehicle selected
   - **ทะเบียนรถ** (Plate Number): Select from dropdown showing plate + company + driver
   - **คนขับ** (Driver): Can select manually OR auto-populated when vehicle selected
   - **คิว** (Queue): Select loading queue number
   - **เลขงานจัดส่ง** (Delivery Number): Enter manually

4. When user selects a vehicle from "ทะเบียนรถ" dropdown:
   - System automatically fills "ประเภทรถ" if vehicle has `vehicle_type`
   - System automatically fills "คนขับ" if vehicle has `driver_id`
   - User can still manually change these values if needed

## Testing

### Verify API Endpoint
```bash
curl http://localhost:3000/api/master-vehicle
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "vehicle_id": 24,
      "vehicle_code": "V-AGGRE-001",
      "plate_number": "1ฒณ5153",
      "vehicle_type": "4 ล้อ",
      "brand": "บริษัท แอกริเกต จำกัด",
      "model": "พลกฤต",
      "driver_id": null,
      "current_status": "Active"
    }
  ]
}
```

### Test Auto-Population
1. Navigate to http://localhost:3000/receiving/loadlists
2. Click "สร้างใบโหลดใหม่"
3. Select a picklist
4. In the first row, select a vehicle from "ทะเบียนรถ" dropdown
5. Verify that "ประเภทรถ" is automatically populated
6. Verify that "คนขับ" is automatically populated (if vehicle has driver_id)

## Benefits

1. **Reduced Manual Entry**: Vehicle type and driver are auto-populated
2. **Data Consistency**: Vehicle data comes from master data table
3. **Better UX**: Dropdown shows context (company name, driver name) for easier selection
4. **Fewer Errors**: Less manual typing reduces data entry mistakes
5. **Centralized Management**: Vehicle data managed in one place (master_vehicle table)

## Related Files
- `app/api/master-vehicle/route.ts` - Vehicle API endpoint
- `app/receiving/loadlists/page.tsx` - Loadlist form with vehicle selection
- `app/master-data/vehicles/page.tsx` - Vehicle master data management
- `components/forms/AddVehicleForm.tsx` - Add vehicle form
- `components/forms/EditVehicleForm.tsx` - Edit vehicle form
- `types/vehicle-schema.ts` - Vehicle type definitions

## Future Enhancements

1. **Driver Assignment**: Allow updating `driver_id` in master_vehicle when driver is selected in loadlist
2. **Vehicle Availability**: Track which vehicles are currently in use
3. **Vehicle History**: Show vehicle usage history and statistics
4. **GPS Integration**: If `gps_device_id` is populated, show real-time vehicle location
5. **Maintenance Alerts**: Show warnings if vehicle maintenance is due
