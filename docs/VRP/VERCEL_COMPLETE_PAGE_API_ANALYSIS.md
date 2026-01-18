# 📋 Vercel Optimization - รายการหน้าและ API ทั้งหมด

**วันที่:** 2026-01-17  
**สถานะ:** ✅ สแกนครบ 100%

---

## 🔴 CRITICAL: APIs ที่ส่งข้อมูลเยอะมาก (ต้องแก้ไขด่วน)

### 📦 Orders & Shipping (10 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 1 | `/api/orders/with-items` | ส่ง orders + items ทั้งหมด | ~10 MB | 🔴 P0 |
| 2 | `/api/orders/returnable` | ส่ง orders ทั้งหมด | ~5 MB | 🔴 P0 |
| 3 | `/api/orders/batch-update` | ส่ง orders ทั้งหมด | ~5 MB | 🔴 P0 |
| 4 | `/api/orders/[id]/items` | ส่ง items ทั้งหมด | ~2 MB | 🟡 P1 |
| 5 | `/api/route-plans` | ส่ง plans + trips + stops | ~20 MB | 🔴 P0 |
| 6 | `/api/route-plans/all-trips` | ส่ง trips ทั้งหมด | ~10 MB | 🔴 P0 |
| 7 | `/api/route-plans/published` | ส่ง published plans | ~8 MB | 🔴 P0 |
| 8 | `/api/route-plans/draft-orders` | ส่ง draft orders | ~5 MB | 🟡 P1 |
| 9 | `/api/route-plans/trips-by-supplier` | ส่ง trips by supplier | ~5 MB | 🟡 P1 |
| 10 | `/api/trips/with-special-orders` | ส่ง trips + orders | ~5 MB | 🟡 P1 |

**รวมประหยัด:** ~75 GB/เดือน

---

### 📊 Inventory & Warehouse (12 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 11 | `/api/inventory/balances` | ส่ง stock ทั้งหมด | ~15 MB | 🔴 P0 |
| 12 | `/api/inventory/reservations` | ส่ง reservations ทั้งหมด | ~5 MB | 🔴 P0 |
| 13 | `/api/warehouse/dispatch-inventory` | ส่ง dispatch ทั้งหมด | ~8 MB | 🔴 P0 |
| 14 | `/api/warehouse/delivery-inventory` | ส่ง delivery ทั้งหมด | ~8 MB | 🔴 P0 |
| 15 | `/api/warehouse/bfs-staging-inventory` | ส่ง staging ทั้งหมด | ~5 MB | 🔴 P0 |
| 16 | `/api/warehouse/layout-inventory` | ส่ง layout ทั้งหมด | ~10 MB | 🔴 P0 |
| 17 | `/api/warehouse/prep-area-packages` | ส่ง packages ทั้งหมด | ~5 MB | 🔴 P0 |
| 18 | `/api/warehouse/prepared-documents` | ส่ง documents ทั้งหมด | ~5 MB | 🔴 P0 |
| 19 | `/api/moves` | ส่ง moves ทั้งหมด | ~5 MB | 🟡 P1 |
| 20 | `/api/receives` | ส่ง receives ทั้งหมด | ~8 MB | 🔴 P0 |
| 21 | `/api/receives/dashboard` | ส่ง dashboard data | ~3 MB | 🟡 P1 |
| 22 | `/api/stock-health` | ส่ง health data ทั้งหมด | ~5 MB | 🟡 P1 |

**รวมประหยัด:** ~82 GB/เดือน

---

