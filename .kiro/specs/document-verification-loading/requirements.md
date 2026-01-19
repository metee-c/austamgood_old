# เอกสารความต้องการ: ระบบตรวจสอบเอกสารก่อนโหลด (Document Verification for Loading)

## บทนำ

ระบบตรวจสอบเอกสารก่อนโหลดเป็นฟีเจอร์ที่เพิ่มความสามารถในการตรวจสอบว่าสต็อคที่กำลังจะโหลดขึ้นรถนั้นมาจาก Picklist, Face Sheet หรือ Bonus Face Sheet ที่ได้ยืนยันการหยิบแล้วจริง โดยใช้กลไก **staging reservation** เป็นตัว "ติดแท็ก" สต็อคว่าเป็นของเอกสารใด

### ปัญหาที่ต้องแก้ไข

ปัจจุบันระบบไม่มีการตรวจสอบว่าสต็อคที่อยู่ใน Dispatch/PQTD/MRTD/Prep Area มาจากเอกสารใดที่ยืนยันหยิบแล้ว ทำให้เกิดสถานการณ์ที่:

1. Picklist A หยิบสินค้า SKU-001 จำนวน 100 ชิ้น → ย้ายไป Dispatch
2. Picklist B หยิบสินค้า SKU-001 จำนวน 50 ชิ้น → ย้ายไป Dispatch  
3. เมื่อโหลด Loadlist ที่มี Picklist A → ระบบเช็คเพียงว่า Dispatch มี SKU-001 >= 100 ชิ้น (ผ่าน)
4. **แต่ไม่สามารถระบุได้ว่า 100 ชิ้นที่โหลดไปนั้นมาจาก Picklist A หรือ B**

## ความต้องการ

### ความต้องการที่ 1: การสร้าง Staging Reservation เมื่อยืนยันการหยิบ

**User Story:** ในฐานะพนักงานคลังสินค้า ฉันต้องการให้ระบบสร้าง staging reservation อัตโนมัติเมื่อฉันยืนยันการหยิบสินค้า เพื่อให้สต็อคถูกติดแท็กกับเอกสารที่ถูกต้อง

#### Acceptance Criteria

1. WHEN พนักงานยืนยันการหยิบสินค้าจาก Picklist THEN ระบบ SHALL ปล่อย reservation จาก Bulk/Rack location
2. WHEN พนักงานยืนยันการหยิบสินค้าจาก Face Sheet THEN ระบบ SHALL ปล่อย reservation จาก Bulk/Rack location
3. WHEN พนักงานยืนยันการหยิบสินค้าจาก Bonus Face Sheet THEN ระบบ SHALL ปล่อย reservation จาก Bulk/Rack location
4. WHEN ระบบปล่อย reservation จาก Bulk/Rack แล้ว THEN ระบบ SHALL ย้ายสต็อคไป Dispatch หรือ staging location ที่เหมาะสม
5. WHEN ระบบย้ายสต็อคไป staging location แล้ว THEN ระบบ SHALL สร้าง staging reservation ใหม่ที่ staging location นั้น
6. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL กำหนด status เป็น 'picked'
7. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL link กับ balance_id ที่ถูกต้อง
8. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL บันทึก staging_location_id
9. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL บันทึก document_type, document_id และ document_item_id
10. WHEN การสร้าง staging reservation ล้มเหลว THEN ระบบ SHALL rollback การย้ายสต็อคและแสดง error message

### ความต้องการที่ 2: การตรวจสอบ Staging Reservation ก่อนโหลด

**User Story:** ในฐานะพนักงานคลังสินค้า ฉันต้องการให้ระบบตรวจสอบ staging reservation ก่อนโหลด เพื่อให้มั่นใจว่าฉันโหลดเฉพาะสต็อคที่มาจากเอกสารที่ถูกต้อง

#### Acceptance Criteria

