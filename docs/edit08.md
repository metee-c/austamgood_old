# ภารกิจ: แก้ไข API พิมพ์ใบหยิบสินค้า ให้กรองเฉพาะ matched packages

## ปัญหาที่พบ

ฟอร์มปริ้น "ใบหยิบสินค้า" (Pick List) แสดง **ทุก packages** ใน BFS แต่ที่ถูกต้องควรแสดง **เฉพาะ packages ที่ถูกแมพตอนสร้าง loadlist** เท่านั้น (เหมือนกับที่แก้ไข "พิมพ์ใบโหลด" ไปแล้ว)

---

## สิ่งที่ต้องแก้ไข

### 1. แก้ไข API: GET /api/bonus-face-sheets/pick-list

**ไฟล์:** `app/api/bonus-face-sheets/pick-list/route.ts`

**Logic ใหม่ (เหมือนกับ print API ที่แก้ไขแล้ว):**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bfs_id = searchParams.get('id');
  const loadlist_id = searchParams.get('loadlist_id');

  // 1. ดึง matched_package_ids จาก wms_loadlist_bonus_face_sheets
  const { data: mapping } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select('matched_package_ids, mapping_type, mapped_picklist_id, mapped_face_sheet_id')
    .eq('loadlist_id', loadlist_id)
    .eq('bonus_face_sheet_id', bfs_id)
    .single();

  if (!mapping) {
    return NextResponse.json({ error: 'ไม่พบข้อมูล mapping' }, { status: 404 });
  }

  const matchedPackageIds = mapping.matched_package_ids || [];

  // 2. ดึงข้อมูล BFS
  const { data: bfs } = await supabase
    .from('bonus_face_sheets')
    .select('*')
    .eq('id', bfs_id)
    .single();

  // 3. ดึง packages เฉพาะที่อยู่ใน matched_package_ids
  const { data: packages } = await supabase
    .from('bonus_face_sheet_packages')
    .select(`
      *,
      bonus_face_sheet_items (*)
    `)
    .eq('bonus_face_sheet_id', bfs_id)
    .in('id', matchedPackageIds);  // ← กรองเฉพาะ matched packages

  // 4. ดึงข้อมูลเอกสารที่แมพ
  let mappedDocumentCode = '';
  let mappingType = mapping.mapping_type;
  
  if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
    const { data: picklist } = await supabase
      .from('picklists')
      .select('picklist_code')
      .eq('id', mapping.mapped_picklist_id)
      .single();
    mappedDocumentCode = picklist?.picklist_code || '';
  } else if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
    const { data: faceSheet } = await supabase
      .from('face_sheets')
      .select('face_sheet_no')
      .eq('id', mapping.mapped_face_sheet_id)
      .single();
    mappedDocumentCode = faceSheet?.face_sheet_no || '';
  }

  // 5. Return data
  return NextResponse.json({
    bfs,
    packages,  // ← เฉพาะ matched packages
    mappedDocumentCode,
    mappingType,
    totalMatchedPackages: matchedPackageIds.length,
    loadlist_id
  });
}
```

### 2. แก้ไข Frontend: ส่ง loadlist_id ไปกับ API

**ไฟล์:** `app/receiving/loadlists/page.tsx`

ตรวจสอบ function `handlePrintPickList` ว่าส่ง `loadlist_id` ไปด้วย:
```typescript
const handlePrintPickList = async (loadlist: Loadlist) => {
  const bfs = loadlist.bonus_face_sheets?.[0];
  if (!bfs) return;

  // ต้องส่ง loadlist_id เพื่อให้ API รู้ว่าต้องกรอง packages ไหน
  const response = await fetch(
    `/api/bonus-face-sheets/pick-list?id=${bfs.id}&loadlist_id=${loadlist.id}`
  );
  
  const data = await response.json();
  // ... render pick list
};
```

### 3. แก้ไข HTML Template ของ Pick List

**แสดงเอกสารที่แมพและจำนวนที่ถูกต้อง:**
```html
<!-- หัวเอกสาร -->
<div class="header">
  <h1>ใบหยิบสินค้าของแถม</h1>
  <h2>Bonus Pick List</h2>
  
  <div class="info">
    <p>เลขที่: <strong>BFS-20260109-001</strong></p>
    
    <!-- แสดงเอกสารที่แมพ -->
    <p class="mapped-doc">
      แมพกับ: 
      <span class="badge badge-blue">📋 PL-20260109-003</span>
    </p>
    
    <p>ใบโหลด: <strong>LD-20260112-XXXX</strong></p>
  </div>
  
  <!-- สรุปจำนวน - แสดงเฉพาะที่แมพ -->
  <div class="summary">
    <div class="stat">
      <span class="number">4</span>
      <span class="label">แพ็ค</span>
    </div>
    <div class="stat">
      <span class="number">1</span>
      <span class="label">ร้านค้า</span>
    </div>
  </div>
</div>

<!-- แสดงเฉพาะ packages ที่แมพเจอ -->
```

---

## 4. เปรียบเทียบกับ Print API ที่แก้ไขแล้ว

| API | ไฟล์ | สถานะ |
|-----|------|--------|
| พิมพ์ใบโหลด (print) | `/api/bonus-face-sheets/print/route.ts` | ✅ แก้ไขแล้ว |
| พิมพ์ใบหยิบสินค้า (pick-list) | `/api/bonus-face-sheets/pick-list/route.ts` | ❌ ต้องแก้ไข |

**Logic ที่ต้องเหมือนกัน:**
1. รับ `loadlist_id` parameter
2. ดึง `matched_package_ids` จาก `wms_loadlist_bonus_face_sheets`
3. กรอง packages เฉพาะที่อยู่ใน `matched_package_ids`
4. แสดงเอกสารที่แมพ (Picklist หรือ Face Sheet)

---

## 5. Checklist

### API:
- [ ] แก้ไข GET /api/bonus-face-sheets/pick-list
  - [ ] รับ parameter `loadlist_id`
  - [ ] ดึง `matched_package_ids` จาก mapping
  - [ ] กรอง packages เฉพาะที่อยู่ใน matched_package_ids
  - [ ] Return `mappedDocumentCode` และ `mappingType`

### Frontend:
- [ ] ส่ง `loadlist_id` ไปกับ API pick-list
- [ ] แสดงเอกสารที่แมพในหัวเอกสาร

### HTML Template:
- [ ] แสดงเลขเอกสารที่แมพ
- [ ] แสดงจำนวน packages ที่แมพเจอ
- [ ] แสดงเฉพาะ packages ที่แมพเจอ

---

## 6. ตัวอย่างผลลัพธ์

**ก่อนแก้ไข:**
```
ใบหยิบสินค้าของแถม
BFS-20260109-001
29 แพ็ค | 15 ร้าน

[แสดงทุกร้าน ทุกแพ็ค]
```

**หลังแก้ไข:**
```
ใบหยิบสินค้าของแถม  
BFS-20260109-001 / 📋 PL-20260109-003
ใบโหลด: LD-20260112-XXXX
4 แพ็ค | 1 ร้าน

[แสดงเฉพาะแพ็คที่แมพเจอ]
```

---

เริ่มแก้ไขได้เลยครับ ใช้ logic เดียวกับ print API ที่แก้ไขไปแล้ว