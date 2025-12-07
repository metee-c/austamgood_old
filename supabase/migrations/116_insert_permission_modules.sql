-- ==========================================
-- Migration: Insert All Permission Modules
-- Description: นำเข้า Permission Modules ทั้งหมด 260+ permissions
-- Created: 2025-12-07
-- Author: Claude Code
-- Note: ไฟล์นี้มีขนาดใหญ่ เนื่องจากมี permissions จำนวนมาก
-- ==========================================

-- ลบข้อมูลเก่าทั้งหมด (ถ้ามี) - ระวัง! จะลบ permissions ที่มีอยู่
-- TRUNCATE TABLE role_permission CASCADE;
-- TRUNCATE TABLE master_permission_module RESTART IDENTITY CASCADE;

-- แทนที่จะลบ ให้ใช้ ON CONFLICT DO NOTHING เพื่อไม่ให้ซ้ำ

-- ===========================================
-- Dashboard Module (Module ID: 1-9)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
(1, 'Dashboard', 'dashboard', 'โมดูลแดชบอร์ด', NULL, 100, true, 'LayoutDashboard'),
(2, 'Dashboard - ดูข้อมูล', 'dashboard.view', 'ดูแดชบอร์ดหลัก', 1, 101, true, 'Eye')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  icon = EXCLUDED.icon;

-- ===========================================
-- Production Module (Module ID: 10-19)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
(10, 'จัดการผลิต', 'production', 'โมดูลการจัดการผลิต', NULL, 200, true, 'Factory'),
(11, 'ใบสั่งผลิต - ดู', 'production.orders.view', 'ดูใบสั่งผลิต', 10, 201, true, 'Eye'),
(12, 'ใบสั่งผลิต - สร้าง', 'production.orders.create', 'สร้างใบสั่งผลิตใหม่', 10, 202, true, 'Plus'),
(13, 'ใบสั่งผลิต - แก้ไข', 'production.orders.edit', 'แก้ไขใบสั่งผลิต', 10, 203, true, 'Edit'),
(14, 'ใบสั่งผลิต - ลบ', 'production.orders.delete', 'ลบใบสั่งผลิต', 10, 204, true, 'Trash2'),
(15, 'ใบสั่งผลิต - พิมพ์', 'production.orders.print', 'พิมพ์ใบสั่งผลิต', 10, 205, true, 'Printer')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order;

-- ===========================================
-- Warehouse Management Module (Module ID: 20-69)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
-- Parent
(20, 'จัดการคลังสินค้า', 'warehouse', 'โมดูลจัดการคลังสินค้า', NULL, 300, true, 'Warehouse'),

-- Inbound (21-29)
(21, 'รับสินค้าเข้า - ดู', 'warehouse.inbound.view', 'ดูรายการรับสินค้า', 20, 301, true, 'Eye'),
(22, 'รับสินค้าเข้า - สร้าง', 'warehouse.inbound.create', 'สร้างใบรับสินค้าใหม่', 20, 302, true, 'Plus'),
(23, 'รับสินค้าเข้า - แก้ไข', 'warehouse.inbound.edit', 'แก้ไขใบรับสินค้า', 20, 303, true, 'Edit'),
(24, 'รับสินค้าเข้า - ลบ', 'warehouse.inbound.delete', 'ลบใบรับสินค้า', 20, 304, true, 'Trash2'),
(25, 'รับสินค้าเข้า - สแกน', 'warehouse.inbound.scan', 'สแกนพาเลท/QR Code', 20, 305, true, 'QrCode'),
(26, 'รับสินค้าเข้า - พิมพ์', 'warehouse.inbound.print', 'พิมพ์ฉลากพาเลท', 20, 306, true, 'Printer'),
(27, 'รับสินค้าเข้า - กำหนดโลเคชั่น', 'warehouse.inbound.assign_location', 'กำหนดตำแหน่งจัดเก็บ', 20, 307, true, 'MapPin'),
(28, 'รับสินค้าเข้า - เปลี่ยนสถานะ', 'warehouse.inbound.change_status', 'เปลี่ยนสถานะการรับสินค้า', 20, 308, true, 'RefreshCw'),

-- Transfer (31-39)
(31, 'ย้ายสินค้า - ดู', 'warehouse.transfer.view', 'ดูรายการย้ายสินค้า', 20, 311, true, 'Eye'),
(32, 'ย้ายสินค้า - สร้าง', 'warehouse.transfer.create', 'สร้างใบย้ายสินค้า', 20, 312, true, 'Plus'),
(33, 'ย้ายสินค้า - แก้ไข', 'warehouse.transfer.edit', 'แก้ไขใบย้ายสินค้า', 20, 313, true, 'Edit'),
(34, 'ย้ายสินค้า - ลบ', 'warehouse.transfer.delete', 'ลบใบย้ายสินค้า', 20, 314, true, 'Trash2'),
(35, 'ย้ายสินค้า - มอบหมาย', 'warehouse.transfer.assign', 'มอบหมายงานย้ายสินค้า', 20, 315, true, 'UserCheck'),
(36, 'ย้ายสินค้า - ทำเสร็จ', 'warehouse.transfer.complete', 'ยืนยันย้ายสินค้าเสร็จ', 20, 316, true, 'CheckCircle'),