1. WHEN พนักงานยืนยันการโหลดสินค้า THEN ระบบ SHALL ตรวจสอบว่ามี staging reservation สำหรับเอกสารนั้นหรือไม่
2. IF ไม่มี staging reservation สำหรับเอกสาร AND ระบบอยู่ใน strict mode THEN ระบบ SHALL แสดง error "สต็อคไม่ได้มาจากเอกสารที่ยืนยันหยิบแล้ว"
3. IF ไม่มี staging reservation สำหรับเอกสาร AND ระบบอยู่ใน fallback mode THEN ระบบ SHALL แสดง warning และอนุญาตให้โหลดได้
4. IF มี staging reservation แต่จำนวนสต็อคที่ staging location ไม่เพียงพอ THEN ระบบ SHALL แสดง error "สต็อคที่จองไว้ไม่เพียงพอ (อาจถูกใช้ไปแล้ว)"
5. IF มี staging reservation และสต็อคเพียงพอ THEN ระบบ SHALL อนุญาตให้โหลดได้
6. WHEN ระบบตรวจสอบ staging reservation THEN ระบบ SHALL ตรวจสอบว่า reservation status เป็น 'picked'
7. WHEN ระบบตรวจสอบ staging reservation THEN ระบบ SHALL ตรวจสอบว่า staging_location_id ตรงกับ location ที่มีสต็อค
8. WHEN ระบบตรวจสอบ staging reservation THEN ระบบ SHALL รวมจำนวน reserved_piece_qty ของทุก reservation ที่เกี่ยวข้อง
9. IF ระบบอยู่ใน fallback mode และโหลดโดยไม่มี reservation THEN ระบบ SHALL log รายการนั้นเพื่อ monitoring
10. WHEN ระบบตรวจสอบ staging reservation สำหรับ Bonus Face Sheet THEN ระบบ SHALL ตรวจสอบจาก PQTD, MRTD, Prep Area หรือ Dispatch ตามลำดับ

### ความต้องการที่ 3: การปล่อย Staging Reservation หลังโหลด

**User Story:** ในฐานะพนักงานคลังสินค้า ฉันต้องการให้ระบบปล่อย staging reservation หลังจากโหลดเสร็จ เพื่อให้การติดตามสต็อคถูกต้องแม่นยำ

#### Acceptance Criteria

1. WHEN พนักงานยืนยันการโหลดสินค้าสำเร็จ THEN ระบบ SHALL ปล่อย staging reservation ที่เกี่ยวข้อง
2. WHEN ระบบปล่อย staging reservation THEN ระบบ SHALL อัปเดต status จาก 'picked' เป็น 'loaded'
3. WHEN ระบบปล่อย staging reservation THEN ระบบ SHALL บันทึก loaded_at timestamp
4. WHEN ระบบปล่อย staging reservation THEN ระบบ SHALL ลด reserved_piece_qty และ reserved_pack_qty ใน inventory_balances
5. WHEN ระบบปล่อย staging reservation แล้ว THEN ระบบ SHALL ย้ายสต็อคจาก Dispatch/Staging ไป Delivery-In-Progress
6. WHEN ระบบย้ายสต็อค THEN ระบบ SHALL บันทึก inventory ledger (OUT จาก staging, IN ไป Delivery-In-Progress)
7. WHEN ระบบย้ายสต็อค THEN ระบบ SHALL อัปเดต loadlist status เป็น 'loaded'
8. WHEN ระบบย้ายสต็อค THEN ระบบ SHALL อัปเดต loaded_at timestamp ใน loadlist_picklists, loadlist_face_sheets หรือ loadlist_bonus_face_sheets
9. IF การปล่อย staging reservation ล้มเหลว THEN ระบบ SHALL rollback การย้ายสต็อคและแสดง error message
10. WHEN ระบบปล่อย staging reservation สำเร็จ THEN ระบบ SHALL ส่ง success response พร้อม loadlist_code

### ความต้องการที่ 4: การรองรับข้อมูลเก่า (Backward Compatibility)

**User Story:** ในฐานะผู้ดูแลระบบ ฉันต้องการให้ระบบจัดการข้อมูลเก่าได้อย่างเหมาะสม เพื่อให้รายการที่หยิบไว้แล้วสามารถโหลดได้ต่อไป

#### Acceptance Criteria

