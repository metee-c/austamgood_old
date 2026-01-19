# เอกสารออกแบบ: ระบบตรวจสอบเอกสารก่อนโหลด (Document Verification for Loading)

## ภาพรวม

ระบบตรวจสอบเอกสารก่อนโหลดเป็นฟีเจอร์ที่เพิ่มความสามารถในการตรวจสอบว่าสต็อคที่กำลังจะโหลดขึ้นรถนั้นมาจาก Picklist, Face Sheet หรือ Bonus Face Sheet ที่ได้ยืนยันการหยิบแล้วจริง โดยใช้กลไก **staging reservation** เป็นตัว "ติดแท็ก" สต็อคว่าเป็นของเอกสารใด

### ปัญหาที่ต้องแก้ไข

ปัจจุบันระบบไม่มีการตรวจสอบว่าสต็อคที่อยู่ใน Dispatch/PQTD/MRTD/Prep Area มาจากเอกสารใดที่ยืนยันหยิบแล้ว ทำให้เกิดสถานการณ์ที่:

1. Picklist A หยิบสินค้า SKU-001 จำนวน 100 ชิ้น → ย้ายไป Dispatch
2. Picklist B หยิบสินค้า SKU-001 จำนวน 50 ชิ้น → ย้ายไป Dispatch  
3. เมื่อโหลด Loadlist ที่มี Picklist A → ระบบเช็คเพียงว่า Dispatch มี SKU-001 >= 100 ชิ้น (ผ่าน)
4. **แต่ไม่สามารถระบุได้ว่า 100 ชิ้นที่โหลดไปนั้นมาจาก Picklist A หรือ B**

### โซลูชัน

ใช้ระบบ **staging reservation** เพื่อติดแท็กสต็อคว่ามาจากเอกสารใด:
- **หลังยืนยันหยิบ**: สร้าง staging reservation ที่ Dispatch/Staging location
- **ก่อนโหลด**: ตรวจสอบว่ามี staging reservation สำหรับเอกสารนั้นหรือไม่
- **หลังโหลด**: ปล่อย staging reservation และย้ายสต็อคไป Delivery-In-Progress

## สถาปัตยกรรม

### Workflow ใหม่

#### 1. Pick Confirmation (ยืนยันหยิบ)
```
[Bulk/Rack] --pick--> [Dispatch/Staging]
     |                        |
     v                        v
Release old reservation   Create staging reservation
(status: reserved)        (status: picked)
```

#### 2. Loading Validation (ตรวจสอบก่อนโหลด)
```
Check staging reservation exists?
  ├─ Yes + Stock sufficient → Allow loading
  ├─ Yes + Stock insufficient → Error (stock used)
  ├─ No + Strict mode → Error (no reservation)
  └─ No + Fallback mode → Warning + Allow loading
```

#### 3. Loading Complete (ยืนยันโหลด)
```
[Dispatch/Staging] --load--> [Delivery-In-Progress]
         |
         v
Release staging reservation
(status: picked → loaded)
```


## Components และ Interfaces

### 1. Database Schema Changes

#### เพิ่ม Columns ใน Reservation Tables

```sql
-- picklist_item_reservations
ALTER TABLE picklist_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id),
  ADD COLUMN loaded_at TIMESTAMP;

-- face_sheet_item_reservations
ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id),
  ADD COLUMN loaded_at TIMESTAMP;

-- bonus_face_sheet_item_reservations
ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id),
  ADD COLUMN loaded_at TIMESTAMP;
```

#### Status Flow

```
reserved → picked → loaded
   |         |        |
Bulk/Rack  Staging  Completed
```

- **reserved**: สต็อคถูกจองที่ Bulk/Rack (เดิม)
- **picked**: สต็อคถูกย้ายไป Dispatch/Staging และมี staging reservation (ใหม่)
- **loaded**: สต็อคถูกโหลดไปแล้ว (ใหม่)

### 2. Database Functions

#### create_staging_reservation_after_pick()

สร้าง staging reservation หลังยืนยันหยิบ

**Parameters**:
- `p_document_type`: 'picklist', 'face_sheet', 'bonus_face_sheet'
- `p_document_item_id`: ID ของ item ในเอกสาร
- `p_sku_id`: SKU ID
- `p_quantity_piece`: จำนวนชิ้น
- `p_quantity_pack`: จำนวนแพ็ค
- `p_staging_location_id`: Location ID ของ Dispatch/Staging
- `p_balance_id`: Inventory balance ID

