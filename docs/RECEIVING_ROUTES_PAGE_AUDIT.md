# 📋 รายงานการตรวจสอบหน้า /receiving/routes อย่างละเอียด

## 📅 วันที่ตรวจสอบ: 11 มกราคม 2026

---

## 1. ภาพรวมของหน้า Routes

### 1.1 ไฟล์หลัก
- **Page Component**: `app/receiving/routes/page.tsx` (~2,170 บรรทัด)
- **URL**: `http://localhost:3000/receiving/routes`
- **วัตถุประสงค์**: จัดการแผนเส้นทางการจัดส่ง (Route Planning) สำหรับระบบ WMS

### 1.2 ฟังก์ชันหลักของหน้า
1. แสดงรายการแผนเส้นทางทั้งหมด
2. สร้างแผนเส้นทางใหม่ด้วย VRP Optimization
3. ดูตัวอย่างแผนเส้นทางบนแผนที่
4. แก้ไขเส้นทาง (Editor Mode)
5. พิมพ์เอกสารใบว่าจ้างขนส่ง
6. จัดการค่าขนส่ง
7. Export ข้อมูลเป็น Excel สำหรับ TMS

---

## 2. โครงสร้าง Components ที่เกี่ยวข้อง

### 2.1 Components หลัก

| Component | ไฟล์ | หน้าที่ |
|-----------|------|--------|
| `RoutesPage` | `app/receiving/routes/page.tsx` | หน้าหลักแสดงรายการแผนเส้นทาง |
| `RouteMap` | `components/maps/RouteMap.tsx` | แสดงแผนที่เส้นทาง |
| `OptimizationSidebar` | `components/vrp/OptimizationSidebar.tsx` | ตั้งค่า VRP Parameters |
| `DraggableStopList` | `components/receiving/DraggableStopList.tsx` | รายการจุดส่งแบบลากได้ |
| `EditorDraftOrdersPanel` | `components/receiving/EditorDraftOrdersPanel.tsx` | เพิ่มออเดอร์ร่างเข้าแผน |
| `ExcelStyleRouteEditor` | `components/receiving/ExcelStyleRouteEditor.tsx` | แก้ไขเส้นทางแบบตาราง |
| `PrintRoutePlanModal` | `components/receiving/PrintRoutePlanModal.tsx` | พิมพ์แผนเส้นทาง |
| `EditShippingCostModal` | `components/receiving/EditShippingCostModal.tsx` | แก้ไขค่าขนส่ง |
| `TransportContractModal` | `components/receiving/TransportContractModal.tsx` | ใบว่าจ้างขนส่ง |
| `SplitStopModal` | (inline in page.tsx) | แบ่งออเดอร์ไปคันอื่น |
| `MetricCard` | (inline in page.tsx) | แสดงสถิติ |

### 2.2 UI Components ที่ใช้
- `Button`, `Badge`, `Modal` จาก `@/components/ui/`
- `PageContainer`, `PageHeaderWithFilters`, `SearchInput`, `FilterSelect` จาก `@/components/ui/page-components`
- `PermissionGuard` จาก `@/components/auth/PermissionGuard`

---

## 3. API Routes ที่เกี่ยวข้อง

### 3.1 Route Plans APIs

| API Endpoint | Method | ไฟล์ | หน้าที่ |
|--------------|--------|------|--------|
| `/api/route-plans` | GET | `app/api/route-plans/route.ts` | ดึงรายการแผนเส้นทางทั้งหมด |
| `/api/route-plans` | POST | `app/api/route-plans/route.ts` | สร้างแผนเส้นทางใหม่ |
| `/api/route-plans/[id]` | GET | `app/api/route-plans/[id]/route.ts` | ดึงรายละเอียดแผน |
| `/api/route-plans/[id]` | PATCH | `app/api/route-plans/[id]/route.ts` | อัปเดตแผน (รวมถึงสถานะ) |
| `/api/route-plans/[id]/editor` | GET | `app/api/route-plans/[id]/editor/route.ts` | ดึงข้อมูลสำหรับ Editor |
| `/api/route-plans/[id]/trips` | GET | `app/api/route-plans/[id]/trips/route.ts` | ดึงเที่ยวรถในแผน |
| `/api/route-plans/[id]/metrics` | GET | - | ดึงสถิติแผน |
| `/api/route-plans/[id]/reorder-stops` | PUT | - | จัดลำดับจุดส่งใหม่ |
| `/api/route-plans/[id]/move-order` | POST | - | ย้ายออเดอร์ข้ามเที่ยว |
| `/api/route-plans/[id]/split-stop` | POST | `app/api/route-plans/[id]/split-stop/route.ts` | แบ่งออเดอร์ |
| `/api/route-plans/[id]/add-order` | POST | - | เพิ่มออเดอร์เข้าแผน |
| `/api/route-plans/[id]/resequence` | POST | - | บันทึกลำดับใหม่ |
| `/api/route-plans/[id]/bonus-orders` | GET | `app/api/route-plans/[id]/bonus-orders/route.ts` | ดึง Bonus Orders |
| `/api/route-plans/optimize` | POST | `app/api/route-plans/optimize/route.ts` | คำนวณเส้นทาง VRP |
| `/api/route-plans/inputs` | POST | - | บันทึก Input Orders |
| `/api/route-plans/draft-orders` | GET | - | ดึงออเดอร์ร่าง |
| `/api/route-plans/next-code` | GET | - | สร้างรหัสแผนถัดไป |
| `/api/route-plans/stops/[id]/cancel` | POST | - | ยกเลิกจุดส่ง |
| `/api/route-plans/stops/[id]/order` | GET | `app/api/route-plans/stops/[id]/order/route.ts` | ดึงรายละเอียดออเดอร์ในจุดส่ง |
| `/api/route-plans/trips/[id]` | GET/PATCH/DELETE | `app/api/route-plans/trips/[id]/route.ts` | จัดการเที่ยวรถ |

