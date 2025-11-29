-- ============================================================================
-- COMPLETE DATABASE SCHEMA DOCUMENTATION
-- Generated: 2025-11-29
-- Purpose: Complete reference of current database structure for AI understanding
-- ============================================================================
-- This file documents the ACTUAL current state of the database.
-- It is NOT meant to be executed as a migration.
-- Use this as a reference for understanding the complete database schema.
-- ============================================================================

-- ENUMS
-- ============================================================================
CREATE TYPE sku_status AS ENUM ('active', 'inactive');
CREATE TYPE receive_type_enum AS ENUM ('ปกติ', 'gen_pallet', 'no_pallet', 'foreign_gen_pallet', 'foreign_scan_pallet', 'สิ้นเปลือง', 'ส่งคืน', 'เสียหาย', 'การผลิต', 'รับสินค้าปกติ', 'รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าคืน', 'รับสินค้าตีกลับ');
CREATE TYPE receive_status_enum AS ENUM ('ร่าง', 'ได้รับ', 'เก็บเข้าคลัง', 'ปิด', 'ยกเลิก', 'รอรับเข้า', 'รับเข้าแล้ว', 'กำลังตรวจสอบ', 'สำเร็จ');
CREATE TYPE pallet_scan_status_enum AS ENUM ('ไม่จำเป็น', 'สแกนแล้ว', 'รอดำเนินการ');
CREATE TYPE product_status_enum AS ENUM ('ปกติ', 'ชำรุด', 'หมดอายุ', 'คืนสินค้า');
CREATE TYPE move_type_enum AS ENUM ('putaway', 'transfer', 'replenishment', 'adjustment');
CREATE TYPE move_status_enum AS ENUM ('draft', 'pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE move_item_status_enum AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE move_method_enum AS ENUM ('pallet', 'sku');
CREATE TYPE move_created_source_enum AS ENUM ('system', 'manual');
CREATE TYPE assignment_type_enum AS ENUM ('individual', 'role', 'mixed');
CREATE TYPE wms_role_enum AS ENUM ('supervisor', 'operator', 'picker', 'driver', 'forklift', 'other');
CREATE TYPE movement_direction_enum AS ENUM ('in', 'out');
CREATE TYPE order_type_enum AS ENUM ('route_planning', 'express', 'blank', 'special');
CREATE TYPE payment_type_enum AS ENUM ('credit', 'cash');
CREATE TYPE order_status_enum AS ENUM ('draft', 'confirmed', 'in_picking', 'picked', 'loaded', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE delivery_type_enum AS ENUM ('normal', 'express', 'ems', 'kerry', 'flash_express', 'j_and_t', 'dhl', 'other');
CREATE TYPE receiving_route_plan_status_enum AS ENUM ('draft', 'optimizing', 'published', 'completed', 'cancelled', 'ready_to_load', 'in_transit', 'pending_approval', 'approved');
CREATE TYPE receiving_route_trip_status_enum AS ENUM ('planned', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE receiving_route_stop_type_enum AS ENUM ('start', 'pickup', 'dropoff', 'break', 'checkpoint', 'end');
CREATE TYPE receiving_route_stop_status_enum AS ENUM ('pending', 'en_route', 'arrived', 'completed', 'skipped');
CREATE TYPE picklist_status_enum AS ENUM ('pending', 'assigned', 'picking', 'completed', 'cancelled');
CREATE TYPE picklist_item_status_enum AS ENUM ('pending', 'picked', 'shortage', 'substituted');
CREATE TYPE loadlist_status_enum AS ENUM ('pending', 'loaded', 'cancelled');
CREATE TYPE load_list_status_enum AS ENUM ('draft', 'pending', 'loading', 'completed', 'cancelled');
CREATE TYPE storage_rotation_method_enum AS ENUM ('FIFO', 'LIFO', 'FEFO', 'LEFO', 'custom');
CREATE TYPE storage_strategy_status_enum AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE storage_scope_type_enum AS ENUM ('all', 'zone', 'location_type', 'aisle', 'rack', 'shelf', 'bin', 'group', 'location');
CREATE TYPE storage_condition_type_enum AS ENUM ('sku', 'category', 'sub_category', 'brand', 'product_type', 'storage_class', 'abc_class');
CREATE TYPE storage_mix_policy_enum AS ENUM ('single_batch', 'same_expiry', 'same_lot', 'allow_mix');
CREATE TYPE preparation_priority_enum AS ENUM ('normal', 'urgent', 'high');
CREATE TYPE preparation_order_status_enum AS ENUM ('draft', 'pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE preparation_item_status_enum AS ENUM ('pending', 'assigned', 'picking', 'picked', 'cancelled');
CREATE TYPE replenishment_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE replenishment_rule_status AS ENUM ('active', 'inactive');
CREATE TYPE replenishment_queue_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE stock_alert_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE production_plan_status AS ENUM ('draft', 'approved', 'in_production', 'completed', 'cancelled');
CREATE TYPE production_order_status AS ENUM ('planned', 'released', 'in_progress', 'completed', 'on_hold', 'cancelled');
CREATE TYPE production_item_status AS ENUM ('pending', 'issued', 'returned');
CREATE TYPE material_requirement_status AS ENUM ('needed', 'ordered', 'received', 'issued', 'cancelled');
CREATE TYPE material_issue_status AS ENUM ('issued', 'returned', 'partially_returned', 'fully_returned', 'cancelled');
CREATE TYPE prefix_enum AS ENUM ('Mr', 'Mrs', 'Ms', 'อื่นๆ');
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
CREATE TYPE employment_type_enum AS ENUM ('permanent', 'contract', 'part-time', 'temporary');
CREATE TYPE shift_type_enum AS ENUM ('day', 'night', 'rotating');

-- MASTER DATA TABLES
-- ============================================================================

-- Master SKU (Products)
-- Contains all product information including dimensions, storage requirements
COMMENT ON TABLE master_sku IS 'ตารางข้อมูล SKU หลักสำหรับระบบ WMS - เก็บข้อมูลรายละเอียดสินค้าทั้งหมด';

-- Master Warehouse
-- Warehouse locations and capacity information
COMMENT ON TABLE master_warehouse IS 'Master warehouse table storing warehouse information';

-- Master Location
-- Storage locations within warehouses (racks, floors, receiving areas, dispatch areas)
COMMENT ON TABLE master_location IS 'ข้อมูลตำแหน่งจัดเก็บสินค้าในคลัง รวมพื้นที่รับสินค้า (receiving)';

-- Master Supplier
-- Supplier and service provider information
COMMENT ON TABLE master_supplier IS 'Master supplier table storing supplier/vendor information';

-- Master Customer
-- Customer information for order management
COMMENT ON TABLE master_customer IS 'Master customer table storing customer information for order management';

-- Master Vehicle
-- Fleet management - vehicles used for transportation
COMMENT ON TABLE master_vehicle IS 'Master table for storing vehicle information';

-- Master Employee
-- Employee information with WMS roles
COMMENT ON TABLE master_employee IS 'พนักงานทั้งหมดในระบบ รวมข้อมูล WMS role และสิทธิ์การเข้าถึงคลัง';

-- Master Freight Rate
-- Transportation pricing and routes
COMMENT ON TABLE master_freight_rate IS 'Master table for freight transportation rates and pricing';

-- INBOUND OPERATIONS
-- ============================================================================

-- WMS Receives (Header)
-- Goods receipt documents
COMMENT ON TABLE wms_receives IS 'Header table for goods receipt documents';

-- WMS Receive Items (Details)
-- Line items for goods receipts
COMMENT ON TABLE wms_receive_items IS 'Line items for goods receipt documents';

-- INVENTORY MANAGEMENT
-- ============================================================================

-- WMS Inventory Balances
-- Current stock levels by location, SKU, pallet
COMMENT ON TABLE wms_inventory_balances IS 'Inventory balances - rebuilt after fixing ledger dates on 2025-01-22';

-- WMS Inventory Ledger
-- All inventory movements (transactions log)
COMMENT ON TABLE wms_inventory_ledger IS 'Inventory ledger - dates fixed on 2025-01-22';

-- WAREHOUSE MOVEMENTS
-- ============================================================================

-- WMS Moves (Header)
-- Move orders for putaway, transfer, replenishment
COMMENT ON TABLE wms_moves IS 'หัวข้อใบงานย้ายสินค้า (Move Orders)';

-- WMS Move Items (Details)
-- Individual items to be moved
COMMENT ON TABLE wms_move_items IS 'รายละเอียดรายการสินค้าที่ต้องย้ายในแต่ละใบงาน';

-- OUTBOUND OPERATIONS - ORDERS
-- ============================================================================

-- WMS Orders (Header)
-- Sales orders for picking and shipping
COMMENT ON TABLE wms_orders IS 'ตารางหลักสำหรับคำสั่งขาย รองรับทั้งประเภทต้องจัดสายรถ และประเภทส่งด่วน';

-- WMS Order Items (Details)
-- Line items in sales orders
COMMENT ON TABLE wms_order_items IS 'ตารางรายการสินค้าในคำสั่งขาย';

-- ROUTE PLANNING & OPTIMIZATION
-- ============================================================================

-- Receiving Route Plans
-- Master route planning documents
COMMENT ON TABLE receiving_route_plans IS 'หัวตารางแผนเส้นทางรับสินค้า ใช้เก็บการตั้งค่าและผลลัพธ์รวมของการจัดเส้นทางแบบ VRP (Updated: 2025-11-10)';

-- Receiving Route Plan Inputs
-- Input data for route optimization
COMMENT ON TABLE receiving_route_plan_inputs IS 'ข้อมูลดิบสำหรับจุดรับสินค้าที่ต้องนำไปจัดเส้นทางในแต่ละแผน';

-- Receiving Route Clusters
-- Geographic clustering results
COMMENT ON TABLE receiving_route_clusters IS 'ผลลัพธ์การจัดกลุ่มพื้นที่ (cluster first) ก่อนสร้างเส้นทาง รายงาน centroid และ KPI ของแต่ละโซน';

-- Receiving Route Trips
-- Individual vehicle trips
COMMENT ON TABLE receiving_route_trips IS 'ตารางเที่ยวรถในแผนเส้นทางรับสินค้า (Updated: 2025-11-10)';

-- Receiving Route Stops
-- Stops within each trip
COMMENT ON TABLE receiving_route_stops IS 'ตารางจุดแวะในเส้นทางรับสินค้า (Updated: 2025-11-10)';

-- Receiving Route Stop Items
-- Items allocated to each stop
COMMENT ON TABLE receiving_route_stop_items IS 'รายการสินค้าที่จัดสรรให้แต่ละจุดหยุด';

-- PICKING OPERATIONS
-- ============================================================================

-- Picklists (Header)
-- Pick lists generated from trips
COMMENT ON TABLE picklists IS 'ตารางหลักสำหรับใบจัดสินค้า (Picklist Header) อ้างอิงตามเที่ยวรถ';

-- Picklist Items (Details)
-- Items to be picked
COMMENT ON TABLE picklist_items IS 'ตารางรายการสินค้าที่ต้องจัดในแต่ละใบจัด (Picklist Details)';

-- LOADING OPERATIONS
-- ============================================================================

-- Loadlists (Header)
-- Loading lists for vehicle departure
COMMENT ON TABLE loadlists IS 'ใบขึ้นรถสำหรับการจัดส่ง';

-- Loadlist Items
-- Orders loaded on vehicle
COMMENT ON TABLE loadlist_items IS 'รายการ Orders ที่ขึ้นรถ';

-- WMS Loadlist Picklists (Junction)
-- Links picklists to loadlists
COMMENT ON TABLE wms_loadlist_picklists IS 'ตารางเชื่อมระหว่าง loadlists และ picklists (junction table)';

-- FACE SHEETS & PACKING
-- ============================================================================

-- Face Sheets
-- Delivery labels for packages
COMMENT ON TABLE face_sheets IS 'ตารางหลักสำหรับใบปะหน้าสินค้า (Face Sheets)';

-- Face Sheet Packages
-- Individual packages
COMMENT ON TABLE face_sheet_packages IS 'ตารางแพ็คสินค้าแต่ละแพ็คในใบปะหน้า';

-- Face Sheet Items
-- Items in each package
COMMENT ON TABLE face_sheet_items IS 'ตารางรายการสินค้าในแต่ละแพ็ค';

-- Bonus Face Sheets
-- Special delivery labels for bonus/promotional items
COMMENT ON TABLE bonus_face_sheets IS 'ตารางหลักสำหรับใบปะหน้าของแถม (Bonus Face Sheets) - ใช้กับ wms_orders ที่ order_type = special';

-- STORAGE STRATEGY
-- ============================================================================

-- Storage Strategy
-- Putaway and storage rules
COMMENT ON TABLE storage_strategy IS 'กลยุทธ์การจัดเก็บสินค้าตามคลัง';

-- Storage Strategy Scope
-- Where strategies apply
COMMENT ON TABLE storage_strategy_scope IS 'ขอบเขตการใช้งาน strategy (zone, location type, specific locations)';

-- Storage Strategy Conditions
-- When strategies apply
COMMENT ON TABLE storage_strategy_conditions IS 'เงื่อนไขการใช้ strategy (SKU, category, brand, etc.)';

-- Location Groups
-- Grouping locations for strategy assignment
COMMENT ON TABLE location_group IS 'กลุ่มรวมตำแหน่งจัดเก็บเพื่อผูก strategy เป็นชุด';

-- PREPARATION AREAS
-- ============================================================================

-- Preparation Area
-- Zones for order preparation, packing, QC
COMMENT ON TABLE preparation_area IS 'พื้นที่จัดเตรียมสินค้า เช่น พื้นที่บรรจุภัณฑ์, พื้นที่ตรวจสอบคุณภาพ, พื้นที่รวมสินค้า';

-- Preparation Orders
-- Work orders for preparation areas
COMMENT ON TABLE preparation_order IS 'ใบจัดเตรียมสินค้า';

-- Preparation Order Items
-- Items in preparation orders
COMMENT ON TABLE preparation_order_item IS 'รายการสินค้าในใบจัดเตรียมสินค้า';

-- REPLENISHMENT
-- ============================================================================

-- Replenishment Rules
-- Auto-replenishment triggers
COMMENT ON TABLE replenishment_rules IS 'กฎการเติมสต็อกอัตโนมัติสำหรับแต่ละ SKU ในแต่ละโซนเบิก';

-- Replenishment Queue
-- Pending replenishment tasks
COMMENT ON TABLE replenishment_queue IS 'คิวงานเติมสต็อกที่รอดำเนินการ';

-- Stock Replenishment Alerts
-- Low stock alerts for pick faces
COMMENT ON TABLE wms_stock_replenishment_alerts IS 'ตารางแจ้งเตือนการเติมสต็อกในพื้นที่หยิบสินค้า';

-- PRODUCTION MANAGEMENT
-- ============================================================================

-- BOM (Bill of Materials)
-- Product recipes and formulas
COMMENT ON TABLE bom_sku IS 'Bill of Materials (BOM) table storing material requirements and production steps';

-- Production Plans
-- Master production schedule
COMMENT ON TABLE production_plan IS 'แผนการผลิตหลัก (Master Production Schedule) - กำหนดสินค้าที่จะผลิตในแต่ละช่วงเวลา';

-- Production Plan Items
-- Products to produce in each plan
COMMENT ON TABLE production_plan_items IS 'รายการสินค้าที่ต้องการผลิตในแต่ละแผนการผลิต';

-- Material Requirements
-- MRP calculation results
COMMENT ON TABLE material_requirements IS 'ความต้องการวัตถุดิบที่คำนวณจาก BOM explosion สำหรับแต่ละแผนการผลิต';

-- Production Orders
-- Work orders for production
COMMENT ON TABLE production_orders IS 'คำสั่งผลิตสินค้า';

-- Production Order Items
-- Materials needed for production
COMMENT ON TABLE production_order_items IS 'รายการวัตถุดิบที่ต้องใช้ในการผลิต';

-- Material Issues
-- Material issuance to production
COMMENT ON TABLE material_issues IS 'บันทึกการจ่ายวัตถุดิบเข้าสู่การผลิต';

-- Material Issue Items
-- Detailed material issuance records
COMMENT ON TABLE material_issue_items IS 'รายการวัตถุดิบที่เบิกแต่ละรายการ';

-- Material Returns
-- Unused material returns
COMMENT ON TABLE material_returns IS 'การคืนวัตถุดิบที่เหลือจากการผลิต';

-- Material Return Items
-- Detailed return records
COMMENT ON TABLE material_return_items IS 'รายการวัตถุดิบที่คืนแต่ละรายการ';

-- Production Receipts
-- Finished goods receipts from production
COMMENT ON TABLE production_receipts IS 'บันทึกการรับสินค้าสำเร็จรูปจากการผลิต';

-- Production Logs
-- Audit trail for production activities
COMMENT ON TABLE production_logs IS 'บันทึกกิจกรรมและการเปลี่ยนแปลง';

-- PROCUREMENT
-- ============================================================================

-- Purchase Orders
-- Purchase orders for materials
COMMENT ON TABLE purchase_orders IS 'ตารางเก็บข้อมูลใบสั่งซื้อวัตถุดิบ';

-- Purchase Order Items
-- Items in purchase orders
COMMENT ON TABLE purchase_order_items IS 'ตารางเก็บรายการสินค้าในใบสั่งซื้อ';

-- USER MANAGEMENT & SECURITY
-- ============================================================================

-- Master System Users
-- System user accounts
COMMENT ON TABLE master_system_user IS 'ตารางข้อมูลผู้ใช้งานระบบ';

-- Master System Roles
-- User roles
COMMENT ON TABLE master_system_role IS 'ตารางกลุ่มสิทธิ์ผู้ใช้งาน';

-- User Roles (Junction)
-- User-role assignments
COMMENT ON TABLE user_role IS 'ตารางเชื่อมโยงผู้ใช้กับ Role';

-- Permission Modules
-- Available system modules
COMMENT ON TABLE master_permission_module IS 'ตารางโมดูล/ฟีเจอร์ที่ต้องกำหนดสิทธิ์';

-- Role Permissions
-- Module permissions per role
COMMENT ON TABLE role_permission IS 'ตารางกำหนดสิทธิ์ต่อ Role และต่อโมดูล';

-- DOCUMENT MANAGEMENT
-- ============================================================================

-- IV Document Types
-- Invoice document type configurations
COMMENT ON TABLE master_iv_document_type IS 'Master table for invoice document types and their configurations';

-- Customer No Price Goods
-- Customers requiring products without price labels
COMMENT ON TABLE master_customer_no_price_goods IS 'Master table for customers who require products without price labels';

-- File Uploads
-- Uploaded file tracking
COMMENT ON TABLE file_uploads IS 'ตารางสำหรับจัดเก็บข้อมูลไฟล์ที่อัปโหลดเข้าระบบ';

-- Import Jobs
-- Data import job tracking
COMMENT ON TABLE import_jobs IS 'ตารางสำหรับติดตามสถานะการนำเข้าข้อมูล';

-- Export Jobs
-- Data export job tracking
COMMENT ON TABLE export_jobs IS 'ตารางสำหรับติดตามสถานะการส่งออกข้อมูล';

-- STOCK IMPORT (Legacy System Migration)
-- ============================================================================

-- Stock Import Batches
-- Batch tracking for stock imports
COMMENT ON TABLE wms_stock_import_batches IS 'ตารางติดตาม batch การนำเข้าสต็อกจากระบบเก่า';

-- Stock Import Staging
-- Staging area for import validation
COMMENT ON TABLE wms_stock_import_staging IS 'ตาราง staging สำหรับเก็บข้อมูลก่อนนำเข้าจริง';

-- DASHBOARD & CALENDAR
-- ============================================================================

-- Dashboard Calendar Events
-- Calendar events for dashboard
COMMENT ON TABLE dashboard_calendar_events IS 'ตารางเก็บข้อมูลกิจกรรมในปฏิทินหน้า Dashboard';

-- Dashboard Calendar Attendees
-- Event attendees
COMMENT ON TABLE dashboard_calendar_attendees IS 'ตารางเก็บพนักงานที่เกี่ยวข้องกับกิจกรรมในปฏิทิน Dashboard';

-- ONLINE PACKING SYSTEM (Separate Module)
-- ============================================================================
-- This is a separate packing management system for e-commerce orders
-- Tables: packing_products, packing_boxes, packing_rules, packing_orders, etc.

-- KEY RELATIONSHIPS
-- ============================================================================
-- 1. Orders → Route Planning → Trips → Stops → Picklists → Loadlists
-- 2. Receives → Move Orders → Inventory Balances/Ledger
-- 3. Production Plans → Production Orders → Material Issues → Inventory
-- 4. SKU → Storage Strategy → Locations → Inventory Balances
-- 5. Picklists → Replenishment Alerts → Replenishment Queue → Move Orders

-- IMPORTANT NOTES
-- ============================================================================
-- 1. Primary language is Thai for UI and comments
-- 2. Inventory tracking uses both pack_qty and piece_qty
-- 3. Pallet tracking with both internal (pallet_id) and external (pallet_id_external) IDs
-- 4. FEFO/FIFO rotation supported via production_date and expiry_date
-- 5. Multi-warehouse support with location hierarchy
-- 6. RLS (Row Level Security) enabled on selected tables
-- 7. Triggers maintain inventory balances automatically
-- 8. Enum types enforce data consistency

-- CURRENT MIGRATION VERSION: 20251128102332 (add_picklist_assign_trigger)

-- ============================================================================
-- IMPORTANT: TRIGGERS AND AUTOMATION
-- ============================================================================
-- ⚠️ WARNING: The following triggers exist in the database and may conflict with API logic
-- Consider disabling these triggers if your API handles these operations:

-- WORKFLOW STATUS TRIGGERS (from migration 027, 044):
-- 1. trigger_route_publish_update_orders - Auto updates orders when route published
-- 2. trigger_picklist_create_update_orders - Auto updates orders when picklist created
-- 3. trigger_picklist_complete_update_orders_and_route - Auto updates on picklist complete
-- 4. trigger_loadlist_complete_update_orders - Auto updates orders when loadlist loaded
-- 5. trigger_delivery_update_route - Auto updates route when order delivered

-- INVENTORY TRIGGERS (from migrations 004, 007, 015):
-- 1. trg_sync_inventory_ledger_to_balance - Auto syncs ledger to balance
-- 2. trg_create_ledger_from_receive_insert - Auto creates ledger on receive
-- 3. trg_update_ledger_from_receive - Auto creates ledger on receive update
-- 4. trg_update_ledger_from_receive_status - Auto creates ledger on status change
-- 5. trg_create_ledger_from_move_insert - Auto creates ledger on move
-- 6. trg_update_ledger_from_move - Auto creates ledger on move update

-- LOCATION QUANTITY TRIGGERS (from migration 023):
-- 1. trg_sync_location_qty_from_balance - Auto updates location current_qty

-- OTHER TRIGGERS:
-- 1. Various updated_at triggers for timestamp management
-- 2. Shipping cost calculation triggers
-- 3. Freight rate calculation triggers

-- TO DISABLE A TRIGGER:
-- DROP TRIGGER IF EXISTS trigger_name ON table_name;

-- TO RE-ENABLE A TRIGGER:
-- See the original migration files in supabase/migrations/

-- ============================================================================
-- DATABASE STATISTICS (as of 2025-11-29)
-- ============================================================================
-- Total Tables: 100+
-- Total Enums: 40+
-- Total Triggers: 20+
-- Total Functions: 30+
-- Extensions Installed: uuid-ossp, pgcrypto, pg_stat_statements, pg_graphql, supabase_vault, pg_trgm

-- ============================================================================
-- MIGRATION HISTORY
-- ============================================================================
-- Latest migrations applied:
-- - 20251120071453: fix_trigger_skip_move_transactions
-- - 20251121045715: add_pallet_options_to_receives
-- - 20251126080050: add_workflow_status_enums
-- - 20251126080536: add_anon_policies_to_loadlists
-- - 20251126083955: disable_rls_for_loadlists
-- - 20251127034019: add_loading_door_to_picklists
-- - 20251127095006: 043_simplify_loadlist_status
-- - 20251128101830: fix_loadlist_triggers
-- - 20251128102332: add_picklist_assign_trigger
