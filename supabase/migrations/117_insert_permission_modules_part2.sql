-- ==========================================
-- Migration: Insert Permission Modules (Part 2)
-- Description: Stock Management, Mobile, Master Data Modules
-- Created: 2025-12-07
-- Dependencies: 116_insert_permission_modules.sql
-- ===========================================

-- ===========================================
-- Stock Management Module (Module ID: 200-229)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
-- Parent
(200, 'จัดการสต็อก', 'stock', 'โมดูลจัดการสต็อก', NULL, 600, true, 'Package'),

-- Stock Count (201-209)
(201, 'นับสต็อก - ดู', 'stock.count.view', 'ดูรายการนับสต็อก', 200, 601, true, 'Eye'),
(202, 'นับสต็อก - สร้าง', 'stock.count.create', 'สร้างใบนับสต็อก', 200, 602, true, 'Plus'),
(203, 'นับสต็อก - แก้ไข', 'stock.count.edit', 'แก้ไขใบนับสต็อก', 200, 603, true, 'Edit'),
(204, 'นับสต็อก - ลบ', 'stock.count.delete', 'ลบใบนับสต็อก', 200, 604, true, 'Trash2'),
(205, 'นับสต็อก - ยืนยัน', 'stock.count.confirm', 'ยืนยันผลการนับสต็อก', 200, 605, true, 'CheckCircle'),

-- Stock Adjustment (211-219)
(211, 'ปรับสต็อก - ดู', 'stock.adjustment.view', 'ดูรายการปรับสต็อก', 200, 611, true, 'Eye'),
(212, 'ปรับสต็อก - สร้าง', 'stock.adjustment.create', 'สร้างใบปรับสต็อก', 200, 612, true, 'Plus'),
(213, 'ปรับสต็อก - แก้ไข', 'stock.adjustment.edit', 'แก้ไขใบปรับสต็อก', 200, 613, true, 'Edit'),
(214, 'ปรับสต็อก - ลบ', 'stock.adjustment.delete', 'ลบใบปรับสต็อก', 200, 614, true, 'Trash2'),
(215, 'ปรับสต็อก - อนุมัติ', 'stock.adjustment.approve', 'อนุมัติการปรับสต็อก', 200, 615, true, 'CheckCircle'),

-- Stock Import (221-229)
(221, 'นำเข้าสต็อก - ดู', 'stock.import.view', 'ดูรายการนำเข้า', 200, 621, true, 'Eye'),
(222, 'นำเข้าสต็อก - อัปโหลด', 'stock.import.upload', 'อัปโหลดไฟล์นำเข้า', 200, 622, true, 'Upload'),
(223, 'นำเข้าสต็อก - ตรวจสอบ', 'stock.import.validate', 'ตรวจสอบความถูกต้อง', 200, 623, true, 'Shield'),
(224, 'นำเข้าสต็อก - ประมวลผล', 'stock.import.process', 'ประมวลผลนำเข้า', 200, 624, true, 'PlayCircle')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order;

-- ===========================================
-- Mobile Module (Module ID: 300-369)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
-- Parent
(300, 'Mobile Operations', 'mobile', 'โมดูล Mobile', NULL, 700, true, 'Smartphone'),
(301, 'Mobile - ดูเมนู', 'mobile.view', 'ดูเมนู Mobile', 300, 701, true, 'Eye'),

-- Mobile Receive (311-319)
(311, 'Mobile รับสินค้า - ดู', 'mobile.receive.view', 'ดูรายการรับสินค้า', 300, 711, true, 'Eye'),
(312, 'Mobile รับสินค้า - สแกน', 'mobile.receive.scan', 'สแกนรับสินค้า', 300, 712, true, 'QrCode'),
(313, 'Mobile รับสินค้า - ยืนยัน', 'mobile.receive.confirm', 'ยืนยันรับสินค้า', 300, 713, true, 'CheckCircle'),