### 3.2 Related APIs
| API Endpoint | Method | หน้าที่ |
|--------------|--------|--------|
| `/api/master-warehouse` | GET | ดึงรายการคลังสินค้า |
| `/api/picklists` | GET/POST | จัดการ Picklists |
| `/api/loadlists` | GET/POST | จัดการ Loadlists |
| `/api/face-sheets/generate` | POST | สร้างใบปะหน้า |

---

## 4. Database Schema ที่เกี่ยวข้อง

### 4.1 ตารางหลัก

#### 4.1.1 receiving_route_plans
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| plan_id | integer | NO | auto | Primary Key |
| plan_code | varchar | YES | - | รหัสแผน (e.g., RP-20260111-001) |
| plan_name | varchar | YES | - | ชื่อแผน |
| plan_date | date | NO | - | วันที่แผน |
| warehouse_id | varchar | YES | - | FK → master_warehouse |
| status | varchar | YES | 'draft' | สถานะแผน |
| total_trips | integer | YES | - | จำนวนเที่ยวทั้งหมด |
| total_distance_km | numeric | YES | - | ระยะทางรวม (กม.) |
| total_drive_minutes | integer | YES | - | เวลาขับรวม (นาที) |
| total_service_minutes | integer | YES | - | เวลาบริการรวม (นาที) |
| total_weight_kg | numeric | YES | - | น้ำหนักรวม (กก.) |
| total_volume_cbm | numeric | YES | - | ปริมาตรรวม (ลบ.ม.) |
| total_pallets | numeric | YES | - | จำนวนพาเลทรวม |
| objective_value | numeric | YES | - | ค่า Objective จาก VRP |
| settings | jsonb | YES | - | การตั้งค่า VRP |
| created_at | timestamptz | YES | now() | วันที่สร้าง |
| updated_at | timestamptz | YES | now() | วันที่แก้ไข |
| published_at | timestamptz | YES | - | วันที่เผยแพร่ |

#### 4.1.2 receiving_route_trips
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| trip_id | integer | NO | auto | Primary Key |
| plan_id | integer | NO | - | FK → receiving_route_plans |
| trip_sequence | integer | NO | - | ลำดับเที่ยวในแผน |
| daily_trip_number | integer | YES | - | เลขคันประจำวัน (ไม่ซ้ำทั้งวัน) |
| trip_code | varchar | YES | - | รหัสเที่ยว |
| trip_status | varchar | YES | 'planned' | สถานะเที่ยว |
| vehicle_id | varchar | YES | - | FK → master_vehicle |
| driver_id | integer | YES | - | FK → master_employee |
| supplier_id | uuid | YES | - | FK → master_supplier |
| total_distance_km | numeric | YES | 0 | ระยะทางรวม |
| total_drive_minutes | integer | YES | 0 | เวลาขับรวม |
| total_service_minutes | integer | YES | 0 | เวลาบริการรวม |
| total_stops | integer | YES | 0 | จำนวนจุดส่ง |
| total_weight_kg | numeric | YES | 0 | น้ำหนักรวม |
| shipping_cost | numeric | YES | - | ค่าขนส่งรวม |
| base_price | numeric | YES | - | ราคาฐาน |
| helper_fee | numeric | YES | - | ค่าคนช่วย |
| extra_stop_fee | numeric | YES | - | ค่าจุดส่งเพิ่ม |
| porterage_fee | numeric | YES | - | ค่าขนของ |
| pricing_mode | varchar | YES | - | โหมดคำนวณราคา (formula/flat) |
| other_fees | jsonb | YES | - | ค่าใช้จ่ายอื่นๆ |
| extra_delivery_stops | jsonb | YES | - | จุดส่งพิเศษ |
| actual_stops_count | integer | YES | - | จำนวนจุดส่งจริง |
| is_overweight | boolean | YES | false | เกินน้ำหนักหรือไม่ |

