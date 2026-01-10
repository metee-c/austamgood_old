# Stock Flow Audit Report - 10 January 2026

## Executive Summary

การตรวจสอบความถูกต้องของข้อมูลสต็อกในระบบ WMS พบว่า:

✅ **Ledger และ Balance ตรงกัน 100%** - ไม่มี discrepancy ระหว่าง ledger transactions และ balance records

⚠️ **พบ Negative Balances** - มี 78 records ที่มียอดติดลบ รวม -10,707.77 units

## Stock Summary

| Metric | Value |
|--------|-------|
| Total SKUs | 262 |
| Total Stock (pack_qty) | 108,009.51 |
| Total Reserved | 653.67 |
| Total Available | 107,355.84 |
| Balance Records | 1,746 |

## Transaction Types Summary

| Transaction Type | Direction | Count | Total Qty |
|-----------------|-----------|-------|-----------|
| import | in | 3,197 | 98,261.58 |
| receive | in | 117 | 4,882.00 |
| pick | in | 1,895 | 11,473.73 |
| pick | out | 1,928 | 11,093.08 |
| ship | in | 1,022 | 10,310.73 |
| ship | out | 1,022 | 10,310.73 |
| transfer | in | 398 | 19,748.42 |
| transfer | out | 398 | 19,748.42 |
| adjust | in | 53 | 7,769.34 |
| adjust | out | 9 | 1,316.00 |
| adjustment | in | 143 | 1,844.08 |
| adjustment | out | 46 | 1,269.65 |
| sync_adjustment | in | 117 | 2,056.18 |
| sync_adjustment | out | 103 | 4,631.67 |

## Order Status Distribution

| Status | Count |
|--------|-------|
| draft | 42 |
| confirmed | 2 |
| picked | 57 |
| loaded | 438 |

**Note:** ไม่มี orders ที่ status = 'delivered' - ทุก orders ยังอยู่ในขั้นตอน loaded หรือก่อนหน้า

## Negative Balance Analysis

### By Location (Top 10)

| Location | Negative Records | Total Negative Qty |
|----------|-----------------|-------------------|
| Packaging | 2 | -9,150.00 |
| PK001 | 21 | -573.50 |
| PK002 | 6 | -456.82 |
| Dispatch | 20 | -97.03 |
| A09-01-011 | 1 | -60.40 |
| A09-01-003 | 2 | -55.20 |
| A09-01-009 | 1 | -50.00 |
| A09-01-006 | 2 | -41.00 |
| A09-01-012 | 1 | -40.60 |
| MR01 | 4 | -40.45 |

### Root Cause Analysis

1. **Packaging Location (-9,150)**: มี 2 SKUs ที่ติดลบมาก
   - `01-NET-C|FHC|010`: -4,575 (Production consumption)
   - `OTHERS00069`: -4,575 (Production consumption)

2. **PK001/PK002 (Prep Areas)**: สินค้าถูก pick ออกไปมากกว่าที่รับเข้ามา - อาจเป็นเพราะ:
   - สินค้าถูกย้ายจาก location อื่นมาแต่ไม่ได้บันทึก transfer in
   - การ pick สินค้าโดยไม่ได้ตรวจสอบ available qty

3. **Dispatch Location**: สินค้าถูก ship ออกไปแต่ยังไม่ได้ clear balance

4. **Tester SKUs (TT-*)**: ส่วนใหญ่ติดลบเพราะ sync_adjustment ที่ปรับลดสต็อก

## Integrity Check Results

### Ledger vs Balance Reconciliation
- **Result:** ✅ PASS
- **Discrepancy:** 0 (ทุก SKU ตรงกัน)

### Reservation Integrity
- **Total Reservations:** 45 records
- **Total Reserved Qty:** 653.67
- **Over-reserved:** มีบาง records ที่ reserved > available (เพราะ balance ติดลบ)

## Recommendations

### Immediate Actions

1. **ตรวจสอบ Packaging Location**
   - SKU `01-NET-C|FHC|010` และ `OTHERS00069` ติดลบ -4,575 แต่ละตัว
   - ควรตรวจสอบว่าเป็น production consumption ที่ถูกต้องหรือไม่

2. **ตรวจสอบ Prep Areas (PK001, PK002)**
   - มีหลาย SKU ที่ติดลบ
   - ควรทำ physical count และ adjust ให้ตรง

3. **Clear Dispatch Balance**
   - สินค้าที่ ship ออกไปแล้วควร clear balance ใน Dispatch location

### Long-term Improvements

1. **Implement Stock Validation**
   - ป้องกันการ pick/ship เกินกว่า available qty
   - เพิ่ม validation ก่อนทำ transaction

2. **Regular Reconciliation**
   - ทำ stock count ประจำสัปดาห์/เดือน
   - เปรียบเทียบ physical vs system

3. **Audit Trail Enhancement**
   - บันทึก user ที่ทำ transaction ทุกครั้ง
   - เพิ่ม reason สำหรับ adjustments

## Conclusion

ระบบ WMS มีความถูกต้องในแง่ของ **Ledger-Balance Consistency** (100% match) แต่มีปัญหา **Negative Balances** ที่ต้องแก้ไข โดยเฉพาะใน Packaging และ Prep Areas

ควรทำ physical stock count และ adjustment เพื่อให้ข้อมูลในระบบตรงกับความเป็นจริง

---
*Generated: 2026-01-10*
*Audit Tool: Supabase MCP*
