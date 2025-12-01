# แนวทางการพัฒนาระบบจองและย้ายสต็อคสำหรับ Face Sheets

## ✅ สิ่งที่ทำเสร็จแล้ว

### 1. Database Schema (Migrations 054-056)
- ✅ สร้างตาราง `face_sheet_item_reservations`
- ✅ เพิ่ม columns ใน `face_sheet_items`: `sku_id`, `source_location_id`, `quantity_to_pick`, `quantity_picked`, `status`, `picked_at`, `uom`
- ✅ เพิ่ม columns ใน `face_sheets`: `checker_employee_ids`, `picker_employee_ids`, `picking_started_at`, `picking_completed_at`

### 2. Stock Reservation System (Migration 057)
- ✅ สร้าง function `reserve_stock_for_face_sheet_items` สำหรับจองสต็อค
- ✅ สร้าง trigger `trigger_reserve_stock_after_face_sheet_created` ที่จะจองสต็อคอัตโนมัติหลังสร้าง face sheet
- ✅ ใช้ FEFO/FIFO logic ในการจองสต็อค
- ✅ Map preparation area → zone → locations

### 3. Mobile Pick APIs
- ✅ API `POST /api/mobile/face-sheet/scan` - หยิบสินค้าและย้ายสต็อค
- ✅ API `GET /api/mobile/face-sheet/tasks/[id]` - ดึงข้อมูล face sheet items

### 4. Mobile Pick Page
- ✅ หน้า `/mobile/face-sheet/[id]` - หน้าหยิบสินค้าสำหรับ mobile
- ✅ Employee selection modal สำหรับเลือกพนักงานเช็คและจัดสินค้า
- ✅ แสดงรายการสินค้าแยกตาม package

### 5. Face Sheets List Page
- ✅ API `GET /api/face-sheets/generate` - ดึงข้อมูล face sheets พร้อมข้อมูลพนักงาน
- ✅ หน้า `/receiving/picklists/face-sheets` - แสดงคอลัมพนักงานเช็คและจัดสินค้า

---

## 📋 สิ่งที่ต้องทำต่อ (ถ้ามี)

### ขั้นตอนเพิ่มเติม (Optional)

**ไฟล์:** `supabase/functions/create_face_sheet_packages.sql` (หรือใน migrations)

**สิ่งที่ต้องเพิ่ม:**

```sql
-- หลังจากสร้าง face_sheet_items แล้ว ต้องเพิ่มการจองสต็อค

-- 1. ดึง SKU details และ default_location
FOR item IN (SELECT * FROM face_sheet_items WHERE face_sheet_id = new_face_sheet_id)
LOOP
  -- Get SKU info
  SELECT sku_id, default_location, qty_per_pack
  INTO v_sku_id, v_source_location, v_qty_per_pack
  FROM master_sku
  WHERE sku_id = item.product_code;
  
  -- Update face_sheet_item with sku_id and source_location_id
  UPDATE face_sheet_items
  SET 
    sku_id = v_sku_id,
    source_location_id = v_source_location,
    quantity_to_pick = item.quantity,
    uom = (SELECT uom_base FROM master_sku WHERE sku_id = v_sku_id)
  WHERE id = item.id;
  
  -- 2. Map preparation area → zone → locations
  SELECT zone INTO v_zone
  FROM preparation_area
  WHERE area_code = v_source_location;
  
  SELECT ARRAY_AGG(location_id) INTO v_location_ids
  FROM master_location
  WHERE zone = v_zone;
  
  -- 3. Query balances with FEFO/FIFO
  SELECT balance_id, location_id, total_piece_qty, reserved_piece_qty, 
         production_date, expiry_date
  INTO v_balances
  FROM wms_inventory_balances
  WHERE warehouse_id = p_warehouse_id
    AND location_id = ANY(v_location_ids)
    AND sku_id = v_sku_id
    AND total_piece_qty > 0
  ORDER BY 
    expiry_date ASC NULLS LAST,
    production_date ASC NULLS LAST,
    created_at ASC;
  
  -- 4. Reserve stock
  v_remaining_qty := item.quantity;
  
  FOREACH v_balance IN ARRAY v_balances
  LOOP
    EXIT WHEN v_remaining_qty <= 0;
    
    v_available_qty := v_balance.total_piece_qty - v_balance.reserved_piece_qty;
    CONTINUE WHEN v_available_qty <= 0;
    
    v_qty_to_reserve := LEAST(v_available_qty, v_remaining_qty);
    v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
    
    -- Update inventory balance
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
      reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve
    WHERE balance_id = v_balance.balance_id;
    
    -- Insert reservation record
    INSERT INTO face_sheet_item_reservations (
      face_sheet_item_id,
      balance_id,
      reserved_piece_qty,
      reserved_pack_qty,
      reserved_by,
      status
    ) VALUES (
      item.id,
      v_balance.balance_id,
      v_qty_to_reserve,
      v_pack_to_reserve,
      p_created_by,
      'reserved'
    );
    
    v_remaining_qty := v_remaining_qty - v_qty_to_reserve;
  END LOOP;
  
  -- Check if fully reserved
  IF v_remaining_qty > 0 THEN
    RAISE EXCEPTION 'Insufficient stock for SKU %: need %, available %', 
      v_sku_id, item.quantity, item.quantity - v_remaining_qty;
  END IF;
END LOOP;
```

