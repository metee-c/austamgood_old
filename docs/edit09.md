# ภารกิจ: แก้ไข Logic สร้าง Loadlist จาก BFS หลายใบ

## ปัญหาที่พบ

เมื่อเลือก BFS หลายใบแล้วแมพกับ **Picklist เดียวกัน** ระบบสร้าง loadlist **แยกหลายใบ** (1 loadlist ต่อ 1 BFS)

**ตัวอย่าง:**
- เลือก BFS 2 ใบ: BFS-20260107-007, BFS-20260109-001
- แมพกับ Picklist: PL-20260109-001
- **ปัจจุบัน:** สร้าง 2 loadlist (LD-20260109-0019, LD-20260112-0006)
- **ต้องการ:** สร้าง 1 loadlist ที่รวม matched packages จากทุก BFS

---

## Business Logic ที่ถูกต้อง
```
กรณีเลือก BFS หลายใบ + แมพกับเอกสารเดียวกัน (Picklist หรือ Face Sheet):
  → สร้าง 1 loadlist
  → รวม matched_package_ids จากทุก BFS ที่เลือก
  → บันทึก mapping record แยกแต่ละ BFS (wms_loadlist_bonus_face_sheets)

กรณีเลือก BFS หลายใบ + แมพกับเอกสารต่างกัน:
  → สร้างแยก loadlist ตามเอกสารที่แมพ
```

---

## สิ่งที่ต้องแก้ไข

### 1. แก้ไข API: POST /api/loadlists

**ไฟล์:** `app/api/loadlists/route.ts`

**Logic ใหม่:**
```typescript
// รับ request
const {
  bonus_face_sheet_ids,      // [41, 42, 43] - BFS หลายใบ
  bonus_face_sheet_mappings, // [{bfs_id, picklist_id, face_sheet_id}, ...]
  checker_employee_id,
  vehicle_type,
  delivery_number,
  ...
} = await request.json();

// จัดกลุ่ม BFS ตามเอกสารที่แมพ
const groupedByMapping = {};

for (const mapping of bonus_face_sheet_mappings) {
  // สร้าง key จากเอกสารที่แมพ
  const mappingKey = mapping.picklist_id 
    ? `picklist_${mapping.picklist_id}`
    : `face_sheet_${mapping.face_sheet_id}`;
  
  if (!groupedByMapping[mappingKey]) {
    groupedByMapping[mappingKey] = {
      mapping_type: mapping.picklist_id ? 'picklist' : 'face_sheet',
      mapped_picklist_id: mapping.picklist_id || null,
      mapped_face_sheet_id: mapping.face_sheet_id || null,
      bfs_list: []
    };
  }
  
  groupedByMapping[mappingKey].bfs_list.push(mapping.bonus_face_sheet_id);
}

// สร้าง loadlist ตามกลุ่ม (1 loadlist ต่อ 1 เอกสารที่แมพ)
const createdLoadlists = [];

for (const [mappingKey, group] of Object.entries(groupedByMapping)) {
  // 1. คำนวณ matched_package_ids รวมจากทุก BFS ในกลุ่ม
  let allMatchedPackageIds = [];
  
  for (const bfsId of group.bfs_list) {
    const matchedIds = await getMatchedPackageIds(
      bfsId, 
      group.mapped_picklist_id, 
      group.mapped_face_sheet_id
    );
    allMatchedPackageIds.push(...matchedIds);
  }
  
  // 2. ตรวจสอบว่ามี matched packages หรือไม่
  if (allMatchedPackageIds.length === 0) {
    throw new Error('ไม่พบรหัสลูกค้าที่ตรงกัน');
  }
  
  // 3. สร้าง loadlist 1 ใบ
  const { data: loadlist } = await supabase
    .from('loadlists')
    .insert({
      loadlist_code: generateLoadlistCode(),
      checker_employee_id,
      vehicle_type,
      delivery_number,
      status: 'pending',
      // ...
    })
    .select()
    .single();
  
  // 4. สร้าง mapping records สำหรับแต่ละ BFS
  for (const bfsId of group.bfs_list) {
    // คำนวณ matched_package_ids เฉพาะ BFS นี้
    const matchedIds = await getMatchedPackageIds(
      bfsId,
      group.mapped_picklist_id,
      group.mapped_face_sheet_id
    );
    
    await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .insert({
        loadlist_id: loadlist.id,
        bonus_face_sheet_id: bfsId,
        mapping_type: group.mapping_type,
        mapped_picklist_id: group.mapped_picklist_id,
        mapped_face_sheet_id: group.mapped_face_sheet_id,
        matched_package_ids: matchedIds
      });
  }
  
  createdLoadlists.push(loadlist);
}

return NextResponse.json({ 
  success: true, 
  loadlists: createdLoadlists,
  message: `สร้างใบโหลด ${createdLoadlists.length} ใบ`
});
```

