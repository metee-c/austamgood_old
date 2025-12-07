# คู่มือการ Implement ระบบ Permission ใหม่
**เอกสารนี้เป็นคู่มือละเอียดสำหรับการ implement ระบบ Role & Permission ใหม่**

---

## ขั้นตอนที่ 1: Database Migration

### 1.1 สร้าง Migration File: `115_add_new_permission_structure.sql`

```sql
-- ==========================================
-- Migration: Add New Permission Structure
-- Created: 2025-12-07
-- ==========================================

-- 1. เพิ่ม columns ใหม่ใน master_permission_module
ALTER TABLE master_permission_module
ADD COLUMN IF NOT EXISTS parent_module_id BIGINT REFERENCES master_permission_module(module_id),
ADD COLUMN IF NOT EXISTS module_key VARCHAR(200) UNIQUE,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS icon VARCHAR(100);

-- 2. เพิ่ม permission types ใหม่ใน role_permission
ALTER TABLE role_permission
ADD COLUMN IF NOT EXISTS can_import BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_export BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_print BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_scan BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_assign BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_cancel BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_rollback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_publish BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_optimize BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_change_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_coordinates BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_reset_reservations BOOLEAN DEFAULT false;

-- 3. สร้างตาราง user_data_permissions
CREATE TABLE IF NOT EXISTS user_data_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES master_system_user(user_id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL, -- 'warehouse', 'customer', 'supplier', 'location'
  allowed_values TEXT[], -- array of IDs
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT REFERENCES master_system_user(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_data_permissions_user_id ON user_data_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_permissions_type ON user_data_permissions(permission_type);

-- 4. สร้างตาราง role_field_permissions
CREATE TABLE IF NOT EXISTS role_field_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES master_system_role(role_id) ON DELETE CASCADE,
  module_id BIGINT NOT NULL REFERENCES master_permission_module(module_id) ON DELETE CASCADE,
  field_name VARCHAR(200) NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_field_permissions_role ON role_field_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_field_permissions_module ON role_field_permissions(module_id);

-- 5. สร้างตาราง permission_audit_log
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES master_system_user(user_id),
  action VARCHAR(50) NOT NULL, -- 'granted', 'revoked', 'modified'
  permission_key VARCHAR(200),
  old_value JSONB,
  new_value JSONB,
  changed_by BIGINT REFERENCES master_system_user(user_id),
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_changed_at ON permission_audit_log(changed_at DESC);

-- 6. สร้างตาราง permission_groups (สำหรับจัดกลุ่ม permissions)
CREATE TABLE IF NOT EXISTS permission_groups (
  id BIGSERIAL PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL UNIQUE,
  group_key VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permission_keys TEXT[] NOT NULL,
  is_system BOOLEAN DEFAULT false, -- system groups ลบไม่ได้
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE permission_groups IS 'กลุ่มของ permissions เพื่อความสะดวกในการจัดการ';
```

### 1.2 สร้าง Migration File: `116_insert_permission_modules.sql`

