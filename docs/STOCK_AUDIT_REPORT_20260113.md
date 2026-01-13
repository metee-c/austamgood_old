# 📊 รายงานตรวจสอบความถูกต้องของข้อมูลสต็อก WMS
**วันที่ตรวจสอบ:** 13 มกราคม 2569  
**ไฟล์ข้อมูล:** ตรวจสอบสต็อกระบบใหม่.xlsm

---

## 🔴 SECTION 1: Executive Summary

### ผลการตรวจสอบ: ❌ ไม่ผ่าน
### ระดับความเสี่ยง: 🔴 CRITICAL

| ประเภทปัญหา | จำนวน | ระดับ |
|------------|-------|-------|
| สต็อกติดลบ | 187 รายการ | 🔴 Critical |
| พาเลทอยู่หลาย Location | 2 รายการ | 🟠 High |
| สต็อกศูนย์แต่มีการจอง | 2 รายการ | 🟡 Medium |
| Ledger vs Balance ไม่ตรง | 130 SKUs | 🟡 Medium |
| สินค้าหมดอายุในบ้านหยิบ | 61 รายการ | 🟢 Info |

### ปริมาณข้อมูลที่ตรวจสอบ
- ประวัติเคลื่อนไหว: 13,128 รายการ
- ยอดสต็อกคงเหลือ: 3,350 รายการ
- บ้านหยิบ: 339 รายการ
- บ้านหยิบพรีเมี่ยม: 75 รายการ
- จัดสินค้าเสร็จ: 80 รายการ
- โหลดสินค้าเสร็จ: 2,900 รายการ
- Orders: 3,204 รายการ

---

## 🔍 SECTION 2: Issue List (เรียงจากร้ายแรงสุด)

### 🔴 CRITICAL-001: สต็อกติดลบจำนวนมาก (187 รายการ)

**ประเภทปัญหา:** Data Integrity - Negative Stock  
**ชีทที่พบ:** ยอดสต็อกคงเหลือ, บ้านหยิบ, บ้านหยิบพรีเมี่ยม

**รายละเอียด:**
พบสต็อกติดลบใน 3 ชีท:
- **ยอดสต็อกคงเหลือ:** 4 รายการ
- **บ้านหยิบ:** 181 รายการ  
- **บ้านหยิบพรีเมี่ยม:** 6 รายการ

**ตัวอย่างที่ร้ายแรงที่สุด (บ้านหยิบ):**

| SKU | ชื่อสินค้า | Location | แพ็ค | ชิ้น |
|-----|-----------|----------|------|------|
| B-NET-C|SAL|010 | Buzz Netura แมวโตและลูก แซลมอน 1 กก. | PK001 | -292.08 | -3,483 |
| B-NET-C|CNT|010 | Buzz Netura แมวเลี้ยงในบ้าน ปลาค็อด 1 กก. | PK001 | -265.59 | -2,285 |
| B-BEY-C|TUN|070 | Buzz Beyond แมวโต รสทูน่า 7 กก. | PK001 | -223 | -223 |
| B-NET-C|FHC|010 | Buzz Netura แมวโตและลูก ปลาเนื้อขาว 1 กก. | PK001 | -116.49 | -1,398 |
| B-BAP-C|WEP|010 | Buzz Balanced+ แมวโต Weight+ 1 กก. | PK001 | -114.5 | -408 |
| B-BEY-C|MNB|070 | Buzz Beyond แม่และลูกแมว 7 กก. | PK001 | -113 | -113 |
| B-BEY-C|MNB|NS|010 | Buzz Beyond แม่และลูกแมว 1 กก. [No Sticker] | A09-01-003 | -105 | -1,260 |

**ผลกระทบทางธุรกิจ:**
- ❌ ไม่สามารถเชื่อถือยอดสต็อกได้
- ❌ การหยิบสินค้าอาจผิดพลาด (หยิบเกินจริง)
- ❌ รายงานสต็อกไม่ถูกต้อง
- ❌ อาจเกิดปัญหาการจัดส่งสินค้าไม่ครบ

---

### 🔴 CRITICAL-002: Ledger vs Balance ไม่ตรงกัน (130 SKUs)

**ประเภทปัญหา:** Cross-Sheet Reconciliation Failure  
**ชีทที่พบ:** ประวัติเคลื่อนไหว vs ยอดสต็อกคงเหลือ

**รายละเอียด:**
ยอดสุทธิจาก Ledger (เข้า - ออก) ไม่ตรงกับยอดใน Balance

**Top 10 SKUs ที่มีความแตกต่างมากที่สุด:**

