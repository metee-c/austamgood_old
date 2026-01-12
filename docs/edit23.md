# ภารกิจ: เพิ่มมุมมองรายละเอียดระดับแพ็คในหน้า Bonus Face Sheets

## ⛔ กฎเหล็ก - ห้ามละเมิดเด็ดขาด

1. **ห้าม** แก้ไข Business Logic ที่ทำงานอยู่แล้ว
2. **ห้าม** เปลี่ยน API Response Format ที่มีอยู่
3. **ห้าม** ลบ/แก้ไขมุมมองเดิม (เพิ่มมุมมองใหม่เท่านั้น)
4. **ต้อง** ตรวจสอบโค้ดและฐานข้อมูลก่อนดำเนินการ
5. **ต้อง** Test ทุกครั้งหลังแก้ไข

---

## 🎯 เป้าหมาย

เพิ่มมุมมองใหม่ในหน้า `/receiving/picklists/bonus-face-sheets` ที่แสดงข้อมูลระดับ **แถวละแพ็ค** แทนที่จะรวมเป็นใบงาน

### มุมมองที่ต้องการ

| มุมมองเดิม | มุมมองใหม่ |
|------------|-----------|
| 1 แถว = 1 ใบงาน BFS | 1 แถว = 1 แพ็ค |
| รวมยอด packages | แสดงแต่ละ package แยก |

---

## Phase 0: ตรวจสอบและทำความเข้าใจ (บังคับทำก่อน!)

### 0.1 ตรวจสอบโค้ดปัจจุบัน
```bash
# หาไฟล์หน้า bonus-face-sheets
find . -name "*.tsx" -path "*bonus-face-sheets*" 2>/dev/null

# ดูโครงสร้างโฟลเดอร์
ls -la app/receiving/picklists/bonus-face-sheets/
```

**สิ่งที่ต้องบันทึก:**
- [ ] ชื่อไฟล์ page.tsx
- [ ] Components ที่ใช้
- [ ] API endpoints ที่เรียก
- [ ] State variables ที่มี
- [ ] ตารางแสดงข้อมูลอย่างไร

### 0.2 ตรวจสอบ API ที่เกี่ยวข้อง
```bash
# หา API bonus-face-sheets
find . -name "route.ts" -path "*bonus-face-sheets*" 2>/dev/null
find . -name "route.ts" -path "*bfs*" 2>/dev/null
```

**สิ่งที่ต้องบันทึก:**
- [ ] API endpoint สำหรับดึงรายการ BFS
- [ ] API endpoint สำหรับดึง packages
- [ ] Response format

### 0.3 ตรวจสอบฐานข้อมูลด้วย MCP (สำคัญมาก!)
```sql
-- 1. ดูตารางที่เกี่ยวข้องกับ Bonus Face Sheets
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%bonus%' OR table_name LIKE '%bfs%'
ORDER BY table_name;

-- 2. ดูโครงสร้างตาราง bonus_face_sheets (หรือชื่อที่ถูกต้อง)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bonus_face_sheets'
ORDER BY ordinal_position;

-- 3. ดูโครงสร้างตาราง packages (ถ้ามี)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name LIKE '%bfs%package%' OR table_name LIKE '%bonus%package%'
ORDER BY table_name, ordinal_position;

-- 4. ดูความสัมพันธ์ระหว่างตาราง
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%bonus%' OR tc.table_name LIKE '%bfs%');

-- 5. ดูตัวอย่างข้อมูล BFS
SELECT * FROM bonus_face_sheets LIMIT 5;

-- 6. ดูตัวอย่างข้อมูล packages
SELECT * FROM bfs_packages LIMIT 10; -- หรือชื่อตารางที่ถูกต้อง

-- 7. นับจำนวน packages ต่อ BFS
SELECT 
  bfs_id,
  COUNT(*) as package_count
FROM bfs_packages -- หรือชื่อตารางที่ถูกต้อง
GROUP BY bfs_id
LIMIT 10;
```