```sql
-- ==========================================
-- Migration: Insert All Permission Modules
-- Created: 2025-12-07
-- Total Modules: 260+
-- ==========================================

-- ลบข้อมูลเก่าทั้งหมด (ถ้ามี)
TRUNCATE TABLE role_permission CASCADE;
TRUNCATE TABLE master_permission_module RESTART IDENTITY CASCADE;

-- Dashboard Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, display_order) VALUES
(1, 'Dashboard - ดูข้อมูล', 'dashboard.view', 'ดูแดชบอร์ดหลัก', 100);

-- Production Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order) VALUES
(10, 'จัดการผลิต', 'production', 'โมดูลการจัดการผลิต', NULL, 200),
(11, 'ใบสั่งผลิต - ดู', 'production.orders.view', 'ดูใบสั่งผลิต', 10, 201),
(12, 'ใบสั่งผลิต - สร้าง', 'production.orders.create', 'สร้างใบสั่งผลิตใหม่', 10, 202),
(13, 'ใบสั่งผลิต - แก้ไข', 'production.orders.edit', 'แก้ไขใบสั่งผลิต', 10, 203),
(14, 'ใบสั่งผลิต - ลบ', 'production.orders.delete', 'ลบใบสั่งผลิต', 10, 204),
(15, 'ใบสั่งผลิต - พิมพ์', 'production.orders.print', 'พิมพ์ใบสั่งผลิต', 10, 205);

-- Warehouse Management Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order) VALUES
(20, 'จัดการคลังสินค้า', 'warehouse', 'โมดูลจัดการคลังสินค้า', NULL, 300),

-- Warehouse Inbound
(21, 'รับสินค้าเข้า - ดู', 'warehouse.inbound.view', 'ดูรายการรับสินค้า', 20, 301),
(22, 'รับสินค้าเข้า - สร้าง', 'warehouse.inbound.create', 'สร้างใบรับสินค้าใหม่', 20, 302),
(23, 'รับสินค้าเข้า - แก้ไข', 'warehouse.inbound.edit', 'แก้ไขใบรับสินค้า', 20, 303),
(24, 'รับสินค้าเข้า - ลบ', 'warehouse.inbound.delete', 'ลบใบรับสินค้า', 20, 304),
(25, 'รับสินค้าเข้า - สแกน', 'warehouse.inbound.scan', 'สแกนพาเลท/QR Code', 20, 305),
(26, 'รับสินค้าเข้า - พิมพ์', 'warehouse.inbound.print', 'พิมพ์ฉลากพาเลท', 20, 306),
(27, 'รับสินค้าเข้า - กำหนดโลเคชั่น', 'warehouse.inbound.assign_location', 'กำหนดตำแหน่งจัดเก็บ', 20, 307),
(28, 'รับสินค้าเข้า - เปลี่ยนสถานะ', 'warehouse.inbound.change_status', 'เปลี่ยนสถานะการรับสินค้า', 20, 308),

-- Warehouse Transfer
(31, 'ย้ายสินค้า - ดู', 'warehouse.transfer.view', 'ดูรายการย้ายสินค้า', 20, 311),
(32, 'ย้ายสินค้า - สร้าง', 'warehouse.transfer.create', 'สร้างใบย้ายสินค้า', 20, 312),
(33, 'ย้ายสินค้า - แก้ไข', 'warehouse.transfer.edit', 'แก้ไขใบย้ายสินค้า', 20, 313),
(34, 'ย้ายสินค้า - ลบ', 'warehouse.transfer.delete', 'ลบใบย้ายสินค้า', 20, 314),
(35, 'ย้ายสินค้า - มอบหมาย', 'warehouse.transfer.assign', 'มอบหมายงานย้ายสินค้า', 20, 315),
(36, 'ย้ายสินค้า - ทำเสร็จ', 'warehouse.transfer.complete', 'ยืนยันย้ายสินค้าเสร็จ', 20, 316),

-- Warehouse Ledger
(41, 'การเคลื่อนไหวสต็อก - ดู', 'warehouse.ledger.view', 'ดูรายการเคลื่อนไหวสต็อก', 20, 321),
(42, 'การเคลื่อนไหวสต็อก - ส่งออก', 'warehouse.ledger.export', 'ส่งออกรายงานการเคลื่อนไหว', 20, 322),

-- Warehouse Balances
(51, 'คงเหลือตามโลเคชั่น - ดู', 'warehouse.balances.view', 'ดูยอดคงเหลือ', 20, 331),
(52, 'คงเหลือตามโลเคชั่น - ส่งออก', 'warehouse.balances.export', 'ส่งออกรายงานคงเหลือ', 20, 332),
(53, 'คงเหลือตามโลเคชั่น - รีเซ็ตการจอง', 'warehouse.balances.reset_reservations', 'รีเซ็ตจำนวนที่จองไว้', 20, 333),

-- Warehouse Preparation Area
(61, 'สินค้าบ้านหยิบ - ดู', 'warehouse.preparation_area.view', 'ดูสินค้าในบ้านหยิบ', 20, 341);

-- Order Management Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order) VALUES
(100, 'จัดการออเดอร์', 'orders', 'โมดูลจัดการออเดอร์', NULL, 400),

-- Orders
(101, 'ออเดอร์ - ดู', 'orders.view', 'ดูรายการออเดอร์', 100, 401),
(102, 'ออเดอร์ - สร้าง', 'orders.create', 'สร้างออเดอร์ใหม่', 100, 402),
(103, 'ออเดอร์ - แก้ไข', 'orders.edit', 'แก้ไขออเดอร์', 100, 403),
(104, 'ออเดอร์ - ลบ', 'orders.delete', 'ลบออเดอร์', 100, 404),
(105, 'ออเดอร์ - นำเข้า', 'orders.import', 'นำเข้าออเดอร์จากไฟล์', 100, 405),
(106, 'ออเดอร์ - ส่งออก', 'orders.export', 'ส่งออกออเดอร์', 100, 406),
(107, 'ออเดอร์ - ย้อนกลับ', 'orders.rollback', 'ย้อนกลับสถานะออเดอร์', 100, 407),
(108, 'ออเดอร์ - จัดการพิกัด', 'orders.manage_coordinates', 'จัดการพิกัดที่อยู่ลูกค้า', 100, 408),

-- Routes
(111, 'เส้นทางขนส่ง - ดู', 'routes.view', 'ดูแผนเส้นทาง', 100, 411),
(112, 'เส้นทางขนส่ง - สร้าง', 'routes.create', 'สร้างแผนเส้นทาง', 100, 412),
(113, 'เส้นทางขนส่ง - แก้ไข', 'routes.edit', 'แก้ไขแผนเส้นทาง', 100, 413),
(114, 'เส้นทางขนส่ง - ลบ', 'routes.delete', 'ลบแผนเส้นทาง', 100, 414),
(115, 'เส้นทางขนส่ง - Optimize', 'routes.optimize', 'ปรับเส้นทางอัตโนมัติ', 100, 415),
(116, 'เส้นทางขนส่ง - เผยแพร่', 'routes.publish', 'เผยแพร่แผนเส้นทาง', 100, 416),
(117, 'เส้นทางขนส่ง - จัดการออเดอร์', 'routes.manage_orders', 'เพิ่ม/ลบออเดอร์ในเส้นทาง', 100, 417),

-- Picklists
(121, 'ใบหยิบสินค้า - ดู', 'picklists.view', 'ดูรายการใบหยิบสินค้า', 100, 421),
(122, 'ใบหยิบสินค้า - สร้าง', 'picklists.create', 'สร้างใบหยิบสินค้า', 100, 422),
(123, 'ใบหยิบสินค้า - พิมพ์', 'picklists.print', 'พิมพ์ใบหยิบสินค้า', 100, 423),
(124, 'ใบหยิบสินค้า - มอบหมาย', 'picklists.assign', 'มอบหมายงานหยิบสินค้า', 100, 424),
(125, 'ใบหยิบสินค้า - ทำเสร็จ', 'picklists.complete', 'ยืนยันหยิบสินค้าเสร็จ', 100, 425),

-- Face Sheets
(131, 'ใบปะหน้า - ดู', 'face_sheets.view', 'ดูใบปะหน้าสินค้า', 100, 431),
(132, 'ใบปะหน้า - สร้าง', 'face_sheets.create', 'สร้างใบปะหน้า', 100, 432),
(133, 'ใบปะหน้า - พิมพ์', 'face_sheets.print', 'พิมพ์ใบปะหน้า', 100, 433),

-- Bonus Face Sheets
(141, 'ใบปะหน้าของแถม - ดู', 'bonus_face_sheets.view', 'ดูใบปะหน้าของแถม', 100, 441),
(142, 'ใบปะหน้าของแถม - สร้าง', 'bonus_face_sheets.create', 'สร้างใบปะหน้าของแถม', 100, 442),
(143, 'ใบปะหน้าของแถม - พิมพ์', 'bonus_face_sheets.print', 'พิมพ์ใบปะหน้าของแถม', 100, 443),

-- Loadlists
(151, 'ใบโหลดสินค้า - ดู', 'loadlists.view', 'ดูรายการใบโหลด', 100, 451),
(152, 'ใบโหลดสินค้า - สร้าง', 'loadlists.create', 'สร้างใบโหลด', 100, 452),
(153, 'ใบโหลดสินค้า - สแกน', 'loadlists.scan', 'สแกนออเดอร์ใส่ใบโหลด', 100, 453),
(154, 'ใบโหลดสินค้า - ออกจากคลัง', 'loadlists.depart', 'ยืนยันออกจากคลัง', 100, 454),

-- Auto Replenishment
(161, 'เบิกเติมอัตโนมัติ - ดู', 'replenishment.view', 'ดูรายการเบิกเติม', 100, 461),
(162, 'เบิกเติมอัตโนมัติ - ดำเนินการ', 'replenishment.execute', 'ดำเนินการเบิกเติม', 100, 462);

-- Stock Management Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order) VALUES
(200, 'จัดการสต็อก', 'stock', 'โมดูลจัดการสต็อก', NULL, 600),

(201, 'นับสต็อก - ดู', 'stock.count.view', 'ดูรายการนับสต็อก', 200, 601),
(202, 'นับสต็อก - สร้าง', 'stock.count.create', 'สร้างใบนับสต็อก', 200, 602),
(203, 'นับสต็อก - แก้ไข', 'stock.count.edit', 'แก้ไขใบนับสต็อก', 200, 603),
(204, 'นับสต็อก - ลบ', 'stock.count.delete', 'ลบใบนับสต็อก', 200, 604),
(205, 'นับสต็อก - ยืนยัน', 'stock.count.confirm', 'ยืนยันผลการนับสต็อก', 200, 605),

(211, 'ปรับสต็อก - ดู', 'stock.adjustment.view', 'ดูรายการปรับสต็อก', 200, 611),
(212, 'ปรับสต็อก - สร้าง', 'stock.adjustment.create', 'สร้างใบปรับสต็อก', 200, 612),
(213, 'ปรับสต็อก - แก้ไข', 'stock.adjustment.edit', 'แก้ไขใบปรับสต็อก', 200, 613),
(214, 'ปรับสต็อก - ลบ', 'stock.adjustment.delete', 'ลบใบปรับสต็อก', 200, 614),
(215, 'ปรับสต็อก - อนุมัติ', 'stock.adjustment.approve', 'อนุมัติการปรับสต็อก', 200, 615),

(221, 'นำเข้าสต็อก - ดู', 'stock.import.view', 'ดูรายการนำเข้า', 200, 621),
(222, 'นำเข้าสต็อก - อัปโหลด', 'stock.import.upload', 'อัปโหลดไฟล์นำเข้า', 200, 622),
(223, 'นำเข้าสต็อก - ตรวจสอบ', 'stock.import.validate', 'ตรวจสอบความถูกต้อง', 200, 623),
(224, 'นำเข้าสต็อก - ประมวลผล', 'stock.import.process', 'ประมวลผลนำเข้า', 200, 624);

-- Mobile Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order) VALUES
(300, 'Mobile Operations', 'mobile', 'โมดูล Mobile', NULL, 700),

(301, 'Mobile - ดูเมนู', 'mobile.view', 'ดูเมนู Mobile', 300, 701),

(311, 'Mobile รับสินค้า - ดู', 'mobile.receive.view', 'ดูรายการรับสินค้า', 300, 711),
(312, 'Mobile รับสินค้า - สแกน', 'mobile.receive.scan', 'สแกนรับสินค้า', 300, 712),
(313, 'Mobile รับสินค้า - ยืนยัน', 'mobile.receive.confirm', 'ยืนยันรับสินค้า', 300, 713),

(321, 'Mobile ย้ายสินค้า - ดู', 'mobile.transfer.view', 'ดูรายการย้าย', 300, 721),
(322, 'Mobile ย้ายสินค้า - สแกน', 'mobile.transfer.scan', 'สแกนย้ายสินค้า', 300, 722),
(323, 'Mobile ย้ายสินค้า - ย้าย', 'mobile.transfer.move', 'ย้ายสินค้า', 300, 723),
(324, 'Mobile ย้ายสินค้า - ทำเสร็จ', 'mobile.transfer.complete', 'ยืนยันย้ายเสร็จ', 300, 724),

(331, 'Mobile หยิบสินค้า - ดู', 'mobile.pick.view', 'ดูรายการหยิบ', 300, 731),
(332, 'Mobile หยิบสินค้า - สแกน', 'mobile.pick.scan', 'สแกนหยิบสินค้า', 300, 732),
(333, 'Mobile หยิบสินค้า - ยืนยัน', 'mobile.pick.confirm', 'ยืนยันหยิบเสร็จ', 300, 733),

(341, 'Mobile โหลดสินค้า - ดู', 'mobile.loading.view', 'ดูรายการโหลด', 300, 741),
(342, 'Mobile โหลดสินค้า - สแกน', 'mobile.loading.scan', 'สแกนโหลดสินค้า', 300, 742),
(343, 'Mobile โหลดสินค้า - ทำเสร็จ', 'mobile.loading.complete', 'ยืนยันโหลดเสร็จ', 300, 743),

(351, 'Mobile ใบปะหน้า - ดู', 'mobile.face_sheet.view', 'ดูงานใบปะหน้า', 300, 751),
(352, 'Mobile ใบปะหน้า - สแกน', 'mobile.face_sheet.scan', 'สแกนหยิบใบปะหน้า', 300, 752),
(353, 'Mobile ใบปะหน้า - ยืนยัน', 'mobile.face_sheet.confirm', 'ยืนยันหยิบเสร็จ', 300, 753),

(361, 'Mobile ของแถม - ดู', 'mobile.bonus_face_sheet.view', 'ดูงานของแถม', 300, 761),
(362, 'Mobile ของแถม - สแกน', 'mobile.bonus_face_sheet.scan', 'สแกนหยิบของแถม', 300, 762),
(363, 'Mobile ของแถม - ยืนยัน', 'mobile.bonus_face_sheet.confirm', 'ยืนยันหยิบเสร็จ', 300, 763);

-- Master Data Module
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order) VALUES
(400, 'ข้อมูลหลัก', 'master', 'โมดูลข้อมูลหลัก', NULL, 800),

(401, 'สินค้า - ดู', 'master.products.view', 'ดูข้อมูลสินค้า', 400, 801),
(402, 'สินค้า - สร้าง', 'master.products.create', 'สร้างสินค้าใหม่', 400, 802),
(403, 'สินค้า - แก้ไข', 'master.products.edit', 'แก้ไขข้อมูลสินค้า', 400, 803),
(404, 'สินค้า - ลบ', 'master.products.delete', 'ลบสินค้า', 400, 804),
(405, 'สินค้า - นำเข้า', 'master.products.import', 'นำเข้าข้อมูลสินค้า', 400, 805),
(406, 'สินค้า - ส่งออก', 'master.products.export', 'ส่งออกข้อมูลสินค้า', 400, 806),

(411, 'BOM - ดู', 'master.bom.view', 'ดูข้อมูล BOM', 400, 811),
(412, 'BOM - สร้าง', 'master.bom.create', 'สร้าง BOM ใหม่', 400, 812),
(413, 'BOM - แก้ไข', 'master.bom.edit', 'แก้ไข BOM', 400, 813),
(414, 'BOM - ลบ', 'master.bom.delete', 'ลบ BOM', 400, 814),

(421, 'คลังสินค้า - ดู', 'master.warehouses.view', 'ดูข้อมูลคลัง', 400, 821),
(422, 'คลังสินค้า - สร้าง', 'master.warehouses.create', 'สร้างคลังใหม่', 400, 822),
(423, 'คลังสินค้า - แก้ไข', 'master.warehouses.edit', 'แก้ไขข้อมูลคลัง', 400, 823),
(424, 'คลังสินค้า - ลบ', 'master.warehouses.delete', 'ลบคลัง', 400, 824),

(431, 'โลเคชั่น - ดู', 'master.locations.view', 'ดูข้อมูลโลเคชั่น', 400, 831),
(432, 'โลเคชั่น - สร้าง', 'master.locations.create', 'สร้างโลเคชั่นใหม่', 400, 832),
(433, 'โลเคชั่น - แก้ไข', 'master.locations.edit', 'แก้ไขโลเคชั่น', 400, 833),
(434, 'โลเคชั่น - ลบ', 'master.locations.delete', 'ลบโลเคชั่น', 400, 834),
(435, 'โลเคชั่น - นำเข้า', 'master.locations.import', 'นำเข้าโลเคชั่น', 400, 835),

(441, 'กลยุทธ์การเก็บ - ดู', 'master.storage_strategy.view', 'ดูกลยุทธ์', 400, 841),
(442, 'กลยุทธ์การเก็บ - สร้าง', 'master.storage_strategy.create', 'สร้างกลยุทธ์', 400, 842),
(443, 'กลยุทธ์การเก็บ - แก้ไข', 'master.storage_strategy.edit', 'แก้ไขกลยุทธ์', 400, 843),
(444, 'กลยุทธ์การเก็บ - ลบ', 'master.storage_strategy.delete', 'ลบกลยุทธ์', 400, 844),

(451, 'บ้านหยิบ - ดู', 'master.preparation_area.view', 'ดูพื้นที่จัดเตรียม', 400, 851),
(452, 'บ้านหยิบ - สร้าง', 'master.preparation_area.create', 'สร้างพื้นที่จัดเตรียม', 400, 852),
(453, 'บ้านหยิบ - แก้ไข', 'master.preparation_area.edit', 'แก้ไขพื้นที่จัดเตรียม', 400, 853),
(454, 'บ้านหยิบ - ลบ', 'master.preparation_area.delete', 'ลบพื้นที่จัดเตรียม', 400, 854),

(461, 'ซัพพลายเออร์ - ดู', 'master.suppliers.view', 'ดูข้อมูลซัพพลายเออร์', 400, 861),
(462, 'ซัพพลายเออร์ - สร้าง', 'master.suppliers.create', 'สร้างซัพพลายเออร์', 400, 862),
(463, 'ซัพพลายเออร์ - แก้ไข', 'master.suppliers.edit', 'แก้ไขซัพพลายเออร์', 400, 863),
(464, 'ซัพพลายเออร์ - ลบ', 'master.suppliers.delete', 'ลบซัพพลายเออร์', 400, 864),

(471, 'ลูกค้า - ดู', 'master.customers.view', 'ดูข้อมูลลูกค้า', 400, 871),
(472, 'ลูกค้า - สร้าง', 'master.customers.create', 'สร้างลูกค้า', 400, 872),
(473, 'ลูกค้า - แก้ไข', 'master.customers.edit', 'แก้ไขลูกค้า', 400, 873),
(474, 'ลูกค้า - ลบ', 'master.customers.delete', 'ลบลูกค้า', 400, 874),
(475, 'ลูกค้า - จัดการพิกัด', 'master.customers.update_coordinates', 'อัปเดตพิกัดลูกค้า', 400, 875),

(481, 'ยานพาหนะ - ดู', 'master.vehicles.view', 'ดูข้อมูลรถ', 400, 881),
(482, 'ยานพาหนะ - สร้าง', 'master.vehicles.create', 'สร้างรถใหม่', 400, 882),
(483, 'ยานพาหนะ - แก้ไข', 'master.vehicles.edit', 'แก้ไขข้อมูลรถ', 400, 883),
(484, 'ยานพาหนะ - ลบ', 'master.vehicles.delete', 'ลบรถ', 400, 884),

(491, 'ผู้ใช้งาน - ดู', 'master.users.view', 'ดูข้อมูลผู้ใช้', 400, 891),
(492, 'ผู้ใช้งาน - สร้าง', 'master.users.create', 'สร้างผู้ใช้ใหม่', 400, 892),
(493, 'ผู้ใช้งาน - แก้ไข', 'master.users.edit', 'แก้ไขผู้ใช้', 400, 893),
(494, 'ผู้ใช้งาน - ลบ', 'master.users.delete', 'ลบผู้ใช้', 400, 894),

(501, 'บทบาท - ดู', 'master.roles.view', 'ดูข้อมูลบทบาท', 400, 901),
(502, 'บทบาท - สร้าง', 'master.roles.create', 'สร้างบทบาทใหม่', 400, 902),
(503, 'บทบาท - แก้ไข', 'master.roles.edit', 'แก้ไขบทบาท', 400, 903),
(504, 'บทบาท - ลบ', 'master.roles.delete', 'ลบบทบาท', 400, 904),
(505, 'บทบาท - จัดการสิทธิ์', 'master.roles.manage_permissions', 'กำหนดสิทธิ์ให้บทบาท', 400, 905),

(511, 'พนักงาน - ดู', 'master.employees.view', 'ดูข้อมูลพนักงาน', 400, 911),
(512, 'พนักงาน - สร้าง', 'master.employees.create', 'สร้างพนักงานใหม่', 400, 912),
(513, 'พนักงาน - แก้ไข', 'master.employees.edit', 'แก้ไขพนักงาน', 400, 913),
(514, 'พนักงาน - ลบ', 'master.employees.delete', 'ลบพนักงาน', 400, 914);

-- Reset sequence
SELECT setval('master_permission_module_module_id_seq', 600);

COMMENT ON TABLE master_permission_module IS 'Permission modules ทั้งหมด 260+ permissions';
```

