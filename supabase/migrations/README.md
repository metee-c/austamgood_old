# Database Migrations

## Current State (December 2, 2025)

This folder contains the consolidated database schema from production.

### Migration File

- **`001_complete_schema_from_production.sql`** (732 KB)
  - Complete schema dump from production Supabase database
  - Dumped on: December 2, 2025 at 19:49
  - Contains: 100 tables, 114 functions, all triggers, indexes, and constraints

## What This File Contains

This is the **exact current state** of the production database, including:

### Tables (100 total)
1. **Master Data** - Products, customers, suppliers, employees, locations, warehouses, vehicles
2. **Warehouse Operations** - Receiving, inventory balances, ledger, movements, transfers
3. **Orders & Logistics** - Orders, picklists, loadlists, route plans, face sheets
4. **Stock Reservations** - picklist_item_reservations, face_sheet_item_reservations
5. **Production** - Production orders, BOM, material issues
6. **Online Packing** - 15 tables (packing_*)
7. **User & File Management** - Users, roles, permissions, files
8. **Stock Import** - Legacy system import tables

### Functions (114 total)
- FEFO/FIFO stock reservation functions
- Inventory ledger triggers
- Balance sync functions
- Status update triggers
- Workflow automation functions

## Schema Migration History

**Old migrations (84 files)** have been backed up to:
```
supabase/migrations_backup_20251202/
```

These files show the incremental changes that built up to the current schema, but may not match the actual production database due to direct changes made in Supabase dashboard.

## Adding New Migrations

When you need to make schema changes:

### Method 1: Manual Migration (Recommended)
```bash
# Create a new migration file
supabase migration new your_change_description

# Edit the file in supabase/migrations/
# Then apply it
supabase db push
```

### Method 2: Diff from Changes
```bash
# Make changes in Supabase dashboard first
# Then generate a migration from the diff
supabase db diff -f your_change_description

# Review the generated file, then apply
supabase db push
```

## Migration Naming Convention

New migrations should follow this format:
```
002_your_change_description.sql
003_another_change.sql
004_yet_another_change.sql
...
```

Start from `002_` since `001_` is the complete schema baseline.

## Testing Migrations

Before applying to production:

```bash
# 1. Test locally with Docker
supabase start
supabase db reset

# 2. Verify the migration
supabase db diff

# 3. If everything looks good, push to production
supabase db push --linked
```

## Important Notes

⚠️ **DO NOT** modify `001_complete_schema_from_production.sql` directly
- This file is a snapshot of production as of Dec 2, 2025
- Make changes via new migration files instead

⚠️ **ALWAYS** backup before applying migrations to production
```bash
supabase db dump --linked -f backup_before_migration.sql
```

⚠️ **TEST** migrations locally before pushing to production

## Production Database Info

- **Project Reference**: iwlkslewdgenckuejbit
- **Region**: ap-southeast-1 (AWS Singapore)
- **Database**: PostgreSQL 17.6.1.003
- **Schema Version**: Consolidated on 2025-12-02

## Related Documentation

- `../migrations_backup_20251202/README.md` - Details about backed up migrations
- `../../CLAUDE.md` - Complete project documentation
- `../../docs/FACE_SHEET_AUDIT_REPORT.md` - Latest feature audit
- `../../docs/fixes/WORKFLOW_FIX_SUMMARY.md` - Workflow implementation details
