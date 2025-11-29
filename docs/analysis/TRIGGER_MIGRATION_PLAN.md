# แผนการย้ายทริกเกอร์ไปเป็น API

## สรุปทริกเกอร์ที่มีในระบบ

### กลุ่มที่ 1: Workflow Status Triggers (6 ทริกเกอร์)
จากไฟล์: `027_create_workflow_status_triggers.sql`, `044_fix_loadlist_triggers.sql`

| ทริกเกอร์ | ตาราง | เหตุการณ์ | ฟังก์ชัน | หน้าที่ |
|---------|-------|----------|---------|--------|
| 1. `trigger_route_publish_update_orders` | `receiving_route_plans` | AFTER UPDATE | `update_orders_on_route_publish()` | Route published → Orders: draft→confirmed |
| 2. `trigger_picklist_create_update_orders` | `picklists` | AFTER INSERT | `update_orders_on_picklist_create()` | Picklist created → Orders: confirmed→in_picking |
| 3. `trigger_picklist_complete_update_orders_and_route` | `picklists` | AFTER UPDATE | `update_orders_and_route_on_picklist_complete()` | Picklist completed → Orders: in_picking→picked, Route: published→ready_to_load |
| 4. `trigger_loadlist_complete_update_orders` | `loadlists` | AFTER UPDATE | `update_orders_on_loadlist_complete()` | Loadlist loaded → Orders: picked→loaded, Route: ready_to_load→in_transit |
| 5. `trigger_delivery_update_route` | `wms_orders` | AFTER UPDATE | `update_route_on_delivery()` | Order delivered → Route: in_transit→completed |

### กลุ่มที่ 2: Inventory Ledger Triggers (5 ทริกเกอร์)
จากไฟล์: `007_add_receive_to_ledger_trigger.sql`, `015_add_move_to_ledger_trigger.sql`, `004_add_inventory_balance_sync_trigger.sql`

| ทริกเกอร์ | ตาราง | เหตุการณ์ | ฟังก์ชัน | หน้าที่ |
|---------|-------|----------|---------|--------|
| 6. `trg_create_ledger_from_receive_insert` | `wms_receive_items` | AFTER INSERT | `create_ledger_from_receive()` | รับของเข้า → สร้าง ledger entry |
| 7. `trg_update_ledger_from_receive` | `wms_receive_items` | AFTER UPDATE | `update_ledger_from_receive()` | อัปเดตรับของ → สร้าง ledger entry |
| 8. `trg_update_ledger_from_receive_status` | `wms_receives` | AFTER UPDATE | `update_ledger_from_receive_status()` | เปลี่ยนสถานะรับ → สร้าง ledger entries |
| 9. `trg_create_ledger_from_move_insert` | `wms_move_items` | AFTER INSERT | `create_ledger_from_move()` | ย้ายของ → สร้าง ledger entries (OUT+IN) |
| 10. `trg_update_ledger_from_move` | `wms_move_items` | AFTER UPDATE | `update_ledger_from_move()` | อัปเดตย้ายของ → สร้าง ledger entries |
| 11. `trg_sync_inventory_ledger_to_balance` | `wms_inventory_ledger` | AFTER INSERT | `sync_inventory_ledger_to_balance()` | Ledger entry → อัปเดต balance |

### กลุ่มที่ 3: Updated_at Triggers (20+ ทริกเกอร์)
จากไฟล์: `001_full_schema.sql`, `011_add_missing_ledger_columns.sql`

| ทริกเกอร์ | ตาราง | ฟังก์ชัน | หน้าที่ |
|---------|-------|---------|--------|
| `handle_updated_at_picklists` | `picklists` | `update_updated_at_column()` | Auto-update updated_at |
| `handle_updated_at_load_lists` | `load_lists` | `update_updated_at_column()` | Auto-update updated_at |
| `trg_update_wms_inventory_ledger_updated_at` | `wms_inventory_ledger` | `update_wms_inventory_ledger_updated_at()` | Auto-update updated_at |
| + อีกมากมาย (preparation_area, location_group, storage_profile, etc.) | หลายตาราง | `update_updated_at_column()` / `set_receiving_route_updated_at()` | Auto-update updated_at |

### กลุ่มที่ 4: Business Logic Triggers (น้อยมาก)
จากไฟล์: `001_full_schema.sql`, `003_add_shipping_cost_breakdown.sql`

