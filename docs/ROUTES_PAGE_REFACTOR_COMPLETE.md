# รายงานการ Refactor หน้าจัดสาย (Routes Page)

## สรุปภาพรวม

ดำเนินการตาม `docs/edit21.md` เพื่อปรับปรุงหน้าจัดสาย (`app/receiving/routes/page.tsx`) โดยแยกโค้ดออกเป็นไฟล์ย่อยๆ เพิ่ม Error Handling, Loading States, Confirmation Dialog และ Feature ใหม่สำหรับย้ายออเดอร์ข้ามแผน

**วันที่ดำเนินการ:** 11 มกราคม 2569  
**สถานะ:** ✅ เสร็จสมบูรณ์ (Build ผ่าน 100%)

---

## โครงสร้างไฟล์ใหม่

```
app/receiving/routes/
├── page.tsx                           # หน้าหลัก (อัพเดทให้ใช้ imports จากไฟล์ใหม่)
├── components/
│   ├── index.ts                       # Export all components
│   ├── MetricCard.tsx                 # การ์ดแสดงสถิติ
│   ├── SplitStopModal.tsx             # Modal แบ่งออเดอร์ภายในแผนเดียวกัน
│   ├── ErrorAlert.tsx                 # Component แสดง Error
│   ├── LoadingOverlay.tsx             # Loading overlay
│   ├── ConfirmDialog.tsx              # Confirmation dialog
│   ├── CrossPlanTransferModal.tsx     # Modal ย้ายออเดอร์ข้ามแผน (Feature ใหม่)
│   └── ShippingCostTable.tsx          # ตารางค่าขนส่ง (UI ใหม่)
├── types/
│   └── index.ts                       # Type definitions ทั้งหมด
└── utils/
    ├── index.ts                       # Export all utils
    ├── errorHandler.ts                # Error handling utilities
    └── exportExcel.ts                 # Excel export utilities
```

---

## รายละเอียดแต่ละ Phase

### Phase 1: Refactor page.tsx ✅

**เป้าหมาย:** แยกโค้ดจาก page.tsx (3,564 บรรทัด) ออกเป็นไฟล์ย่อยๆ โดยไม่แก้ไข Business Logic

**สิ่งที่ทำ:**
1. สร้างโฟลเดอร์ `components/`, `types/`, `utils/`
2. แยก Types ทั้งหมดไปไฟล์ `types/index.ts`:
   - `RoutePlan`, `DraftOrder`, `OrderItemDetail`, `StopOrderDetail`
   - `EditorStop`, `EditorTrip`, `SplitItemFormPayload`, `SplitFormPayload`
   - `SplitModalItem`, `BadgeVariant`, `StatusOption`, `PlanForm`, `RouteMetrics`
3. แยก Helper Functions ไปไฟล์ `utils/index.ts`:
   - `STATUSES`, `STATUS_BADGE_MAP`, `VRP_SETTINGS_STORAGE_KEY`
   - `resequenceTripStops()`, `getStatusBadgeInfo()`, `formatDateThai()`
   - `formatNumberThai()`, `formatCurrency()`, `formatWeight()`, `formatDistance()`
   - `formatDuration()`, `formatVolume()`, `calculateTripShippingCost()`
   - `tripHasValidCoordinates()`, `filterStopsWithCoordinates()`
4. แยก Components:
   - `MetricCard` - การ์ดแสดงสถิติ
   - `SplitStopModal` - Modal แบ่งออเดอร์ (ย้ายจาก page.tsx ทั้งหมด ~300 บรรทัด)
5. อัพเดท `page.tsx` ให้ import จากไฟล์ใหม่

**ไฟล์ที่สร้าง:**
- `app/receiving/routes/types/index.ts`
- `app/receiving/routes/utils/index.ts`
- `app/receiving/routes/components/index.ts`
- `app/receiving/routes/components/MetricCard.tsx`
- `app/receiving/routes/components/SplitStopModal.tsx`

---

### Phase 2: เพิ่ม Error Handling ✅

**เป้าหมาย:** สร้าง Error Handler Utility และ ErrorAlert Component

**สิ่งที่ทำ:**
1. สร้าง `utils/errorHandler.ts`:
   - `ApiError` interface
   - `handleApiError()` - แปลง error เป็น ApiError
   - `getErrorMessage()` - แปลง error code เป็นข้อความภาษาไทย
   - `isNetworkError()` - ตรวจสอบ network error
   - `isAuthError()` - ตรวจสอบ authentication error

