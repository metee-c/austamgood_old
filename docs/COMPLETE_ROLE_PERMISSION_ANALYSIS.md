# การวิเคราะห์และออกแบบระบบ Role & Permission แบบครบถ้วน
**วันที่:** 7 ธันวาคม 2025
**สถานะ:** งานวิเคราะห์เชิงลึกระบบ WMS ทั้งหมด

---

## สรุปผลการว

ิเคราะห์

### ภาพรวมระบบ
- **จำนวนหน้าทั้งหมด:** 63 หน้า
- **จำนวน API Endpoints:** 100+ endpoints
- **โมดูลหลัก:** 10 โมดูล
- **ระบบ Permission ปัจจุบัน:** มีโครงสร้างพื้นฐาน แต่ไม่ครอบคลุมฟีเจอร์ใหม่

---

## ส่วนที่ 1: Full Sitemap - โครงสร้างหน้าทั้งหมดในระบบ

### 1.1 Dashboard Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/dashboard` | แดชบอร์ดหลัก | View | `/api/receives/dashboard`, `/api/orders/dashboard` | `dashboard.view` |

### 1.2 Production Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/production/orders` | ใบสั่งผลิต | View, Create, Edit, Delete, Print | `/api/production/orders` | `production.orders.view`, `production.orders.create`, `production.orders.edit`, `production.orders.delete`, `production.orders.print` |

### 1.3 Warehouse Management Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/warehouse/inbound` | รับสินค้าเข้า | View, Create, Edit, Delete, Scan, Print, Change Status, Assign Location | `/api/receives`, `/api/receives/[id]`, `/api/receives/validate-pallet`, `/api/receives/generate-pallet-id`, `/api/receive/update-external-pallet` | `warehouse.inbound.view`, `warehouse.inbound.create`, `warehouse.inbound.edit`, `warehouse.inbound.delete`, `warehouse.inbound.scan`, `warehouse.inbound.print`, `warehouse.inbound.change_status`, `warehouse.inbound.assign_location` |
| `/warehouse/transfer` | ย้ายสินค้า | View, Create, Edit, Delete, Assign, Complete | `/api/moves`, `/api/moves/[id]`, `/api/moves/items/[id]`, `/api/moves/quick-move` | `warehouse.transfer.view`, `warehouse.transfer.create`, `warehouse.transfer.edit`, `warehouse.transfer.delete`, `warehouse.transfer.assign`, `warehouse.transfer.complete` |
| `/warehouse/inventory-ledger` | การเคลื่อนไหวสต็อก | View, Export, Filter by Date/Type/Location | `/api/inventory/ledger` | `warehouse.ledger.view`, `warehouse.ledger.export` |
| `/warehouse/inventory-balances` | คงเหลือตามโลเคชั่น | View, Export, Filter, Reset Reservations | `/api/inventory/balances`, `/api/inventory-balances/reset-reservations` | `warehouse.balances.view`, `warehouse.balances.export`, `warehouse.balances.reset_reservations` |
| `/warehouse/preparation-area-inventory` | สินค้าบ้านหยิบ | View, Filter | `/api/warehouse/preparation-area-inventory` | `warehouse.preparation_area.view` |