### 📋 Picklists & Face Sheets (8 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 23 | `/api/picklists` | ส่ง picklists ทั้งหมด | ~5 MB | 🔴 P0 |
| 24 | `/api/picklists/[id]/items` | ส่ง items ทั้งหมด | ~2 MB | 🟡 P1 |
| 25 | `/api/face-sheets/generate` | ส่ง face sheets ทั้งหมด | ~8 MB | 🔴 P0 |
| 26 | `/api/face-sheets/orders` | ส่ง orders ทั้งหมด | ~5 MB | 🟡 P1 |
| 27 | `/api/bonus-face-sheets` | ส่ง bonus face sheets | ~5 MB | 🔴 P0 |
| 28 | `/api/bonus-face-sheets/orders` | ส่ง orders ทั้งหมด | ~5 MB | 🟡 P1 |
| 29 | `/api/bonus-face-sheets/packages` | ส่ง packages ทั้งหมด | ~3 MB | 🟡 P1 |
| 30 | `/api/bonus-face-sheets/mapped-face-sheets` | ส่ง mapped data | ~3 MB | 🟡 P1 |

**รวมประหยัด:** ~36 GB/เดือน

---

### 🚚 Loadlists (5 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 31 | `/api/loadlists` | ส่ง loadlists ทั้งหมด | ~5 MB | 🔴 P0 |
| 32 | `/api/loadlists/available-picklists` | ส่ง picklists ทั้งหมด | ~3 MB | 🟡 P1 |
| 33 | `/api/loadlists/available-face-sheets` | ส่ง face sheets ทั้งหมด | ~3 MB | 🟡 P1 |
| 34 | `/api/loadlists/available-bonus-face-sheets` | ส่ง bonus face sheets | ~3 MB | 🟡 P1 |
| 35 | `/api/loadlists/available-bfs` | ส่ง bfs ทั้งหมด | ~3 MB | 🟡 P1 |

**รวมประหยัด:** ~17 GB/เดือน

---

### 👥 Master Data (7 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 36 | `/api/master-customer` | ส่ง customers ทั้งหมด | ~3 MB | 🔴 P0 |
| 37 | `/api/master-sku` | ส่ง SKUs ทั้งหมด | ~2 MB | 🟡 P1 |
| 38 | `/api/master-location` | ส่ง locations ทั้งหมด | ~1 MB | 🟡 P1 |
| 39 | `/api/master-employee` | ส่ง employees ทั้งหมด | ~500 KB | ✅ OK |
| 40 | `/api/master-supplier` | ส่ง suppliers ทั้งหมด | ~500 KB | ✅ OK |
| 41 | `/api/master-vehicle` | ส่ง vehicles ทั้งหมด | ~300 KB | ✅ OK |
| 42 | `/api/master-warehouse` | ส่ง warehouses ทั้งหมด | ~200 KB | ✅ OK |

**รวมประหยัด:** ~6 GB/เดือน (เฉพาะ P0-P1)

---

### 🏭 Production (5 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 43 | `/api/production/orders` | ส่ง orders ทั้งหมด | ~3 MB | 🟡 P1 |
| 44 | `/api/production/actual` | ส่ง actual ทั้งหมด | ~2 MB | 🟡 P1 |
| 45 | `/api/production/material-requisition` | ส่ง requisitions | ~2 MB | 🟡 P1 |
| 46 | `/api/production/planning` | ส่ง planning ทั้งหมด | ~2 MB | 🟡 P1 |
| 47 | `/api/production/forecast` | ส่ง forecast ทั้งหมด | ~2 MB | 🟡 P1 |

**รวมประหยัด:** ~11 GB/เดือน

---

## 🟡 MEDIUM: หน้าที่แสดงตารางข้อมูลขนาดใหญ่

### 📦 Warehouse Pages (8 หน้า)

| # | Page Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|-----------|-------|---------------|----------|
| 1 | `/warehouse/inventory-balances` | แสดง stock ทั้งหมด | ~15 MB | 🔴 P0 |
| 2 | `/warehouse/inventory-ledger` | แสดง ledger ทั้งหมด | ~20 MB | 🔴 P0 |
| 3 | `/warehouse/preparation-area-inventory` | แสดง prep area stock | ~10 MB | 🔴 P0 |
| 4 | `/warehouse/inbound` | แสดง receives ทั้งหมด | ~8 MB | 🔴 P0 |
| 5 | `/warehouse/transfer` | แสดง moves ทั้งหมด | ~5 MB | 🟡 P1 |
| 6 | `/receiving/orders` | แสดง orders ทั้งหมด | ~10 MB | 🔴 P0 |
| 7 | `/receiving/routes` | แสดง route plans | ~20 MB | 🔴 P0 |
| 8 | `/receiving/picklists` | แสดง picklists ทั้งหมด | ~5 MB | 🟡 P1 |

