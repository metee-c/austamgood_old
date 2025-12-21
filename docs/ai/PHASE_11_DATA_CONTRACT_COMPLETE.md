# Phase 11: Data Contract & Question Guidance - COMPLETE

## Overview

Phase 11 เสร็จสมบูรณ์แล้ว โดยมีการสร้าง Data Contract และ Question Guidance เพื่อให้ AI สามารถ:
1. รู้ว่าข้อมูลใดมีอยู่ในระบบ
2. รู้ว่าข้อมูลใดไม่มี
3. แนะนำคำถามทางเลือกเมื่อไม่สามารถตอบได้

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `lib/ai/data-contract.ts` | กำหนด Data Availability Matrix |
| `lib/ai/question-guidance.ts` | Question Templates และ Alternative Suggestions |
| `docs/ai/AI_ANSWERABILITY_MATRIX.md` | เอกสารสรุปคำถามที่ตอบได้/ไม่ได้ |

### Modified Files

| File | Changes |
|------|---------|
| `lib/ai/chat-service.ts` | เพิ่ม `detectUnanswerableIntent()` function |
| `app/api/ai/chat/route.ts` | Integrate unanswerable question detection |

---

## Key Features

### 1. Data Contract (`lib/ai/data-contract.ts`)

กำหนดข้อมูลที่มีอยู่ในระบบ:

```typescript
// Available Data
AVAILABLE_DATA = {
  inventory_balance: [...],  // wms_inventory_balances
  inventory_ledger: [...],   // wms_inventory_ledger
  orders: [...],             // wms_orders
  order_items: [...],        // wms_order_items
  locations: [...],          // master_location
  sku: [...],                // master_sku
  production: [...],         // production_orders
  warehouse: [...],          // master_warehouse
}

// NOT Available Data
NOT_AVAILABLE_DATA = [
  'daily_consumption_rate',
  'supplier_lead_time',
  'demand_forecast',
  'unit_cost',
  'picks_per_hour',
  'employee_productivity',
  ...
]
```

### 2. Question Guidance (`lib/ai/question-guidance.ts`)

กำหนด Question Templates:

```typescript
QUESTION_MATRIX = {
  // CAN ANSWER
  stock_answerable: [...],
  order_answerable: [...],
  location_answerable: [...],
  movement_answerable: [...],
  kpi_answerable: [...],
  expiry_answerable: [...],
  
  // CANNOT ANSWER
  stock_not_answerable: [...],
  productivity_not_answerable: [...],
}
```

### 3. Unanswerable Intent Detection

เมื่อผู้ใช้ถามคำถามที่ตอบไม่ได้:

```typescript
detectUnanswerableIntent(message) => {
  isUnanswerable: boolean,
  intent: string,
  guidance: string  // คำอธิบาย + ทางเลือก
}
```

---

## Blocked Questions & Alternatives

### ❌ Days of Cover
**คำถาม:** "สต็อกใช้ได้อีกกี่วัน?"
**ข้อมูลที่ขาด:** `daily_consumption_rate`
**ทางเลือก:**
- "สต็อกคงเหลือปัจจุบันเท่าไร?"
- "การจ่ายออก 7 วันที่ผ่านมาเป็นอย่างไร?"

### ❌ Consumption Rate
**คำถาม:** "อัตราการใช้ต่อวันเท่าไร?"
**ข้อมูลที่ขาด:** `daily_consumption_rate`
**ทางเลือก:**
- "ยอดจ่ายออกรวม 30 วันที่ผ่านมาเท่าไร?"

### ❌ Shortage Risk
**คำถาม:** "สินค้าไหนเสี่ยงขาดสต็อก?"
**ข้อมูลที่ขาด:** `daily_consumption_rate`, `supplier_lead_time`
**ทางเลือก:**
- "สินค้าไหนต่ำกว่าจุดสั่งซื้อ?"
- "สินค้าไหนมีอัตราการสำรองสูง?"

### ❌ Productivity
**คำถาม:** "จำนวน Pick ต่อชั่วโมงเท่าไร?"
**ข้อมูลที่ขาด:** `pick_timestamp` (granular)
**ทางเลือก:**
- "วันนี้จัดเสร็จกี่ออเดอร์?"

### ❌ Forecast
**คำถาม:** "ยอดขายเดือนหน้าจะเป็นอย่างไร?"
**ข้อมูลที่ขาด:** `forecast_data`
**ทางเลือก:**
- "ประวัติออเดอร์ 30 วันที่ผ่านมาเป็นอย่างไร?"

### ❌ Cost/Value
**คำถาม:** "มูลค่าสต็อกทั้งหมดเท่าไร?"
**ข้อมูลที่ขาด:** `unit_cost`
**ทางเลือก:**
- "สต็อกคงเหลือเท่าไร?" (จำนวนชิ้น)

---

## Example AI Response (Unanswerable)

```
ขออภัยครับ ระบบไม่สามารถตอบคำถามนี้ได้

เหตุผล: ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวันโดยตรง

ข้อมูลที่ขาด:
- daily_consumption_rate: ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวันโดยตรง

คำถามที่ระบบสามารถตอบได้แทน:
1. "สต็อกคงเหลือปัจจุบันเท่าไร?"
   (ระบบมีข้อมูลสต็อกปัจจุบัน แต่ไม่มีข้อมูลอัตราการใช้)
2. "การจ่ายออก 7 วันที่ผ่านมาเป็นอย่างไร?"
   (ประวัติการเคลื่อนไหวสามารถบ่งบอกรูปแบบการใช้งานได้)
```

