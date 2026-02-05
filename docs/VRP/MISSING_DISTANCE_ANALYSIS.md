# Missing Distance Data Analysis

## Problem
Several route plans and trips are missing `total_distance_km` data on the routes page (`/receiving/routes`).

## Investigation Results

### Affected Plans
20 route plans were analyzed, with 31 trips missing distance data:

| Plan Code | Trip Number | Status | Stops | Distance |
|-----------|-------------|--------|-------|----------|
| RP-20260107-001 | 7 | approved | 1 | ❌ Missing |
| RP-20260107-002 | 10 | approved | 1 | ❌ Missing |
| RP-20260108-001 | 4, 10-14 | approved | 0-1 | ❌ Missing |
| RP-20260108-002 | 15 | approved | 1 | ❌ Missing |
| RP-20260109-003 | 4 | approved | 1 | ❌ Missing |
| RP-20260113-004 | 8 | approved | 1 | ❌ Missing |
| RP-20260114-001 | 5, 6 | approved | 4, 9 | ❌ Missing |
| RP-20260116-002 | 3 | approved | 1 | ❌ Missing |
| RP-20260116-008 | 11 | approved | 1 | ❌ Missing |
| RP-20260119-001 | 2 | approved | 1 | ❌ Missing |
| RP-20260123-005 | 9 | approved | 1 | ❌ Missing |
| RP-20260123-007 | 13 | approved | 1 | ❌ Missing |
| RP-20260124-003 | 4 | approved | 1 | ❌ Missing |
| RP-20260126-002 | 3 | approved | 1 | ❌ Missing |
| RP-20260126-005 | 7, 8 | approved | 1 | ❌ Missing |
| RP-20260127-004 | 9 | approved | 1 | ❌ Missing |
| RP-20260128-003 | 5 | approved | 4 | ❌ Missing |
| RP-20260129-001 | 5, 6 | approved | 3, 1 | ❌ Missing |
| RP-20260129-005 | 11 | approved | 1 | ❌ Missing |
| RP-20260130-005 | 6 | approved | 1 | ❌ Missing |

### Pattern Analysis

1. **Most affected trips have 1 stop** - This suggests they might be single-delivery trips added manually
2. **All plans are "approved"** - The plans were finalized but some trips lack distance calculation
3. **Plan-level distances exist** - The parent plans have `total_distance_km`, but individual trips don't
4. **Trip 13 in RP-20260108-001 has 0 stops** - This is an empty trip that should probably be cleaned up

### Root Causes

Based on the analysis, the missing distance data is likely due to:

1. **Manual Trip Creation** - Trips added manually after initial VRP optimization don't get distance calculated
2. **Missing Coordinates** - Some customer locations may lack latitude/longitude data
3. **Failed Distance Calculation** - The distance calculation API call may have failed during trip creation
4. **Legacy Data** - Trips created before the distance calculation feature was implemented
5. **Single-Stop Trips** - Trips with only 1 stop may not trigger distance calculation (only origin to destination)

## Recommendations

### Short-term Fix
1. **Recalculate distances** for affected trips using the Mapbox API
2. **Clean up empty trips** (like trip 13 in RP-20260108-001)
3. **Add validation** to prevent creating trips without distance data

### Long-term Solution
1. **Automatic distance calculation** whenever a trip is created or modified
2. **Validation on trip creation** - Require distance data before allowing trip approval
3. **Background job** to recalculate missing distances periodically
4. **UI warning** when displaying trips without distance data
5. **Coordinate validation** - Ensure all customers have valid coordinates before creating routes

## Database Schema

### Tables Involved
- `receiving_route_plans` - Contains `total_distance_km` at plan level
- `receiving_route_trips` - Contains `total_distance_km` at trip level
- `receiving_route_stops` - Contains individual stop coordinates

### Query Used
```sql
SELECT 
  plan_id, 
  plan_code, 
  plan_date, 
  status, 
  total_distance_km
FROM receiving_route_plans
WHERE plan_code IN ('RP-20260130-005', ...);

SELECT 
  trip_id, 
  daily_trip_number, 
  trip_sequence, 
  total_distance_km, 
  total_stops
FROM receiving_route_trips
WHERE plan_id = ?
ORDER BY daily_trip_number;
```

## Next Steps

1. Create a migration script to recalculate missing distances
2. Add validation to the trip creation API
3. Update the UI to show a warning icon for trips without distance data
4. Implement automatic distance calculation on trip save

## Files
- Investigation script: `check-missing-distance.js`
- Routes page: `app/receiving/routes/page.tsx`
- Trip component: `app/receiving/routes/components/RoutesPlanTable/ExpandedTrips.tsx`