### 1.4 Order Management Module (Receiving)
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/receiving/orders` | รายการออเดอร์ | View, Create, Edit, Delete, Import, Export, Rollback, Add Coordinates, View Location | `/api/orders`, `/api/orders/[id]`, `/api/orders/import`, `/api/orders/import/confirm`, `/api/orders/[id]/rollback`, `/api/master-customer/update-coordinates`, `/api/geocoding` | `orders.view`, `orders.create`, `orders.edit`, `orders.delete`, `orders.import`, `orders.export`, `orders.rollback`, `orders.manage_coordinates` |
| `/receiving/routes` | จัดเส้นทางขนส่ง | View, Create, Edit, Delete, Optimize, Publish, Add Order, Remove Order, Reorder Stops, View Metrics | `/api/route-plans`, `/api/route-plans/[id]`, `/api/route-plans/optimize`, `/api/route-plans/[id]/trips`, `/api/route-plans/[id]/add-order`, `/api/route-plans/[id]/reorder-stops`, `/api/route-plans/[id]/metrics`, `/api/route-plans/inputs`, `/api/route-plans/draft-orders` | `routes.view`, `routes.create`, `routes.edit`, `routes.delete`, `routes.optimize`, `routes.publish`, `routes.manage_orders`, `routes.view_metrics` |
| `/receiving/picklists` | สร้างใบหยิบสินค้า | View, Create, Print, Assign, Complete, Cancel | `/api/picklists`, `/api/picklists/[id]`, `/api/picklists/create-from-trip`, `/api/picklists/[id]/print`, `/api/picklists/[id]/complete` | `picklists.view`, `picklists.create`, `picklists.print`, `picklists.assign`, `picklists.complete`, `picklists.cancel` |
| `/receiving/picklists/[id]` | รายละเอียดใบหยิบสินค้า | View, Edit, Print, Assign Employee, Confirm Items | `/api/picklists/[id]`, `/api/picklists/[id]/items/confirm` | `picklists.view`, `picklists.edit`, `picklists.print`, `picklists.assign_employee`, `picklists.confirm_items` |
| `/receiving/picklists/face-sheets` | สร้างใบปะหน้าสินค้า | View, Create, Print, Assign | `/api/face-sheets`, `/api/face-sheets/orders` | `face_sheets.view`, `face_sheets.create`, `face_sheets.print`, `face_sheets.assign` |
| `/receiving/picklists/bonus-face-sheets` | สร้างใบปะหน้าของแถม | View, Create, Print | `/api/bonus-face-sheets`, `/api/bonus-face-sheets/orders` | `bonus_face_sheets.view`, `bonus_face_sheets.create`, `bonus_face_sheets.print` |
| `/receiving/loadlists` | สร้างใบโหลดสินค้า | View, Create, Scan Orders, Depart, Complete | `/api/loadlists`, `/api/loadlists/[id]`, `/api/loadlists/[id]/scan`, `/api/loadlists/[id]/depart`, `/api/loadlists/available-picklists` | `loadlists.view`, `loadlists.create`, `loadlists.scan`, `loadlists.depart`, `loadlists.complete` |
| `/receiving/auto-replenishment` | เบิกเติมสินค้าอัตโนมัติ | View, Execute | `/api/auto-replenishment` | `replenishment.view`, `replenishment.execute` |

### 1.5 Shipping Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/shipping` | ส่งสินค้า | View, Create, Edit, Delete | `/api/shipping` | `shipping.view`, `shipping.create`, `shipping.edit`, `shipping.delete` |

### 1.6 Reports Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/reports` | รายงาน | View, Export, Print, Filter | `/api/reports` | `reports.view`, `reports.export`, `reports.print` |

### 1.7 Stock Management Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/stock-management/count` | นับสต็อก | View, Create, Edit, Delete, Confirm | `/api/stock-count` | `stock.count.view`, `stock.count.create`, `stock.count.edit`, `stock.count.delete`, `stock.count.confirm` |
| `/stock-management/adjustment` | ปรับสต็อก | View, Create, Edit, Delete, Approve | `/api/stock-adjustment` | `stock.adjustment.view`, `stock.adjustment.create`, `stock.adjustment.edit`, `stock.adjustment.delete`, `stock.adjustment.approve` |
| `/stock-management/import` | นำเข้าสต็อกจากระบบเก่า | View, Upload, Validate, Process, Download Template | `/api/stock-import/upload`, `/api/stock-import/validate`, `/api/stock-import/process`, `/api/stock-import/batches`, `/api/stock-import/batches/[id]`, `/api/stock-import/picking-area/validate`, `/api/stock-import/picking-area/process` | `stock.import.view`, `stock.import.upload`, `stock.import.validate`, `stock.import.process`, `stock.import.download_template` |

### 1.8 Online Packing Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/online-packing` | แพ็คสินค้า | View, Scan, Pack, Print | `/api/packing/scan`, `/api/packing/pack`, `/api/packing/print` | `packing.view`, `packing.scan`, `packing.pack`, `packing.print` |
| `/online-packing/dashboard` | แดชบอร์ด | View, Export | `/api/packing/dashboard` | `packing.dashboard.view`, `packing.dashboard.export` |
| `/online-packing/import` | นำเข้าออเดอร์ | View, Import, Validate | `/api/packing/import` | `packing.import.view`, `packing.import.upload`, `packing.import.validate` |
| `/online-packing/products` | จัดการสินค้า | View, Create, Edit, Delete | `/api/packing/products` | `packing.products.view`, `packing.products.create`, `packing.products.edit`, `packing.products.delete` |
| `/online-packing/promotions` | จัดการโปรโมชั่น | View, Create, Edit, Delete | `/api/packing/promotions` | `packing.promotions.view`, `packing.promotions.create`, `packing.promotions.edit`, `packing.promotions.delete` |
| `/online-packing/returns` | สินค้าตีกลับ | View, Create, Edit, Delete, Upload Image | `/api/packing/returns` | `packing.returns.view`, `packing.returns.create`, `packing.returns.edit`, `packing.returns.delete` |
| `/online-packing/settings` | ตั้งค่ากล่อง | View, Edit | `/api/packing/settings` | `packing.settings.view`, `packing.settings.edit` |
| `/online-packing/users` | จัดการผู้ใช้ | View, Create, Edit, Delete | `/api/packing/users` | `packing.users.view`, `packing.users.create`, `packing.users.edit`, `packing.users.delete` |
| `/online-packing/erp` | ส่งออก ERP | View, Export, Sync | `/api/packing/erp/export`, `/api/packing/erp/sync` | `packing.erp.view`, `packing.erp.export`, `packing.erp.sync` |

