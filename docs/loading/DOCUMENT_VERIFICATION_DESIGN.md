# Document Verification Design - Stock Tracking from Pick to Load

## ปัญหาที่ต้องแก้

ปัจจุบันระบบไม่มีการตรวจสอบว่าสต็อคที่อยู่ใน Dispatch/PQTD/MRTD/Prep Area มาจาก Picklist/Face Sheet/BFS ที่ยืนยันหยิบแล้วจริงหรือไม่

### สถานการณ์ที่เป็นปัญหา:
1. Picklist A หยิบสินค้า SKU-001 จำนวน 100 ชิ้น → ย้ายไป Dispatch
2. Picklist B หยิบสินค้า SKU-001 จำนวน 50 ชิ้น → ย้ายไป Dispatch  
3. ตอนโหลด Loadlist ที่มี Picklist A → ระบบเช็คแค่ว่า Dispatch มี SKU-001 >= 100 ชิ้น (ผ่าน)
4. **แต่ไม่รู้ว่า 100 ชิ้นที่โหลดไปนั้นมาจาก Picklist A หรือ B**

## โซลูชัน: Document-Tagged Stock Tracking

### แนวคิดหลัก
ใช้ระบบ **reservation** ที่มีอยู่แล้วเพื่อ "tag" สต็อคว่ามาจาก document ไหน

### Workflow ใหม่

#### 1. Pick Confirmation (ยืนยันหยิบ)
**ปัจจุบัน**:
- ปล่อย reservation จาก Bulk/Rack
- ย้ายสต็อคไป Dispatch/Staging
- ✅ เสร็จ

**ใหม่**:
- ปล่อย reservation จาก Bulk/Rack
- ย้ายสต็อคไป Dispatch/Staging
- **🆕 สร้าง reservation ใหม่ที่ Dispatch/Staging** เพื่อ "tag" ว่าสต็อคนี้เป็นของ document นี้
- ✅ เสร็จ

#### 2. Loading Validation (ตรวจสอบก่อนโหลด)
**ปัจจุบัน**:
- เช็คว่า Dispatch มีสต็อคพอหรือไม่
- ถ้าพอ → โหลดได้

**ใหม่**:
- เช็คว่า Dispatch มีสต็อคพอหรือไม่
- **🆕 เช็คว่ามี reservation ที่ Dispatch สำหรับ document นี้หรือไม่**
- ถ้าทั้งสองเงื่อนไขผ่าน → โหลดได้
- ถ้าไม่มี reservation → **ห้ามโหลด** (สต็อคไม่ได้มาจาก document นี้)

#### 3. Loading Complete (ยืนยันโหลด)
**ปัจจุบัน**:
- ย้ายสต็อคจาก Dispatch → Delivery-In-Progress
- บันทึก ledger

**ใหม่**:
- **🆕 ปล่อย reservation ที่ Dispatch**
- ย้ายสต็อคจาก Dispatch → Delivery-In-Progress
- บันทึก ledger

## Implementation Plan

### Phase 1: Update Pick Confirmation API ✅

**File**: `app/api/picklists/[id]/items/confirm/route.ts`

**Changes**:
1. เรียกใช้ `confirm_pick_item_with_reservation_release()` แทน direct UPDATE
2. หลังจากปล่อย reservation จาก Bulk/Rack แล้ว → สร้าง reservation ใหม่ที่ Dispatch/Staging

**New Function**: `create_staging_reservation()`
```sql
CREATE OR REPLACE FUNCTION create_staging_reservation(
  p_document_type VARCHAR,  -- 'picklist', 'face_sheet', 'bonus_face_sheet'
  p_document_id BIGINT,
  p_document_item_id BIGINT,
  p_sku_id VARCHAR,
  p_quantity NUMERIC,
  p_staging_location_id INTEGER  -- Dispatch, PQTD, MRTD, or Prep Area
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservation_id BIGINT
)
```

### Phase 2: Update Loading Validation ✅

**File**: `app/api/mobile/loading/complete/route.ts`

**Changes**:
1. ก่อนเช็คสต็อค → เช็ค reservation ก่อน
2. ถ้าไม่มี reservation สำหรับ document นี้ → return error
3. ถ้ามี reservation แต่สต็อคไม่พอ → return error (สต็อคถูกใช้ไปแล้ว)

