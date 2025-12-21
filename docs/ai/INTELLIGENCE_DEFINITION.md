# Intelligence Engine Definition

## Overview

Intelligence Engine คือระบบคำนวณข้อมูลเชิงลึกจากข้อมูลประวัติการทำงานของคลังสินค้า โดยใช้หลักการ:

- **NO AI, NO GUESSING** - ไม่มีการเดา ไม่มี Machine Learning
- **ONLY Math + Aggregation** - ใช้เฉพาะการคำนวณทางคณิตศาสตร์และการรวมข้อมูล
- **DETERMINISTIC** - ผลลัพธ์เดียวกันทุกครั้งจากข้อมูลเดียวกัน
- **EXPLAINABLE** - อธิบายได้ว่าคำนวณมาอย่างไร

---

## Intelligence APIs

### 1. Consumption API
**Endpoint:** `/api/ai/intelligence/consumption`

**Purpose:** คำนวณอัตราการใช้สินค้าจากประวัติการจ่ายออก

**Calculation Method:**
```
avg_daily_consumption = SUM(outbound_qty) / period_days
trend_30d = ((current_avg - previous_avg) / previous_avg) * 100
```

**Parameters:**
- `sku_id` - Filter by SKU (optional)
- `warehouse_id` - Filter by warehouse (optional)
- `period_days` - Analysis period (default: 30)

**Response Fields:**
- `avg_daily_consumption` - อัตราการใช้เฉลี่ยต่อวัน
- `trend_30d` - แนวโน้มเทียบกับ 30 วันก่อนหน้า (%)
- `data_points` - จำนวนข้อมูลที่ใช้คำนวณ
- `confidence` - ระดับความเชื่อมั่น (high/medium/low)

---

### 2. Days of Cover API
**Endpoint:** `/api/ai/intelligence/days-of-cover`

**Purpose:** ประมาณจำนวนวันที่สต็อกจะใช้ได้

**Calculation Method:**
```
available_qty = current_stock - reserved_qty
days_of_cover = available_qty / avg_daily_consumption
```

**Risk Levels:**
- `critical` - ≤ 3 วัน
- `warning` - ≤ 7 วัน
- `normal` - > 7 วัน
- `excess` - > 90 วัน หรือไม่มีการใช้

**Parameters:**
- `sku_id` - Filter by SKU (optional)
- `warehouse_id` - Filter by warehouse (optional)
- `period_days` - Period for consumption calculation (default: 30)
- `risk_threshold` - Filter by days threshold (default: 14)

---

### 3. Shortage Risk API
**Endpoint:** `/api/ai/intelligence/shortage-risk`

**Purpose:** ประเมินความเสี่ยงสินค้าขาดสต็อก

**Calculation Method:**
```
effective_stock = available_qty - pending_orders_qty
days_of_cover = effective_stock / avg_daily_consumption

risk_score calculation:
- critical (≤3 days): 90-100
- high (≤7 days): 70-90
- medium (≤14 days): 40-70
- low (>14 days): 0-40
```

**Response Fields:**
- `risk_score` - คะแนนความเสี่ยง (0-100)
- `risk_level` - ระดับความเสี่ยง (critical/high/medium/low)
- `estimated_stockout_date` - วันที่คาดว่าจะหมดสต็อก
- `recommended_action` - คำแนะนำการดำเนินการ (Thai)

---

### 4. Overstock Risk API
**Endpoint:** `/api/ai/intelligence/overstock-risk`

**Purpose:** ประเมินความเสี่ยงสต็อกเกิน

**Calculation Method:**
```
optimal_stock = avg_daily_consumption * 60 days
excess_qty = current_stock - optimal_stock (if positive)

risk_score based on days_of_cover:
- critical (≥180 days): 90
- high (≥120 days): 70
- medium (≥90 days): 50
- low (≥60 days): 30
```

**Response Fields:**
- `excess_qty` - จำนวนสต็อกส่วนเกิน
- `holding_cost_impact` - ผลกระทบต้นทุนการจัดเก็บ
- `recommended_action` - คำแนะนำการดำเนินการ (Thai)

---

### 5. Expiry Risk API
**Endpoint:** `/api/ai/intelligence/expiry-risk`

**Purpose:** ประเมินความเสี่ยงสินค้าหมดอายุ

**Calculation Method:**
```
days_until_expiry = expiry_date - today
estimated_consumption = avg_daily_consumption * days_until_expiry
will_expire_before_consumed = quantity > estimated_consumption
```