### 2. แก้ไข Frontend: UI สำหรับเลือก BFS หลายใบ

**ไฟล์:** `app/receiving/loadlists/page.tsx`

**ตรวจสอบว่า UI รองรับ:**
```typescript
// ตรวจสอบว่าทุก BFS ที่เลือกแมพกับเอกสารเดียวกันหรือไม่
const validateMappings = () => {
  const selectedBFSMappings = selectedBonusFaceSheets.map(bfsId => {
    return bonusFaceSheetMappings[bfsId];
  });
  
  // หา unique mapping targets
  const uniquePicklists = [...new Set(selectedBFSMappings.map(m => m?.picklist_id).filter(Boolean))];
  const uniqueFaceSheets = [...new Set(selectedBFSMappings.map(m => m?.face_sheet_id).filter(Boolean))];
  
  // ถ้าเลือก Picklist/Face Sheet หลายตัว → แจ้งเตือน
  if (uniquePicklists.length > 1 || uniqueFaceSheets.length > 1) {
    alert('เลือกเอกสารแมพหลายตัว จะสร้างใบโหลดแยกตามเอกสารที่แมพ');
  }
};
```

---

## 3. ตัวอย่าง Flow ที่ถูกต้อง

### Case 1: เลือก BFS หลายใบ + Picklist เดียวกัน
```
Input:
- BFS: [BFS-001, BFS-002, BFS-003]
- แมพกับ: PL-001 (ทุกตัว)

Process:
- จัดกลุ่ม: { picklist_1: [BFS-001, BFS-002, BFS-003] }
- สร้าง 1 loadlist

Output:
- LD-001 (รวม BFS 3 ใบ แมพกับ PL-001)
```

### Case 2: เลือก BFS หลายใบ + Picklist ต่างกัน
```
Input:
- BFS-001 แมพกับ PL-001
- BFS-002 แมพกับ PL-002
- BFS-003 แมพกับ PL-001

Process:
- จัดกลุ่ม: { 
    picklist_1: [BFS-001, BFS-003],
    picklist_2: [BFS-002]
  }
- สร้าง 2 loadlist

Output:
- LD-001 (BFS-001 + BFS-003 แมพกับ PL-001)
- LD-002 (BFS-002 แมพกับ PL-002)
```

---

## 4. Database Records ที่ถูกต้อง

**loadlists:**
```
| id  | loadlist_code      | delivery_number |
|-----|-------------------|-----------------|
| 150 | LD-20260112-0001  | BFS-xxx         |
```

**wms_loadlist_bonus_face_sheets:**
```
| loadlist_id | bonus_face_sheet_id | mapped_picklist_id | matched_package_ids |
|-------------|---------------------|-------------------|---------------------|
| 150         | 41 (BFS-001)        | 10 (PL-001)       | [1, 2, 3]           |
| 150         | 42 (BFS-002)        | 10 (PL-001)       | [5, 6]              |
| 150         | 43 (BFS-003)        | 10 (PL-001)       | [8, 9, 10]          |
```

---

## 5. Checklist

### API:
- [ ] แก้ไข POST /api/loadlists
  - [ ] จัดกลุ่ม BFS ตามเอกสารที่แมพ
  - [ ] สร้าง 1 loadlist ต่อ 1 กลุ่ม
  - [ ] บันทึก mapping records แยกแต่ละ BFS
  - [ ] รวม matched_package_ids จากทุก BFS ในกลุ่ม

### Frontend:
- [ ] ตรวจสอบว่า UI ส่ง mappings ถูกต้อง
- [ ] แจ้งเตือนถ้าเลือกเอกสารแมพหลายตัว

### Print APIs:
- [ ] ตรวจสอบว่า print/pick-list รองรับ loadlist ที่มีหลาย BFS

---

## 6. ตัวอย่างผลลัพธ์

**ก่อนแก้ไข:**
```
เลือก 2 BFS แมพ PL-001 → สร้าง 2 loadlist
- LD-001 (BFS-001 / PL-001)
- LD-002 (BFS-002 / PL-001)  ← ผิด
```

**หลังแก้ไข:**
```
เลือก 2 BFS แมพ PL-001 → สร้าง 1 loadlist
- LD-001 (BFS-001 + BFS-002 / PL-001)  ← ถูก
```

