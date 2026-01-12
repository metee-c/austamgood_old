# ภารกิจ: ตรวจสอบและแก้ไขสถานะ BFS ที่ไม่ตรงกัน

## ปัญหาที่รายงาน

| หน้า | URL |
|------|-----|
| Bonus Face Sheets | http://localhost:3000/receiving/picklists/bonus-face-sheets |
| Mobile Pick | http://localhost:3000/mobile/pick |

**อาการ:** สถานะ BFS แสดงไม่ตรงกันในแต่ละหน้า

---

## Phase 0: ตรวจสอบด้วย MCP

### 0.1 ดูสถานะ BFS ทั้งหมดในระบบ
```sql
-- ดูสถานะ BFS ล่าสุด 20 รายการ
SELECT 
  id,
  face_sheet_no,
  status,
  pick_status,
  created_at,
  updated_at
FROM bonus_face_sheets
ORDER BY created_at DESC
LIMIT 20;
```

### 0.2 ดู Packages และ Items Status
```sql
-- ดูสถานะ packages และ items ของแต่ละ BFS
SELECT 
  bfs.id,
  bfs.face_sheet_no,
  bfs.status as bfs_status,
  bfs.pick_status,
  COUNT(DISTINCT p.id) as total_packages,
  COUNT(DISTINCT CASE WHEN p.status = 'pending' THEN p.id END) as pending_packages,
  COUNT(DISTINCT CASE WHEN p.status = 'picked' THEN p.id END) as picked_packages,
  COUNT(DISTINCT CASE WHEN p.status = 'shipped' THEN p.id END) as shipped_packages,
  COUNT(i.id) as total_items,
  COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_items,
  COUNT(CASE WHEN i.status = 'picked' THEN 1 END) as picked_items
FROM bonus_face_sheets bfs
LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
LEFT JOIN bonus_face_sheet_items i ON i.package_id = p.id
GROUP BY bfs.id, bfs.face_sheet_no, bfs.status, bfs.pick_status
ORDER BY bfs.created_at DESC
LIMIT 20;
```

### 0.3 ตรวจสอบ BFS ที่สถานะไม่สอดคล้องกัน
```sql
-- หา BFS ที่สถานะ BFS กับ packages/items ไม่ตรงกัน
WITH bfs_stats AS (
  SELECT 
    bfs.id,
    bfs.face_sheet_no,
    bfs.status as bfs_status,
    bfs.pick_status,
    COUNT(DISTINCT p.id) as total_packages,
    COUNT(DISTINCT CASE WHEN p.status = 'picked' OR p.status = 'shipped' THEN p.id END) as completed_packages,
    COUNT(i.id) as total_items,
    COUNT(CASE WHEN i.status = 'picked' THEN 1 END) as picked_items
  FROM bonus_face_sheets bfs
  LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
  LEFT JOIN bonus_face_sheet_items i ON i.package_id = p.id
  GROUP BY bfs.id, bfs.face_sheet_no, bfs.status, bfs.pick_status
)
SELECT 
  *,
  CASE 
    WHEN total_packages = 0 THEN 'empty'
    WHEN completed_packages = total_packages THEN 'should_be_completed'
    WHEN completed_packages > 0 THEN 'should_be_in_progress'
    ELSE 'should_be_pending'
  END as expected_status,
  CASE 
    WHEN total_items = 0 THEN 'empty'
    WHEN picked_items = total_items THEN 'should_be_picked'
    WHEN picked_items > 0 THEN 'should_be_partial'
    ELSE 'should_be_pending'
  END as expected_pick_status
FROM bfs_stats
WHERE 
  -- หาที่สถานะไม่ตรง
  (bfs_status = 'completed' AND completed_packages < total_packages)
  OR (bfs_status = 'pending' AND completed_packages > 0)
  OR (bfs_status = 'picked' AND picked_items < total_items)
  OR (pick_status = 'picked' AND picked_items < total_items)
  OR (pick_status = 'pending' AND picked_items > 0);
```

### 0.4 ตรวจสอบ API ที่แต่ละหน้าใช้
```bash
# หา API ที่หน้า bonus-face-sheets ใช้
grep -r "bonus-face-sheet\|bfs" --include="*.tsx" app/receiving/picklists/bonus-face-sheets/

# หา API ที่หน้า mobile pick ใช้
grep -r "bonus-face-sheet\|bfs" --include="*.tsx" app/mobile/pick/
```

### 0.5 เปรียบเทียบ API Response
```sql
-- ดูข้อมูลที่ API bonus-face-sheets น่าจะส่ง
SELECT 
  bfs.id,
  bfs.face_sheet_no,
  bfs.status,
  bfs.pick_status,
  (
    SELECT COUNT(*) 
    FROM bonus_face_sheet_packages p 
    WHERE p.face_sheet_id = bfs.id
  ) as package_count,
  (
    SELECT COUNT(*) 
    FROM bonus_face_sheet_packages p 
    WHERE p.face_sheet_id = bfs.id AND p.status = 'picked'
  ) as picked_package_count
FROM bonus_face_sheets bfs
WHERE bfs.face_sheet_no = 'BFS-XXXXXXXX-XXX'; -- ใส่เลข BFS ที่มีปัญหา
```