#### 4.1.3 receiving_route_stops
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| stop_id | integer | NO | auto | Primary Key |
| trip_id | integer | NO | - | FK → receiving_route_trips |
| plan_id | integer | YES | - | FK → receiving_route_plans |
| sequence_no | integer | NO | - | ลำดับจุดส่ง |
| stop_name | varchar | YES | - | ชื่อจุดส่ง |
| address | text | YES | - | ที่อยู่ |
| latitude | numeric | YES | - | ละติจูด |
| longitude | numeric | YES | - | ลองจิจูด |
| customer_id | varchar | YES | - | FK → master_customer |
| order_id | bigint | YES | - | FK → wms_orders |
| input_id | integer | YES | - | FK → receiving_route_plan_inputs |
| load_weight_kg | numeric | YES | - | น้ำหนักที่จุดนี้ |
| load_volume_cbm | numeric | YES | - | ปริมาตรที่จุดนี้ |
| load_units | integer | YES | - | จำนวนหน่วย |
| load_pallets | numeric | YES | - | จำนวนพาเลท |
| service_duration_minutes | integer | YES | - | เวลาบริการ (นาที) |
| planned_arrival_at | timestamptz | YES | - | เวลาถึงตามแผน |
| planned_departure_at | timestamptz | YES | - | เวลาออกตามแผน |
| tags | jsonb | YES | - | ข้อมูลเพิ่มเติม (order_ids, customer_id) |
| notes | text | YES | - | หมายเหตุ |

#### 4.1.4 receiving_route_stop_items
| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary Key |
| stop_id | integer | FK → receiving_route_stops |
| trip_id | integer | FK → receiving_route_trips |
| order_id | bigint | FK → wms_orders |
| order_item_id | bigint | FK → wms_order_items |
| sku_id | varchar | รหัส SKU |
| sku_name | varchar | ชื่อ SKU |
| allocated_quantity | numeric | จำนวนที่จัดสรร |
| allocated_weight_kg | numeric | น้ำหนักที่จัดสรร |

#### 4.1.5 receiving_route_plan_inputs
| Column | Type | Description |
|--------|------|-------------|
| input_id | integer | Primary Key |
| plan_id | integer | FK → receiving_route_plans |
| order_id | bigint | FK → wms_orders |
| stop_name | varchar | ชื่อจุดส่ง |
| latitude | numeric | ละติจูด |
| longitude | numeric | ลองจิจูด |
| demand_weight_kg | numeric | น้ำหนักที่ต้องการส่ง |
| demand_volume_cbm | numeric | ปริมาตรที่ต้องการส่ง |
| demand_units | integer | จำนวนหน่วย |
| priority | integer | ลำดับความสำคัญ |
| service_duration_minutes | integer | เวลาบริการ |
| is_active | boolean | ใช้งานหรือไม่ |

---

## 5. Database Functions และ Triggers

### 5.1 Functions ที่เกี่ยวข้อง

| Function | หน้าที่ |
|----------|--------|
| `get_next_daily_trip_number(p_plan_date)` | ดึงเลขคันถัดไปสำหรับวันที่กำหนด (ใช้ advisory lock ป้องกัน race condition) |
| `reserve_daily_trip_numbers(p_plan_date)` | จองเลขคันสำหรับวันที่กำหนด |
| `insert_trips_with_daily_numbers(p_plan_date, p_trips)` | Insert trips พร้อมกำหนด daily_trip_number |
| `create_picklist_for_trip(p_trip_id, p_user_id)` | สร้าง Picklist จาก Trip |
| `create_picklist_for_special_trip(p_trip_id, p_user_id)` | สร้าง Picklist สำหรับ Special Orders |
| `cancel_route_stop_and_reset_order(p_stop_id, p_order_id)` | ยกเลิกจุดส่งและ reset ออเดอร์ |
| `remove_order_from_route(p_order_id)` | ลบออเดอร์ออกจากเส้นทาง |
| `calculate_trip_shipping_cost()` | คำนวณค่าขนส่งอัตโนมัติ (Trigger Function) |
| `update_orders_on_route_publish()` | อัปเดตสถานะออเดอร์เมื่อ publish แผน (Trigger Function) |
| `update_order_on_route_stop_creation()` | อัปเดตออเดอร์เมื่อสร้างจุดส่ง (Trigger Function) |
| `validate_route_plan_status_transition()` | ตรวจสอบการเปลี่ยนสถานะแผน (Trigger Function) |
| `update_route_plan_status_and_orders_comprehensive()` | อัปเดตสถานะแผนและออเดอร์ทั้งหมด |
| `get_trips_for_picklist_creation()` | ดึง Trips ที่พร้อมสร้าง Picklist |
| `get_freight_rate_for_route()` | ดึงอัตราค่าขนส่งสำหรับเส้นทาง |

### 5.2 Triggers ที่เกี่ยวข้อง
| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| `trigger_calculate_trip_shipping_cost` | receiving_route_trips | INSERT/UPDATE | calculate_trip_shipping_cost() |
| `trigger_update_orders_on_route_publish` | receiving_route_plans | UPDATE | update_orders_on_route_publish() |
| `trigger_update_order_on_route_stop_creation` | receiving_route_stops | INSERT | update_order_on_route_stop_creation() |
| `trigger_validate_route_plan_status` | receiving_route_plans | UPDATE | validate_route_plan_status_transition() |
| `trigger_update_extra_stops_count` | receiving_route_trips | INSERT/UPDATE | update_extra_stops_count() |

