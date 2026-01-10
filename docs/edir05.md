# ภารกิจ: Debug หน้าต่าง "พิมพ์ใบเช็คของแถม" ไม่แสดงข้อมูล

## ปัญหาที่พบ

Modal "พิมพ์ใบเช็คของแถม: BFS-20260109-001" โหลดข้อมูลไม่ขึ้น:
- แสดง "กำลังโหลดข้อมูล..." ค้างอยู่
- แสดง "0/0" รายการ
- API return 200 OK แต่ UI ไม่แสดงข้อมูล

**API Log:**
```
GET /api/bonus-face-sheets/mapped-face-sheets?loadlist_id=140&bonus_face_sheet_id=41 200 in 312ms
```

---

## ขั้นตอนการ Debug

### 1. ตรวจสอบ API Response

**ไฟล์:** `app/api/bonus-face-sheets/mapped-face-sheets/route.ts`
```bash
# ทดสอบ API โดยตรง
curl "http://localhost:3000/api/bonus-face-sheets/mapped-face-sheets?loadlist_id=140&bonus_face_sheet_id=41"
```

**ตรวจสอบ:**
- API return อะไรกลับมา?
- เป็น empty array `[]` หรือไม่?
- Format ถูกต้องตามที่ frontend คาดหวังไหม?

### 2. เพิ่ม Debug Log ใน API
```typescript
// ใน mapped-face-sheets/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const loadlist_id = searchParams.get('loadlist_id');
  const bonus_face_sheet_id = searchParams.get('bonus_face_sheet_id');

  console.log('=== DEBUG mapped-face-sheets ===');
  console.log('loadlist_id:', loadlist_id);
  console.log('bonus_face_sheet_id:', bonus_face_sheet_id);

  // ... existing code ...

  console.log('Result:', JSON.stringify(result, null, 2));
  
  return NextResponse.json(result);
}
```

### 3. ตรวจสอบ Logic ใน API

**คำถาม:**
- API ดึงข้อมูล face sheets ที่แมพกับ BFS นี้อย่างไร?
- ใช้ `mapped_face_sheet_id` จาก `wms_loadlist_bonus_face_sheets` หรือไม่?
- หรือใช้ logic อื่น?
```sql
-- ตรวจสอบข้อมูลใน database
SELECT * FROM wms_loadlist_bonus_face_sheets 
WHERE loadlist_id = 140 AND bonus_face_sheet_id = 41;

-- ดูว่ามี mapped_face_sheet_id หรือ mapped_picklist_id
SELECT 
  id,
  loadlist_id,
  bonus_face_sheet_id,
  mapped_picklist_id,
  mapped_face_sheet_id,
  mapping_type,
  matched_package_ids
FROM wms_loadlist_bonus_face_sheets 
WHERE loadlist_id = 140;
```

### 4. ตรวจสอบ Frontend

**ไฟล์:** `app/receiving/loadlists/page.tsx`

หา function ที่เรียก API นี้:
```typescript
// หา code ที่เรียก mapped-face-sheets API
const fetchMappedFaceSheets = async () => {
  const response = await fetch(
    `/api/bonus-face-sheets/mapped-face-sheets?loadlist_id=${loadlistId}&bonus_face_sheet_id=${bfsId}`
  );
  const data = await response.json();
  
  console.log('Mapped Face Sheets:', data); // เพิ่ม debug
  
  // ตรวจสอบว่า set state ถูกต้องไหม
  setMappedFaceSheets(data);
};
```

### 5. ปัญหาที่เป็นไปได้

| สาเหตุ | วิธีตรวจสอบ |
|--------|-------------|
| API return empty array | ดู console.log ใน API |
| ไม่มี mapped_face_sheet_id | ดู database - อาจแมพกับ Picklist แทน |
| Logic ผิด | API อาจหา face sheets ผิดวิธี |
| Frontend ไม่ set state | ดู console.log ใน frontend |
| Loading state ไม่ถูก reset | setLoading(false) อาจไม่ถูกเรียก |

---

## 6. สาเหตุที่น่าจะเป็นไปได้มากที่สุด

จากที่เพิ่งแก้ไข edit04.md ไป loadlist ที่สร้างใหม่ **อาจแมพกับ Picklist ไม่ใช่ Face Sheet**

ดังนั้น `mapped_face_sheet_id` จะเป็น `null` และ API หา face sheets ไม่เจอ

### วิธีแก้ไข:

API `mapped-face-sheets` ควรรองรับทั้ง 2 กรณี:
```typescript
// กรณีแมพกับ Face Sheet
if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
  // ดึง face sheet ที่แมพ
}

// กรณีแมพกับ Picklist - ต้องหา face sheets ที่มี customer_id ตรงกับ matched packages
if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
  // ดึง matched_package_ids
  // หา customer_ids จาก packages เหล่านั้น
  // หา face sheets ที่มี packages ของ customer_id เหล่านั้น
}
```

---

## 7. แก้ไข API mapped-face-sheets

**ไฟล์:** `app/api/bonus-face-sheets/mapped-face-sheets/route.ts`
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const loadlist_id = searchParams.get('loadlist_id');
  const bonus_face_sheet_id = searchParams.get('bonus_face_sheet_id');

  // ดึง mapping info
  const { data: mapping } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select('*')
    .eq('loadlist_id', loadlist_id)
    .eq('bonus_face_sheet_id', bonus_face_sheet_id)
    .single();

  if (!mapping) {
    return NextResponse.json([]);
  }

  let faceSheets = [];

  // กรณีแมพกับ Face Sheet โดยตรง
  if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
    const { data } = await supabase
      .from('face_sheets')
      .select('id, face_sheet_no, ...')
      .eq('id', mapping.mapped_face_sheet_id);
    
    faceSheets = data || [];
  }
  
  // กรณีแมพกับ Picklist - ต้องหาวิธีแสดงข้อมูล
  else if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
    // Option 1: แสดง Picklist แทน Face Sheet
    // Option 2: หา Face Sheet ที่มี customer_id ตรงกัน
    // Option 3: แสดงข้อความว่า "แมพกับใบหยิบ ไม่ใช่ใบปะหน้า"
    
    // ตัวอย่าง: ดึง Picklist info แทน
    const { data: picklist } = await supabase
      .from('picklists')
      .select('id, picklist_code, ...')
      .eq('id', mapping.mapped_picklist_id)
      .single();
    
    // Return ในรูปแบบที่ frontend เข้าใจ
    faceSheets = [{
      id: picklist.id,
      face_sheet_no: picklist.picklist_code, // ใช้ field เดียวกัน
      is_picklist: true, // flag บอกว่าเป็น picklist
      // ... other fields
    }];
  }

  return NextResponse.json(faceSheets);
}
```

---

## 8. Checklist

- [ ] ตรวจสอบ API response ด้วย curl หรือ console.log
- [ ] ตรวจสอบ database ว่า loadlist 140 แมพกับอะไร (Picklist หรือ Face Sheet)
- [ ] ถ้าแมพกับ Picklist - แก้ไข API ให้รองรับ
- [ ] ถ้าแมพกับ Face Sheet - หาว่าทำไม query ไม่เจอ
- [ ] ตรวจสอบ frontend ว่า set state ถูกต้อง
- [ ] ทดสอบอีกครั้ง

---

เริ่ม debug ได้เลยครับ รายงานผลที่พบ