**Risk Levels:**
- `expired` - หมดอายุแล้ว (days_until_expiry ≤ 0)
- `critical` - ≤ 7 วัน
- `warning` - ≤ 30 วัน
- `normal` - > 30 วัน

**Parameters:**
- `days_threshold` - Filter expiry within N days (default: 90)

---

### 6. Utilization API
**Endpoint:** `/api/ai/intelligence/utilization`

**Purpose:** วิเคราะห์การใช้พื้นที่คลังสินค้า

**Calculation Method:**
```
utilization_percent = (current_qty / max_capacity) * 100
```

**Status Levels:**
- `empty` - 0%
- `low` - < 30%
- `optimal` - 30-80%
- `high` - 80-99%
- `full` - 100%

**Views:**
- `summary` - ภาพรวมทั้งหมด
- `locations` - รายละเอียดแต่ละโลเคชั่น
- `warehouse` - รายละเอียดแต่ละคลัง

---

## Confidence Levels

ระดับความเชื่อมั่นคำนวณจากจำนวนข้อมูลที่ใช้:

| Level | Data Points | Percent |
|-------|-------------|---------|
| High | ≥ 30 | 80-95% |
| Medium | 14-29 | 60-79% |
| Low | < 14 | 0-59% |

---

## Response Format

ทุก Intelligence API ส่งกลับในรูปแบบเดียวกัน:

```typescript
interface IntelligenceResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    calculation_method: string;  // วิธีการคำนวณ
    data_window: string;         // ช่วงเวลาข้อมูล
    data_points: number;         // จำนวนข้อมูล
    confidence_level: 'high' | 'medium' | 'low';
    confidence_percent: number;
    generated_at: string;        // เวลาที่สร้าง
  };
  disclaimer?: string;           // ข้อจำกัดของการคำนวณ
}
```

---

## Data Sources

| Intelligence | Primary Table | Supporting Tables |
|--------------|---------------|-------------------|
| Consumption | wms_inventory_ledger | master_sku |
| Days of Cover | wms_inventory_balances | wms_inventory_ledger |
| Shortage Risk | wms_inventory_balances | wms_order_items, wms_inventory_ledger |
| Overstock Risk | wms_inventory_balances | wms_inventory_ledger, master_sku |
| Expiry Risk | wms_inventory_balances | wms_inventory_ledger, master_sku |
| Utilization | master_location | master_warehouse |

---

## Limitations & Disclaimers

### สิ่งที่ระบบทำได้:
✅ คำนวณจากข้อมูลในอดีต
✅ แสดงแนวโน้มจากประวัติ
✅ ประเมินความเสี่ยงจากรูปแบบที่ผ่านมา
✅ ให้คำแนะนำตามเกณฑ์ที่กำหนด

### สิ่งที่ระบบทำไม่ได้:
❌ พยากรณ์อนาคตอย่างแม่นยำ
❌ คำนึงถึงปัจจัยภายนอก (โปรโมชั่น, ฤดูกาล)
❌ รับประกันความถูกต้อง 100%
❌ ทดแทนการตัดสินใจของมนุษย์

---

## Integration with AI Chat

AI Chat ใช้ Intelligence APIs ดังนี้:

1. **ตรวจจับ Intent** - วิเคราะห์คำถามผู้ใช้
2. **เรียก Intelligence API** - ดึงข้อมูลที่คำนวณแล้ว
3. **อธิบายผลลัพธ์** - แปลงเป็นภาษาที่เข้าใจง่าย
4. **แสดง Disclaimer** - แจ้งข้อจำกัดของข้อมูล

### ตัวอย่างการตอบ:

```
ผู้ใช้: "สินค้าไหนเสี่ยงขาดสต็อก?"

AI: จากการวิเคราะห์ข้อมูลการจ่ายออก 30 วันที่ผ่านมา
พบ 5 SKU ที่มีความเสี่ยงขาดสต็อก:

🔴 Critical (≤3 วัน):
1. SKU-001 - เหลือ ~2 วัน (ความเชื่อมั่น 85%)
   แนะนำ: เร่งสั่งซื้อทันที

🟠 High (≤7 วัน):
2. SKU-002 - เหลือ ~5 วัน (ความเชื่อมั่น 78%)
   แนะนำ: วางแผนสั่งซื้อภายใน 1-2 วัน

⚠️ หมายเหตุ: ประเมินจากอัตราการใช้ในอดีต
ไม่รวมปัจจัยภายนอก เช่น โปรโมชั่น หรือฤดูกาล
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-21 | Initial release with 6 intelligence APIs |