---

## 6. State Management และ Data Flow

### 6.1 State Variables หลัก
```typescript
// Route Plans List
const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
const [selectedStatus, setSelectedStatus] = useState<string>('all');
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [sortField, setSortField] = useState<keyof RoutePlan | ''>('');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

// Draft Orders
const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

// Create Plan Modal
const [showCreateModal, setShowCreateModal] = useState(false);
const [planForm, setPlanForm] = useState({...});
const [warehouses, setWarehouses] = useState<any[]>([]);

// VRP Settings
const [vrpSettings, setVrpSettings] = useState<OptimizationSettings>({...});
const [isOptimizing, setIsOptimizing] = useState(false);

// Preview Modal
const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
const [previewPlan, setPreviewPlan] = useState<any | null>(null);
const [previewTrips, setPreviewTrips] = useState<any[]>([]);

// Editor Mode
const [isEditorOpen, setIsEditorOpen] = useState(false);
const [editorPlanId, setEditorPlanId] = useState<number | null>(null);
const [editorTrips, setEditorTrips] = useState<EditorTrip[]>([]);
const [selectedEditorTripId, setSelectedEditorTripId] = useState<number | null>(null);
const [selectedEditorStopId, setSelectedEditorStopId] = useState<number | null>(null);

// Expandable Rows
const [expandedPlanIds, setExpandedPlanIds] = useState<Set<number>>(new Set());
const [planTripsData, setPlanTripsData] = useState<Map<number, any[]>>(new Map());

// Modals
const [showPrintModal, setShowPrintModal] = useState(false);
const [showEditShippingCostModal, setShowEditShippingCostModal] = useState(false);
const [showTransportContractModal, setShowTransportContractModal] = useState(false);
const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
```

### 6.2 Data Flow Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Routes Page                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ fetchRoute   │───▶│ routePlans   │───▶│ Table View   │       │
│  │ Plans()      │    │ state        │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                       │                │
│         │                                       ▼                │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         │            │ toggleExpand │───▶│ Trips Detail │       │
│         │            │ Plan()       │    │              │       │
│         │            └──────────────┘    └──────────────┘       │
│         │                                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ fetchDraft   │───▶│ draftOrders  │───▶│ Order Select │       │
│  │ Orders()     │    │ state        │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         │                   ▼                   ▼                │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         │            │ handleOptim  │───▶│ VRP API      │       │
│         │            │ ize()        │    │              │       │
│         │            └──────────────┘    └──────────────┘       │
│         │                   │                                    │
│         │                   ▼                                    │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         │            │ handlePrev   │───▶│ Preview      │       │
│         │            │ iewPlan()    │    │ Modal        │       │
│         │            └──────────────┘    └──────────────┘       │
│         │                                       │                │
│         │                                       ▼                │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         │            │ handleOpen   │───▶│ Editor Mode  │       │
│         │            │ Editor()     │    │              │       │
│         │            └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. ปุ่มและ Actions ทั้งหมด

### 7.1 ปุ่มในหน้าหลัก (Route Plans List)

| ปุ่ม | Icon | Action | API Call | Description |
|------|------|--------|----------|-------------|
| สร้างแผนใหม่ | Plus | `handleCreatePlan()` | GET `/api/route-plans/next-code` | เปิด Modal สร้างแผนใหม่ |
| ค้นหา | Search | `setSearchTerm()` | - | กรองรายการตามคำค้นหา |
| กรองสถานะ | - | `setSelectedStatus()` | - | กรองตามสถานะ |
| เรียงลำดับ | ArrowUpDown | `handleSort()` | - | เรียงลำดับตาม column |
| ขยาย/ย่อแผน | ChevronDown | `toggleExpandPlan()` | GET `/api/route-plans/[id]/trips` | แสดง/ซ่อนรายละเอียดเที่ยว |

### 7.2 ปุ่มในแต่ละแถว (Per Row Actions)
| ปุ่ม | Icon | Action | API Call | Description |
|------|------|--------|----------|-------------|
| ดูตัวอย่าง | Eye | `handlePreviewPlan()` | GET `/api/route-plans/[id]/editor`, `/api/route-plans/[id]/metrics` | เปิด Preview Modal พร้อมแผนที่ |
| แก้ไข | Edit | `handleOpenEditor()` | GET `/api/route-plans/[id]/editor` | เปิด Editor Mode |
| พิมพ์ใบว่าจ้าง | Printer | `handlePrintPlan()` | PATCH `/api/route-plans/[id]` (status → pending_approval) | เปิด Transport Contract Modal |
| แก้ไขค่าขนส่ง | DollarSign | `setShowEditShippingCostModal(true)` | - | เปิด Edit Shipping Cost Modal |
| Export TMS | FileSpreadsheet | `handleExportTMS()` | GET `/api/route-plans/[id]/editor`, `/api/route-plans/[id]/bonus-orders` | Export Excel สำหรับ TMS |