**สิ่งที่ต้องบันทึก:**
- [ ] ชื่อตาราง BFS หลัก: _______________
- [ ] ชื่อตาราง packages: _______________
- [ ] Primary Key ของ BFS: _______________
- [ ] Foreign Key ที่เชื่อม: _______________
- [ ] Columns ที่ต้องแสดงในมุมมองแพ็ค:
  - [ ] รหัส BFS: _______________
  - [ ] เลขแพ็ค: _______________
  - [ ] ชื่อร้าน/ลูกค้า: _______________
  - [ ] SKU: _______________
  - [ ] จำนวน: _______________
  - [ ] น้ำหนัก: _______________
  - [ ] สถานะ: _______________

---

## Phase 1: วิเคราะห์และออกแบบ

### 1.1 สรุปโครงสร้างข้อมูลที่พบ

หลังจากตรวจสอบแล้ว กรอกข้อมูล:
```
ตาราง BFS หลัก: [ชื่อตาราง]
├── [pk_column] (PK)
├── [bfs_code]
├── [customer_id]
├── [status]
└── ...

ตาราง Packages: [ชื่อตาราง]
├── [pk_column] (PK)
├── [bfs_id] (FK → BFS)
├── [package_no]
├── [sku_id]
├── [quantity]
├── [weight]
└── ...
```