-- Mobile Transfer (321-329)
(321, 'Mobile ย้ายสินค้า - ดู', 'mobile.transfer.view', 'ดูรายการย้าย', 300, 721, true, 'Eye'),
(322, 'Mobile ย้ายสินค้า - สแกน', 'mobile.transfer.scan', 'สแกนย้ายสินค้า', 300, 722, true, 'QrCode'),
(323, 'Mobile ย้ายสินค้า - ย้าย', 'mobile.transfer.move', 'ย้ายสินค้า', 300, 723, true, 'Move'),
(324, 'Mobile ย้ายสินค้า - ทำเสร็จ', 'mobile.transfer.complete', 'ยืนยันย้ายเสร็จ', 300, 724, true, 'CheckCircle'),

-- Mobile Pick (331-339)
(331, 'Mobile หยิบสินค้า - ดู', 'mobile.pick.view', 'ดูรายการหยิบ', 300, 731, true, 'Eye'),
(332, 'Mobile หยิบสินค้า - สแกน', 'mobile.pick.scan', 'สแกนหยิบสินค้า', 300, 732, true, 'QrCode'),
(333, 'Mobile หยิบสินค้า - ยืนยัน', 'mobile.pick.confirm', 'ยืนยันหยิบเสร็จ', 300, 733, true, 'CheckCircle'),

-- Mobile Loading (341-349)
(341, 'Mobile โหลดสินค้า - ดู', 'mobile.loading.view', 'ดูรายการโหลด', 300, 741, true, 'Eye'),
(342, 'Mobile โหลดสินค้า - สแกน', 'mobile.loading.scan', 'สแกนโหลดสินค้า', 300, 742, true, 'QrCode'),
(343, 'Mobile โหลดสินค้า - ทำเสร็จ', 'mobile.loading.complete', 'ยืนยันโหลดเสร็จ', 300, 743, true, 'CheckCircle'),

-- Mobile Face Sheet (351-359)
(351, 'Mobile ใบปะหน้า - ดู', 'mobile.face_sheet.view', 'ดูงานใบปะหน้า', 300, 751, true, 'Eye'),
(352, 'Mobile ใบปะหน้า - สแกน', 'mobile.face_sheet.scan', 'สแกนหยิบใบปะหน้า', 300, 752, true, 'QrCode'),
(353, 'Mobile ใบปะหน้า - ยืนยัน', 'mobile.face_sheet.confirm', 'ยืนยันหยิบเสร็จ', 300, 753, true, 'CheckCircle'),

-- Mobile Bonus Face Sheet (361-369)
(361, 'Mobile ของแถม - ดู', 'mobile.bonus_face_sheet.view', 'ดูงานของแถม', 300, 761, true, 'Eye'),
(362, 'Mobile ของแถม - สแกน', 'mobile.bonus_face_sheet.scan', 'สแกนหยิบของแถม', 300, 762, true, 'QrCode'),
(363, 'Mobile ของแถม - ยืนยัน', 'mobile.bonus_face_sheet.confirm', 'ยืนยันหยิบเสร็จ', 300, 763, true, 'CheckCircle')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order;

-- ===========================================
-- Master Data Module (Module ID: 400-549)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
-- Parent
(400, 'ข้อมูลหลัก', 'master', 'โมดูลข้อมูลหลัก', NULL, 800, true, 'Settings'),

-- Products (401-406)
(401, 'สินค้า - ดู', 'master.products.view', 'ดูข้อมูลสินค้า', 400, 801, true, 'Eye'),
(402, 'สินค้า - สร้าง', 'master.products.create', 'สร้างสินค้าใหม่', 400, 802, true, 'Plus'),
(403, 'สินค้า - แก้ไข', 'master.products.edit', 'แก้ไขข้อมูลสินค้า', 400, 803, true, 'Edit'),
(404, 'สินค้า - ลบ', 'master.products.delete', 'ลบสินค้า', 400, 804, true, 'Trash2'),
(405, 'สินค้า - นำเข้า', 'master.products.import', 'นำเข้าข้อมูลสินค้า', 400, 805, true, 'Upload'),
(406, 'สินค้า - ส่งออก', 'master.products.export', 'ส่งออกข้อมูลสินค้า', 400, 806, true, 'Download'),