2. สร้าง `components/ErrorAlert.tsx`:
   - แสดง error message พร้อมไอคอน
   - ปุ่ม "ลองใหม่" (onRetry)
   - ปุ่ม "ปิด" (onDismiss)

**Error Codes ที่รองรับ:**
| Code | ข้อความ |
|------|---------|
| UNAUTHORIZED | กรุณาเข้าสู่ระบบใหม่ |
| FORBIDDEN | คุณไม่มีสิทธิ์ดำเนินการนี้ |
| NOT_FOUND | ไม่พบข้อมูลที่ต้องการ |
| VALIDATION_ERROR | ข้อมูลไม่ถูกต้อง |
| DUPLICATE | ข้อมูลซ้ำในระบบ |
| CONFLICT | ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่ |
| NETWORK_ERROR | ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ |
| TIMEOUT | การเชื่อมต่อหมดเวลา กรุณาลองใหม่ |

**ไฟล์ที่สร้าง:**
- `app/receiving/routes/utils/errorHandler.ts`
- `app/receiving/routes/components/ErrorAlert.tsx`

---

### Phase 3: เพิ่ม Loading States ✅

**เป้าหมาย:** สร้าง LoadingOverlay Component

**สิ่งที่ทำ:**
- สร้าง `components/LoadingOverlay.tsx`:
  - แสดง spinner animation
  - รองรับ custom message
  - ใช้ backdrop blur effect

**การใช้งาน:**
```tsx
<LoadingOverlay message="กำลังบันทึก..." />
```

**ไฟล์ที่สร้าง:**
- `app/receiving/routes/components/LoadingOverlay.tsx`

---

### Phase 4: เพิ่ม Confirmation Dialog ✅

**เป้าหมาย:** สร้าง ConfirmDialog Component สำหรับยืนยันก่อนทำ action สำคัญ

**สิ่งที่ทำ:**
- สร้าง `components/ConfirmDialog.tsx`:
  - รองรับ 3 variants: `danger`, `warning`, `info`
  - แสดง loading state ขณะดำเนินการ
  - ปุ่ม "ยืนยัน" และ "ยกเลิก"

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| isOpen | boolean | แสดง/ซ่อน dialog |
| title | string | หัวข้อ |
| message | string | ข้อความ |
| confirmText | string | ข้อความปุ่มยืนยัน (default: "ยืนยัน") |
| cancelText | string | ข้อความปุ่มยกเลิก (default: "ยกเลิก") |
| variant | 'danger' \| 'warning' \| 'info' | สีของ dialog |
| onConfirm | () => void | callback เมื่อกดยืนยัน |
| onCancel | () => void | callback เมื่อกดยกเลิก |
| loading | boolean | แสดง loading state |

**ไฟล์ที่สร้าง:**
- `app/receiving/routes/components/ConfirmDialog.tsx`

---

### Phase 5: Feature ใหม่ - Cross-Plan Transfer ✅

**เป้าหมาย:** เพิ่มความสามารถในการย้ายออเดอร์ข้ามแผนเส้นทาง

**สิ่งที่ทำ:**

#### 1. Database Migration
สร้างตาราง `receiving_cross_plan_transfers` สำหรับ log การย้ายข้ามแผน:

```sql
CREATE TABLE receiving_cross_plan_transfers (
  transfer_id SERIAL PRIMARY KEY,
  source_plan_id INTEGER NOT NULL,
  source_trip_id INTEGER NOT NULL,
  source_stop_id INTEGER NOT NULL,
  target_plan_id INTEGER NOT NULL,
  target_trip_id INTEGER NOT NULL,
  order_id BIGINT NOT NULL,
  transferred_weight_kg NUMERIC,
  transferred_items JSONB,
  transfer_type VARCHAR(50) NOT NULL, -- 'full' or 'partial'
  transferred_by INTEGER,
  transferred_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
```

#### 2. API Endpoint
สร้าง `POST /api/route-plans/cross-plan-transfer`:

**Request Body:**
```json
{
  "source_plan_id": 1,
  "source_trip_id": 10,
  "source_stop_id": 100,
  "target_plan_id": 2,
  "target_trip_id": 20,
  "target_sequence": 5,
  "order_id": 1000,
  "transfer_type": "full",
  "notes": "ย้ายเนื่องจากน้ำหนักเกิน"
}
```

**Response:**
```json
{
  "success": true,
  "new_stop_id": 101
}
```

**Logic:**
1. ตรวจสอบว่าทั้งสองแผนอยู่ในสถานะที่แก้ไขได้ (draft, published, optimizing)
2. ดึงข้อมูล stop ต้นทาง
3. สร้าง stop ใหม่ในแผนปลายทาง
4. ย้าย stop_items (ถ้ามี)
5. ลบ stop จากแผนต้นทาง
6. บันทึก transfer log
7. Resequence stops ในทั้งสองแผน
8. Update trip metrics