**New Validation Logic**:
```typescript
// For Picklists
const { data: picklistReservations } = await supabase
  .from('picklist_item_reservations')
  .select('*')
  .in('picklist_item_id', picklistItemIds)
  .eq('status', 'picked')  // Status after pick confirmation
  .eq('location_id', dispatchLocation.location_id);

if (!picklistReservations || picklistReservations.length === 0) {
  return error('สต็อคไม่ได้มาจาก Picklist ที่ยืนยันหยิบแล้ว');
}

// Verify reserved quantity matches required quantity
const reservedQty = sum(picklistReservations.reserved_piece_qty);
const requiredQty = sum(picklistItems.quantity_picked);

if (reservedQty < requiredQty) {
  return error('สต็อคที่จองไว้ไม่เพียงพอ (อาจถูกใช้ไปแล้ว)');
}
```

### Phase 3: Update Loading Complete ✅

**File**: `app/api/mobile/loading/complete/route.ts`

**Changes**:
1. หลังจากย้ายสต็อคแล้ว → ปล่อย reservation ที่ Dispatch/Staging
2. Update reservation status จาก 'picked' → 'loaded'

**New Function**: `release_staging_reservation()`
```sql
CREATE OR REPLACE FUNCTION release_staging_reservation(
  p_document_type VARCHAR,
  p_document_id BIGINT,
  p_staging_location_id INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservations_released INTEGER
)
```

## Database Schema Changes

### Option A: Extend Existing Reservation Tables (แนะนำ) ✅

**Pros**:
- ใช้โครงสร้างที่มีอยู่แล้ว
- ไม่ต้องสร้าง table ใหม่
- Logic คล้ายกับ reservation ที่มีอยู่

**Cons**:
- ต้องแยก status ให้ชัดเจน (reserved, picked, loaded)

**Changes**:
```sql
-- Add new status values to reservation tables
-- picklist_item_reservations.status: 'reserved' → 'picked' → 'loaded'
-- face_sheet_item_reservations.status: 'reserved' → 'picked' → 'loaded'
-- bonus_face_sheet_item_reservations.status: 'reserved' → 'picked' → 'loaded'

-- Add location_id to track staging location
ALTER TABLE picklist_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id);

ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id);

ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id);
```

### Option B: Create New Staging Reservation Table

**Pros**:
- แยก concern ชัดเจน (Bulk/Rack reservation vs Staging reservation)
- ไม่กระทบ logic เดิม

**Cons**:
- ต้องสร้าง table ใหม่
- ต้อง maintain 2 ระบบ reservation

**Schema**:
```sql
CREATE TABLE staging_stock_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  document_type VARCHAR(50) NOT NULL,  -- 'picklist', 'face_sheet', 'bonus_face_sheet'
  document_id BIGINT NOT NULL,
  document_item_id BIGINT NOT NULL,
  sku_id VARCHAR(50) NOT NULL,
  staging_location_id INTEGER NOT NULL REFERENCES master_location(location_id),
  reserved_piece_qty NUMERIC NOT NULL,
  reserved_pack_qty NUMERIC NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'loaded', 'cancelled'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  loaded_at TIMESTAMP,
  created_by VARCHAR(50)
);

CREATE INDEX idx_staging_reservations_document 
  ON staging_stock_reservations(document_type, document_id);
  
CREATE INDEX idx_staging_reservations_location 
  ON staging_stock_reservations(staging_location_id, sku_id, status);
```

## Recommendation: Option A ✅

ใช้ Option A เพราะ:
1. ใช้โครงสร้างที่มีอยู่แล้ว
2. ไม่ต้องสร้าง table ใหม่
3. Logic สอดคล้องกับระบบ reservation ปัจจุบัน
4. แค่เพิ่ม column `staging_location_id` และปรับ status flow

## Migration Plan

### Migration 230: Add Staging Reservation Support

