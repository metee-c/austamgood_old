# Digital Twin & What-If Scenario Engine

## Overview

ระบบ Digital Twin สร้างโมเดลเสมือนของคลังสินค้าที่สะท้อนสถานะและพฤติกรรมจริง เพื่อให้ผู้ใช้สามารถจำลองสถานการณ์ต่างๆ (What-If Analysis) โดยไม่กระทบข้อมูลจริง

## หลักการสำคัญ

1. **Deterministic**: ผลลัพธ์เดียวกันทุกครั้งจาก parameters เดียวกัน
2. **Isolated**: การจำลองไม่กระทบข้อมูลจริง (in-memory calculations)
3. **Historical-based**: ใช้ข้อมูลประวัติจริง ไม่ใช่ AI prediction
4. **Explainable**: ทุกการคำนวณอธิบายได้

## Scenario Types

### 1. Demand Increase (ความต้องการเพิ่มขึ้น)

จำลองผลกระทบเมื่อความต้องการสินค้าเพิ่มขึ้น

**Parameters:**
- `demand_multiplier`: ตัวคูณความต้องการ (เช่น 1.5 = เพิ่ม 50%)
- `period_days`: ช่วงเวลาข้อมูลประวัติ (default: 30 วัน)

**API:** `POST /api/ai/simulation/demand-increase`

**Example:**
```json
{
  "demand_multiplier": 1.5,
  "period_days": 30
}
```

**Use Cases:**
- วางแผนช่วงเทศกาล/โปรโมชั่น
- ประเมินความพร้อมรับมือ peak season
- วางแผนการเติบโตของธุรกิจ

---

### 2. Lead Time Increase (ซัพพลายเออร์ส่งช้า)

จำลองผลกระทบเมื่อ lead time ของซัพพลายเออร์เพิ่มขึ้น

**Parameters:**
- `lead_time_increase_days`: จำนวนวันที่เพิ่มขึ้น
- `supplier_ids`: รายการ supplier ที่ต้องการจำลอง (optional, ถ้าไม่ระบุ = ทุก supplier)

**API:** `POST /api/ai/simulation/lead-time-increase`

**Example:**
```json
{
  "lead_time_increase_days": 7,
  "supplier_ids": null
}
```

**Use Cases:**
- ประเมินความเสี่ยงเมื่อซัพพลายเออร์มีปัญหา
- วางแผน safety stock
- เตรียมพร้อมสำหรับ supply chain disruption

---

### 3. Storage Reduction (พื้นที่ลดลง)

จำลองผลกระทบเมื่อพื้นที่จัดเก็บลดลง

**Parameters:**
- `reduction_percent`: เปอร์เซ็นต์ที่ลดลง (0-100)
- `reduction_locations`: รายการ location ที่ต้องการลบ (optional)
- `affected_zones`: โซนที่ได้รับผลกระทบ (optional)

**API:** `POST /api/ai/simulation/storage-reduction`

**Example:**
```json
{
  "reduction_percent": 20,
  "affected_zones": ["ZONE-A", "ZONE-B"]
}
```

**Use Cases:**
- วางแผนปรับปรุงคลังสินค้า
- ประเมินผลกระทบจากการจัดสรรพื้นที่ใหม่
- วางแผนย้ายคลัง

---

### 4. Shift Change (เปลี่ยนแปลงกำลังคน)

จำลองผลกระทบเมื่อกำลังคนหรือชั่วโมงทำงานเปลี่ยนแปลง

**Parameters:**
- `shift_hours_change`: การเปลี่ยนแปลงชั่วโมงต่อกะ (-8 ถึง +8)
- `worker_count_change`: การเปลี่ยนแปลงจำนวนพนักงาน (% เช่น -25 = ลด 25%)
- `productivity_change_percent`: การเปลี่ยนแปลงประสิทธิภาพ (%)

**API:** `POST /api/ai/simulation/shift-change`

**Example:**
```json
{
  "worker_count_change": -25,
  "shift_hours_change": 0
}
```

**Use Cases:**
- วางแผนลดต้นทุนแรงงาน
- ประเมินผลกระทบจากการขาดแคลนพนักงาน
- วางแผนเพิ่มกำลังคนช่วง peak

---

## Scenario Comparison

เปรียบเทียบหลาย scenarios พร้อมกัน

**API:** `POST /api/ai/simulation/compare`

**Example:**
```json
{
  "scenarios": [
    {
      "type": "demand_increase",
      "name": "Peak Season",
      "parameters": { "demand_multiplier": 1.5 }
    },
    {
      "type": "storage_reduction",
      "name": "Space Constraint",
      "parameters": { "reduction_percent": 20 }
    }
  ]
}
```

---

## Scenario Templates

Templates สำเร็จรูปสำหรับ scenarios ที่ใช้บ่อย

**API:** `GET /api/ai/simulation/templates`

| Template | Type | Parameters | Use Case |
|----------|------|------------|----------|
| Peak Season | demand_increase | multiplier: 1.5 | ช่วงเทศกาล |
| Supplier Delay | lead_time_increase | days: 7 | ซัพพลายเออร์ล่าช้า |
| Space Constraint | storage_reduction | percent: 20 | พื้นที่จำกัด |
| Reduced Workforce | shift_change | workers: -25% | ลดกำลังคน |
| Growth Planning | demand_increase | multiplier: 2.0 | วางแผนการเติบโต |

---

## Response Structure

ทุก simulation API จะ return response ในรูปแบบเดียวกัน:

```json
{
  "success": true,
  "data": {
    "scenario_id": "sim_xxx",
    "scenario_type": "demand_increase",
    "scenario_name": "Demand Increase 50%",
    "parameters": { ... },
    "kpi_delta": {
      "throughput": { "baseline": 1000, "simulated": 1500, "absolute_delta": 500, "percent_delta": 50 },
      "utilization": { ... },
      "labor_utilization": { ... },
      "stockout_risk": { ... }
    },
    "bottlenecks": [ ... ],
    "risks": [ ... ],
    "summary": { ... }
  },
  "metadata": {
    "calculation_method": "...",
    "data_sources": ["wms_inventory_ledger", "wms_orders", ...],
    "data_period": "30 days",
    "confidence_level": "high",
    "generated_at": "2025-12-21T..."
  },
  "disclaimer": "ผลลัพธ์นี้เป็นการจำลองจากข้อมูลประวัติ ไม่ใช่การพยากรณ์ ควรใช้เป็นข้อมูลประกอบการตัดสินใจเท่านั้น"
}
```

---

## KPI Delta

การเปรียบเทียบ KPI ระหว่าง baseline และ scenario:

| KPI | Description | Unit |
|-----|-------------|------|
| throughput | ปริมาณงานต่อวัน | ชิ้น/วัน |
| utilization | อัตราการใช้พื้นที่ | % |
| labor_utilization | อัตราการใช้กำลังคน | % |
| stockout_risk | ความเสี่ยงขาดสต็อก | 0-100 |

---

## Bottleneck Analysis

ระบบจะระบุ bottlenecks โดยอัตโนมัติ:

| Resource Type | Description |
|---------------|-------------|
| storage | พื้นที่จัดเก็บ |
| labor | กำลังคน |
| equipment | อุปกรณ์ |
| process | กระบวนการ |

**Severity Levels:**
- `low`: utilization < 70%
- `medium`: utilization 70-85%
- `high`: utilization 85-95%
- `critical`: utilization > 95%

---

## Risk Assessment

ระบบจะประเมินความเสี่ยงโดยอัตโนมัติ:

| Risk Type | Description |
|-----------|-------------|
| stockout | ความเสี่ยงขาดสต็อก |
| overflow | ความเสี่ยงพื้นที่ล้น |
| service_level | ความเสี่ยงบริการไม่ทัน |
| expiry | ความเสี่ยงสินค้าหมดอายุ |

**Risk Levels:**
- `low`: score 0-30
- `medium`: score 31-60
- `high`: score 61-80
- `critical`: score 81-100

---

## AI Chat Integration

ผู้ใช้สามารถถาม AI Chat เกี่ยวกับ simulation ได้:

**ตัวอย่างคำถาม:**
- "ถ้าความต้องการเพิ่ม 50% จะเป็นอย่างไร"
- "จำลองถ้าซัพพลายเออร์ส่งช้า 7 วัน"
- "ถ้าลดพื้นที่ 20% จะมีปัญหาอะไร"
- "จำลองลดพนักงาน 25%"
- "เปรียบเทียบ scenario peak season กับ space constraint"

---

## Calculation Methods

### Utilization Calculation
```
utilization_percent = (current_qty / max_capacity) * 100
```

### Overflow Detection
```
if current_qty > max_capacity:
  overflow_qty = current_qty - max_capacity
  is_overflow = true
```

### Labor Capacity
```
daily_capacity = workers * hours_per_shift * productivity_rate
```

### KPI Delta
```
absolute_delta = simulated_value - baseline_value
percent_delta = (absolute_delta / baseline_value) * 100
```

### Storage Reduction
```
simulated_capacity = baseline_capacity * (1 - reduction_percent / 100)
```

### Demand Multiplier
```
simulated_orders = baseline_orders * demand_multiplier
```

### Lead Time Addition
```
simulated_lead_time = baseline_lead_time + increase_days
```

---

## Data Sources

| Model | Data Source |
|-------|-------------|
| Storage | master_location, wms_inventory_balances |
| Throughput | wms_inventory_ledger |
| Labor | master_employee, wms_picklists |
| Lead Time | receiving_orders, master_supplier |
| Order Patterns | wms_orders |

---

## Confidence Levels

| Level | Data Points | Description |
|-------|-------------|-------------|
| high | ≥ 30 days | ข้อมูลเพียงพอ |
| medium | 14-29 days | ข้อมูลปานกลาง |
| low | < 14 days | ข้อมูลน้อย ควรระวัง |

---

## Limitations

1. **ไม่ใช่การพยากรณ์**: ผลลัพธ์เป็นการจำลองจากข้อมูลประวัติ ไม่ใช่ AI prediction
2. **ไม่รวมปัจจัยภายนอก**: ไม่รวมปัจจัยที่ไม่มีในข้อมูล เช่น สภาพอากาศ, เศรษฐกิจ
3. **ข้อมูลประวัติจำกัด**: ต้องมีข้อมูลอย่างน้อย 30 วันเพื่อความแม่นยำ
4. **Deterministic**: ไม่มี random elements - ผลลัพธ์เดียวกันทุกครั้ง

---

## Property-Based Tests

ระบบมี property-based tests 12 ข้อ ตาม design document:

1. Utilization Calculation Correctness
2. Zone Aggregation Correctness
3. Simulation Isolation
4. Overflow Detection
5. Demand Multiplier Application
6. Lead Time Addition
7. Storage Reduction Calculation
8. Labor Capacity Calculation
9. KPI Delta Calculation
10. Simulation Reproducibility
11. Bottleneck Identification
12. Risk Score Bounds

ทุก test รัน minimum 100 iterations ด้วย fast-check library