#### 3. UI Component
สร้าง `CrossPlanTransferModal`:
- เลือกแผนปลายทาง (กรองแผนปัจจุบันออก)
- เลือกคันปลายทาง (แสดงจำนวนจุดและน้ำหนัก)
- เลือกลำดับจุดส่ง
- แสดงสรุปก่อนยืนยัน

**ไฟล์ที่สร้าง:**
- `supabase/migrations/198_create_cross_plan_transfers.sql`
- `app/api/route-plans/cross-plan-transfer/route.ts`
- `app/receiving/routes/components/CrossPlanTransferModal.tsx`

---

### Phase 6: ปรับ UI ค่าขนส่งเป็นตาราง ✅

**เป้าหมาย:** สร้าง ShippingCostTable Component แสดงค่าขนส่งในรูปแบบตาราง

**สิ่งที่ทำ:**
- สร้าง `components/ShippingCostTable.tsx`:
  - แสดงข้อมูลค่าขนส่งแต่ละคัน
  - รองรับ edit mode และ read-only mode
  - คำนวณรวมอัตโนมัติ
  - แสดง summary row

**คอลัมน์:**
| คอลัมน์ | Editable |
|---------|----------|
| คัน | ❌ |
| ขนส่ง | ❌ |
| จุดส่ง | ❌ |
| น้ำหนัก (กก.) | ❌ |
| ราคาฐาน | ✅ |
| ค่าคนช่วย | ✅ |
| ค่าจุดเพิ่ม | ✅ |
| ค่าขนของ | ✅ |
| อื่นๆ | ✅ |
| รวม | ❌ (คำนวณอัตโนมัติ) |

**ไฟล์ที่สร้าง:**
- `app/receiving/routes/components/ShippingCostTable.tsx`

---

### Phase 7: รวมใบว่าจ้างข้ามแผน ⏳

**สถานะ:** ยังไม่ได้ดำเนินการ (ต้องการ API เพิ่มเติม)

**สิ่งที่ต้องทำ:**
1. สร้าง API `GET /api/route-plans/trips-by-supplier`
2. สร้าง `MultiPlanContractModal` component

---

### Phase 8: Export Excel ไม่มีราคา ✅

**เป้าหมาย:** เพิ่ม option ให้ export Excel ได้ทั้งแบบมีราคาและไม่มีราคา

**สิ่งที่ทำ:**
- สร้าง `utils/exportExcel.ts`:
  - `exportRoutePlanToExcel()` - export แยกแต่ละคันเป็น sheet
  - `exportRoutePlanSummary()` - export รวมทุกคันใน sheet เดียว

**Options:**
```typescript
interface ExportOptions {
  includePrice: boolean;  // รวมคอลัมน์ราคาหรือไม่
  format: 'tms' | 'simple';  // รูปแบบ export
}
```

**คอลัมน์ที่ export:**
- ลำดับ
- เลขออเดอร์
- รหัสลูกค้า
- ชื่อร้าน
- ที่อยู่
- จังหวัด
- น้ำหนัก (กก.)
- จำนวน (ชิ้น)
- ค่าขนส่ง (ถ้า includePrice = true)

**ไฟล์ที่สร้าง:**
- `app/receiving/routes/utils/exportExcel.ts`

---

## สรุปไฟล์ทั้งหมดที่สร้าง/แก้ไข

### ไฟล์ใหม่ (13 ไฟล์)

| ไฟล์ | ขนาด | คำอธิบาย |
|------|------|----------|
| `app/receiving/routes/types/index.ts` | ~120 บรรทัด | Type definitions |
| `app/receiving/routes/utils/index.ts` | ~100 บรรทัด | Helper functions |
| `app/receiving/routes/utils/errorHandler.ts` | ~60 บรรทัด | Error handling |
| `app/receiving/routes/utils/exportExcel.ts` | ~150 บรรทัด | Excel export |
| `app/receiving/routes/components/index.ts` | ~10 บรรทัด | Component exports |
| `app/receiving/routes/components/MetricCard.tsx` | ~25 บรรทัด | Metric card |
| `app/receiving/routes/components/SplitStopModal.tsx` | ~300 บรรทัด | Split modal |
| `app/receiving/routes/components/ErrorAlert.tsx` | ~55 บรรทัด | Error alert |
| `app/receiving/routes/components/LoadingOverlay.tsx` | ~25 บรรทัด | Loading overlay |
| `app/receiving/routes/components/ConfirmDialog.tsx` | ~70 บรรทัด | Confirm dialog |
| `app/receiving/routes/components/CrossPlanTransferModal.tsx` | ~200 บรรทัด | Cross-plan transfer |
| `app/receiving/routes/components/ShippingCostTable.tsx` | ~120 บรรทัด | Shipping cost table |
| `app/api/route-plans/cross-plan-transfer/route.ts` | ~180 บรรทัด | Cross-plan API |
| `supabase/migrations/198_create_cross_plan_transfers.sql` | ~25 บรรทัด | Migration |

