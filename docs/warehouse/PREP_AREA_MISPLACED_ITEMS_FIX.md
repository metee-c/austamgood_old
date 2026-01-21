# Preparation Area Inventory - Misplaced Items Display

## Summary

เพิ่มการแสดงสินค้าที่อยู่ผิดตำแหน่งในหน้า Preparation Area Inventory โดยแสดงในแถวย่อย (expandable rows)

## Problem

ผู้ใช้รายงานว่าในหน้า `http://localhost:3000/warehouse/preparation-area-inventory` มีสินค้าที่อยู่ผิดบ้านหยิบมากกว่า 14 รายการที่แสดงในหน้า Misplaced Inventory Report

## Investigation Results

จากการตรวจสอบพบว่า:
- **หน้า Misplaced Inventory Report**: แสดง 14 รายการ (นับแบบ aggregated by SKU)
- **หน้า Preparation Area Inventory**: มีสินค้าผิดตำแหน่ง **114 รายการ** ในแถวย่อย (sub-items)
  - **52 SKUs** มีสินค้าอยู่ผิดตำแหน่ง
  - **114 sub-items** (แถวย่อย) ที่อยู่ผิดบ้านหยิบ

## Root Cause

หน้า Preparation Area Inventory แสดงข้อมูลแบบ aggregated by SKU และมีแถวย่อยแสดงรายละเอียดแต่ละ pallet/location แต่**ไม่มีการแสดงว่ารายการไหนอยู่ผิดตำแหน่ง**

## Solution Implemented

### 1. เพิ่มการตรวจสอบสินค้าผิดตำแหน่งในแถวย่อย

```typescript
const defaultLocation = (balance as any).master_sku?.default_location;
const currentLocation = subItem.location_id;
const isInPickingHome = preparationAreaCodes.includes(currentLocation);
const isMisplaced = defaultLocation && isInPickingHome && currentLocation !== defaultLocation;
```

### 2. แสดง Badge "ผิดตำแหน่ง" ในแถวย่อย

- แถวที่ผิดตำแหน่งจะมีพื้นหลังสีแดงอ่อน (`bg-red-50`)
- แสดง Badge สีแดง "ผิดตำแหน่ง" ข้างชื่อ location
- แสดงข้อความ "✓ ควรอยู่: [location]" สีเขียวด้านล่าง

### 3. แสดงจำนวนสินค้าผิดตำแหน่งในแถวหลัก

- นับจำนวน sub-items ที่ผิดตำแหน่งในแต่ละ SKU
- แสดง Badge สีแดงพร้อมจำนวนข้างปุ่ม expand/collapse
- แถวที่มีสินค้าผิดตำแหน่งจะมีเส้นขอบซ้ายสีแดง (`border-l-4 border-l-red-500`)

## Files Modified

- `app/warehouse/preparation-area-inventory/page.tsx` - เพิ่มการแสดงสินค้าผิดตำแหน่งในแถวย่อย

## Files Created

- `scripts/check-prep-area-misplaced-items.js` - Script ตรวจสอบสินค้าผิดตำแหน่งในหน้า Preparation Area Inventory
- `prep-area-misplaced-items.json` - รายงานสินค้าผิดตำแหน่งแบบละเอียด

## Top Misplaced SKUs

| SKU | Product Name | Total Sub-Items | Misplaced Count |
|-----|--------------|-----------------|-----------------|
| B-BEY-C\|MNB\|NS\|010 | Buzz Beyond แม่และลูกแมว 1kg | 7 | 6 |
| B-BEY-D\|SAL\|NS\|012 | Buzz Beyond สุนัขโต รสแซลมอน 1.2kg | 7 | 6 |
| B-BEY-C\|SAL\|NS\|010 | Buzz Beyond แมวโต รสแซลมอน 1kg | 5 | 4 |
| B-BEY-C\|LAM\|NS\|010 | Buzz Beyond แมวโต รสแกะ 1kg | 5 | 4 |
| B-BAP-C\|WEP\|030 | Buzz Balanced+ แมวโต Weight+ 3kg | 4 | 4 |
| TT-NET-C\|SAL\|0005 | Tester Buzz Netura แมวโตและลูก แซลมอน 50g | 5 | 4 |
| TT-NET-D\|CHI-L\|0005 | Tester Buzz Netura สุนัขโต ไก่ เม็ดใหญ่ 50g | 4 | 4 |
| B-BEY-C\|MCK\|NS\|010 | Buzz Beyond แมวโต รสปลาทู 1kg | 5 | 4 |

## User Impact

ผู้ใช้สามารถ:
1. เห็นจำนวนสินค้าผิดตำแหน่งในแต่ละ SKU ได้ทันทีจากแถวหลัก
2. กดขยายแถวเพื่อดูรายละเอียดว่า pallet/location ไหนอยู่ผิดที่
3. เห็นว่าควรย้ายไปยัง location ไหน
4. ใช้ข้อมูลนี้ประกอบการตัดสินใจในการย้ายสินค้า

## Next Steps

1. ✅ แสดงสินค้าผิดตำแหน่งในแถวย่อย
2. ⏳ เพิ่มปุ่ม "สร้าง Replenishment Task" สำหรับย้ายสินค้าที่ผิดตำแหน่ง
3. ⏳ เพิ่มตัวกรองแสดงเฉพาะ SKU ที่มีสินค้าผิดตำแหน่ง
4. ⏳ เพิ่มการส่งออก Excel รายงานสินค้าผิดตำแหน่ง

## Testing

Run the check script to verify:
```bash
node scripts/check-prep-area-misplaced-items.js
```

Expected output:
- Total SKUs: 117
- SKUs with misplaced items: 52
- Total misplaced sub-items: 114
