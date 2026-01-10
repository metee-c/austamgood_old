# ภารกิจ: เพิ่มคอลัมน์แสดงเลขเอกสารที่แมพในตาราง Loadlists

## บริบท

หน้า `/receiving/loadlists` แสดงตารางรายการใบโหลด ต้องการเพิ่มคอลัมน์เพื่อแสดงว่าใบโหลดแต่ละแถว **ถูกสร้างจากการแมพกับเอกสารอะไร** (Picklist หรือ Face Sheet)

---

## สิ่งที่ต้องทำ

### 1. แก้ไข API: GET /api/loadlists

**ไฟล์:** `app/api/loadlists/route.ts`

**เพิ่มการดึงข้อมูล mapping จาก wms_loadlist_bonus_face_sheets:**
```typescript
// ดึงข้อมูล bonus_face_sheets พร้อม mapping info
const loadlistsWithMapping = await Promise.all(
  loadlists.map(async (loadlist) => {
    // ดึง mapping info จาก wms_loadlist_bonus_face_sheets
    const { data: bfsMappings } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        id,
        bonus_face_sheet_id,
        mapped_picklist_id,
        mapped_face_sheet_id,
        mapping_type,
        matched_package_ids
      `)
      .eq('loadlist_id', loadlist.id);

    // ถ้ามี mapping ให้ดึงเลขเอกสารที่แมพ
    let mappedDocuments = [];
    
    if (bfsMappings && bfsMappings.length > 0) {
      for (const mapping of bfsMappings) {
        if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
          // ดึงเลข Picklist
          const { data: picklist } = await supabase
            .from('picklists')
            .select('picklist_code')
            .eq('id', mapping.mapped_picklist_id)
            .single();
          
          mappedDocuments.push({
            type: 'picklist',
            code: picklist?.picklist_code,
            id: mapping.mapped_picklist_id
          });
        } else if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
          // ดึงเลข Face Sheet
          const { data: faceSheet } = await supabase
            .from('face_sheets')
            .select('face_sheet_no')
            .eq('id', mapping.mapped_face_sheet_id)
            .single();
          
          mappedDocuments.push({
            type: 'face_sheet',
            code: faceSheet?.face_sheet_no,
            id: mapping.mapped_face_sheet_id
          });
        }
      }
    }

    return {
      ...loadlist,
      mapped_documents: mappedDocuments
    };
  })
);
```

### 2. แก้ไข Frontend: เพิ่มคอลัมน์ในตาราง

**ไฟล์:** `app/receiving/loadlists/page.tsx`

#### 2.1 เพิ่ม Interface
```typescript
interface MappedDocument {
  type: 'picklist' | 'face_sheet';
  code: string;
  id: number;
}

interface Loadlist {
  // ... existing fields
  mapped_documents?: MappedDocument[];
}
```

#### 2.2 เพิ่มคอลัมน์ในตาราง

**ตำแหน่ง:** หลังคอลัมน์ "เลขงานจัดส่ง" หรือตำแหน่งที่เหมาะสม
```tsx
{/* Header */}
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
  เอกสารที่แมพ
</th>

{/* Body */}
<td className="px-4 py-3 text-sm">
  {loadlist.mapped_documents && loadlist.mapped_documents.length > 0 ? (
    <div className="space-y-1">
      {loadlist.mapped_documents.map((doc, idx) => (
        <div key={idx} className="flex items-center gap-1">
          {doc.type === 'picklist' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              📋 {doc.code}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              📄 {doc.code}
            </span>
          )}
        </div>
      ))}
    </div>
  ) : (
    <span className="text-gray-400">-</span>
  )}
</td>
```

### 3. UI ที่ต้องการแสดง

| รหัสใบโหลด | เลขงานจัดส่ง | **เอกสารที่แมพ** | ประตูโหลด | ... |
|------------|--------------|------------------|-----------|-----|
| LD-20260112-0001 | S003295 | 📋 PL-20260109-003 | D06 | ... |
| LD-20260112-0002 | FS-001 | 📄 FS-20260108-001 | D07 | ... |
| LD-20260112-0003 | S003296 | - | D08 | ... |
| LD-20260112-0004 | BFS-xxx | 📋 PL-20260107-001 | D09 | ... |

**Legend:**
- 📋 + สีน้ำเงิน = แมพกับ Picklist
- 📄 + สีส้ม = แมพกับ Face Sheet
- `-` = ไม่ได้สร้างจาก BFS (สร้างจาก Picklist/Face Sheet โดยตรง)

---

## 4. Optional: แสดงข้อมูลเพิ่มเติม

### แสดงจำนวน packages ที่แมพ
```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
  📋 {doc.code} 
  <span className="ml-1 text-blue-600">
    ({loadlist.matched_package_count} แพ็ค)
  </span>
</span>
```

### แสดง Tooltip เมื่อ hover
```tsx
<span 
  title={`แมพกับ ${doc.type === 'picklist' ? 'ใบหยิบ' : 'ใบปะหน้า'}: ${doc.code}`}
  className="..."
>
  ...
</span>
```

---

## 5. Checklist

### API:
- [x] แก้ไข GET /api/loadlists ดึง mapping info
- [x] Join ดึงเลขเอกสาร Picklist/Face Sheet ที่แมพ
- [x] Return mapped_documents array

### Frontend:
- [x] เพิ่ม interface MappedDocument (เพิ่มใน Loadlist interface)
- [x] เพิ่มคอลัมน์ "เอกสารที่แมพ" ใน header
- [x] เพิ่ม cell แสดงเลขเอกสารพร้อม badge สี
- [x] แสดง "-" ถ้าไม่มี mapping

---

เริ่มทำงานได้เลยครับ