**Returns**: `{ success, message, reservation_id }`

**Logic**:
1. Insert reservation record ใน table ที่เหมาะสม
2. Set status = 'picked'
3. Set staging_location_id
4. Update inventory_balances.reserved_piece_qty

#### validate_staging_reservations()

ตรวจสอบ staging reservation ก่อนโหลด

**Parameters**:
- `p_document_type`: ประเภทเอกสาร
- `p_document_ids`: Array ของ document IDs
- `p_staging_location_id`: Location ID ที่ต้องการโหลด

**Returns**: `{ success, message, missing_items }`

**Logic**:
1. Query reservations ที่ status = 'picked'
2. เช็คว่าทุก item มี reservation หรือไม่
3. เช็คว่า reserved quantity เพียงพอหรือไม่
4. Return validation result

#### release_staging_reservations_after_load()

ปล่อย staging reservation หลังโหลด

**Parameters**:
- `p_document_type`: ประเภทเอกสาร
- `p_document_ids`: Array ของ document IDs
- `p_staging_location_id`: Location ID ที่โหลด

**Returns**: `{ success, message, reservations_released }`

**Logic**:
1. Update reservations: status = 'loaded', loaded_at = NOW()
2. Update inventory_balances: ลด reserved_piece_qty
3. Return จำนวน reservations ที่ปล่อย

### 3. API Changes

#### Pick Confirmation APIs

**Files**:
- `app/api/picklists/[id]/items/confirm/route.ts`
- `app/api/face-sheets/[id]/items/confirm/route.ts`
- `app/api/bonus-face-sheets/[id]/items/confirm/route.ts`

**Changes**:
1. หลังปล่อย reservation จาก Bulk/Rack
2. เรียก `create_staging_reservation_after_pick()`
3. บันทึก staging reservation ที่ Dispatch/Staging

#### Loading Complete API

**File**: `app/api/mobile/loading/complete/route.ts`

**Changes**:
1. **ก่อนโหลด**: เรียก `validate_staging_reservations()`
2. **ถ้า validation ผ่าน**: ดำเนินการโหลดตามปกติ
3. **หลังโหลด**: เรียก `release_staging_reservations_after_load()`


## Data Models

### Staging Reservation Model

```typescript
interface StagingReservation {
  reservation_id: number;
  document_item_id: number;  // picklist_item_id, face_sheet_item_id, etc.
  balance_id: number;
  reserved_piece_qty: number;
  reserved_pack_qty: number;
  status: 'reserved' | 'picked' | 'loaded';
  staging_location_id: number | null;  // NULL for 'reserved', set for 'picked'
  loaded_at: Date | null;  // NULL until 'loaded'
  created_at: Date;
  updated_at: Date;
}
```

### Validation Result Model

```typescript
interface ValidationResult {
  valid: boolean;
  warning?: string;
  missing?: Array<{
    document_item_id: number;
    sku_id: string;
    required_qty: number;
  }>;
}
```

### Loading Request Model