---

## Phase 1: วิเคราะห์ปัญหา

### 1.1 สรุปข้อมูลที่พบ

**บันทึก:**
```
BFS ที่มีปัญหา:
| BFS No | สถานะในหน้า BFS | สถานะใน Mobile | สถานะจริงใน DB |
|--------|-----------------|----------------|----------------|
| ___ | ___ | ___ | ___ |
```

### 1.2 หาสาเหตุ

**สาเหตุที่เป็นไปได้:**
```
□ 1. แต่ละหน้าดึงจาก column ต่างกัน (status vs pick_status)
□ 2. แต่ละหน้าคำนวณสถานะด้วย logic ต่างกัน
□ 3. มี field ที่ไม่ได้อัพเดทพร้อมกัน
□ 4. Trigger/Function ไม่ sync สถานะ
□ 5. Cache ที่ไม่ refresh
□ 6. อื่นๆ: ___
```

---

## Phase 2: ตรวจสอบโค้ด

### 2.1 ดู API หน้า Bonus Face Sheets
```bash
# หา route.ts ที่เกี่ยวข้อง
find . -path "*api*bonus-face-sheet*" -name "route.ts" 2>/dev/null
```

### 2.2 ดู API หน้า Mobile Pick
```bash
# หา route.ts ที่เกี่ยวข้อง
find . -path "*api*mobile*pick*" -name "route.ts" 2>/dev/null
find . -path "*api*mobile*bonus*" -name "route.ts" 2>/dev/null
```

### 2.3 เปรียบเทียบ Logic

**หน้า Bonus Face Sheets:**
```
- API Endpoint: ___
- Field ที่ใช้แสดงสถานะ: ___
- Logic คำนวณ: ___
```

**หน้า Mobile Pick:**
```
- API Endpoint: ___
- Field ที่ใช้แสดงสถานะ: ___
- Logic คำนวณ: ___
```

---

## Phase 3: แก้ไข

### 3.1 Sync สถานะ BFS ให้ถูกต้อง
```sql
-- อัพเดทสถานะ BFS ตามสถานะ packages/items จริง
WITH bfs_actual_status AS (
  SELECT 
    bfs.id,
    COUNT(DISTINCT p.id) as total_packages,
    COUNT(DISTINCT CASE WHEN p.status IN ('picked', 'shipped') THEN p.id END) as completed_packages,
    COUNT(i.id) as total_items,
    COUNT(CASE WHEN i.status = 'picked' THEN 1 END) as picked_items
  FROM bonus_face_sheets bfs
  LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
  LEFT JOIN bonus_face_sheet_items i ON i.package_id = p.id
  GROUP BY bfs.id
)
UPDATE bonus_face_sheets bfs
SET 
  status = CASE 
    WHEN s.total_packages = 0 THEN 'pending'
    WHEN s.completed_packages = s.total_packages THEN 'completed'
    WHEN s.completed_packages > 0 THEN 'in_progress'
    ELSE 'pending'
  END,
  pick_status = CASE 
    WHEN s.total_items = 0 THEN 'pending'
    WHEN s.picked_items = s.total_items THEN 'picked'
    WHEN s.picked_items > 0 THEN 'partial'
    ELSE 'pending'
  END,
  updated_at = NOW()
FROM bfs_actual_status s
WHERE bfs.id = s.id;
```

### 3.2 แก้ไข API ให้ใช้ Logic เดียวกัน (ถ้าจำเป็น)

**Template:**
```typescript
// สร้าง shared function สำหรับคำนวณสถานะ
function calculateBfsStatus(bfs: any): {
  status: string;
  pick_status: string;
} {
  const totalPackages = bfs.packages?.length || 0;
  const completedPackages = bfs.packages?.filter(
    (p: any) => p.status === 'picked' || p.status === 'shipped'
  ).length || 0;
  
  const totalItems = bfs.packages?.reduce(
    (sum: number, p: any) => sum + (p.items?.length || 0), 0
  ) || 0;
  const pickedItems = bfs.packages?.reduce(
    (sum: number, p: any) => sum + (p.items?.filter((i: any) => i.status === 'picked').length || 0), 0
  ) || 0;

  return {
    status: totalPackages === 0 ? 'pending' :
            completedPackages === totalPackages ? 'completed' :
            completedPackages > 0 ? 'in_progress' : 'pending',
    pick_status: totalItems === 0 ? 'pending' :
                 pickedItems === totalItems ? 'picked' :
                 pickedItems > 0 ? 'partial' : 'pending'
  };
}
```

