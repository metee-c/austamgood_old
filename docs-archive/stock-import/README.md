# 📦 Stock Import Documentation

เอกสารระบบนำเข้าสต็อกจากระบบเดิม (Legacy System)

## เอกสารในโฟลเดอร์นี้

### สรุประบบ
- **STOCK_IMPORT_SUMMARY.md** - สรุประบบนำเข้าสต็อกแบบละเอียด
  - โครงสร้างตาราง `wms_stock_import_batches` และ `wms_stock_import_staging`
  - API endpoints สำหรับ upload, validate, process
  - Error handling และ validation rules
  - ตัวอย่างการใช้งาน

### แผนการพัฒนา
- **STOCK_IMPORT_PLAN.md** - แผนการพัฒนาระบบ stock import
  - Step-by-step implementation plan
  - Database schema design
  - Validation logic
  - UI/UX considerations

## ฟีเจอร์หลัก

### 1. Batch Processing
- นำเข้าข้อมูลเป็น batch
- ติดตาม status แต่ละ batch (pending, validated, processing, completed, failed)
- รองรับการนำเข้าหลายคลังพร้อมกัน

### 2. Validation
- ตรวจสอบ SKU code ว่ามีในระบบหรือไม่
- ตรวจสอบ location code ว่ามีอยู่และเป็นของคลังที่ถูกต้อง
- ตรวจสอบ quantity ต้องเป็นตัวเลขบวก
- บันทึก error messages แยกแต่ละแถว

### 3. Processing
- สร้าง inventory records จาก staging table
- อัปเดต inventory balances
- บันทึก logs ในตาราง `wms_inventory_ledger`

## Database Tables

### wms_stock_import_batches
ตารางหลักสำหรับจัดการ batch
- `batch_id` - Primary key
- `batch_code` - Unique identifier
- `warehouse_id` - คลังที่นำเข้า
- `status` - สถานะ batch
- `total_rows`, `success_count`, `error_count` - สถิติการนำเข้า

### wms_stock_import_staging
ตารางข้อมูลชั่วคราวก่อนนำเข้า
- `staging_id` - Primary key
- `batch_id` - Reference to batch
- `sku_code`, `location_code`, `quantity` - ข้อมูลสต็อก
- `validation_status` - สถานะการตรวจสอบ
- `error_message` - ข้อความ error (ถ้ามี)

## API Endpoints

- `POST /api/stock-import/upload` - อัปโหลดไฟล์ Excel/CSV
- `POST /api/stock-import/validate` - ตรวจสอบความถูกต้อง
- `POST /api/stock-import/process` - ประมวลผลนำเข้า
- `GET /api/stock-import/batches` - ดูรายการ batches
- `GET /api/stock-import/batches/[id]` - ดูรายละเอียด batch

## Migration Files

- `014_create_stock_import_tables.sql` - สร้างตารางสำหรับ stock import

## ใช้เมื่อไหร่?

### สำหรับ Developer
ใช้เอกสารเหล่านี้เมื่อ:
- พัฒนาระบบนำเข้าข้อมูล
- เข้าใจ batch processing workflow
- แก้ไข validation logic

### สำหรับ Business Users
ใช้เอกสารเหล่านี้เมื่อ:
- ต้องการนำเข้าสต็อกจากระบบเดิม
- ทำความเข้าใจขั้นตอนการนำเข้า
- ตรวจสอบ error และแก้ไข

## เอกสารที่เกี่ยวข้อง

- `types/stock-import.ts` - Type definitions
- `lib/database/stock-import.ts` - Database service
- `app/stock-management/import/page.tsx` - UI หน้านำเข้า
- `supabase/migrations/014_create_stock_import_tables.sql` - Database schema