---

## 7. สถานะการแก้ไข

### ✅ TASK 1: แก้ไข API POST /api/loadlists (DONE)
- แก้ไข logic จัดกลุ่ม BFS ตามเอกสารที่แมพ
- สร้าง 1 loadlist ต่อ 1 กลุ่ม
- บันทึก mapping records แยกแต่ละ BFS

### ✅ TASK 2: เพิ่ม Tooltip/Popover ใน PrepAreaModal (DONE)
- เพิ่ม click handler สำหรับ package boxes
- แสดงรายละเอียด: ร้าน, BFS เลขที่, สายรถ, Hub

### ✅ TASK 3: เพิ่มเลขเอกสารที่แมพในฟอร์มปริ้นใบโหลด (DONE)
- เพิ่ม `mapped_documents` ใน Loadlist type
- แสดงเลขเอกสาร (picklist_code หรือ face_sheet_no) พร้อมจำนวนแพ็ค

### ✅ TASK 4: แก้ไข Loadlists ถูก void ผิดพลาดจาก Rollback Order (DONE)

**สาเหตุ:** Function `find_empty_loadlists()` ไม่ได้ตรวจสอบ `wms_loadlist_bonus_face_sheets` ทำให้ loadlists ที่มีแค่ bonus face sheets ถูกมองว่า "empty" และถูก void ไปตอน rollback order

**แก้ไขแล้ว:**
1. Migration `fix_find_empty_loadlists_and_restore_voided_v2` - แก้ไข function และ restore loadlists ที่ถูก void ผิดพลาด
2. Migration `fix_loadlist_status_with_ship_transactions` - อัพเดท loadlists ที่มี ship transactions ให้เป็น `loaded` (44 รายการ)
3. Migration `restore_voided_loadlists_with_ship_transactions` - Restore loadlists ที่ถูก void แต่มี ship transactions (2 รายการ: LD-20260109-0001, LD-20260109-0002)
4. Migration `restore_loadlist_status_from_audit_log` - Restore 8 loadlists ที่เคยเป็น loaded ก่อน rollback จาก `process_state_audit_log`

**ผลลัพธ์:**
- Loadlists ทั้งหมด 47 รายการที่มี ship transactions ตอนนี้มีสถานะ `loaded`
- Function `find_empty_loadlists()` ตรวจสอบ `wms_loadlist_bonus_face_sheets` แล้ว

### ✅ TASK 5: แสดงเลข Loadlist ของแถม (MR PQ) ในฟอร์มปริ้นใบโหลด (DONE)

**ความต้องการ:**
- เมื่อปริ้น loadlist ที่สร้างจาก trip/picklist (เช่น `LD-20260110-0001`)
- ต้องแสดงเลข loadlist ที่สร้างจาก BFS ที่แมพกับ picklist เดียวกัน (เช่น `LD-20260112-0006`)

**แก้ไขแล้ว:**
1. **API GET /api/loadlists** - เพิ่ม `related_bfs_loadlists` field
   - ดึง loadlist ที่สร้างจาก BFS ที่แมพกับ picklist เดียวกัน
   - ใช้ `wms_loadlist_bonus_face_sheets.mapped_picklist_id` เพื่อหาความสัมพันธ์
2. **DeliveryOrderDocument.tsx** - แสดง "ใบโหลดของแถม (MR PQ)" ในส่วน Reference Info Section

**ตัวอย่าง:**
- `LD-20260110-0001` (สร้างจาก trip, picklist `PL-20260109-001`)
- `LD-20260112-0006` (สร้างจาก BFS ที่แมพกับ `PL-20260109-001`)
- เมื่อปริ้น `LD-20260110-0001` จะแสดง "ใบโหลดของแถม (MR PQ): LD-20260112-0006"

---

## 8. Migrations ที่สร้าง

| Migration | วัตถุประสงค์ |
|-----------|-------------|
| `fix_find_empty_loadlists_and_restore_voided_v2` | แก้ไข function และ restore loadlists ที่ถูก void ผิดพลาด |
| `fix_loadlist_status_with_ship_transactions` | อัพเดท loadlists ที่มี ship transactions เป็น loaded |
| `restore_voided_loadlists_with_ship_transactions` | Restore voided loadlists ที่มี ship transactions |
| `restore_loadlist_status_from_audit_log` | Restore 8 loadlists จาก audit log |

---

เสร็จสิ้นการแก้ไขทั้งหมดแล้วครับ