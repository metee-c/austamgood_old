# ภารกิจ: เพิ่มตัวเลือกสร้าง Loadlist จาก BFS โดยไม่ต้องแมพ

## ⛔ กฎเหล็ก

1. **ห้าม** แก้ไข Logic เดิมที่ทำงานอยู่แล้ว
2. **ต้อง** เพิ่มเป็น Option ใหม่ ไม่ใช่แทนที่ของเดิม
3. **ต้อง** ตรวจสอบฐานข้อมูลก่อนดำเนินการ
4. **ต้อง** Test ทั้ง 2 โหมด (แมพ / ไม่แมพ)

---

## 🎯 เป้าหมาย

| ปัจจุบัน | ต้องการเพิ่ม |
|---------|-------------|
| ต้องเลือก Picklist/Face Sheet ที่แมพได้ | เพิ่มตัวเลือก "ไม่ต้องแมพ" |
| สร้าง Loadlist จาก packages ที่แมพแล้ว | สร้าง Loadlist จาก BFS ทั้งใบ |

### UI ที่ต้องการ
```
┌─────────────────────────────────────────────────────────────────┐
│  สร้างใบโหลดสินค้า                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tab: [ใบหยิบ] [ใบปะหน้า] [ใบปะหน้าของแถม (5)]                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ☑ ไม่ต้องแมพกับใบหยิบ (สร้างจาก BFS ทั้งใบ)                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  เมื่อติ๊ก:                                                      │
│  - แสดง BFS ทั้งหมดที่ยังไม่ได้สร้าง Loadlist                    │
│  - ไม่ต้องเลือก Picklist ก่อน                                   │
│  - เลือก BFS แล้วสร้าง Loadlist ได้เลย                          │
│                                                                  │
│  เมื่อไม่ติ๊ก (เหมือนเดิม):                                      │
│  - ต้องเลือก Picklist ก่อน                                      │
│  - แสดงเฉพาะ BFS ที่แมพกับ Picklist นั้น                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: ตรวจสอบฐานข้อมูลและโค้ดปัจจุบัน

### 0.1 ดูโครงสร้าง Loadlist และความสัมพันธ์กับ BFS
```sql
-- ดูโครงสร้าง loadlists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loadlists'
ORDER BY ordinal_position;

-- ดูโครงสร้าง wms_loadlist_bonus_face_sheets
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wms_loadlist_bonus_face_sheets'
ORDER BY ordinal_position;

-- ดูโครงสร้าง loadlist_items
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loadlist_items'
ORDER BY ordinal_position;
```

### 0.2 ดูว่า Loadlist เก็บข้อมูล BFS อย่างไร
```sql
-- ดูตัวอย่าง loadlist ที่มี BFS
SELECT 
  l.id,
  l.loadlist_code,
  l.status,
  wlbfs.bonus_face_sheet_id,
  bfs.face_sheet_no,
  wlbfs.picklist_id,
  p.picklist_code
FROM loadlists l
JOIN wms_loadlist_bonus_face_sheets wlbfs ON wlbfs.loadlist_id = l.id
JOIN bonus_face_sheets bfs ON bfs.id = wlbfs.bonus_face_sheet_id
LEFT JOIN picklists p ON p.id = wlbfs.picklist_id
LIMIT 10;
```

### 0.3 ดูว่า BFS Packages เชื่อมกับ Loadlist อย่างไร
```sql
-- ดูว่า packages มี loadlist_id หรือไม่
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bonus_face_sheet_packages'
  AND column_name LIKE '%loadlist%';

-- ดูตัวอย่าง packages
SELECT 
  p.id,
  p.face_sheet_id,
  p.package_number,
  p.loadlist_id,
  p.is_mapped,
  bfs.face_sheet_no