1. WHEN ระบบรัน Migration 230 THEN ระบบ SHALL เพิ่ม columns staging_location_id และ loaded_at ใน reservation tables
2. WHEN ระบบรัน backfill script THEN ระบบ SHALL สร้าง staging reservation สำหรับทุกรายการที่ picked แล้วแต่ยังไม่ loaded
3. WHEN ระบบสร้าง staging reservation ใน backfill THEN ระบบ SHALL link กับ inventory_balance ที่ถูกต้อง
4. WHEN ระบบสร้าง staging reservation ใน backfill THEN ระบบ SHALL กำหนด status เป็น 'picked'
5. WHEN ระบบสร้าง staging reservation ใน backfill THEN ระบบ SHALL กำหนด staging_location_id เป็น Dispatch, PQTD, MRTD หรือ Prep Area ตามที่มีสต็อค
6. IF ระบบอยู่ใน fallback mode AND ไม่มี staging reservation THEN ระบบ SHALL แสดง warning แต่อนุญาตให้โหลดได้
7. IF ระบบอยู่ใน fallback mode AND โหลดโดยไม่มี reservation THEN ระบบ SHALL log รายการนั้นพร้อม document_type, document_id และ timestamp
8. WHEN ระบบ monitor ข้อมูลเก่า THEN ระบบ SHALL นับจำนวนรายการที่ยังไม่มี staging reservation
9. IF จำนวนรายการที่ไม่มี staging reservation เหลือ 0 THEN ผู้ดูแลระบบ SHALL เปลี่ยนระบบเป็น strict mode
10. WHEN ระบบอยู่ใน strict mode AND ไม่มี staging reservation THEN ระบบ SHALL ห้ามโหลดและแสดง error

### ความต้องการที่ 5: ความต้องการด้านประสิทธิภาพ (Non-Functional)

**User Story:** ในฐานะผู้ใช้งานระบบ ฉันต้องการให้ระบบทำงานได้รวดเร็วไม่ช้ากว่าเดิม เพื่อไม่กระทบการทำงานประจำวัน

#### Acceptance Criteria

1. WHEN พนักงานยืนยันการหยิบสินค้า THEN ระบบ SHALL ตอบสนองภายใน 500 มิลลิวินาที
2. WHEN พนักงานยืนยันการโหลดสินค้า THEN ระบบ SHALL ตอบสนองภายใน 1 วินาที
3. WHEN ระบบรัน backfill script THEN ระบบ SHALL เสร็จสิ้นภายใน 5 นาที
4. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL ใช้ database index เพื่อเพิ่มประสิทธิภาพ
5. WHEN ระบบตรวจสอบ staging reservation THEN ระบบ SHALL ใช้ prepared statement เพื่อลด query time
6. WHEN ระบบมี concurrent requests THEN ระบบ SHALL จัดการ row locking เพื่อป้องกัน race condition
7. WHEN ระบบรัน backfill script THEN ระบบ SHALL ทำงานแบบ batch เพื่อลด database load
8. WHEN ระบบ log รายการที่โหลดโดยไม่มี reservation THEN ระบบ SHALL ใช้ async logging เพื่อไม่กระทบ response time
9. WHEN ระบบมี high load THEN ระบบ SHALL maintain response time ไม่เกิน 2 เท่าของ normal load
10. WHEN ระบบทำงาน THEN ระบบ SHALL ไม่ใช้ memory เกิน 10% จากปัจจุบัน

### ความต้องการที่ 6: ความต้องการด้านความถูกต้องของข้อมูล (Data Integrity)

**User Story:** ในฐานะผู้ดูแลระบบ ฉันต้องการให้ข้อมูลในระบบถูกต้องและสอดคล้องกัน เพื่อความน่าเชื่อถือของระบบ

#### Acceptance Criteria

1. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL ตรวจสอบว่า balance_id มีอยู่จริงใน inventory_balances
2. WHEN ระบบสร้าง staging reservation THEN ระบบ SHALL ตรวจสอบว่า staging_location_id มีอยู่จริงใน master_location
3. WHEN ระบบปล่อย staging reservation THEN ระบบ SHALL ตรวจสอบว่า reserved_piece_qty ใน inventory_balances ไม่ติดลบ
4. WHEN ระบบย้ายสต็อค THEN ระบบ SHALL ใช้ database transaction เพื่อความ atomic
5. IF transaction ล้มเหลว THEN ระบบ SHALL rollback ทุกการเปลี่ยนแปลง
6. WHEN ระบบบันทึก inventory ledger THEN ระบบ SHALL ตรวจสอบว่า quantity ตรงกับ staging reservation
7. WHEN ระบบอัปเดต inventory_balances THEN ระบบ SHALL ตรวจสอบว่า total_piece_qty ไม่ติดลบ
8. WHEN ระบบลบ staging reservation THEN ระบบ SHALL ตรวจสอบว่า status เป็น 'loaded' แล้ว
9. WHEN ระบบสร้าง staging reservation ซ้ำ THEN ระบบ SHALL ป้องกันด้วย unique constraint
10. WHEN ระบบทำงาน THEN ระบบ SHALL maintain referential integrity ระหว่าง reservation และ inventory_balances

