# ภารกิจ: เพิ่มการแสดงแพ็คคงเหลือและไฮไลท์สีตามอายุใน Bonus Face Sheets

## หน้าที่ต้องแก้ไข
`/receiving/picklists/bonus-face-sheets`

---

## สิ่งที่ต้องเพิ่ม

### 1. คอลัมน์ "แพ็คคงเหลือ" (Remaining Packages)

แสดงจำนวน packages ที่ยังไม่ถูกแมพกับ Picklist หรือ Face Sheet

**การคำนวณ:**
```
remaining_packages = total_packages - used_packages

โดย:
- total_packages = จำนวน packages ทั้งหมดใน BFS
- used_packages = จำนวน packages ที่อยู่ใน matched_package_ids ของทุก loadlist ที่ใช้ BFS นี้
```

**UI ที่ต้องการ:**

| เลขใบปะหน้าของแถม | แพ็คทั้งหมด | แพ็คคงเหลือ | ... |
|-------------------|-------------|-------------|-----|
| BFS-20260109-001 | 29 | 5 | ... |
| BFS-20260108-002 | 37 | 0 ✅ | ... |
| BFS-20260107-007 | 33 | 33 ⚠️ | ... |

**แสดงผล:**
- `0` = แมพหมดแล้ว (สีเขียว + ✅)
- `> 0` = ยังเหลือ (แสดงจำนวน)
- ถ้าเหลือเท่ากับทั้งหมด = ยังไม่ได้แมพเลย (สีส้ม + ⚠️)

---

### 2. ไฮไลท์สีแถวตามอายุ (Age-based Row Highlighting)

**กฎ:** LSA = 4 วัน (ต้องแมพให้หมดภายใน 4 วันจากวันสร้าง)

**Logic การคำนวณอายุ:**
```typescript
const today = new Date();
const createdDate = new Date(bfs.created_at);
const ageInDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

// ถ้าแมพหมดแล้ว (remaining = 0) → ไม่ต้องไฮไลท์
// ถ้ายังเหลือ → ไฮไลท์ตามอายุ
```

**สีตามอายุ (ยิ่งเก่ายิ่งแดงเข้ม):**

| อายุ (วัน) | สถานะ | สี Background | Tailwind Class |
|-----------|--------|---------------|----------------|
| > 4 วัน | เกิน SLA | 🔴 แดงเข้ม | `bg-red-200` |
| 3-4 วัน | ใกล้เกิน | 🟠 แดงอ่อน | `bg-red-100` |
| 1-2 วัน | ปานกลาง | 🟡 ส้มอ่อน | `bg-orange-50` |
| 0 วัน | ใหม่ | ⚪ ปกติ | ไม่มี |
| แมพหมดแล้ว | เสร็จ | ⚪ ปกติ | ไม่มี |

---

## 3. แก้ไข API

### GET /api/bonus-face-sheets (หรือ API ที่หน้านี้ใช้)

เพิ่มการคำนวณ `remaining_packages`:
```typescript
// ดึง matched_package_ids ที่ใช้แล้วจากทุก loadlist
const { data: usedMappings } = await supabase
  .from('wms_loadlist_bonus_face_sheets')
  .select('bonus_face_sheet_id, matched_package_ids')
  .not('matched_package_ids', 'is', null);

// สร้าง Map นับ packages ที่ใช้แล้ว
const usedPackagesCount = new Map<number, number>();

usedMappings?.forEach(mapping => {
  const bfsId = mapping.bonus_face_sheet_id;
  const count = (mapping.matched_package_ids || []).length;
  usedPackagesCount.set(bfsId, (usedPackagesCount.get(bfsId) || 0) + count);
});

// เพิ่ม remaining_packages ให้แต่ละ BFS
const enrichedBFS = bonusFaceSheets.map(bfs => {
  const usedCount = usedPackagesCount.get(bfs.id) || 0;
  const remainingPackages = bfs.total_packages - usedCount;
  
  return {
    ...bfs,
    used_packages: usedCount,
    remaining_packages: Math.max(0, remainingPackages), // ไม่ให้ติดลบ
    is_fully_mapped: remainingPackages <= 0
  };
});
```

---

## 4. แก้ไข Frontend

### 4.1 เพิ่ม Interface
```typescript
interface BonusFaceSheet {
  // ... existing fields
  total_packages: number;
  used_packages: number;
  remaining_packages: number;
  is_fully_mapped: boolean;
  created_at: string;
}
```