### 1.9 Mobile Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/mobile` | เมนูหลัก Mobile | View | - | `mobile.view` |
| `/mobile/receive` | รับสินค้า (Mobile) | View, Scan, Confirm | `/api/mobile/receive` | `mobile.receive.view`, `mobile.receive.scan`, `mobile.receive.confirm` |
| `/mobile/receive/[id]` | รายละเอียดรับสินค้า | View, Scan, Confirm | `/api/mobile/receive/[id]` | `mobile.receive.view`, `mobile.receive.scan`, `mobile.receive.confirm` |
| `/mobile/transfer` | ย้ายสินค้า (Mobile) | View, List | `/api/mobile/transfer` | `mobile.transfer.view` |
| `/mobile/transfer/[id]` | รายละเอียดย้ายสินค้า | View, Scan, Move, Complete | `/api/mobile/transfer/[id]` | `mobile.transfer.view`, `mobile.transfer.scan`, `mobile.transfer.move`, `mobile.transfer.complete` |
| `/mobile/pick` | หยิบสินค้า (Mobile) | View, List | `/api/mobile/pick/tasks` | `mobile.pick.view` |
| `/mobile/pick/[id]` | รายละเอียดหยิบสินค้า | View, Scan, Confirm Pick | `/api/mobile/pick/tasks/[id]`, `/api/mobile/pick/scan` | `mobile.pick.view`, `mobile.pick.scan`, `mobile.pick.confirm` |
| `/mobile/loading` | โหลดสินค้า (Mobile) | View, List | `/api/mobile/loading` | `mobile.loading.view` |
| `/mobile/loading/[code]` | รายละเอียดโหลดสินค้า | View, Scan, Complete | `/api/mobile/loading/loadlist-detail`, `/api/mobile/loading/complete`, `/api/mobile/loading/update`, `/api/mobile/loading/update-status`, `/api/mobile/loading/assign-employee` | `mobile.loading.view`, `mobile.loading.scan`, `mobile.loading.complete`, `mobile.loading.assign_employee` |
| `/mobile/face-sheet/[id]` | หยิบสินค้า Face Sheet | View, Scan, Confirm | `/api/mobile/face-sheet/tasks/[id]`, `/api/mobile/face-sheet/scan` | `mobile.face_sheet.view`, `mobile.face_sheet.scan`, `mobile.face_sheet.confirm` |
| `/mobile/bonus-face-sheet/[id]` | หยิบสินค้าของแถม | View, Scan, Confirm | `/api/mobile/bonus-face-sheet/tasks/[id]`, `/api/mobile/bonus-face-sheet/scan` | `mobile.bonus_face_sheet.view`, `mobile.bonus_face_sheet.scan`, `mobile.bonus_face_sheet.confirm` |