| ทริกเกอร์ | ตาราง | ฟังก์ชัน | หน้าที่ |
|---------|-------|---------|--------|
| `trigger_calculate_shipping_cost_formula` | `receiving_route_trips` | `update_shipping_cost()` | คำนวณค่าขนส่งอัตโนมัติ |
| `trigger_update_extra_stops_count` | `receiving_route_stops` | `count_extra_stops()` | นับจุดแวะเพิ่ม |
| `calculate_freight_prices_trigger` | `master_freight_rate` | `calculate_freight_derived_prices()` | คำนวณราคาขนส่ง |
| `trg_auto_update_order_status_on_issue` | `material_issues` | `auto_update_order_status_on_issue()` | Production: auto-update order status |
| `trg_check_order_completion` | `production_receipts` | `check_order_completion()` | Production: check completion |

---

## แผนการย้าย

### Phase 1: ปิดทริกเกอร์ที่ซ้ำซ้อนกับ API (High Priority)

#### 1.1 Workflow Status Triggers (5 ทริกเกอร์)
**สาเหตุที่ต้องปิด:** ทริกเกอร์เหล่านี้ทำงานอัตโนมัติเมื่อมีการเปลี่ยนแปลงข้อมูล ซึ่งอาจทำให้เกิดการอัปเดตสถานะซ้ำซ้อนกับ API และทำให้ยากต่อการควบคุม/ดีบัก

**ทริกเกอร์ที่ต้องปิด:**
1. `trigger_route_publish_update_orders`
2. `trigger_picklist_create_update_orders`
3. `trigger_picklist_complete_update_orders_and_route`
4. `trigger_loadlist_complete_update_orders`
5. `trigger_delivery_update_route`

**API ที่จะสร้าง/แก้ไข:**
- ✅ `POST /api/route-plans/[id]/publish` - Publish route และอัปเดตสถานะ orders
- ✅ `POST /api/picklists/create-from-trip` - สร้าง picklist และอัปเดตสถานะ orders
- ✅ `PATCH /api/picklists/[id]` (status=completed) - อัปเดตสถานะ orders และ route plan
- ✅ `POST /api/mobile/loading/complete` - Complete loading และอัปเดตสถานะ orders และ route
- ✅ `PATCH /api/orders/[id]` (status=delivered) - อัปเดตสถานะ loadlist และ route plan

#### 1.2 Inventory Ledger Creation Triggers (5 ทริกเกอร์)
**สาเหตุที่ต้องปิด:** การสร้าง ledger entries ควรควบคุมจาก API เพื่อความถูกต้องและตรวจสอบได้

**ทริกเกอร์ที่ต้องปิด:**
1. `trg_create_ledger_from_receive_insert`
2. `trg_update_ledger_from_receive`
3. `trg_update_ledger_from_receive_status`
4. `trg_create_ledger_from_move_insert`
5. `trg_update_ledger_from_move`

**API ที่จะสร้าง/แก้ไข:**
- ✅ `POST /api/receives/[id]/complete` - Complete receive และสร้าง ledger entries
- ✅ `POST /api/mobile/pick/scan` - Pick item และสร้าง ledger entries (OUT+IN)
- ✅ `POST /api/mobile/loading/complete` - Load และสร้าง ledger entries (OUT+IN)
- ✅ `POST /api/moves/[id]/complete` - Complete transfer และสร้าง ledger entries (OUT+IN)

### Phase 2: ปรับปรุงทริกเกอร์ที่จำเป็น (Medium Priority)

#### 2.1 Inventory Balance Sync Trigger (1 ทริกเกอร์)
**ทริกเกอร์:** `trg_sync_inventory_ledger_to_balance`
**การปรับปรุง:**
- **ควรเก็บไว้** เพราะเป็น automation ที่ดีในการซิงค์ ledger → balance
- แต่ควรเพิ่ม **validation และ error handling** ให้ดีขึ้น
- เพิ่ม **logging** เพื่อ audit trail

**API ที่จะสร้าง:**
- `POST /api/inventory/sync-balance` - Manual sync ในกรณีที่ต้องการ reconcile
- `POST /api/inventory/recalculate-balance` - Recalculate balance จาก ledger

#### 2.2 Updated_at Triggers (20+ ทริกเกอร์)
**การปรับปรุง:**
- **เก็บไว้ทั้งหมด** - เป็น standard pattern ที่ใช้ในระบบทั่วไป
- ไม่จำเป็นต้องย้ายไป API เพราะเป็นงานง่ายและไม่มี side effect

### Phase 3: Business Logic Triggers (Low Priority)

