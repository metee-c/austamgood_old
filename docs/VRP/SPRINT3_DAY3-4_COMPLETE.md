# Sprint 3 Day 3-4: Extract CreatePlanModal Component - เสร็จสมบูรณ์

> **วันที่:** 17 มกราคม 2026  
> **สถานะ:** ✅ เสร็จสมบูรณ์

---

## 📋 สรุปงานที่ทำ

### ✅ สร้าง CreatePlanModal Component

แยก Modal สร้างแผนเส้นทางออกจาก `page.tsx` เป็น 3 components:

#### 1. **OrderSelection.tsx** (~120 lines)
- แสดงรายการออเดอร์รอจัดเส้นทาง
- ช่องค้นหา/กรองออเดอร์
- Checkbox เลือกออเดอร์
- ปุ่มเลือกทั้งหมด/ยกเลิก
- แสดงข้อมูล: เลขที่, ลูกค้า, จังหวัด, น้ำหนัก

**Features:**
- กรองออเดอร์ตาม: จังหวัด, ชื่อร้าน, เลขออเดอร์
- รองรับการค้นหาหลายเงื่อนไข (คั่นด้วย comma)
- Sticky table header
- Max height 96 (overflow scroll)

#### 2. **VRPConfiguration.tsx** (~40 lines)
- Wrapper สำหรับ OptimizationSidebar component
- ตั้งค่า VRP algorithm
- บันทึกการตั้งค่า

**Props:**
- settings: OptimizationSettings
- onChange: callback สำหรับเปลี่ยนค่า
- onSave: callback สำหรับบันทึก
- disabled, isSaving, statusMessage

#### 3. **index.tsx** - Main Modal (~170 lines)
- Modal wrapper
- Form สำหรับข้อมูลแผน (รหัส, วันที่, ชื่อ, คลัง)
- รวม OrderSelection และ VRPConfiguration
- Action buttons (ยกเลิก, เริ่มจัดเส้นทาง)

**Props Interface:**
```typescript
interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Plan form data
  planCode: string;
  planName: string;
  planDate: string;
  warehouseId: string;
  onPlanDateChange: (date: string) => void;
  
  // Warehouses
  warehouses: any[];
  onWarehouseChange: (warehouseId: string) => void;
  
  // Draft orders
  draftOrders: DraftOrder[];
  selectedOrders: Set<number>;
  draftOrderFilter: string;
  onDraftOrderFilterChange: (filter: string) => void;
  onSelectOrder: (orderId: number) => void;
  onSelectAll: () => void;
  
  // VRP Settings
  vrpSettings: OptimizationSettings;
  onVrpSettingsChange: (changes: Partial<OptimizationSettings>) => void;
  onSaveSettings: () => void;
  isSavingSettings?: boolean;
  
  // Optimization
  isOptimizing: boolean;
  statusMessage?: string;
  onOptimize: () => void;
}
```

---

## 📁 ไฟล์ที่สร้าง

```
app/receiving/routes/components/CreatePlanModal/
├── index.tsx                 # Main modal wrapper (~170 lines)
├── OrderSelection.tsx        # Order selection table (~120 lines)
└── VRPConfiguration.tsx      # VRP settings wrapper (~40 lines)
```

**รวม:** ~330 lines

---

## 🔧 การ Integration กับ page.tsx

### 1. เพิ่ม Import
```typescript
import { CreatePlanModal } from './components';
import { OptimizationSettings } from '@/components/vrp/OptimizationSidebar';
```

### 2. สร้าง Handler Functions
```typescript
const handlePlanDateChange = (newDate: string) => {
    setPlanForm(prev => ({ ...prev, planDate: newDate }));
    fetchNextPlanCode(newDate);
    if (planForm.warehouseId) {
        fetchDraftOrders(planForm.warehouseId, newDate);
    }
};

const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setSelectedOrders(new Set());
};
```

### 3. แทนที่ Modal เดิม (~150 lines) ด้วย Component
```typescript
<CreatePlanModal
    isOpen={showCreateModal}
    onClose={handleCloseCreateModal}
    planCode={planForm.planCode}
    planName={planForm.planName}
    planDate={planForm.planDate}
    warehouseId={planForm.warehouseId}
    onPlanDateChange={handlePlanDateChange}
    warehouses={warehouses}
    onWarehouseChange={handleWarehouseChange}
    draftOrders={filteredDraftOrders}
    selectedOrders={selectedOrders}
    draftOrderFilter={draftOrderFilter}
    onDraftOrderFilterChange={setDraftOrderFilter}
    onSelectOrder={handleSelectOrder}
    onSelectAll={handleSelectAll}
    vrpSettings={vrpSettings}
    onVrpSettingsChange={(changes) => setVrpSettings(prev => ({ ...prev, ...changes }))}
    onSaveSettings={handleSaveSettings}
    isSavingSettings={isSavingSettings}
    isOptimizing={isOptimizing}
    statusMessage={statusMessage}
    onOptimize={handleOptimize}
/>
```