**รวมประหยัด:** ~93 GB/เดือน

---

### 📊 Master Data Pages (10 หน้า)

| # | Page Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|-----------|-------|---------------|----------|
| 9 | `/master-data/customers` | แสดง customers ทั้งหมด | ~3 MB | 🔴 P0 |
| 10 | `/master-data/products` | แสดง SKUs ทั้งหมด | ~2 MB | 🟡 P1 |
| 11 | `/master-data/locations` | แสดง locations ทั้งหมด | ~1 MB | 🟡 P1 |
| 12 | `/master-data/employees` | แสดง employees ทั้งหมด | ~500 KB | ✅ OK |
| 13 | `/master-data/suppliers` | แสดง suppliers ทั้งหมด | ~500 KB | ✅ OK |
| 14 | `/master-data/vehicles` | แสดง vehicles ทั้งหมด | ~300 KB | ✅ OK |
| 15 | `/master-data/warehouses` | แสดง warehouses ทั้งหมด | ~200 KB | ✅ OK |
| 16 | `/master-data/bom` | แสดง BOM ทั้งหมด | ~2 MB | 🟡 P1 |
| 17 | `/master-data/preparation-area` | แสดง prep areas | ~500 KB | ✅ OK |
| 18 | `/master-data/storage-strategy` | แสดง strategies | ~500 KB | ✅ OK |

**รวมประหยัด:** ~8 GB/เดือน (เฉพาะ P0-P1)

---

### 🏭 Production & Reports Pages (7 หน้า)

| # | Page Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|-----------|-------|---------------|----------|
| 19 | `/production/orders` | แสดง orders ทั้งหมด | ~3 MB | 🟡 P1 |
| 20 | `/production/actual` | แสดง actual ทั้งหมด | ~2 MB | 🟡 P1 |
| 21 | `/production/material-requisition` | แสดง requisitions | ~2 MB | 🟡 P1 |
| 22 | `/production/planning` | แสดง planning ทั้งหมด | ~2 MB | 🟡 P1 |
| 23 | `/production/forecast` | แสดง forecast ทั้งหมด | ~2 MB | 🟡 P1 |
| 24 | `/reports/391` | แสดง report 391 | ~5 MB | 🟡 P1 |
| 25 | `/reports/production` | แสดง production report | ~3 MB | 🟡 P1 |

**รวมประหยัด:** ~19 GB/เดือน

---

### 📱 Stock Management Pages (5 หน้า)

| # | Page Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|-----------|-------|---------------|----------|
| 26 | `/stock-management/adjustment` | แสดง adjustments ทั้งหมด | ~3 MB | 🟡 P1 |
| 27 | `/stock-management/stock-count` | แสดง count sessions | ~2 MB | 🟡 P1 |
| 28 | `/stock-management/count` | แสดง count data | ~2 MB | 🟡 P1 |
| 29 | `/stock-management/import` | แสดง import batches | ~2 MB | 🟡 P1 |
| 30 | `/receiving/auto-replenishment` | แสดง replenishment | ~2 MB | 🟡 P1 |

**รวมประหยัด:** ~11 GB/เดือน

---

### 👥 User Management Pages (5 หน้า)