#### 3.1 Shipping Cost Calculation (2 ทริกเกอร์)
**ทริกเกอร์:**
- `trigger_calculate_shipping_cost_formula`
- `trigger_update_extra_stops_count`

**การปรับปรุง:**
- ย้ายไปคำนวณใน API แทน
- เพิ่มความยืดหยุ่นในการปรับเปลี่ยนสูตรคำนวณ

**API ที่จะสร้าง:**
- `POST /api/route-plans/[id]/calculate-cost` - คำนวณค่าขนส่งทั้ง plan
- `PATCH /api/route-plans/trips/[id]` - อัปเดตค่าขนส่งและคำนวณใหม่

#### 3.2 Production Triggers (2 ทริกเกอร์)
**ทริกเกอร์:**
- `trg_auto_update_order_status_on_issue`
- `trg_check_order_completion`

**การปรับปรุง:**
- ตรวจสอบว่ามี API สำหรับ production order หรือยัง
- ถ้าไม่มี ให้เก็บทริกเกอร์ไว้ก่อน
- ถ้ามีแล้ว ให้ย้ายไป API

---

## SQL Script สำหรับปิดทริกเกอร์

### Script 1: ปิด Workflow Triggers (รันทันที)

```sql
-- ============================================================
-- Disable Workflow Status Triggers
-- วันที่: 2025-11-29
-- หมายเหตุ: ปิดทริกเกอร์เพื่อย้ายไปใช้ API แทน
-- ============================================================

-- 1. Route Publish Trigger
DROP TRIGGER IF EXISTS trigger_route_publish_update_orders ON receiving_route_plans;
DROP FUNCTION IF EXISTS update_orders_on_route_publish();

-- 2. Picklist Create Trigger
DROP TRIGGER IF EXISTS trigger_picklist_create_update_orders ON picklists;
DROP FUNCTION IF EXISTS update_orders_on_picklist_create();

-- 3. Picklist Complete Trigger
DROP TRIGGER IF EXISTS trigger_picklist_complete_update_orders_and_route ON picklists;
DROP FUNCTION IF EXISTS update_orders_and_route_on_picklist_complete();

-- 4. Loadlist Complete Trigger
DROP TRIGGER IF EXISTS trigger_loadlist_complete_update_orders ON loadlists;
DROP FUNCTION IF EXISTS update_orders_on_loadlist_complete();

-- 5. Delivery Trigger
DROP TRIGGER IF EXISTS trigger_delivery_update_route ON wms_orders;
DROP FUNCTION IF EXISTS update_route_on_delivery();

-- Log
COMMENT ON TABLE receiving_route_plans IS 'Workflow triggers disabled on 2025-11-29. Use API for status updates.';
COMMENT ON TABLE picklists IS 'Workflow triggers disabled on 2025-11-29. Use API for status updates.';
COMMENT ON TABLE loadlists IS 'Workflow triggers disabled on 2025-11-29. Use API for status updates.';
COMMENT ON TABLE wms_orders IS 'Workflow triggers disabled on 2025-11-29. Use API for status updates.';

SELECT 'Workflow triggers disabled successfully' AS status;
```

### Script 2: ปิด Inventory Ledger Creation Triggers (รันทันที)

```sql
-- ============================================================
-- Disable Inventory Ledger Creation Triggers
-- วันที่: 2025-11-29
-- หมายเหตุ: ปิดทริกเกอร์เพื่อย้ายไปสร้าง ledger ผ่าน API แทน
-- ============================================================

-- 1. Receive Triggers
DROP TRIGGER IF EXISTS trg_create_ledger_from_receive_insert ON wms_receive_items;
DROP TRIGGER IF EXISTS trg_update_ledger_from_receive ON wms_receive_items;
DROP TRIGGER IF EXISTS trg_update_ledger_from_receive_status ON wms_receives;
DROP FUNCTION IF EXISTS create_ledger_from_receive();
DROP FUNCTION IF EXISTS update_ledger_from_receive();
DROP FUNCTION IF EXISTS update_ledger_from_receive_status();

-- 2. Move/Transfer Triggers
DROP TRIGGER IF EXISTS trg_create_ledger_from_move_insert ON wms_move_items;
DROP TRIGGER IF EXISTS trg_update_ledger_from_move ON wms_move_items;
DROP FUNCTION IF EXISTS create_ledger_from_move();
DROP FUNCTION IF EXISTS update_ledger_from_move();

-- Log
COMMENT ON TABLE wms_receive_items IS 'Ledger creation triggers disabled on 2025-11-29. API creates ledger entries.';
COMMENT ON TABLE wms_receives IS 'Ledger creation triggers disabled on 2025-11-29. API creates ledger entries.';
COMMENT ON TABLE wms_move_items IS 'Ledger creation triggers disabled on 2025-11-29. API creates ledger entries.';

SELECT 'Inventory ledger creation triggers disabled successfully' AS status;
```