-- Ledger (41-49)
(41, 'การเคลื่อนไหวสต็อก - ดู', 'warehouse.ledger.view', 'ดูรายการเคลื่อนไหวสต็อก', 20, 321, true, 'Eye'),
(42, 'การเคลื่อนไหวสต็อก - ส่งออก', 'warehouse.ledger.export', 'ส่งออกรายงานการเคลื่อนไหว', 20, 322, true, 'Download'),

-- Balances (51-59)
(51, 'คงเหลือตามโลเคชั่น - ดู', 'warehouse.balances.view', 'ดูยอดคงเหลือ', 20, 331, true, 'Eye'),
(52, 'คงเหลือตามโลเคชั่น - ส่งออก', 'warehouse.balances.export', 'ส่งออกรายงานคงเหลือ', 20, 332, true, 'Download'),
(53, 'คงเหลือตามโลเคชั่น - รีเซ็ตการจอง', 'warehouse.balances.reset_reservations', 'รีเซ็ตจำนวนที่จองไว้', 20, 333, true, 'RefreshCw'),

-- Preparation Area (61-69)
(61, 'สินค้าบ้านหยิบ - ดู', 'warehouse.preparation_area.view', 'ดูสินค้าในบ้านหยิบ', 20, 341, true, 'Eye')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order;

-- ===========================================
-- Order Management Module (Module ID: 100-169)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
-- Parent
(100, 'จัดการออเดอร์', 'orders', 'โมดูลจัดการออเดอร์', NULL, 400, true, 'ShoppingCart'),

-- Orders (101-109)
(101, 'ออเดอร์ - ดู', 'orders.view', 'ดูรายการออเดอร์', 100, 401, true, 'Eye'),
(102, 'ออเดอร์ - สร้าง', 'orders.create', 'สร้างออเดอร์ใหม่', 100, 402, true, 'Plus'),
(103, 'ออเดอร์ - แก้ไข', 'orders.edit', 'แก้ไขออเดอร์', 100, 403, true, 'Edit'),
(104, 'ออเดอร์ - ลบ', 'orders.delete', 'ลบออเดอร์', 100, 404, true, 'Trash2'),
(105, 'ออเดอร์ - นำเข้า', 'orders.import', 'นำเข้าออเดอร์จากไฟล์', 100, 405, true, 'Upload'),
(106, 'ออเดอร์ - ส่งออก', 'orders.export', 'ส่งออกออเดอร์', 100, 406, true, 'Download'),
(107, 'ออเดอร์ - ย้อนกลับ', 'orders.rollback', 'ย้อนกลับสถานะออเดอร์', 100, 407, true, 'RotateCcw'),
(108, 'ออเดอร์ - จัดการพิกัด', 'orders.manage_coordinates', 'จัดการพิกัดที่อยู่ลูกค้า', 100, 408, true, 'MapPin'),

-- Routes (111-119)
(111, 'เส้นทางขนส่ง - ดู', 'routes.view', 'ดูแผนเส้นทาง', 100, 411, true, 'Eye'),
(112, 'เส้นทางขนส่ง - สร้าง', 'routes.create', 'สร้างแผนเส้นทาง', 100, 412, true, 'Plus'),
(113, 'เส้นทางขนส่ง - แก้ไข', 'routes.edit', 'แก้ไขแผนเส้นทาง', 100, 413, true, 'Edit'),
(114, 'เส้นทางขนส่ง - ลบ', 'routes.delete', 'ลบแผนเส้นทาง', 100, 414, true, 'Trash2'),
(115, 'เส้นทางขนส่ง - Optimize', 'routes.optimize', 'ปรับเส้นทางอัตโนมัติ', 100, 415, true, 'Zap'),
(116, 'เส้นทางขนส่ง - เผยแพร่', 'routes.publish', 'เผยแพร่แผนเส้นทาง', 100, 416, true, 'Send'),
(117, 'เส้นทางขนส่ง - จัดการออเดอร์', 'routes.manage_orders', 'เพิ่ม/ลบออเดอร์ในเส้นทาง', 100, 417, true, 'List'),

-- Picklists (121-129)
(121, 'ใบหยิบสินค้า - ดู', 'picklists.view', 'ดูรายการใบหยิบสินค้า', 100, 421, true, 'Eye'),
(122, 'ใบหยิบสินค้า - สร้าง', 'picklists.create', 'สร้างใบหยิบสินค้า', 100, 422, true, 'Plus'),
(123, 'ใบหยิบสินค้า - พิมพ์', 'picklists.print', 'พิมพ์ใบหยิบสินค้า', 100, 423, true, 'Printer'),
(124, 'ใบหยิบสินค้า - มอบหมาย', 'picklists.assign', 'มอบหมายงานหยิบสินค้า', 100, 424, true, 'UserCheck'),
(125, 'ใบหยิบสินค้า - ทำเสร็จ', 'picklists.complete', 'ยืนยันหยิบสินค้าเสร็จ', 100, 425, true, 'CheckCircle'),

