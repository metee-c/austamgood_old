# คู่มือการแก้ไขให้การค้นหาทำงานแบบ Server-Side Search

## ภาพรวม
เอกสารนี้อธิบายวิธีการแก้ไขหน้าที่มีตารางและช่องค้นหา ให้สามารถค้นหาข้อมูลจากทุกหน้าในฐานข้อมูล (server-side search) แทนการค้นหาแค่ข้อมูลที่โหลดมาแสดงในหน้าปัจจุบัน (client-side filtering)

## ปัญหาเดิม
การค้นหาแบบเดิมใช้ client-side filtering:
- ค้นหาได้เฉพาะข้อมูลที่โหลดมาแสดงในหน้าปัจจุบัน (เช่น 100 รายการแรก)
- ไม่สามารถค้นหาข้อมูลในหน้าอื่นๆ ได้
- ผู้ใช้ต้องเปลี่ยนหน้าไปทีละหน้าเพื่อค้นหาข้อมูล

## วิธีแก้ไข

### 1. ใช้ Custom Hook `useServerSideSearch`

```typescript
import { useServerSideSearch } from '@/hooks/useServerSideSearch';

// ใน Component
const { searchTerm, debouncedSearchTerm, setSearchTerm } = useServerSideSearch('', 500);
```

**ลบโค้ดเดิม:**
```typescript
// ❌ ลบโค้ดเก่านี้
const [searchTerm, setSearchTerm] = useState('');
```

### 2. เพิ่ม useEffect สำหรับ Auto-refresh เมื่อค้นหา

```typescript
// Refetch when debounced search term or filters change
useEffect(() => {
  if (/* เงื่อนไขที่จำเป็น เช่น preparationAreaCodes.length > 0 */) {
    // Reset to page 1 when filters change
    fetchData(1);
  }
}, [debouncedSearchTerm, selectedWarehouse, /* filters อื่นๆ */]);
```

### 3. แก้ไข Fetch Function ให้รับ Filters

สร้าง helper function สำหรับ apply filters:

```typescript
// Helper function to apply filters to query (server-side)
const applyFiltersToQuery = (query: any) => {
  // Search filter - search across multiple fields (use debounced term)
  if (debouncedSearchTerm) {
    query = query.or(
      `field1.ilike.%${debouncedSearchTerm}%,` +
      `field2.ilike.%${debouncedSearchTerm}%,` +
      `field3.ilike.%${debouncedSearchTerm}%,` +
      `id_field.eq.${isNaN(Number(debouncedSearchTerm)) ? 0 : Number(debouncedSearchTerm)}`
    );
  }

  // Other filters (warehouse, status, etc.)
  if (selectedWarehouse !== 'all') {
    query = query.eq('warehouse_id', selectedWarehouse);
  }

  // Add more filters as needed

  return query;
};
```

เรียกใช้ใน fetch function:

```typescript
const fetchData = async (page: number = 1) => {
  try {
    setLoading(true);
    const supabase = createClient();

    // Build base query with filters for COUNT
    let countQuery = supabase
      .from('table_name')
      .select('*', { count: 'exact', head: true });

    // Apply server-side filters for count
    countQuery = applyFiltersToQuery(countQuery);

    const { count, error: countError } = await countQuery;
    if (!countError) {
      setTotalCount(count || 0);
    }

    // Fetch paginated data
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let dataQuery = supabase
      .from('table_name')
      .select(`
        *,
        related_table!foreign_key (
          field_name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply server-side filters for data
    dataQuery = applyFiltersToQuery(dataQuery);

    const { data, error } = await dataQuery.range(from, to);

    if (error) {
      setError(error.message);
    } else {
      setData(data || []);
      setCurrentPage(page);
    }
  } catch (err: any) {
    setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  } finally {
    setLoading(false);
  }
};
```

### 4. ลบหรือลด Client-Side Filtering

**ลบโค้ดเก่า:**
```typescript
// ❌ ลบหรือปรับลด client-side filtering
const filteredData = data.filter(item => {
  const matchesSearch =
    item.field1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.field2?.toLowerCase().includes(searchTerm.toLowerCase());

  const matchesWarehouse = selectedWarehouse === 'all' || item.warehouse_id === selectedWarehouse;

  return matchesSearch && matchesWarehouse;
});
```

**เปลี่ยนเป็น (เก็บเฉพาะ filters ที่ต้องใช้ client-side):**
```typescript
// ✅ เก็บเฉพาะ client-side filters ที่จำเป็น (เช่น การคำนวณที่ซับซ้อน)
const filteredData = data.filter(item => {
  // เช่น: การตรวจสอบวันหมดอายุที่ต้องคำนวณ
  const matchesExpiring = !showExpiringSoon || isExpiringSoon(item.expiry_date);

  return matchesExpiring;
});
```

## ตัวอย่างการแก้ไขแบบเต็ม

### ก่อนแก้ไข (Client-Side Filtering)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('master_sku')
      .select('*')
      .range(0, 99); // แค่ 100 รายการแรก

    setProducts(data || []);
  };

  // ❌ Client-side filtering - ค้นหาได้แค่ 100 รายการที่โหลดมา
  const filteredProducts = products.filter(p =>
    p.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategory === 'all' || p.category === selectedCategory)
  );

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหา..."
      />
      <table>
        {filteredProducts.map(p => <tr key={p.sku_id}>...</tr>)}
      </table>
    </div>
  );
};
```

