# AI Chat Intelligence Discovery Result

**วันที่วิเคราะห์**: 22 ธันวาคม 2025  
**เวอร์ชัน**: 2.1  
**สถานะ**: ✅ Phase A & B Complete

---

## Phase B Implementation Summary

### ✅ Completed Tasks

| Task | Description | Status |
|------|-------------|--------|
| B1 | Update `types/ai-schema.ts` - Added 11 new tool types | ✅ Complete |
| B2 | Update `lib/ai/chat-service.ts` - Added intent detection & query functions | ✅ Complete |
| B3 | Update `lib/ai/data-contract.ts` - Added available data fields | ✅ Complete |
| B4 | Update `lib/ai/question-guidance.ts` - Added question templates | ✅ Complete |
| B5 | Update `lib/ai/system-prompt.ts` - Expanded scope | ✅ Complete |
| B6 | Update `lib/ai/guardrails.ts` - Added permissions | ✅ Complete |
| B7 | Create API endpoints | ⏭️ Skipped (using direct DB queries) |
| B8 | Test capabilities | ✅ TypeScript diagnostics passed |
| B9 | Update greeting message | ✅ Complete |

### New Tools Added (11 tools)
```typescript
query_transfers           // การโอนย้าย
query_stock_adjustments   // การปรับสต็อก
query_face_sheets         // ใบปะหน้า
query_bonus_face_sheets   // ใบปะหน้าของแถม
query_loadlists           // ใบโหลด
query_replenishment       // คิวเติมสินค้า
query_production_plan     // แผนการผลิต
query_material_issues     // การเบิกวัตถุดิบ
query_suppliers           // ซัพพลายเออร์
query_vehicles            // ยานพาหนะ
query_preparation_areas   // พื้นที่จัดเตรียม
```

### New Intent Detection Patterns
- โอนย้าย, transfer, ย้ายสินค้า, โอนสต็อก
- ปรับสต็อก, adjustment, ปรับปรุงสต็อก, แก้ไขสต็อก
- ใบปะหน้า, face sheet, ปะหน้า, facesheet
- ใบโหลด, loadlist, โหลดสินค้า, load list
- เติมสินค้า, replenishment, เบิกเติม, คิวเติม
- แผนผลิต, production plan, วางแผนผลิต
- เบิกวัตถุดิบ, material issue, เบิกของ, ใบเบิก
- ซัพพลายเออร์, supplier, ผู้จัดจำหน่าย
- รถ, vehicle, ยานพาหนะ, รถขนส่ง, ทะเบียน
- พื้นที่จัดเตรียม, preparation area, prep area, staging

---

## 1. Database Schema Summary (143 Tables)

### 1.1 Master Data Tables (ข้อมูลหลัก)
| Table | Rows | Description | AI Coverage |
|-------|------|-------------|-------------|
| `master_sku` | 533 | ข้อมูลสินค้า | ✅ query_sku_master |
| `master_warehouse` | 1 | ข้อมูลคลังสินค้า | ✅ query_warehouse_locations |
| `master_location` | 2,700 | ข้อมูลโลเคชั่น | ✅ query_warehouse_locations |
| `master_supplier` | 4 | ข้อมูลซัพพลายเออร์ | ❌ ไม่มี |
| `master_customer` | 1,855 | ข้อมูลลูกค้า | ✅ query_customers |
| `master_vehicle` | 29 | ข้อมูลยานพาหนะ | ❌ ไม่มี |
| `master_employee` | 45 | ข้อมูลพนักงาน | ✅ query_employee_activity |
| `master_system_user` | 6 | ข้อมูลผู้ใช้ระบบ | ❌ ไม่มี |
| `master_system_role` | 3 | ข้อมูล Role | ❌ ไม่มี |
| `bom_sku` | 250 | ข้อมูล BOM | ✅ query_bom |

### 1.2 WMS Core Tables (ตารางหลัก WMS)
| Table | Rows | Description | AI Coverage |
|-------|------|-------------|-------------|
| `wms_inventory_balances` | 2,231 | สต็อกคงเหลือ | ✅ query_stock_balance |
| `wms_inventory_ledger` | 2,315 | การเคลื่อนไหวสต็อก | ✅ query_stock_movements |
| `wms_orders` | 170 | ออเดอร์ | ✅ query_order_status |
| `wms_order_items` | 970 | รายการออเดอร์ | ✅ (ผ่าน order_status) |
| `wms_receives` | - | ใบรับสินค้า | ✅ query_receiving_orders |
| `wms_receive_items` | - | รายการรับสินค้า | ✅ (ผ่าน receiving_orders) |
| `wms_moves` | - | ใบโอนย้าย | ❌ ไม่มี |
| `wms_move_items` | - | รายการโอนย้าย | ❌ ไม่มี |
| `wms_stock_adjustments` | - | ใบปรับสต็อก | ❌ ไม่มี |
| `wms_stock_adjustment_items` | - | รายการปรับสต็อก | ❌ ไม่มี |