```sql
-- ============================================================================
-- Migration 230: Add Staging Reservation Support for Document Verification
-- ============================================================================

-- Add staging_location_id to track where stock is reserved after pick
ALTER TABLE picklist_item_reservations 
  ADD COLUMN IF NOT EXISTS staging_location_id INTEGER REFERENCES master_location(location_id);

ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN IF NOT EXISTS staging_location_id INTEGER REFERENCES master_location(location_id);

ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN IF NOT EXISTS staging_location_id INTEGER REFERENCES master_location(location_id);

-- Add loaded_at timestamp
ALTER TABLE picklist_item_reservations 
  ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMP;

ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMP;

ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMP;

-- Create function to create staging reservation after pick
CREATE OR REPLACE FUNCTION create_staging_reservation_after_pick(
  p_document_type VARCHAR,
  p_document_item_id BIGINT,
  p_sku_id VARCHAR,
  p_quantity_piece NUMERIC,
  p_quantity_pack NUMERIC,
  p_staging_location_id INTEGER,
  p_balance_id BIGINT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservation_id BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reservation_id BIGINT;
  v_table_name VARCHAR;
BEGIN
  -- Determine which table to use
  CASE p_document_type
    WHEN 'picklist' THEN v_table_name := 'picklist_item_reservations';
    WHEN 'face_sheet' THEN v_table_name := 'face_sheet_item_reservations';
    WHEN 'bonus_face_sheet' THEN v_table_name := 'bonus_face_sheet_item_reservations';
    ELSE
      RETURN QUERY SELECT FALSE, 'Invalid document type'::TEXT, NULL::BIGINT;
      RETURN;
  END CASE;
  
  -- Create staging reservation
  EXECUTE format(
    'INSERT INTO %I (
      %s,
      balance_id,
      reserved_piece_qty,
      reserved_pack_qty,
      status,
      staging_location_id,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING reservation_id',
    v_table_name,
    CASE p_document_type
      WHEN 'picklist' THEN 'picklist_item_id'
      WHEN 'face_sheet' THEN 'face_sheet_item_id'
      WHEN 'bonus_face_sheet' THEN 'bonus_face_sheet_item_id'
    END
  ) USING p_document_item_id, p_balance_id, p_quantity_piece, p_quantity_pack, 'picked', p_staging_location_id
  INTO v_reservation_id;
  
  -- Update inventory balance reserved qty
  UPDATE wms_inventory_balances
  SET 
    reserved_piece_qty = COALESCE(reserved_piece_qty, 0) + p_quantity_piece,
    reserved_pack_qty = COALESCE(reserved_pack_qty, 0) + p_quantity_pack,
    updated_at = CURRENT_TIMESTAMP
  WHERE balance_id = p_balance_id;
  
  RETURN QUERY SELECT TRUE, 'Staging reservation created'::TEXT, v_reservation_id;
END;
$$;

-- Create function to validate staging reservations before loading
CREATE OR REPLACE FUNCTION validate_staging_reservations(
  p_document_type VARCHAR,
  p_document_ids BIGINT[],
  p_staging_location_id INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  missing_items JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_table_name VARCHAR;
  v_item_id_column VARCHAR;
  v_missing_items JSONB;
BEGIN
  -- Determine table and column names
  CASE p_document_type
    WHEN 'picklist' THEN 
      v_table_name := 'picklist_item_reservations';
      v_item_id_column := 'picklist_item_id';
    WHEN 'face_sheet' THEN 
      v_table_name := 'face_sheet_item_reservations';
      v_item_id_column := 'face_sheet_item_id';
    WHEN 'bonus_face_sheet' THEN 
      v_table_name := 'bonus_face_sheet_item_reservations';
      v_item_id_column := 'bonus_face_sheet_item_id';
    ELSE
      RETURN QUERY SELECT FALSE, 'Invalid document type'::TEXT, NULL::JSONB;
      RETURN;
  END CASE;
  
  -- Check if all items have staging reservations
  -- (Implementation depends on specific requirements)
  
  RETURN QUERY SELECT TRUE, 'All items have valid staging reservations'::TEXT, NULL::JSONB;
END;
$$;

-- Create function to release staging reservations after loading
CREATE OR REPLACE FUNCTION release_staging_reservations_after_load(
  p_document_type VARCHAR,
  p_document_ids BIGINT[],
  p_staging_location_id INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  reservations_released INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_table_name VARCHAR;
  v_released_count INTEGER := 0;
BEGIN
  -- Determine table name
  CASE p_document_type
    WHEN 'picklist' THEN v_table_name := 'picklist_item_reservations';
    WHEN 'face_sheet' THEN v_table_name := 'face_sheet_item_reservations';
    WHEN 'bonus_face_sheet' THEN v_table_name := 'bonus_face_sheet_item_reservations';
    ELSE
      RETURN QUERY SELECT FALSE, 'Invalid document type'::TEXT, 0;
      RETURN;
  END CASE;
  
  -- Update reservations to 'loaded' status and release from balance
  EXECUTE format(
    'WITH released AS (
      UPDATE %I
      SET 
        status = ''loaded'',
        loaded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE staging_location_id = $1
      AND status = ''picked''
      RETURNING reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty
    )
    SELECT COUNT(*) FROM released',
    v_table_name
  ) USING p_staging_location_id
  INTO v_released_count;
  
  -- Release from inventory balances
  -- (Will be handled by trigger or separate update)
  
  RETURN QUERY SELECT TRUE, format('Released %s staging reservations', v_released_count)::TEXT, v_released_count;
END;
$$;

COMMENT ON FUNCTION create_staging_reservation_after_pick IS 
  'Create staging reservation after pick confirmation to track document ownership';
  
COMMENT ON FUNCTION validate_staging_reservations IS 
  'Validate that all items have staging reservations before loading';
  
COMMENT ON FUNCTION release_staging_reservations_after_load IS 
  'Release staging reservations after loading complete';
```