---

### ขั้นตอนที่ 2: สร้าง API หยิบสินค้า

**ไฟล์:** `app/api/mobile/face-sheet/scan/route.ts`

**คัดลอกจาก:** `app/api/mobile/pick/scan/route.ts`

**สิ่งที่ต้องแก้:**
- เปลี่ยน `picklist` → `face_sheet`
- เปลี่ยน `picklist_items` → `face_sheet_items`
- เปลี่ยน `picklist_item_reservations` → `face_sheet_item_reservations`
- เปลี่ยน `picklists` → `face_sheets`

**ตัวอย่างโค้ด:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      face_sheet_id,
      item_id,
      quantity_picked,
      scanned_code,
      checker_ids,
      picker_ids
    } = await request.json();

    // 1. ดึงข้อมูล face_sheet และ item
    const { data: item, error: itemError } = await supabase
      .from('face_sheet_items')
      .select(`
        *,
        face_sheets!inner(
          id,
          face_sheet_no,
          status,
          warehouse_id
        )
      `)
      .eq('id', item_id)
      .eq('face_sheet_id', face_sheet_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'ไม่พบรายการสินค้า' },
        { status: 404 }
      );
    }

    // 2. ดึงข้อมูลการจอง
    const { data: reservations } = await supabase
      .from('face_sheet_item_reservations')
      .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
      .eq('face_sheet_item_id', item_id)
      .eq('status', 'reserved')
      .order('reservation_id', { ascending: true });

    // 3. ย้ายสต็อคจาก Preparation Area → Dispatch
    // (คัดลอก logic จาก mobile/pick/scan)
    
    // 4. อัปเดตสถานะ
    await supabase
      .from('face_sheet_items')
      .update({
        quantity_picked: quantity_picked,
        status: 'picked',
        picked_at: new Date().toISOString()
      })
      .eq('id', item_id);

    // 5. เช็คว่าหยิบครบทุก item หรือยัง
    const { data: allItems } = await supabase
      .from('face_sheet_items')
      .select('status')
      .eq('face_sheet_id', face_sheet_id);

    const allPicked = allItems?.every(i => i.status === 'picked');

    // 6. อัปเดต face_sheet status
    await supabase
      .from('face_sheets')
      .update({
        status: allPicked ? 'completed' : 'picking',
        ...(allPicked && {
          picking_completed_at: new Date().toISOString(),
          checker_employee_ids: checker_ids,
          picker_employee_ids: picker_ids
        })
      })
      .eq('id', face_sheet_id);

    return NextResponse.json({
      success: true,
      message: 'บันทึกการหยิบสินค้าสำเร็จ'
    });

  } catch (error) {
    console.error('Face sheet scan error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
```

---

### ขั้นตอนที่ 3: สร้าง API ดึงข้อมูล Face Sheet Items

**ไฟล์:** `app/api/mobile/face-sheet/tasks/[id]/route.ts`

**คัดลอกจาก:** `app/api/mobile/pick/tasks/[id]/route.ts`

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('face_sheets')
    .select(`
      id,
      face_sheet_no,
      status,
      warehouse_id,
      face_sheet_items (
        id,
        sku_id,
        product_name,
        quantity_to_pick,
        quantity_picked,
        source_location_id,
        status,
        uom,
        order_id
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

---

### ขั้นตอนที่ 4: สร้างหน้า Mobile Pick

**ไฟล์:** `app/mobile/face-sheet/[id]/page.tsx`

**คัดลอกจาก:** `app/mobile/pick/[id]/page.tsx`

**สิ่งที่ต้องแก้:**
- เปลี่ยน URL endpoints
- เปลี่ยนชื่อตัวแปร picklist → faceSheet
- เปลี่ยน API calls

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';

export default function MobileFaceSheetPickPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [faceSheet, setFaceSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchFaceSheet();
    }
  }, [id]);

  const fetchFaceSheet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/face-sheet/tasks/${id}`);
      const data = await response.json();

      if (response.ok) {
        setFaceSheet(data);
      }
    } catch (error) {
      console.error('Error fetching face sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAll = async (items: any[]) => {
    const unpickedItems = items.filter(item => item.status !== 'picked');
    
    if (unpickedItems.length === 0) {
      alert('รายการทั้งหมดหยิบแล้ว');
      return;
    }

    // แสดง modal เลือกพนักงาน
    setPendingItems(unpickedItems);
    setShowEmployeeModal(true);
  };

  const handleEmployeeConfirm = async (checkerIds: string[], pickerIds: string[]) => {
    setShowEmployeeModal(false);
    
    try {
      setScanning(true);
      let hasError = false;

      for (const item of pendingItems) {
        const response = await fetch('/api/mobile/face-sheet/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            face_sheet_id: faceSheet?.id,
            item_id: item.id,
            quantity_picked: item.quantity_to_pick,
            scanned_code: faceSheet?.face_sheet_no,
            checker_ids: checkerIds,
            picker_ids: pickerIds
          })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(`เกิดข้อผิดพลาด: ${result.error}`);
          hasError = true;
          break;
        }
      }

      if (!hasError) {
        alert('บันทึกการหยิบสำเร็จ');
        fetchFaceSheet();
      }
    } catch (error) {
      console.error('Error picking items:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setScanning(false);
      setPendingItems([]);
    }
  };

  // ... rest of the component (คัดลอกจาก mobile/pick/[id]/page.tsx)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4">
        <h1 className="text-lg font-bold font-thai">{faceSheet?.face_sheet_no}</h1>
      </div>

      {/* Items */}
      <div className="p-3">
        {/* แสดงรายการสินค้า */}
      </div>

      {/* Employee Selection Modal */}
      <EmployeeSelectionModal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false);
          setPendingItems([]);
        }}
        onConfirm={handleEmployeeConfirm}
        title="เลือกพนักงาน"
      />
    </div>
  );
}
```

---

### ขั้นตอนที่ 5: แก้ไขหน้า Face Sheets List

**ไฟล์:** `app/receiving/picklists/face-sheets/page.tsx`

**สิ่งที่ต้องเพิ่ม:**
1. เพิ่มคอลัม "ผู้เช็ค" และ "ผู้จัดสินค้า"
2. แก้ไข API GET ให้ดึงข้อมูลพนักงาน (เหมือน picklists)

```typescript
// ใน API GET /api/face-sheets/generate
if (faceSheets && faceSheets.length > 0) {
  const allEmployeeIds = new Set<number>();
  faceSheets.forEach((sheet: any) => {
    if (sheet.checker_employee_ids) {
      sheet.checker_employee_ids.forEach((id: number) => allEmployeeIds.add(id));
    }
    if (sheet.picker_employee_ids) {
      sheet.picker_employee_ids.forEach((id: number) => allEmployeeIds.add(id));
    }
  });

  if (allEmployeeIds.size > 0) {
    const { data: employees } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name, nickname')
      .in('employee_id', Array.from(allEmployeeIds));

    const employeeMap = new Map(
      employees?.map(emp => [emp.employee_id, emp]) || []
    );

    faceSheets.forEach((sheet: any) => {
      if (sheet.checker_employee_ids) {
        sheet.checker_employees = sheet.checker_employee_ids
          .map((id: number) => employeeMap.get(id))
          .filter(Boolean);
      }
      if (sheet.picker_employee_ids) {
        sheet.picker_employees = sheet.picker_employee_ids
          .map((id: number) => employeeMap.get(id))
          .filter(Boolean);
      }
    });
  }
}
```

---

## 🔑 Key Points ที่ต้องจำ

### 1. การจองสต็อค
- ✅ จองตอนสร้าง Face Sheet (ใน stored procedure)
- ✅ ใช้ FEFO + FIFO
- ✅ บันทึกใน `face_sheet_item_reservations`
- ✅ อัปเดต `reserved_piece_qty` ใน `wms_inventory_balances`

### 2. การย้ายสต็อค
- ✅ ใช้ `balance_id` ที่จองไว้
- ✅ ย้ายจาก Preparation Area → Dispatch
- ✅ Copy `production_date`, `expiry_date`, `lot_no`
- ✅ บันทึก Ledger (OUT + IN)

### 3. Preparation Area Mapping
- ✅ `master_sku.default_location` → `preparation_area.area_code`
- ✅ `preparation_area.zone` → `master_location.zone`
- ✅ Query สต็อคจากทุก location ใน zone

---

## 📝 Checklist การพัฒนา

- [x] สร้าง function `reserve_stock_for_face_sheet_items` สำหรับจองสต็อค
- [x] สร้าง trigger `trigger_reserve_stock_after_face_sheet_created` 
- [x] สร้าง API `POST /api/mobile/face-sheet/scan`
- [x] สร้าง API `GET /api/mobile/face-sheet/tasks/[id]`
- [x] สร้างหน้า `/mobile/face-sheet/[id]`
- [x] แก้ไข API `GET /api/face-sheets/generate` ให้ดึงข้อมูลพนักงาน
- [x] แก้ไขหน้า `/receiving/picklists/face-sheets` ให้แสดงคอลัมพนักงาน
- [ ] ทดสอบการจองสต็อค (ต้องมีข้อมูล master_sku.default_location และ preparation_area)
- [ ] ทดสอบการหยิบสินค้า
- [ ] ทดสอบการย้ายสต็อค

---

## 🚀 วิธีการทดสอบ

### 1. ทดสอบการจองสต็อค
```sql
-- ก่อนสร้าง face sheet
SELECT sku_id, location_id, total_piece_qty, reserved_piece_qty
FROM wms_inventory_balances
WHERE sku_id = 'TEST-SKU-001';

-- สร้าง face sheet

-- หลังสร้าง face sheet
SELECT sku_id, location_id, total_piece_qty, reserved_piece_qty
FROM wms_inventory_balances
WHERE sku_id = 'TEST-SKU-001';

-- ตรวจสอบ reservations
SELECT * FROM face_sheet_item_reservations
WHERE face_sheet_item_id IN (
  SELECT id FROM face_sheet_items WHERE face_sheet_id = ?
);
```

### 2. ทดสอบการหยิบสินค้า
```sql
-- ก่อนหยิบ
SELECT location_id, total_piece_qty FROM wms_inventory_balances
WHERE location_code = 'PK001' AND sku_id = 'TEST-SKU-001';

SELECT location_id, total_piece_qty FROM wms_inventory_balances
WHERE location_code = 'Dispatch' AND sku_id = 'TEST-SKU-001';

-- หยิบสินค้า

-- หลังหยิบ
-- สต็อคที่ PK001 ควรลด
-- สต็อคที่ Dispatch ควรเพิ่ม
-- reserved_piece_qty ควรลด
```

---

## 📚 เอกสารอ้างอิง

- `docs/PICKLIST_STOCK_RESERVATION_FLOW.md` - ระบบจองและย้ายสต็อคของ Picklist (ใช้เป็นแนวทาง)
- `app/api/picklists/create-from-trip/route.ts` - ตัวอย่างการจองสต็อค
- `app/api/mobile/pick/scan/route.ts` - ตัวอย่างการหยิบและย้ายสต็อค
- `app/mobile/pick/[id]/page.tsx` - ตัวอย่างหน้า Mobile Pick