### 1.2 ออกแบบ UI มุมมองใหม่
```
┌─────────────────────────────────────────────────────────────────┐
│  Bonus Face Sheets                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [มุมมองใบงาน] [มุมมองแพ็ค]  ← Toggle buttons                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ มุมมองแพ็ค (Package View)                                    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ รหัส BFS │ แพ็ค │ ร้าน │ SKU │ ชื่อสินค้า │ จำนวน │ สถานะ   ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ BFS-001 │  1   │ A    │ S1  │ สินค้า 1  │  10  │ รอหยิบ   ││
│  │ BFS-001 │  2   │ A    │ S2  │ สินค้า 2  │   5  │ รอหยิบ   ││
│  │ BFS-002 │  1   │ B    │ S1  │ สินค้า 1  │   8  │ หยิบแล้ว ││
│  │ ...     │ ...  │ ...  │ ... │ ...       │ ...  │ ...      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 2: สร้าง API (ถ้าจำเป็น)

### 2.1 ตรวจสอบว่า API เดิมรองรับหรือไม่

ถ้า API เดิมสามารถดึง packages ได้อยู่แล้ว → ข้าม Phase นี้
ถ้าไม่ → สร้าง API ใหม่หรือเพิ่ม query parameter

**Option A: เพิ่ม query parameter ใน API เดิม**
```typescript
// GET /api/bonus-face-sheets?view=packages
```

**Option B: สร้าง API ใหม่**
```typescript
// GET /api/bonus-face-sheets/packages
```

### 2.2 Template API (ถ้าต้องสร้างใหม่)
```typescript
// app/api/bonus-face-sheets/packages/route.ts

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function handleGet(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  // Filters
  const status = searchParams.get('status');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const search = searchParams.get('search');

  try {
    // ===== แก้ไขชื่อตารางและ columns ตามที่พบจาก MCP =====
    let query = supabase
      .from('bfs_packages')  // เปลี่ยนชื่อตารางตามจริง
      .select(`
        package_id,
        package_no,
        quantity,
        weight_kg,
        status,
        bfs:bonus_face_sheets!inner (
          bfs_id,
          bfs_code,
          created_at,
          status,
          customer:master_customer (
            customer_id,
            customer_name
          )
        ),
        product:master_products (
          product_id,
          product_code,
          product_name
        )
      `);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('bfs.created_at', startDate);
    }
    if (endDate) {
      query = query.lte('bfs.created_at', endDate);
    }
    if (search) {
      query = query.or(`bfs.bfs_code.ilike.%${search}%,product.product_name.ilike.%${search}%`);
    }

    // Order
    query = query.order('bfs.created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[bfs-packages] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data for frontend
    const packages = data?.map(pkg => ({
      package_id: pkg.package_id,
      package_no: pkg.package_no,
      bfs_code: pkg.bfs?.bfs_code,
      bfs_status: pkg.bfs?.status,
      customer_name: pkg.bfs?.customer?.customer_name,
      product_code: pkg.product?.product_code,
      product_name: pkg.product?.product_name,
      quantity: pkg.quantity,
      weight_kg: pkg.weight_kg,
      status: pkg.status,
      created_at: pkg.bfs?.created_at,
    })) || [];

    return NextResponse.json({
      success: true,
      data: packages,
      total: packages.length
    });

  } catch (err) {
    console.error('[bfs-packages] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handleGet);
```

---

## Phase 3: เพิ่ม UI มุมมองใหม่

### 3.1 เพิ่ม State สำหรับ Toggle View
```typescript
// ใน page.tsx

// เพิ่ม state
const [viewMode, setViewMode] = useState<'summary' | 'packages'>('summary');
const [packagesData, setPackagesData] = useState<any[]>([]);
const [loadingPackages, setLoadingPackages] = useState(false);

// เพิ่ม function fetch packages
const fetchPackages = async () => {
  setLoadingPackages(true);
  try {
    const params = new URLSearchParams();
    // เพิ่ม filters ตามที่มี
    if (selectedStatus) params.append('status', selectedStatus);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (searchTerm) params.append('search', searchTerm);
    
    const response = await fetch(`/api/bonus-face-sheets/packages?${params}`);
    const result = await response.json();
    
    if (result.success) {
      setPackagesData(result.data);
    }
  } catch (error) {
    console.error('Error fetching packages:', error);
  } finally {
    setLoadingPackages(false);
  }
};

// เพิ่ม useEffect สำหรับ fetch เมื่อเปลี่ยน view
useEffect(() => {
  if (viewMode === 'packages') {
    fetchPackages();
  }
}, [viewMode, selectedStatus, startDate, endDate, searchTerm]);
```

### 3.2 เพิ่ม Toggle Buttons
```tsx
// ใน JSX - เพิ่มใกล้ๆ filters

<div className="flex gap-2 mb-4">
  <button
    onClick={() => setViewMode('summary')}
    className={`px-4 py-2 rounded-lg transition-colors ${
      viewMode === 'summary'
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    มุมมองใบงาน
  </button>
  <button
    onClick={() => setViewMode('packages')}
    className={`px-4 py-2 rounded-lg transition-colors ${
      viewMode === 'packages'
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    มุมมองแพ็ค
  </button>
</div>
```

### 3.3 สร้าง PackagesTable Component
```typescript
// app/receiving/picklists/bonus-face-sheets/components/PackagesTable.tsx

'use client';

import React from 'react';
import { Package, Eye } from 'lucide-react';

interface PackageRow {
  package_id: number;
  package_no: number;
  bfs_code: string;
  bfs_status: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  weight_kg: number;
  status: string;
  created_at: string;
}

interface PackagesTableProps {
  data: PackageRow[];
  loading: boolean;
  onViewBFS?: (bfsCode: string) => void;
}

export function PackagesTable({ data, loading, onViewBFS }: PackagesTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">กำลังโหลด...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>ไม่พบข้อมูลแพ็ค</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'รอหยิบ' },
      picked: { bg: 'bg-green-100', text: 'text-green-700', label: 'หยิบแล้ว' },
      packed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'แพ็คแล้ว' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'ส่งแล้ว' },
    };
    const s = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return (
      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              รหัส BFS
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              แพ็ค
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              ร้าน/ลูกค้า
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              รหัส SKU
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              ชื่อสินค้า
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              จำนวน
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              น้ำหนัก (กก.)
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              สถานะ
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              ดู
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((pkg, index) => (
            <tr key={pkg.package_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-blue-600">
                {pkg.bfs_code}
              </td>
              <td className="px-4 py-3 text-sm text-center">
                {pkg.package_no}
              </td>
              <td className="px-4 py-3 text-sm">
                {pkg.customer_name || '-'}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-600">
                {pkg.product_code}
              </td>
              <td className="px-4 py-3 text-sm">
                {pkg.product_name}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                {pkg.quantity?.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                {pkg.weight_kg?.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-center">
                {getStatusBadge(pkg.status)}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onViewBFS?.(pkg.bfs_code)}
                  className="text-gray-400 hover:text-blue-600"
                  title="ดูใบงาน BFS"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Summary */}
      <div className="bg-gray-50 px-4 py-3 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            ทั้งหมด {data.length.toLocaleString()} แพ็ค
          </span>
          <span className="text-gray-600">
            รวมน้ำหนัก {data.reduce((sum, p) => sum + (p.weight_kg || 0), 0).toFixed(2)} กก.
          </span>
        </div>
      </div>
    </div>
  );
}
```

### 3.4 เพิ่มใน page.tsx
```tsx
// ใน JSX - แทนที่ตารางเดิม หรือเพิ่มเป็น conditional render

{viewMode === 'summary' ? (
  // ===== ตารางเดิม (มุมมองใบงาน) - ห้ามแก้ไข =====
  <div>
    {/* ... existing table code ... */}
  </div>
) : (
  // ===== ตารางใหม่ (มุมมองแพ็ค) =====
  <PackagesTable
    data={packagesData}
    loading={loadingPackages}
    onViewBFS={(bfsCode) => {
      // Navigate หรือ scroll ไปที่ BFS นั้น
      setViewMode('summary');
      setSearchTerm(bfsCode);
    }}
  />
)}
```

---

## Phase 4: ทดสอบ

### 4.1 Test Checklist
```
□ มุมมองเดิม (ใบงาน) ยังทำงานปกติ
□ กดปุ่ม "มุมมองแพ็ค" → แสดงตารางแพ็ค
□ กดปุ่ม "มุมมองใบงาน" → กลับไปตารางเดิม
□ Filter status → ทำงานทั้ง 2 มุมมอง
□ Filter วันที่ → ทำงานทั้ง 2 มุมมอง
□ Search → ทำงานทั้ง 2 มุมมอง
□ ข้อมูลในมุมมองแพ็คถูกต้อง
□ กดปุ่ม "ดู" ในมุมมองแพ็ค → กลับไปมุมมองใบงาน
□ Loading state แสดงถูกต้อง
□ Empty state แสดงถูกต้อง
```

### 4.2 Regression Test
```
□ สร้าง BFS ใหม่ได้
□ พิมพ์ BFS ได้
□ Scan BFS ได้
□ อัพเดทสถานะ BFS ได้
□ **ฟีเจอร์เดิมทั้งหมดยังทำงานได้ 100%**
```

---

## Checklist รวม
```
Phase 0: ตรวจสอบและทำความเข้าใจ
□ 0.1 ตรวจสอบโค้ดปัจจุบัน
□ 0.2 ตรวจสอบ API
□ 0.3 ตรวจสอบฐานข้อมูลด้วย MCP
□ 0.4 บันทึกโครงสร้างข้อมูล

Phase 1: วิเคราะห์และออกแบบ
□ 1.1 สรุปโครงสร้างข้อมูล
□ 1.2 ออกแบบ UI

Phase 2: สร้าง API (ถ้าจำเป็น)
□ 2.1 ตรวจสอบว่า API เดิมรองรับหรือไม่
□ 2.2 สร้าง API ใหม่ (ถ้าต้อง)

Phase 3: เพิ่ม UI
□ 3.1 เพิ่ม State
□ 3.2 เพิ่ม Toggle Buttons
□ 3.3 สร้าง PackagesTable Component
□ 3.4 เพิ่มใน page.tsx

Phase 4: ทดสอบ
□ 4.1 Test มุมมองใหม่
□ 4.2 Regression Test

Build & Deploy
□ Build ผ่าน 100%
□ ไม่มี errors/warnings
```

---

## Output ที่ต้องการ

หลังดำเนินการเสร็จ ให้รายงาน:

1. **โครงสร้างฐานข้อมูลที่พบ**
   - ตาราง BFS: ___
   - ตาราง Packages: ___
   - Columns ที่ใช้: ___

2. **ไฟล์ที่สร้าง/แก้ไข**
   - [ ] API: ___
   - [ ] Component: ___
   - [ ] Page: ___

3. **Screenshots/ผลลัพธ์**
   - มุมมองเดิม: ___
   - มุมมองใหม่: ___

4. **Test Results**
   - [ ] Pass/Fail

---

เริ่มจาก **Phase 0** ก่อนเสมอ!
**ห้ามข้าม Phase 0!**
รายงานผลทุกขั้นตอน!