-- BOM (411-414)
(411, 'BOM - ดู', 'master.bom.view', 'ดูข้อมูล BOM', 400, 811, true, 'Eye'),
(412, 'BOM - สร้าง', 'master.bom.create', 'สร้าง BOM ใหม่', 400, 812, true, 'Plus'),
(413, 'BOM - แก้ไข', 'master.bom.edit', 'แก้ไข BOM', 400, 813, true, 'Edit'),
(414, 'BOM - ลบ', 'master.bom.delete', 'ลบ BOM', 400, 814, true, 'Trash2'),

-- Warehouses (421-424)
(421, 'คลังสินค้า - ดู', 'master.warehouses.view', 'ดูข้อมูลคลัง', 400, 821, true, 'Eye'),
(422, 'คลังสินค้า - สร้าง', 'master.warehouses.create', 'สร้างคลังใหม่', 400, 822, true, 'Plus'),
(423, 'คลังสินค้า - แก้ไข', 'master.warehouses.edit', 'แก้ไขข้อมูลคลัง', 400, 823, true, 'Edit'),
(424, 'คลังสินค้า - ลบ', 'master.warehouses.delete', 'ลบคลัง', 400, 824, true, 'Trash2'),

-- Locations (431-435)
(431, 'โลเคชั่น - ดู', 'master.locations.view', 'ดูข้อมูลโลเคชั่น', 400, 831, true, 'Eye'),
(432, 'โลเคชั่น - สร้าง', 'master.locations.create', 'สร้างโลเคชั่นใหม่', 400, 832, true, 'Plus'),
(433, 'โลเคชั่น - แก้ไข', 'master.locations.edit', 'แก้ไขโลเคชั่น', 400, 833, true, 'Edit'),
(434, 'โลเคชั่น - ลบ', 'master.locations.delete', 'ลบโลเคชั่น', 400, 834, true, 'Trash2'),
(435, 'โลเคชั่น - นำเข้า', 'master.locations.import', 'นำเข้าโลเคชั่น', 400, 835, true, 'Upload'),

-- Storage Strategy (441-444)
(441, 'กลยุทธ์การเก็บ - ดู', 'master.storage_strategy.view', 'ดูกลยุทธ์', 400, 841, true, 'Eye'),
(442, 'กลยุทธ์การเก็บ - สร้าง', 'master.storage_strategy.create', 'สร้างกลยุทธ์', 400, 842, true, 'Plus'),
(443, 'กลยุทธ์การเก็บ - แก้ไข', 'master.storage_strategy.edit', 'แก้ไขกลยุทธ์', 400, 843, true, 'Edit'),
(444, 'กลยุทธ์การเก็บ - ลบ', 'master.storage_strategy.delete', 'ลบกลยุทธ์', 400, 844, true, 'Trash2'),

-- Preparation Area (451-454)
(451, 'บ้านหยิบ - ดู', 'master.preparation_area.view', 'ดูพื้นที่จัดเตรียม', 400, 851, true, 'Eye'),
(452, 'บ้านหยิบ - สร้าง', 'master.preparation_area.create', 'สร้างพื้นที่จัดเตรียม', 400, 852, true, 'Plus'),
(453, 'บ้านหยิบ - แก้ไข', 'master.preparation_area.edit', 'แก้ไขพื้นที่จัดเตรียม', 400, 853, true, 'Edit'),
(454, 'บ้านหยิบ - ลบ', 'master.preparation_area.delete', 'ลบพื้นที่จัดเตรียม', 400, 854, true, 'Trash2'),

-- Suppliers (461-464)
(461, 'ซัพพลายเออร์ - ดู', 'master.suppliers.view', 'ดูข้อมูลซัพพลายเออร์', 400, 861, true, 'Eye'),
(462, 'ซัพพลายเออร์ - สร้าง', 'master.suppliers.create', 'สร้างซัพพลายเออร์', 400, 862, true, 'Plus'),
(463, 'ซัพพลายเออร์ - แก้ไข', 'master.suppliers.edit', 'แก้ไขซัพพลายเออร์', 400, 863, true, 'Edit'),
(464, 'ซัพพลายเออร์ - ลบ', 'master.suppliers.delete', 'ลบซัพพลายเออร์', 400, 864, true, 'Trash2'),