---

## Database Tables Analyzed

| Table | Key Fields | AI Use Case |
|-------|-----------|-------------|
| `wms_inventory_balances` | total_piece_qty, reserved_piece_qty, expiry_date, location_id, pallet_id | Stock queries |
| `wms_inventory_ledger` | movement_at, transaction_type, direction, piece_qty | Movement history |
| `wms_orders` | order_no, status, delivery_date, customer_id | Order status |
| `wms_order_items` | order_qty, picked_qty | Pick progress |
| `master_location` | location_code, zone, max_capacity_qty, current_qty | Location queries |
| `master_sku` | sku_name, category, shelf_life_days, reorder_point | SKU info |
| `production_orders` | production_no, quantity, produced_qty, status | Production status |
| `master_warehouse` | warehouse_name, capacity_qty | Warehouse info |
| `master_supplier` | supplier_name, contact_person | Supplier info |
| `master_customer` | customer_name, province | Customer info |

---

## AI Behavior Summary

### Before Phase 11:
- AI อาจพยายามตอบคำถามที่ไม่มีข้อมูล
- ผู้ใช้ไม่รู้ว่าทำไมตอบไม่ได้

### After Phase 11:
- AI รู้ว่าข้อมูลใดมี/ไม่มี
- AI อธิบายเหตุผลที่ตอบไม่ได้
- AI แนะนำคำถามทางเลือกที่ตอบได้
- ผู้ใช้ได้รับ guidance ที่ชัดเจน

---

## Testing

### Test Unanswerable Questions:
```
1. "สต็อกใช้ได้อีกกี่วัน?"
2. "อัตราการใช้ต่อวันเท่าไร?"
3. "สินค้าไหนเสี่ยงขาดสต็อก?"
4. "มูลค่าสต็อกทั้งหมดเท่าไร?"
5. "ยอดขายเดือนหน้าจะเป็นอย่างไร?"
```

### Expected Response:
- ระบุว่าตอบไม่ได้
- อธิบายข้อมูลที่ขาด
- แนะนำคำถามทางเลือก

---

## Next Steps (Optional)

หากต้องการให้ AI ตอบคำถามเหล่านี้ได้ในอนาคต:

1. **Days of Cover**: ✅ สามารถคำนวณจาก historical data ได้แล้ว (ถาม "คำนวณอัตราการใช้จากประวัติ 30 วัน")
2. **Lead Time**: เพิ่ม field `lead_time_days` ใน `master_supplier`
3. **Forecast**: สร้าง Forecasting module
4. **Cost**: เพิ่ม field `unit_cost` ใน `master_sku`
5. **Productivity**: เก็บ timestamp ระดับ pick item

---

## Bonus: Consumption Engine (Derived Calculation)

เพิ่ม feature ใหม่ที่สามารถคำนวณ consumption rate จาก historical data:

### Files Added:
- `lib/intelligence/consumption-engine.ts` - Consumption calculation logic
- `app/api/ai/stock/consumption/route.ts` - API endpoint

### How to Use:
```
ถาม: "คำนวณอัตราการใช้จากประวัติ 30 วัน"
ถาม: "วิเคราะห์การจ่ายออก SKU-XXX"
ถาม: "ประมาณการใช้สต็อกจากข้อมูลย้อนหลัง"
```

### Response Example:
```
📊 การวิเคราะห์อัตราการใช้ (คำนวณจากประวัติการจ่ายออก 30 วัน)

⚠️ หมายเหตุ: ข้อมูลนี้คำนวณจากประวัติการเคลื่อนไหว ไม่ใช่ข้อมูลที่เก็บโดยตรง

1. SKU-001 (สินค้า A)
   - อัตราการใช้เฉลี่ย: 150 ชิ้น/วัน
   - สต็อกปัจจุบัน: 4,500 ชิ้น
   - ประมาณการใช้ได้: ~30 วัน
   - ความเชื่อมั่น: 🟢 high (25 data points)
```

### Important Disclaimer:
- คำนวณจากประวัติการจ่ายออก ไม่ใช่ข้อมูลการใช้จริง
- ไม่รวมการใช้ภายใน (internal consumption)
- ควรใช้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ใช่การพยากรณ์

---

## Completion Status

| Component | Status |
|-----------|--------|
| Data Contract | ✅ Complete |
| Question Guidance | ✅ Complete |
| Unanswerable Detection | ✅ Complete |
| API Integration | ✅ Complete |
| Consumption Engine | ✅ Complete (Bonus) |
| Documentation | ✅ Complete |

**Phase 11: COMPLETE** ✅

---

## Files Summary

### New Files Created:
1. `lib/ai/data-contract.ts` - Data availability definitions
2. `lib/ai/question-guidance.ts` - Question templates and alternatives
3. `lib/intelligence/consumption-engine.ts` - Consumption calculation logic
4. `app/api/ai/stock/consumption/route.ts` - Consumption API endpoint
5. `docs/ai/AI_ANSWERABILITY_MATRIX.md` - Answerability documentation

### Modified Files:
1. `lib/ai/chat-service.ts` - Added detectUnanswerableIntent, consumption support
2. `app/api/ai/chat/route.ts` - Integrated unanswerable detection

---

## Date Completed
December 21, 2025