### 7.3 ปุ่มใน Create Plan Modal
| ปุ่ม | Action | API Call | Description |
|------|--------|----------|-------------|
| เลือกคลัง | `handleWarehouseChange()` | GET `/api/route-plans/draft-orders` | เปลี่ยนคลังและโหลดออเดอร์ร่าง |
| เลือกทั้งหมด | `handleSelectAll()` | - | เลือก/ยกเลิกเลือกออเดอร์ทั้งหมด |
| เลือกออเดอร์ | `handleSelectOrder()` | - | เลือก/ยกเลิกเลือกออเดอร์ |
| บันทึกการตั้งค่า | `handleSaveSettings()` | localStorage | บันทึก VRP Settings |
| จัดเส้นทาง | `handleOptimize()` | POST `/api/route-plans`, POST `/api/route-plans/inputs`, POST `/api/route-plans/optimize` | สร้างแผนและคำนวณ VRP |

### 7.4 ปุ่มใน Preview Modal
| ปุ่ม | Action | API Call | Description |
|------|--------|----------|-------------|
| เลือกเที่ยว | `setSelectedPreviewTripIndex()` | - | เลือกเที่ยวที่จะแสดงบนแผนที่ |
| ลากจุดส่ง | `handleReorderStopsInPreview()` | PUT `/api/route-plans/[id]/reorder-stops` | จัดลำดับจุดส่งใหม่ |
| ย้ายออเดอร์ | `handleMoveOrder()` | POST `/api/route-plans/[id]/move-order` | ย้ายออเดอร์ข้ามเที่ยว |
| ปิด | `closePreviewModal()` | - | ปิด Modal |

### 7.5 ปุ่มใน Editor Mode
| ปุ่ม | Action | API Call | Description |
|------|--------|----------|-------------|
| เลือกเที่ยว | `setSelectedEditorTripId()` | - | เลือกเที่ยวที่จะแก้ไข |
| เลือกจุดส่ง | `handleSelectEditorStop()` | - | เลือกจุดส่งที่จะแก้ไข |
| ย้ายขึ้น/ลง | `handleMoveStop()` | - | ย้ายลำดับจุดส่ง |
| ลากจุดส่ง | `handleReorderStops()` | PUT `/api/route-plans/[id]/reorder-stops` | จัดลำดับจุดส่งใหม่ |
| ย้ายไปเที่ยวอื่น | `handleTransferStop()` | - | ย้ายจุดส่งไปเที่ยวอื่น |
| แบ่งออเดอร์ | `handleOpenSplitModal()` | - | เปิด Split Modal |
| ยกเลิกจุดส่ง | `handleCancelStop()` | POST `/api/route-plans/stops/[id]/cancel` | ยกเลิกจุดส่งและ reset ออเดอร์ |
| เพิ่มออเดอร์ | `handleAddOrderToEditor()` | POST `/api/route-plans/[id]/add-order` | เพิ่มออเดอร์ร่างเข้าแผน |
| บันทึก | `handleSaveEditor()` | POST `/api/route-plans/[id]/resequence` | บันทึกการแก้ไข |
| ปิด | `handleCloseEditor()` | - | ปิด Editor |

### 7.6 ปุ่มใน Split Modal
| ปุ่ม | Action | API Call | Description |
|------|--------|----------|-------------|
| เลือกจำนวนชิ้น | `handlePiecesChange()` | - | กำหนดจำนวนชิ้นที่จะย้าย |
| ทั้งหมด | `handleFillAll()` | - | เลือกทั้งหมดของ item นั้น |
| เลือกเที่ยวปลายทาง | `setTargetTripId()` | - | เลือกเที่ยวที่จะย้ายไป |
| แยกออเดอร์ | `handleSplitSubmit()` | POST `/api/route-plans/[id]/split-stop` | แบ่งออเดอร์ไปเที่ยวอื่น |
| ยกเลิก | `setIsSplitModalOpen(false)` | - | ปิด Modal |

---

## 8. Status Flow และ State Machine

### 8.1 Route Plan Status Flow
```
┌─────────┐     ┌────────────┐     ┌───────────┐     ┌──────────────────┐
│  draft  │────▶│ optimizing │────▶│ published │────▶│ pending_approval │
└─────────┘     └────────────┘     └───────────┘     └──────────────────┘
     │                │                  │                    │
     │                │                  │                    ▼
     │                │                  │            ┌───────────┐
     │                │                  │            │ approved  │
     │                │                  │            └───────────┘
     │                │                  │                    │
     │                │                  │                    ▼
     │                │                  │            ┌───────────────┐
     │                │                  └───────────▶│ ready_to_load │
     │                │                               └───────────────┘
     │                │                                       │
     │                │                                       ▼
     │                │                               ┌────────────┐
     │                │                               │ in_transit │
     │                │                               └────────────┘
     │                │                                       │
     │                │                                       ▼
     │                │                               ┌───────────┐
     │                │                               │ completed │
     │                │                               └───────────┘
     │                │
     ▼                ▼
┌───────────┐
│ cancelled │
└───────────┘
```

