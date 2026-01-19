# แผนการพัฒนา: ระบบตรวจสอบเอกสารก่อนโหลด (Document Verification for Loading)

## ภาพรวม

แผนการพัฒนานี้แบ่งการทำงานออกเป็น 3 phases หลัก:
1. **Database Migration + Functions**: สร้าง schema และ functions
2. **API Implementation**: แก้ไข APIs สำหรับ pick confirmation และ loading
3. **Backfill + Deployment**: สร้าง staging reservations สำหรับข้อมูลเก่าและ deploy

## Tasks

- [-] 1. Database Schema และ Functions
  - สร้าง migration และ database functions สำหรับ staging reservation system
  - _Requirements: 1.1-1.10, 4.1-4.5, 6.1-6.10_

- [x] 1.1 สร้าง Migration 230: เพิ่ม Staging Reservation Columns
  - เพิ่ม `staging_location_id` และ `loaded_at` columns ใน reservation tables
  - สร้าง indexes สำหรับ performance optimization
  - _Requirements: 4.1, 5.4_

- [x] 1.2 สร้าง Database Function: create_staging_reservation_after_pick()
  - รับ parameters: document_type, document_item_id, sku_id, quantity, staging_location_id, balance_id
  - Insert staging reservation record
  - Update inventory_balances.reserved_piece_qty
  - Return success/error result
  - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9_

- [x] 1.3 สร้าง Database Function: validate_staging_reservations()
  - รับ parameters: document_type, document_ids, staging_location_id
  - Query reservations ที่ status = 'picked'
  - ตรวจสอบว่าทุก item มี reservation และ quantity เพียงพอ
  - Return validation result พร้อม missing items
  - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 1.4 สร้าง Database Function: release_staging_reservations_after_load()
  - รับ parameters: document_type, document_ids, staging_location_id
  - Update reservations: status = 'loaded', loaded_at = NOW()
  - Update inventory_balances: ลด reserved_piece_qty
  - Return จำนวน reservations ที่ปล่อย
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 1.5 เขียน property test สำหรับ Database Functions
  - **Property 3: Staging Reservation Creation Completeness**
  - **Property 18: Referential Integrity**
  - **Property 19: Non-Negative Reserved Quantity**
  - **Validates: Requirements 1.5-1.9, 6.1-6.3**

- [ ] 1.6 สร้าง Test Script สำหรับทดสอบ Database Functions
  - ทดสอบ create_staging_reservation_after_pick()
  - ทดสอบ validate_staging_reservations()
  - ทดสอบ release_staging_reservations_after_load()
  - ทดสอบ error cases และ edge cases

- [ ] 2. Checkpoint - ทดสอบ Database Functions
  - ตรวจสอบว่า functions ทำงานถูกต้อง
  - ทดสอบ edge cases และ error handling
  - ถามผู้ใช้หากมีคำถาม

- [ ] 3. Pick Confirmation API Changes
  - แก้ไข APIs สำหรับ Picklist, Face Sheet และ Bonus Face Sheet
  - _Requirements: 1.1-1.10_

- [ ] 3.1 แก้ไข Picklist Pick Confirmation API
  - File: `app/api/picklists/[id]/items/confirm/route.ts`
  - หลังปล่อย reservation จาก Bulk/Rack: เรียก create_staging_reservation_after_pick()
  - กำหนด staging_location_id = Dispatch location
  - Handle errors และ rollback ถ้าจำเป็น
  - _Requirements: 1.1, 1.4, 1.5, 1.10_

- [ ] 3.2 แก้ไข Face Sheet Pick Confirmation API
  - File: `app/api/face-sheets/[id]/items/confirm/route.ts`
  - หลังปล่อย reservation จาก Bulk/Rack: เรียก create_staging_reservation_after_pick()
  - กำหนด staging_location_id = Dispatch location
  - Handle errors และ rollback ถ้าจำเป็น
  - _Requirements: 1.2, 1.4, 1.5, 1.10_

- [ ] 3.3 แก้ไข Bonus Face Sheet Pick Confirmation API
  - File: `app/api/bonus-face-sheets/[id]/items/confirm/route.ts`
  - หลังปล่อย reservation จาก Prep Area: เรียก create_staging_reservation_after_pick()
  - กำหนด staging_location_id = PQTD, MRTD หรือ Prep Area ตามที่เหมาะสม
  - Handle errors และ rollback ถ้าจำเป็น
  - _Requirements: 1.3, 1.4, 1.5, 1.10_