## ข้อกำหนดทางเทคนิค

### การเปลี่ยนแปลง Database Schema

```sql
-- เพิ่ม staging_location_id เพื่อ track ว่าสต็อคอยู่ที่ไหนหลังหยิบ
ALTER TABLE picklist_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id);

ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id);

ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN staging_location_id INTEGER REFERENCES master_location(location_id);

-- เพิ่ม loaded_at timestamp
ALTER TABLE picklist_item_reservations 
  ADD COLUMN loaded_at TIMESTAMP;

ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN loaded_at TIMESTAMP;

ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN loaded_at TIMESTAMP;

-- สร้าง index เพื่อเพิ่มประสิทธิภาพ
CREATE INDEX idx_picklist_reservations_staging 
  ON picklist_item_reservations(staging_location_id, status) 
  WHERE status = 'picked';

CREATE INDEX idx_face_sheet_reservations_staging 
  ON face_sheet_item_reservations(staging_location_id, status) 
  WHERE status = 'picked';

CREATE INDEX idx_bonus_face_sheet_reservations_staging 
  ON bonus_face_sheet_item_reservations(staging_location_id, status) 
  WHERE status = 'picked';
```

### Status Flow

- **reserved**: สต็อคถูกจองที่ Bulk/Rack (เดิม)
- **picked**: สต็อคถูกย้ายไป Dispatch/Staging และมี staging reservation (ใหม่)
- **loaded**: สต็อคถูกโหลดไปแล้ว (ใหม่)

### API ที่ต้องแก้ไข

1. **Pick Confirmation APIs**
   - `app/api/picklists/[id]/items/confirm/route.ts`
   - `app/api/face-sheets/[id]/items/confirm/route.ts`
   - `app/api/bonus-face-sheets/[id]/items/confirm/route.ts`

2. **Loading Validation API**
   - `app/api/mobile/loading/complete/route.ts`

3. **Loading Complete API**
   - `app/api/mobile/loading/complete/route.ts`

### Database Functions ที่ต้องสร้าง

1. `create_staging_reservation_after_pick()` - สร้าง staging reservation หลังยืนยันหยิบ
2. `validate_staging_reservations()` - ตรวจสอบ staging reservation ก่อนโหลด
3. `release_staging_reservations_after_load()` - ปล่อย staging reservation หลังโหลด

## กลยุทธ์การ Deploy

### Phase 1: Migration + Backfill (สัปดาห์ที่ 1)
1. รัน Migration 230 (เพิ่ม columns และ indexes)
2. รัน Backfill Script สำหรับข้อมูลเก่า
3. ทดสอบใน staging environment

### Phase 2: Fallback Mode (สัปดาห์ที่ 1-2)
1. Deploy API changes พร้อม fallback mode
2. Monitor และ log รายการที่โหลดโดยไม่มี reservation
3. แก้ไข edge cases ที่พบ

### Phase 3: Strict Mode (สัปดาห์ที่ 3+)
1. ตรวจสอบว่าข้อมูลเก่าโหลดหมดแล้ว
2. เปลี่ยนเป็น strict mode
3. Monitor และแก้ไขปัญหาที่เกิดขึ้น

## Test Cases

### Test Case 1: Normal Flow
1. สร้าง Picklist A ที่มี SKU-001 จำนวน 100 ชิ้น
2. ยืนยันการหยิบ → ระบบสร้าง staging reservation ที่ Dispatch
3. โหลด Picklist A → ระบบตรวจสอบ reservation ผ่าน → โหลดสำเร็จ

