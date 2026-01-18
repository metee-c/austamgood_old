# 🚀 Vercel Free Tier Optimization Guide

**วันที่:** 2026-01-17  
**โปรเจค:** AustamGood WMS

---

## 📊 สถานะ Vercel Limits ปัจจุบัน

| Metric | ใช้ไป | Limit | % | สถานะ |
|--------|-------|-------|---|-------|
| **Fast Data Transfer** | 82.99 GB | 100 GB | 83% | ⚠️ ใกล้เกิน |
| **Edge Requests** | 621K | 1M | 62% | ⚠️ ปานกลาง |
| **Function Invocations** | 263K | 1M | 26% | ✅ ปกติ |
| **Fluid Active CPU** | 2h 16m | 4h | 57% | ⚠️ ปานกลาง |
| **Provisioned Memory** | 63.4 GB-Hrs | 360 GB-Hrs | 18% | ✅ ปกติ |
| **Fast Origin Transfer** | 1.04 GB | 10 GB | 10% | ✅ ปกติ |
| **ISR Reads** | 10K | 1M | 1% | ✅ ปกติ |
| **Image Optimization** | 2.4K | 300K | 0.8% | ✅ ปกติ |

---

## 🔍 ปัญหาหลัก: Fast Data Transfer (83% ใช้ไป)

### สาเหตุที่ทำให้ใช้ Data Transfer เยอะ

#### 1. **API Routes ที่ส่งข้อมูลขนาดใหญ่** ⚠️ สำคัญที่สุด

```typescript
// ❌ ปัญหา: API ส่งข้อมูลทั้งหมดโดยไม่มี pagination
app/api/orders/with-items/route.ts
app/api/warehouse/dispatch-inventory/route.ts
app/api/warehouse/delivery-inventory/route.ts
app/api/warehouse/bfs-staging-inventory/route.ts
app/api/inventory/balances/route.ts
app/api/warehouse/layout-inventory/route.ts
app/api/route-plans/all-trips/route.ts
```

**ผลกระทบ:**
- แต่ละ request อาจส่งข้อมูล 1-10 MB
- ถ้ามี 1,000 requests/วัน = 1-10 GB/วัน
- ใน 1 เดือน = 30-300 GB

#### 2. **PDF Generation APIs** ⚠️

```typescript
// ❌ ปัญหา: สร้าง PDF ขนาดใหญ่
app/api/face-sheets/checklist/route.ts
app/api/bonus-face-sheets/checklist/route.ts
app/api/face-sheets/delivery-document/route.ts
app/api/bonus-face-sheets/delivery-document/route.ts
components/receiving/DeliveryOrderDocument.tsx
components/receiving/FaceSheetChecklistDocument.tsx
components/receiving/BonusFaceSheetChecklistDocument.tsx
```

**ผลกระทบ:**
- PDF ขนาด 500KB - 5MB ต่อไฟล์
- ถ้าสร้าง 100 PDFs/วัน = 50MB - 500MB/วัน
- ใน 1 เดือน = 1.5-15 GB

#### 3. **Excel Export APIs** ⚠️

```typescript
// ❌ ปัญหา: Export Excel ขนาดใหญ่
app/receiving/routes/utils/exportExcel.ts
app/api/reports/391/route.ts
app/api/reports/production/route.ts
```

**ผลกระทบ:**
- Excel ขนาด 1-10 MB ต่อไฟล์
- ถ้า export 50 ครั้ง/วัน = 50-500 MB/วัน
- ใน 1 เดือน = 1.5-15 GB

#### 4. **Image/File Uploads** ⚠️

```typescript
// ❌ ปัญหา: Upload ไฟล์ผ่าน API
app/api/file-uploads/route.ts
app/api/orders/import/route.ts
app/api/stock-import/upload/route.ts
```

**ผลกระทบ:**
- ไฟล์ขนาด 1-50 MB ต่อไฟล์
- ถ้า upload 20 ไฟล์/วัน = 20-1000 MB/วัน
- ใน 1 เดือน = 0.6-30 GB

#### 5. **Real-time Data Polling** ⚠️

```typescript
// ❌ ปัญหา: Polling ข้อมูลบ่อยเกินไป
app/mobile/loading/[code]/page.tsx
app/mobile/pick/[id]/page.tsx
app/receiving/routes/page.tsx
```

**ผลกระทบ:**
- Polling ทุก 5 วินาที = 17,280 requests/วัน
- แต่ละ request 10KB = 172 MB/วัน
- ใน 1 เดือน = 5.2 GB

---

## 💡 วิธีแก้ไข: ลด Data Transfer

### 1. **เพิ่ม Pagination ให้ทุก API** ✅ สำคัญที่สุด