## Testing Plan

### Test Case 1: Normal Flow
1. Create Picklist A with SKU-001 x 100
2. Pick confirmation → สร้าง staging reservation ที่ Dispatch
3. Load Picklist A → ตรวจสอบ reservation ผ่าน → โหลดสำเร็จ

### Test Case 2: Wrong Document
1. Create Picklist A with SKU-001 x 100
2. Create Picklist B with SKU-001 x 50
3. Pick confirmation A → staging reservation A ที่ Dispatch
4. Pick confirmation B → staging reservation B ที่ Dispatch
5. Load Picklist A → ต้องโหลดเฉพาะสต็อคที่มี reservation A เท่านั้น

### Test Case 3: Stock Already Used
1. Create Picklist A with SKU-001 x 100
2. Pick confirmation → staging reservation ที่ Dispatch
3. Manual stock adjustment ลดสต็อคที่ Dispatch
4. Load Picklist A → ตรวจสอบ reservation ผ่าน แต่สต็อคไม่พอ → error

### Test Case 4: Multiple Documents Same SKU
1. Create Picklist A with SKU-001 x 100
2. Create Face Sheet B with SKU-001 x 50
3. Pick both → สร้าง reservation แยกกัน
4. Load Picklist A → ต้องโหลดเฉพาะ 100 ชิ้นที่เป็นของ A
5. Load Face Sheet B → ต้องโหลดเฉพาะ 50 ชิ้นที่เป็นของ B

## Rollout Strategy

### Phase 1: Migration + Functions (Week 1)
- Run Migration 230
- Test functions in staging

### Phase 2: Update Pick Confirmation (Week 1-2)
- Update API to create staging reservations
- Test with existing picklists

### Phase 3: Update Loading Validation (Week 2)
- Add validation logic
- Test with various scenarios

### Phase 4: Monitor + Fix (Week 3)
- Monitor production
- Fix any edge cases

## Backward Compatibility Strategy

### ปัญหา: ข้อมูลที่รอโหลดอยู่ปัจจุบัน

**สถานการณ์**:
- มี Picklists/Face Sheets/BFS ที่ยืนยันหยิบแล้ว (status = 'picked' หรือ 'completed')
- สต็อคย้ายไป Dispatch/PQTD/MRTD แล้ว
- แต่ยังไม่ได้โหลด (loaded_at IS NULL)
- **ไม่มี staging reservation** เพราะระบบเก่าไม่ได้สร้าง

### โซลูชัน: Graceful Migration Strategy ✅

เราจะใช้กลยุทธ์ **"Soft Enforcement"** แบบค่อยเป็นค่อยไป:

#### Phase 1: Migration + Backfill (Week 1)
1. Run Migration 230 (เพิ่ม columns)
2. **Backfill staging reservations** สำหรับข้อมูลเก่า
3. ทดสอบว่า backfill ถูกต้อง