### Script 3: ปิด Business Logic Triggers (รันภายหลัง - ต้องมี API แทนก่อน)

```sql
-- ============================================================
-- Disable Business Logic Triggers (Shipping Cost)
-- วันที่: TBD (ต้องสร้าง API ก่อน)
-- หมายเหตุ: ปิดทริกเกอร์คำนวณค่าขนส่ง ให้ใช้ API แทน
-- ============================================================

-- 1. Shipping Cost Triggers
DROP TRIGGER IF EXISTS trigger_calculate_shipping_cost_formula ON receiving_route_trips;
DROP TRIGGER IF EXISTS trigger_update_extra_stops_count ON receiving_route_stops;
DROP FUNCTION IF EXISTS update_shipping_cost();
DROP FUNCTION IF EXISTS count_extra_stops();

-- 2. Freight Rate Trigger
DROP TRIGGER IF EXISTS calculate_freight_prices_trigger ON master_freight_rate;
DROP FUNCTION IF EXISTS calculate_freight_derived_prices();

SELECT 'Business logic triggers disabled successfully' AS status;
```

### Script 4: Backup ทริกเกอร์ทั้งหมด (สำหรับ rollback)

```sql
-- ============================================================
-- Backup All Trigger Definitions
-- วันที่: 2025-11-29
-- หมายเหตุ: สำรองคำนิยาม triggers ก่อนลบ
-- ============================================================

-- สร้างตารางสำหรับเก็บ backup
CREATE TABLE IF NOT EXISTS trigger_backup_20251129 (
    backup_id SERIAL PRIMARY KEY,
    trigger_name TEXT,
    table_name TEXT,
    function_name TEXT,
    trigger_definition TEXT,
    function_definition TEXT,
    backed_up_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backup trigger definitions
INSERT INTO trigger_backup_20251129 (trigger_name, table_name, function_name, trigger_definition, function_definition)
SELECT
    tgname AS trigger_name,
    tbl.relname AS table_name,
    proc.proname AS function_name,
    pg_get_triggerdef(trg.oid) AS trigger_definition,
    pg_get_functiondef(proc.oid) AS function_definition
FROM pg_trigger trg
JOIN pg_class tbl ON trg.tgrelid = tbl.oid
JOIN pg_proc proc ON trg.tgfoid = proc.oid
WHERE tbl.relnamespace = 'public'::regnamespace
AND tgname IN (
    'trigger_route_publish_update_orders',
    'trigger_picklist_create_update_orders',
    'trigger_picklist_complete_update_orders_and_route',
    'trigger_loadlist_complete_update_orders',
    'trigger_delivery_update_route',
    'trg_create_ledger_from_receive_insert',
    'trg_update_ledger_from_receive',
    'trg_update_ledger_from_receive_status',
    'trg_create_ledger_from_move_insert',
    'trg_update_ledger_from_move'
);

SELECT 'Triggers backed up successfully. Total: ' || COUNT(*)
FROM trigger_backup_20251129;
```

---

## API ที่ต้องสร้าง/แก้ไข

### 1. Route Plan APIs

#### `POST /api/route-plans/[id]/publish`
```typescript
// เดิม: ทริกเกอร์ auto-update orders
// ใหม่: API ทำทั้งหมด
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // 1. อัปเดต route plan status = 'published'
  await supabase
    .from('receiving_route_plans')
    .update({ status: 'published' })
    .eq('plan_id', id);

  // 2. ดึง order IDs จาก route stops
  const orderIds = await getOrderIdsFromRoutePlan(id);

  // 3. อัปเดต orders จาก 'draft' → 'confirmed'
  await supabase
    .from('wms_orders')
    .update({ status: 'confirmed', updated_at: new Date() })
    .in('order_id', orderIds)
    .eq('status', 'draft');

  return NextResponse.json({ success: true });
}
```

#### `PATCH /api/route-plans/[id]` (status=approved)
```typescript
// อัปเดตสถานะเป็น approved (สำหรับ picklist creation)
```

### 2. Picklist APIs