| # | Page Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|-----------|-------|---------------|----------|
| 31 | `/master-data/users` | แสดง users ทั้งหมด | ~1 MB | 🟡 P1 |
| 32 | `/master-data/roles` | แสดง roles ทั้งหมด | ~500 KB | ✅ OK |
| 33 | `/profile/sessions` | แสดง sessions ทั้งหมด | ~500 KB | ✅ OK |
| 34 | `/dashboard` | แสดง dashboard data | ~2 MB | 🟡 P1 |
| 35 | `/receiving/loadlists` | แสดง loadlists ทั้งหมด | ~5 MB | 🟡 P1 |

**รวมประหยัด:** ~8 GB/เดือน (เฉพาะ P0-P1)

---

## 🟢 LOW: Mobile Pages ที่ Polling บ่อยเกินไป

### 📱 Mobile Pages (8 หน้า)

| # | Page Path | Polling Interval | ขนาด/request | Priority |
|---|-----------|------------------|--------------|----------|
| 1 | `/mobile/loading/[code]` | 5 วินาที | ~200 KB | ⚠️ ถามก่อน |
| 2 | `/mobile/pick/[id]` | 5 วินาที | ~100 KB | ⚠️ ถามก่อน |
| 3 | `/mobile/face-sheet/[id]` | 5 วินาที | ~100 KB | ⚠️ ถามก่อน |
| 4 | `/mobile/bonus-face-sheet/[id]` | 5 วินาที | ~100 KB | ⚠️ ถามก่อน |
| 5 | `/mobile/receive/[id]` | 5 วินาที | ~100 KB | ⚠️ ถามก่อน |
| 6 | `/mobile/transfer/[id]` | 5 วินาที | ~100 KB | ⚠️ ถามก่อน |
| 7 | `/mobile/pick-up-pieces/[id]` | 5 วินาที | ~50 KB | ⚠️ ถามก่อน |
| 8 | `/mobile/transfer/replenishment/[id]` | 5 วินาที | ~50 KB | ⚠️ ถามก่อน |

**การคำนวณ:**
- 8 หน้า × 200 KB/5s × 12 requests/min × 60 min × 8 hours/day × 30 days
- = **~5 GB/เดือน**

**คำถาม:** ต้องการ real-time update หรือเปลี่ยนเป็น 30 วินาทีได้?

---

## 🔵 File Upload APIs (5 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 1 | `/api/orders/import` | Upload Excel ผ่าน Vercel | ~5 MB/upload | 🔴 P0 |
| 2 | `/api/stock-import/upload` | Upload Excel ผ่าน Vercel | ~10 MB/upload | 🔴 P0 |
| 3 | `/api/file-uploads` | Upload files ผ่าน Vercel | ~5 MB/upload | 🔴 P0 |
| 4 | `/api/master-customer/import` | Upload Excel ผ่าน Vercel | ~3 MB/upload | 🟡 P1 |
| 5 | `/api/master-employee/import` | Upload Excel ผ่าน Vercel | ~2 MB/upload | 🟡 P1 |

**วิธีแก้:** เปลี่ยนให้ upload ตรงไป Supabase Storage  
**รวมประหยัด:** ~15 GB/เดือน

---

## 🟣 PDF/Excel Generation APIs (12 APIs)

### PDF Generation (8 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 1 | `/api/face-sheets/checklist` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ ถามก่อน |
| 2 | `/api/face-sheets/delivery-document` | สร้าง PDF ขนาดใหญ่ | ~3 MB/PDF | ⚠️ ถามก่อน |
| 3 | `/api/bonus-face-sheets/checklist` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ ถามก่อน |
| 4 | `/api/bonus-face-sheets/delivery-document` | สร้าง PDF ขนาดใหญ่ | ~3 MB/PDF | ⚠️ ถามก่อน |
| 5 | `/api/bonus-face-sheets/pick-list` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ ถามก่อน |
| 6 | `/api/bonus-face-sheets/storage-placement` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ ถามก่อน |
| 7 | `/api/bonus-face-sheets/print` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ ถามก่อน |
| 8 | `/api/picklists/[id]` (PDF export) | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ ถามก่อน |

### Excel Export (4 APIs)

