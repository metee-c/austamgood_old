# Vehicle-Supplier Assignment Guide

## Problem
You're seeing "ไม่มีรถสำหรับผู้ให้บริการนี้" (No vehicles for this supplier) because vehicles don't have a `supplier_id` assigned yet.

## Solution: Assign Suppliers to Vehicles

### Method 1: Using Supabase Studio SQL Editor (Recommended)

1. **Open Supabase Studio** and go to the SQL Editor
2. **Copy and paste** the contents of `supabase/manual-assign-vehicles.sql`
3. **Run STEP 1** to see your transport suppliers
4. **Run STEP 2** to see your vehicles and their assignment status
5. **Uncomment and modify STEP 3** to assign vehicles:
   - Replace `'SVC001'` with your actual `supplier_id` from STEP 1
   - Choose Option A, B, or C based on your needs
6. **Run STEP 4** to verify the assignment worked

### Method 2: Quick SQL Commands

If you know your supplier_id, run this directly in SQL Editor:

```sql
-- Check your supplier_id first
SELECT supplier_id, supplier_name FROM master_supplier LIMIT 5;

-- Then assign all vehicles to that supplier
UPDATE master_vehicle 
SET supplier_id = 'YOUR_SUPPLIER_ID_HERE'
WHERE supplier_id IS NULL 
  AND current_status = 'Active';
```

### Method 3: If No Transport Supplier Exists

If STEP 1 returns no results, you need to either:

**Option A: Update existing supplier**
```sql
UPDATE master_supplier 
SET supplier_type = 'ขนส่ง'
WHERE supplier_id = 'YOUR_SUPPLIER_ID';
```

**Option B: Create new transport supplier**
```sql
INSERT INTO master_supplier (
  supplier_id,
  supplier_code,
  supplier_name,
  supplier_type,
  service_category
) VALUES (
  'SVC001',
  'TRANS001',
  'บริษัท ขนส่งตัวอย่าง จำกัด',
  'ขนส่ง',
  'ขนส่งสินค้า'
);
```

## Verification

After assignment, test in the application:
1. Go to http://localhost:3000/receiving/routes
2. Click edit shipping cost on any route plan
3. Select a "ผู้ให้บริการขนส่ง" (Transport Company)
4. The "ทะเบียนรถ" dropdown should now show vehicles
5. Select a vehicle and the driver name should auto-fill

## Troubleshooting

### Still seeing "ไม่มีรถสำหรับผู้ให้บริการนี้"?

Check these:

1. **Verify supplier_id matches:**
```sql
SELECT v.vehicle_code, v.supplier_id, s.supplier_name
FROM master_vehicle v
LEFT JOIN master_supplier s ON v.supplier_id = s.supplier_id
WHERE v.current_status = 'Active';
```

2. **Check if vehicles are Active:**
```sql
SELECT vehicle_code, plate_number, current_status, supplier_id
FROM master_vehicle;
```

3. **Verify the supplier in the route plan:**
```sql
SELECT trip_id, supplier_id 
FROM receiving_route_trips 
WHERE plan_id = YOUR_PLAN_ID;
```

## Example: Complete Assignment Flow

```sql
-- 1. Find your supplier
SELECT supplier_id, supplier_name FROM master_supplier WHERE supplier_type = 'ขนส่ง';
-- Result: SVC001 | ห้างหุ้นส่วนจำกัด ละอองเอก 786 โลจิสติกส์

-- 2. Check unassigned vehicles
SELECT vehicle_id, vehicle_code, plate_number 
FROM master_vehicle 
WHERE supplier_id IS NULL AND current_status = 'Active';
-- Result: 3 vehicles found

-- 3. Assign them
UPDATE master_vehicle 
SET supplier_id = 'SVC001'
WHERE supplier_id IS NULL AND current_status = 'Active';
-- Result: 3 rows updated

-- 4. Verify
SELECT vehicle_code, plate_number, supplier_id 
FROM master_vehicle 
WHERE current_status = 'Active';
-- Result: All vehicles now have SVC001
```

## Files Reference

- Migration: `supabase/migrations/137_add_supplier_id_to_master_vehicle.sql`
- Manual SQL: `supabase/manual-assign-vehicles.sql`
- Helper Script: `scripts/assign-vehicles-to-suppliers.js`
- API: `app/api/master-vehicle/route.ts`
- Component: `components/receiving/EditShippingCostModal.tsx`