- [ ] 3.4 เขียน property test สำหรับ Pick Confirmation
  - **Property 1: Release Bulk/Rack Reservation on Pick**
  - **Property 2: Stock Movement to Staging**
  - **Property 4: Pick Confirmation Atomicity**
  - **Validates: Requirements 1.1-1.4, 1.10**

- [ ] 3.5 เขียน unit tests สำหรับ Pick Confirmation Edge Cases
  - ทดสอบ concurrent pick confirmations
  - ทดสอบ invalid balance_id
  - ทดสอบ invalid staging_location_id
  - ทดสอบ transaction rollback

- [ ] 4. Checkpoint - ทดสอบ Pick Confirmation APIs
  - ตรวจสอบว่า staging reservations ถูกสร้างถูกต้อง
  - ทดสอบ error handling และ rollback
  - ถามผู้ใช้หากมีคำถาม

- [ ] 5. Loading Validation และ Complete API Changes
  - แก้ไข Loading API เพื่อตรวจสอบและปล่อย staging reservations
  - _Requirements: 2.1-2.10, 3.1-3.10_

- [ ] 5.1 เพิ่ม Validation Logic ใน Loading API
  - File: `app/api/mobile/loading/complete/route.ts`
  - เพิ่ม mode parameter ('strict' หรือ 'fallback')
  - ก่อนโหลด: เรียก validate_staging_reservations()
  - Handle strict mode: reject ถ้าไม่มี reservation
  - Handle fallback mode: warning + log ถ้าไม่มี reservation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9_

- [ ] 5.2 เพิ่ม Bonus Face Sheet Multi-Location Check
  - ตรวจสอบ staging reservations จาก PQTD, MRTD, Prep Area และ Dispatch
  - รวม reserved quantities จากทุก locations
  - _Requirements: 2.10_

- [ ] 5.3 เพิ่ม Release Logic หลัง Loading
  - หลังโหลดสำเร็จ: เรียก release_staging_reservations_after_load()
  - ย้ายสต็อคจาก Dispatch/Staging ไป Delivery-In-Progress
  - บันทึก inventory ledger (OUT จาก staging, IN ไป Delivery-In-Progress)
  - อัปเดต loadlist status และ timestamps
  - _Requirements: 3.1-3.8_

- [ ] 5.4 เพิ่ม Transaction และ Error Handling
  - ใช้ database transaction สำหรับ atomicity
  - Rollback ถ้า release ล้มเหลว
  - Return success response พร้อม loadlist_code
  - _Requirements: 3.9, 3.10, 6.4, 6.5_

- [ ] 5.5 เขียน property test สำหรับ Loading Validation
  - **Property 5: Staging Reservation Validation Before Loading**
  - **Property 6: Strict Mode Enforcement**
  - **Property 7: Fallback Mode Behavior**
  - **Property 8: Insufficient Stock Detection**
  - **Property 9: Successful Loading Validation**
  - **Property 10: Bonus Face Sheet Multi-Location Check**
  - **Validates: Requirements 2.1-2.10**

- [ ] 5.6 เขียน property test สำหรับ Loading Complete
  - **Property 11: Staging Reservation Release on Load**
  - **Property 12: Inventory Balance Update on Release**
  - **Property 13: Stock Movement to Delivery**
  - **Property 14: Ledger Recording Completeness**
  - **Property 15: Loading Atomicity**
  - **Property 16: Loading Success Response**
  - **Validates: Requirements 3.1-3.10**

- [ ] 5.7 เขียน unit tests สำหรับ Loading Edge Cases
  - ทดสอบ wrong document (load A with reservation B)
  - ทดสอบ stock already used
  - ทดสอบ multiple documents same SKU
  - ทดสอบ concurrent loading operations
  - ทดสอบ transaction rollback scenarios

- [ ] 6. Checkpoint - ทดสอบ Loading APIs
  - ตรวจสอบว่า validation ทำงานถูกต้อง
  - ตรวจสอบว่า release และ stock movement ถูกต้อง
  - ทดสอบทั้ง strict mode และ fallback mode
  - ถามผู้ใช้หากมีคำถาม