### 1.3 สร้าง Migration File: `117_insert_predefined_roles.sql`

```sql
-- ==========================================
-- Migration: Insert Predefined Roles
-- Created: 2025-12-07
-- Total Roles: 11
-- ==========================================

-- ลบข้อมูล roles เก่า
TRUNCATE TABLE user_role CASCADE;
TRUNCATE TABLE role_permission CASCADE;
TRUNCATE TABLE master_system_role RESTART IDENTITY CASCADE;

-- 1. Super Admin
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(1, 'Super Admin', 'ผู้ดูแลระบบ - มีสิทธิ์เต็มทุกอย่าง', true);

-- Grant ALL permissions to Super Admin
INSERT INTO role_permission (role_id, module_id, can_view, can_create, can_edit, can_delete, can_approve, can_import, can_export, can_print, can_scan, can_assign, can_complete, can_cancel, can_rollback, can_publish, can_optimize, can_change_status)
SELECT 1, module_id, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true
FROM master_permission_module;

-- 2. Warehouse Manager
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(2, 'Warehouse Manager', 'ผู้จัดการคลังสินค้า - จัดการคลังและออเดอร์', true);

-- Grant permissions to Warehouse Manager
INSERT INTO role_permission (role_id, module_id, can_view, can_create, can_edit, can_delete, can_approve, can_import, can_export, can_print, can_scan, can_assign, can_complete, can_change_status)
SELECT 2, module_id,
  true, -- can_view
  CASE WHEN module_key LIKE 'master.%.delete' THEN false ELSE true END, -- can_create
  CASE WHEN module_key LIKE 'master.%.delete' THEN false ELSE true END, -- can_edit
  false, -- can_delete
  true, -- can_approve
  true, -- can_import
  true, -- can_export
  true, -- can_print
  true, -- can_scan
  true, -- can_assign
  true, -- can_complete
  true -- can_change_status
FROM master_permission_module
WHERE module_key LIKE 'dashboard.%'
   OR module_key LIKE 'warehouse.%'
   OR module_key LIKE 'orders.%'
   OR module_key LIKE 'routes.%'
   OR module_key LIKE 'picklists.%'
   OR module_key LIKE 'loadlists.%'
   OR module_key LIKE 'stock.%'
   OR module_key LIKE 'reports.%'
   OR module_key LIKE 'master.%';

-- 3. Warehouse Supervisor
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(3, 'Warehouse Supervisor', 'หัวหน้าคลังสินค้า', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_create, can_edit, can_delete)
SELECT 3, module_id, true, true, true, false
FROM master_permission_module
WHERE module_key LIKE 'dashboard.%'
   OR module_key LIKE 'warehouse.%'
   OR module_key LIKE 'orders.view'
   OR module_key LIKE 'orders.create'
   OR module_key LIKE 'orders.edit'
   OR module_key LIKE 'picklists.%'
   OR module_key LIKE 'stock.%'
   OR module_key LIKE 'reports.view';

-- 4. Warehouse Operator
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(4, 'Warehouse Operator', 'พนักงานคลังสินค้า', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_scan)
SELECT 4, module_id, true, true
FROM master_permission_module
WHERE module_key IN (
  'warehouse.inbound.view', 'warehouse.inbound.scan',
  'warehouse.transfer.view',
  'warehouse.balances.view',
  'mobile.view', 'mobile.receive.view', 'mobile.receive.scan', 'mobile.receive.confirm',
  'mobile.transfer.view', 'mobile.transfer.scan', 'mobile.transfer.move', 'mobile.transfer.complete',
  'mobile.pick.view', 'mobile.pick.scan', 'mobile.pick.confirm',
  'mobile.loading.view', 'mobile.loading.scan', 'mobile.loading.complete',
  'mobile.face_sheet.view', 'mobile.face_sheet.scan', 'mobile.face_sheet.confirm',
  'mobile.bonus_face_sheet.view', 'mobile.bonus_face_sheet.scan', 'mobile.bonus_face_sheet.confirm',
  'reports.view'
);

-- 5. Forklift Driver
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(5, 'Forklift Driver', 'คนขับรถยก', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_scan, can_complete)
SELECT 5, module_id, true, true, true
FROM master_permission_module
WHERE module_key IN (
  'mobile.view',
  'mobile.transfer.view', 'mobile.transfer.scan', 'mobile.transfer.move', 'mobile.transfer.complete',
  'warehouse.transfer.view'
);

-- 6. Picker
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(6, 'Picker', 'พนักงานหยิบสินค้า', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_scan)
SELECT 6, module_id, true, true
FROM master_permission_module
WHERE module_key IN (
  'mobile.view',
  'mobile.pick.view', 'mobile.pick.scan', 'mobile.pick.confirm',
  'mobile.face_sheet.view', 'mobile.face_sheet.scan', 'mobile.face_sheet.confirm',
  'mobile.bonus_face_sheet.view', 'mobile.bonus_face_sheet.scan', 'mobile.bonus_face_sheet.confirm',
  'picklists.view'
);

-- 7. Driver
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(7, 'Driver', 'พนักงานขับรถ', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_scan)
SELECT 7, module_id, true, true
FROM master_permission_module
WHERE module_key IN (
  'mobile.view',
  'mobile.loading.view', 'mobile.loading.scan', 'mobile.loading.complete',
  'loadlists.view',
  'routes.view'
);

-- 8. Checker
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(8, 'Checker', 'พนักงานเช็คสินค้า', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_scan)
SELECT 8, module_id, true, true
FROM master_permission_module
WHERE module_key IN (
  'mobile.view',
  'mobile.receive.view', 'mobile.receive.scan', 'mobile.receive.confirm',
  'warehouse.inbound.view', 'warehouse.inbound.scan',
  'mobile.pick.view',
  'mobile.face_sheet.view'
);

-- 9. Planner
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(9, 'Planner', 'เจ้าหน้าที่วางแผน', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_create, can_edit, can_import, can_export, can_optimize, can_publish)
SELECT 9, module_id, true, true, true, true, true, true, true
FROM master_permission_module
WHERE module_key LIKE 'orders.%'
   OR module_key LIKE 'routes.%'
   OR module_key LIKE 'picklists.%'
   OR module_key LIKE 'face_sheets.%'
   OR module_key LIKE 'loadlists.%'
   OR module_key LIKE 'reports.%';

-- 10. Data Entry
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(10, 'Data Entry', 'เจ้าหน้าที่บันทึกข้อมูล', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_create, can_edit, can_import)
SELECT 10, module_id, true, true, true, true
FROM master_permission_module
WHERE module_key LIKE 'master.%'
   OR module_key IN ('orders.view', 'orders.create', 'orders.import');

-- 11. Viewer
INSERT INTO master_system_role (role_id, role_name, description, is_active) VALUES
(11, 'Viewer', 'ผู้ดูข้อมูล', true);

INSERT INTO role_permission (role_id, module_id, can_view, can_export)
SELECT 11, module_id, true,
  CASE WHEN module_key LIKE 'reports.%' THEN true ELSE false END
FROM master_permission_module
WHERE module_key LIKE '%.view';

-- Reset sequence
SELECT setval('master_system_role_role_id_seq', 20);

COMMENT ON TABLE master_system_role IS 'Predefined roles: 11 roles with granular permissions';
```