| SKU | Ledger Net | Balance | ส่วนต่าง |
|-----|------------|---------|----------|
| B-NET-C|FNC|010 | 19,015 | 5,229 | +13,786 |
| B-BEY-C|MNB|010 | 47,173 | 36,865 | +10,308 |
| TT-NET-C|SAL|0005 | 8,577.5 | 625 | +7,952.5 |
| B-BEY-C|SAL|010 | 21,958 | 14,506 | +7,452 |
| B-NET-C|CNT|010 | 12,690 | 5,889 | +6,801 |
| MKT-CARTON-TESTER | 6,548 | 0 | +6,548 |
| B-NET-C|SAL|010 | 10,748 | 4,237 | +6,511 |
| B-BEY-C|MCK|010 | 9,364 | 3,771 | +5,593 |
| TT-BEY-C|MNB|0005 | 5,657.9 | 120 | +5,537.9 |
| B-BEY-C|TUN|010 | 13,149 | 7,759 | +5,390 |

**ผลกระทบทางธุรกิจ:**
- ❌ ไม่สามารถ Audit Trail ได้
- ❌ ยอดสต็อกจริงไม่ทราบแน่ชัด
- ❌ อาจมีการเคลื่อนไหวที่ไม่ถูกบันทึก

---

### 🟠 HIGH-001: พาเลทอยู่หลาย Location พร้อมกัน (2 รายการ)

**ประเภทปัญหา:** Pallet Integrity Violation  
**ชีทที่พบ:** ยอดสต็อกคงเหลือ

**รายละเอียด:**

**1. Pallet: ATG2500014777**
- Location 1: Repack (19 pcs)
- Location 2: AA-BLK-22 (46 pcs)
- SKU: 00-NET-C|FHC|200

**2. Pallet: PK202601050001**
- Location 1: พื้นที่แพ็คสินค้า (หลาย SKU)
- Location 2: Repack (4,575 pcs)
- มี 90+ SKUs ใน Pallet เดียวกัน (ผิดปกติมาก)

**ผลกระทบทางธุรกิจ:**
- ❌ ไม่สามารถติดตามพาเลทได้
- ❌ การย้ายสินค้าอาจผิดพลาด
- ❌ Pallet PK202601050001 ดูเหมือนเป็น "Virtual Pallet" ที่ใช้รวมสต็อกหลายรายการ

---

### 🟡 MEDIUM-001: สินค้าหมดอายุในบ้านหยิบ (61 รายการ)

**ประเภทปัญหา:** Expired Stock in Active Location  
**ชีทที่พบ:** บ้านหยิบ

**รายละเอียด:**
พบสินค้าที่หมดอายุแล้ว (วันหมดอายุ: 4/1/2569) ยังคงอยู่ในบ้านหยิบ

**ตัวอย่าง:**

| SKU | ชื่อสินค้า | Location | จำนวน (ชิ้น) |
|-----|-----------|----------|-------------|
| TT-BEY-C|MNB|0005 | Tester Buzz Beyond แม่และลูกแมว | A09-01-023 | 5,637.9 |
| TT-NET-D|CHI-S|0005 | Tester Buzz Netura สุนัขโต ไก่ | A09-01-004 | 5,483.9 |
| TT-BAP-C|IND|0005 | Tester Buzz Balanced+ Indoor | A09-01-011 | 5,424.8 |
| TT-BEY-C|SAL|0005 | Tester Buzz Beyond แมวโต แซลมอน | A09-01-021 | 3,919.85 |
| TT-BEY-D|SAL|0005 | Tester Buzz Beyond สุนัขโต แซลมอน | A09-01-016 | 3,697.95 |

**หมายเหตุ:** ส่วนใหญ่เป็น Tester (ตัวอย่างสินค้า) ซึ่งอาจมีนโยบายการจัดการแตกต่างจากสินค้าปกติ

**ผลกระทบทางธุรกิจ:**
- ⚠️ อาจส่งสินค้าหมดอายุให้ลูกค้า
- ⚠️ ต้องมีกระบวนการ FEFO (First Expired First Out)

---

### 🟡 MEDIUM-002: สต็อกศูนย์แต่มีการจอง (2 รายการ)

**ประเภทปัญหา:** Reservation on Zero Stock  
**ชีทที่พบ:** ยอดสต็อกคงเหลือ

**รายละเอียด:**

| ID | SKU | Location | สต็อก | จอง |
|----|-----|----------|-------|-----|
| 25285 | B-BAP-C|IND|010 | B02-04-001 | 0 pcs | 1.84 pack |
| 28359 | B-BEY-C|LAM|010 | Repair | 0 pcs | 0.16 pack |

**ผลกระทบทางธุรกิจ:**
- ⚠️ การจองไม่สามารถ fulfill ได้
- ⚠️ อาจทำให้ออเดอร์ค้าง

---

## 🧠 SECTION 3: Root Cause Analysis

### 3.1 ปัญหาเชิงระบบ (System Issues)