#### `POST /api/picklists/create-from-trip` ✅ (มีอยู่แล้ว - ต้องเพิ่ม)
```typescript
// เพิ่มการอัปเดตสถานะ orders
export async function POST(request: NextRequest) {
  // ... existing code ...

  // เพิ่ม: อัปเดต orders จาก 'confirmed' → 'in_picking'
  const orderIds = picklistItems.map(item => item.order_id);
  await supabase
    .from('wms_orders')
    .update({ status: 'in_picking', updated_at: new Date() })
    .in('order_id', orderIds)
    .eq('status', 'confirmed');
}
```

#### `PATCH /api/picklists/[id]` ✅ (มีอยู่แล้ว - ต้องเพิ่ม)
```typescript
// เพิ่มเมื่อ status = 'completed'
export async function PATCH(request: NextRequest, { params }) {
  const { status } = await request.json();

  if (status === 'completed') {
    // 1. อัปเดต picklist
    await supabase.from('picklists').update({ status }).eq('id', id);

    // 2. อัปเดต orders: 'in_picking' → 'picked'
    const orderIds = await getOrderIdsFromPicklist(id);
    await supabase
      .from('wms_orders')
      .update({ status: 'picked' })
      .in('order_id', orderIds)
      .eq('status', 'in_picking');

    // 3. ตรวจสอบว่า picklists ทั้งหมดใน plan เสร็จหรือยัง
    const allCompleted = await checkAllPicklistsCompleted(planId);

    // 4. ถ้าเสร็จหมด → route plan: 'published' → 'ready_to_load'
    if (allCompleted) {
      await supabase
        .from('receiving_route_plans')
        .update({ status: 'ready_to_load' })
        .eq('plan_id', planId)
        .eq('status', 'published');
    }
  }
}
```

### 3. Loading APIs

#### `POST /api/mobile/loading/complete` ✅ (มีอยู่แล้ว - ต้องเพิ่ม)
```typescript
// เพิ่มการอัปเดตสถานะ orders และ route
export async function POST(request: NextRequest) {
  // ... existing loading logic ...

  // เพิ่ม:
  // 1. อัปเดต loadlist status = 'loaded'
  await supabase.from('loadlists').update({ status: 'loaded' }).eq('id', loadlistId);

  // 2. อัปเดต orders: 'picked' → 'loaded'
  await supabase
    .from('wms_orders')
    .update({ status: 'loaded' })
    .in('order_id', orderIds)
    .eq('status', 'picked');

  // 3. อัปเดต route plan: 'ready_to_load' → 'in_transit'
  await supabase
    .from('receiving_route_plans')
    .update({ status: 'in_transit' })
    .eq('plan_id', planId)
    .eq('status', 'ready_to_load');
}
```

### 4. Order Delivery API

#### `PATCH /api/orders/[id]` (สร้างใหม่)
```typescript
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { status } = await request.json();

  if (status === 'delivered') {
    // 1. อัปเดต order status
    await supabase.from('wms_orders').update({ status }).eq('order_id', id);

    // 2. หา plan_id จาก picklist
    const planId = await getPlanIdFromOrder(id);

    // 3. ตรวจสอบว่า orders ทั้งหมดใน plan ส่งถึงหรือยัง
    const allDelivered = await checkAllOrdersDelivered(planId);

    // 4. ถ้าส่งถึงหมด → route plan: 'in_transit' → 'completed'
    if (allDelivered) {
      await supabase
        .from('receiving_route_plans')
        .update({ status: 'completed' })
        .eq('plan_id', planId)
        .eq('status', 'in_transit');
    }
  }
}
```

### 5. Inventory Ledger APIs

#### `POST /api/receives/[id]/complete` (สร้างใหม่)
```typescript
export async function POST(request: NextRequest, { params }) {
  const { id } = params;

  // 1. อัปเดต receive status = 'รับเข้าแล้ว'
  await supabase.from('wms_receives').update({ status: 'รับเข้าแล้ว' }).eq('receive_id', id);

  // 2. ดึง receive items
  const { data: items } = await supabase
    .from('wms_receive_items')
    .select('*')
    .eq('receive_id', id);

  // 3. สร้าง ledger entries สำหรับทุก item
  for (const item of items) {
    if (item.location_id) {
      await supabase.from('wms_inventory_ledger').insert({
        transaction_type: 'receive',
        receive_item_id: item.item_id,
        warehouse_id: warehouseId,
        location_id: item.location_id,
        sku_id: item.sku_id,
        pallet_id: item.pallet_id,
        pack_qty: item.pack_quantity,
        piece_qty: item.piece_quantity,
        direction: 'in',
        movement_at: new Date()
      });
    }
  }
}
```

