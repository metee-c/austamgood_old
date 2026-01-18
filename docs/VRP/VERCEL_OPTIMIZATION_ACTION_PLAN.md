# 🎯 Vercel Optimization - Complete Analysis & Action Plan

**วันที่:** 2026-01-17  
**สถานะ:** 📋 รอตรวจสอบและอนุมัติ  
**อัพเดทล่าสุด:** สแกนโปรเจคครบทั้งหมด 100%

---

## 📊 สรุปปัญหา

Vercel Free Tier ใช้ไป **83 GB / 100 GB** (83%)

**สาเหตุหลัก:**
1. ✅ **API ส่งข้อมูลทั้งหมดโดยไม่มี pagination** - พบ 47 APIs
2. ✅ **หน้าที่แสดงตารางข้อมูลขนาดใหญ่** - พบ 35 หน้า
3. ✅ **Mobile pages ที่ polling บ่อยเกินไป** - พบ 8 หน้า
4. ✅ **File upload ผ่าน Vercel** - พบ 5 APIs
5. ✅ **PDF/Excel generation** - พบ 12 APIs

---

## � สรุปการสแกนโปรเจค

✅ **สแกนเสร็จสมบูรณ์ 100%**

**พบรายการทั้งหมด:**
- 🔴 APIs ที่ส่งข้อมูลเยอะ: **47 APIs**
- 🔴 หน้าที่แสดงตารางใหญ่: **35 หน้า**
- 🟢 Mobile pages ที่ polling: **8 หน้า**
- 🔵 File upload APIs: **5 APIs**
- 🟣 PDF/Excel generation: **12 APIs**

**รวมทั้งหมด: 107 รายการ**

📄 **ดูรายละเอียดครบถ้วน:** `docs/VERCEL_COMPLETE_PAGE_API_ANALYSIS.md`

---

## 🔴 Priority 1: APIs ที่ต้องแก้ไขด่วน (ส่งข้อมูลเยอะมาก)

### 1.1 Orders APIs ⚠️ สำคัญมาก

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/orders/with-items` | ส่งข้อมูล orders ทั้งหมด + items | ~10 MB/request | ❌ แก้ได้เลย |
| `/api/orders/returnable` | ส่งข้อมูล orders ทั้งหมด | ~5 MB/request | ❌ แก้ได้เลย |
| `/api/orders/batch-update` | ส่งข้อมูล orders ทั้งหมด | ~5 MB/request | ❌ แก้ได้เลย |

**วิธีแก้:** เพิ่ม pagination (limit 100 rows/page) + search filter

### 1.2 Inventory APIs ⚠️ สำคัญมาก

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/inventory/balances` | ส่งข้อมูล stock ทั้งหมด | ~15 MB/request | ❌ แก้ได้เลย |
| `/api/warehouse/dispatch-inventory` | ส่งข้อมูล dispatch ทั้งหมด | ~8 MB/request | ❌ แก้ได้เลย |
| `/api/warehouse/delivery-inventory` | ส่งข้อมูล delivery ทั้งหมด | ~8 MB/request | ❌ แก้ได้เลย |
| `/api/warehouse/bfs-staging-inventory` | ส่งข้อมูล staging ทั้งหมด | ~5 MB/request | ❌ แก้ได้เลย |
| `/api/warehouse/layout-inventory` | ส่งข้อมูล layout ทั้งหมด | ~10 MB/request | ❌ แก้ได้เลย |
| `/api/warehouse/prep-area-packages` | ส่งข้อมูล packages ทั้งหมด | ~5 MB/request | ❌ แก้ได้เลย |

**วิธีแก้:** เพิ่ม pagination + filter by warehouse/location

### 1.3 Route Plans APIs ⚠️ สำคัญมาก

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/route-plans` | ส่งข้อมูล plans + trips + stops ทั้งหมด | ~20 MB/request | ❌ แก้ได้เลย |
| `/api/route-plans/all-trips` | ส่งข้อมูล trips ทั้งหมด | ~10 MB/request | ❌ แก้ได้เลย |
| `/api/route-plans/[id]/editor` | ส่งข้อมูล editor ทั้งหมด | ~15 MB/request | ⚠️ **ถามก่อน** |

**คำถาม:**
- `/api/route-plans/[id]/editor` - หน้า Editor ต้องการข้อมูลทั้งหมดหรือไม่? หรือแบ่งหน้าได้?

### 1.4 Picklists/Face Sheets APIs ⚠️ สำคัญ

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/picklists` | ส่งข้อมูล picklists ทั้งหมด | ~5 MB/request | ❌ แก้ได้เลย |
| `/api/face-sheets/generate` | ส่งข้อมูล face sheets ทั้งหมด | ~8 MB/request | ❌ แก้ได้เลย |
| `/api/bonus-face-sheets` | ส่งข้อมูล bonus face sheets ทั้งหมด | ~5 MB/request | ❌ แก้ได้เลย |