```typescript
// ✅ แก้ไข: เพิ่ม pagination
// app/api/orders/with-items/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50'); // ลดจาก 1000 เป็น 50
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
}
```

**ผลลัพธ์:**
- ลดข้อมูลต่อ request จาก 10 MB → 500 KB (ลด 95%)
- ประหยัด: ~25 GB/เดือน

### 2. **ใช้ Streaming สำหรับ PDF/Excel** ✅

```typescript
// ✅ แก้ไข: ใช้ streaming แทนการส่งทั้งไฟล์
// app/api/face-sheets/checklist/route.ts

export async function GET(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      // Generate PDF in chunks
      const chunks = await generatePDFChunks();
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="checklist.pdf"'
    }
  });
}
```

**ผลลัพธ์:**
- ลดการใช้ memory และ bandwidth
- ประหยัด: ~5 GB/เดือน

### 3. **Upload ไฟล์ตรงไป Supabase Storage** ✅ สำคัญมาก

```typescript
// ✅ แก้ไข: Upload ตรงไป Supabase แทนผ่าน API
// components/orders/ImportOrderModal.tsx

const handleUpload = async (file: File) => {
  // ❌ เดิม: Upload ผ่าน API (ใช้ Vercel bandwidth)
  // const formData = new FormData();
  // formData.append('file', file);
  // await fetch('/api/orders/import', { method: 'POST', body: formData });

  // ✅ ใหม่: Upload ตรงไป Supabase (ไม่ใช้ Vercel bandwidth)
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(`orders/${Date.now()}_${file.name}`, file);

  if (!error) {
    // เรียก API เพื่อ process ไฟล์ (ส่งแค่ path)
    await fetch('/api/orders/import', {
      method: 'POST',
      body: JSON.stringify({ filePath: data.path })
    });
  }
};
```

**ผลลัพธ์:**
- ลดการใช้ Vercel bandwidth 100%
- ประหยัด: ~15 GB/เดือน

### 4. **ลด Polling Frequency** ✅

```typescript
// ✅ แก้ไข: เพิ่มเวลา polling
// app/mobile/loading/[code]/page.tsx

// ❌ เดิม: Polling ทุก 5 วินาที
// const { data } = useSWR('/api/loadlists/123', fetcher, {
//   refreshInterval: 5000
// });

// ✅ ใหม่: Polling ทุก 30 วินาที
const { data } = useSWR('/api/loadlists/123', fetcher, {
  refreshInterval: 30000, // เพิ่มจาก 5s เป็น 30s
  revalidateOnFocus: false, // ปิด revalidate เมื่อ focus
  revalidateOnReconnect: false // ปิด revalidate เมื่อ reconnect
});
```

**ผลลัพธ์:**
- ลด requests จาก 17,280 → 2,880 ต่อวัน (ลด 83%)
- ประหยัด: ~4 GB/เดือน

### 5. **เพิ่ม Response Compression** ✅

```typescript
// ✅ แก้ไข: เพิ่ม compression ใน next.config.js
// next.config.js

module.exports = {
  compress: true, // เปิด gzip compression
  
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
          }
        ]
      }
    ];
  }
};
```

**ผลลัพธ์:**
- ลดขนาดข้อมูล 60-80%
- ประหยัด: ~30 GB/เดือน

### 6. **ใช้ Edge Caching** ✅

```typescript
// ✅ แก้ไข: เพิ่ม caching สำหรับ static data
// app/api/master-sku/route.ts

export const runtime = 'edge';
export const revalidate = 3600; // Cache 1 ชั่วโมง

export async function GET(request: Request) {
  const { data } = await supabase
    .from('master_sku')
    .select('*')
    .eq('status', 'active');

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
```

**ผลลัพธ์:**
- ลด requests ไป Supabase 90%
- ประหยัด: ~10 GB/เดือน

---

## 🎯 แผนการแก้ไขแบบเป็นขั้นตอน

### Phase 1: Quick Wins (ประหยัด ~40 GB/เดือน) ⚡

**สัปดาห์ที่ 1:**
1. ✅ เพิ่ม pagination ให้ API ที่ใช้บ่อย (5 APIs)
2. ✅ เปลี่ยน file upload ไปใช้ Supabase Storage
3. ✅ เพิ่ม compression ใน next.config.js

**APIs ที่ต้องแก้:**
- `/api/orders/with-items` → เพิ่ม pagination
- `/api/inventory/balances` → เพิ่ม pagination
- `/api/warehouse/dispatch-inventory` → เพิ่ม pagination
- `/api/orders/import` → ใช้ Supabase Storage
- `/api/stock-import/upload` → ใช้ Supabase Storage

