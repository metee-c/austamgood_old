# 🔧 Migration Documentation

เอกสารคู่มือการทำ Database Migration

## เอกสารในโฟลเดอร์นี้

### คู่มือหลัก
- **MIGRATION_INSTRUCTIONS.md** - คำแนะนำการทำ migration แบบละเอียด
  - วิธีสร้าง migration file ใหม่
  - Naming convention สำหรับ migration files
  - วิธีรัน migration
  - การ rollback (ถ้าจำเป็น)
  - Best practices

### รายงาน
- **MIGRATION_REPORT.md** - รายงานการ migrate ทั้งหมด
- **MIGRATION_AUDIT_REPORT.md** - การตรวจสอบและ audit migrations

### คู่มือเฉพาะระบบ
- **RUN_VRP_MIGRATION.md** - วิธีรัน VRP migration โดยเฉพาะ

## Migration Workflow

### 1. สร้าง Migration File
```bash
# ตั้งชื่อตาม pattern: XXX_descriptive_name.sql
# XXX = เลขลำดับ 3 หลัก (001, 002, 003, ...)
# ตัวอย่าง:
031_add_user_permissions.sql
032_create_audit_log_table.sql
```

### 2. เขียน SQL
- CREATE TABLE
- ALTER TABLE
- CREATE INDEX
- CREATE TRIGGER
- CREATE FUNCTION
- INSERT default data
- COMMENT ON (สำคัญ!)

### 3. Test Migration
```bash
npm run db:migrate
```

### 4. Regenerate Types
```bash
npm run db:generate-types
```

### 5. Update Services
แก้ไขไฟล์ที่เกี่ยวข้อง:
- `lib/database/*.ts` - Database services
- `types/*.ts` - Type definitions
- API routes ที่ใช้ตารางที่เปลี่ยนแปลง

### 6. Test & Build
```bash
npm run dev        # ทดสอบใน development
npm run typecheck  # ตรวจสอบ TypeScript
npm run build      # Build production
```

## Migration Files ที่สำคัญ

### Core System (001-025)
- `007_add_receive_to_ledger_trigger.sql` - Trigger สำหรับ inventory ledger
- `010_add_reference_doc_type_to_ledger.sql` - เพิ่ม reference doc type
- `014_create_stock_import_tables.sql` - ตาราง stock import
- `015_add_move_to_ledger_trigger.sql` - Trigger สำหรับ transfers

### Workflow System (026-030)
- `026_add_workflow_status_enums.sql` - Status enums สำหรับ workflow
- `027_create_workflow_status_triggers.sql` - 6 workflow triggers
- `028_add_loadlist_rls_and_triggers.sql` - RLS policies
- `029_add_pending_approval_status.sql` - สถานะ pending_approval/approved
- `030_add_shipping_cost_validation_trigger.sql` - Trigger ตรวจสอบค่าขนส่ง

## Best Practices

### ✅ DO
- ใส่ comment อธิบายจุดประสงค์ของ migration
- ใช้ `IF NOT EXISTS` / `IF EXISTS` เพื่อป้องกัน error
- ใส่ `COMMENT ON` สำหรับ tables, columns, functions
- ทดสอบ migration ใน local ก่อน
- สร้าง index สำหรับ foreign keys และคอลัมน์ที่ search บ่อย

### ❌ DON'T
- ลบข้อมูลโดยไม่มี backup
- เปลี่ยนโครงสร้างตารางที่มีข้อมูลแล้วโดยไม่ระวัง
- Skip การ regenerate types
- ใช้ `DROP TABLE` โดยไม่มี `IF EXISTS`
- ลืมเพิ่ม RLS policies สำหรับตารางใหม่

## Common Patterns

### เพิ่ม Column
```sql
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

COMMENT ON COLUMN table_name.column_name IS 'คำอธิบาย';
```

### สร้าง Enum
```sql
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_name') THEN
        CREATE TYPE enum_name AS ENUM ('value1', 'value2');
    END IF;
END $;
```

### สร้าง Trigger
```sql
CREATE OR REPLACE FUNCTION trigger_function()
RETURNS TRIGGER AS $
BEGIN
    -- logic here
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_name ON table_name;
CREATE TRIGGER trigger_name
    AFTER UPDATE ON table_name
    FOR EACH ROW
    EXECUTE FUNCTION trigger_function();
```

## Troubleshooting

### Error: Type already exists
ใช้ `IF NOT EXISTS` check ก่อนสร้าง enum

### Error: Column already exists
ใช้ `IF NOT EXISTS` check ก่อนเพิ่ม column

### Error: Trigger not working
1. ตรวจสอบ condition ใน `WHEN` clause
2. ตรวจสอบว่าใช้ `NEW` / `OLD` ถูกต้อง
3. ดู logs ใน Supabase dashboard

## เอกสารที่เกี่ยวข้อง

- `supabase/migrations/` - โฟลเดอร์ migration files
- `CLAUDE.md` - Database migration workflow section
- `docs/DATABASE_SETUP.md` - การติดตั้ง database