```typescript
interface LoadingRequest {
  loadlist_code: string;
  document_type: 'picklist' | 'face_sheet' | 'bonus_face_sheet';
  document_ids: number[];
  staging_location_id: number;
  mode: 'strict' | 'fallback';  // Deployment mode
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection และ Consolidation

หลังจากวิเคราะห์ acceptance criteria ทั้งหมด เราพบว่ามี properties บางตัวที่ซ้ำซ้อนหรือสามารถรวมกันได้:

**Properties ที่รวมกัน**:
- AC 1.1, 1.2, 1.3 → Property 1 (Release reservation for all document types)
- AC 1.6, 1.7, 1.8, 1.9 → Property 3 (Staging reservation completeness)
- AC 2.6, 2.7, 2.8 → Property 6 (Validation completeness)
- AC 3.2, 3.3, 3.4 → Property 9 (Release reservation completeness)
- AC 6.1, 6.2 → Property 15 (Referential integrity)

**Properties ที่ไม่ testable**:
- AC 4.9: Manual process (ไม่ใช่ automated)
- AC 5.1-5.10: Performance requirements (ต้องใช้ load testing)

### Correctness Properties List

#### Property 1: Release Bulk/Rack Reservation on Pick
*For any* document (Picklist, Face Sheet, Bonus Face Sheet) with items, when pick confirmation is executed, the system should release all reservations from Bulk/Rack locations

**Validates: Requirements 1.1, 1.2, 1.3**

#### Property 2: Stock Movement to Staging
*For any* picked item, after releasing Bulk/Rack reservation, the system should move stock to the appropriate staging location (Dispatch, PQTD, MRTD, or Prep Area)

**Validates: Requirements 1.4**

#### Property 3: Staging Reservation Creation Completeness
*For any* picked item, the created staging reservation should have status='picked', valid balance_id, valid staging_location_id, and complete document information (document_type, document_id, document_item_id)

**Validates: Requirements 1.5, 1.6, 1.7, 1.8, 1.9**

#### Property 4: Pick Confirmation Atomicity
*For any* pick confirmation operation, if staging reservation creation fails, the system should rollback stock movement and return an error

**Validates: Requirements 1.10**

#### Property 5: Staging Reservation Validation Before Loading
*For any* loading request, the system should validate that staging reservations exist for all items in the document before allowing the load

**Validates: Requirements 2.1**

#### Property 6: Strict Mode Enforcement
*For any* loading request in strict mode, if staging reservations are missing, the system should reject the load with an error message

**Validates: Requirements 2.2**

#### Property 7: Fallback Mode Behavior
*For any* loading request in fallback mode, if staging reservations are missing, the system should allow loading but return a warning and log the event

**Validates: Requirements 2.3, 2.9, 4.6, 4.7**

#### Property 8: Insufficient Stock Detection
*For any* loading request, if staging reservations exist but actual stock at staging location is insufficient, the system should reject the load with an error

**Validates: Requirements 2.4**

#### Property 9: Successful Loading Validation
*For any* loading request, if staging reservations exist with status='picked' at the correct staging_location_id and stock is sufficient, the system should allow loading

**Validates: Requirements 2.5, 2.6, 2.7, 2.8**

#### Property 10: Bonus Face Sheet Multi-Location Check
*For any* Bonus Face Sheet loading request, the system should check staging reservations across PQTD, MRTD, Prep Area, and Dispatch locations

**Validates: Requirements 2.10**

#### Property 11: Staging Reservation Release on Load
*For any* successful loading operation, the system should release all related staging reservations by updating status to 'loaded' and setting loaded_at timestamp

**Validates: Requirements 3.1, 3.2, 3.3**

#### Property 12: Inventory Balance Update on Release
*For any* released staging reservation, the system should decrease reserved_piece_qty and reserved_pack_qty in inventory_balances

**Validates: Requirements 3.4**

#### Property 13: Stock Movement to Delivery
*For any* loaded item, the system should move stock from Dispatch/Staging to Delivery-In-Progress location

**Validates: Requirements 3.5**

#### Property 14: Ledger Recording Completeness
*For any* stock movement during loading, the system should record inventory ledger entries for both OUT from staging and IN to Delivery-In-Progress

**Validates: Requirements 3.6, 3.7, 3.8**

#### Property 15: Loading Atomicity
*For any* loading operation, if staging reservation release fails, the system should rollback stock movement and return an error

**Validates: Requirements 3.9**

#### Property 16: Loading Success Response
*For any* successful loading operation, the system should return a success response with the loadlist_code

**Validates: Requirements 3.10**

#### Property 17: Backfill Reservation Creation
*For any* existing picked item without staging reservation, the backfill script should create a staging reservation with status='picked', linked to the correct inventory_balance at the appropriate staging location

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

#### Property 18: Referential Integrity
*For any* staging reservation, the balance_id should reference an existing inventory_balance and staging_location_id should reference an existing master_location

**Validates: Requirements 6.1, 6.2**

#### Property 19: Non-Negative Reserved Quantity
*For any* inventory_balance update, the reserved_piece_qty should never become negative

**Validates: Requirements 6.3, 6.7**

#### Property 20: Transaction Atomicity
*For any* stock movement operation, if any step fails, the system should rollback all changes within the transaction

**Validates: Requirements 6.4, 6.5**

#### Property 21: Ledger-Reservation Consistency
*For any* inventory ledger entry during loading, the quantity should match the staging reservation quantity

**Validates: Requirements 6.6**

#### Property 22: Reservation Deletion Guard
*For any* staging reservation deletion attempt, the system should only allow deletion if status='loaded'

**Validates: Requirements 6.8**

#### Property 23: Unique Staging Reservation
*For any* staging reservation creation, the system should prevent duplicate reservations for the same document_item_id at the same staging_location_id

**Validates: Requirements 6.9**

#### Property 24: Referential Integrity Maintenance
*For any* system operation, the referential integrity between reservations and inventory_balances should be maintained

**Validates: Requirements 6.10**


## Error Handling

### Error Types

#### 1. Validation Errors
- **Missing Staging Reservation**: เมื่อไม่มี staging reservation สำหรับเอกสาร (strict mode)
- **Insufficient Stock**: เมื่อมี reservation แต่สต็อคไม่เพียงพอ
- **Invalid Document**: เมื่อ document type ไม่ถูกต้อง
- **Invalid Location**: เมื่อ staging_location_id ไม่ถูกต้อง

#### 2. Data Integrity Errors
- **Invalid Balance Reference**: เมื่อ balance_id ไม่มีอยู่ใน inventory_balances
- **Invalid Location Reference**: เมื่อ staging_location_id ไม่มีอยู่ใน master_location
- **Negative Reserved Quantity**: เมื่อ reserved_piece_qty จะติดลบ
- **Duplicate Reservation**: เมื่อพยายามสร้าง reservation ซ้ำ

#### 3. Transaction Errors
- **Rollback Required**: เมื่อ operation ล้มเหลวและต้อง rollback
- **Deadlock**: เมื่อเกิด database deadlock (ใช้ row locking)

### Error Handling Strategy

```typescript
try {
  // Begin transaction
  await supabase.rpc('begin_transaction');
  
  // 1. Validate staging reservations
  const validation = await validateStagingReservations(...);
  if (!validation.valid) {
    throw new ValidationError(validation.message);
  }
  
  // 2. Move stock
  await moveStockToDelivery(...);
  
  // 3. Release reservations
  await releaseStagingReservations(...);
  
  // 4. Update loadlist
  await updateLoadlistStatus(...);
  
  // Commit transaction
  await supabase.rpc('commit_transaction');
  
  return { success: true, loadlist_code };
  
} catch (error) {
  // Rollback transaction
  await supabase.rpc('rollback_transaction');
  
  // Log error
  console.error('Loading failed:', error);
  
  // Return appropriate error
  if (error instanceof ValidationError) {
    return { error: error.message, code: 'VALIDATION_ERROR' };
  } else if (error instanceof DataIntegrityError) {
    return { error: error.message, code: 'DATA_INTEGRITY_ERROR' };
  } else {
    return { error: 'เกิดข้อผิดพลาดในการโหลด', code: 'UNKNOWN_ERROR' };
  }
}
```

### Fallback Mode Handling

```typescript
// In fallback mode, missing reservations are warnings, not errors
if (mode === 'fallback' && !validation.valid) {
  console.warn('⚠️ Loading without staging reservations (legacy data):', {
    documentType,
    documentIds,
    missingCount: validation.missing?.length
  });
  
  // Log to monitoring system
  await logFallbackLoading({
    document_type: documentType,
    document_ids: documentIds,
    missing_items: validation.missing,
    timestamp: new Date()
  });
  
  // Continue with loading (don't throw error)
  warning = `โหลดสำเร็จ แต่ตรวจพบข้อมูลเก่าที่ไม่มี staging reservation (${validation.missing?.length} รายการ)`;
}
```

## Testing Strategy

### Dual Testing Approach

ระบบนี้ต้องการทั้ง **unit tests** และ **property-based tests** เพื่อความครอบคลุม:

- **Unit tests**: ทดสอบ specific examples, edge cases, และ error conditions
- **Property tests**: ทดสอบ universal properties ข้ามทุก inputs

### Unit Testing

**Focus Areas**:
1. **Specific Examples**: ทดสอบ scenarios ที่เฉพาะเจาะจง
   - Normal flow: Pick → Validate → Load
   - Wrong document: Load document A with reservation B
   - Stock already used: Reservation exists but stock gone

2. **Edge Cases**:
   - Empty picklist
   - Multiple documents same SKU
   - Bonus Face Sheet across multiple locations
   - Concurrent pick confirmations

3. **Error Conditions**:
   - Missing staging reservation (strict mode)
   - Insufficient stock
   - Invalid references
   - Transaction rollback

**Test Framework**: Jest + Supabase Test Helpers

**Example Unit Test**:
```typescript
describe('Loading Validation', () => {
  it('should reject loading when staging reservation is missing in strict mode', async () => {
    // Arrange
    const picklist = await createPicklist({ sku: 'SKU-001', qty: 100 });
    await confirmPick(picklist.id); // Creates staging reservation
    await deleteReservation(picklist.id); // Simulate missing reservation
    
    // Act
    const result = await loadPicklist(picklist.id, { mode: 'strict' });
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('ไม่มี staging reservation');
  });
});
```

### Property-Based Testing

**Configuration**:
- **Library**: fast-check (TypeScript)
- **Iterations**: 100 ครั้งต่อ property
- **Tag Format**: `Feature: document-verification-loading, Property {number}: {property_text}`

**Focus Areas**:
1. **Invariants**: Properties ที่ต้องคงที่
   - Reserved quantity never negative
   - Referential integrity maintained
   - Status flow correct (reserved → picked → loaded)

2. **Round Trip**: Operations ที่ต้อง reversible
   - Create reservation → Release reservation → Balance restored

3. **Idempotence**: Operations ที่ทำซ้ำได้
   - Validate twice → Same result
   - Release loaded reservation → No effect

4. **Metamorphic**: Relationships ระหว่าง operations
   - Total reserved = Sum of all reservations
   - Ledger entries = Stock movements

**Example Property Test**:
```typescript
import fc from 'fast-check';

