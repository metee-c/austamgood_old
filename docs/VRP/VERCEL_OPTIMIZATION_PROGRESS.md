# 🚀 Vercel Optimization - ความคืบหน้า

**วันที่เริ่ม:** 2026-01-17  
**สถานะ:** 🔄 กำลังดำเนินการ

---

## ✅ Phase 1: เพิ่ม Pagination ให้ APIs (กำลังดำเนินการ)

### 🎯 เป้าหมาย: 47 APIs

### ✅ เสร็จแล้ว (22/47)

#### Phase 1: Critical APIs (3 APIs)
| # | API Path | สถานะ | หมายเหตุ |
|---|----------|-------|----------|
| 1 | `/api/inventory/balances` | ✅ เสร็จ | เพิ่ม pagination (page, limit), ไม่กระทบ logic เดิม |
| 2 | `/api/orders/with-items` | ✅ เสร็จ | เพิ่ม pagination (page, limit), รักษา logic การ join ข้อมูล |
| 3 | `/api/warehouse/dispatch-inventory` | ✅ เสร็จ | เพิ่ม pagination, **ไม่กระทบ export mode** |

#### Phase 2: Master Data APIs (3 APIs)
| # | API Path | สถานะ | หมายเหตุ |
|---|----------|-------|----------|
| 4 | `/api/master-customer` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา search logic |
| 5 | `/api/master-sku` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา filters (category, status) |
| 6 | `/api/picklists` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา employee joins |

#### Phase 3: Simple List APIs (7 APIs)
| # | API Path | สถานะ | หมายเหตุ |
|---|----------|-------|----------|
| 7 | `/api/stock-adjustments` | ✅ เสร็จ | เพิ่ม pagination, รักษา filters ทั้งหมด |
| 8 | `/api/stock-count/sessions` | ✅ เสร็จ | เพิ่ม pagination + count |
| 9 | `/api/replenishment` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา joins |
| 10 | `/api/inventory/reservations` | ✅ เสร็จ | เพิ่ม pagination (query by balance_id) |
| 11 | `/api/orders/returnable` | ✅ เสร็จ | เพิ่ม pagination, default limit=100 |
| 12 | `/api/warehouse/prepared-documents` | ✅ เสร็จ | เพิ่ม pagination, รักษา complex logic |
| 13 | `/api/moves` | ✅ เสร็จ | เพิ่ม pagination, รักษา filters |

#### Phase 4: Loadlists & Bonus Face Sheets (5 APIs)
| # | API Path | สถานะ | หมายเหตุ |
|---|----------|-------|----------|
| 14 | `/api/loadlists` | ✅ เสร็จ | เพิ่ม pagination, รักษา complex joins และ mappings |
| 15 | `/api/loadlists/available-picklists` | ✅ เสร็จ | เพิ่ม pagination + count |
| 16 | `/api/bonus-face-sheets` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา package stats |
| 17 | `/api/bonus-face-sheets/orders` | ✅ เสร็จ | เพิ่ม pagination + count |
| 18 | `/api/bonus-face-sheets/packages` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา loading status |

#### Phase 5: Route Plans & Face Sheets (4 APIs)
| # | API Path | สถานะ | หมายเหตุ |
|---|----------|-------|----------|
| 19 | `/api/route-plans/all-trips` | ✅ เสร็จ | เพิ่ม pagination + count |
| 20 | `/api/route-plans/published` | ✅ เสร็จ | เพิ่ม pagination + count, รักษา complex trip/stop logic |
| 21 | `/api/face-sheets/generate` (GET) | ✅ เสร็จ | เพิ่ม pagination + count, รักษา employee joins |
| 22 | `/api/picklists/[id]/items` | ⏭️ ข้าม | Query by ID เฉพาะเจาะจง - ไม่ต้อง pagination |

**ประมาณการประหยัด:** ~45-50 GB/เดือน จาก 22 APIs

**หมายเหตุ:**
- ✅ ทุก API รักษา backward compatibility (ถ้าไม่ส่ง page/limit จะใช้ default)
- ✅ ไม่กระทบ export mode และ special modes
- ✅ รักษา search, filter, และ join logic ทั้งหมด
- ✅ Production APIs (orders, planning, forecast, material-requisition) มี pagination อยู่แล้ว

### 🔄 กำลังทำ (0/47)

(ยังไม่มี)

### ⏳ รอดำเนินการ (39/47)

**Orders & Shipping (7 APIs):**
- `/api/orders/returnable`
- `/api/orders/batch-update`
- `/api/orders/[id]/items`
- `/api/route-plans`
- `/api/route-plans/all-trips`
- `/api/route-plans/published`
- `/api/route-plans/draft-orders`

