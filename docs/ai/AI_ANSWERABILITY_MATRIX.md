# AI Answerability Matrix

## Overview

เอกสารนี้กำหนดว่า AI สามารถตอบคำถามใดได้ และคำถามใดที่ไม่สามารถตอบได้เนื่องจากข้อมูลไม่เพียงพอ

**หลักการสำคัญ:**
- AI ตอบได้เฉพาะคำถามที่มีข้อมูลรองรับจาก Database/API เท่านั้น
- AI ห้ามคาดเดา ประมาณการ หรือสร้างข้อมูลปลอม
- เมื่อไม่สามารถตอบได้ AI ต้องแนะนำคำถามทางเลือกที่ตอบได้

---

## ✅ คำถามที่ตอบได้ (Answerable Questions)

### 1. Stock Balance (สต็อกคงเหลือ)

| คำถาม | ข้อมูลที่ใช้ | API |
|-------|-------------|-----|
| สต็อก SKU-XXX เหลือเท่าไร? | `wms_inventory_balances.total_piece_qty` | `/api/ai/stock/balance` |
| สินค้านี้เก็บอยู่ที่ไหน? | `wms_inventory_balances.location_id` | `/api/ai/stock/balance` |
| สต็อกถูกสำรองไว้เท่าไร? | `wms_inventory_balances.reserved_piece_qty` | `/api/ai/stock/balance` |
| สต็อกพร้อมใช้งานเท่าไร? | `total_piece_qty - reserved_piece_qty` | `/api/ai/stock/balance` |
| สินค้า Lot XXX อยู่ที่ไหน? | `wms_inventory_balances.lot_no, location_id` | `/api/ai/stock/balance` |
| พาเลท XXX มีสินค้าอะไรบ้าง? | `wms_inventory_balances.pallet_id` | `/api/ai/stock/balance` |

### 2. Expiry (วันหมดอายุ)

| คำถาม | ข้อมูลที่ใช้ | API |
|-------|-------------|-----|
| สินค้าไหนใกล้หมดอายุ? | `wms_inventory_balances.expiry_date` | `/api/ai/stock/balance` |
| สินค้าไหนหมดอายุแล้ว? | `expiry_date < CURRENT_DATE` | `/api/ai/stock/balance` |
| สินค้าจะหมดอายุใน 30 วัน? | `expiry_date BETWEEN NOW AND NOW+30` | `/api/ai/stock/balance` |

### 3. Order Status (สถานะออเดอร์)

| คำถาม | ข้อมูลที่ใช้ | API |
|-------|-------------|-----|
| สถานะออเดอร์ XXX เป็นอย่างไร? | `wms_orders.status` | `/api/ai/orders/status` |
| มีออเดอร์กี่รายการในแต่ละสถานะ? | `COUNT(*) GROUP BY status` | `/api/ai/orders/status` |
| ออเดอร์ไหนล่าช้า? | `delivery_date < CURRENT_DATE AND status != 'delivered'` | `/api/ai/orders/status` |
| ความคืบหน้าการจัดเป็นอย่างไร? | `wms_order_items.picked_qty / order_qty` | `/api/ai/orders/status` |
| ออเดอร์ของลูกค้า XXX มีกี่รายการ? | `wms_orders.customer_id` | `/api/ai/orders/status` |

### 4. Location (โลเคชั่น)

| คำถาม | ข้อมูลที่ใช้ | API |
|-------|-------------|-----|
| อัตราการใช้พื้นที่คลังเป็นอย่างไร? | `master_location.current_qty / max_capacity_qty` | `/api/ai/warehouse/locations` |
| โลเคชั่นไหนว่าง? | `current_qty = 0` | `/api/ai/warehouse/locations` |
| แต่ละโซนมีกี่โลเคชั่น? | `COUNT(*) GROUP BY zone` | `/api/ai/warehouse/locations` |
| โลเคชั่นไหนเต็ม? | `current_qty >= max_capacity_qty` | `/api/ai/warehouse/locations` |

### 5. Movement (การเคลื่อนไหว)

| คำถาม | ข้อมูลที่ใช้ | API |
|-------|-------------|-----|
| ประวัติการเคลื่อนไหวสต็อก? | `wms_inventory_ledger.*` | `/api/ai/stock/movements` |
| รับเข้า vs จ่ายออกเป็นอย่างไร? | `SUM(piece_qty) WHERE direction = 'in'/'out'` | `/api/ai/stock/movements` |
| การเคลื่อนไหว 7 วันที่ผ่านมา? | `movement_at >= NOW - 7 days` | `/api/ai/stock/movements` |
| SKU XXX มีการเคลื่อนไหวอย่างไร? | `wms_inventory_ledger.sku_id` | `/api/ai/stock/movements` |

### 6. KPI (ตัวชี้วัด)