### 1.3 Picklist & Face Sheet Tables
| Table | Description | AI Coverage |
|-------|-------------|-------------|
| `picklists` | ใบหยิบสินค้า | ✅ query_picklists |
| `picklist_items` | รายการหยิบ | ✅ (ผ่าน picklists) |
| `picklist_item_reservations` | การจองสต็อก | ❌ ไม่มี |
| `face_sheets` | ใบปะหน้า | ❌ ไม่มี |
| `face_sheet_packages` | แพ็คเกจใบปะหน้า | ❌ ไม่มี |
| `face_sheet_items` | รายการใบปะหน้า | ❌ ไม่มี |
| `bonus_face_sheets` | ใบปะหน้าของแถม | ❌ ไม่มี |

### 1.4 Route & Loadlist Tables
| Table | Description | AI Coverage |
|-------|-------------|-------------|
| `receiving_route_plans` | แผนเส้นทาง | ✅ query_routes |
| `receiving_route_trips` | ทริปขนส่ง | ✅ (ผ่าน routes) |
| `receiving_route_stops` | จุดจอด | ❌ ไม่มี |
| `loadlists` | ใบโหลดสินค้า | ❌ ไม่มี |
| `loadlist_items` | รายการโหลด | ❌ ไม่มี |

### 1.5 Production Tables
| Table | Description | AI Coverage |
|-------|-------------|-------------|
| `production_plan` | แผนการผลิต | ❌ ไม่มี |
| `production_orders` | ใบสั่งผลิต | ✅ query_production_orders |
| `production_order_items` | รายการผลิต | ✅ (ผ่าน production_orders) |
| `material_issues` | การเบิกวัตถุดิบ | ❌ ไม่มี |

### 1.6 Replenishment Tables
| Table | Rows | Description | AI Coverage |
|-------|------|-------------|-------------|
| `replenishment_queue` | 51 | คิวเติมสินค้า | ❌ ไม่มี |
| `replenishment_rules` | 20 | กฎการเติม | ❌ ไม่มี |

### 1.7 Other Important Tables
| Table | Description | AI Coverage |
|-------|-------------|-------------|
| `audit_logs` | บันทึกการใช้งาน | ❌ ไม่มี |
| `system_settings` | ตั้งค่าระบบ | ❌ ไม่มี |
| `user_sessions` | เซสชันผู้ใช้ | ❌ ไม่มี |
| `rollback_audit_logs` | บันทึก Rollback | ❌ ไม่มี |

---

## 2. Menu Structure (จาก Sidebar.tsx)

### 2.1 Main Menus
| Menu | Path | Submenus | AI Coverage |
|------|------|----------|-------------|
| แดชบอร์ด | `/dashboard` | - | ✅ query_kpi |
| จัดการผลิต | `/production` | 4 | ⚠️ บางส่วน |
| จัดการคลังสินค้า | `/warehouse` | 5 | ⚠️ บางส่วน |
| จัดการออเดอร์ | `/receiving` | 7 | ⚠️ บางส่วน |
| ส่งสินค้า | `/shipping` | - | ❌ ไม่มี |
| รายงาน | `/reports` | 1 | ❌ ไม่มี |
| ระบบจัดการสต็อก | `/stock-management` | 3 | ❌ ไม่มี |
| แพ็คสินค้าออนไลน์ | `/online-packing` | 9 | ❌ ไม่มี |
| อุปกรณ์เครื่องมือ | `/mobile` | - | ❌ ไม่มี |
| จัดการข้อมูลพื้นฐาน | `/master-data` | 16 | ⚠️ บางส่วน |

### 2.2 Submenu Details

#### Production (จัดการผลิต)
| Submenu | Path | AI Coverage |
|---------|------|-------------|
| วางแผนผลิต | `/production/planning` | ❌ ไม่มี |
| ใบสั่งผลิต | `/production/orders` | ✅ query_production_orders |
| บันทึกการผลิตจริง | `/production/actual` | ❌ ไม่มี |
| งานเบิกเติมวัตถุดิบ | `/production/material-requisition` | ❌ ไม่มี |