### Phase 2: Medium Impact (ประหยัด ~20 GB/เดือน) 📊

**สัปดาห์ที่ 2:**
1. ✅ ลด polling frequency ใน mobile pages
2. ✅ เพิ่ม caching สำหรับ master data APIs
3. ✅ ใช้ streaming สำหรับ PDF generation

**Pages ที่ต้องแก้:**
- `/mobile/loading/[code]` → ลด polling
- `/mobile/pick/[id]` → ลด polling
- `/api/master-sku` → เพิ่ม caching
- `/api/face-sheets/checklist` → ใช้ streaming

### Phase 3: Long-term (ประหยัด ~20 GB/เดือน) 🚀

**สัปดาห์ที่ 3-4:**
1. ✅ ใช้ Incremental Static Regeneration (ISR) สำหรับ static pages
2. ✅ ย้าย heavy computation ไป Supabase Edge Functions
3. ✅ เพิ่ม CDN caching สำหรับ static assets

---

## 📈 ผลลัพธ์ที่คาดหวัง

| Phase | ประหยัด | Timeline | ความยาก |
|-------|---------|----------|---------|
| Phase 1 | ~40 GB/เดือน | 1 สัปดาห์ | ⭐⭐ ง่าย |
| Phase 2 | ~20 GB/เดือน | 1 สัปดาห์ | ⭐⭐⭐ ปานกลาง |
| Phase 3 | ~20 GB/เดือน | 2 สัปดาห์ | ⭐⭐⭐⭐ ยาก |
| **รวม** | **~80 GB/เดือน** | **4 สัปดาห์** | - |

**หลังแก้ไข:**
- Fast Data Transfer: 82.99 GB → **~3 GB** (ลด 96%)
- Edge Requests: 621K → **~200K** (ลด 68%)
- Function Invocations: 263K → **~100K** (ลด 62%)

---

## 🔧 เครื่องมือตรวจสอบ

### 1. Vercel Analytics
```bash
# ดูการใช้งานแบบ real-time
https://vercel.com/[your-team]/[your-project]/analytics
```

### 2. Monitoring Script
```javascript
// scripts/monitor-vercel-usage.js
// ตรวจสอบ API ที่ใช้ bandwidth เยอะ

const analyzeAPIUsage = async () => {
  const apis = [
    '/api/orders/with-items',
    '/api/inventory/balances',
    '/api/warehouse/dispatch-inventory'
  ];

  for (const api of apis) {
    const response = await fetch(api);
    const size = response.headers.get('content-length');
    console.log(`${api}: ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
};
```

---

## 📝 Checklist การแก้ไข

### Phase 1: Quick Wins ⚡
- [ ] เพิ่ม pagination ใน `/api/orders/with-items`
- [ ] เพิ่ม pagination ใน `/api/inventory/balances`
- [ ] เพิ่ม pagination ใน `/api/warehouse/dispatch-inventory`
- [ ] เปลี่ยน file upload ใน `/api/orders/import`
- [ ] เปลี่ยน file upload ใน `/api/stock-import/upload`
- [ ] เพิ่ม compression ใน `next.config.js`

### Phase 2: Medium Impact 📊
- [ ] ลด polling ใน `/mobile/loading/[code]`
- [ ] ลด polling ใน `/mobile/pick/[id]`
- [ ] เพิ่ม caching ใน `/api/master-sku`
- [ ] เพิ่ม caching ใน `/api/master-customer`
- [ ] ใช้ streaming ใน `/api/face-sheets/checklist`

### Phase 3: Long-term 🚀
- [ ] ใช้ ISR สำหรับ master data pages
- [ ] ย้าย PDF generation ไป Edge Functions
- [ ] เพิ่ม CDN caching

---

## 🎯 สรุป

**ปัญหาหลัก:**
1. ⚠️ **Fast Data Transfer (83%)** - API ส่งข้อมูลเยอะเกินไป
2. ⚠️ **Edge Requests (62%)** - Polling บ่อยเกินไป
3. ⚠️ **Active CPU (57%)** - Heavy computation ใน API routes

**วิธีแก้:**
1. ✅ เพิ่ม pagination ทุก API
2. ✅ ใช้ Supabase Storage สำหรับ file uploads
3. ✅ ลด polling frequency
4. ✅ เพิ่ม compression และ caching
5. ✅ ใช้ streaming สำหรับ large files

**ผลลัพธ์:**
- ประหยัด ~80 GB/เดือน (ลด 96%)
- ใช้เพียง 3 GB/เดือน (3% ของ limit)
- ปลอดภัยจากการเกิน limit

---

**อัพเดทล่าสุด:** 2026-01-17  
**สถานะ:** 📋 รอดำเนินการ