### 8.2 Status Transitions ที่อนุญาต
| From Status | To Status (Allowed) |
|-------------|---------------------|
| draft | optimizing, published, cancelled |
| optimizing | published, draft, cancelled |
| published | pending_approval, ready_to_load, cancelled |
| pending_approval | approved, published, cancelled |
| approved | ready_to_load, cancelled |
| ready_to_load | in_transit, approved, cancelled |
| in_transit | completed |
| completed | (final state) |
| cancelled | (final state) |

### 8.3 Order Status Updates เมื่อ Route Plan เปลี่ยนสถานะ
| Route Plan Status | Order Status Change |
|-------------------|---------------------|
| published | draft → confirmed |
| (via Trigger) | confirmed_at = NOW() |

---

## 9. VRP Optimization Settings

### 9.1 OptimizationSettings Interface
```typescript
interface OptimizationSettings {
  vehicleCapacityKg: number;      // ความจุรถ (กก.)
  warehouseLat: number;           // ละติจูดคลัง
  warehouseLng: number;           // ลองจิจูดคลัง
  maxWorkingHours: number;        // ชั่วโมงทำงานสูงสุด
  startTime: string;              // เวลาเริ่มงาน
  endTime: string;                // เวลาเลิกงาน
  maxStops: number;               // จุดส่งสูงสุดต่อเที่ยว
  serviceTime: number;            // เวลาบริการต่อจุด (นาที)
  zoneMethod: string;             // วิธีแบ่งโซน (kmeans, etc.)
  numZones: number;               // จำนวนโซน
  maxStoresPerZone: number;       // ร้านสูงสุดต่อโซน
  consolidationEnabled: boolean;  // รวมจุดส่งใกล้กัน
  distanceThreshold: number;      // ระยะทางสำหรับรวมจุด (เมตร)
  detourFactor: number;           // ตัวคูณอ้อม
  routingAlgorithm: string;       // อัลกอริทึม (insertion, etc.)
  localSearchMethod: string;      // วิธี Local Search (2opt, etc.)
  stopOrderingMethod: string;     // วิธีเรียงจุดส่ง
  maxVehicles: number;            // จำนวนรถสูงสุด
  enforceVehicleLimit: boolean;   // บังคับจำกัดรถ
  avgSpeedKmh: number;            // ความเร็วเฉลี่ย (กม./ชม.)
  respectTimeWindows: string;     // เคารพ Time Windows
  ignoreSmallDeliveries: boolean; // ข้ามการส่งขนาดเล็ก
  smallDeliveryWeightThreshold: number; // น้ำหนักขั้นต่ำ
  useMapboxApi: boolean;          // ใช้ Mapbox API
  costPerKm: number;              // ค่าใช้จ่ายต่อ กม.
  costPerVehicle: number;         // ค่าใช้จ่ายต่อรถ
  driverHourlyRate: number;       // ค่าแรงคนขับต่อชั่วโมง
  maxComputationTime: number;     // เวลาคำนวณสูงสุด (วินาที)
  optimizationCriteria: string;   // เกณฑ์ Optimize (distance, cost)
}
```

---

## 10. ความสัมพันธ์กับหน้าอื่น

### 10.1 หน้าที่เกี่ยวข้องโดยตรง

| หน้า | URL | ความสัมพันธ์ |
|------|-----|-------------|
| Orders | `/receiving/orders` | ออเดอร์ที่ใช้สร้างแผนเส้นทาง |
| Picklists | `/receiving/picklists` | สร้าง Picklist จาก Trip |
| Loadlists | `/receiving/loadlists` | สร้าง Loadlist จาก Trip |
| Face Sheets | `/receiving/picklists/face-sheets` | ใบปะหน้าสำหรับ Express Orders |
| Bonus Face Sheets | `/receiving/picklists/bonus-face-sheets` | ใบปะหน้าสำหรับ Bonus Items |
| Master Vehicles | `/master-data/vehicles` | ข้อมูลรถที่ใช้ในแผน |
| Master Employees | `/master-data/employees` | ข้อมูลคนขับ |
| Master Customers | `/master-data/customers` | ข้อมูลลูกค้า/จุดส่ง |
| Master Warehouses | `/master-data/warehouses` | ข้อมูลคลังสินค้า |

### 10.2 Flow การทำงานร่วมกับหน้าอื่น
```
┌─────────────────┐
│ /receiving/     │
│ orders          │
│ (สร้างออเดอร์)   │
└────────┬────────┘
         │ status: draft
         ▼
┌─────────────────┐
│ /receiving/     │
│ routes          │
│ (จัดเส้นทาง)    │
└────────┬────────┘
         │ status: confirmed (เมื่อ publish)
         ▼
┌─────────────────┐
│ /receiving/     │
│ picklists       │
│ (สร้าง Picklist)│
└────────┬────────┘
         │ status: in_picking
         ▼
┌─────────────────┐
│ /receiving/     │
│ loadlists       │
│ (สร้าง Loadlist)│
└────────┬────────┘
         │ status: loaded → in_transit
         ▼
┌─────────────────┐
│ Mobile Loading  │
│ (ขึ้นของ)        │
└────────┬────────┘
         │ status: delivered
         ▼
┌─────────────────┐
│ Route Plan      │
│ completed       │
└─────────────────┘
```

