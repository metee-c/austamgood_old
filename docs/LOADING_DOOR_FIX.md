# Loading Door Column Fix

## Issue
The "ประตูโหลด" (loading_door_number) column was not displaying in the loadlists table even though users selected it when creating a loadlist.

## Root Cause
1. The create loadlist form did not have an input field for `loading_door_number`
2. The state variable for loading door was missing
3. The field was not included in the POST request body
4. The API was not saving the `loading_door_number` value

## Solution

### 1. Frontend Changes (`app/receiving/loadlists/page.tsx`)

**Added state variable:**
```typescript
const [loadingDoorNumber, setLoadingDoorNumber] = useState<string>('');
```

**Added dropdown input in the picklists table (line ~1026):**
```tsx
<td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
  {index === 0 ? (
    <select
      value={loadingDoorNumber}
      onChange={(e) => setLoadingDoorNumber(e.target.value)}
      className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
    >
      <option value="">-- เลือก --</option>
      <option value="D-01">D-01</option>
      <option value="D-02">D-02</option>
      <option value="D-03">D-03</option>
      <option value="D-04">D-04</option>
      <option value="D-05">D-05</option>
      <option value="D-06">D-06</option>
      <option value="D-07">D-07</option>
      <option value="D-08">D-08</option>
      <option value="D-09">D-09</option>
      <option value="D-10">D-10</option>
    </select>
  ) : (
    <span className="text-gray-400 text-xs">{loadingDoorNumber || '-'}</span>
  )}
</td>
```

**Updated request body to include loading_door_number:**
```typescript
const requestBody: any = {
  checker_employee_id: checkerEmployeeId,
  vehicle_type: vehicleType || 'N/A',
  delivery_number: deliveryNumber || `FS-${Date.now()}`,
  vehicle_id: vehicleId || null,
  driver_employee_id: driverEmployeeId || null,
  loading_queue_number: loadingQueueNumber || null,
  loading_door_number: loadingDoorNumber || null  // ✅ Added
};
```

### 2. Backend Changes (`app/api/loadlists/route.ts`)

**Added to request body destructuring:**
```typescript
const {
  picklist_ids,
  face_sheet_ids,
  bonus_face_sheet_ids,
  checker_employee_id,
  vehicle_type,
  delivery_number,
  vehicle_id,
  driver_employee_id,
  driver_phone,
  helper_employee_id,
  loading_queue_number,
  loading_door_number  // ✅ Added
} = body;
```

**Added to database insert:**
```typescript
const { data: loadlist, error: loadlistError } = await supabase
  .from('loadlists')
  .insert({
    loadlist_code: loadlistCode,
    plan_id,
    trip_id,
    status: 'pending',
    checker_employee_id,
    vehicle_type,
    delivery_number,
    vehicle_id: vehicle_id || null,
    driver_employee_id: driver_employee_id || null,
    driver_phone: driver_phone || null,
    helper_employee_id: helper_employee_id || null,
    loading_queue_number: loading_queue_number || null,
    loading_door_number: loading_door_number || null,  // ✅ Added
    created_by: null
  })
  .select()
  .single();
```

## Testing

### Test Data Update
Updated existing loadlist 43 to verify display:
```sql
UPDATE loadlists 
SET loading_door_number = 'D-01' 
WHERE id = 43;
```

Result: `loading_door_number` now shows "D-01" for loadlist LD-20251213-0001

## How to Use

1. Navigate to http://localhost:3000/receiving/loadlists
2. Click "สร้างใบโหลดใหม่" (Create New Loadlist)
3. Select picklists from the "ใบจัดสินค้า" tab
4. In the first row, you'll now see a dropdown for "ประตูโหลด" (Loading Door)
5. Select a door number (D-01 through D-10)
6. Fill in other required fields (checker, vehicle type, delivery number)
7. Click create
8. The loading door number will be saved and displayed in the loadlists table

## Files Modified
- `app/receiving/loadlists/page.tsx` - Added state, input field, and request body field
- `app/api/loadlists/route.ts` - Added parameter extraction and database insert field

## Additional Fix: Vehicle and Driver Display

### Issue
Vehicle plate number (ทะเบียนรถ) and driver name (คนขับ) columns were not displaying data in the loadlists table.

### Root Cause
Data type mismatch between `loadlists.vehicle_id` (character varying) and `master_vehicle.vehicle_id` (bigint). The API was trying to match string IDs with integer IDs, causing the lookup to fail.

### Solution
Updated the GET endpoint in `app/api/loadlists/route.ts` to convert vehicle_id strings to integers before querying:

```typescript
// Convert vehicle_id strings to integers for lookup
const vehicleIds = loadlists
  ?.map((l: any) => l.vehicle_id)
  .filter((id: any) => id != null)
  .map((id: any) => parseInt(id, 10))
  .filter((id: any) => !isNaN(id)) || [];

let vehicleMap: Record<number, any> = {};
if (vehicleIds.length > 0) {
  const { data: vehicles } = await supabase
    .from('master_vehicle')
    .select('vehicle_id, plate_number, vehicle_type')
    .in('vehicle_id', vehicleIds);

  vehicles?.forEach((vehicle: any) => {
    if (vehicle.vehicle_id) {
      vehicleMap[vehicle.vehicle_id] = vehicle;
    }
  });
}

// In transformation, parse vehicle_id before lookup
const vehicleIdNum = loadlist.vehicle_id ? parseInt(loadlist.vehicle_id, 10) : null;
const vehicle = vehicleIdNum && !isNaN(vehicleIdNum) ? vehicleMap[vehicleIdNum] : null;
```

### Test Data
Updated loadlist 43 with test data:
- vehicle_id: '29' (plate: 3ฒฎ3027)
- driver_employee_id: 151 (name: โจโจ้ โนนพิมาย)

## Status
✅ **COMPLETED** - Loading door, vehicle, and driver can now be selected when creating a loadlist and all display correctly in the table.