- [ ] 7. Backfill Script สำหรับข้อมูลเก่า
  - สร้าง staging reservations สำหรับรายการที่ picked แล้วแต่ยังไม่ loaded
  - _Requirements: 4.2-4.8_

- [ ] 7.1 สร้าง Backfill Script
  - File: `scripts/backfill-staging-reservations.js`
  - Query ทุกรายการที่ status = 'picked' แต่ไม่มี staging reservation
  - สร้าง staging reservation สำหรับแต่ละรายการ
  - Link กับ inventory_balance ที่ถูกต้อง
  - กำหนด staging_location_id จาก Dispatch, PQTD, MRTD หรือ Prep Area
  - ทำงานแบบ batch เพื่อลด database load
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.7_

- [ ] 7.2 เพิ่ม Progress Monitoring
  - แสดง progress bar ระหว่าง backfill
  - Log จำนวนรายการที่ backfill สำเร็จ
  - Log errors และ failed items
  - _Requirements: 4.8_

- [ ] 7.3 เพิ่ม Validation หลัง Backfill
  - ตรวจสอบว่าทุกรายการมี staging reservation แล้ว
  - ตรวจสอบ referential integrity
  - ตรวจสอบ reserved quantities ถูกต้อง
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 7.4 เขียน property test สำหรับ Backfill Script
  - **Property 17: Backfill Reservation Creation**
  - **Validates: Requirements 4.2-4.5**

- [ ] 7.5 เขียน unit tests สำหรับ Backfill Edge Cases
  - ทดสอบ empty result set
  - ทดสอบ invalid balance references
  - ทดสอบ missing staging locations
  - ทดสอบ batch processing

- [ ] 8. Checkpoint - ทดสอบ Backfill Script
  - รัน backfill script ใน staging environment
  - ตรวจสอบว่าข้อมูลเก่าถูก backfill ครบถ้วน
  - ตรวจสอบ performance (ต้องเสร็จภายใน 5 นาที)
  - ถามผู้ใช้หากมีคำถาม

- [ ] 9. Monitoring และ Logging
  - เพิ่ม monitoring queries และ logging สำหรับ fallback mode
  - _Requirements: 2.9, 4.7, 4.8_

- [ ] 9.1 สร้าง Fallback Logging Table
  - สร้าง table: `loading_fallback_logs`
  - Columns: document_type, document_ids, missing_items, timestamp
  - Index: timestamp สำหรับ query performance
  - _Requirements: 4.7_

- [ ] 9.2 เพิ่ม Logging Logic ใน Loading API
  - Log รายการที่โหลดโดยไม่มี reservation (fallback mode)
  - ใช้ async logging เพื่อไม่กระทบ response time
  - _Requirements: 2.9, 4.7, 5.8_

- [ ] 9.3 สร้าง Monitoring Queries
  - Query: นับจำนวนรายการที่ยังไม่มี staging reservation
  - Query: นับจำนวน fallback loads ใน 24 ชั่วโมงที่ผ่านมา
  - Query: ตรวจสอบ referential integrity violations
  - Query: ตรวจสอบ negative reserved quantities
  - _Requirements: 4.8, 6.1-6.3_

- [ ] 9.4 เขียน unit tests สำหรับ Monitoring Queries
  - ทดสอบ query correctness
  - ทดสอบ query performance
  - ทดสอบ edge cases (empty results, large datasets)

- [ ] 10. Integration Testing
  - ทดสอบ end-to-end flow และ concurrent operations
  - _Requirements: ทุก requirements_

- [ ] 10.1 สร้าง End-to-End Test Suite
  - Test: Normal flow (Pick → Validate → Load)
  - Test: Wrong document (Load A with reservation B)
  - Test: Stock already used
  - Test: Multiple documents same SKU
  - Test: Legacy data (Fallback mode)
  - _Requirements: ทุก requirements_

- [ ] 10.2 สร้าง Concurrent Operations Test
  - Test: Concurrent pick confirmations
  - Test: Concurrent loading operations
  - Test: Race conditions และ deadlocks
  - _Requirements: 5.6, 6.4_

- [ ] 10.3 เขียน property test สำหรับ Data Integrity
  - **Property 20: Transaction Atomicity**
  - **Property 21: Ledger-Reservation Consistency**
  - **Property 22: Reservation Deletion Guard**
  - **Property 23: Unique Staging Reservation**
  - **Property 24: Referential Integrity Maintenance**
  - **Validates: Requirements 6.4-6.10**