### หลังแก้ไข (Server-Side Search)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useServerSideSearch } from '@/hooks/useServerSideSearch';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 100;

  // ✅ ใช้ custom hook สำหรับ server-side search
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useServerSideSearch('', 500);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchProducts(1);
  }, []);

  // ✅ Auto-refresh เมื่อค้นหาหรือเปลี่ยน filter
  useEffect(() => {
    fetchProducts(1); // กลับไปหน้า 1 เมื่อค้นหา
  }, [debouncedSearchTerm, selectedCategory]);

  // ✅ Helper function สำหรับ apply filters
  const applyFiltersToQuery = (query: any) => {
    if (debouncedSearchTerm) {
      query = query.or(
        `sku_id.ilike.%${debouncedSearchTerm}%,` +
        `sku_name.ilike.%${debouncedSearchTerm}%,` +
        `barcode.ilike.%${debouncedSearchTerm}%`
      );
    }

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    return query;
  };

  // ✅ Fetch with server-side filtering
  const fetchProducts = async (page: number = 1) => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Count with filters
      let countQuery = supabase
        .from('master_sku')
        .select('*', { count: 'exact', head: true });

      countQuery = applyFiltersToQuery(countQuery);

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Fetch data with filters
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('master_sku')
        .select('*')
        .order('sku_name', { ascending: true });

      dataQuery = applyFiltersToQuery(dataQuery);

      const { data } = await dataQuery.range(from, to);

      setProducts(data || []);
      setCurrentPage(page);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ไม่ต้อง filter ฝั่ง client อีก (หรือเก็บเฉพาะ complex logic)
  const displayProducts = products;

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหา..."
      />
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
      >
        <option value="all">ทุกหมวดหมู่</option>
        {/* ... */}
      </select>

      {loading ? (
        <div>กำลังโหลด...</div>
      ) : (
        <table>
          {displayProducts.map(p => <tr key={p.sku_id}>...</tr>)}
        </table>
      )}

      {/* Pagination */}
      <div>
        หน้า {currentPage} / {Math.ceil(totalCount / pageSize)}
        <button onClick={() => fetchProducts(currentPage - 1)}>ก่อนหน้า</button>
        <button onClick={() => fetchProducts(currentPage + 1)}>ถัดไป</button>
      </div>
    </div>
  );
};
```

## Checklist สำหรับการแก้ไข

สำหรับแต่ละหน้า ให้ทำตาม checklist นี้:

- [ ] 1. Import `useServerSideSearch` hook
- [ ] 2. แทนที่ `useState` สำหรับ searchTerm ด้วย `useServerSideSearch`
- [ ] 3. เพิ่ม `useEffect` สำหรับ auto-refresh เมื่อ `debouncedSearchTerm` เปลี่ยน
- [ ] 4. สร้าง `applyFiltersToQuery()` helper function
- [ ] 5. แก้ไข `fetchData()` ให้ apply filters ทั้ง count query และ data query
- [ ] 6. ลบหรือลด client-side filtering (เก็บเฉพาะ complex logic)
- [ ] 7. ทดสอบการค้นหาว่าสามารถหาข้อมูลจากทุกหน้าได้
- [ ] 8. ตรวจสอบว่า pagination ทำงานถูกต้องหลังค้นหา

## หน้าที่ต้องแก้ไข (44 หน้า)

### Warehouse Management (6 หน้า)
- [x] `/warehouse/inventory-balances` ✅ แก้ไขแล้ว (ตัวอย่างอ้างอิง)
- [ ] `/warehouse/inventory-ledger`
- [ ] `/warehouse/inbound`
- [ ] `/warehouse/transfer`
- [ ] `/warehouse/preparation-area-inventory`
- [ ] `/warehouse/inbound-new`

### Order Management (9 หน้า)
- [ ] `/receiving/orders`
- [ ] `/receiving/picklists`
- [ ] `/receiving/picklists/face-sheets`
- [ ] `/receiving/picklists/bonus-face-sheets`
- [ ] `/receiving/loadlists`
- [ ] `/receiving/routes`
- [ ] `/receiving/auto-replenishment`
- [ ] `/receiving/picklists/[id]`
- [ ] `/receiving`

### Stock Management (3 หน้า)
- [ ] `/stock-management/import`
- [ ] `/stock-management/adjustment`
- [ ] `/stock-management/count`

### Master Data (18 หน้า)
- [ ] `/master-data/products`
- [ ] `/master-data/locations`
- [ ] `/master-data/warehouses`
- [ ] `/master-data/preparation-area`
- [ ] `/master-data/suppliers`
- [ ] `/master-data/customers`
- [ ] `/master-data/employees`
- [ ] `/master-data/vehicles`
- [ ] `/master-data/bom`
- [ ] `/master-data/storage-strategy`
- [ ] `/master-data/shipping-costs`
- [ ] `/master-data/users`
- [ ] `/master-data/roles`
- [ ] `/master-data/assets`
- [ ] `/master-data/customer-rejection`
- [ ] `/master-data/document-verification`
- [ ] `/master-data/document-verification/iv-document-types`
- [ ] `/master-data/file-management`

### Mobile (8 หน้า)
- [ ] `/mobile/pick`
- [ ] `/mobile/pick/[id]`
- [ ] `/mobile/pick-up-pieces`
- [ ] `/mobile/pick-up-pieces/[id]`
- [ ] `/mobile/loading`
- [ ] `/mobile/loading/[code]`
- [ ] `/mobile/face-sheet/[id]`
- [ ] `/mobile/bonus-face-sheet/[id]`

## Tips & Best Practices

### 1. Debounce Delay
- ใช้ 500ms สำหรับการพิมพ์ทั่วไป
- ลดเป็น 300ms สำหรับ autocomplete
- เพิ่มเป็น 1000ms สำหรับ query ที่หนัก

### 2. Search Fields
เลือก fields ที่ผู้ใช้มักจะค้นหา:
- รหัส (ID, Code)
- ชื่อ (Name, Title)
- เลขที่เอกสาร (Document Number)
- Barcode / QR Code
- หมายเลขอ้างอิง (Reference Number)

### 3. Filter Performance
- ใช้ indexed columns สำหรับ filtering
- หลีกเลี่ยง `.or()` ที่มีเงื่อนไขมากเกินไป (>10)
- ใช้ `.eq()` แทน `.ilike()` เมื่อเป็นการเปรียบเทียบแบบตรงๆ

### 4. Error Handling
```typescript
const { data, error } = await supabase...;

