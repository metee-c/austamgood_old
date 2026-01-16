# BLK Physical Count - Stock Adjustment Summary

## ภาพรวม

การนับสต็อกจริงที่โซน Block Stack (AA-BLK และ AB-BLK) จากไฟล์ BLK.xlsx

- **วันที่นับ**: 2026-01-16
- **โลเคชั่นที่นับ**: 59 โลเคชั่น
- **โลเคชั่นที่มีความแตกต่าง**: 15 โลเคชั่น
- **การปรับปรุงทั้งหมด**: 75 รายการ

## สรุปการปรับปรุง

| ประเภท | จำนวน | คำอธิบาย |
|--------|-------|----------|
| เพิ่มสต็อก (ADD) | 33 รายการ | พาเลทที่นับพบแต่ไม่มีในระบบ |
| ปรับจำนวน (ADJUST) | 2 รายการ | พาเลทที่มีจำนวนไม่ตรงกัน |
| ลบสต็อก (REMOVE) | 40 รายการ | พาเลทที่มีในระบบแต่ไม่พบในการนับ |

## โลเคชั่นที่มีความแตกต่าง

### 1. AA-BLK-17
- เพิ่ม: 6 พาเลท (B-NET-C|CNT|010)
- ลบ: 1 พาเลท (B-NET-C|CNT|010)

### 2. AA-BLK-20
- ลบ: 1 พาเลท (B-NET-C|FNC|010) - โลเคชั่นว่าง

### 3. AA-BLK-24
- ลบ: 1 พาเลท (B-NET-C|CNT|040)

### 4. AA-BLK-26
- เพิ่ม: 1 พาเลท (B-NET-C|FHC|010)
- ลบ: 4 พาเลท (B-NET-C|CNT|010)

### 5. AA-BLK-27
- เพิ่ม: 9 พาเลท (B-NET-C|CNT|010)
- ลบ: 6 พาเลท (B-NET-C|CNT|010)

### 6. AA-BLK-28
- ปรับจำนวน: 1 พาเลท (ATG20260112000000078) จาก 272 เป็น 276 ชิ้น (+4)
- ลบ: 3 พาเลท

### 7. AA-BLK-29
- ลบ: 13 พาเลท (B-NET-C|CNT|010, B-NET-C|FNC|040, B-NET-C|SAL|010)

### 8. AA-BLK-30
- เพิ่ม: 8 พาเลท (B-NET-C|SAL|010)

### 9. AB-BLK-20
- เพิ่ม: 7 พาเลท (00-BEY-C|SAL|20)

### 10. AB-BLK-23
- ลบ: 1 พาเลท (00-BEY-C|LAM|20)

### 11. AB-BLK-24
- เพิ่ม: 1 พาเลท (B-NET-C|CNT|040)

### 12. AB-BLK-25
- เพิ่ม: 1 พาเลท (B-NET-C|SAL|040)
- ลบ: 1 พาเลท (B-NET-C|SAL|040)

### 13. AB-BLK-26
- ลบ: 2 พาเลท (B-NET-C|FNC|040, B-NET-C|CNT|010)

### 14. AB-BLK-27
- ปรับจำนวน: 1 พาเลท (ATG20260113000000181) จาก 135 เป็น 160 ชิ้น (+25)
- ลบ: 1 พาเลท (B-NET-C|FHC|040)

### 15. AB-BLK-29
- ลบ: 4 พาเลท (00-BAP-C|WEP|200, 00-BAP-C|HNS|200, 00-BAP-C|IND|200, 00-BAP-C|KNP|200)

## ขั้นตอนการดำเนินการ

### 1. วิเคราะห์ความแตกต่าง ✅
```bash
node scripts/adjust-stock-from-blk-count.js
```
- สร้างไฟล์ `blk-stock-adjustments.json` ที่มีรายการปรับปรุงทั้งหมด

### 2. ตรวจสอบรายการปรับปรุง ✅
- ตรวจสอบไฟล์ `blk-stock-adjustments.json`
- ยืนยันว่าข้อมูลถูกต้อง

### 3. Apply การปรับปรุง ✅ (เสร็จสิ้น 2026-01-16)
- ปรับสต็อกโดยตรงผ่าน Supabase MCP
- สร้าง ledger entries สำหรับการปรับสต็อก
- ลบ balance records ที่ไม่มีของจริง
- เพิ่ม balance records ใหม่ตามการนับจริง

## ผลลัพธ์การปรับปรุง

| โลเคชั่น | พาเลท | จำนวนรวม | SKU |
|----------|-------|----------|-----|
| AA-BLK-17 | 6 | 3,349 | B-NET-C\|CNT\|010 |
| AA-BLK-20 | 0 | - | (ว่าง) |
| AA-BLK-24 | 25 | 1,041 | 00-NET-C\|FHC\|200 |
| AA-BLK-26 | 4 | 2,304 | B-NET-C\|FHC\|010 |
| AA-BLK-27 | 10 | 5,184 | B-NET-C\|CNT\|010, B-NET-C\|SAL\|010 |
| AA-BLK-28 | 8 | 4,308 | B-NET-C\|FNC\|010 |
| AA-BLK-29 | 5 | 2,880 | B-NET-C\|SAL\|010 |
| AA-BLK-30 | 8 | 4,608 | B-NET-C\|SAL\|010 |
| AB-BLK-20 | 7 | 252 | 00-BEY-C\|SAL\|20 |
| AB-BLK-23 | 15 | 523 | 00-NET-D\|CHI-L\|200 |
| AB-BLK-24 | 4 | 579 | B-NET-C\|CNT\|040 |
| AB-BLK-25 | 5 | 640 | B-NET-C\|SAL\|040 |
| AB-BLK-26 | 7 | 1,120 | B-NET-C\|FNC\|040 |
| AB-BLK-27 | 9 | 1,280 | B-NET-C\|FHC\|040 |
| AB-BLK-29 | 29 | 360 | หลาย SKU |

## หมายเหตุ

- การปรับปรุงทำโดยตรงผ่าน Supabase MCP เมื่อ 2026-01-16
- สร้าง ledger entries ด้วย transaction_type = 'STOCK_COUNT_ADJ' และ reference_no = 'BLK-COUNT-20260116'
- ลบ reservations ที่เกี่ยวข้องกับ balance records ที่ถูกลบ (status = 'picked')
- สามารถตรวจสอบผลลัพธ์ได้ที่:
  - Inventory Balances: http://localhost:3000/warehouse/inventory-balances
  - Inventory Ledger: http://localhost:3000/warehouse/inventory-ledger

## ไฟล์ที่เกี่ยวข้อง

- `BLK.xlsx` - ไฟล์การนับสต็อกจริง
- `blk-stock-adjustments.json` - รายการปรับปรุงที่วิเคราะห์แล้ว
- `scripts/adjust-stock-from-blk-count.js` - Script วิเคราะห์
- `scripts/apply-blk-stock-adjustments.js` - Script apply การปรับปรุง