| คำถาม | ข้อมูลที่ใช้ | API |
|-------|-------------|-----|
| สรุป KPI วันนี้/สัปดาห์นี้? | Aggregated from multiple tables | `/api/ai/analytics/kpi` |
| Throughput เป็นอย่างไร? | `SUM(received_qty), SUM(shipped_qty)` | `/api/ai/analytics/kpi` |
| อัตราสำเร็จเป็นอย่างไร? | `completed_orders / total_orders` | `/api/ai/analytics/kpi` |

---

## ❌ คำถามที่ตอบไม่ได้ (Not Answerable Questions)

### 1. Days of Cover (จำนวนวันที่สต็อกจะหมด)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| สต็อกใช้ได้อีกกี่วัน? | `daily_consumption_rate` | ดูสต็อกคงเหลือปัจจุบัน + ประวัติการจ่ายออก |
| SKU XXX จะหมดเมื่อไร? | `daily_consumption_rate` | ดูสต็อกคงเหลือ + การสำรอง |

**เหตุผล:** ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวันโดยตรง การคำนวณ Days of Cover ต้องการ:
```
Days of Cover = Current Stock / Daily Consumption Rate
```

**ทางเลือกที่แนะนำ:**
1. "สต็อกคงเหลือปัจจุบันเท่าไร?"
2. "การจ่ายออก 7 วันที่ผ่านมาเป็นอย่างไร?"
3. "สินค้าไหนมีอัตราการสำรองสูง?"

---

### 2. Consumption Rate (อัตราการใช้)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| อัตราการใช้ต่อวันเท่าไร? | `daily_consumption_rate` table | ดูยอดจ่ายออกรวม 30 วัน |
| สินค้าไหนขายดี? | `sales_data` | ดูการเคลื่อนไหวขาออก |

**เหตุผล:** ระบบเก็บเฉพาะ transaction history ไม่ได้คำนวณ consumption rate ไว้ล่วงหน้า

**ทางเลือกที่แนะนำ:**
1. "ยอดจ่ายออกรวม 30 วันที่ผ่านมาเท่าไร?"
2. "ประวัติการเคลื่อนไหวสต็อกเป็นอย่างไร?"

---

### 3. Shortage Risk (ความเสี่ยงขาดสต็อก)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| สินค้าไหนเสี่ยงขาดสต็อก? | `daily_consumption_rate`, `supplier_lead_time` | ดูสินค้าต่ำกว่า reorder point |
| ต้องสั่งซื้อสินค้าไหนบ้าง? | `demand_forecast`, `lead_time` | ดูสินค้าที่สำรองสูง |

**เหตุผล:** การประเมินความเสี่ยงขาดสต็อกต้องการ:
- อัตราการใช้ต่อวัน
- Lead time จาก Supplier
- Demand forecast

**ทางเลือกที่แนะนำ:**
1. "สินค้าไหนต่ำกว่าจุดสั่งซื้อ (reorder point)?"
2. "สินค้าไหนมีอัตราการสำรองสูง?"
3. "สต็อกพร้อมใช้งานเหลือเท่าไร?"

---

### 4. Overstock Risk (ความเสี่ยง Overstock)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| สินค้าไหน Overstock? | `max_stock_level`, `consumption_rate` | ดูสินค้าที่มีสต็อกสูงสุด |
| สินค้าไหนค้างนาน? | `aging_analysis` | ดูสินค้าที่เคลื่อนไหวน้อย |

**ทางเลือกที่แนะนำ:**
1. "สินค้าไหนมีสต็อกมากที่สุด?"
2. "สินค้าไหนเคลื่อนไหวน้อยใน 30 วันที่ผ่านมา?"

---

### 5. Productivity (ประสิทธิภาพ)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| จำนวน Pick ต่อชั่วโมงเท่าไร? | `pick_timestamp` (granular) | ดูจำนวนออเดอร์ที่เสร็จ |
| ประสิทธิภาพพนักงานเป็นอย่างไร? | `task_duration` | ดูจำนวนงานที่เสร็จ |
| เวลาเฉลี่ยในการจัดออเดอร์? | `start_time`, `end_time` per order | ดูจำนวนออเดอร์ต่อวัน |

**เหตุผล:** ระบบไม่ได้เก็บ timestamp ระดับละเอียดสำหรับแต่ละ pick

**ทางเลือกที่แนะนำ:**
1. "วันนี้จัดเสร็จกี่ออเดอร์?"
2. "ความคืบหน้าการจัดเป็นอย่างไร?"

---

### 6. Forecast (พยากรณ์)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| ยอดขายเดือนหน้าจะเป็นอย่างไร? | `forecast_data` | ดูประวัติออเดอร์ย้อนหลัง |
| ต้องผลิตสินค้าเท่าไร? | `demand_forecast` | ดูออเดอร์ที่รอดำเนินการ |