-- Face Sheets (131-139)
(131, 'ใบปะหน้า - ดู', 'face_sheets.view', 'ดูใบปะหน้าสินค้า', 100, 431, true, 'Eye'),
(132, 'ใบปะหน้า - สร้าง', 'face_sheets.create', 'สร้างใบปะหน้า', 100, 432, true, 'Plus'),
(133, 'ใบปะหน้า - พิมพ์', 'face_sheets.print', 'พิมพ์ใบปะหน้า', 100, 433, true, 'Printer'),

-- Bonus Face Sheets (141-149)
(141, 'ใบปะหน้าของแถม - ดู', 'bonus_face_sheets.view', 'ดูใบปะหน้าของแถม', 100, 441, true, 'Eye'),
(142, 'ใบปะหน้าของแถม - สร้าง', 'bonus_face_sheets.create', 'สร้างใบปะหน้าของแถม', 100, 442, true, 'Plus'),
(143, 'ใบปะหน้าของแถม - พิมพ์', 'bonus_face_sheets.print', 'พิมพ์ใบปะหน้าของแถม', 100, 443, true, 'Printer'),

-- Loadlists (151-159)
(151, 'ใบโหลดสินค้า - ดู', 'loadlists.view', 'ดูรายการใบโหลด', 100, 451, true, 'Eye'),
(152, 'ใบโหลดสินค้า - สร้าง', 'loadlists.create', 'สร้างใบโหลด', 100, 452, true, 'Plus'),
(153, 'ใบโหลดสินค้า - สแกน', 'loadlists.scan', 'สแกนออเดอร์ใส่ใบโหลด', 100, 453, true, 'QrCode'),
(154, 'ใบโหลดสินค้า - ออกจากคลัง', 'loadlists.depart', 'ยืนยันออกจากคลัง', 100, 454, true, 'Send'),

-- Auto Replenishment (161-169)
(161, 'เบิกเติมอัตโนมัติ - ดู', 'replenishment.view', 'ดูรายการเบิกเติม', 100, 461, true, 'Eye'),
(162, 'เบิกเติมอัตโนมัติ - ดำเนินการ', 'replenishment.execute', 'ดำเนินการเบิกเติม', 100, 462, true, 'PlayCircle')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description,
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order;

-- ===========================================
-- Shipping Module (Module ID: 170-179)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
(170, 'ส่งสินค้า', 'shipping', 'โมดูลส่งสินค้า', NULL, 500, true, 'Send'),
(171, 'ส่งสินค้า - ดู', 'shipping.view', 'ดูรายการส่งสินค้า', 170, 501, true, 'Eye'),
(172, 'ส่งสินค้า - สร้าง', 'shipping.create', 'สร้างใบส่งสินค้า', 170, 502, true, 'Plus'),
(173, 'ส่งสินค้า - แก้ไข', 'shipping.edit', 'แก้ไขใบส่งสินค้า', 170, 503, true, 'Edit'),
(174, 'ส่งสินค้า - ลบ', 'shipping.delete', 'ลบใบส่งสินค้า', 170, 504, true, 'Trash2')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

-- ===========================================
-- Reports Module (Module ID: 180-189)
-- ===========================================
INSERT INTO master_permission_module (module_id, module_name, module_key, description, parent_module_id, display_order, is_active, icon) VALUES
(180, 'รายงาน', 'reports', 'โมดูลรายงาน', NULL, 550, true, 'BarChart3'),
(181, 'รายงาน - ดู', 'reports.view', 'ดูรายงาน', 180, 551, true, 'Eye'),
(182, 'รายงาน - ส่งออก', 'reports.export', 'ส่งออกรายงาน', 180, 552, true, 'Download'),
(183, 'รายงาน - พิมพ์', 'reports.print', 'พิมพ์รายงาน', 180, 553, true, 'Printer')
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

-- จะมีต่อในส่วนถัดไป (Stock Management, Mobile, Master Data, Online Packing)
-- เนื่องจากมี permissions จำนวนมาก

-- Reset sequence
SELECT setval('master_permission_module_module_id_seq', (SELECT MAX(module_id) + 1 FROM master_permission_module), false);

-- สรุปผลการ insert (ส่วนที่ 1)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM master_permission_module;
  RAISE NOTICE '=== Permission Modules Inserted (Part 1) ===';
  RAISE NOTICE 'Total permission modules so far: %', v_count;
  RAISE NOTICE 'Modules covered: Dashboard, Production, Warehouse, Orders, Shipping, Reports';
  RAISE NOTICE 'Next: Stock Management, Mobile, Master Data, Online Packing';
END $$;