### Test Case 2: Wrong Document
1. สร้าง Picklist A ที่มี SKU-001 จำนวน 100 ชิ้น
2. สร้าง Picklist B ที่มี SKU-001 จำนวน 50 ชิ้น
3. ยืนยันการหยิบ A → staging reservation A ที่ Dispatch
4. ยืนยันการหยิบ B → staging reservation B ที่ Dispatch
5. โหลด Picklist A → ต้องโหลดเฉพาะสต็อคที่มี reservation A

### Test Case 3: Stock Already Used
1. สร้าง Picklist A ที่มี SKU-001 จำนวน 100 ชิ้น
2. ยืนยันการหยิบ → staging reservation ที่ Dispatch
3. ทำ manual stock adjustment ลดสต็อคที่ Dispatch
4. โหลด Picklist A → ระบบแสดง error "สต็อคไม่เพียงพอ"

### Test Case 4: Multiple Documents Same SKU
1. สร้าง Picklist A ที่มี SKU-001 จำนวน 100 ชิ้น
2. สร้าง Face Sheet B ที่มี SKU-001 จำนวน 50 ชิ้น
3. ยืนยันการหยิบทั้งสอง → สร้าง reservation แยกกัน
4. โหลด Picklist A → โหลดเฉพาะ 100 ชิ้นที่เป็นของ A
5. โหลด Face Sheet B → โหลดเฉพาะ 50 ชิ้นที่เป็นของ B

### Test Case 5: Legacy Data (Fallback Mode)
1. มี Picklist เก่าที่ picked แล้วแต่ไม่มี staging reservation
2. โหลด Picklist เก่า → ระบบแสดง warning แต่ยังโหลดได้
3. ระบบ log รายการนั้นเพื่อ monitoring

## เกณฑ์ความสำเร็จ

### Functional Requirements
- ✅ ระบบสร้าง staging reservation เมื่อยืนยันหยิบ
- ✅ ระบบตรวจสอบ staging reservation ก่อนโหลด
- ✅ ระบบปล่อย staging reservation หลังโหลด
- ✅ ระบบจัดการข้อมูลเก่าได้ (backward compatible)

### Performance Requirements
- ✅ Pick confirmation ≤ 500ms
- ✅ Loading validation ≤ 1s
- ✅ Backfill script ≤ 5 นาที

### Data Integrity Requirements
- ✅ ไม่มีสต็อคหาย
- ✅ ไม่มี reservation ค้าง
- ✅ Ledger ถูกต้องและสอดคล้องกัน

## ขอบเขตที่ไม่รวม (Out of Scope)

- ❌ การแก้ไข UI หน้า loading (ใช้ UI เดิม)
- ❌ การแก้ไข UI หน้า pick (ใช้ UI เดิม)
- ❌ การเพิ่ม report สำหรับ staging reservations
- ❌ การเพิ่ม manual release reservation feature
- ❌ การเพิ่ม notification เมื่อมี reservation ค้าง

## Dependencies

- Migration 230 ต้องรันก่อน API changes
- Backfill script ต้องรันหลัง Migration 230
- API changes ต้อง deploy พร้อมกัน
- Database indexes ต้องสร้างก่อน deploy API

## ความเสี่ยงและการบรรเทา

### Risk 1: Backfill Script ล้มเหลว
**Mitigation:** 
- ทดสอบใน staging environment ก่อน
- มี rollback script พร้อมใช้งาน
- ใช้ fallback mode ในระหว่างทดสอบ
- แบ่ง backfill เป็น batch เล็กๆ

### Risk 2: Performance Impact
**Mitigation:**
- สร้าง database indexes ที่จำเป็น
- ทดสอบ load test ก่อน deploy
- Monitor query performance อย่างต่อเนื่อง
- ใช้ connection pooling

### Risk 3: ข้อมูลเก่าไม่ครบ
**Mitigation:**
- ใช้ fallback mode เป็นค่าเริ่มต้น
- Log รายการที่ไม่มี reservation
- Monitor และแก้ไขทีละน้อย
- มี manual process สำหรับ edge cases

---

**หมายเหตุ:** เอกสารนี้เป็น requirements document ฉบับสมบูรณ์ที่ใช้รูปแบบ EARS (Easy Approach to Requirements Syntax) โดยใช้ภาษาไทยเป็นหลักแต่คงคีย์เวิร์ด EARS (WHEN, IF, THEN, SHALL, WHERE, WHILE) เป็นภาษาอังกฤษตามมาตรฐาน