### 1.10 Master Data Module
| Path | ชื่อหน้า | Actions | APIs | Permission ที่ต้องการ |
|------|---------|---------|------|---------------------|
| `/master-data/products` | ข้อมูลสินค้า | View, Create, Edit, Delete, Import, Export | `/api/master-sku`, `/api/sku-options`, `/api/skus` | `master.products.view`, `master.products.create`, `master.products.edit`, `master.products.delete`, `master.products.import`, `master.products.export` |
| `/master-data/bom` | ข้อมูล BOM | View, Create, Edit, Delete | `/api/bom` | `master.bom.view`, `master.bom.create`, `master.bom.edit`, `master.bom.delete` |
| `/master-data/warehouses` | ข้อมูลคลังสินค้า | View, Create, Edit, Delete | `/api/master-warehouse` | `master.warehouses.view`, `master.warehouses.create`, `master.warehouses.edit`, `master.warehouses.delete` |
| `/master-data/locations` | ข้อมูลโลเคชั่น | View, Create, Edit, Delete, Import, Export | `/api/master-location`, `/api/master-location/zones`, `/api/master-location/location-types`, `/api/locations` | `master.locations.view`, `master.locations.create`, `master.locations.edit`, `master.locations.delete`, `master.locations.import`, `master.locations.export` |
| `/master-data/storage-strategy` | กลยุทธ์การเก็บสินค้า | View, Create, Edit, Delete, Import, Export Template | `/api/storage-strategies`, `/api/storage-strategies/import`, `/api/storage-strategies/template` | `master.storage_strategy.view`, `master.storage_strategy.create`, `master.storage_strategy.edit`, `master.storage_strategy.delete`, `master.storage_strategy.import`, `master.storage_strategy.export` |
| `/master-data/preparation-area` | พื้นที่จัดเตรียมสินค้า | View, Create, Edit, Delete, Import, Export Template | `/api/preparation-areas`, `/api/preparation-areas/[id]`, `/api/preparation-areas/import`, `/api/preparation-areas/template`, `/api/preparation-areas/zones` | `master.preparation_area.view`, `master.preparation_area.create`, `master.preparation_area.edit`, `master.preparation_area.delete`, `master.preparation_area.import`, `master.preparation_area.export` |
| `/master-data/suppliers` | ข้อมูลซัพพลายเออร์ | View, Create, Edit, Delete, Import | `/api/master-supplier`, `/api/master-supplier/next-code`, `/api/suppliers` | `master.suppliers.view`, `master.suppliers.create`, `master.suppliers.edit`, `master.suppliers.delete`, `master.suppliers.import` |
| `/master-data/customers` | ข้อมูลลูกค้า | View, Create, Edit, Delete, Import, Update Coordinates | `/api/master-customer`, `/api/master-customer/import`, `/api/master-customer/update-coordinates` | `master.customers.view`, `master.customers.create`, `master.customers.edit`, `master.customers.delete`, `master.customers.import`, `master.customers.update_coordinates` |
| `/master-data/vehicles` | ข้อมูลยานพาหนะ | View, Create, Edit, Delete | `/api/master-vehicle` | `master.vehicles.view`, `master.vehicles.create`, `master.vehicles.edit`, `master.vehicles.delete` |
| `/master-data/users` | ข้อมูลผู้ใช้งาน | View, Create, Edit, Delete | `/api/system-users` | `master.users.view`, `master.users.create`, `master.users.edit`, `master.users.delete` |
| `/master-data/roles` | จัดการบทบาท | View, Create, Edit, Delete, Manage Permissions | `/api/roles`, `/api/roles/[id]`, `/api/permission-modules` | `master.roles.view`, `master.roles.create`, `master.roles.edit`, `master.roles.delete`, `master.roles.manage_permissions` |
| `/master-data/assets` | ข้อมูลทรัพย์สินคลังสินค้า | View, Create, Edit, Delete | `/api/warehouse-assets` | `master.assets.view`, `master.assets.create`, `master.assets.edit`, `master.assets.delete` |
| `/master-data/shipping-costs` | ข้อมูลค่าขนส่ง | View, Create, Edit, Delete | `/api/freight-rates`, `/api/freight-rates/by-province` | `master.shipping_costs.view`, `master.shipping_costs.create`, `master.shipping_costs.edit`, `master.shipping_costs.delete` |
| `/master-data/employees` | ข้อมูลพนักงาน | View, Create, Edit, Delete, Import | `/api/master-employee`, `/api/master-employee/import` | `master.employees.view`, `master.employees.create`, `master.employees.edit`, `master.employees.delete`, `master.employees.import` |
| `/master-data/document-verification` | ข้อมูลตรวจเอกสาร (IV) | View, Create, Edit, Delete, Import | `/api/master-iv-document-type`, `/api/master-iv-document-type/import` | `master.iv_document.view`, `master.iv_document.create`, `master.iv_document.edit`, `master.iv_document.delete`, `master.iv_document.import` |
| `/master-data/customer-rejection` | ข้อมูลไม่รับสินค้ามีราคา | View, Create, Edit, Delete, Import | `/api/master-customer-no-price-goods`, `/api/master-customer-no-price-goods/import` | `master.customer_rejection.view`, `master.customer_rejection.create`, `master.customer_rejection.edit`, `master.customer_rejection.delete`, `master.customer_rejection.import` |
| `/master-data/file-management` | ข้อมูลไฟล์นำเข้า-ส่งออก | View, Upload, Download | `/api/file-uploads`, `/api/import-jobs`, `/api/export-jobs` | `master.files.view`, `master.files.upload`, `master.files.download` |

---

## ส่วนที่ 2: การวิเคราะห์ระบบ Permission ปัจจุบัน

### 2.1 โครงสร้าง Database ที่มีอยู่

**Tables:**
1. `master_system_role` - บทบาทผู้ใช้
2. `master_permission_module` - โมดูลที่กำหนดสิทธิ์ได้
3. `role_permission` - สิทธิ์ของแต่ละบทบาทต่อแต่ละโมดูล
4. `user_role` - การกำหนดบทบาทให้ผู้ใช้
5. `master_system_user` - ผู้ใช้งานระบบ

**Permission Types ที่มีอยู่:**
- `can_view` - สามารถดูข้อมูล
- `can_create` - สามารถสร้างข้อมูลใหม่
- `can_edit` - สามารถแก้ไขข้อมูล
- `can_delete` - สามารถลบข้อมูล
- `can_approve` - สามารถอนุมัติ