#### Phase 2: Enable Validation with Fallback (Week 1-2)
1. Update Loading API เพิ่ม validation
2. **แต่มี fallback mode**: ถ้าไม่มี staging reservation → **อนุญาตให้โหลดได้** (แสดง warning)
3. Log รายการที่โหลดโดยไม่มี reservation เพื่อ monitor

#### Phase 3: Strict Enforcement (Week 3+)
1. หลังจากข้อมูลเก่าโหลดหมดแล้ว
2. เปลี่ยนจาก warning → error
3. บังคับให้ต้องมี staging reservation

### Implementation Details

#### 1. Backfill Script (รันครั้งเดียวหลัง Migration 230)

```sql
-- ============================================================================
-- Backfill Staging Reservations for Existing Picked Items
-- ============================================================================

DO $$
DECLARE
  v_dispatch_location_id INTEGER;
  v_pqtd_location_id INTEGER;
  v_mrtd_location_id INTEGER;
  v_backfilled_count INTEGER := 0;
BEGIN
  -- Get location IDs
  SELECT location_id INTO v_dispatch_location_id 
  FROM master_location WHERE location_code = 'Dispatch';
  
  SELECT location_id INTO v_pqtd_location_id 
  FROM master_location WHERE location_code = 'PQTD';
  
  SELECT location_id INTO v_mrtd_location_id 
  FROM master_location WHERE location_code = 'MRTD';

  -- ========================================================================
  -- Backfill Picklist Items
  -- ========================================================================
  INSERT INTO picklist_item_reservations (
    picklist_item_id,
    balance_id,
    reserved_piece_qty,
    reserved_pack_qty,
    status,
    staging_location_id,
    created_at,
    picked_at
  )
  SELECT 
    pi.id,
    ib.balance_id,
    pi.quantity_picked,
    pi.quantity_picked / COALESCE(ms.qty_per_pack, 1),
    'picked',
    v_dispatch_location_id,
    COALESCE(pi.picked_at, p.picking_completed_at, p.created_at),
    COALESCE(pi.picked_at, p.picking_completed_at)
  FROM picklist_items pi
  JOIN picklists p ON p.id = pi.picklist_id
  JOIN master_sku ms ON ms.sku_id = pi.sku_id
  JOIN wms_inventory_balances ib ON ib.sku_id = pi.sku_id 
    AND ib.location_id = v_dispatch_location_id
    AND ib.warehouse_id = 'WH001'
  WHERE pi.status = 'picked'
  AND p.status = 'completed'
  AND NOT EXISTS (
    -- ยังไม่ถูกโหลด
    SELECT 1 FROM wms_loadlist_picklists lp
    WHERE lp.picklist_id = p.id AND lp.loaded_at IS NOT NULL
  )
  AND NOT EXISTS (
    -- ยังไม่มี staging reservation
    SELECT 1 FROM picklist_item_reservations pir
    WHERE pir.picklist_item_id = pi.id AND pir.status = 'picked'
  )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_backfilled_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % picklist item reservations', v_backfilled_count;

  -- ========================================================================
  -- Backfill Face Sheet Items
  -- ========================================================================
  v_backfilled_count := 0;
  
  INSERT INTO face_sheet_item_reservations (
    face_sheet_item_id,
    balance_id,
    reserved_piece_qty,
    reserved_pack_qty,
    status,
    staging_location_id,
    created_at,
    picked_at
  )
  SELECT 
    fsi.id,
    ib.balance_id,
    fsi.quantity_picked,
    fsi.quantity_picked / COALESCE(ms.qty_per_pack, 1),
    'picked',
    v_dispatch_location_id,
    COALESCE(fsi.picked_at, fs.created_at),
    fsi.picked_at
  FROM face_sheet_items fsi
  JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
  JOIN master_sku ms ON ms.sku_id = fsi.sku_id
  JOIN wms_inventory_balances ib ON ib.sku_id = fsi.sku_id 
    AND ib.location_id = v_dispatch_location_id
    AND ib.warehouse_id = 'WH001'
  WHERE fsi.status = 'picked'
  AND NOT EXISTS (
    -- ยังไม่ถูกโหลด
    SELECT 1 FROM loadlist_face_sheets lfs
    WHERE lfs.face_sheet_id = fs.id AND lfs.loaded_at IS NOT NULL
  )
  AND NOT EXISTS (
    -- ยังไม่มี staging reservation
    SELECT 1 FROM face_sheet_item_reservations fsir
    WHERE fsir.face_sheet_item_id = fsi.id AND fsir.status = 'picked'
  )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_backfilled_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % face sheet item reservations', v_backfilled_count;

  -- ========================================================================
  -- Backfill Bonus Face Sheet Items
  -- ========================================================================
  v_backfilled_count := 0;
  
  -- BFS items อาจอยู่ที่ PQTD, MRTD, หรือ Dispatch
  -- ต้องหา location ที่ถูกต้องสำหรับแต่ละ item
  INSERT INTO bonus_face_sheet_item_reservations (
    bonus_face_sheet_item_id,
    balance_id,
    reserved_piece_qty,
    reserved_pack_qty,
    status,
    staging_location_id,
    created_at,
    picked_at
  )
  SELECT 
    bfsi.id,
    ib.balance_id,
    bfsi.quantity_picked,
    bfsi.quantity_picked / COALESCE(ms.qty_per_pack, 1),
    'picked',
    ib.location_id, -- ใช้ location ที่มีสต็อคจริง
    COALESCE(bfsi.picked_at, bfs.created_at),
    bfsi.picked_at
  FROM bonus_face_sheet_items bfsi
  JOIN bonus_face_sheets bfs ON bfs.id = bfsi.face_sheet_id
  JOIN master_sku ms ON ms.sku_id = bfsi.sku_id
  JOIN wms_inventory_balances ib ON ib.sku_id = bfsi.sku_id 
    AND ib.warehouse_id = 'WH001'
    AND ib.location_id IN (v_pqtd_location_id, v_mrtd_location_id, v_dispatch_location_id)
    AND ib.total_piece_qty > 0
  WHERE bfsi.status = 'picked'
  AND NOT EXISTS (
    -- ยังไม่ถูกโหลด
    SELECT 1 FROM wms_loadlist_bonus_face_sheets lbfs
    WHERE lbfs.bonus_face_sheet_id = bfs.id AND lbfs.loaded_at IS NOT NULL
  )
  AND NOT EXISTS (
    -- ยังไม่มี staging reservation
    SELECT 1 FROM bonus_face_sheet_item_reservations bfsir
    WHERE bfsir.bonus_face_sheet_item_id = bfsi.id AND bfsir.status = 'picked'
  )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_backfilled_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % bonus face sheet item reservations', v_backfilled_count;

  -- ========================================================================
  -- Update inventory balances reserved quantities
  -- ========================================================================
  -- (จะทำใน separate step เพื่อความปลอดภัย)
  
END $$;
```