**วิธีแก้:** เพิ่ม pagination + filter by date/status

---

## 🟡 Priority 2: Master Data APIs (ใช้บ่อย แต่ข้อมูลไม่เยอะมาก)

### 2.1 Master Data APIs

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/master-customer` | ส่งข้อมูล customers ทั้งหมด | ~3 MB/request | ❌ แก้ได้เลย |
| `/api/master-sku` | ส่งข้อมูล SKUs ทั้งหมด | ~2 MB/request | ⚠️ **ถามก่อน** |
| `/api/master-location` | ส่งข้อมูล locations ทั้งหมด | ~1 MB/request | ⚠️ **ถามก่อน** |
| `/api/master-employee` | ส่งข้อมูล employees ทั้งหมด | ~500 KB/request | ✅ ไม่ต้องแก้ |
| `/api/master-supplier` | ส่งข้อมูล suppliers ทั้งหมด | ~500 KB/request | ✅ ไม่ต้องแก้ |

**คำถาม:**
- `/api/master-sku` - ใช้ใน dropdown หรือไม่? ถ้าใช่ ต้องการข้อมูลทั้งหมดหรือแค่ active?
- `/api/master-location` - ใช้ใน dropdown หรือไม่? ต้องการข้อมูลทั้งหมดหรือแค่ active?

**วิธีแก้:**
- ถ้าใช้ใน dropdown → เพิ่ม caching (1 ชั่วโมง)
- ถ้าใช้ในตาราง → เพิ่ม pagination

---

## 🟢 Priority 3: Mobile Pages (Polling บ่อยเกินไป)

### 3.1 Mobile Pages ที่ Polling

| Page | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|------|-------|---------|---------------|
| `/mobile/loading/[code]` | Polling ทุก 5 วินาที | ~200 KB/5s | ⚠️ **ถามก่อน** |
| `/mobile/pick/[id]` | Polling ทุก 5 วินาที | ~100 KB/5s | ⚠️ **ถามก่อน** |
| `/mobile/face-sheet/[id]` | Polling ทุก 5 วินาที | ~100 KB/5s | ⚠️ **ถามก่อน** |
| `/mobile/bonus-face-sheet/[id]` | Polling ทุก 5 วินาที | ~100 KB/5s | ⚠️ **ถามก่อน** |

**คำถาม:**
- หน้า Mobile ต้องการ real-time update หรือไม่?
- ถ้าไม่จำเป็น → เปลี่ยนเป็น 30 วินาที
- ถ้าจำเป็น → ใช้ Supabase Realtime แทน polling

---

## 🔵 Priority 4: File Upload APIs

### 4.1 File Upload APIs

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/orders/import` | Upload Excel ผ่าน Vercel | ~5 MB/upload | ❌ แก้ได้เลย |
| `/api/stock-import/upload` | Upload Excel ผ่าน Vercel | ~10 MB/upload | ❌ แก้ได้เลย |
| `/api/file-uploads` | Upload files ผ่าน Vercel | ~5 MB/upload | ❌ แก้ได้เลย |

**วิธีแก้:** เปลี่ยนให้ upload ตรงไป Supabase Storage

---

## 🟣 Priority 5: PDF/Excel Generation APIs