if (error) {
  console.error('Database error:', error);
  setError('เกิดข้อผิดพลาดในการค้นหาข้อมูล');
  return;
}

// ใช้ข้อมูล
setData(data || []);
```

### 5. Loading States
แสดง loading state ขณะรอข้อมูล:
```typescript
{loading ? (
  <div className="flex justify-center p-4">
    <Loader2 className="w-6 h-6 animate-spin" />
    <span>กำลังค้นหา...</span>
  </div>
) : (
  <table>...</table>
)}
```

## ตัวอย่างที่ดี: inventory-balances/page.tsx

ดูตัวอย่างการใช้งานจริงได้ที่:
```
c:\Users\User\Desktop\austamgood_wms\app\warehouse\inventory-balances\page.tsx
```

ไฟล์นี้เป็นตัวอย่างที่ดีของการทำ server-side search ที่สมบูรณ์:
- ใช้ debounced search
- Apply filters ฝั่ง server
- Pagination ที่ถูกต้อง
- Error handling
- Loading states

## สรุป

การแก้ไขให้รองรับ server-side search จะช่วย:
- ✅ ค้นหาข้อมูลจากทุกหน้าในฐานข้อมูล
- ✅ ลดการโหลดข้อมูลที่ไม่จำเป็น
- ✅ ปรับปรุง performance โดยรวม
- ✅ ประสบการณ์ผู้ใช้ที่ดีขึ้น

แก้ไขทีละหน้า ทดสอบให้มั่นใจว่าทำงานถูกต้องก่อนไปหน้าถัดไป