#### `POST /api/mobile/pick/scan` ✅ (มีอยู่แล้ว - ดีแล้ว)
```typescript
// มีการสร้าง ledger entries อยู่แล้ว (OUT + IN)
```

#### `POST /api/moves/[id]/complete` (สร้างใหม่)
```typescript
export async function POST(request: NextRequest, { params }) {
  const { id } = params;

  // 1. อัปเดต move status = 'completed'
  // 2. ดึง move items
  // 3. สร้าง ledger entries สำหรับทุก item (OUT + IN)

  for (const item of moveItems) {
    // OUT entry
    await supabase.from('wms_inventory_ledger').insert({
      transaction_type: 'transfer',
      move_item_id: item.move_item_id,
      warehouse_id: fromWarehouseId,
      location_id: item.from_location_id,
      sku_id: item.sku_id,
      pack_qty: item.confirmed_pack_qty,
      piece_qty: item.confirmed_piece_qty,
      direction: 'out',
      movement_at: new Date()
    });

    // IN entry
    await supabase.from('wms_inventory_ledger').insert({
      transaction_type: 'transfer',
      move_item_id: item.move_item_id,
      warehouse_id: toWarehouseId,
      location_id: item.to_location_id,
      sku_id: item.sku_id,
      pack_qty: item.confirmed_pack_qty,
      piece_qty: item.confirmed_piece_qty,
      direction: 'in',
      movement_at: new Date()
    });
  }
}
```

---

## ลำดับการทำงาน

### Day 1: เตรียมการ
1. ✅ Backup triggers ทั้งหมด (รัน Script 4)
2. ✅ สร้าง migration file ใหม่: `045_disable_workflow_triggers.sql`
3. ✅ สร้าง migration file ใหม่: `046_disable_ledger_triggers.sql`

### Day 2-3: สร้าง APIs
1. สร้าง/แก้ไข API ทั้ง 9 ตัว (ตามรายการด้านบน)
2. เขียน unit tests สำหรับ APIs ใหม่
3. ทดสอบใน development environment

### Day 4: Deploy และ Disable Triggers
1. Deploy APIs ใหม่ไป production
2. รัน Script 1: ปิด Workflow Triggers
3. รัน Script 2: ปิด Inventory Ledger Triggers
4. Monitor logs และ error

### Day 5: Testing และ Fix
1. ทดสอบ workflow ทั้งหมด
2. แก้ไข bugs ที่พบ
3. Monitor performance

### Day 6-7: Cleanup
1. รัน Script 3: ปิด Business Logic Triggers (ถ้าพร้อม)
2. ลบ trigger definitions ที่ไม่ใช้แล้ว
3. อัปเดต documentation

---

## Rollback Plan

ถ้าเกิดปัญหาหลังปิดทริกเกอร์:

```sql
-- Restore triggers from backup
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT function_definition, trigger_definition
        FROM trigger_backup_20251129
        ORDER BY backup_id
    LOOP
        -- Restore function
        EXECUTE r.function_definition;

        -- Restore trigger
        EXECUTE r.trigger_definition;
    END LOOP;
END $$;

SELECT 'Triggers restored successfully' AS status;
```

---

## สรุป

### ทริกเกอร์ที่จะปิดทันที (10 ตัว)
1. ✅ Workflow triggers (5 ตัว)
2. ✅ Inventory ledger creation triggers (5 ตัว)

### ทริกเกอร์ที่จะเก็บไว้
1. ✅ Updated_at triggers (20+ ตัว) - standard pattern
2. ✅ Balance sync trigger (1 ตัว) - แต่จะปรับปรุง

### ทริกเกอร์ที่จะปิดภายหลัง (4 ตัว)
1. ⏳ Shipping cost triggers (2 ตัว)
2. ⏳ Production triggers (2 ตัว)

### APIs ที่ต้องสร้าง (9 ตัว)
1. ✅ มีอยู่แล้วแต่ต้องเพิ่มฟังก์ชัน (4 ตัว)
2. ⚠️ ต้องสร้างใหม่ (5 ตัว)

---

**หมายเหตุ:** แผนนี้ออกแบบให้มีความปลอดภัยสูงสุด โดยมี backup และ rollback plan ที่ชัดเจน