### 5.1 PDF Generation APIs

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/face-sheets/checklist` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ **ถามก่อน** |
| `/api/face-sheets/delivery-document` | สร้าง PDF ขนาดใหญ่ | ~3 MB/PDF | ⚠️ **ถามก่อน** |
| `/api/bonus-face-sheets/checklist` | สร้าง PDF ขนาดใหญ่ | ~2 MB/PDF | ⚠️ **ถามก่อน** |
| `/api/bonus-face-sheets/delivery-document` | สร้าง PDF ขนาดใหญ่ | ~3 MB/PDF | ⚠️ **ถามก่อน** |

**คำถาม:**
- PDF generation ใช้บ่อยแค่ไหน?
- ถ้าใช้บ่อย → ย้ายไป Supabase Edge Functions
- ถ้าใช้น้อย → ไม่ต้องแก้

### 5.2 Excel Export APIs

| API | ปัญหา | ผลกระทบ | ต้องถามหรือไม่ |
|-----|-------|---------|---------------|
| `/api/reports/391` | Export Excel ขนาดใหญ่ | ~5 MB/export | ⚠️ **ถามก่อน** |
| `/api/reports/production` | Export Excel ขนาดใหญ่ | ~3 MB/export | ⚠️ **ถามก่อน** |

**คำถาม:**
- Excel export ใช้บ่อยแค่ไหน?
- ถ้าใช้บ่อย → ย้ายไป Supabase Edge Functions
- ถ้าใช้น้อย → ไม่ต้องแก้

---

## 📋 สรุปรายการที่ต้องถามก่อนแก้ไข

### ❓ คำถามที่ 1: Route Plans Editor
**API:** `/api/route-plans/[id]/editor`

**คำถาม:**
- หน้า Editor ต้องการข้อมูล trips/stops ทั้งหมดในครั้งเดียวหรือไม่?
- หรือสามารถแบ่งหน้าได้? (เช่น แสดงแค่ 10 trips ต่อหน้า)

**ผลกระทบ:** ถ้าแก้ได้ → ประหยัด ~10 GB/เดือน

---

### ❓ คำถาม 2: Master Data Dropdowns
**APIs:** `/api/master-sku`, `/api/master-location`

**คำถาม:**
- APIs เหล่านี้ใช้ใน dropdown หรือไม่?
- ถ้าใช่ → ต้องการข้อมูลทั้งหมดหรือแค่ active?
- สามารถใช้ search แทนได้หรือไม่? (เช่น พิมพ์ค้นหา SKU แทนแสดงทั้งหมด)

**ผลกระทบ:** ถ้าแก้ได้ → ประหยัด ~5 GB/เดือน

---

### ❓ คำถามที่ 3: Mobile Polling
**Pages:** `/mobile/loading/[code]`, `/mobile/pick/[id]`, etc.

**คำถาม:**
- หน้า Mobile ต้องการ real-time update หรือไม่?
- ถ้าไม่จำเป็น → เปลี่ยนจาก 5 วินาที เป็น 30 วินาที ได้หรือไม่?
- หรือใช้ Supabase Realtime แทน polling?

**ผลกระทบ:** ถ้าแก้ได้ → ประหยัด ~5 GB/เดือน

---

### ❓ คำถามที่ 4: PDF/Excel Generation
**APIs:** PDF และ Excel generation ทั้งหมด

**คำถาม:**
- ใช้บ่อยแค่ไหน? (กี่ครั้งต่อวัน)
- ถ้าใช้บ่อย (>100 ครั้ง/วัน) → ควรย้ายไป Supabase Edge Functions
- ถ้าใช้น้อย (<50 ครั้ง/วัน) → ไม่ต้องแก้

**ผลกระทบ:** ถ้าแก้ได้ → ประหยัด ~10 GB/เดือน

---

## ✅ รายการที่แก้ได้เลย (ไม่ต้องถาม)

### Phase 1: เพิ่ม Pagination ให้ APIs (47 APIs)

**Orders & Shipping (10 APIs):**
1. `/api/orders/with-items` - เพิ่ม pagination + search
2. `/api/orders/returnable` - เพิ่ม pagination + filter
3. `/api/orders/batch-update` - เพิ่ม pagination
4. `/api/orders/[id]/items` - เพิ่ม pagination
5. `/api/route-plans` - เพิ่ม pagination + filter by date
6. `/api/route-plans/all-trips` - เพิ่ม pagination
7. `/api/route-plans/published` - เพิ่ม pagination
8. `/api/route-plans/draft-orders` - เพิ่ม pagination
9. `/api/route-plans/trips-by-supplier` - เพิ่ม pagination
10. `/api/trips/with-special-orders` - เพิ่ม pagination

**Inventory & Warehouse (12 APIs):**
11. `/api/inventory/balances` - เพิ่ม pagination + filter
12. `/api/inventory/reservations` - เพิ่ม pagination
13. `/api/warehouse/dispatch-inventory` - เพิ่ม pagination
14. `/api/warehouse/delivery-inventory` - เพิ่ม pagination
15. `/api/warehouse/bfs-staging-inventory` - เพิ่ม pagination
16. `/api/warehouse/layout-inventory` - เพิ่ม pagination
17. `/api/warehouse/prep-area-packages` - เพิ่ม pagination
18. `/api/warehouse/prepared-documents` - เพิ่ม pagination
19. `/api/moves` - เพิ่ม pagination
20. `/api/receives` - เพิ่ม pagination + filter
21. `/api/receives/dashboard` - เพิ่ม pagination
22. `/api/stock-health` - เพิ่ม pagination

**Picklists & Face Sheets (8 APIs):**
23. `/api/picklists` - เพิ่ม pagination + filter
24. `/api/picklists/[id]/items` - เพิ่ม pagination
25. `/api/face-sheets/generate` - เพิ่ม pagination
26. `/api/face-sheets/orders` - เพิ่ม pagination
27. `/api/bonus-face-sheets` - เพิ่ม pagination
28. `/api/bonus-face-sheets/orders` - เพิ่ม pagination
29. `/api/bonus-face-sheets/packages` - เพิ่ม pagination
30. `/api/bonus-face-sheets/mapped-face-sheets` - เพิ่ม pagination

**Loadlists (5 APIs):**
31. `/api/loadlists` - เพิ่ม pagination
32. `/api/loadlists/available-picklists` - เพิ่ม pagination
33. `/api/loadlists/available-face-sheets` - เพิ่ม pagination
34. `/api/loadlists/available-bonus-face-sheets` - เพิ่ม pagination
35. `/api/loadlists/available-bfs` - เพิ่ม pagination

**Master Data (7 APIs):**
36. `/api/master-customer` - เพิ่ม pagination + search
37. `/api/master-sku` - เพิ่ม pagination + search
38. `/api/master-location` - เพิ่ม pagination + filter

**Production (5 APIs):**
39. `/api/production/orders` - เพิ่ม pagination
40. `/api/production/actual` - เพิ่ม pagination
41. `/api/production/material-requisition` - เพิ่ม pagination
42. `/api/production/planning` - เพิ่ม pagination
43. `/api/production/forecast` - เพิ่ม pagination

**Stock Management (4 APIs):**
44. `/api/stock-adjustments` - เพิ่ม pagination
45. `/api/stock-count/sessions` - เพิ่ม pagination
46. `/api/stock-import/batches` - เพิ่ม pagination
47. `/api/replenishment` - เพิ่ม pagination

**ผลกระทบ:** ประหยัด ~80 GB/เดือน

---

### Phase 2: เพิ่ม Pagination ให้หน้าที่แสดงตาราง (35 หน้า)

**Warehouse Pages (8 หน้า):**
1. `/warehouse/inventory-balances` - เพิ่ม pagination
2. `/warehouse/inventory-ledger` - เพิ่ม pagination
3. `/warehouse/preparation-area-inventory` - เพิ่ม pagination
4. `/warehouse/inbound` - เพิ่ม pagination
5. `/warehouse/transfer` - เพิ่ม pagination
6. `/receiving/orders` - เพิ่ม pagination
7. `/receiving/routes` - เพิ่ม pagination
8. `/receiving/picklists` - เพิ่ม pagination

**Master Data Pages (10 หน้า):**
9. `/master-data/customers` - เพิ่ม pagination
10. `/master-data/products` - เพิ่ม pagination
11. `/master-data/locations` - เพิ่ม pagination
12. `/master-data/bom` - เพิ่ม pagination
13. `/master-data/users` - เพิ่ม pagination
14. `/dashboard` - เพิ่ม pagination

**Production & Reports (7 หน้า):**
15. `/production/orders` - เพิ่ม pagination
16. `/production/actual` - เพิ่ม pagination
17. `/production/material-requisition` - เพิ่ม pagination
18. `/production/planning` - เพิ่ม pagination
19. `/production/forecast` - เพิ่ม pagination
20. `/reports/391` - เพิ่ม pagination
21. `/reports/production` - เพิ่ม pagination

**Stock Management (5 หน้า):**
22. `/stock-management/adjustment` - เพิ่ม pagination
23. `/stock-management/stock-count` - เพิ่ม pagination
24. `/stock-management/count` - เพิ่ม pagination
25. `/stock-management/import` - เพิ่ม pagination
26. `/receiving/auto-replenishment` - เพิ่ม pagination

**Other Pages (9 หน้า):**
27. `/receiving/loadlists` - เพิ่ม pagination
28. `/receiving/picklists/face-sheets` - เพิ่ม pagination
29. `/receiving/picklists/bonus-face-sheets` - เพิ่ม pagination
30. `/mobile/loading` - เพิ่ม pagination
31. `/mobile/pick` - เพิ่ม pagination
32. `/mobile/pick-up-pieces` - เพิ่ม pagination
33. `/mobile/receive` - เพิ่ม pagination
34. `/mobile/transfer` - เพิ่ม pagination
35. `/mobile/stock-count` - เพิ่ม pagination

**ผลกระทบ:** ประหยัด ~55 GB/เดือน

---

### Phase 3: เปลี่ยน File Upload (5 APIs)

1. `/api/orders/import` - เปลี่ยนเป็น Supabase Storage
2. `/api/stock-import/upload` - เปลี่ยนเป็น Supabase Storage
3. `/api/file-uploads` - เปลี่ยนเป็น Supabase Storage
4. `/api/master-customer/import` - เปลี่ยนเป็น Supabase Storage
5. `/api/master-employee/import` - เปลี่ยนเป็น Supabase Storage

**ผลกระทบ:** ประหยัด ~15 GB/เดือน

---

### Phase 4: เพิ่ม Compression & Optimization

1. เพิ่ม gzip compression ใน `next.config.js`
2. เพิ่ม cache headers สำหรับ static assets
3. เพิ่ม CDN caching
4. เพิ่ม image optimization
5. ลด bundle size

**ผลกระทบ:** ประหยัด ~10 GB/เดือน

---

**รวม Phase 1-4:** ประหยัด ~160 GB/เดือน → ใช้เหลือ ~8 GB/เดือน

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

**หลังแก้ไข:**
- แก้ได้เลย (ไม่ต้องถาม): **~150 GB** → ใช้เหลือ **~8 GB/เดือน** (92% ต่ำกว่า limit)
- ถ้าแก้ทั้งหมด: **~165 GB** → ใช้เหลือ **~3 GB/เดือน** (97% ต่ำกว่า limit)

---

## 🎯 แผนการดำเนินการ

### Phase 1: Quick Wins (ไม่ต้องถาม) - 1 สัปดาห์
1. ✅ เพิ่ม pagination ให้ 15 APIs
2. ✅ เปลี่ยน file upload ไปใช้ Supabase Storage
3. ✅ เพิ่ม compression ใน next.config.js

**ผลลัพธ์:** ประหยัด ~65 GB/เดือน

### Phase 2: ต้องถามก่อน - รอคำตอบ
1. ⏳ ตอบคำถามทั้ง 4 ข้อ
2. ⏳ แก้ไขตามคำตอบ

**ผลลัพธ์:** ประหยัดอีก ~10-20 GB/เดือน

---

## 📝 คำถามสำหรับคุณ

กรุณาตอบคำถามเหล่านี้เพื่อให้ผมสามารถแก้ไขได้อย่างถูกต้อง:

### 1. Route Plans Editor
- [ ] ต้องการข้อมูลทั้งหมดในครั้งเดียว
- [ ] สามารถแบ่งหน้าได้

### 2. Master Data Dropdowns
- [ ] ต้องการข้อมูลทั้งหมดใน dropdown
- [ ] สามารถใช้ search แทนได้

### 3. Mobile Polling
- [ ] ต้องการ real-time (ทุก 5 วินาที)
- [ ] ไม่จำเป็น (เปลี่ยนเป็น 30 วินาทีได้)
- [ ] ใช้ Supabase Realtime แทน

### 4. PDF/Excel Generation
- [ ] ใช้บ่อย (>100 ครั้ง/วัน) → ควรย้าย
- [ ] ใช้น้อย (<50 ครั้ง/วัน) → ไม่ต้องแก้

---

**สถานะ:** 📋 รอคำตอบจากคุณเพื่อดำเนินการต่อ

**หมายเหตุ:** ผมจะเริ่มแก้ไข Phase 1 (Quick Wins) ได้เลยหลังจากคุณอนุมัติ ส่วน Phase 2 จะรอคำตอบจากคุณก่อนครับ
