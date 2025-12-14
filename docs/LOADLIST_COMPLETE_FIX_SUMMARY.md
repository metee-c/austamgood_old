# Loadlist Display Issues - Complete Fix Summary

## Issues Fixed

### 1. Loading Door Column Not Displaying (ประตูโหลด)
**Problem**: Loading door column was not showing in the create loadlist modal.

**Root Cause**: Loading door is already saved in the `picklists` table when creating picklists at http://localhost:3000/receiving/picklists

**Solution**:
- Added dropdown to select/update loading door (D-01 to D-10)
- Default value is pre-filled from picklist's `loading_door_number`
- User can override the value if needed
- Selected value is saved to `loadlists.loading_door_number`

### 2. Vehicle Plate Number Not Displaying (ทะเบียนรถ)
**Problem**: Vehicle data was not showing due to data type mismatch.

**Root Cause**: `loadlists.vehicle_id` is VARCHAR but `master_vehicle.vehicle_id` is BIGINT.

**Solution**: Convert vehicle_id to integer before lookup in API:
```typescript
const vehicleIds = loadlists
  ?.map((l: any) => l.vehicle_id)
  .filter((id: any) => id != null)
  .map((id: any) => parseInt(id, 10))
  .filter((id: any) => !isNaN(id)) || [];
```

### 3. Driver Name Not Displaying (คนขับ)
**Problem**: Driver data was not showing (same root cause as vehicle).

**Solution**: Fixed by the vehicle lookup fix, as driver data is fetched correctly once vehicle_id conversion works.

## Files Modified
1. `app/receiving/loadlists/page.tsx`
   - Added `loadingDoorNumber` state variable
   - Added dropdown for loading door with default value from picklist
   - Included `loading_door_number` in POST request body

2. `app/api/loadlists/route.ts`
   - Fixed vehicle_id type conversion in GET endpoint (convert VARCHAR to BIGINT)
   - Added `loading_door_number` parameter extraction and INSERT field

## Testing
- Picklist PL-20251213-001 (ID: 106) is available for testing
- Can now create loadlist with loading door, vehicle, and driver selection
- All fields display correctly in the loadlists table

## Status
✅ All issues resolved and tested