#### Warehouse (จัดการคลังสินค้า)
| Submenu | Path | AI Coverage |
|---------|------|-------------|
| รับสินค้าเข้า | `/warehouse/inbound` | ✅ query_receiving_orders |
| ย้ายสินค้า | `/warehouse/transfer` | ❌ ไม่มี |
| การเคลื่อนไหวสต็อก | `/warehouse/inventory-ledger` | ✅ query_stock_movements |
| คงเหลือตามโลเคชั่น | `/warehouse/inventory-balances` | ✅ query_stock_balance |
| สินค้าออก | `/warehouse/preparation-area-inventory` | ❌ ไม่มี |

#### Order Management (จัดการออเดอร์)
| Submenu | Path | AI Coverage |
|---------|------|-------------|
| รายการออเดอร์ | `/receiving/orders` | ✅ query_order_status |
| จัดเส้นทางขนส่ง | `/receiving/routes` | ✅ query_routes |
| สร้างใบหยิบสินค้า | `/receiving/picklists` | ✅ query_picklists |
| สร้างใบปะหน้าสินค้า | `/receiving/picklists/face-sheets` | ❌ ไม่มี |
| สร้างใบปะหน้าของแถม | `/receiving/picklists/bonus-face-sheets` | ❌ ไม่มี |
| สร้างใบโหลดสินค้า | `/receiving/loadlists` | ❌ ไม่มี |
| เบิกเติมสินค้าอัตโนมัติ | `/receiving/auto-replenishment` | ❌ ไม่มี |

#### Master Data (จัดการข้อมูลพื้นฐาน)
| Submenu | Path | AI Coverage |
|---------|------|-------------|
| ข้อมูลสินค้า | `/master-data/products` | ✅ query_sku_master |
| ข้อมูล BOM | `/master-data/bom` | ✅ query_bom |
| ข้อมูลคลังสินค้า | `/master-data/warehouses` | ✅ query_warehouse_locations |
| ข้อมูลโลเคชั่น | `/master-data/locations` | ✅ query_warehouse_locations |
| กลยุทธ์การเก็บสินค้า | `/master-data/storage-strategy` | ❌ ไม่มี |
| พื้นที่จัดเตรียมสินค้า | `/master-data/preparation-area` | ❌ ไม่มี |
| ข้อมูลซัพพลายเออร์ | `/master-data/suppliers` | ❌ ไม่มี |
| ข้อมูลลูกค้า | `/master-data/customers` | ✅ query_customers |
| ข้อมูลยานพาหนะ | `/master-data/vehicles` | ❌ ไม่มี |
| ข้อมูลผู้ใช้งาน | `/master-data/users` | ❌ ไม่มี |
| ข้อมูลทรัพย์สินคลังสินค้า | `/master-data/assets` | ❌ ไม่มี |
| ข้อมูลค่าขนส่ง | `/master-data/shipping-costs` | ❌ ไม่มี |
| ข้อมูลพนักงาน | `/master-data/employees` | ✅ query_employee_activity |
| ข้อมูลตรวจเอกสาร | `/master-data/document-verification` | ❌ ไม่มี |
| ข้อมูลไม่รับสินค้ามีราคา | `/master-data/customer-rejection` | ❌ ไม่มี |
| ข้อมูลไฟล์นำเข้า-ส่งออก | `/master-data/file-management` | ❌ ไม่มี |

---

## 3. Current AI Capabilities

### 3.1 Existing Tools (types/ai-schema.ts)
```typescript
// Query Tools (17 tools)
query_stock_balance        // สต็อกคงเหลือ
query_stock_movements      // การเคลื่อนไหวสต็อก
query_forecast             // พยากรณ์ (ไม่มีข้อมูลจริง)
query_warehouse_locations  // โลเคชั่น
query_warehouse_utilization // การใช้พื้นที่
query_order_status         // สถานะออเดอร์
query_picklists            // ใบหยิบสินค้า
query_receiving_orders     // ใบรับสินค้า
query_production_orders    // ใบสั่งผลิต
query_bom                  // BOM
query_routes               // เส้นทาง
query_employee_activity    // กิจกรรมพนักงาน
query_inventory_ledger     // บันทึกสต็อก
query_system_alerts        // แจ้งเตือน
query_kpi                  // KPI
query_sku_master           // ข้อมูลสินค้า
query_customers            // ข้อมูลลูกค้า
```