### 2.2 จุดอ่อนของระบบปัจจุบัน

❌ **1. Permission Modules ไม่ครอบคลุม:**
- ไม่มี permission modules สำหรับฟีเจอร์ใหม่หลายอย่าง:
  - Online Packing (9 sub-pages)
  - Stock Management (Import, Count, Adjustment)
  - Mobile Operations (Receive, Transfer, Pick, Loading, Face Sheet)
  - Bonus Face Sheets
  - Route Planning & VRP
  - Stock Reservations
  - Auto Replenishment

❌ **2. Permission Types ไม่เพียงพอ:**
- ขาด permission types สำหรับ actions เฉพาะ:
  - `can_import` - การนำเข้าข้อมูล
  - `can_export` - การส่งออกข้อมูล
  - `can_print` - การพิมพ์เอกสาร
  - `can_scan` - การสแกนบาร์โค้ด/QR
  - `can_assign` - การมอบหมายงาน
  - `can_complete` - การทำงานให้เสร็จ
  - `can_cancel` - การยกเลิก
  - `can_rollback` - การย้อนกลับ
  - `can_publish` - การเผยแพร่
  - `can_optimize` - การ optimize เส้นทาง
  - `can_change_status` - การเปลี่ยนสถานะ
  - `can_manage_coordinates` - การจัดการพิกัด
  - `can_reset_reservations` - การรีเซ็ตการจอง

❌ **3. ไม่มี Permission Hierarchy:**
- ไม่มีการจัดกลุ่ม permissions เป็น modules/sub-modules
- ไม่มีการกำหนด parent-child relationship
- ไม่มีการ inherit permissions

❌ **4. ไม่มี Data-Level Permissions:**
- ไม่สามารถกำหนดสิทธิ์ตามข้อมูล เช่น:
  - เห็นเฉพาะข้อมูลคลังของตัวเอง
  - เห็นเฉพาะออเดอร์ที่มอบหมายให้
  - แก้ไขได้เฉพาะข้อมูลที่สร้างเอง

❌ **5. ไม่มี Field-Level Permissions:**
- ไม่สามารถซ่อน/แสดง columns ในตาราง ตามสิทธิ์
- ไม่สามารถปิดการแก้ไข fields บางตัว

❌ **6. ไม่มี Permission Checking ใน UI:**
- หน้า UI ไม่มีการตรวจสอบสิทธิ์ก่อนแสดงปุ่ม/ฟีเจอร์
- ปุ่ม actions แสดงให้ทุกคนเห็น แม้ไม่มีสิทธิ์

❌ **7. ไม่มี Permission Checking ใน API:**
- API endpoints ไม่มีการตรวจสอบสิทธิ์
- ไม่มี middleware สำหรับ permission checking

---

## ส่วนที่ 3: Permission Structure เวอร์ชันใหม่ที่แนะนำ

### 3.1 โครงสร้าง Permission Keys แบบ Hierarchical

**รูปแบบ:** `{module}.{sub_module}.{action}`

**ตัวอย่าง:**
```
dashboard.view
production.orders.view
production.orders.create
production.orders.edit
production.orders.delete
production.orders.print
warehouse.inbound.view
warehouse.inbound.create
warehouse.inbound.scan
warehouse.inbound.print
warehouse.inbound.assign_location
warehouse.inbound.change_status
```

### 3.2 Permission Modules ทั้งหมด (150+ permissions)

#### Dashboard Module (1 permission)
```
dashboard.view
```

#### Production Module (5 permissions)
```
production.orders.view
production.orders.create
production.orders.edit
production.orders.delete
production.orders.print
```

#### Warehouse Management Module (35 permissions)
```
warehouse.inbound.view
warehouse.inbound.create
warehouse.inbound.edit
warehouse.inbound.delete
warehouse.inbound.scan
warehouse.inbound.print
warehouse.inbound.assign_location
warehouse.inbound.change_status
warehouse.inbound.validate_pallet
warehouse.inbound.generate_pallet_id

warehouse.transfer.view
warehouse.transfer.create
warehouse.transfer.edit
warehouse.transfer.delete
warehouse.transfer.assign
warehouse.transfer.complete
warehouse.transfer.quick_move

warehouse.ledger.view
warehouse.ledger.export
warehouse.ledger.filter_by_date
warehouse.ledger.filter_by_type
warehouse.ledger.filter_by_location

warehouse.balances.view
warehouse.balances.export
warehouse.balances.filter
warehouse.balances.reset_reservations

warehouse.preparation_area.view
warehouse.preparation_area.filter
```