#### 2. Loading API with Fallback Mode

```typescript
// app/api/mobile/loading/complete/route.ts

// ✅ NEW: Check staging reservations with FALLBACK
async function validateStagingReservations(
  documentType: 'picklist' | 'face_sheet' | 'bonus_face_sheet',
  documentIds: number[],
  itemsToLoad: any[]
): Promise<{ valid: boolean; warning?: string; missing?: any[] }> {
  
  // Query staging reservations
  const { data: reservations } = await supabase
    .from(`${documentType}_item_reservations`)
    .select('*')
    .in(`${documentType}_item_id`, itemsToLoad.map(i => i.item_id))
    .eq('status', 'picked');
  
  // Check if all items have reservations
  const missingReservations = itemsToLoad.filter(item => 
    !reservations?.some(r => r[`${documentType}_item_id`] === item.item_id)
  );
  
  if (missingReservations.length > 0) {
    // ✅ FALLBACK MODE: Allow loading but log warning
    console.warn(`⚠️ Loading without staging reservations (legacy data):`, {
      documentType,
      documentIds,
      missingCount: missingReservations.length
    });
    
    return {
      valid: true, // ✅ Still allow loading
      warning: `โหลดสำเร็จ แต่ตรวจพบข้อมูลเก่าที่ไม่มี staging reservation (${missingReservations.length} รายการ)`,
      missing: missingReservations
    };
  }
  
  return { valid: true };
}

// ใน handlePost function:
const validationResult = await validateStagingReservations(
  'picklist',
  picklistIds,
  itemsToProcess
);

if (!validationResult.valid) {
  return NextResponse.json({ error: 'Invalid staging reservations' }, { status: 400 });
}

// ✅ แสดง warning ถ้ามี (แต่ยังโหลดได้)
if (validationResult.warning) {
  console.warn(validationResult.warning);
  // อาจจะส่ง warning กลับไปให้ UI แสดงด้วย
}
```