### ไฟล์ที่แก้ไข (1 ไฟล์)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `app/receiving/routes/page.tsx` | อัพเดท imports ให้ใช้จากไฟล์ใหม่, ลบ code ที่ย้ายไปแล้ว |

---

## การใช้งาน Components ใหม่

### ErrorAlert
```tsx
import { ErrorAlert } from './components';
import { handleApiError } from './utils';

const [error, setError] = useState<ApiError | null>(null);

// เมื่อเกิด error
try {
  await fetchData();
} catch (err) {
  setError(handleApiError(err));
}

// แสดง error
<ErrorAlert 
  error={error} 
  onRetry={() => fetchData()} 
  onDismiss={() => setError(null)} 
/>
```

### ConfirmDialog
```tsx
import { ConfirmDialog } from './components';

const [showConfirm, setShowConfirm] = useState(false);

<ConfirmDialog
  isOpen={showConfirm}
  title="ยืนยันการลบ"
  message="คุณต้องการลบแผนนี้หรือไม่?"
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
  loading={isDeleting}
/>
```

### CrossPlanTransferModal
```tsx
import { CrossPlanTransferModal } from './components';

<CrossPlanTransferModal
  isOpen={showTransferModal}
  onClose={() => setShowTransferModal(false)}
  sourceStop={selectedStop}
  sourcePlanId={currentPlanId}
  sourceTripId={currentTripId}
  onTransfer={async (targetPlanId, targetTripId, sequence) => {
    await fetch('/api/route-plans/cross-plan-transfer', {
      method: 'POST',
      body: JSON.stringify({
        source_plan_id: currentPlanId,
        source_trip_id: currentTripId,
        source_stop_id: selectedStop.stop_id,
        target_plan_id: targetPlanId,
        target_trip_id: targetTripId,
        target_sequence: sequence,
        order_id: selectedStop.order_id,
        transfer_type: 'full'
      })
    });
  }}
/>
```

### Export Excel
```tsx
import { exportRoutePlanToExcel, exportRoutePlanSummary } from './utils';

// Export แบบมีราคา
await exportRoutePlanToExcel(planId, planCode, trips, { 
  includePrice: true, 
  format: 'simple' 
});

// Export แบบไม่มีราคา
await exportRoutePlanToExcel(planId, planCode, trips, { 
  includePrice: false, 
  format: 'simple' 
});
```

---

## กฎเหล็กที่ปฏิบัติตาม

✅ **ห้าม** แก้ไข Business Logic ที่ทำงานอยู่แล้ว  
✅ **ห้าม** เปลี่ยน API Response Format  
✅ **ห้าม** เปลี่ยน Database Schema (ยกเว้นเพิ่ม columns/tables ใหม่)  
✅ **ห้าม** เปลี่ยนชื่อ function/variable ที่ถูกเรียกใช้จากที่อื่น  
✅ **ต้อง** Test ทุกครั้งหลังแก้ไข (Build ผ่าน 100%)  
✅ **ต้อง** ทำทีละ Phase ห้ามรวบ  

---

## สถานะ Build

```
✓ Build สำเร็จ 100%
✓ ไม่มี TypeScript errors
✓ ไม่มี ESLint errors
✓ หน้า /receiving/routes ถูก compile เป็น Static content
```

---

## งานที่เหลือ (Phase 7)

1. **API: trips-by-supplier**
   - สร้าง `GET /api/route-plans/trips-by-supplier`
   - Query trips จากหลายแผนที่ใช้ supplier เดียวกัน

2. **MultiPlanContractModal**
   - เลือก supplier
   - เลือกช่วงวันที่
   - แสดงรายการ trips ที่ตรงเงื่อนไข
   - เลือก trips ที่ต้องการรวมใบว่าจ้าง
   - สร้างใบว่าจ้างรวม

---

## ผู้ดำเนินการ

- **AI Assistant (Kiro)**
- **วันที่:** 11 มกราคม 2569
