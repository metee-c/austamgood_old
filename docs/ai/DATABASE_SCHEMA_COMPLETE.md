# Database Schema Complete - AustamGood WMS

> เอกสารนี้สร้างจากการ query ฐานข้อมูลจริง 100%
> วันที่สร้าง: 21 ธันวาคม 2025

---

## 1. สรุปภาพรวม (Overview)

| ประเภท | จำนวน |
|--------|-------|
| BASE TABLE | 127 |
| VIEW | 29 |
| ENUM Types | 60+ |
| Foreign Keys | 230+ |

---

## 2. ตารางทั้งหมดจัดกลุ่มตาม Domain

### 2.1 Master Data (ข้อมูลหลัก) - 15 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `master_sku` | 43 | รายการสินค้า/SKU |
| `master_customer` | 29 | ลูกค้า/ร้านค้า |
| `master_location` | 28 | โลเคชั่นจัดเก็บ |
| `master_employee` | 29 | พนักงาน |
| `master_vehicle` | 22 | ยานพาหนะ |
| `master_warehouse` | 14 | คลังสินค้า |
| `master_supplier` | 21 | ซัพพลายเออร์ |
| `master_warehouse_asset` | 22 | ทรัพย์สินคลัง |
| `master_freight_rate` | 19 | อัตราค่าขนส่ง |
| `master_iv_document_type` | 16 | ประเภทเอกสาร IV |
| `master_customer_no_price_goods` | 11 | สินค้าไม่คิดราคา |
| `master_system_user` | 23 | ผู้ใช้งานระบบ |
| `master_system_role` | 7 | บทบาท |
| `master_permission_module` | 9 | โมดูลสิทธิ์ |

### 2.2 WMS Core (ระบบหลัก WMS) - 12 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `wms_orders` | 48 | ออเดอร์ขาย |
| `wms_order_items` | 17 | รายการสินค้าในออเดอร์ |
| `wms_receives` | 19 | ใบรับสินค้า |
| `wms_receive_items` | 21 | รายการรับสินค้า |
| `wms_moves` | 20 | ใบโอนย้าย |
| `wms_move_items` | 33 | รายการโอนย้าย |
| `wms_inventory_balances` | 17 | สต็อกคงเหลือ |
| `wms_inventory_ledger` | 27 | ประวัติการเคลื่อนไหว |
| `wms_stock_adjustments` | 22 | ใบปรับปรุงสต็อก |
| `wms_stock_adjustment_items` | 20 | รายการปรับปรุง |
| `wms_adjustment_reasons` | 10 | เหตุผลปรับปรุง |
| `wms_rollback_audit_logs` | 19 | บันทึกการ Rollback |

### 2.3 Picklist/Face Sheet/Loadlist - 18 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `picklists` | 18 | ใบหยิบสินค้า |
| `picklist_items` | 20 | รายการหยิบ |
| `picklist_item_reservations` | 15 | การสำรองสต็อก Picklist |
| `face_sheets` | 18 | Face Sheet |
| `face_sheet_items` | 21 | รายการ Face Sheet |
| `face_sheet_packages` | 24 | แพ็คเกจ Face Sheet |
| `face_sheet_item_reservations` | 14 | การสำรองสต็อก Face Sheet |
| `bonus_face_sheets` | 17 | Bonus Face Sheet |
| `bonus_face_sheet_items` | 20 | รายการ Bonus |
| `bonus_face_sheet_packages` | 20 | แพ็คเกจ Bonus |
| `bonus_face_sheet_item_reservations` | 14 | การสำรองสต็อก Bonus |
| `loadlists` | 22 | ใบโหลดสินค้า |
| `loadlist_items` | 10 | รายการโหลด |
| `loadlist_face_sheets` | 3 | เชื่อม Loadlist-FaceSheet |
| `loadlist_picklists` | 3 | เชื่อม Loadlist-Picklist |
| `wms_loadlist_picklists` | 9 | เชื่อม WMS Loadlist-Picklist |
| `wms_loadlist_bonus_face_sheets` | 6 | เชื่อม Loadlist-Bonus |