describe('Property: Staging Reservation Creation Completeness', () => {
  // Feature: document-verification-loading, Property 3
  it('should create complete staging reservation for any picked item', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentType: fc.constantFrom('picklist', 'face_sheet', 'bonus_face_sheet'),
          skuId: fc.string({ minLength: 1, maxLength: 50 }),
          quantity: fc.integer({ min: 1, max: 1000 }),
          locationCode: fc.constantFrom('Dispatch', 'PQTD', 'MRTD')
        }),
        async ({ documentType, skuId, quantity, locationCode }) => {
          // Arrange
          const document = await createDocument(documentType, skuId, quantity);
          const location = await getLocation(locationCode);
          
          // Act
          await confirmPick(document.id);
          
          // Assert
          const reservation = await getStagingReservation(document.item_id);
          expect(reservation).toBeDefined();
          expect(reservation.status).toBe('picked');
          expect(reservation.balance_id).toBeGreaterThan(0);
          expect(reservation.staging_location_id).toBe(location.location_id);
          expect(reservation.document_type).toBe(documentType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Scenarios**:
1. **End-to-End Flow**: Pick → Validate → Load → Verify
2. **Concurrent Operations**: Multiple picks/loads simultaneously
3. **Fallback Mode**: Legacy data loading
4. **Backfill Script**: Verify backfill correctness

**Tools**: Playwright + Supabase Test Database

### Performance Testing

**Metrics**:
- Pick confirmation: ≤ 500ms
- Loading validation: ≤ 1s
- Backfill script: ≤ 5 นาที

**Tools**: k6 or Artillery


## Deployment Strategy

### Phase 1: Migration + Backfill (สัปดาห์ที่ 1)

**Objectives**:
- เพิ่ม database schema
- สร้าง staging reservations สำหรับข้อมูลเก่า
- ทดสอบใน staging environment

**Steps**:
1. รัน Migration 230 (เพิ่ม columns และ indexes)
2. รัน Backfill Script สำหรับข้อมูลเก่า
3. Verify backfill ด้วย monitoring query
4. ทดสอบใน staging environment

**Success Criteria**:
- ✅ Schema changes applied successfully
- ✅ Backfill script completes within 5 minutes
- ✅ All existing picked items have staging reservations
- ✅ No data integrity violations

### Phase 2: Fallback Mode Deployment (สัปดาห์ที่ 1-2)

**Objectives**:
- Deploy API changes with fallback mode
- Monitor และ log รายการที่โหลดโดยไม่มี reservation
- แก้ไข edge cases ที่พบ

**Steps**:
1. Deploy Pick Confirmation APIs (create staging reservations)
2. Deploy Loading API with fallback mode enabled
3. Monitor logs และ warnings
4. Fix any edge cases discovered

**Success Criteria**:
- ✅ New picks create staging reservations
- ✅ Loading works for both new and legacy data
- ✅ Warnings logged for legacy data loads
- ✅ No blocking errors for users

**Monitoring Queries**:
```sql
-- Count legacy loads (without reservation)
SELECT COUNT(*) as legacy_loads
FROM loading_fallback_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Count remaining legacy data
SELECT 
  document_type,
  COUNT(*) as pending_count
FROM (
  -- Picklists without staging reservation
  SELECT 'picklist' as document_type, pi.id
  FROM picklist_items pi
  WHERE pi.status = 'picked'
  AND NOT EXISTS (
    SELECT 1 FROM picklist_item_reservations pir
    WHERE pir.picklist_item_id = pi.id AND pir.status = 'picked'
  )
  
  UNION ALL
  
  -- Face Sheets without staging reservation
  SELECT 'face_sheet', fsi.id
  FROM face_sheet_items fsi
  WHERE fsi.status = 'picked'
  AND NOT EXISTS (
    SELECT 1 FROM face_sheet_item_reservations fsir
    WHERE fsir.face_sheet_item_id = fsi.id AND fsir.status = 'picked'
  )
) sub
GROUP BY document_type;
```

### Phase 3: Strict Mode Enforcement (สัปดาห์ที่ 3+)

**Objectives**:
- เปลี่ยนจาก fallback mode เป็น strict mode
- บังคับให้ต้องมี staging reservation
- Monitor และแก้ไขปัญหาที่เกิดขึ้น

**Prerequisites**:
- ✅ Legacy data count = 0 (ข้อมูลเก่าโหลดหมดแล้ว)
- ✅ No fallback warnings in last 7 days
- ✅ All stakeholders informed

**Steps**:
1. Verify legacy data count = 0
2. Update API configuration: mode = 'strict'
3. Deploy strict mode
4. Monitor for any errors
5. Provide support for any issues

**Success Criteria**:
- ✅ All loads require staging reservations
- ✅ No legacy data loads
- ✅ System working as designed
- ✅ No user complaints

**Rollback Plan**:
- If issues occur, revert to fallback mode immediately
- Investigate root cause
- Fix issues before re-attempting strict mode

### Rollback Strategy

**If Migration Fails**:
```sql
-- Rollback Migration 230
ALTER TABLE picklist_item_reservations 
  DROP COLUMN IF EXISTS staging_location_id,
  DROP COLUMN IF EXISTS loaded_at;

ALTER TABLE face_sheet_item_reservations 
  DROP COLUMN IF EXISTS staging_location_id,
  DROP COLUMN IF EXISTS loaded_at;

ALTER TABLE bonus_face_sheet_item_reservations 
  DROP COLUMN IF EXISTS staging_location_id,
  DROP COLUMN IF EXISTS loaded_at;

DROP FUNCTION IF EXISTS create_staging_reservation_after_pick;
DROP FUNCTION IF EXISTS validate_staging_reservations;
DROP FUNCTION IF EXISTS release_staging_reservations_after_load;
```

**If API Deployment Fails**:
- Revert to previous API version
- Keep database changes (they're backward compatible)
- Investigate and fix issues
- Re-deploy when ready

## Risk Mitigation

### Risk 1: Backfill Script ล้มเหลว

**Impact**: ข้อมูลเก่าไม่มี staging reservation → ไม่สามารถโหลดได้ใน strict mode

**Mitigation**:
- ทดสอบ backfill script ใน staging environment ก่อน
- มี rollback script พร้อมใช้งาน
- ใช้ fallback mode ในระหว่างทดสอบ
- แบ่ง backfill เป็น batch เล็กๆ
- Monitor progress และ errors

**Contingency**:
- ถ้า backfill ล้มเหลว → ใช้ fallback mode ต่อ
- แก้ไข backfill script
- รัน backfill ใหม่สำหรับข้อมูลที่เหลือ

### Risk 2: Performance Impact

**Impact**: ระบบช้าลงเนื่องจาก validation overhead

**Mitigation**:
- สร้าง database indexes ที่จำเป็น
- ทดสอบ load test ก่อน deploy
- Monitor query performance อย่างต่อเนื่อง
- ใช้ connection pooling
- Optimize queries ถ้าจำเป็น

**Contingency**:
- ถ้า performance ไม่ดี → เพิ่ม indexes
- Optimize database functions
- Scale up database resources ถ้าจำเป็น

### Risk 3: ข้อมูลเก่าไม่ครบ

**Impact**: มีข้อมูลเก่าที่ backfill ไม่ได้ → ต้องใช้ fallback mode นานขึ้น

**Mitigation**:
- ใช้ fallback mode เป็นค่าเริ่มต้น
- Log รายการที่ไม่มี reservation
- Monitor และแก้ไขทีละน้อย
- มี manual process สำหรับ edge cases

**Contingency**:
- ถ้ามีข้อมูลเก่าเหลือ → ยังคงใช้ fallback mode
- สร้าง manual script สำหรับ edge cases
- รอให้ข้อมูลเก่าโหลดหมดก่อนเปลี่ยนเป็น strict mode

## Success Metrics

### Functional Metrics

- ✅ **Staging Reservation Creation Rate**: 100% ของ pick confirmations สร้าง staging reservation
- ✅ **Validation Success Rate**: >99% ของ loading validations ผ่าน
- ✅ **Loading Success Rate**: >99% ของ loadings สำเร็จ
- ✅ **Legacy Data Count**: 0 รายการหลัง Phase 2

### Performance Metrics

- ✅ **Pick Confirmation Time**: ≤ 500ms (p95)
- ✅ **Loading Validation Time**: ≤ 1s (p95)
- ✅ **Backfill Script Time**: ≤ 5 นาที
- ✅ **Database Query Time**: ≤ 100ms (p95)

### Data Integrity Metrics

- ✅ **Referential Integrity Violations**: 0
- ✅ **Negative Reserved Quantity**: 0
- ✅ **Orphaned Reservations**: 0
- ✅ **Ledger Discrepancies**: 0

### User Experience Metrics

- ✅ **User Complaints**: 0 related to document verification
- ✅ **Support Tickets**: <5 per week
- ✅ **Error Rate**: <1% of operations
- ✅ **User Satisfaction**: >90%

## Monitoring และ Alerting

### Key Metrics to Monitor

1. **Staging Reservation Creation**:
   - Count per hour
   - Success rate
   - Error rate

2. **Loading Validation**:
   - Validation success rate
   - Fallback mode usage
   - Missing reservation count

3. **Performance**:
   - API response times
   - Database query times
   - Transaction durations

4. **Data Integrity**:
   - Referential integrity checks
   - Reserved quantity checks
   - Ledger consistency checks

### Alerts

**Critical Alerts** (immediate action required):
- Staging reservation creation failure rate > 5%
- Loading validation failure rate > 10%
- Referential integrity violations detected
- Negative reserved quantity detected

**Warning Alerts** (investigate within 24h):
- Fallback mode usage > 10% (after Phase 2)
- API response time > 1s (p95)
- Legacy data count not decreasing

**Info Alerts** (monitor):
- Daily staging reservation count
- Daily loading count
- Backfill progress

## Documentation

### User Documentation

- **Pick Confirmation Guide**: อธิบายการทำงานของ staging reservation
- **Loading Guide**: อธิบายการตรวจสอบเอกสารก่อนโหลด
- **Troubleshooting Guide**: แก้ไขปัญหาที่พบบ่อย

### Developer Documentation

- **API Documentation**: API endpoints และ parameters
- **Database Schema**: Schema changes และ relationships
- **Function Documentation**: Database functions และ usage
- **Testing Guide**: วิธีการทดสอบ properties และ edge cases

### Operations Documentation

- **Deployment Guide**: ขั้นตอนการ deploy แต่ละ phase
- **Monitoring Guide**: Metrics และ alerts ที่ต้อง monitor
- **Rollback Guide**: ขั้นตอนการ rollback ถ้าเกิดปัญหา
- **Troubleshooting Guide**: แก้ไขปัญหาที่พบบ่อย

---

**หมายเหตุ**: เอกสารนี้เป็น design document ฉบับสมบูรณ์ที่ใช้ภาษาไทยเป็นหลัก โดยอ้างอิงจาก requirements document และ original design document จาก `docs/loading/DOCUMENT_VERIFICATION_DESIGN.md`
