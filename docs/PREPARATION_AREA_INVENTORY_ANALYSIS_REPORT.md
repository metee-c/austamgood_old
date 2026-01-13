# รายงานวิเคราะห์หน้า Preparation Area Inventory

**วันที่วิเคราะห์:** 13 มกราคม 2569  
**ผู้วิเคราะห์:** AI Assistant  
**สถานะ:** เสร็จสมบูรณ์

---

## 📋 สารบัญ

1. [สรุปผู้บริหาร](#1-สรุปผู้บริหาร)
2. [โครงสร้างปัจจุบัน](#2-โครงสร้างปัจจุบัน)
3. [การวิเคราะห์ Performance](#3-การวิเคราะห์-performance)
4. [Dependencies และผลกระทบ](#4-dependencies-และผลกระทบ)
5. [ข้อเสนอแนะ](#5-ข้อเสนอแนะ)
6. [แผนการดำเนินงาน](#6-แผนการดำเนินงาน)

---

## 1. สรุปผู้บริหาร

### ปัญหาที่พบ
หน้า `/warehouse/preparation-area-inventory` มี 4 แท็บที่ใช้ตารางเดียวกัน (`wms_inventory_balances`) แต่กรองด้วย `location_id` ที่แตกต่างกัน ทำให้:
- ต้อง query ข้อมูลทั้งหมดแล้วค่อยกรองที่ frontend
- แท็บ Dispatch และ Delivery ต้อง query ข้อมูลเพิ่มเติมจากหลายตาราง (picklists, face_sheets, bonus_face_sheets)
- Performance ยังดี (3.14ms) แต่มีความซับซ้อนในโค้ด

### ข้อค้นพบสำคัญ
| รายการ | ค่า |
|--------|-----|
| Query Time ปัจจุบัน | **3.14 ms** (เร็วมาก) |
| จำนวน Records รวม | **585 records** |
| Indexes ที่มี | **9 indexes** (ครอบคลุมดี) |
| Triggers | **7 triggers** |
| Foreign Keys | **7 FK constraints** |

### ข้อเสนอแนะ
**ไม่แนะนำให้แยกตาราง** เนื่องจาก:
1. Performance ปัจจุบันดีมาก (3.14ms)
2. มี Indexes ครอบคลุมแล้ว
3. การแยกตารางจะเพิ่มความซับซ้อนและ maintenance cost

**แนะนำ:** ปรับปรุง API และ Frontend แทน

---

## 2. โครงสร้างปัจจุบัน

### 2.1 หน้า Page และ Components

**ไฟล์หลัก:**
```
app/warehouse/preparation-area-inventory/page.tsx (1,536 บรรทัด)
```

**Components ที่ใช้:**
- `ReservationDetailsModal` - แสดงรายละเอียด reservation
- `ReservationPopover` - popup แสดง reservation
- `PreparedDocumentsTable` - ตารางเอกสารที่เตรียมแล้ว

### 2.2 รายละเอียด 4 แท็บ

| แท็บ | ชื่อ | Location Filter | Records | Total Pieces | API |
|------|------|-----------------|---------|--------------|-----|
| 1 | บ้านหยิบ (Preparation) | `preparation_area.area_code` ยกเว้น PK002 | 337 | 117,039.85 | Direct Supabase |
| 2 | Premium (PK002) | `PK002` | 75 | 8,414 | Direct Supabase |
| 3 | Dispatch | `Dispatch` | 86 | -803 | `/api/warehouse/dispatch-inventory` |
| 4 | Delivery-In-Progress | `Delivery-In-Progress` | 87 | 69,088 | `/api/warehouse/delivery-inventory` |

### 2.3 Preparation Areas (54 areas)

```
A09-01-001 ถึง A09-01-026 (26 areas) - บ้านหยิบเฉพาะ TT-*
A10-01-001 ถึง A10-01-026 (26 areas) - บ้านหยิบเฉพาะ B-*
PK001 - พื้นที่จัดสินค้า PF-Zone
PK002 - พื้นที่จัดสินค้า PF-Premium
```

### 2.4 API Routes

**Tab 1 & 2:** Query ตรงจาก Supabase client
```typescript
// Tab 1: Preparation
.from('wms_inventory_balances')
.in('location_id', prepAreaCodes)
.order('updated_at', { ascending: false })
.limit(2000)

// Tab 2: Premium
.from('wms_inventory_balances')
.in('location_id', ['PK002'])
```

**Tab 3: Dispatch** (`/api/warehouse/dispatch-inventory`)
- Query `wms_inventory_balances` WHERE `location_id = 'Dispatch'`
- Join กับ `bonus_face_sheet_items`, `picklist_items`, `face_sheet_items`
- กรอง items ที่ loadlist ยังไม่ loaded

**Tab 4: Delivery** (`/api/warehouse/delivery-inventory`)
- Query `wms_inventory_balances` WHERE `location_id = 'Delivery-In-Progress'`
- Join กับ `picklist_items`, `face_sheet_items`, `bonus_face_sheet_items`
- กรอง items ที่ loadlist status = 'loaded'

---

## 3. การวิเคราะห์ Performance

### 3.1 Query Plan Analysis

```sql
EXPLAIN ANALYZE
SELECT b.*, s.sku_name, l.location_name
FROM wms_inventory_balances b
LEFT JOIN master_sku s ON s.sku_id = b.sku_id
LEFT JOIN master_location l ON l.location_id = b.location_id
WHERE b.location_id IN (SELECT area_code FROM preparation_area WHERE status = 'active')
ORDER BY b.updated_at DESC
LIMIT 2000;
```

**ผลลัพธ์:**
- **Planning Time:** 7.707 ms
- **Execution Time:** 3.143 ms
- **Sort Method:** quicksort (Memory: 174kB)
- **Index Used:** `idx_wms_inventory_balances_location`

### 3.2 Indexes ที่มีอยู่

| Index Name | Type | Columns |
|------------|------|---------|
| `wms_inventory_balances_pkey` | UNIQUE | `balance_id` |
| `idx_wms_inventory_balances_location` | INDEX | `location_id` |
| `idx_wms_inventory_balances_pallet` | INDEX | `pallet_id` |
| `idx_balance_sku_location_pallet` | UNIQUE | `sku_id, location_id, pallet_id` |
| `uq_inventory_balances_combo` | UNIQUE | `warehouse_id, sku_id, location_id, pallet_id` |
| `idx_balances_fefo_fifo` | INDEX | `warehouse_id, location_id, sku_id, expiry_date, production_date, created_at` |
| `idx_inventory_balances_negative` | INDEX | `warehouse_id, location_id, sku_id` WHERE `total_piece_qty < 0` |
| `idx_inventory_balances_over_reserved` | INDEX | `warehouse_id, location_id, sku_id` WHERE `reserved_piece_qty > total_piece_qty` |

### 3.3 สรุป Performance

| Metric | ค่า | สถานะ |
|--------|-----|-------|
| Query Time | 3.14 ms | ✅ ดีมาก |
| Index Coverage | 100% | ✅ ครอบคลุม |
| Memory Usage | 174 KB | ✅ ต่ำ |
| Bottleneck | ไม่มี | ✅ |

---

## 4. Dependencies และผลกระทบ

### 4.1 ตารางที่เกี่ยวข้อง

**ตารางหลัก:**
- `wms_inventory_balances` - ข้อมูล stock balance

**ตาราง Master:**
- `master_sku` - ข้อมูลสินค้า
- `master_location` - ข้อมูลตำแหน่ง
- `master_warehouse` - ข้อมูลคลัง
- `preparation_area` - รายการ preparation areas

**ตาราง Reservation:**
- `picklist_item_reservations`
- `face_sheet_item_reservations`
- `bonus_face_sheet_item_reservations`

### 4.2 Triggers บน wms_inventory_balances

| Trigger | Event | Timing |
|---------|-------|--------|
| `trg_sync_location_qty_from_balance` | INSERT/UPDATE/DELETE | AFTER |
| `trg_update_location_qty_insert` | INSERT | AFTER |
| `trg_update_location_qty_update` | UPDATE | AFTER |
| `trg_update_location_qty_delete` | DELETE | AFTER |
| `trg_wms_inventory_balances_updated_at` | UPDATE | BEFORE |

### 4.3 ไฟล์ที่ใช้ wms_inventory_balances

**API Routes (10+ files):**
- `app/api/warehouse/dispatch-inventory/route.ts`
- `app/api/warehouse/delivery-inventory/route.ts`
- `app/api/ai/stock/consumption/route.ts`

**Library Files (10+ files):**
- `lib/database/stock-adjustment.ts`
- `lib/database/stock-validation.ts`
- `lib/database/prep-area-balance.ts`
- `lib/database/order-rollback.ts`
- `lib/database/move.ts`
- `lib/database/receive.ts`
- `lib/database/production-orders.ts`
- `lib/database/production-planning.ts`
- `lib/database/stock-import.ts`
- `lib/intelligence/consumption-engine.ts`
- `lib/simulation/models/storage-model.ts`

### 4.4 Foreign Key Constraints

| Referencing Table | Column | Referenced Table |
|-------------------|--------|------------------|
| `wms_inventory_balances` | `location_id` | `master_location` |
| `wms_inventory_balances` | `warehouse_id` | `master_warehouse` |
| `wms_inventory_balances` | `sku_id` | `master_sku` |
| `wms_inventory_balances` | `last_move_id` | `wms_moves` |
| `picklist_item_reservations` | `balance_id` | `wms_inventory_balances` |
| `face_sheet_item_reservations` | `balance_id` | `wms_inventory_balances` |
| `bonus_face_sheet_item_reservations` | `balance_id` | `wms_inventory_balances` |

---

## 5. ข้อเสนอแนะ

### 5.1 Option A: แยกเป็น 4 ตารางใหม่ ❌ ไม่แนะนำ

**ข้อดี:**
- Query แต่ละแท็บเร็วขึ้น (ถ้าข้อมูลเยอะมาก)
- โค้ดอ่านง่ายขึ้น

**ข้อเสีย:**
- ต้องสร้าง Sync Triggers ซับซ้อน
- เพิ่ม maintenance cost
- อาจเกิด data inconsistency
- ต้องแก้ไขไฟล์ 20+ ไฟล์
- Performance ปัจจุบันดีอยู่แล้ว (3.14ms)

### 5.2 Option B: ใช้ Materialized Views ⚠️ พิจารณา

**ข้อดี:**
- ไม่ต้องแก้ไขตารางหลัก
- Query เร็วขึ้น
- ง่ายต่อการ rollback

**ข้อเสีย:**
- ต้อง refresh view เป็นระยะ
- ข้อมูลอาจไม่ real-time
- เพิ่ม storage

**ตัวอย่าง:**
```sql
CREATE MATERIALIZED VIEW mv_preparation_inventory AS
SELECT b.*, s.sku_name, l.location_name
FROM wms_inventory_balances b
LEFT JOIN master_sku s ON s.sku_id = b.sku_id
LEFT JOIN master_location l ON l.location_id = b.location_id
WHERE b.location_id IN (SELECT area_code FROM preparation_area WHERE status = 'active')
  AND b.location_id != 'PK002'
WITH DATA;
```

### 5.3 Option C: ปรับปรุง API และ Frontend ✅ แนะนำ

**ข้อดี:**
- ไม่ต้องแก้ไขฐานข้อมูล
- ลด risk
- ง่ายต่อการ implement

**สิ่งที่ควรทำ:**

1. **สร้าง API แยกสำหรับแต่ละแท็บ:**
   - `/api/warehouse/preparation-inventory` (Tab 1)
   - `/api/warehouse/premium-inventory` (Tab 2)
   - `/api/warehouse/dispatch-inventory` (มีแล้ว)
   - `/api/warehouse/delivery-inventory` (มีแล้ว)

2. **เพิ่ม Pagination ที่ API:**
   - ใช้ cursor-based pagination
   - ส่งเฉพาะข้อมูลที่ต้องการ

3. **ใช้ SWR/React Query:**
   - Cache ข้อมูลที่ client
   - Revalidate เมื่อจำเป็น

4. **Lazy Loading:**
   - โหลดข้อมูลเฉพาะแท็บที่เลือก
   - ไม่ต้องโหลดทั้ง 4 แท็บพร้อมกัน

---

## 6. แผนการดำเนินงาน

### Phase 1: ปรับปรุง API (1-2 วัน)

**Task 1.1:** สร้าง API `/api/warehouse/preparation-inventory`
```typescript
// app/api/warehouse/preparation-inventory/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '100');
  
  // Query with pagination
  const { data, count } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_sku!sku_id (sku_name),
      master_location!location_id (location_name)
    `, { count: 'exact' })
    .in('location_id', prepAreaCodes)
    .neq('location_id', 'PK002')
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
    
  return NextResponse.json({ data, totalCount: count, page, pageSize });
}
```

**Task 1.2:** สร้าง API `/api/warehouse/premium-inventory`
- คล้ายกับ Task 1.1 แต่กรอง `location_id = 'PK002'`

### Phase 2: ปรับปรุง Frontend (1-2 วัน)

**Task 2.1:** แยก fetch function ตามแท็บ
```typescript
// เปลี่ยนจาก
useEffect(() => {
  fetchBalanceData();
  fetchPremiumData();
  fetchDispatchData();
  fetchDeliveryData();
}, []);

// เป็น
useEffect(() => {
  if (activeTab === 'preparation') fetchPreparationData();
  else if (activeTab === 'premium') fetchPremiumData();
  else if (activeTab === 'dispatch') fetchDispatchData();
  else if (activeTab === 'delivery') fetchDeliveryData();
}, [activeTab]);
```

**Task 2.2:** เพิ่ม Loading State ต่อแท็บ
```typescript
const [loadingStates, setLoadingStates] = useState({
  preparation: false,
  premium: false,
  dispatch: false,
  delivery: false
});
```

### Phase 3: เพิ่ม Caching (Optional)

**Task 3.1:** ใช้ SWR สำหรับ data fetching
```typescript
import useSWR from 'swr';

const { data, error, isLoading } = useSWR(
  activeTab === 'preparation' ? '/api/warehouse/preparation-inventory' : null,
  fetcher,
  { revalidateOnFocus: false }
);
```

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data inconsistency (ถ้าแยกตาราง) | High | ไม่แยกตาราง |
| Performance degradation | Low | มี indexes ครอบคลุม |
| Breaking existing features | Medium | ทดสอบทุก API ที่ใช้ตาราง |
| Downtime | Low | ไม่ต้อง migrate ข้อมูล |

---

## 8. สรุป

### สิ่งที่ควรทำ ✅
1. สร้าง API แยกสำหรับ Tab 1 และ Tab 2
2. ปรับ Frontend ให้โหลดข้อมูลเฉพาะแท็บที่เลือก
3. เพิ่ม Pagination ที่ API
4. ใช้ SWR/React Query สำหรับ caching

### สิ่งที่ไม่ควรทำ ❌
1. แยกตารางฐานข้อมูล (เพิ่มความซับซ้อนโดยไม่จำเป็น)
2. สร้าง Materialized Views (ข้อมูลไม่ real-time)
3. เปลี่ยนโครงสร้าง indexes (ดีอยู่แล้ว)

### ระยะเวลาโดยประมาณ
- **Phase 1:** 1-2 วัน
- **Phase 2:** 1-2 วัน
- **Phase 3:** 0.5-1 วัน (optional)
- **รวม:** 2.5-5 วัน

### Downtime Required
**ไม่มี** - สามารถ deploy แบบ rolling update ได้

---

## Appendix A: โครงสร้างตาราง wms_inventory_balances

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| balance_id | bigint | NO | nextval |
| warehouse_id | varchar | NO | - |
| location_id | varchar | YES | - |
| sku_id | varchar | NO | - |
| pallet_id | varchar | YES | - |
| pallet_id_external | varchar | YES | - |
| production_date | date | YES | - |
| expiry_date | date | YES | - |
| total_pack_qty | numeric | NO | 0 |
| total_piece_qty | numeric | NO | 0 |
| reserved_pack_qty | numeric | NO | 0 |
| reserved_piece_qty | numeric | NO | 0 |
| last_move_id | bigint | YES | - |
| last_movement_at | timestamptz | YES | - |
| created_at | timestamptz | YES | CURRENT_TIMESTAMP |
| updated_at | timestamptz | YES | CURRENT_TIMESTAMP |
| lot_no | varchar | YES | - |

---

## Appendix B: Checklist การดำเนินงาน

```
Phase 0: ตรวจสอบโครงสร้างปัจจุบัน
✅ 0.1 ตรวจสอบ Page และ Components
✅ 0.2 อ่านโค้ด Page หลัก
✅ 0.3 ระบุ 4 แท็บเมนู
✅ 0.4 ตรวจสอบ API ที่ใช้

Phase 1: ตรวจสอบฐานข้อมูล
✅ 1.1 ดูตารางที่เกี่ยวข้อง
✅ 1.2 ดูโครงสร้างตารางหลัก
✅ 1.3 นับจำนวนข้อมูลแต่ละแท็บ
✅ 1.4 วิเคราะห์ Query Performance
✅ 1.5 ดู Indexes ที่มี

Phase 2: ตรวจสอบ Dependencies
✅ 2.1 หาทุกที่ที่ใช้ตาราง/API
✅ 2.2 สร้าง Dependency Map
✅ 2.3 ตรวจสอบ Triggers/Functions
✅ 2.4 ตรวจสอบ Foreign Keys

Phase 3: วิเคราะห์ Logic แต่ละแท็บ
✅ 3.1 สรุป Filter ของแต่ละแท็บ
✅ 3.2 ตรวจสอบ Overlap (ไม่มี)

Phase 4: ออกแบบโครงสร้างใหม่
✅ 4.1 Option A: แยกตาราง (ไม่แนะนำ)
✅ 4.2 Option B: Materialized Views (พิจารณา)
✅ 4.3 Option C: ปรับปรุง API (แนะนำ)

Phase 5: วางแผน Migration
✅ 5.1 สร้าง Migration Plan
✅ 5.2 ไม่ต้องสร้าง Sync Triggers

Phase 6: ประเมินผลกระทบ
✅ 6.1 รายการส่วนที่ได้รับผลกระทบ
✅ 6.2 Impact Assessment Matrix

Final
✅ สรุปรายงาน
✅ เลือก Option ที่เหมาะสม (Option C)
✅ วางแผนดำเนินการ
```

---

**จัดทำโดย:** AI Assistant  
**วันที่:** 13 มกราคม 2569  
**Version:** 1.0