### 3.2 Intelligence APIs (lib/ai/chat-service.ts)
```typescript
// Intelligence Endpoints
/api/ai/intelligence/consumption      // อัตราการใช้
/api/ai/intelligence/days-of-cover    // จำนวนวันที่สต็อกจะหมด
/api/ai/intelligence/shortage-risk    // ความเสี่ยงขาดสต็อก
/api/ai/intelligence/overstock-risk   // ความเสี่ยงสต็อกเกิน
/api/ai/intelligence/expiry-risk      // ความเสี่ยงหมดอายุ
/api/ai/intelligence/utilization      // การใช้พื้นที่
```

### 3.3 Simulation APIs (lib/simulation/)
```typescript
// Simulation Endpoints
/api/ai/simulation/demand-increase    // จำลองความต้องการเพิ่ม
/api/ai/simulation/lead-time-increase // จำลอง Lead Time เพิ่ม
/api/ai/simulation/storage-reduction  // จำลองพื้นที่ลด
/api/ai/simulation/shift-change       // จำลองกำลังคนเปลี่ยน
/api/ai/simulation/compare            // เปรียบเทียบสถานการณ์
```

### 3.4 Detected Intents (chat-service.ts)
```typescript
// Current Intent Detection
- stock queries (สต็อก, คงเหลือ, เหลือเท่าไร)
- order tracking (ออเดอร์, สถานะ, ติดตาม)
- location queries (โลเคชั่น, ที่เก็บ, อยู่ที่ไหน)
- movement/history (เคลื่อนไหว, ประวัติ, รับ/จ่าย)
- consumption analysis (อัตราการใช้, consumption)
- days of cover (กี่วัน, หมดเมื่อไร)
- shortage risk (ขาดสต็อก, เสี่ยง)
- overstock risk (สต็อกเกิน, overstock)
- expiry risk (หมดอายุ, expiry)
- utilization (พื้นที่, utilization)
- KPI (สรุป, KPI, ประสิทธิภาพ)
- production (ผลิต, production)
- what-if simulation (จำลอง, ถ้า, what-if)
```

---

## 4. Gap Analysis

### 4.1 Tables Without AI Coverage (High Priority)
| Table | Business Value | Recommended Tool |
|-------|---------------|------------------|
| `wms_moves` | การโอนย้ายสต็อก | `query_transfers` |
| `wms_stock_adjustments` | การปรับสต็อก | `query_stock_adjustments` |
| `face_sheets` | ใบปะหน้า | `query_face_sheets` |
| `bonus_face_sheets` | ใบปะหน้าของแถม | `query_bonus_face_sheets` |
| `loadlists` | ใบโหลดสินค้า | `query_loadlists` |
| `replenishment_queue` | คิวเติมสินค้า | `query_replenishment` |
| `production_plan` | แผนการผลิต | `query_production_plan` |
| `material_issues` | การเบิกวัตถุดิบ | `query_material_issues` |
| `master_supplier` | ข้อมูลซัพพลายเออร์ | `query_suppliers` |
| `master_vehicle` | ข้อมูลยานพาหนะ | `query_vehicles` |

### 4.2 Menus Without AI Coverage
| Menu | Missing Capability |
|------|-------------------|
| ส่งสินค้า | ไม่มี query สำหรับ shipping status |
| รายงาน 391 | ไม่มี query สำหรับ report data |
| นับสต็อก | ไม่มี query สำหรับ stock count |
| ปรับสต็อก | ไม่มี query สำหรับ adjustments |
| นำเข้าสต็อก | ไม่มี query สำหรับ import status |
| แพ็คสินค้าออนไลน์ | ไม่มี query ทั้งหมด |
| กลยุทธ์การเก็บสินค้า | ไม่มี query สำหรับ storage strategy |
| พื้นที่จัดเตรียมสินค้า | ไม่มี query สำหรับ prep area |

### 4.3 Missing Question Types
| Question Type | Thai Example | Status |
|--------------|--------------|--------|
| Transfer Status | "สถานะการโอนย้ายเป็นอย่างไร" | ❌ ไม่มี |
| Adjustment History | "ประวัติการปรับสต็อกวันนี้" | ❌ ไม่มี |
| Face Sheet Status | "ใบปะหน้าที่รอจัดมีกี่ใบ" | ❌ ไม่มี |
| Loadlist Status | "ใบโหลดที่รอโหลดมีกี่ใบ" | ❌ ไม่มี |
| Replenishment Queue | "คิวเติมสินค้ามีกี่รายการ" | ❌ ไม่มี |
| Production Plan | "แผนผลิตสัปดาห์นี้" | ❌ ไม่มี |
| Material Issue | "การเบิกวัตถุดิบวันนี้" | ❌ ไม่มี |
| Supplier Info | "ข้อมูลซัพพลายเออร์ X" | ❌ ไม่มี |
| Vehicle Info | "รถคันไหนว่าง" | ❌ ไม่มี |
| Report 391 | "รายงาน 391 วันนี้" | ❌ ไม่มี |