### 3.3 สร้าง Trigger เพื่อ Sync อัตโนมัติ (ถ้ายังไม่มี)
```sql
-- Trigger อัพเดทสถานะ BFS เมื่อ package/item เปลี่ยน
CREATE OR REPLACE FUNCTION update_bfs_status()
RETURNS TRIGGER AS $$
DECLARE
  v_face_sheet_id INTEGER;
  v_total_packages INTEGER;
  v_completed_packages INTEGER;
  v_total_items INTEGER;
  v_picked_items INTEGER;
BEGIN
  -- หา face_sheet_id
  IF TG_TABLE_NAME = 'bonus_face_sheet_packages' THEN
    v_face_sheet_id := COALESCE(NEW.face_sheet_id, OLD.face_sheet_id);
  ELSIF TG_TABLE_NAME = 'bonus_face_sheet_items' THEN
    SELECT p.face_sheet_id INTO v_face_sheet_id
    FROM bonus_face_sheet_packages p
    WHERE p.id = COALESCE(NEW.package_id, OLD.package_id);
  END IF;

  IF v_face_sheet_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- คำนวณสถานะ
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status IN ('picked', 'shipped') THEN 1 END)
  INTO v_total_packages, v_completed_packages
  FROM bonus_face_sheet_packages
  WHERE face_sheet_id = v_face_sheet_id;

  SELECT 
    COUNT(*),
    COUNT(CASE WHEN i.status = 'picked' THEN 1 END)
  INTO v_total_items, v_picked_items
  FROM bonus_face_sheet_items i
  JOIN bonus_face_sheet_packages p ON p.id = i.package_id
  WHERE p.face_sheet_id = v_face_sheet_id;

  -- อัพเดท BFS
  UPDATE bonus_face_sheets
  SET 
    status = CASE 
      WHEN v_total_packages = 0 THEN 'pending'
      WHEN v_completed_packages = v_total_packages THEN 'completed'
      WHEN v_completed_packages > 0 THEN 'in_progress'
      ELSE 'pending'
    END,
    pick_status = CASE 
      WHEN v_total_items = 0 THEN 'pending'
      WHEN v_picked_items = v_total_items THEN 'picked'
      WHEN v_picked_items > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = v_face_sheet_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- สร้าง triggers
DROP TRIGGER IF EXISTS trigger_update_bfs_status_on_package ON bonus_face_sheet_packages;
CREATE TRIGGER trigger_update_bfs_status_on_package
  AFTER INSERT OR UPDATE OR DELETE ON bonus_face_sheet_packages
  FOR EACH ROW EXECUTE FUNCTION update_bfs_status();

DROP TRIGGER IF EXISTS trigger_update_bfs_status_on_item ON bonus_face_sheet_items;
CREATE TRIGGER trigger_update_bfs_status_on_item
  AFTER INSERT OR UPDATE OR DELETE ON bonus_face_sheet_items
  FOR EACH ROW EXECUTE FUNCTION update_bfs_status();
```

---

## Phase 4: ทดสอบ

### Test Cases
```
□ เปิดหน้า Bonus Face Sheets - ดูสถานะ BFS-XXX
□ เปิดหน้า Mobile Pick - ดูสถานะ BFS-XXX เดียวกัน
□ สถานะตรงกัน ✅/❌

□ หยิบ item ใน Mobile → สถานะเปลี่ยนทั้ง 2 หน้า ✅/❌
□ หยิบครบ → สถานะเป็น 'picked' ทั้ง 2 หน้า ✅/❌
```

---

## Checklist
```
Phase 0: ตรวจสอบด้วย MCP
□ 0.1 ดูสถานะ BFS ในระบบ
□ 0.2 ดู packages/items status
□ 0.3 หา BFS ที่สถานะไม่สอดคล้อง
□ 0.4 ตรวจสอบ API ที่ใช้
□ 0.5 เปรียบเทียบข้อมูล

Phase 1: วิเคราะห์
□ 1.1 สรุปข้อมูลที่พบ
□ 1.2 หาสาเหตุ

Phase 2: ตรวจสอบโค้ด
□ 2.1 ดู API หน้า BFS
□ 2.2 ดู API หน้า Mobile
□ 2.3 เปรียบเทียบ logic

Phase 3: แก้ไข
□ 3.1 Sync สถานะให้ถูกต้อง
□ 3.2 แก้ไข API (ถ้าจำเป็น)
□ 3.3 สร้าง Trigger (ถ้ายังไม่มี)

Phase 4: ทดสอบ
□ สถานะตรงกันทั้ง 2 หน้า
□ เปลี่ยนสถานะแล้ว sync ทันที
```

---

เริ่มจาก **Phase 0** ก่อน!
ช่วยระบุเลข BFS ที่มีปัญหาตัวอย่างด้วยครับ จะได้ตรวจสอบได้ตรงจุด!