| ปัญหา | สาเหตุที่เป็นไปได้ | หลักฐาน |
|-------|-------------------|---------|
| สต็อกติดลบ | ไม่มี Validation ป้องกันการหักสต็อกเกินยอดคงเหลือ | พบ -3,483 ชิ้นใน PK001 |
| Ledger ไม่ตรง Balance | Trigger sync ทำงานไม่สมบูรณ์ หรือมีการแก้ไขข้อมูลโดยตรง | 130 SKUs มีส่วนต่าง |
| พาเลทหลาย Location | ไม่มี Constraint ป้องกัน 1 Pallet = 1 Location | ATG2500014777 อยู่ 2 ที่ |

### 3.2 ปัญหาเชิงกระบวนการ (Process Issues)

| ปัญหา | สาเหตุที่เป็นไปได้ |
|-------|-------------------|
| สินค้าหมดอายุในบ้านหยิบ | ไม่มีกระบวนการตรวจสอบ Expiry Date ก่อนย้ายเข้าบ้านหยิบ |
| สต็อกติดลบใน Tester | การหยิบ Tester ไม่ได้ตรวจสอบยอดคงเหลือ |
| Virtual Pallet (PK202601050001) | ใช้ Pallet ID เดียวกันสำหรับหลาย SKU ในพื้นที่แพ็ค |

### 3.3 ปัญหาเชิงข้อมูล (Data Issues)

| ปัญหา | รายละเอียด |
|-------|-----------|
| ค่าทศนิยมในแพ็ค | พบ -292.08 pack, -0.17 pack ซึ่งไม่ควรเกิดขึ้น |
| ชิ้นไม่สัมพันธ์กับแพ็ค | บางรายการมี Pack ติดลบแต่ Piece เป็นบวก |
| ข้อมูลนำเข้าเก่า | มี movement type "นำเข้าข้อมูล" 3,197 รายการ อาจมีข้อมูลผิดพลาดจากการ migrate |

---

## 🛠 SECTION 4: แนวทางแก้ไข (เชิงระบบ WMS)

### 4.1 Logic ที่ควรมี

#### ป้องกันสต็อกติดลบ
```
BEFORE UPDATE/INSERT on wms_inventory_balances:
  IF new.total_piece_qty < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative'
  END IF
```

#### ป้องกันพาเลทหลาย Location
```
CONSTRAINT unique_pallet_location:
  1 pallet_id can only exist in 1 location_id 
  (where total_piece_qty > 0)
```

#### Auto-sync Ledger to Balance
```
AFTER INSERT on wms_inventory_ledger:
  Recalculate balance for affected pallet/sku/location
  Verify sum(ledger) = balance
```

### 4.2 Validation ที่ขาด

| Validation | ควรเพิ่มที่ |
|------------|-----------|
| Check stock >= requested qty before pick | API: /api/mobile/pick/scan |
| Check expiry date before move to pick house | API: /api/moves/quick-move |
| Prevent same-location transfer | ✅ เพิ่มแล้ว |
| Validate pallet uniqueness per location | Trigger on wms_inventory_balances |

### 4.3 Control ที่ควรเพิ่ม

1. **Daily Stock Reconciliation Job**
   - เปรียบเทียบ Ledger sum vs Balance ทุกวัน
   - Alert ถ้าพบความแตกต่าง

2. **Expiry Alert System**
   - แจ้งเตือนสินค้าใกล้หมดอายุ 30/60/90 วัน
   - ห้ามย้ายสินค้าหมดอายุเข้าบ้านหยิบ

3. **Negative Stock Alert**
   - Real-time alert เมื่อพบสต็อกติดลบ
   - Auto-lock location ที่มีปัญหา

4. **Audit Log Enhancement**
   - บันทึกทุกการแก้ไขข้อมูลสต็อก
   - Track user และ timestamp

---

## 📋 สรุปและข้อเสนอแนะ

### ความเร่งด่วนในการแก้ไข

| ลำดับ | ปัญหา | ความเร่งด่วน | แนวทาง |
|-------|-------|-------------|--------|
| 1 | สต็อกติดลบ 187 รายการ | 🔴 ทันที | Stock Adjustment + เพิ่ม Validation |
| 2 | Ledger vs Balance ไม่ตรง | 🔴 ทันที | Reconciliation + Fix Trigger |
| 3 | พาเลทหลาย Location | 🟠 ภายใน 3 วัน | Data Cleanup + Add Constraint |
| 4 | สินค้าหมดอายุ | 🟡 ภายใน 7 วัน | Review Policy + Add Alert |

### ข้อเสนอแนะเพิ่มเติม

1. **ทำ Physical Stock Count** - นับสต็อกจริงเทียบกับระบบ โดยเฉพาะ SKU ที่มีปัญหา
2. **Review Import Data** - ตรวจสอบข้อมูลที่ "นำเข้าข้อมูล" 3,197 รายการ
3. **Training** - อบรมพนักงานเรื่องการใช้ระบบอย่างถูกต้อง
4. **Implement FEFO** - บังคับใช้ First Expired First Out

---

**จัดทำโดย:** Kiro AI Stock Auditor  
**วันที่:** 13 มกราคม 2569
