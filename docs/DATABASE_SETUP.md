# Database Setup for VRP System

## Required Tables

The VRP (Vehicle Routing Problem) system requires the following tables:

### 1. receiving_route_plan_trips
Stores trip information for each route plan.

### 2. receiving_route_plan_stops
Stores stop information for each trip.

### 3. receiving_route_plan_stop_orders
Links stops to orders (many-to-many relationship).

### 4. receiving_route_plan_metrics
Stores optimization metrics and summary data.

## Setup Instructions

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20241110_create_vrp_tables.sql`
4. Paste and run the SQL

### Option 2: Using Supabase CLI

```bash
# Make sure Supabase is running
supabase start

# Run the migration
supabase db reset

# Or push to remote
supabase db push
```

### Option 3: Manual SQL Execution

If you're using a different PostgreSQL setup:

```bash
# Connect to your database
psql -h your-host -U your-user -d your-database

# Run the migration file
\i supabase/migrations/20241110_create_vrp_tables.sql
```

## Verification

After running the migration, verify that the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'receiving_route_plan_%';

-- Expected output:
-- receiving_route_plans (should already exist)
-- receiving_route_plan_inputs (should already exist)
-- receiving_route_plan_trips (new)
-- receiving_route_plan_stops (new)
-- receiving_route_plan_stop_orders (new)
-- receiving_route_plan_metrics (new)
```

## Fallback Mode

If the tables don't exist, the VRP system will automatically fall back to storing optimization results in the `settings` JSONB column of the `receiving_route_plans` table. This allows the system to work without the additional tables, but with limited functionality.

### Limitations in Fallback Mode:
- ❌ Cannot edit individual trips/stops
- ❌ Cannot track actual vs. planned times
- ❌ Cannot assign vehicles/drivers
- ❌ Limited reporting capabilities
- ✅ Can still optimize routes
- ✅ Can view results
- ✅ Can export data

## Table Relationships

```
receiving_route_plans (1) ──→ (N) receiving_route_plan_trips
                                    │
                                    ├──→ (N) receiving_route_plan_stops
                                    │         │
                                    │         └──→ (N) receiving_route_plan_stop_orders
                                    │                   │
                                    │                   └──→ (1) receiving_inbound_orders
                                    │
                                    └──→ (1) receiving_route_plan_metrics
```

## Indexes

The migration creates the following indexes for performance:

### receiving_route_plan_trips
- `idx_route_plan_trips_plan_id` - For filtering by plan
- `idx_route_plan_trips_status` - For filtering by status
- `idx_route_plan_trips_vehicle` - For filtering by vehicle
- `idx_route_plan_trips_driver` - For filtering by driver
- `idx_route_plan_trips_zone` - For filtering by zone

### receiving_route_plan_stops
- `idx_route_plan_stops_trip_id` - For filtering by trip
- `idx_route_plan_stops_input_id` - For linking to inputs
- `idx_route_plan_stops_status` - For filtering by status
- `idx_route_plan_stops_location` - For geospatial queries
- `idx_route_plan_stops_tags` - For JSONB queries

## Row Level Security (RLS)

The tables have RLS enabled with policies that allow all operations for authenticated users. You may want to customize these policies based on your security requirements:

```sql
-- Example: Restrict access to specific warehouses
CREATE POLICY "Users can only see their warehouse plans"
ON receiving_route_plan_trips
FOR SELECT
TO authenticated
USING (
  plan_id IN (
    SELECT plan_id 
    FROM receiving_route_plans 
    WHERE warehouse_id IN (
      SELECT warehouse_id 
      FROM user_warehouse_access 
      WHERE user_id = auth.uid()
    )
  )
);
```

## Troubleshooting

### Error: "Could not find the table 'public.receiving_route_plan_trips'"

**Solution**: Run the migration file to create the tables.

### Error: "permission denied for table receiving_route_plan_trips"

**Solution**: Grant permissions:
```sql
GRANT ALL ON public.receiving_route_plan_trips TO authenticated;
GRANT ALL ON public.receiving_route_plan_stops TO authenticated;
GRANT ALL ON public.receiving_route_plan_stop_orders TO authenticated;
GRANT ALL ON public.receiving_route_plan_metrics TO authenticated;
```

### Error: "relation already exists"

**Solution**: The tables already exist. You can either:
1. Drop and recreate them (⚠️ will lose data):
   ```sql
   DROP TABLE IF EXISTS public.receiving_route_plan_stop_orders CASCADE;
   DROP TABLE IF EXISTS public.receiving_route_plan_stops CASCADE;
   DROP TABLE IF EXISTS public.receiving_route_plan_trips CASCADE;
   DROP TABLE IF EXISTS public.receiving_route_plan_metrics CASCADE;
   ```
2. Or skip the migration if tables are already correct

## Backup

Before running migrations on production, always backup your database:

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Using pg_dump
pg_dump -h your-host -U your-user -d your-database > backup.sql
```

## Migration History

| Date | Version | Description |
|------|---------|-------------|
| 2024-11-10 | 1.0.0 | Initial VRP tables creation |

## Support

If you encounter any issues with the database setup, please:
1. Check the error message carefully
2. Verify your database connection
3. Ensure you have the necessary permissions
4. Contact support with the error details

---

**Last Updated**: November 10, 2024