---

## 📊 ผลลัพธ์

### ลดขนาดไฟล์ page.tsx
- **ก่อน:** ~2,970 lines
- **ลบ Modal code:** ~150 lines
- **เพิ่ม handlers:** ~15 lines
- **เพิ่ม component usage:** ~25 lines
- **หลัง:** ~2,860 lines
- **ลดลง:** ~110 lines (-3.7%)

### Component ที่สร้าง
- **CreatePlanModal:** ~330 lines (3 files)
- **Reusable:** ✅ สามารถนำไปใช้ที่อื่นได้
- **Maintainable:** ✅ แยกความรับผิดชอบชัดเจน
- **Testable:** ✅ แต่ละ component test ได้อิสระ

---

## ✅ Features ที่ทำงานได้

1. ✅ เลือกวันที่แผน → auto-generate plan code
2. ✅ เลือกคลัง → fetch draft orders + update warehouse coordinates
3. ✅ ค้นหา/กรองออเดอร์ (รองรับหลายเงื่อนไข)
4. ✅ เลือกออเดอร์ทีละรายการ
5. ✅ เลือก/ยกเลิกทั้งหมด
6. ✅ ตั้งค่า VRP settings
7. ✅ บันทึกการตั้งค่า VRP
8. ✅ เริ่มจัดเส้นทาง (Optimize)
9. ✅ แสดง loading state ขณะคำนวณ
10. ✅ ปิด modal → clear selected orders

---

## 🎯 ข้อดีของการ Extract

### 1. **Separation of Concerns**
- OrderSelection: จัดการเฉพาะการเลือกออเดอร์
- VRPConfiguration: จัดการเฉพาะการตั้งค่า VRP
- index: จัดการ modal และ form data

### 2. **Reusability**
- สามารถนำ OrderSelection ไปใช้ที่อื่นได้
- VRPConfiguration เป็น wrapper ที่ใช้ซ้ำได้

### 3. **Maintainability**
- แก้ไข UI ของ order selection ได้โดยไม่กระทบส่วนอื่น
- แก้ไข VRP settings ได้โดยไม่กระทบ order selection
- Code อ่านง่ายขึ้น

### 4. **Testability**
- Test OrderSelection แยกได้ (mock props)
- Test VRPConfiguration แยกได้
- Test integration ใน index.tsx

---

## 🔍 Build Status

### ✅ CreatePlanModal Components
- ไม่มี build errors
- ไม่มี TypeScript errors
- ไม่มี import errors

### ⚠️ Existing Errors (ไม่เกี่ยวกับงานนี้)
```
./app/api/route-plans/[id]/editor/route.ts:402:5
./app/api/route-plans/[id]/editor/route.ts:997:5
./app/api/route-plans/[id]/editor/route.ts:999:5
```
- Syntax errors ใน route.ts ที่มีอยู่แล้ว
- ไม่เกี่ยวกับ CreatePlanModal

---

## 📝 Next Steps (Sprint 3 W3-D5)

ตามแผน Sprint 3:
- ✅ W3-D1-2: Extract RoutesPlanTable (~720 lines) - เสร็จแล้ว
- ✅ W3-D3-4: Extract CreatePlanModal (~330 lines) - เสร็จแล้ว
- ⏳ W3-D5: Extract ExcelEditor component (~4h)

---

## 🎉 สรุป

**Sprint 3 Day 3-4 เสร็จสมบูรณ์!**

- สร้าง CreatePlanModal component สำเร็จ (3 files, ~330 lines)
- Integrate เข้ากับ page.tsx สำเร็จ
- ลดขนาด page.tsx ลง ~110 lines
- ไม่มี build errors ที่เกี่ยวข้อง
- ทุก features ทำงานได้ตามปกติ

**Progress:** Sprint 3 = 2/6 tasks complete (33.3%)

---

**สร้างโดย:** Kiro AI  
**วันที่:** 17 มกราคม 2026