### 2.4 Route Planning (แผนเส้นทาง) - 7 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `receiving_route_plans` | 29 | แผนเส้นทาง |
| `receiving_route_trips` | 46 | เที่ยวรถ |
| `receiving_route_stops` | 48 | จุดจอด |
| `receiving_route_stop_items` | 14 | รายการจุดจอด |
| `receiving_route_clusters` | 14 | กลุ่มเส้นทาง |
| `receiving_route_plan_inputs` | 28 | Input แผนเส้นทาง |
| `receiving_route_plan_metrics` | 14 | Metrics แผนเส้นทาง |

### 2.5 Production (การผลิต) - 11 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `production_orders` | 21 | ใบสั่งผลิต |
| `production_order_items` | 12 | รายการผลิต |
| `production_plan` | 18 | แผนการผลิต |
| `production_plan_items` | 17 | รายการแผน |
| `production_receipts` | 11 | บันทึกผลผลิต |
| `production_logs` | 8 | Log การผลิต |
| `material_issues` | 25 | ใบเบิกวัตถุดิบ |
| `material_issue_items` | 18 | รายการเบิก |
| `material_returns` | 15 | ใบคืนวัตถุดิบ |
| `material_return_items` | 16 | รายการคืน |
| `material_requirements` | 26 | ความต้องการวัตถุดิบ |
| `bom_sku` | 14 | Bill of Materials |

### 2.6 Storage Strategy (กลยุทธ์จัดเก็บ) - 10 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `storage_strategy` | 17 | กลยุทธ์จัดเก็บ |
| `storage_strategy_conditions` | 8 | เงื่อนไขกลยุทธ์ |
| `storage_strategy_scope` | 23 | ขอบเขตกลยุทธ์ |
| `storage_strategy_sku_settings` | 15 | ตั้งค่า SKU |
| `location_group` | 10 | กลุ่มโลเคชั่น |
| `location_group_members` | 4 | สมาชิกกลุ่ม |
| `location_sku_allocation` | 18 | จัดสรร SKU-Location |
| `location_storage_profile` | 18 | Profile โลเคชั่น |
| `sku_storage_profile` | 19 | Profile SKU |
| `sku_incompatibilities` | 5 | SKU ที่เก็บด้วยกันไม่ได้ |

### 2.7 Preparation Area (พื้นที่เตรียม) - 5 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `preparation_area` | 16 | พื้นที่เตรียม |
| `preparation_order` | 22 | ใบเตรียมสินค้า |
| `preparation_order_item` | 16 | รายการเตรียม |
| `sku_preparation_area_mapping` | 17 | Mapping SKU-Area |

### 2.8 Replenishment (เติมสินค้า) - 4 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `replenishment_queue` | 23 | คิวเติมสินค้า |
| `replenishment_rules` | 14 | กฎการเติม |
| `stock_replenishment_alerts` | 17 | แจ้งเตือนเติมสต็อก |
| `wms_stock_replenishment_alerts` | 21 | แจ้งเตือน WMS |

### 2.9 Auth/Permission (ระบบสิทธิ์) - 12 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `role_permission` | 23 | สิทธิ์ตามบทบาท |
| `role_field_permissions` | 8 | สิทธิ์ระดับ Field |
| `user_role` | 4 | บทบาทผู้ใช้ |
| `user_sessions` | 12 | Session ผู้ใช้ |
| `user_data_permissions` | 7 | สิทธิ์ข้อมูล |
| `login_attempts` | 9 | ประวัติ Login |
| `password_reset_tokens` | 7 | Token รีเซ็ตรหัส |
| `permission_groups` | 9 | กลุ่มสิทธิ์ |
| `permission_audit_log` | 11 | Log สิทธิ์ |
| `audit_logs` | 11 | บันทึกการใช้งาน |
| `system_settings` | 8 | ตั้งค่าระบบ |