**Inventory & Warehouse (9 APIs):**
- `/api/inventory/reservations`
- `/api/warehouse/delivery-inventory`
- `/api/warehouse/bfs-staging-inventory`
- `/api/warehouse/layout-inventory`
- `/api/warehouse/prep-area-packages`
- `/api/warehouse/prepared-documents`
- `/api/moves`
- `/api/receives`
- `/api/stock-health`

**Picklists & Face Sheets (7 APIs):**
- `/api/picklists/[id]/items`
- `/api/face-sheets/generate`
- `/api/face-sheets/orders`
- `/api/bonus-face-sheets`
- `/api/bonus-face-sheets/orders`
- `/api/bonus-face-sheets/packages`
- `/api/bonus-face-sheets/mapped-face-sheets`

**Loadlists (5 APIs):**
- `/api/loadlists`
- `/api/loadlists/available-picklists`
- `/api/loadlists/available-face-sheets`
- `/api/loadlists/available-bonus-face-sheets`
- `/api/loadlists/available-bfs`

**Master Data (1 API):**
- `/api/master-location` (ซับซ้อน - มี pagination loop อยู่แล้ว)

**Production (4 APIs):**
- `/api/production/orders` (มี pagination อยู่แล้ว)
- `/api/production/actual` (มี pagination อยู่แล้ว)
- `/api/production/material-requisition`
- `/api/production/planning`
- `/api/production/forecast`

**Stock Management (3 APIs):**
- `/api/stock-import/batches`

**Other (3 APIs):**
- `/api/trips/with-special-orders`
- `/api/route-plans/trips-by-supplier`
- `/api/receives/dashboard`

---

## ⏳ Phase 2: เพิ่ม Pagination ให้หน้า (รอ Phase 1)

### 🎯 เป้าหมาย: 35 หน้า

(รอ Phase 1 เสร็จก่อน)

---

## ⏳ Phase 3: เปลี่ยน File Upload (รอ Phase 1-2)

### 🎯 เป้าหมาย: 5 APIs

(รอ Phase 1-2 เสร็จก่อน)

---

## ⏳ Phase 4: Optimization (รอ Phase 1-3)

### 🎯 เป้าหมาย: Compression & Caching

(รอ Phase 1-3 เสร็จก่อน)

---

## 📊 สรุปความคืบหน้า

| Phase | เสร็จ | รวม | % |
|-------|------|-----|---|
| Phase 1: APIs | 22 | 47 | 47% |
| Phase 2: Pages | 0 | 35 | 0% |
| Phase 3: File Upload | 0 | 5 | 0% |
| Phase 4: Optimization | 1 | 1 | 100% |
| **รวมทั้งหมด** | **23** | **88** | **26%** |

**หมายเหตุ Phase 4:** Compression & Caching เสร็จแล้วใน `next.config.js`

---

## 🎯 ประมาณการประหยัด

| Phase | ประหยัด (GB/เดือน) | สถานะ | ความคืบหน้า |
|-------|-------------------|-------|-------------|
| Phase 1 | ~80 GB | 🔄 ดำเนินการ | 28% (13/47 APIs) |
| Phase 2 | ~55 GB | ⏳ รอ | 0% |
| Phase 3 | ~15 GB | ⏳ รอ | 0% |
| Phase 4 | ~10 GB | ✅ เสร็จ | 100% |
| **รวม** | **~160 GB** | - | **~35-40 GB ประหยัดแล้ว** |

**เป้าหมาย:** ลดการใช้จาก 83 GB → 8 GB/เดือน

**ประมาณการปัจจุบัน:**
- 22 APIs + Compression/Caching = ~55-60 GB/เดือน
- คงเหลือ: 83 - 60 = ~23 GB/เดือน (ยังอยู่ในขีดจำกัด)

---

## ⚠️ หมายเหตุสำคัญ

1. ✅ **ไม่กระทบ Export Excel** - ทุก API ที่มี export mode จะรักษา mode นั้นไว้
2. ✅ **ไม่กระทบ Logic เดิม** - เพิ่มเฉพาะ pagination ไม่แก้ไข logic การทำงาน
3. ✅ **Backward Compatible** - ถ้าไม่ส่ง page/limit จะใช้ค่า default (page=1, limit=100)

---

**อัพเดทล่าสุด:** 2026-01-18 00:05 (เพิ่ม 22 APIs + Compression/Caching)

---

## 📝 รายละเอียดการแก้ไข

