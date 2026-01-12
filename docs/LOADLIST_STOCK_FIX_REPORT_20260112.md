# รายงานแก้ไขสต็อก Loadlists LD-20260112-0007 ถึง LD-20260112-0010

## สรุปปัญหา

Loadlists 4 รายการไม่สามารถยืนยันโหลดได้เนื่องจากสต็อกไม่เพียงพอที่ PQTD/MRTD

| Loadlist | BFS | Packages | Hub |
|----------|-----|----------|-----|
| LD-20260112-0007 | BFS-20260109-001 | 385, 386, 387 | BKK05 |
| LD-20260112-0008 | BFS-20260109-001 | 403 | BKK01 |
| LD-20260112-0009 | BFS-20260109-001 | 398, 395, 396, 397, 378 | BKK01, BKK05 |
| LD-20260112-0010 | BFS-20260109-001 | 392, 393 | อยุธยา |

## สาเหตุ

Packages มี `storage_location = null` (แสดงว่าถูกย้ายไป staging แล้ว) แต่สต็อกยังอยู่ที่:
- Prep areas (MR01, MR02, MR03)
- Bulk storage (MCF-AA06, MCF-AA07, A08-01-020, A08-01-023, A08-01-024, A10-02-007)

## การแก้ไข

Migration `203_fix_loadlist_stock_transfer_to_staging.sql` ย้ายสต็อกจาก:

### Step 1: จาก Prep Areas ไป PQTD
| SKU | จาก | จำนวน |
|-----|-----|-------|
| PRE-BAG\|SPB\|MARKET | MR02 | 30 |
| PRE-BOW\|TILT\|CAT | MR03 | 10 |
| PRE-CHO\|BLU | MR01 | 4 |
| PRE-CHO\|GRE | MR01 | 4 |
| TT-NET-C\|CNT\|0005 | MR03 | 60 |
| TT-NET-C\|FHC\|0005 | MR02+MR03 | 65 |
| TT-NET-C\|FNC\|0005 | MR02+MR03 | 65 |
| TT-NET-C\|SAL\|0005 | MR02+MR03 | 65 |

### Step 2: จาก Bulk Storage ไป PQTD/MRTD
| SKU | จาก | ไป PQTD | ไป MRTD |
|-----|-----|---------|---------|
| PRE-CHO\|BLU | MCF-AA06 | 6 | - |
| PRE-CHO\|GRE | MCF-AA07 | 6 | - |
| TT-NET-C\|CNT\|0005 | A10-02-007 | 140 | 100 |
| TT-NET-C\|FHC\|0005 | A08-01-024 | 85 | 50 |
| TT-NET-C\|FNC\|0005 | A08-01-023 | 65 | 80 |
| TT-NET-C\|SAL\|0005 | A08-01-020 | 55 | 90 |

## ผลลัพธ์หลังแก้ไข

| Location | SKU | จำนวน | สถานะ |
|----------|-----|-------|-------|
| PQTD | PRE-BAG\|SPB\|MARKET | 80 | ✅ พอ |
| PQTD | PRE-BOW\|TILT\|CAT | 25 | ✅ พอ |
| PQTD | PRE-CHO\|BLU | 10 | ✅ พอ |
| PQTD | PRE-CHO\|GRE | 10 | ✅ พอ |
| PQTD | TT-NET-C\|CNT\|0005 | 200 | ✅ พอ |
| PQTD | TT-NET-C\|FHC\|0005 | 200 | ✅ พอ |
| PQTD | TT-NET-C\|FNC\|0005 | 150 | ✅ พอ |
| PQTD | TT-NET-C\|SAL\|0005 | 150 | ✅ พอ |
| MRTD | TT-NET-C\|CNT\|0005 | 200 | ✅ พอ |
| MRTD | TT-NET-C\|FHC\|0005 | 100 | ✅ พอ |
| MRTD | TT-NET-C\|FNC\|0005 | 100 | ✅ พอ |
| MRTD | TT-NET-C\|SAL\|0005 | 100 | ✅ พอ |

## ขั้นตอนถัดไป

Loadlists ทั้ง 4 รายการพร้อมยืนยันโหลดได้แล้ว ผู้ใช้สามารถ:
1. ไปที่หน้า Mobile Loading
2. สแกน QR Code ของ Loadlist
3. กดยืนยันโหลด

## ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/203_fix_loadlist_stock_transfer_to_staging.sql`