FROM bonus_face_sheet_packages p
JOIN bonus_face_sheets bfs ON bfs.id = p.face_sheet_id
WHERE p.loadlist_id IS NOT NULL
LIMIT 10;
```

### 0.4 หา BFS ที่ยังไม่ได้สร้าง Loadlist ทั้งใบ
```sql
-- หา BFS ที่ยังมี packages ที่ไม่ได้อยู่ใน loadlist
SELECT 
  bfs.id,
  bfs.face_sheet_no,
  bfs.status,
  COUNT(p.id) as total_packages,
  COUNT(p.loadlist_id) as mapped_packages,
  COUNT(p.id) - COUNT(p.loadlist_id) as unmapped_packages
FROM bonus_face_sheets bfs
LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
WHERE bfs.status IN ('pending', 'in_progress', 'completed', 'picked')
GROUP BY bfs.id, bfs.face_sheet_no, bfs.status
HAVING COUNT(p.id) - COUNT(p.loadlist_id) > 0
ORDER BY bfs.face_sheet_no;
```

### 0.5 ตรวจสอบโค้ดหน้าสร้าง Loadlist
```bash
# หาไฟล์หน้า loadlists
find . -path "*loadlists*" -name "page.tsx" 2>/dev/null

# หา component ที่แสดง BFS tab
grep -r "ใบปะหน้าของแถม\|bonus.*face.*sheet" --include="*.tsx" app/receiving/loadlists/
```

---

## Phase 1: สร้าง API ดึง BFS ที่ยังไม่ได้สร้าง Loadlist

### 1.1 API Endpoint

**ไฟล์:** `app/api/loadlists/available-bfs/route.ts`
```typescript
// app/api/loadlists/available-bfs/route.ts

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function handleGet(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('mode'); // 'mapped' | 'unmapped' | 'all'
  const picklistId = searchParams.get('picklist_id');
  const warehouseId = searchParams.get('warehouse_id');

  try {
    if (mode === 'unmapped') {
      // โหมดไม่แมพ: ดึง BFS ที่ยังมี packages ไม่ได้อยู่ใน loadlist
      const { data, error } = await supabase
        .from('bonus_face_sheets')
        .select(`
          id,
          face_sheet_no,
          status,
          created_at,
          packages:bonus_face_sheet_packages (
            id,
            package_number,
            barcode_id,
            shop_name,
            loadlist_id,
            status
          )
        `)
        .in('status', ['pending', 'in_progress', 'completed', 'picked'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter เฉพาะ BFS ที่มี packages ยังไม่ได้ map
      const availableBfs = data?.filter(bfs => {
        const unmappedPackages = bfs.packages?.filter(p => !p.loadlist_id) || [];
        return unmappedPackages.length > 0;
      }).map(bfs => ({
        ...bfs,
        total_packages: bfs.packages?.length || 0,
        unmapped_packages: bfs.packages?.filter(p => !p.loadlist_id).length || 0,
        packages: bfs.packages?.filter(p => !p.loadlist_id) // ส่งเฉพาะ unmapped
      })) || [];

      return NextResponse.json({
        success: true,
        data: availableBfs,
        mode: 'unmapped'
      });

    } else {
      // โหมดแมพ (เหมือนเดิม): ดึง BFS ที่แมพกับ picklist
      if (!picklistId) {
        return NextResponse.json({
          success: true,
          data: [],
          mode: 'mapped',
          message: 'กรุณาเลือก Picklist ก่อน'
        });
      }

      // ใช้ logic เดิม
      const { data, error } = await supabase
        .from('bonus_face_sheets')
        .select(`
          id,
          face_sheet_no,
          status,
          packages:bonus_face_sheet_packages (
            id,
            package_number,
            barcode_id,
            shop_name,
            loadlist_id,
            picklist_id,
            status
          )
        `)
        .in('status', ['pending', 'in_progress', 'completed', 'picked']);

      if (error) throw error;

      // Filter เฉพาะ BFS ที่มี packages แมพกับ picklist นี้
      const mappedBfs = data?.filter(bfs => {
        const matchingPackages = bfs.packages?.filter(
          p => p.picklist_id === parseInt(picklistId) && !p.loadlist_id
        ) || [];
        return matchingPackages.length > 0;
      }).map(bfs => ({
        ...bfs,
        packages: bfs.packages?.filter(
          p => p.picklist_id === parseInt(picklistId) && !p.loadlist_id
        )
      })) || [];

      return NextResponse.json({
        success: true,
        data: mappedBfs,
        mode: 'mapped',
        picklist_id: picklistId
      });
    }

  } catch (err: any) {
    console.error('[available-bfs] Error:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGet);
```

---

## Phase 2: แก้ไข API สร้าง Loadlist รองรับโหมดไม่แมพ

### 2.1 แก้ไข API สร้าง Loadlist

**ไฟล์:** `app/api/loadlists/route.ts` (หรือไฟล์ที่ใช้สร้าง loadlist)
```typescript
// เพิ่มใน POST handler

// รับ parameter ใหม่
const { 
  // ... existing params
  skip_mapping,  // boolean: true = ไม่แมพ
  bfs_ids,       // array: รายการ BFS ที่เลือก (เมื่อ skip_mapping = true)
} = await request.json();

// ถ้า skip_mapping = true
if (skip_mapping && bfs_ids?.length > 0) {
  // สร้าง loadlist จาก BFS โดยตรง ไม่ต้องผ่าน picklist
  
  // 1. สร้าง loadlist
  const { data: loadlist, error: loadlistError } = await supabase
    .from('loadlists')
    .insert({
      loadlist_code: await generateLoadlistCode(),
      status: 'pending',
      created_by: userId,
      skip_picklist_mapping: true, // flag บอกว่าไม่ได้แมพ
    })
    .select()
    .single();

  if (loadlistError) throw loadlistError;

  // 2. ดึง packages ทั้งหมดของ BFS ที่เลือก
  const { data: packages, error: pkgError } = await supabase
    .from('bonus_face_sheet_packages')
    .select('*')
    .in('face_sheet_id', bfs_ids)
    .is('loadlist_id', null); // เฉพาะที่ยังไม่ได้ map

  if (pkgError) throw pkgError;

  // 3. อัพเดท packages ให้ชี้ไป loadlist นี้
  const packageIds = packages?.map(p => p.id) || [];
  if (packageIds.length > 0) {
    const { error: updateError } = await supabase
      .from('bonus_face_sheet_packages')
      .update({ 
        loadlist_id: loadlist.id,
        is_mapped: true 
      })
      .in('id', packageIds);

    if (updateError) throw updateError;
  }

  // 4. สร้าง wms_loadlist_bonus_face_sheets records
  const bfsRecords = bfs_ids.map((bfsId: number) => ({
    loadlist_id: loadlist.id,
    bonus_face_sheet_id: bfsId,
    picklist_id: null, // ไม่มี picklist
    created_by: userId,
  }));

  const { error: bfsLinkError } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .insert(bfsRecords);

  if (bfsLinkError) throw bfsLinkError;

  return NextResponse.json({
    success: true,
    loadlist_id: loadlist.id,
    loadlist_code: loadlist.loadlist_code,
    packages_count: packageIds.length,
    bfs_count: bfs_ids.length,
    mode: 'skip_mapping'
  });
}

// ... existing logic for mapped mode
```

---

## Phase 3: เพิ่ม UI Checkbox และ Logic

### 3.1 เพิ่ม State
```typescript
// ใน page.tsx หรือ component สร้าง loadlist

// เพิ่ม state
const [skipMapping, setSkipMapping] = useState(false);
const [availableBfs, setAvailableBfs] = useState<any[]>([]);
const [selectedBfsIds, setSelectedBfsIds] = useState<Set<number>>(new Set());
const [loadingBfs, setLoadingBfs] = useState(false);

// Fetch BFS เมื่อเปลี่ยนโหมด
useEffect(() => {
  if (activeTab === 'bonus-face-sheets') {
    fetchAvailableBfs();
  }
}, [activeTab, skipMapping, selectedPicklistId]);

const fetchAvailableBfs = async () => {
  setLoadingBfs(true);
  try {
    const params = new URLSearchParams({
      mode: skipMapping ? 'unmapped' : 'mapped',
    });
    
    if (!skipMapping && selectedPicklistId) {
      params.append('picklist_id', selectedPicklistId.toString());
    }

    const response = await fetch(`/api/loadlists/available-bfs?${params}`);
    const result = await response.json();
    
    if (result.success) {
      setAvailableBfs(result.data);
    }
  } catch (error) {
    console.error('Error fetching BFS:', error);
  } finally {
    setLoadingBfs(false);
  }
};
```

### 3.2 เพิ่ม Checkbox UI
```tsx
// ใน Tab ใบปะหน้าของแถม

<div className="mb-4 p-4 bg-blue-50 rounded-lg">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={skipMapping}
      onChange={(e) => {
        setSkipMapping(e.target.checked);
        setSelectedBfsIds(new Set()); // Clear selection
      }}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-blue-800">
      ไม่ต้องแมพกับใบหยิบ (สร้างจาก BFS ทั้งใบ)
    </span>
  </label>
  
  {skipMapping && (
    <p className="mt-2 text-xs text-blue-600">
      💡 เลือก BFS ที่ต้องการสร้าง Loadlist โดยตรง โดยไม่ต้องเลือกใบหยิบก่อน
    </p>
  )}
</div>

{/* แสดง Picklist selector เฉพาะเมื่อไม่ skip */}
{!skipMapping && (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">เลือกใบหยิบ</label>
    <select
      value={selectedPicklistId || ''}
      onChange={(e) => setSelectedPicklistId(Number(e.target.value) || null)}
      className="w-full border rounded-lg p-2"
    >
      <option value="">-- เลือกใบหยิบ --</option>
      {picklists.map(p => (
        <option key={p.id} value={p.id}>{p.picklist_code}</option>
      ))}
    </select>
  </div>
)}

{/* แสดงรายการ BFS */}
<div className="border rounded-lg overflow-hidden">
  <table className="min-w-full">
    <thead className="bg-gray-100">
      <tr>
        <th className="px-4 py-2 text-left">
          <input
            type="checkbox"
            checked={selectedBfsIds.size === availableBfs.length && availableBfs.length > 0}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedBfsIds(new Set(availableBfs.map(b => b.id)));
              } else {
                setSelectedBfsIds(new Set());
              }
            }}
          />
        </th>
        <th className="px-4 py-2 text-left">รหัส BFS</th>
        <th className="px-4 py-2 text-center">สถานะ</th>
        <th className="px-4 py-2 text-center">
          {skipMapping ? 'Packages ที่ยังไม่ได้สร้าง' : 'Packages ที่แมพ'}
        </th>
      </tr>
    </thead>
    <tbody>
      {availableBfs.map(bfs => (
        <tr 
          key={bfs.id}
          className={`hover:bg-gray-50 cursor-pointer ${
            selectedBfsIds.has(bfs.id) ? 'bg-blue-50' : ''
          }`}
          onClick={() => {
            const newSet = new Set(selectedBfsIds);
            if (newSet.has(bfs.id)) {
              newSet.delete(bfs.id);
            } else {
              newSet.add(bfs.id);
            }
            setSelectedBfsIds(newSet);
          }}
        >
          <td className="px-4 py-2">
            <input
              type="checkbox"
              checked={selectedBfsIds.has(bfs.id)}
              onChange={() => {}}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
          <td className="px-4 py-2 font-medium">{bfs.face_sheet_no}</td>
          <td className="px-4 py-2 text-center">
            <span className={`px-2 py-1 rounded-full text-xs ${
              bfs.status === 'completed' ? 'bg-green-100 text-green-700' :
              bfs.status === 'picked' ? 'bg-blue-100 text-blue-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {bfs.status}
            </span>
          </td>
          <td className="px-4 py-2 text-center">
            {skipMapping 
              ? `${bfs.unmapped_packages} / ${bfs.total_packages}`
              : bfs.packages?.length || 0
            }
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  
  {availableBfs.length === 0 && (
    <div className="text-center py-8 text-gray-500">
      {skipMapping 
        ? 'ไม่มี BFS ที่ยังไม่ได้สร้าง Loadlist'
        : 'กรุณาเลือกใบหยิบก่อน หรือติ๊ก "ไม่ต้องแมพกับใบหยิบ"'
      }
    </div>
  )}
</div>
```

### 3.3 แก้ไข Handler สร้าง Loadlist
```typescript
const handleCreateLoadlist = async () => {
  if (selectedBfsIds.size === 0) {
    alert('กรุณาเลือกอย่างน้อย 1 BFS');
    return;
  }

  setCreating(true);
  try {
    const response = await fetch('/api/loadlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // ... existing params
        skip_mapping: skipMapping,
        bfs_ids: Array.from(selectedBfsIds),
        picklist_id: skipMapping ? null : selectedPicklistId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'เกิดข้อผิดพลาด');
    }

    alert(`สร้าง Loadlist ${result.loadlist_code} สำเร็จ (${result.packages_count} packages)`);
    
    // Refresh
    fetchAvailableBfs();
    setSelectedBfsIds(new Set());
    
  } catch (error: any) {
    console.error('Error creating loadlist:', error);
    alert(error.message);
  } finally {
    setCreating(false);
  }
};
```

---

## Phase 4: ทดสอบ

### Test Cases
```
□ โหมดแมพ (เหมือนเดิม):
  - ไม่ติ๊ก checkbox
  - ต้องเลือก Picklist ก่อน
  - แสดงเฉพาะ BFS ที่แมพกับ Picklist นั้น
  - สร้าง Loadlist ได้ปกติ

□ โหมดไม่แมพ (ใหม่):
  - ติ๊ก checkbox "ไม่ต้องแมพกับใบหยิบ"
  - ไม่ต้องเลือก Picklist
  - แสดง BFS ทั้งหมดที่ยังมี packages ไม่ได้อยู่ใน loadlist
  - เลือก BFS แล้วสร้าง Loadlist ได้
  - Packages ทั้งหมดของ BFS ถูก map ไป loadlist ใหม่

□ สลับโหมด:
  - ติ๊ก/ไม่ติ๊ก → รายการ BFS เปลี่ยนตาม
  - Selection ถูก clear เมื่อสลับโหมด

□ หลังสร้าง Loadlist:
  - BFS ที่เลือกหายจากรายการ (เพราะ packages ถูก map หมดแล้ว)
  - Loadlist ใหม่มี flag skip_picklist_mapping = true
  - Packages มี loadlist_id ถูกต้อง
```

---

## Checklist
```
Phase 0: ตรวจสอบฐานข้อมูล
□ 0.1 ดูโครงสร้างตาราง
□ 0.2 ดูความสัมพันธ์ Loadlist-BFS
□ 0.3 ดู Packages-Loadlist
□ 0.4 หา BFS ที่ยังไม่ได้สร้าง Loadlist
□ 0.5 ตรวจสอบโค้ดปัจจุบัน

Phase 1: สร้าง API ดึง BFS
□ สร้าง /api/loadlists/available-bfs
□ รองรับ mode=mapped และ mode=unmapped

Phase 2: แก้ไข API สร้าง Loadlist
□ เพิ่ม parameter skip_mapping, bfs_ids
□ เพิ่ม logic สร้างจาก BFS โดยตรง
□ อัพเดท packages.loadlist_id

Phase 3: เพิ่ม UI
□ เพิ่ม checkbox "ไม่ต้องแมพกับใบหยิบ"
□ เพิ่ม logic เปลี่ยนโหมด
□ แก้ไข handler สร้าง loadlist

Phase 4: ทดสอบ
□ ทดสอบโหมดแมพ (เดิม)
□ ทดสอบโหมดไม่แมพ (ใหม่)
□ ทดสอบสลับโหมด
□ Regression test

Build
□ Build ผ่าน 100%
```

---

เริ่มจาก **Phase 0** ก่อนเสมอ!
รายงานผลทุกขั้นตอน!