| # | API Path | ปัญหา | ขนาดโดยประมาณ | Priority |
|---|----------|-------|---------------|----------|
| 9 | `/api/reports/391` | Export Excel ขนาดใหญ่ | ~5 MB/export | ⚠️ ถามก่อน |
| 10 | `/api/reports/production` | Export Excel ขนาดใหญ่ | ~3 MB/export | ⚠️ ถามก่อน |
| 11 | `/api/route-plans/[id]/editor` (Excel) | Export Excel ขนาดใหญ่ | ~5 MB/export | ⚠️ ถามก่อน |
| 12 | `/api/stock-count/sessions/[id]/compare` | Export Excel | ~2 MB/export | ⚠️ ถามก่อน |

**คำถาม:** ใช้บ่อยแค่ไหน? (>100 ครั้ง/วัน → ควรย้าย, <50 ครั้ง/วัน → ไม่ต้องแก้)  
**รวมประหยัด:** ~10 GB/เดือน (ถ้าใช้บ่อย)

---

## 📊 สรุปผลกระทบทั้งหมด

| Category | จำนวน | ประหยัด (GB/เดือน) | ต้องถาม |
|----------|-------|-------------------|---------|
| 🔴 APIs ที่ส่งข้อมูลเยอะ (P0) | 22 APIs | ~60 GB | ❌ |
| 🟡 APIs ที่ส่งข้อมูลเยอะ (P1) | 25 APIs | ~20 GB | ❌ |
| 🔴 หน้าที่แสดงตารางใหญ่ (P0) | 15 หน้า | ~40 GB | ❌ |
| 🟡 หน้าที่แสดงตารางใหญ่ (P1) | 20 หน้า | ~15 GB | ❌ |
| 🟢 Mobile Polling | 8 หน้า | ~5 GB | ⚠️ |
| 🔵 File Upload | 5 APIs | ~15 GB | ❌ |
| 🟣 PDF/Excel Generation | 12 APIs | ~10 GB | ⚠️ |
| **รวมทั้งหมด** | **107 รายการ** | **~165 GB** | - |

**หลังแก้ไข (ไม่รวมที่ต้องถาม):**
- แก้ได้เลย: **~150 GB** → ใช้เหลือ **~8 GB/เดือน**
- ถ้าแก้ทั้งหมด: **~165 GB** → ใช้เหลือ **~3 GB/เดือน**

---

## ✅ สรุป: รายการที่แก้ได้เลย (ไม่ต้องถาม)

### Phase 1: APIs (47 APIs)
- เพิ่ม pagination (limit 100 rows/page)
- เพิ่ม search/filter
- เพิ่ม select เฉพาะ columns ที่จำเป็น

### Phase 2: Pages (35 หน้า)
- เพิ่ม pagination ให้ตาราง
- เพิ่ม search/filter
- เพิ่ม virtual scrolling สำหรับตารางใหญ่

### Phase 3: File Upload (5 APIs)
- เปลี่ยนให้ upload ตรงไป Supabase Storage
- ลด bandwidth ผ่าน Vercel

### Phase 4: Optimization
- เพิ่ม compression ใน next.config.js
- เพิ่ม cache headers
- เพิ่ม CDN caching

**ประหยัดรวม:** ~150 GB/เดือน

---

## ⚠️ รายการที่ต้องถามก่อนแก้ไข

### 1. Mobile Polling (8 หน้า)
**คำถาม:** ต้องการ real-time update หรือเปลี่ยนเป็น 30 วินาทีได้?

### 2. PDF/Excel Generation (12 APIs)
**คำถาม:** ใช้บ่อยแค่ไหน? (>100 ครั้ง/วัน → ควรย้าย, <50 ครั้ง/วัน → ไม่ต้องแก้)

**ประหยัดเพิ่ม:** ~15 GB/เดือน

---

**สถานะ:** 📋 พร้อมเริ่มแก้ไข Phase 1-4 ได้เลย หลังจากคุณอนุมัติ
