# รายงานการปรับสต็อก Bonus Face Sheet Packages
## Stock Reconciliation Report - 2026-01-12

### ไฟล์อ้างอิง
- `MR_PQ/ของค้างโลเคชั่น.xlsx`

---

## สรุปผลการดำเนินการ

### ก่อนปรับ (Before)
| Location | จำนวน Packages |
|----------|----------------|
| MR01 | 128 |
| MR02 | 15 |
| MR03 | 12 |
| MR04 | 1 |
| PQ01 | 2 |
| **รวม** | **158** |

### หลังปรับ (After)
| Location | จำนวน Packages |
|----------|----------------|
| MR01 | 7 |
| MR02 | 2 |
| MR03 | 1 |
| MR04 | 2 |
| **รวม** | **12** |

---

## รายการ Packages ที่เหลือ (ตรงกับ Excel)

| Barcode ID | Location | Face Sheet | ร้านค้า |
|------------|----------|------------|---------|
| BFS-20260108-002-P009 | MR01 | BFS-20260108-002 | โบโย่ เพ็ทสโตร์ สาขา หนองแปป |
| BFS-20260108-002-P010 | MR01 | BFS-20260108-002 | โบโย่ เพ็ทสโตร์ สาขา หนองแปป |
| BFS-20260109-001-P003 | MR01 | BFS-20260109-001 | เจนเวชภัณฑ์สัตว์เลี้ยง |
| BFS-20260109-001-P004 | MR01 | BFS-20260109-001 | เจนเวชภัณฑ์สัตว์เลี้ยง |
| BFS-20260109-001-P005 | MR01 | BFS-20260109-001 | เจนเวชภัณฑ์สัตว์เลี้ยง |
| BFS-20260109-001-P006 | MR01 | BFS-20260109-001 | เจนเวชภัณฑ์สัตว์เลี้ยง |
| BFS-20260109-001-P007 | MR01 | BFS-20260109-001 | เจนเวชภัณฑ์สัตว์เลี้ยง |
| BFS-20260108-002-P011 | MR02 | BFS-20260108-002 | โบโย่ เพ็ทสโตร์ สาขา หนองแปป |
| BFS-20260109-001-P012 | MR02 | BFS-20260109-001 | ป.ปลางามเพ็ทช็อป ลำปาง |
| BFS-20260108-002-P028 | MR03 | BFS-20260108-002 | แพร่เพ็ทช็อป |
| BFS-20260108-002-P034 | MR04 | BFS-20260108-002 | เพ็ทมอลล์ สวนดอก |
| BFS-20260108-002-P037 | MR04 | BFS-20260108-002 | ฮีโร่เพ็ทมาร์ท |

---

## สถานะ BFS หลังปรับ

| Face Sheet No | Status | Total Packages | Remaining |
|---------------|--------|----------------|-----------|
| BFS-20260105-001 | completed | 10 | 0 |
| BFS-20260106-001 | completed | 1 | 0 |
| BFS-20260106-002 | completed | 4 | 0 |
| BFS-20260106-003 | completed | 1 | 0 |
| BFS-20260106-005 | completed | 19 | 0 |
| BFS-20260107-001 | completed | 11 | 0 |
| BFS-20260107-002 | completed | 6 | 0 |
| BFS-20260107-003 | completed | 9 | 0 |
| BFS-20260107-004 | completed | 1 | 0 |
| BFS-20260107-005 | completed | 2 | 0 |
| BFS-20260107-006 | completed | 4 | 0 |
| BFS-20260107-007 | completed | 33 | 0 |
| BFS-20260108-001 | completed | 1 | 0 |
| BFS-20260108-002 | picking | 37 | 6 |
| BFS-20260109-001 | picking | 29 | 6 |
| BFS-20260112-001 | completed | 1 | 0 |

---

## การดำเนินการ

1. ✅ อ่านไฟล์ Excel `ของค้างโลเคชั่น.xlsx` - พบ 12 barcodes
2. ✅ ตรวจสอบข้อมูลในระบบ - พบ 158 packages ใน MR/PQ locations
3. ✅ เปรียบเทียบข้อมูล:
   - Packages ที่ต้องโหลดออก: 146 packages
   - Packages ที่เก็บไว้: 12 packages
4. ✅ ดำเนินการปรับสต็อก:
   - Clear `storage_location` สำหรับ 146 packages ที่ไม่มีของจริง
   - อัพเดท location ตาม Excel สำหรับ 12 packages ที่เหลือ
5. ✅ อัพเดทสถานะ BFS:
   - BFS ที่ไม่มี packages เหลือ → `completed`
   - BFS ที่ยังมี packages เหลือ → `picking`

---

## Backup

ข้อมูลก่อนปรับถูกเก็บไว้ใน table: `_backup_bfs_packages_20260112`

```sql
-- ดูข้อมูล backup
SELECT * FROM _backup_bfs_packages_20260112;

-- Restore (ถ้าต้องการ)
UPDATE bonus_face_sheet_packages p
SET storage_location = b.storage_location
FROM _backup_bfs_packages_20260112 b
WHERE p.id = b.id;
```

---

## Migration File

`supabase/migrations/201_adjust_bfs_packages_stock_reconciliation.sql`