---

## 11. Components รายละเอียด

### 11.1 DraggableStopList Component
**ไฟล์**: `components/receiving/DraggableStopList.tsx`
**หน้าที่**: แสดงรายการจุดส่งที่สามารถลากเพื่อจัดลำดับได้

**Props**:
```typescript
interface DraggableStopListProps {
  stops: EditorStop[];
  selectedStopId: number | null;
  selectedOrderId: number | null;
  onReorder: (reorderedStops: EditorStop[]) => void;
  onSelectStop: (stopId: number, orderId: number | null) => void;
}
```

**Features**:
- ใช้ `@dnd-kit/core` และ `@dnd-kit/sortable` สำหรับ drag-and-drop
- รองรับ consolidated stops (หลาย orders ในจุดเดียว)
- แสดงข้อมูล: ลำดับ, เลขออเดอร์, ชื่อลูกค้า, น้ำหนัก, เวลาบริการ, หมายเหตุ

### 11.2 EditorDraftOrdersPanel Component
**ไฟล์**: `components/receiving/EditorDraftOrdersPanel.tsx`
**หน้าที่**: แสดงรายการออเดอร์ร่างที่สามารถเพิ่มเข้าแผนได้

**Props**:
```typescript
interface EditorDraftOrdersPanelProps {
  draftOrders: DraftOrder[];
  trips: Trip[];
  loading?: boolean;
  onAddOrder: (orderId: number, tripId: number, sequence: number) => Promise<void>;
}
```

**Features**:
- ค้นหาออเดอร์ตามเลขออเดอร์หรือชื่อร้าน
- เลือกเที่ยวและลำดับที่จะเพิ่ม
- แสดงจำนวนจุดส่งในแต่ละเที่ยว

### 11.3 ExcelStyleRouteEditor Component
**ไฟล์**: `components/receiving/ExcelStyleRouteEditor.tsx` (~936 บรรทัด)
**หน้าที่**: แก้ไขเส้นทางแบบตาราง Excel

**Props**:
```typescript
interface ExcelStyleRouteEditorProps {
  planId: number;
  planName: string;
  trips: any[];
  onSave: (changes: RouteChanges) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}
```

**Features**:
- แสดงข้อมูลแบบตาราง: คัน, จุด, เลขออเดอร์, รหัสลูกค้า, ชื่อร้าน, จังหวัด, น้ำหนัก, จำนวน
- เปลี่ยนเลขคันด้วย dropdown
- เปลี่ยนลำดับจุดด้วย dropdown
- แบ่งออเดอร์ (Split) ไปคันอื่น
- ลบจุดส่ง
- เพิ่มคันใหม่
- Track changes และบันทึกเป็น batch

**RouteChanges Interface**:
```typescript
interface RouteChanges {
  moves: Array<{
    orderId: number;
    fromTripId: number | string;
    toTripId: number | string;
    newSequence: number;
  }>;
  reorders: Array<{
    tripId: number | string;
    orderedStopIds: (number | string)[];
  }>;
  splits: Array<{
    orderId: number;
    sourceStopId: number | string;
    targetTripId: number | string | 'new';
    splitWeightKg: number;
    splitItems?: { orderItemId: number; quantity: number; weightKg: number }[];
  }>;
  newTrips: Array<{
    tripName?: string;
  }>;
  deletes?: Array<{
    stopId: number | string;
    orderId: number;
    tripId: number | string;
  }>;
}
```

### 11.4 SplitStopModal Component
**ไฟล์**: inline ใน `app/receiving/routes/page.tsx`
**หน้าที่**: Modal สำหรับแบ่งออเดอร์ไปคันอื่น

**Features**:
- โหลดรายละเอียดสินค้าจาก API `/api/route-plans/stops/[id]/order`
- เลือกจำนวนชิ้นที่ต้องการย้ายแต่ละ item
- แสดงน้ำหนักคงเหลือในคันเดิม vs น้ำหนักที่ย้าย
- เลือกเที่ยวปลายทางหรือสร้างเที่ยวใหม่
- กำหนดเวลาบริการและหมายเหตุ

---

## 12. Error Handling และ Edge Cases

### 12.1 Error Handling ที่มี
| Scenario | Handling |
|----------|----------|
| API Error | แสดง error message ใน state และ alert |
| No Draft Orders | แสดงข้อความ "ไม่มีออเดอร์ร่าง" |
| No Coordinates | แสดง warning และแผนที่ไม่แสดงจุด |
| Fallback Mode | ใช้ข้อมูลจาก settings.optimizedTrips ถ้าไม่มีใน DB |
| Invalid Status Transition | Trigger จะ raise exception |
| Race Condition (daily_trip_number) | ใช้ advisory lock ใน function |