#### Order Management Module (60+ permissions)
```
orders.view
orders.create
orders.edit
orders.delete
orders.import
orders.export
orders.rollback
orders.manage_coordinates
orders.view_location

routes.view
routes.create
routes.edit
routes.delete
routes.optimize
routes.publish
routes.manage_orders
routes.view_metrics
routes.add_order
routes.remove_order
routes.reorder_stops

picklists.view
picklists.create
picklists.print
picklists.assign
picklists.complete
picklists.cancel
picklists.edit
picklists.assign_employee
picklists.confirm_items
picklists.create_from_trip

face_sheets.view
face_sheets.create
face_sheets.print
face_sheets.assign

bonus_face_sheets.view
bonus_face_sheets.create
bonus_face_sheets.print

loadlists.view
loadlists.create
loadlists.scan
loadlists.depart
loadlists.complete

replenishment.view
replenishment.execute
```

#### Shipping Module (4 permissions)
```
shipping.view
shipping.create
shipping.edit
shipping.delete
```

#### Reports Module (3 permissions)
```
reports.view
reports.export
reports.print
```

#### Stock Management Module (15 permissions)
```
stock.count.view
stock.count.create
stock.count.edit
stock.count.delete
stock.count.confirm

stock.adjustment.view
stock.adjustment.create
stock.adjustment.edit
stock.adjustment.delete
stock.adjustment.approve

stock.import.view
stock.import.upload
stock.import.validate
stock.import.process
stock.import.download_template
```

#### Online Packing Module (30+ permissions)
```
packing.view
packing.scan
packing.pack
packing.print

packing.dashboard.view
packing.dashboard.export

packing.import.view
packing.import.upload
packing.import.validate

packing.products.view
packing.products.create
packing.products.edit
packing.products.delete

packing.promotions.view
packing.promotions.create
packing.promotions.edit
packing.promotions.delete

packing.returns.view
packing.returns.create
packing.returns.edit
packing.returns.delete

packing.settings.view
packing.settings.edit

packing.users.view
packing.users.create
packing.users.edit
packing.users.delete

packing.erp.view
packing.erp.export
packing.erp.sync
```

#### Mobile Module (30+ permissions)
```
mobile.view

mobile.receive.view
mobile.receive.scan
mobile.receive.confirm

mobile.transfer.view
mobile.transfer.scan
mobile.transfer.move
mobile.transfer.complete

mobile.pick.view
mobile.pick.scan
mobile.pick.confirm

mobile.loading.view
mobile.loading.scan
mobile.loading.complete
mobile.loading.assign_employee

mobile.face_sheet.view
mobile.face_sheet.scan
mobile.face_sheet.confirm

mobile.bonus_face_sheet.view
mobile.bonus_face_sheet.scan
mobile.bonus_face_sheet.confirm
```

#### Master Data Module (80+ permissions)
```
master.products.view
master.products.create
master.products.edit
master.products.delete
master.products.import
master.products.export

master.bom.view
master.bom.create
master.bom.edit
master.bom.delete

master.warehouses.view
master.warehouses.create
master.warehouses.edit
master.warehouses.delete

master.locations.view
master.locations.create
master.locations.edit
master.locations.delete
master.locations.import
master.locations.export

master.storage_strategy.view
master.storage_strategy.create
master.storage_strategy.edit
master.storage_strategy.delete
master.storage_strategy.import
master.storage_strategy.export

master.preparation_area.view
master.preparation_area.create
master.preparation_area.edit
master.preparation_area.delete
master.preparation_area.import
master.preparation_area.export

master.suppliers.view
master.suppliers.create
master.suppliers.edit
master.suppliers.delete
master.suppliers.import

master.customers.view
master.customers.create
master.customers.edit
master.customers.delete
master.customers.import
master.customers.update_coordinates

master.vehicles.view
master.vehicles.create
master.vehicles.edit
master.vehicles.delete

master.users.view
master.users.create
master.users.edit
master.users.delete

master.roles.view
master.roles.create
master.roles.edit
master.roles.delete
master.roles.manage_permissions

master.assets.view
master.assets.create
master.assets.edit
master.assets.delete

master.shipping_costs.view
master.shipping_costs.create
master.shipping_costs.edit
master.shipping_costs.delete

master.employees.view
master.employees.create
master.employees.edit
master.employees.delete
master.employees.import

master.iv_document.view
master.iv_document.create
master.iv_document.edit
master.iv_document.delete
master.iv_document.import

master.customer_rejection.view
master.customer_rejection.create
master.customer_rejection.edit
master.customer_rejection.delete
master.customer_rejection.import

master.files.view
master.files.upload
master.files.download
```

### 3.3 Predefined Roles

#### 1. Super Admin (ผู้ดูแลระบบ)
- สิทธิ์: **ทั้งหมด 260+ permissions**
- คำอธิบาย: มีสิทธิ์เต็มทุกอย่างในระบบ