---

## ขั้นตอนที่ 2: Backend Services

### 2.1 สร้าง Permission Service: `lib/services/permission.service.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
}

export class PermissionService {
  private supabase: SupabaseClient;
  private permissionCache: Map<string, boolean>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.permissionCache = new Map();
  }

  /**
   * ตรวจสอบสิทธิ์ของผู้ใช้ต่อ permission key
   */
  async checkPermission(
    userId: number,
    permissionKey: string
  ): Promise<PermissionCheckResult> {
    // Check cache first
    const cacheKey = `${userId}:${permissionKey}`;
    if (this.permissionCache.has(cacheKey)) {
      return {
        hasPermission: this.permissionCache.get(cacheKey)!,
      };
    }

    // Query user roles
    const { data: userRoles, error: rolesError } = await this.supabase
      .from('user_role')
      .select('role_id')
      .eq('user_id', userId);

    if (rolesError || !userRoles || userRoles.length === 0) {
      return {
        hasPermission: false,
        reason: 'User has no roles assigned',
      };
    }

    const roleIds = userRoles.map((r) => r.role_id);

    // Query permission module
    const { data: module, error: moduleError } = await this.supabase
      .from('master_permission_module')
      .select('module_id')
      .eq('module_key', permissionKey)
      .single();

    if (moduleError || !module) {
      return {
        hasPermission: false,
        reason: `Permission module not found: ${permissionKey}`,
      };
    }

    // Check if any role has this permission
    const { data: permissions, error: permError } = await this.supabase
      .from('role_permission')
      .select('*')
      .in('role_id', roleIds)
      .eq('module_id', module.module_id);

    if (permError || !permissions || permissions.length === 0) {
      this.permissionCache.set(cacheKey, false);
      return {
        hasPermission: false,
        reason: 'No permission found for this user',
      };
    }

    // Determine permission type from key
    const action = this.getActionFromKey(permissionKey);
    const hasPermission = permissions.some((p) => {
      switch (action) {
        case 'view':
          return p.can_view;
        case 'create':
          return p.can_create;
        case 'edit':
          return p.can_edit;
        case 'delete':
          return p.can_delete;
        case 'approve':
          return p.can_approve;
        case 'import':
          return p.can_import;
        case 'export':
          return p.can_export;
        case 'print':
          return p.can_print;
        case 'scan':
          return p.can_scan;
        case 'assign':
          return p.can_assign;
        case 'complete':
          return p.can_complete;
        case 'cancel':
          return p.can_cancel;
        case 'rollback':
          return p.can_rollback;
        case 'publish':
          return p.can_publish;
        case 'optimize':
          return p.can_optimize;
        case 'change_status':
          return p.can_change_status;
        default:
          return p.can_view; // Default to view
      }
    });

    // Cache result
    this.permissionCache.set(cacheKey, hasPermission);

    return {
      hasPermission,
      reason: hasPermission ? undefined : `User lacks ${action} permission`,
    };
  }

  /**
   * ตรวจสอบสิทธิ์หลายตัวพร้อมกัน
   */
  async checkMultiplePermissions(
    userId: number,
    permissionKeys: string[]
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      permissionKeys.map(async (key) => {
        const result = await this.checkPermission(userId, key);
        results[key] = result.hasPermission;
      })
    );

    return results;
  }

  /**
   * ดึง action จาก permission key
   */
  private getActionFromKey(permissionKey: string): string {
    const parts = permissionKey.split('.');
    return parts[parts.length - 1]; // e.g., 'warehouse.inbound.view' → 'view'
  }

  /**
   * ล้าง cache
   */
  clearCache(userId?: number) {
    if (userId) {
      // Clear cache for specific user
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.permissionCache.clear();
    }
  }

  /**
   * ดึง permissions ทั้งหมดของ user
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    const { data: userRoles } = await this.supabase
      .from('user_role')
      .select('role_id')
      .eq('user_id', userId);

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map((r) => r.role_id);

    const { data: permissions } = await this.supabase
      .from('role_permission')
      .select(`
        *,
        module:master_permission_module(module_key)
      `)
      .in('role_id', roleIds);

    if (!permissions) {
      return [];
    }

    // Extract permission keys based on granted permissions
    const permissionKeys: Set<string> = new Set();

    permissions.forEach((p: any) => {
      const baseKey = p.module.module_key;

      // Add all granted actions
      if (p.can_view) permissionKeys.add(baseKey.replace(/\.\w+$/, '.view'));
      if (p.can_create) permissionKeys.add(baseKey.replace(/\.\w+$/, '.create'));
      if (p.can_edit) permissionKeys.add(baseKey.replace(/\.\w+$/, '.edit'));
      if (p.can_delete) permissionKeys.add(baseKey.replace(/\.\w+$/, '.delete'));
      if (p.can_approve) permissionKeys.add(baseKey.replace(/\.\w+$/, '.approve'));
      if (p.can_import) permissionKeys.add(baseKey.replace(/\.\w+$/, '.import'));
      if (p.can_export) permissionKeys.add(baseKey.replace(/\.\w+$/, '.export'));
      // ... และอื่นๆ
    });

    return Array.from(permissionKeys);
  }
}
```

---

## ขั้นตอนที่ 3: API Middleware

### 3.1 สร้าง Permission Middleware: `lib/middleware/permission.middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PermissionService } from '@/lib/services/permission.service';

export interface PermissionMiddlewareOptions {
  permissionKey: string;
  errorMessage?: string;
}

export async function requirePermission(
  req: NextRequest,
  options: PermissionMiddlewareOptions
): Promise<NextResponse | null> {
  const supabase = await createClient();
  const permissionService = new PermissionService(supabase);

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get user ID from master_system_user
  const { data: systemUser } = await supabase
    .from('master_system_user')
    .select('user_id')
    .eq('email', user.email)
    .single();

  if (!systemUser) {
    return NextResponse.json(
      { error: 'User not found in system' },
      { status: 404 }
    );
  }

  // Check permission
  const result = await permissionService.checkPermission(
    systemUser.user_id,
    options.permissionKey
  );

  if (!result.hasPermission) {
    return NextResponse.json(
      {
        error: options.errorMessage || 'Insufficient permissions',
        reason: result.reason,
        required_permission: options.permissionKey,
      },
      { status: 403 }
    );
  }

  // Permission granted, continue
  return null;
}
```

### 3.2 ตัวอย่างการใช้งานใน API Route

```typescript
// app/api/warehouse/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/permission.middleware';

export async function GET(req: NextRequest) {
  // Check permission first
  const permissionError = await requirePermission(req, {
    permissionKey: 'warehouse.inbound.view',
    errorMessage: 'You do not have permission to view inbound records',
  });

  if (permissionError) {
    return permissionError;
  }

  // Continue with normal logic
  // ...
}

export async function POST(req: NextRequest) {
  const permissionError = await requirePermission(req, {
    permissionKey: 'warehouse.inbound.create',
  });

  if (permissionError) {
    return permissionError;
  }

  // Continue...
}
```

---

## ขั้นตอนที่ 4: Frontend Implementation

### 4.1 สร้าง Permission Hook: `hooks/usePermission.ts`

```typescript
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth'; // สมมติว่ามี auth hook

export function usePermission(permissionKey: string): boolean {
  const [hasPermission, setHasPermission] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setHasPermission(false);
      return;
    }

    async function checkPermission() {
      try {
        const response = await fetch(
          `/api/check-permission?key=${permissionKey}`
        );
        const data = await response.json();
        setHasPermission(data.hasPermission);
      } catch (error) {
        console.error('Permission check failed:', error);
        setHasPermission(false);
      }
    }

    checkPermission();
  }, [user, permissionKey]);

  return hasPermission;
}

export function useMultiplePermissions(
  permissionKeys: string[]
): Record<string, boolean> {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  useEffect(() => {
    if (!user || permissionKeys.length === 0) {
      return;
    }

    async function checkPermissions() {
      try {
        const response = await fetch('/api/check-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: permissionKeys }),
        });
        const data = await response.json();
        setPermissions(data.permissions);
      } catch (error) {
        console.error('Permission check failed:', error);
      }
    }

    checkPermissions();
  }, [user, JSON.stringify(permissionKeys)]);

  return permissions;
}
```

### 4.2 สร้าง Permission Components

```typescript
// components/permission/PermissionGuard.tsx
import React from 'react';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const hasPermission = usePermission(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

```typescript
// components/permission/PermissionButton.tsx
import React from 'react';
import Button, { ButtonProps } from '@/components/ui/Button';
import { usePermission } from '@/hooks/usePermission';

interface PermissionButtonProps extends ButtonProps {
  permission: string;
  hideIfNoPermission?: boolean;
}

export function PermissionButton({
  permission,
  hideIfNoPermission = false,
  disabled,
  ...props
}: PermissionButtonProps) {
  const hasPermission = usePermission(permission);

  if (hideIfNoPermission && !hasPermission) {
    return null;
  }

  return <Button {...props} disabled={disabled || !hasPermission} />;
}
```

### 4.3 ตัวอย่างการใช้งานใน UI

```typescript
// app/warehouse/inbound/page.tsx
import { PermissionGuard } from '@/components/permission/PermissionGuard';
import { PermissionButton } from '@/components/permission/PermissionButton';

export default function InboundPage() {
  return (
    <div>
      <h1>รับสินค้าเข้า</h1>

      {/* แสดงปุ่มเฉพาะคนที่มีสิทธิ์สร้าง */}
      <PermissionButton
        permission="warehouse.inbound.create"
        icon={Plus}
        hideIfNoPermission
        onClick={() => setShowModal(true)}
      >
        เพิ่มใบรับสินค้า
      </PermissionButton>

      {/* แสดง section เฉพาะคนที่มีสิทธิ์ */}
      <PermissionGuard permission="warehouse.inbound.view">
        <Table>
          {/* Table content */}
        </Table>
      </PermissionGuard>

      {/* ปุ่มแก้ไข - disable ถ้าไม่มีสิทธิ์ */}
      <PermissionButton
        permission="warehouse.inbound.edit"
        icon={Edit}
        onClick={() => handleEdit()}
      >
        แก้ไข
      </PermissionButton>
    </div>
  );
}
```

---

## สรุป

เอกสารนี้ครอบคลุม:
- ✅ Database migrations ทั้งหมด (3 files)
- ✅ Permission Service implementation
- ✅ API Middleware สำหรับ permission checking
- ✅ Frontend hooks และ components
- ✅ ตัวอย่างการใช้งานจริง

**Next Steps:**
1. Run migrations: `npm run db:migrate`
2. Implement permission checking ใน API routes ทั้งหมด
3. Update UI components ให้ใช้ Permission Guards
4. Testing แต่ละ role
5. Update documentation