### 2.10 Packing (แพ็คสินค้า) - 13 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `packing_orders` | 21 | ออเดอร์แพ็ค |
| `packing_order_items` | 11 | รายการแพ็ค |
| `packing_boxes` | 13 | กล่องแพ็ค |
| `packing_box_stocks` | 9 | สต็อกกล่อง |
| `packing_box_stock_history` | 11 | ประวัติกล่อง |
| `packing_history` | 12 | ประวัติแพ็ค |
| `packing_products` | 7 | สินค้าแพ็ค |
| `packing_product_weight_profiles` | 7 | น้ำหนักสินค้า |
| `packing_rules` | 7 | กฎการแพ็ค |
| `packing_users` | 16 | ผู้ใช้แพ็ค |
| `packing_user_permissions` | 15 | สิทธิ์ผู้ใช้แพ็ค |
| `packing_system_menus` | 9 | เมนูระบบแพ็ค |
| `packing_promotion_freebies` | 14 | ของแถมโปรโมชั่น |
| `packing_returns` | 17 | คืนสินค้าแพ็ค |
| `packing_backup_orders` | 19 | Backup ออเดอร์ |

### 2.11 Stock Import (นำเข้าสต็อก) - 2 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `wms_stock_import_batches` | 19 | Batch นำเข้า |
| `wms_stock_import_staging` | 43 | Staging นำเข้า |

### 2.12 Purchase Order (ใบสั่งซื้อ) - 2 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `purchase_orders` | 12 | ใบสั่งซื้อ |
| `purchase_order_items` | 9 | รายการสั่งซื้อ |

### 2.13 Other Tables - 8 ตาราง

| ตาราง | Columns | คำอธิบาย |
|-------|---------|----------|
| `postcodes` | 7 | รหัสไปรษณีย์ |
| `file_uploads` | 8 | ไฟล์อัพโหลด |
| `import_jobs` | 13 | งานนำเข้า |
| `export_jobs` | 11 | งานส่งออก |
| `survey_responses` | 15 | แบบสำรวจ |
| `dashboard_calendar_events` | 10 | ปฏิทิน |
| `dashboard_calendar_attendees` | 5 | ผู้เข้าร่วม |

---

## 3. Views ทั้งหมด (29 Views)

| View | Columns | คำอธิบาย |
|------|---------|----------|
| `active_freight_rates` | 19 | อัตราค่าขนส่งที่ใช้งาน |
| `bonus_face_sheet_summary` | 14 | สรุป Bonus Face Sheet |
| `face_sheet_summary` | 15 | สรุป Face Sheet |
| `loadlist_details_with_face_sheets` | 12 | รายละเอียด Loadlist |
| `v_active_customer_no_price_goods` | 10 | สินค้าไม่คิดราคา |
| `v_active_promotion_freebies` | 10 | ของแถมโปรโมชั่น |
| `v_move_item_assignments` | 23 | การมอบหมายโอนย้าย |
| `v_packing_box_usage_stats` | 7 | สถิติใช้กล่อง |
| `v_packing_user_performance` | 6 | ประสิทธิภาพแพ็ค |
| `v_receiving_route_stop_overview` | 35 | ภาพรวมจุดจอด |
| `v_receiving_route_trip_overview` | 32 | ภาพรวมเที่ยวรถ |
| `v_reservation_accuracy` | 8 | ความแม่นยำการสำรอง |
| `v_rollback_statistics` | 7 | สถิติ Rollback |
| `v_stock_alert_summary` | 7 | สรุปแจ้งเตือนสต็อก |
| `v_stock_control_card_391` | 59 | บัตรควบคุมสต็อก 391 |
| `v_workflow_status_overview` | 9 | ภาพรวม Workflow |
| `vw_active_stock_alerts` | 28 | แจ้งเตือนสต็อก |
| `vw_location_inventory_summary` | 14 | สรุปสต็อกตามโลเคชั่น |
| `vw_material_issue_history` | 12 | ประวัติเบิกวัตถุดิบ |
| `vw_material_issue_summary` | 13 | สรุปเบิกวัตถุดิบ |
| `vw_material_shortage_report` | 23 | รายงานขาดวัตถุดิบ |
| `vw_mrp_summary` | 23 | สรุป MRP |
| `vw_pick_zone_stock_status` | 15 | สถานะสต็อก Pick Zone |
| `vw_preparation_area_utilization` | 15 | การใช้พื้นที่เตรียม |
| `vw_preparation_order_detail` | 25 | รายละเอียดใบเตรียม |
| `vw_preparation_order_summary` | 25 | สรุปใบเตรียม |
| `vw_production_material_shortage` | 11 | ขาดวัตถุดิบผลิต |
| `vw_production_order_summary` | 20 | สรุปใบสั่งผลิต |
| `vw_production_progress` | 15 | ความคืบหน้าผลิต |
| `vw_production_receipt_history` | 13 | ประวัติรับผลผลิต |
| `vw_sku_location_inventory` | 10 | สต็อก SKU-Location |
| `vw_stock_import_batches_summary` | 21 | สรุป Batch นำเข้า |