---

## 5. Implementation Plan (Phase B)

### 5.1 New Tools to Add (types/ai-schema.ts)
```typescript
// Priority 1: Core Operations
query_transfers           // การโอนย้าย
query_stock_adjustments   // การปรับสต็อก
query_face_sheets         // ใบปะหน้า
query_loadlists           // ใบโหลด
query_replenishment       // คิวเติมสินค้า

// Priority 2: Production
query_production_plan     // แผนการผลิต
query_material_issues     // การเบิกวัตถุดิบ

// Priority 3: Master Data
query_suppliers           // ซัพพลายเออร์
query_vehicles            // ยานพาหนะ
query_preparation_areas   // พื้นที่จัดเตรียม

// Priority 4: Reports
query_report_391          // รายงาน 391
```

### 5.2 New Intents to Add (chat-service.ts)
```typescript
// Transfer intents
'โอนย้าย', 'transfer', 'ย้ายสินค้า', 'โอนสต็อก'

// Adjustment intents
'ปรับสต็อก', 'adjustment', 'ปรับปรุง', 'แก้ไขสต็อก'

// Face sheet intents
'ใบปะหน้า', 'face sheet', 'ปะหน้า'

// Loadlist intents
'ใบโหลด', 'loadlist', 'โหลดสินค้า'

// Replenishment intents
'เติมสินค้า', 'replenishment', 'เบิกเติม', 'คิวเติม'

// Production plan intents
'แผนผลิต', 'production plan', 'วางแผนผลิต'

// Material issue intents
'เบิกวัตถุดิบ', 'material issue', 'เบิกของ'

// Supplier intents
'ซัพพลายเออร์', 'supplier', 'ผู้จัดจำหน่าย'

// Vehicle intents
'รถ', 'vehicle', 'ยานพาหนะ', 'รถขนส่ง'

// Report intents
'รายงาน 391', 'report 391', '391'
```

### 5.3 Files to Modify
1. `types/ai-schema.ts` - เพิ่ม tool definitions
2. `lib/ai/chat-service.ts` - เพิ่ม intent detection และ query functions
3. `lib/ai/data-contract.ts` - เพิ่ม available data fields
4. `lib/ai/question-guidance.ts` - เพิ่ม question templates
5. `lib/ai/system-prompt.ts` - อัพเดท supported scope
6. `lib/ai/guardrails.ts` - เพิ่ม permissions

### 5.4 New API Endpoints to Create
```
/api/ai/transfers/status
/api/ai/adjustments/history
/api/ai/face-sheets/status
/api/ai/loadlists/status
/api/ai/replenishment/queue
/api/ai/production/plan
/api/ai/materials/issues
/api/ai/suppliers/info
/api/ai/vehicles/status
/api/ai/reports/391
```

---

## 6. Summary Statistics

### Current State
- **Total Tables**: 143
- **Tables with AI Coverage**: 17 (12%)
- **Total Menu Items**: 45
- **Menus with AI Coverage**: 15 (33%)
- **Total Tools**: 17
- **Total Intents**: ~25

### After Enhancement (Target)
- **Tables with AI Coverage**: 27 (19%)
- **Menus with AI Coverage**: 25 (56%)
- **Total Tools**: 28 (+11)
- **Total Intents**: ~40 (+15)

---

## 7. Next Steps (Phase B)

1. **B1**: Update `types/ai-schema.ts` with new tool definitions
2. **B2**: Update `lib/ai/chat-service.ts` with new intents and query functions
3. **B3**: Update `lib/ai/data-contract.ts` with new available data
4. **B4**: Update `lib/ai/question-guidance.ts` with new question templates
5. **B5**: Update `lib/ai/system-prompt.ts` with expanded scope
6. **B6**: Update `lib/ai/guardrails.ts` with new permissions
7. **B7**: Create new API endpoints
8. **B8**: Test all new capabilities
9. **B9**: Update documentation
10. **B10**: Deploy and verify

---

*Document generated by AI Chat Intelligence Upgrade - Phase A Discovery*