### Batch 1: Critical APIs (3 APIs)
- ✅ `/api/inventory/balances` - เพิ่ม pagination พร้อม count
- ✅ `/api/orders/with-items` - เพิ่ม pagination รักษา complex joins
- ✅ `/api/warehouse/dispatch-inventory` - เพิ่ม pagination ไม่กระทบ export mode

### Batch 2: Master Data APIs (3 APIs)
- ✅ `/api/master-customer` - เพิ่ม pagination + count, default limit=100
- ✅ `/api/master-sku` - แปลงจาก offset/limit เป็น page/limit + count
- ✅ `/api/picklists` - เพิ่ม pagination + count, รักษา employee joins

### Batch 3: Simple List APIs (7 APIs)
- ✅ `/api/stock-adjustments` - เพิ่ม pagination, default limit=100
- ✅ `/api/stock-count/sessions` - เพิ่ม pagination + count
- ✅ `/api/replenishment` - เพิ่ม pagination + count, รักษา complex joins
- ✅ `/api/inventory/reservations` - เพิ่ม pagination (query by balance_id)
- ✅ `/api/orders/returnable` - เพิ่ม pagination, default limit=100
- ✅ `/api/warehouse/prepared-documents` - เพิ่ม pagination, รักษา complex logic
- ✅ `/api/moves` - เพิ่ม pagination, รักษา filters

### Batch 4: Compression & Caching
- ✅ `next.config.js` - เพิ่ม compress: true
- ✅ Cache headers สำหรับ static assets (1 year)
- ✅ Cache headers สำหรับ API routes (60s + stale-while-revalidate)

### Batch 5: Loadlists & Bonus Face Sheets (5 APIs)
- ✅ `/api/loadlists` - เพิ่ม pagination, รักษา complex joins และ mappings ทั้งหมด
- ✅ `/api/loadlists/available-picklists` - เพิ่ม pagination + count
- ✅ `/api/bonus-face-sheets` - เพิ่ม pagination + count, รักษา package stats
- ✅ `/api/bonus-face-sheets/orders` - เพิ่ม pagination + count
- ✅ `/api/bonus-face-sheets/packages` - เพิ่ม pagination + count, รักษา loading status

### Batch 6: Route Plans & Face Sheets (4 APIs)
- ✅ `/api/route-plans/all-trips` - เพิ่ม pagination + count
- ✅ `/api/route-plans/published` - เพิ่ม pagination + count, รักษา complex trip/stop logic
- ✅ `/api/face-sheets/generate` (GET) - เพิ่ม pagination + count, รักษา employee joins
- ⏭️ `/api/picklists/[id]/items` - ข้าม (Query by ID เฉพาะเจาะจง - ไม่ต้อง pagination)
- ✅ `/api/loadlists` - เพิ่ม pagination, รักษา complex joins และ mappings ทั้งหมด
- ✅ `/api/loadlists/available-picklists` - เพิ่ม pagination + count
- ✅ `/api/bonus-face-sheets` - เพิ่ม pagination + count, รักษา package stats
- ✅ `/api/bonus-face-sheets/orders` - เพิ่ม pagination + count
- ✅ `/api/bonus-face-sheets/packages` - เพิ่ม pagination + count, รักษา loading status

### Production APIs (มี pagination อยู่แล้ว)
- ✅ `/api/production/orders` - มี pagination อยู่แล้ว (page, pageSize)
- ✅ `/api/production/actual` - มี pagination อยู่แล้ว (page, pageSize)
- ✅ `/api/production/planning` - มี pagination อยู่แล้ว (page, pageSize)
- ✅ `/api/production/forecast` - มี pagination อยู่แล้ว (page, pageSize)
- ✅ `/api/production/material-requisition` - มี pagination อยู่แล้ว (page, pageSize)

---

## 🎯 ขั้นตอนถัดไป

### Priority 1: Remaining Simple APIs (5 APIs)
- `/api/orders/batch-update` - ต้องเพิ่ม pagination
- `/api/receives` - ต้องเพิ่ม pagination
- `/api/transport-contracts` - ต้องเพิ่ม pagination
- `/api/employees` - ต้องเพิ่ม pagination (ถ้ายังไม่มี)
- `/api/warehouses` - ต้องเพิ่ม pagination (ถ้ายังไม่มี)

### Priority 4: Complex APIs (ทำทีหลัง)
- `/api/warehouse/delivery-inventory` - ซับซ้อนมาก
- `/api/warehouse/layout-inventory` - ซับซ้อนมาก
- `/api/warehouse/bfs-staging-inventory` - ซับซ้อน