#### 2. Warehouse Manager (ผู้จัดการคลัง)
- สิทธิ์:
  - Dashboard: view
  - Warehouse: ทั้งหมด
  - Orders: view, create, edit, manage_coordinates
  - Routes: view, create, edit, optimize, publish
  - Picklists: view, create, assign, complete
  - Loadlists: view, create, scan, depart
  - Stock: ทั้งหมด
  - Reports: view, export
  - Master: view, create, edit (ไม่มี delete)

#### 3. Warehouse Supervisor (หัวหน้าคลัง)
- สิทธิ์:
  - Dashboard: view
  - Warehouse: view, create, edit (ไม่มี delete)
  - Orders: view, create, edit
  - Routes: view
  - Picklists: view, create, assign
  - Loadlists: view, create, scan
  - Stock: view, create
  - Reports: view

#### 4. Warehouse Operator (พนักงานคลัง)
- สิทธิ์:
  - Warehouse.inbound: view, scan
  - Warehouse.transfer: view
  - Warehouse.balances: view
  - Mobile: ทั้งหมดยกเว้น assign_employee
  - Reports: view

#### 5. Forklift Driver (คนขับรถยก)
- สิทธิ์:
  - Mobile.transfer: view, scan, move, complete
  - Warehouse.transfer: view

#### 6. Picker (พนักงานหยิบสินค้า)
- สิทธิ์:
  - Mobile.pick: view, scan, confirm
  - Mobile.face_sheet: view, scan, confirm
  - Mobile.bonus_face_sheet: view, scan, confirm
  - Picklists: view

#### 7. Driver (พนักงานขับรถ)
- สิทธิ์:
  - Mobile.loading: view, scan, complete
  - Loadlists: view
  - Routes: view

#### 8. Checker (พนักงานเช็คสินค้า)
- สิทธิ์:
  - Mobile.receive: view, scan, confirm
  - Warehouse.inbound: view, scan
  - Mobile.pick: view
  - Mobile.face_sheet: view

#### 9. Planner (เจ้าหน้าที่วางแผน)
- สิทธิ์:
  - Orders: view, create, edit, import
  - Routes: view, create, edit, optimize, publish
  - Picklists: view, create
  - Face_sheets: view, create
  - Loadlists: view, create
  - Reports: view, export

#### 10. Data Entry (เจ้าหน้าที่บันทึกข้อมูล)
- สิทธิ์:
  - Master: view, create, edit, import
  - Orders: view, create, import

#### 11. Viewer (ผู้ดูข้อมูล)
- สิทธิ์:
  - Dashboard: view
  - ทุกโมดูล: view เท่านั้น
  - Reports: view, export

---

## ส่วนที่ 4: การออกแบบ Database Schema ใหม่

### 4.1 เพิ่ม Columns ใน `master_permission_module`
```sql
ALTER TABLE master_permission_module
ADD COLUMN parent_module_id BIGINT REFERENCES master_permission_module(module_id),
ADD COLUMN module_key VARCHAR(200) UNIQUE NOT NULL, -- เช่น 'warehouse.inbound'
ADD COLUMN display_order INTEGER DEFAULT 0,
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN icon VARCHAR(100);
```

### 4.2 เพิ่ม Columns ใน `role_permission`
```sql
ALTER TABLE role_permission
ADD COLUMN can_import BOOLEAN DEFAULT false,
ADD COLUMN can_export BOOLEAN DEFAULT false,
ADD COLUMN can_print BOOLEAN DEFAULT false,
ADD COLUMN can_scan BOOLEAN DEFAULT false,
ADD COLUMN can_assign BOOLEAN DEFAULT false,
ADD COLUMN can_complete BOOLEAN DEFAULT false,
ADD COLUMN can_cancel BOOLEAN DEFAULT false,
ADD COLUMN can_rollback BOOLEAN DEFAULT false,
ADD COLUMN can_publish BOOLEAN DEFAULT false,
ADD COLUMN can_optimize BOOLEAN DEFAULT false,
ADD COLUMN can_change_status BOOLEAN DEFAULT false;
```

### 4.3 สร้าง Table สำหรับ Data-Level Permissions
```sql
CREATE TABLE user_data_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES master_system_user(user_id),
  permission_type VARCHAR(50), -- 'warehouse', 'customer', 'supplier', etc.
  allowed_values TEXT[], -- array ของ IDs ที่อนุญาต
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### 4.4 สร้าง Table สำหรับ Field-Level Permissions
```sql
CREATE TABLE role_field_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT REFERENCES master_system_role(role_id),
  module_id BIGINT REFERENCES master_permission_module(module_id),
  field_name VARCHAR(200),
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## ส่วนที่ 5: แผนการ Implement

### Phase 1: Database Migration (1-2 วัน)
1. สร้าง migration files สำหรับ:
   - เพิ่ม columns ใหม่ใน tables
   - สร้าง tables ใหม่
   - Import permission modules ทั้งหมด (260+ permissions)
   - สร้าง predefined roles (11 roles)