---

## 4. Enum Types ที่สำคัญ

### 4.1 Order & Status Enums

```sql
-- order_status_enum
'draft', 'confirmed', 'in_picking', 'picked', 'loaded', 'in_transit', 'delivered', 'cancelled'

-- picklist_status_enum
'pending', 'assigned', 'picking', 'completed', 'cancelled', 'voided'

-- picklist_item_status_enum
'pending', 'picked', 'shortage', 'substituted', 'voided'

-- loadlist_status_enum
'pending', 'loaded', 'cancelled', 'voided', 'completed'

-- receive_status_enum
'ร่าง', 'ได้รับ', 'เก็บเข้าคลัง', 'ปิด', 'ยกเลิก', 'รอรับเข้า', 'รับเข้าแล้ว', 'กำลังตรวจสอบ', 'สำเร็จ'
```

### 4.2 Movement & Inventory Enums

```sql
-- movement_direction_enum
'in', 'out'

-- movement_type_enum
'receive', 'putaway', 'pick', 'replenish', 'move', 'cycle_count', 'adjustment', 'damage', 'ship'

-- move_status_enum
'draft', 'pending', 'in_progress', 'completed', 'cancelled'

-- move_type_enum
'putaway', 'transfer', 'replenishment', 'adjustment'

-- stock_status_enum
'available', 'reserved', 'blocked', 'damaged', 'expired', 'quarantine'
```

### 4.3 Production Enums

```sql
-- production_order_status
'planned', 'released', 'in_progress', 'completed', 'on_hold', 'cancelled'

-- production_plan_status
'draft', 'approved', 'in_production', 'completed', 'cancelled'

-- material_issue_status
'issued', 'returned', 'partially_returned', 'fully_returned', 'cancelled'
```

### 4.4 Route Planning Enums

```sql
-- receiving_route_plan_status_enum
'draft', 'optimizing', 'published', 'completed', 'cancelled', 'ready_to_load', 'in_transit', 'pending_approval', 'approved'

-- receiving_route_trip_status_enum
'planned', 'assigned', 'in_progress', 'completed', 'cancelled'

-- receiving_route_stop_status_enum
'pending', 'en_route', 'arrived', 'completed', 'skipped'
```

### 4.5 Location & Storage Enums

```sql
-- location_type_enum
'receiving', 'storage', 'apf_zone', 'pf_zone', 'shipping', 'staging', 'damage', 'qc_hold', 'returns'

-- location_status_enum
'active', 'inactive', 'maintenance', 'blocked'

-- storage_rotation_method_enum
'FIFO', 'LIFO', 'FEFO', 'LEFO', 'custom'

-- storage_mix_policy_enum
'single_batch', 'same_expiry', 'same_lot', 'allow_mix'
```
