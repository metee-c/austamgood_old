# Backup Migrations - December 2, 2025

This folder contains backup of all old migration files before consolidating to a single schema dump.

## What Happened

On December 2, 2025, we dumped the complete current schema from the production Supabase database and replaced all 84 incremental migration files with a single consolidated schema file.

## Files in This Backup

This folder contains 84 migration files (001 through 999) that were incrementally applied to build up the current database schema:

- Migration files 001-077: Incremental schema changes
- Migration 999: Previous complete schema attempt
- Migration online_packing_system_migration.sql: Online packing system

## Current State

The current migrations folder now contains only one file:
- `20251202_complete_schema_from_production.sql` - Complete schema dump from production (732 KB)

This file represents the **exact current state** of the production database as of December 2, 2025, including:
- 100 tables
- 114 functions
- All triggers, indexes, constraints, and comments

## Schema Contents

The production schema includes:
1. Master Data tables (customers, suppliers, employees, SKUs, locations, warehouses, vehicles)
2. Warehouse Operations (receiving, inventory balances, ledger, movements)
3. Order & Logistics (orders, picklists, loadlists, route plans, face sheets)
4. Stock Reservations (picklist_item_reservations, face_sheet_item_reservations)
5. Production Management (production orders, BOM)
6. Online Packing System (15 tables with packing_* prefix)
7. File & User Management
8. Stock Import System

## Why We Did This

The migration files had become out of sync with the actual database schema due to:
1. Direct changes made in Supabase dashboard
2. Missing or incomplete migration files
3. Conflicts between different migration versions

## How to Use This Backup

If you need to reference old migrations:
1. Check this backup folder for the original migration files
2. Each file shows what was intended to be changed at that point in time
3. Note: The actual production database may differ from what these migrations describe

## Restoration (If Needed)

To restore the old migration structure:
```bash
cd supabase
rm migrations/*.sql
cp migrations_backup_20251202/*.sql migrations/
```

**Warning**: This will restore the old migration files, but they may not match the current production schema.

## Going Forward

From now on:
1. All new schema changes should be made via new migration files
2. Start numbering from 001 again (after the consolidated schema)
3. Always test migrations locally before applying to production
4. Use `supabase db diff` to generate migration files from schema changes

## Production Database Details

- Project: iwlkslewdgenckuejbit
- Region: ap-southeast-1
- Dump Date: December 2, 2025 19:49
- Schema Size: 732 KB

## Related Documentation

- See `CLAUDE.md` for complete project documentation
- See `docs/FACE_SHEET_AUDIT_REPORT.md` for latest feature audit
- See individual migration files in this folder for historical changes