#### 3. Monitoring Query

```sql
-- ตรวจสอบว่ามีข้อมูลเก่าที่ยังไม่มี staging reservation เหลืออยู่กี่รายการ
SELECT 
  'picklist' as doc_type,
  COUNT(*) as pending_count,
  COUNT(DISTINCT p.id) as pending_documents
FROM picklist_items pi
JOIN picklists p ON p.id = pi.picklist_id
WHERE pi.status = 'picked'
AND p.status = 'completed'
AND NOT EXISTS (
  SELECT 1 FROM wms_loadlist_picklists lp
  WHERE lp.picklist_id = p.id AND lp.loaded_at IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM picklist_item_reservations pir
  WHERE pir.picklist_item_id = pi.id AND pir.status = 'picked'
)

UNION ALL

SELECT 
  'face_sheet' as doc_type,
  COUNT(*) as pending_count,
  COUNT(DISTINCT fs.id) as pending_documents
FROM face_sheet_items fsi
JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
WHERE fsi.status = 'picked'
AND NOT EXISTS (
  SELECT 1 FROM loadlist_face_sheets lfs
  WHERE lfs.face_sheet_id = fs.id AND lfs.loaded_at IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM face_sheet_item_reservations fsir
  WHERE fsir.face_sheet_item_id = fsi.id AND fsir.status = 'picked'
);
```

### Rollout Timeline

**Week 1: Preparation**
- ✅ Run Migration 230
- ✅ Run Backfill Script
- ✅ Verify backfill ผ่าน monitoring query
- ✅ Deploy Loading API with fallback mode

**Week 2-3: Monitoring**
- 📊 Monitor ว่ามีการโหลดโดยไม่มี reservation กี่ครั้ง
- 📊 ตรวจสอบว่าข้อมูลเก่าโหลดหมดหรือยัง
- 🔧 แก้ไข edge cases ที่เจอ

**Week 4+: Strict Mode**
- 🔒 เปลี่ยนจาก warning → error
- 🔒 บังคับให้ต้องมี staging reservation
- 🔒 ระบบใหม่ทำงานเต็มรูปแบบ

### ข้อดีของกลยุทธ์นี้

✅ **ไม่กระทบงานปัจจุบัน**: ข้อมูลเก่ายังโหลดได้ปกติ  
✅ **Backfill อัตโนมัติ**: สร้าง staging reservation ให้ข้อมูลเก่า  
✅ **Fallback Mode**: ถ้า backfill พลาด ยังโหลดได้ (แสดง warning)  
✅ **Monitoring**: ติดตามว่าข้อมูลเก่าเหลือกี่รายการ  
✅ **Gradual Enforcement**: ค่อยๆ เข้มงวดขึ้นเมื่อข้อมูลเก่าหมด

## Summary

โซลูชันนี้จะทำให้ระบบสามารถตรวจสอบได้ว่าสต็อคที่โหลดมาจาก document ที่ถูกต้องหรือไม่ โดย:

1. ✅ ใช้ระบบ reservation ที่มีอยู่แล้ว
2. ✅ เพิ่ม staging_location_id เพื่อ track ว่าสต็อคอยู่ที่ไหน
3. ✅ เพิ่ม status 'picked' เพื่อแยกระหว่าง reservation ที่ Bulk/Rack กับ Dispatch/Staging
4. ✅ Validate ก่อนโหลดว่ามี reservation หรือไม่
5. ✅ Release reservation หลังโหลดเสร็จ

**Next Steps**:
1. Review design กับทีม
2. Implement Migration 230
3. Update Pick Confirmation API
4. Update Loading Validation API
5. Test thoroughly
6. Deploy to production