### 12.2 Edge Cases ที่ต้องระวัง
1. **Consolidated Stops**: จุดส่งที่มีหลาย orders ต้อง handle tags.order_ids
2. **Split Orders**: ต้อง track ว่า items ไหนถูกแบ่งไปแล้ว
3. **Fallback Mode**: เมื่อ trips ยังไม่ได้บันทึกใน DB (trip_id เป็น string "fallback-X")
4. **Daily Trip Number**: ต้องไม่ซ้ำกันทั้งวันข้ามแผน
5. **Status Validation**: ต้องผ่าน trigger validation ก่อนเปลี่ยนสถานะ

---

## 13. Performance Considerations

### 13.1 Data Loading
- Route Plans: โหลดพร้อม trips และ stops ในครั้งเดียว
- Expandable Rows: โหลด trips เมื่อ expand เท่านั้น
- Editor Data: โหลดแยกเมื่อเปิด Editor
- Draft Orders: โหลดเมื่อเปลี่ยนคลังหรือวันที่

### 13.2 Optimization
- ใช้ `useMemo` สำหรับ computed values
- ใช้ `useCallback` สำหรับ event handlers
- Optimistic updates สำหรับ drag-and-drop
- Batch updates สำหรับ ExcelStyleRouteEditor

---

## 14. Security และ Permissions

### 14.1 Permission Guard
```typescript
<PermissionGuard module="receiving" action="view">
  {/* Page Content */}
</PermissionGuard>
```

### 14.2 API Authentication
- ทุก API ใช้ `withAuth` wrapper
- ตรวจสอบ session ก่อนทำงาน

---

## 15. สรุปและข้อเสนอแนะ

### 15.1 จุดแข็ง
1. ✅ ครอบคลุม workflow การจัดเส้นทางครบถ้วน
2. ✅ รองรับ VRP Optimization
3. ✅ มี Editor Mode สำหรับแก้ไขแบบ manual
4. ✅ รองรับ Split Orders
5. ✅ มี Fallback Mode เมื่อข้อมูลยังไม่ครบ
6. ✅ มี Status Validation ผ่าน Trigger
7. ✅ รองรับ Export TMS Excel

### 15.2 จุดที่ควรปรับปรุง
1. ⚠️ ไฟล์ page.tsx มีขนาดใหญ่มาก (~2,170 บรรทัด) ควรแยก components
2. ⚠️ บาง API ไม่มี error handling ที่ดีพอ
3. ⚠️ ควรเพิ่ม loading states ให้ครบทุก action
4. ⚠️ ควรเพิ่ม confirmation dialog ก่อน destructive actions

### 15.3 Dependencies ที่ใช้
- `@dnd-kit/core`, `@dnd-kit/sortable` - Drag and Drop
- `xlsx` - Excel Export
- `lucide-react` - Icons
- Mapbox GL - Map Visualization

---

## 16. Appendix: Type Definitions

### 16.1 RoutePlan Interface
```typescript
interface RoutePlan {
  plan_id: number;
  plan_code: string;
  plan_name?: string;
  plan_date: string;
  warehouse_id: string;
  warehouse?: { warehouse_name?: string };
  status: string;
  total_trips?: number;
  total_distance_km?: number;
  total_drive_minutes?: number;
  total_service_minutes?: number;
  total_weight_kg?: number;
  total_volume_cbm?: number;
  total_pallets?: number;
  objective_value?: number;
}
```

### 16.2 EditorTrip Interface
```typescript
interface EditorTrip {
  trip_id: number;
  trip_number?: number;
  trip_sequence: number;
  daily_trip_number?: number;
  trip_code: string;
  trip_status: string;
  vehicle_id?: string | number | null;
  driver_id?: string | number | null;
  vehicle_label?: string | null;
  driver_label?: string | null;
  vehicle_name?: string | null;
  driver_name?: string | null;
  total_distance_km?: number | null;
  total_drive_minutes?: number | null;
  total_service_minutes?: number | null;
  total_weight_kg?: number | null;
  total_volume_cbm?: number | null;
  total_stops?: number | null;
  manual_override?: boolean;
  is_overweight?: boolean;
  stops: EditorStop[];
}
```

### 16.3 EditorStop Interface
```typescript
interface EditorStop {
  stop_id: number;
  sequence_no: number;
  stop_name: string;
  address?: string | null;
  load_weight_kg?: number | null;
  load_volume_cbm?: number | null;
  load_pallets?: number | null;
  load_units?: number | null;
  service_duration_minutes?: number | null;
  manual_override?: boolean;
  override_note?: string | null;
  split_from_stop_id?: number | null;
  order_id?: number | null;
  order_no?: string | null;
  order_ids?: number[];
  orders?: StopOrderDetail[];
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  tags?: {
    order_ids?: number[];
    customer_id?: string;
  };
}
```

### 16.4 StopOrderDetail Interface
```typescript
interface StopOrderDetail {
  order_id: number | null;
  order_no?: string | null;
  customer_name?: string | null;
  allocated_weight_kg?: number | null;
  total_order_weight_kg?: number | null;
  items?: OrderItemDetail[];
}
```

---

**เอกสารนี้สร้างโดย AI Assistant เมื่อวันที่ 11 มกราคม 2026**
**ตรวจสอบจากโค้ดจริงในโปรเจค AustamGood WMS**