- [ ] 11. Checkpoint - Integration Testing
  - รัน integration tests ทั้งหมด
  - ตรวจสอบว่าทุก test ผ่าน
  - แก้ไขปัญหาที่พบ
  - ถามผู้ใช้หากมีคำถาม

- [ ] 12. Performance Testing
  - ทดสอบ performance และ optimize ถ้าจำเป็น
  - _Requirements: 5.1-5.10_

- [ ] 12.1 สร้าง Performance Test Suite
  - Test: Pick confirmation response time (target: ≤ 500ms)
  - Test: Loading validation response time (target: ≤ 1s)
  - Test: Backfill script execution time (target: ≤ 5 นาที)
  - Test: Concurrent operations performance
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 12.2 Optimize Database Queries
  - ตรวจสอบ query execution plans
  - เพิ่ม indexes ถ้าจำเป็น
  - Optimize database functions
  - _Requirements: 5.4, 5.5_

- [ ] 12.3 Load Testing
  - ทดสอบ high load scenarios
  - ตรวจสอบ response time ภายใต้ load
  - ตรวจสอบ memory usage
  - _Requirements: 5.9, 5.10_

- [ ] 13. Checkpoint - Performance Testing
  - ตรวจสอบว่า performance ตรงตาม requirements
  - Optimize ถ้าจำเป็น
  - ถามผู้ใช้หากมีคำถาม

- [ ] 14. Documentation
  - สร้าง documentation สำหรับ users, developers และ operations

- [ ] 14.1 สร้าง User Documentation
  - Pick Confirmation Guide
  - Loading Guide
  - Troubleshooting Guide

- [ ] 14.2 สร้าง Developer Documentation
  - API Documentation
  - Database Schema Documentation
  - Function Documentation
  - Testing Guide

- [ ] 14.3 สร้าง Operations Documentation
  - Deployment Guide (3 phases)
  - Monitoring Guide
  - Rollback Guide
  - Troubleshooting Guide

- [ ] 15. Deployment Preparation
  - เตรียมความพร้อมสำหรับ deployment แต่ละ phase

- [ ] 15.1 เตรียม Phase 1: Migration + Backfill
  - ทดสอบ migration ใน staging environment
  - ทดสอบ backfill script ใน staging environment
  - เตรียม rollback script
  - สร้าง deployment checklist

- [ ] 15.2 เตรียม Phase 2: Fallback Mode
  - ตั้งค่า fallback mode เป็นค่าเริ่มต้น
  - เตรียม monitoring queries
  - เตรียม alert configuration
  - สร้าง deployment checklist

- [ ] 15.3 เตรียม Phase 3: Strict Mode
  - เตรียม criteria สำหรับเปลี่ยนเป็น strict mode
  - เตรียม communication plan สำหรับ stakeholders
  - เตรียม rollback plan
  - สร้าง deployment checklist

- [ ] 16. Final Checkpoint - Deployment Ready
  - ตรวจสอบว่าทุกอย่างพร้อมสำหรับ deployment
  - Review documentation ทั้งหมด
  - Review test results ทั้งหมด
  - ถามผู้ใช้หากมีคำถาม

## หมายเหตุ

- แต่ละ checkpoint ควรหยุดและให้ผู้ใช้ review ก่อนดำเนินการต่อ
- Property tests ควรรัน 100 iterations ต่อ property
- Unit tests ควรครอบคลุม edge cases และ error conditions
- Integration tests ควรทดสอบ end-to-end flows และ concurrent operations
- ทุก test tasks เป็น required เพื่อความครอบคลุมและถูกต้อง

## Deployment Timeline

- **สัปดาห์ที่ 1**: Tasks 1-8 (Database + APIs + Backfill)
- **สัปดาห์ที่ 1-2**: Tasks 9-13 (Monitoring + Testing + Performance)
- **สัปดาห์ที่ 2**: Tasks 14-15 (Documentation + Deployment Prep)
- **สัปดาห์ที่ 2**: Phase 1 Deployment (Migration + Backfill)
- **สัปดาห์ที่ 2-3**: Phase 2 Deployment (Fallback Mode)
- **สัปดาห์ที่ 3+**: Phase 3 Deployment (Strict Mode)