-- Customers (471-475)
(471, 'ลูกค้า - ดู', 'master.customers.view', 'ดูข้อมูลลูกค้า', 400, 871, true, 'Eye'),
(472, 'ลูกค้า - สร้าง', 'master.customers.create', 'สร้างลูกค้า', 400, 872, true, 'Plus'),
(473, 'ลูกค้า - แก้ไข', 'master.customers.edit', 'แก้ไขลูกค้า', 400, 873, true, 'Edit'),
(474, 'ลูกค้า - ลบ', 'master.customers.delete', 'ลบลูกค้า', 400, 874, true, 'Trash2'),
(475, 'ลูกค้า - จัดการพิกัด', 'master.customers.update_coordinates', 'อัปเดตพิกัดลูกค้า', 400, 875, true, 'MapPin'),

-- Vehicles (481-484)
(481, 'ยานพาหนะ - ดู', 'master.vehicles.view', 'ดูข้อมูลรถ', 400, 881, true, 'Eye'),
(482, 'ยานพาหนะ - สร้าง', 'master.vehicles.create', 'สร้างรถใหม่', 400, 882, true, 'Plus'),
(483, 'ยานพาหนะ - แก้ไข', 'master.vehicles.edit', 'แก้ไขข้อมูลรถ', 400, 883, true, 'Edit'),
(484, 'ยานพาหนะ - ลบ', 'master.vehicles.delete', 'ลบรถ', 400, 884, true, 'Trash2'),

-- Users (491-494)
(491, 'ผู้ใช้งาน - ดู', 'master.users.view', 'ดูข้อมูลผู้ใช้', 400, 891, true, 'Eye'),
(492, 'ผู้ใช้งาน - สร้าง', 'master.users.create', 'สร้างผู้ใช้ใหม่', 400, 892, true, 'Plus'),
(493, 'ผู้ใช้งาน - แก้ไข', 'master.users.edit', 'แก้ไขผู้ใช้', 400, 893, true, 'Edit'),
(494, 'ผู้ใช้งาน - ลบ', 'master.users.delete', 'ลบผู้ใช้', 400, 894, true, 'Trash2'),

-- Roles (501-505)
(501, 'บทบาท - ดู', 'master.roles.view', 'ดูข้อมูลบทบาท', 400, 901, true, 'Eye'),
(502, 'บทบาท - สร้าง', 'master.roles.create', 'สร้างบทบาทใหม่', 400, 902, true, 'Plus'),
(503, 'บทบาท - แก้ไข', 'master.roles.edit', 'แก้ไขบทบาท', 400, 903, true, 'Edit'),
(504, 'บทบาท - ลบ', 'master.roles.delete', 'ลบบทบาท', 400, 904, true, 'Trash2'),
(505, 'บทบาท - จัดการสิทธิ์', 'master.roles.manage_permissions', 'กำหนดสิทธิ์ให้บทบาท', 400, 905, true, 'Shield'),

-- Employees (511-514)
(511, 'พนักงาน - ดู', 'master.employees.view', 'ดูข้อมูลพนักงาน', 400, 911, true, 'Eye'),
(512, 'พนักงาน - สร้าง', 'master.employees.create', 'สร้างพนักงานใหม่', 400, 912, true, 'Plus'),
(513, 'พนักงาน - แก้ไข', 'master.employees.edit', 'แก้ไขพนักงาน', 400, 913, true, 'Edit'),
(514, 'พนักงาน - ลบ', 'master.employees.delete', 'ลบพนักงาน', 400, 914, true, 'Trash2')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order;

-- Reset sequence
SELECT setval('master_permission_module_module_id_seq', (SELECT MAX(module_id) + 1 FROM master_permission_module), false);

-- สรุปผลการ insert (ส่วนที่ 2)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM master_permission_module;
  RAISE NOTICE '=== Permission Modules Inserted (Part 2) ===';
  RAISE NOTICE 'Total permission modules: %', v_count;
  RAISE NOTICE 'Modules added: Stock Management, Mobile, Master Data';
  RAISE NOTICE 'Permission structure complete!';
END $$;