**เหตุผล:** ระบบไม่มี Forecasting module

**ทางเลือกที่แนะนำ:**
1. "ออเดอร์ที่รอดำเนินการมีกี่รายการ?"
2. "ประวัติออเดอร์ 30 วันที่ผ่านมาเป็นอย่างไร?"

---

### 7. Cost & Value (ต้นทุนและมูลค่า)

| คำถาม | ข้อมูลที่ขาด | ทางเลือก |
|-------|-------------|----------|
| มูลค่าสต็อกทั้งหมดเท่าไร? | `unit_cost` | ดูจำนวนสต็อกเท่านั้น |
| ต้นทุนสินค้าเท่าไร? | `unit_cost` in master_sku | N/A |

**เหตุผล:** ตาราง `master_sku` ไม่มี field `unit_cost`

---

## 📊 Data Availability Summary

### Available Data Sources

| Table | Key Fields | Use Case |
|-------|-----------|----------|
| `wms_inventory_balances` | total_piece_qty, reserved_piece_qty, expiry_date, location_id, pallet_id | Stock queries |
| `wms_inventory_ledger` | movement_at, transaction_type, direction, piece_qty | Movement history |
| `wms_orders` | order_no, status, delivery_date, customer_id | Order status |
| `wms_order_items` | order_qty, picked_qty | Pick progress |
| `master_location` | location_code, zone, max_capacity_qty, current_qty | Location queries |
| `master_sku` | sku_name, category, shelf_life_days, reorder_point | SKU info |
| `production_orders` | production_no, quantity, produced_qty, status | Production status |

### Missing Data (Not in Database)

| Data | Required For | Status |
|------|-------------|--------|
| `daily_consumption_rate` | Days of Cover, Shortage Risk | ❌ Not Available |
| `supplier_lead_time` | Reorder Suggestions | ❌ Not Available |
| `demand_forecast` | Forecast, Planning | ❌ Not Available |
| `unit_cost` | Inventory Value | ❌ Not Available |
| `pick_timestamp` (granular) | Productivity Metrics | ❌ Not Available |
| `task_duration` | Employee Productivity | ❌ Not Available |

---

## 🔄 Derived Calculations (Can Calculate)

| Metric | Formula | Can Calculate |
|--------|---------|---------------|
| Available Qty | `total_piece_qty - reserved_piece_qty` | ✅ Yes |
| Reservation % | `(reserved_piece_qty / total_piece_qty) * 100` | ✅ Yes |
| Location Utilization | `(current_qty / max_capacity_qty) * 100` | ✅ Yes |
| Pick Progress | `(picked_qty / order_qty) * 100` | ✅ Yes |
| Days Until Expiry | `expiry_date - CURRENT_DATE` | ✅ Yes |
| Net Movement | `SUM(in_qty) - SUM(out_qty)` | ✅ Yes |
| Days of Cover | `current_stock / daily_consumption_rate` | ❌ No (missing consumption rate) |
| Reorder Suggestion | `(reorder_point - current_stock) + safety_stock` | ⚠️ Partial (no demand forecast) |

---

## 📝 AI Response Guidelines

### When Data is Available:
```
ตรวจสอบสต็อก SKU-001 จากระบบ

📊 ข้อมูลจากระบบ:
- สต็อกทั้งหมด: 1,250 ชิ้น
- สำรองแล้ว: 300 ชิ้น
- พร้อมใช้งาน: 950 ชิ้น
- โลเคชั่น: A-01-01, A-01-02
- วันหมดอายุ: 2025-03-15

🧠 การวิเคราะห์:
- อัตราการสำรอง 24% อยู่ในเกณฑ์ปกติ
```

### When Data is NOT Available:
```
ขออภัยครับ ระบบไม่สามารถตอบคำถาม "สต็อกใช้ได้อีกกี่วัน" ได้

⚠️ ข้อจำกัด:
- ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวัน (daily consumption rate)
- การคำนวณ Days of Cover ต้องการ: สต็อกปัจจุบัน ÷ อัตราการใช้ต่อวัน

💡 คำถามที่ระบบสามารถตอบได้แทน:
1. "สต็อกคงเหลือปัจจุบันเท่าไร?"
2. "การจ่ายออก 7 วันที่ผ่านมาเป็นอย่างไร?"
3. "สินค้าไหนมีอัตราการสำรองสูง?"
```

---

## 🛠️ Implementation Files

- `lib/ai/data-contract.ts` - Data availability definitions
- `lib/ai/question-guidance.ts` - Question templates and alternatives
- `lib/ai/chat-service.ts` - Chat handling with guidance
- `lib/ai/guardrails.ts` - Safety checks
- `lib/ai/reasoning-engine.ts` - Analysis logic

---

## 📅 Last Updated
December 21, 2025

## 👤 Maintained By
AI System Architect
