# Inventory Ledger Page - Debug Summary

## Issue
หน้า Inventory Ledger (http://localhost:3000/warehouse/inventory-ledger) ไม่แสดงประวัติธุรกรรมใดๆ แม้ว่าในฐานข้อมูลจะมีข้อมูล 129,000+ รายการ

## การตรวจสอบที่ทำแล้ว

### ✅ ฐานข้อมูล
- ตาราง `wms_inventory_ledger` มีข้อมูล 129,331 รายการ
- RLS ปิดอยู่ (ไม่มีการบล็อกการเข้าถึง)
- ข้อมูลล่าสุดมีอยู่จริง (วันนี้ 19 ก.พ. 2026)

### ✅ Backend Query
- ทดสอบด้วย `test-inventory-ledger-query.js` สำเร็จ
- Query ทำงานได้ปกติจาก Node.js
- ดึงข้อมูลพร้อม joins ได้ครบถ้วน

## การแก้ไขที่ทำ

### 1. เพิ่ม Debug Logs
เพิ่ม console.log ในฟังก์ชัน `fetchLedgerData` เพื่อติดตามการทำงาน:
- 🔍 เริ่มต้น fetch
- 📊 สร้าง Supabase client
- 📈 ผลลัพธ์การนับจำนวน
- 📦 จำนวนข้อมูลที่ได้รับ
- ❌ Error (ถ้ามี)
- ✅ การ set state
- 🏁 สิ้นสุดการ fetch

### 2. เพิ่ม State Monitoring
เพิ่ม useEffect เพื่อแสดงสถานะของข้อมูล:
- ledgerData length
- filteredData length
- consolidatedData length
- groupedData length
- loading state
- error state
- totalCount

## ขั้นตอนการตรวจสอบ

### สำหรับผู้ใช้งาน:
1. เปิดหน้า http://localhost:3000/warehouse/inventory-ledger
2. กด F12 เพื่อเปิด Developer Tools
3. ไปที่แท็บ Console
4. ดูข้อความที่ขึ้นต้นด้วย `[Inventory Ledger]`
5. ส่งภาพหน้าจอ Console มาให้ตรวจสอบ

### สิ่งที่ต้องการทราบ:
- มี error message อะไรไหม?
- fetchLedgerData ถูกเรียกหรือไม่?
- ได้รับข้อมูลกี่ records?
- loading state เป็น true หรือ false?

## ไฟล์ที่เกี่ยวข้อง
- `app/warehouse/inventory-ledger/page.tsx` - หน้าที่มีปัญหา (เพิ่ม debug logs แล้ว)
- `test-inventory-ledger-query.js` - Script ทดสอบ backend
- `docs/warehouse/INVENTORY_LEDGER_TROUBLESHOOTING.md` - คู่มือแก้ปัญหา

## สาเหตุที่เป็นไปได้
1. Session หมดอายุ / ไม่ได้ login
2. JavaScript error ที่ทำให้ fetch ไม่ทำงาน
3. Network error
4. Browser cache issue

## การแก้ไขชั่วคราว
ถ้าต้องการดูข้อมูลด่วน สามารถรัน:
```bash
node test-inventory-ledger-query.js
```
เพื่อดูข้อมูลจาก backend โดยตรง