### Phase 2: Backend Implementation (3-5 วัน)
1. สร้าง Permission Service
   - `checkPermission(userId, permissionKey)`
   - `checkDataPermission(userId, permissionType, dataId)`
   - `checkFieldPermission(roleId, moduleId, fieldName, action)`
2. สร้าง Middleware สำหรับ API
   - `requirePermission(permissionKey)`
   - `requireDataPermission(permissionType)`
3. เพิ่ม permission checking ใน API endpoints ทั้งหมด (100+ endpoints)

### Phase 3: Frontend Implementation (5-7 วัน)
1. สร้าง Permission Hook
   - `usePermission(permissionKey)`
   - `useHasPermission(permissionKey)`
2. สร้าง Permission Components
   - `<PermissionGuard permission="...">`
   - `<PermissionButton permission="...">`
3. เพิ่ม permission checking ใน UI (63 หน้า)
   - ซ่อย/แสดงปุ่มตามสิทธิ์
   - Disable actions ที่ไม่มีสิทธิ์
   - แสดง error message เมื่อไม่มีสิทธิ์

### Phase 4: Testing (2-3 วัน)
1. Unit Tests สำหรับ Permission Service
2. Integration Tests สำหรับ API Middleware
3. E2E Tests สำหรับ UI Permission Guards
4. Manual Testing ทุก Role

### Phase 5: Documentation (1 วัน)
1. เอกสาร Permission Structure
2. เอกสาร Role Definitions
3. User Guide สำหรับการจัดการสิทธิ์

---

## ส่วนที่ 6: จุดที่ต้องระวังและข้อเสนอแนะ

### 6.1 ข้อควรระวัง

⚠️ **1. Performance:**
- Permission checking ทุกครั้งที่เรียก API อาจทำให้ช้า
- **แนะนำ:** ใช้ caching สำหรับ permission data
- **แนะนำ:** Load permissions พร้อม user session

⚠️ **2. Data Consistency:**
- การเปลี่ยนสิทธิ์อาจไม่ reflect ทันทีใน UI
- **แนะนำ:** Implement real-time permission updates
- **แนะนำ:** Force re-login หลังเปลี่ยนสิทธิ์

⚠️ **3. Complexity:**
- 260+ permissions อาจทำให้ UI จัดการสิทธิ์ซับซ้อน
- **แนะนำ:** จัดกลุ่ม permissions เป็น modules
- **แนะนำ:** ใช้ checkbox hierarchy

⚠️ **4. Testing:**
- การทดสอบทุก permission combinations ใช้เวลามาก
- **แนะนำ:** Automated testing สำหรับ critical paths
- **แนะนำ:** Testing matrix สำหรับแต่ละ role

### 6.2 ข้อเสนอแนะเพิ่มเติม

💡 **1. Permission Inheritance:**
```
warehouse.* → รวมทุก permissions ใน warehouse module
*.view → รวมทุก view permissions
```

💡 **2. Permission Groups:**
```sql
CREATE TABLE permission_groups (
  id BIGSERIAL PRIMARY KEY,
  group_name VARCHAR(100),
  permission_keys TEXT[]
);

-- ตัวอย่าง
INSERT INTO permission_groups (group_name, permission_keys) VALUES
  ('Warehouse Full Access', ARRAY['warehouse.*']),
  ('Read Only All', ARRAY['*.view']);
```

💡 **3. Audit Log:**
```sql
CREATE TABLE permission_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  action VARCHAR(50), -- 'granted', 'revoked'
  permission_key VARCHAR(200),
  changed_by BIGINT,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);
```

💡 **4. Permission Templates:**
- สร้าง templates สำหรับการ setup role ใหม่
- Export/Import role configurations
- Clone roles เพื่อความรวดเร็ว

---

## สรุป

การวิเคราะห์นี้ครอบคลุม:
- ✅ 63 หน้าทั้งหมดในระบบ
- ✅ 100+ API endpoints
- ✅ 260+ permissions ที่จำเป็น
- ✅ 11 predefined roles
- ✅ การออกแบบ database schema ใหม่
- ✅ แผนการ implement แบบ step-by-step
- ✅ ข้อควรระวังและข้อเสนอแนะ

**ระยะเวลาการ implement โดยรวม:** 12-18 วัน

**จำนวนไฟล์ที่ต้องแก้ไข:**
- Database migrations: 5-10 files
- Backend services: 20-30 files
- API routes: 100+ files
- Frontend pages: 63 files
- Frontend components: 50+ files

---

**จัดทำโดย:** Claude Code
**วันที่:** 7 ธันวาคม 2025
**สถานะ:** รายงานฉบับสมบูรณ์