### 4.2 Helper Function คำนวณอายุและสี
```typescript
const getRowStyle = (bfs: BonusFaceSheet): string => {
  // ถ้าแมพหมดแล้ว → ไม่ไฮไลท์
  if (bfs.is_fully_mapped || bfs.remaining_packages === 0) {
    return '';
  }
  
  // คำนวณอายุ
  const today = new Date();
  const createdDate = new Date(bfs.created_at);
  const ageInDays = Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // กำหนดสีตามอายุ
  if (ageInDays > 4) {
    return 'bg-red-200'; // เกิน SLA - แดงเข้ม
  } else if (ageInDays >= 3) {
    return 'bg-red-100'; // ใกล้เกิน - แดงอ่อน
  } else if (ageInDays >= 1) {
    return 'bg-orange-50'; // ปานกลาง - ส้มอ่อน
  }
  
  return ''; // ใหม่ - ปกติ
};

const getAgeLabel = (bfs: BonusFaceSheet): string => {
  const today = new Date();
  const createdDate = new Date(bfs.created_at);
  const ageInDays = Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (ageInDays === 0) return 'วันนี้';
  if (ageInDays === 1) return '1 วัน';
  return `${ageInDays} วัน`;
};
```

### 4.3 เพิ่มคอลัมน์ในตาราง
```tsx
{/* Table Header */}
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
  แพ็คคงเหลือ
</th>
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
  อายุ
</th>

{/* Table Row */}
<tr className={`${getRowStyle(bfs)} hover:bg-gray-50`}>
  {/* ... existing columns ... */}
  
  {/* คอลัมน์แพ็คคงเหลือ */}
  <td className="px-4 py-3 text-sm">
    {bfs.is_fully_mapped ? (
      <span className="inline-flex items-center text-green-600">
        <CheckCircle className="w-4 h-4 mr-1" />
        แมพหมดแล้ว
      </span>
    ) : bfs.remaining_packages === bfs.total_packages ? (
      <span className="inline-flex items-center text-orange-600">
        <AlertTriangle className="w-4 h-4 mr-1" />
        {bfs.remaining_packages}/{bfs.total_packages}
        <span className="ml-1 text-xs">(ยังไม่แมพ)</span>
      </span>
    ) : (
      <span className="text-gray-700">
        {bfs.remaining_packages}/{bfs.total_packages}
      </span>
    )}
  </td>
  
  {/* คอลัมน์อายุ */}
  <td className="px-4 py-3 text-sm">
    <span className={`
      ${getAgeInDays(bfs) > 4 ? 'text-red-600 font-bold' : ''}
      ${getAgeInDays(bfs) >= 3 ? 'text-red-500' : ''}
    `}>
      {getAgeLabel(bfs)}
    </span>
  </td>
</tr>
```

---

## 5. ตัวอย่างผลลัพธ์

| เลขใบปะหน้าของแถม | แพ็คคงเหลือ | อายุ | สีแถว |
|-------------------|-------------|------|-------|
| BFS-20260105-001 | ⚠️ 10/10 (ยังไม่แมพ) | 5 วัน | 🔴 แดงเข้ม |
| BFS-20260106-002 | 5/20 | 4 วัน | 🟠 แดงอ่อน |
| BFS-20260108-003 | 3/15 | 2 วัน | 🟡 ส้มอ่อน |
| BFS-20260109-004 | ✅ แมพหมดแล้ว | 1 วัน | ⚪ ปกติ |
| BFS-20260110-005 | 8/8 (ยังไม่แมพ) | วันนี้ | ⚪ ปกติ |

---

## 6. SQL Query ตรวจสอบข้อมูล
```sql
-- ดู BFS พร้อมจำนวนแพ็คคงเหลือ
WITH used_packages AS (
  SELECT 
    bonus_face_sheet_id,
    SUM(jsonb_array_length(COALESCE(matched_package_ids, '[]'::jsonb))) as used_count
  FROM wms_loadlist_bonus_face_sheets
  GROUP BY bonus_face_sheet_id
)
SELECT 
  bfs.id,
  bfs.face_sheet_no,
  bfs.created_at,
  (SELECT COUNT(*) FROM bonus_face_sheet_packages WHERE bonus_face_sheet_id = bfs.id) as total_packages,
  COALESCE(up.used_count, 0) as used_packages,
  (SELECT COUNT(*) FROM bonus_face_sheet_packages WHERE bonus_face_sheet_id = bfs.id) - COALESCE(up.used_count, 0) as remaining_packages,
  EXTRACT(DAY FROM NOW() - bfs.created_at) as age_days
FROM bonus_face_sheets bfs
LEFT JOIN used_packages up ON up.bonus_face_sheet_id = bfs.id
ORDER BY bfs.created_at DESC;
```

---

## 7. Checklist

### API:
- [ ] เพิ่มการคำนวณ used_packages, remaining_packages
- [ ] เพิ่ม is_fully_mapped flag
- [ ] Return ข้อมูลใหม่

### Frontend:
- [ ] เพิ่ม interface fields
- [ ] สร้าง helper functions (getRowStyle, getAgeLabel)
- [ ] เพิ่มคอลัมน์ "แพ็คคงเหลือ"
- [ ] เพิ่มคอลัมน์ "อายุ"
- [ ] ไฮไลท์สีแถวตามอายุ
- [ ] แสดง icon ✅ / ⚠️ ตามสถานะ

---

เริ่มทำงานได้เลยครับ ดูไฟล์หน้า bonus-face-sheets ก่อนแล้วแก้ไขตาม spec