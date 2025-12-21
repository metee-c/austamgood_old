# แผนที่ระบบ AustamGood WMS ฉบับสมบูรณ์

> เอกสารนี้สร้างจากการสำรวจระบบจริง 100% - ไม่มีการคาดเดา
> วันที่สร้าง: 21 ธันวาคม 2025

---

## 1. ภาพรวมระบบ (System Overview)

AustamGood WMS เป็นระบบจัดการคลังสินค้าสำหรับธุรกิจขนาดกลาง-ใหญ่ในประเทศไทย
พัฒนาด้วย Next.js 15 + Supabase (PostgreSQL) + TypeScript

### สถิติระบบ
- **ตารางทั้งหมด:** 148 ตาราง
- **API Endpoints:** 50+ endpoints
- **Custom Hooks:** 22 hooks
- **เมนูหลัก:** 10 หมวด

---

## 2. โครงสร้างเมนู (Menu Structure)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AustamGood WMS                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. แดชบอร์ด (Dashboard)                                         │
│    └── /dashboard                                               │
├─────────────────────────────────────────────────────────────────┤
│ 2. จัดการผลิต (Production)                                      │
│    ├── แผนการผลิต → /production/planning                        │
│    ├── ใบสั่งผลิต → /production/orders                          │
│    ├── บันทึกผลผลิต → /production/actual                        │
│    └── เบิกวัตถุดิบ → /production/material-requisition          │
├─────────────────────────────────────────────────────────────────┤
│ 3. จัดการคลังสินค้า (Warehouse)                                  │
│    ├── รับสินค้าเข้า → /warehouse/inbound                       │
│    ├── โอนย้ายสินค้า → /warehouse/transfer                      │
│    ├── ประวัติสต็อก → /warehouse/inventory-ledger               │
│    ├── สต็อกคงเหลือ → /warehouse/inventory-balances             │
│    └── สต็อกพื้นที่เตรียม → /warehouse/preparation-area-inventory│
├─────────────────────────────────────────────────────────────────┤
│ 4. จัดการออเดอร์ (Receiving/Orders)                             │
│    ├── ออเดอร์ → /receiving/orders                              │
│    ├── แผนเส้นทาง → /receiving/routes                           │
│    ├── Picklist → /receiving/picklists                          │
│    ├── Face Sheet → /receiving/picklists/face-sheets            │
│    ├── Bonus Face Sheet → /receiving/picklists/bonus-face-sheets│
│    ├── Loadlist → /receiving/loadlists                          │
│    └── Auto Replenishment → /receiving/auto-replenishment       │
├─────────────────────────────────────────────────────────────────┤
│ 5. รายงาน (Reports)                                             │
│    └── รายงาน 391 → /reports/391                                │
├─────────────────────────────────────────────────────────────────┤
│ 6. ระบบจัดการสต็อก (Stock Management)                           │
│    ├── นับสต็อก → /stock-management/count                       │
│    ├── ปรับปรุงสต็อก → /stock-management/adjustment             │
│    └── นำเข้าสต็อก → /stock-management/import                   │
├─────────────────────────────────────────────────────────────────┤
│ 7. แพ็คสินค้าออนไลน์ (Online Packing)                           │
│    └── /online-packing/*                                        │
├─────────────────────────────────────────────────────────────────┤
│ 8. อุปกรณ์เครื่องมือ (Mobile)                                   │
│    ├── หยิบสินค้า → /mobile/pick                                │
│    ├── Face Sheet → /mobile/face-sheet                          │
│    ├── Bonus Face Sheet → /mobile/bonus-face-sheet              │
│    ├── โหลดสินค้า → /mobile/loading                             │
│    ├── รับสินค้า → /mobile/receive                              │
│    ├── โอนย้าย → /mobile/transfer                               │
│    └── หยิบชิ้น → /mobile/pick-up-pieces                        │
├─────────────────────────────────────────────────────────────────┤
│ 9. จัดการข้อมูลพื้นฐาน (Master Data)                            │
│    ├── คลังสินค้า → /master-data/warehouses                     │
│    ├── โลเคชั่น → /master-data/locations                        │
│    ├── กลยุทธ์จัดเก็บ → /master-data/storage-strategy           │
│    ├── พื้นที่เตรียม → /master-data/preparation-area            │
│    ├── ซัพพลายเออร์ → /master-data/suppliers                    │
│    ├── ลูกค้า → /master-data/customers                          │
│    ├── พนักงาน → /master-data/employees                         │
│    ├── ยานพาหนะ → /master-data/vehicles                         │
│    ├── ทรัพย์สิน → /master-data/assets                          │
│    ├── ค่าขนส่ง → /master-data/shipping-costs                   │
│    ├── ตรวจสอบเอกสาร → /master-data/document-verification       │
│    ├── เหตุผลปฏิเสธ → /master-data/customer-rejection           │
│    ├── SKU → /master-data/skus                                  │
│    ├── BOM → /master-data/bom                                   │
│    ├── ผู้ใช้งาน → /master-data/users                           │
│    └── บทบาท → /master-data/roles                               │
├─────────────────────────────────────────────────────────────────┤
│ 10. ระบบ AI Chat                                                │
│     └── /api/ai/chat (Backend API)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. โครงสร้างฐานข้อมูล (Database Schema)

### 3.1 Master Data Tables (ข้อมูลหลัก)

| ตาราง | คำอธิบาย | จำนวนข้อมูล | Primary Key |
|-------|----------|-------------|-------------|
| `master_sku` | รายการสินค้า/SKU | 533 | sku_id |
| `master_customer` | ลูกค้า/ร้านค้า | 1,855 | customer_id |
| `master_location` | โลเคชั่นจัดเก็บ | 2,700 | location_id |
| `master_employee` | พนักงาน | 45 | employee_id |
| `master_vehicle` | ยานพาหนะ | 29 | vehicle_id |
| `master_warehouse` | คลังสินค้า | 1 | warehouse_id |
| `master_supplier` | ซัพพลายเออร์ | 4 | supplier_id |
| `master_zone` | โซนจัดเก็บ | - | zone_id |
| `master_preparation_area` | พื้นที่เตรียมสินค้า | - | preparation_area_id |
| `master_storage_strategy` | กลยุทธ์จัดเก็บ | - | strategy_id |
| `master_shipping_cost` | ค่าขนส่ง | - | shipping_cost_id |
| `master_asset` | ทรัพย์สิน | - | asset_id |
| `master_rejection_reason` | เหตุผลปฏิเสธ | - | reason_id |

### 3.2 WMS Core Tables (ตารางหลัก WMS)

| ตาราง | คำอธิบาย | จำนวนข้อมูล | Primary Key |
|-------|----------|-------------|-------------|
| `wms_orders` | ออเดอร์ขาย | 170 | order_id |
| `wms_order_items` | รายการสินค้าในออเดอร์ | 970 | order_item_id |
| `wms_receives` | ใบรับสินค้า | - | receive_id |
| `wms_receive_items` | รายการรับสินค้า | - | receive_item_id |
| `wms_moves` | ใบโอนย้าย | - | move_id |
| `wms_move_items` | รายการโอนย้าย | - | move_item_id |
| `wms_inventory_balances` | สต็อกคงเหลือ | 2,231 | balance_id |
| `wms_inventory_ledger` | ประวัติการเคลื่อนไหว | 2,315 | ledger_id |

### 3.3 Picklist/Face Sheet/Loadlist Tables

| ตาราง | คำอธิบาย | Primary Key |
|-------|----------|-------------|
| `picklists` | ใบหยิบสินค้า | picklist_id |
| `picklist_items` | รายการหยิบ | picklist_item_id |
| `face_sheets` | Face Sheet | face_sheet_id |
| `face_sheet_items` | รายการ Face Sheet | face_sheet_item_id |
| `bonus_face_sheets` | Bonus Face Sheet | bonus_face_sheet_id |
| `bonus_face_sheet_items` | รายการ Bonus | bonus_face_sheet_item_id |
| `loadlists` | ใบโหลดสินค้า | loadlist_id |
| `loadlist_items` | รายการโหลด | loadlist_item_id |

### 3.4 Production Tables (การผลิต)

| ตาราง | คำอธิบาย | Primary Key |
|-------|----------|-------------|
| `production_orders` | ใบสั่งผลิต | production_order_id |
| `production_order_items` | รายการผลิต | production_order_item_id |
| `production_plan` | แผนการผลิต | plan_id |
| `production_plan_items` | รายการแผน | plan_item_id |
| `production_receipts` | บันทึกผลผลิต | receipt_id |
| `material_issues` | ใบเบิกวัตถุดิบ | issue_id |
| `material_issue_items` | รายการเบิก | issue_item_id |
| `bom_sku` | Bill of Materials | bom_id |

### 3.5 Route Planning Tables (แผนเส้นทาง)

| ตาราง | คำอธิบาย | Primary Key |
|-------|----------|-------------|
| `receiving_route_plans` | แผนเส้นทาง | route_plan_id |
| `receiving_route_trips` | เที่ยวรถ | trip_id |
| `receiving_route_stops` | จุดจอด | stop_id |
| `replenishment_queue` | คิวเติมสินค้า | queue_id |

### 3.6 Stock Adjustment Tables (ปรับปรุงสต็อก)

| ตาราง | คำอธิบาย | Primary Key |
|-------|----------|-------------|
| `wms_stock_adjustments` | ใบปรับปรุงสต็อก | adjustment_id |
| `wms_stock_adjustment_items` | รายการปรับปรุง | adjustment_item_id |
| `wms_adjustment_reasons` | เหตุผลปรับปรุง | reason_id |

### 3.7 Auth/Permission Tables (ระบบสิทธิ์)

| ตาราง | คำอธิบาย | Primary Key |
|-------|----------|-------------|
| `master_system_user` | ผู้ใช้งานระบบ | user_id |
| `master_system_role` | บทบาท | role_id |
| `role_permission` | สิทธิ์ตามบทบาท | permission_id |
| `master_permission_module` | โมดูลสิทธิ์ | module_id |
| `user_sessions` | Session ผู้ใช้ | session_id |
| `audit_logs` | บันทึกการใช้งาน | log_id |
| `login_attempts` | ประวัติ Login | attempt_id |
| `password_reset_tokens` | Token รีเซ็ตรหัส | token_id |
| `system_settings` | ตั้งค่าระบบ | setting_key |

---

## 4. Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MASTER DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ master_sku   │    │master_customer│   │master_supplier│                  │
│  │──────────────│    │──────────────│    │──────────────│                   │
│  │ sku_id (PK)  │    │customer_id(PK)│   │supplier_id(PK)│                  │
│  │ sku_name     │    │ customer_name │   │ supplier_name │                  │
│  │ category     │    │ province      │   │ contact       │                  │
│  │ unit         │    │ route_code    │   └───────┬───────┘                  │
│  └──────┬───────┘    └───────┬───────┘           │                          │
│         │                    │                    │                          │
├─────────┼────────────────────┼────────────────────┼──────────────────────────┤
│         │     TRANSACTION LAYER                   │                          │
├─────────┼────────────────────┼────────────────────┼──────────────────────────┤
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ wms_orders   │◄───│wms_order_items│   │ wms_receives │                   │
│  │──────────────│    │──────────────│    │──────────────│                   │
│  │ order_id(PK) │    │order_item_id │    │receive_id(PK)│                   │
│  │ order_no     │    │ order_id(FK) │    │ supplier_id  │                   │
│  │ customer_id  │    │ sku_id (FK)  │    │ status       │                   │
│  │ status       │    │ qty          │    └──────┬───────┘                   │
│  │ delivery_date│    └──────────────┘           │                          │
│  └──────┬───────┘                               │                          │
│         │                                        │                          │
│         ▼                                        ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  picklists   │───►│picklist_items│    │wms_receive_  │                   │
│  │──────────────│    │──────────────│    │   items      │                   │
│  │picklist_id   │    │ sku_id       │    │──────────────│                   │
│  │ order_id     │    │ location_id  │    │ sku_id       │                   │
│  │ status       │    │ qty          │    │ location_id  │                   │
│  └──────┬───────┘    └──────────────┘    │ qty          │                   │
│         │                                └──────┬───────┘                   │
│         ▼                                       │                          │
│  ┌──────────────┐    ┌──────────────┐           │                          │
│  │ face_sheets  │───►│face_sheet_   │           │                          │
│  │──────────────│    │   items      │           │                          │
│  │face_sheet_id │    │──────────────│           │                          │
│  │ picklist_id  │    │ sku_id       │           │                          │
│  │ status       │    │ qty          │           │                          │
│  └──────┬───────┘    └──────────────┘           │                          │
│         │                                        │                          │
│         ▼                                        │                          │
│  ┌──────────────┐    ┌──────────────┐           │                          │
│  │  loadlists   │───►│loadlist_items│           │                          │
│  │──────────────│    │──────────────│           │                          │
│  │loadlist_id   │    │ face_sheet_id│           │                          │
│  │ vehicle_id   │    │ qty          │           │                          │
│  │ status       │    └──────────────┘           │                          │
│  └──────────────┘                               │                          │
│                                                  │                          │
├──────────────────────────────────────────────────┼──────────────────────────┤
│                    INVENTORY LAYER               │                          │
├──────────────────────────────────────────────────┼──────────────────────────┤
│                                                  │                          │
│  ┌──────────────────────────────────────────────┐│                          │
│  │         wms_inventory_balances               ││                          │
│  │──────────────────────────────────────────────││                          │
│  │ balance_id (PK)                              ││                          │
│  │ sku_id (FK) ─────────────────────────────────┼┘                          │
│  │ location_id (FK)                             │                           │
│  │ warehouse_id (FK)                            │                           │
│  │ lot_no                                       │                           │
│  │ expiry_date                                  │                           │
│  │ total_piece_qty                              │                           │
│  │ reserved_piece_qty                           │                           │
│  │ available_piece_qty (computed)               │                           │
│  └──────────────────────────────────────────────┘                           │
│                         │                                                    │
│                         ▼                                                    │
│  ┌──────────────────────────────────────────────┐                           │
│  │         wms_inventory_ledger                 │                           │
│  │──────────────────────────────────────────────│                           │
│  │ ledger_id (PK)                               │                           │
│  │ sku_id (FK)                                  │                           │
│  │ location_id (FK)                             │                           │
│  │ direction (in/out)                           │                           │
│  │ movement_type (receive/ship/transfer/adjust) │                           │
│  │ piece_qty                                    │                           │
│  │ reference_type                               │                           │
│  │ reference_id                                 │                           │
│  │ movement_at                                  │                           │
│  └──────────────────────────────────────────────┘                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow (การไหลของข้อมูล)

### 5.1 Inbound Flow (รับสินค้าเข้า)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Supplier   │───►│ wms_receives│───►│wms_receive_ │───►│wms_inventory│
│  Order      │    │             │    │   items     │    │  _ledger    │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │wms_inventory│
                                                         │  _balances  │
                                                         └─────────────┘
```

### 5.2 Outbound Flow (จ่ายสินค้าออก)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ wms_orders  │───►│  picklists  │───►│ face_sheets │───►│  loadlists  │
│             │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                          │                                      │
                          ▼                                      ▼
                   ┌─────────────┐                        ┌─────────────┐
                   │wms_inventory│                        │  Delivery   │
                   │  _ledger    │                        │             │
                   └─────────────┘                        └─────────────┘
```

### 5.3 Production Flow (การผลิต)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│production_  │───►│material_    │───►│production_  │───►│wms_inventory│
│   plan      │    │  issues     │    │  receipts   │    │  _ledger    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│production_  │    │   bom_sku   │
│  orders     │    │             │
└─────────────┘    └─────────────┘
```

---

## 6. API Endpoints

### 6.1 AI Chat APIs

| Endpoint | Method | คำอธิบาย |
|----------|--------|----------|
| `/api/ai/chat` | POST | AI Chat หลัก |
| `/api/ai/stock/balance` | GET | สต็อกคงเหลือ |
| `/api/ai/stock/movements` | GET | การเคลื่อนไหวสต็อก |
| `/api/ai/stock/consumption` | GET | อัตราการใช้ (คำนวณ) |
| `/api/ai/orders/status` | GET | สถานะออเดอร์ |
| `/api/ai/warehouse/locations` | GET | โลเคชั่น |
| `/api/ai/analytics/kpi` | GET | KPI |

### 6.2 Intelligence APIs (คำนวณจากข้อมูล)

| Endpoint | Method | คำอธิบาย |
|----------|--------|----------|
| `/api/ai/intelligence/consumption` | GET | อัตราการใช้ |
| `/api/ai/intelligence/days-of-cover` | GET | จำนวนวันที่ใช้ได้ |
| `/api/ai/intelligence/shortage-risk` | GET | ความเสี่ยงขาดสต็อก |
| `/api/ai/intelligence/overstock-risk` | GET | ความเสี่ยงสต็อกเกิน |
| `/api/ai/intelligence/expiry-risk` | GET | ความเสี่ยงหมดอายุ |
| `/api/ai/intelligence/utilization` | GET | การใช้พื้นที่ |

### 6.3 Simulation APIs (จำลองสถานการณ์)

| Endpoint | Method | คำอธิบาย |
|----------|--------|----------|
| `/api/ai/simulation/demand-increase` | POST | จำลองความต้องการเพิ่ม |
| `/api/ai/simulation/lead-time-increase` | POST | จำลอง Lead Time เพิ่ม |
| `/api/ai/simulation/storage-reduction` | POST | จำลองพื้นที่ลด |
| `/api/ai/simulation/shift-change` | POST | จำลองเปลี่ยนกะ |
| `/api/ai/simulation/compare` | POST | เปรียบเทียบ Scenario |

### 6.4 Core WMS APIs

| Endpoint | Method | คำอธิบาย |
|----------|--------|----------|
| `/api/orders` | GET/POST | จัดการออเดอร์ |
| `/api/orders/[id]` | GET/PUT/DELETE | ออเดอร์รายตัว |
| `/api/orders/import` | POST | นำเข้าออเดอร์ |
| `/api/picklists` | GET/POST | จัดการ Picklist |
| `/api/face-sheets` | GET/POST | จัดการ Face Sheet |
| `/api/loadlists` | GET/POST | จัดการ Loadlist |
| `/api/receives` | GET/POST | จัดการรับสินค้า |
| `/api/moves` | GET/POST | จัดการโอนย้าย |
| `/api/stock-adjustments` | GET/POST | ปรับปรุงสต็อก |

### 6.5 Mobile APIs

| Endpoint | Method | คำอธิบาย |
|----------|--------|----------|
| `/api/mobile/pick/tasks` | GET | งานหยิบสินค้า |
| `/api/mobile/pick/scan` | POST | สแกนหยิบ |
| `/api/mobile/face-sheet/tasks` | GET | งาน Face Sheet |
| `/api/mobile/face-sheet/scan` | POST | สแกน Face Sheet |
| `/api/mobile/loading/tasks` | GET | งานโหลด |
| `/api/mobile/loading/complete` | POST | โหลดเสร็จ |
| `/api/mobile/replenishment/tasks` | GET | งานเติมสินค้า |

---

## 7. Custom Hooks

| Hook | คำอธิบาย | ใช้กับหน้า |
|------|----------|-----------|
| `useOrders` | จัดการออเดอร์ | /receiving/orders |
| `usePicklists` | จัดการ Picklist | /receiving/picklists |
| `useFaceSheets` | จัดการ Face Sheet | /receiving/picklists/face-sheets |
| `useLoadlists` | จัดการ Loadlist | /receiving/loadlists |
| `useReceive` | จัดการรับสินค้า | /warehouse/inbound |
| `useMoves` | จัดการโอนย้าย | /warehouse/transfer |
| `useInventoryBalances` | สต็อกคงเหลือ | /warehouse/inventory-balances |
| `useInventoryLedger` | ประวัติสต็อก | /warehouse/inventory-ledger |
| `useProductionOrders` | ใบสั่งผลิต | /production/orders |
| `useProductionPlanning` | แผนการผลิต | /production/planning |
| `useCustomers` | ลูกค้า | /master-data/customers |
| `useEmployees` | พนักงาน | /master-data/employees |
| `useLocations` | โลเคชั่น | /master-data/locations |
| `useSkus` | SKU | /master-data/skus |
| `useSuppliers` | ซัพพลายเออร์ | /master-data/suppliers |
| `useWarehouses` | คลังสินค้า | /master-data/warehouses |
| `useVehicles` | ยานพาหนะ | /master-data/vehicles |
| `useSystemUsers` | ผู้ใช้งาน | /master-data/users |
| `useAuth` | Authentication | ทุกหน้า |
| `usePermission` | สิทธิ์การใช้งาน | ทุกหน้า |
| `useReport391` | รายงาน 391 | /reports/391 |
| `useReplenishmentTasks` | งานเติมสินค้า | /mobile/transfer/replenishment |

---

## 8. AI Chat System Architecture

### 8.1 Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Chat System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  chat-service   │───►│  system-prompt  │                     │
│  │  (Main Logic)   │    │  (AI Identity)  │                     │
│  └────────┬────────┘    └─────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │reasoning-engine │    │   guardrails    │                     │
│  │ (Analysis)      │    │ (Safety)        │                     │
│  └────────┬────────┘    └─────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ data-contract   │    │question-guidance│                     │
│  │ (What's Available)│  │ (User Help)     │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Intelligence Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │consumption-engine│   │  risk-engine    │                     │
│  │ (Usage Rate)    │    │ (Risk Analysis) │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │utilization-engine│                                           │
│  │ (Space Usage)   │                                            │
│  └─────────────────┘                                            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Simulation Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ digital-twin    │    │scenario-engine  │                     │
│  │ (State Model)   │    │ (What-If)       │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
│  Models: storage-model, throughput-model, labor-model,          │
│          leadtime-model, order-pattern-model                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Data Contract (ข้อมูลที่ตอบได้/ไม่ได้)

#### ✅ ตอบได้โดยตรง (AVAILABLE_DATA)
- `stock_balance` - สต็อกคงเหลือ
- `order_status` - สถานะออเดอร์
- `location_utilization` - การใช้โลเคชั่น
- `stock_movements` - การเคลื่อนไหวสต็อก
- `kpi` - ตัวชี้วัด

#### 🔄 คำนวณได้ (DERIVABLE via Intelligence APIs)
- `consumption_rate` - อัตราการใช้ (จากประวัติจ่ายออก)
- `days_of_cover` - จำนวนวันที่ใช้ได้
- `shortage_risk` - ความเสี่ยงขาดสต็อก
- `overstock_risk` - ความเสี่ยงสต็อกเกิน
- `expiry_risk` - ความเสี่ยงหมดอายุ
- `utilization` - การใช้พื้นที่

#### 🎮 จำลองได้ (SIMULATION)
- `demand_increase` - ความต้องการเพิ่ม
- `lead_time_increase` - Lead Time เพิ่ม
- `storage_reduction` - พื้นที่ลด
- `shift_change` - เปลี่ยนกะ/กำลังคน

#### ❌ ตอบไม่ได้ (NOT_AVAILABLE_DATA)
- `daily_consumption_rate` - อัตราการใช้ต่อวัน (ไม่ได้เก็บโดยตรง)
- `forecast` - การพยากรณ์
- `unit_cost` - ต้นทุนต่อหน่วย
- `picks_per_hour` - จำนวนหยิบต่อชั่วโมง
- `supplier_lead_time` - Lead Time ซัพพลายเออร์

---

## 9. File Structure

```
austamgood-wms/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (50+ endpoints)
│   ├── dashboard/                # แดชบอร์ด
│   ├── production/               # จัดการผลิต
│   ├── warehouse/                # จัดการคลังสินค้า
│   ├── receiving/                # จัดการออเดอร์
│   ├── reports/                  # รายงาน
│   ├── stock-management/         # จัดการสต็อก
│   ├── online-packing/           # แพ็คออนไลน์
│   ├── mobile/                   # หน้า Mobile
│   └── master-data/              # ข้อมูลพื้นฐาน
├── components/                   # React Components
│   ├── ui/                       # UI Components
│   ├── forms/                    # Form Components
│   ├── layout/                   # Layout (Sidebar, Header)
│   ├── mobile/                   # Mobile Components
│   ├── orders/                   # Order Components
│   ├── receiving/                # Receiving Components
│   ├── warehouse/                # Warehouse Components
│   └── production/               # Production Components
├── hooks/                        # Custom React Hooks (22 files)
├── lib/                          # Libraries
│   ├── ai/                       # AI Chat System
│   ├── intelligence/             # Intelligence Engines
│   ├── simulation/               # Simulation/Digital Twin
│   ├── database/                 # Database Utilities
│   ├── supabase/                 # Supabase Client
│   └── auth/                     # Authentication
├── types/                        # TypeScript Types (24 files)
├── utils/                        # Utilities
├── supabase/                     # Database
│   ├── migrations/               # SQL Migrations (167 files)
│   └── functions/                # Edge Functions
└── docs/                         # Documentation
```

---

## 10. สรุป

ระบบ AustamGood WMS ประกอบด้วย:
- **148 ตาราง** ในฐานข้อมูล PostgreSQL
- **50+ API endpoints** สำหรับการทำงานต่างๆ
- **22 custom hooks** สำหรับ data fetching
- **10 เมนูหลัก** ครอบคลุมทุกการทำงาน
- **AI Chat System** พร้อม Intelligence และ Simulation

ระบบรองรับการทำงานทั้ง Desktop และ Mobile (PWA) พร้อมระบบสิทธิ์และ Authentication ครบถ้วน
