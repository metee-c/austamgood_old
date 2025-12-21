# ช่องว่างการพัฒนาระบบ AI Chat - Implementation Gaps

> เอกสารนี้ระบุสิ่งที่ระบบยังขาดและแนวทางการพัฒนา
> จัดลำดับความสำคัญและประมาณการเวลาพัฒนา
> วันที่สร้าง: 21 ธันวาคม 2025

---

## 1. สรุปช่องว่าง (Gap Summary)

| หมวด | สถานะปัจจุบัน | ช่องว่าง | ความสำคัญ |
|------|---------------|----------|-----------|
| Raw Data APIs | ✅ 100% | - | - |
| Intelligence APIs | ✅ 80% | Productivity, Picks/Hour | Medium |
| Simulation APIs | ✅ 100% | - | - |
| Forecast APIs | ❌ 0% | ทั้งหมด | High |
| Cost/Value APIs | ❌ 0% | ทั้งหมด | Medium |
| NLP Enhancement | ⚠️ 60% | Thai NLP, Context | Medium |

---

## 2. ช่องว่างระดับ Critical (ต้องทำ)

### 2.1 ❌ Forecast API (การพยากรณ์)

**สถานะ:** ไม่มี
**ผลกระทบ:** ผู้ใช้ไม่สามารถถามคำถามเกี่ยวกับอนาคตได้

**คำถามที่ตอบไม่ได้:**
- "พยากรณ์ยอดขายเดือนหน้า"
- "คาดการณ์สต็อกที่ต้องสั่ง"
- "เทรนด์การขายปีหน้า"

**แนวทางพัฒนา:**
```
Option A: Simple Moving Average (SMA)
- ใช้ค่าเฉลี่ยย้อนหลัง 30/60/90 วัน
- ง่าย, เร็ว, ไม่ต้องใช้ ML
- ความแม่นยำ: ต่ำ-ปานกลาง

Option B: Exponential Smoothing
- ให้น้ำหนักข้อมูลล่าสุดมากกว่า
- ปานกลาง, ไม่ต้องใช้ ML
- ความแม่นยำ: ปานกลาง

Option C: ML-based (Prophet/ARIMA)
- ใช้ Machine Learning
- ซับซ้อน, ต้องมี training data
- ความแม่นยำ: สูง
```

**ไฟล์ที่ต้องสร้าง:**
- `lib/intelligence/forecast-engine.ts`
- `app/api/ai/intelligence/forecast/route.ts`

**ประมาณการเวลา:** 3-5 วัน (Option A), 1-2 สัปดาห์ (Option C)

---

### 2.2 ❌ Unit Cost / Inventory Value

**สถานะ:** ไม่มี field `unit_cost` ใน `master_sku`
**ผลกระทบ:** ไม่สามารถคำนวณมูลค่าสต็อกได้

**คำถามที่ตอบไม่ได้:**
- "มูลค่าสต็อกทั้งหมดเท่าไร"
- "ต้นทุนสินค้า SKU-XXX เท่าไร"
- "มูลค่าสินค้าหมดอายุเท่าไร"

**แนวทางพัฒนา:**

**Step 1: เพิ่ม field ในฐานข้อมูล**
```sql
-- Migration: add_unit_cost_to_master_sku.sql
ALTER TABLE master_sku 
ADD COLUMN unit_cost DECIMAL(12,2) DEFAULT 0,
ADD COLUMN cost_currency VARCHAR(3) DEFAULT 'THB',
ADD COLUMN cost_updated_at TIMESTAMP;
```

**Step 2: สร้าง API**
```typescript
// app/api/ai/stock/value/route.ts
export async function GET(request: Request) {
  const { data } = await supabase
    .from('wms_inventory_balances')
    .select(`
      sku_id,
      total_piece_qty,
      master_sku!inner(sku_name, unit_cost)
    `);
  
  const totalValue = data.reduce((sum, item) => 
    sum + (item.total_piece_qty * item.master_sku.unit_cost), 0
  );
  
  return Response.json({ success: true, data: { totalValue } });
}
```

**Step 3: อัพเดท chat-service.ts**
```typescript
// เพิ่มใน TOOL_API_MAP
query_stock_value: '/api/ai/stock/value',

// เพิ่มใน detectIntent
if (lowerMessage.includes('มูลค่า') || lowerMessage.includes('ต้นทุน')) {
  tools.push('query_stock_value');
}
```

**ไฟล์ที่ต้องแก้ไข:**
- `supabase/migrations/XXX_add_unit_cost.sql` (สร้างใหม่)
- `types/database/supabase.ts` (regenerate)
- `lib/ai/chat-service.ts` (เพิ่ม tool)
- `lib/ai/data-contract.ts` (อัพเดท)
- `app/api/ai/stock/value/route.ts` (สร้างใหม่)

**ประมาณการเวลา:** 2-3 วัน

---

## 3. ช่องว่างระดับ High (ควรทำ)

### 3.1 ⚠️ Productivity / Picks per Hour

**สถานะ:** ไม่มีข้อมูลเวลาในการหยิบ
**ผลกระทบ:** ไม่สามารถวัดประสิทธิภาพพนักงานได้

**คำถามที่ตอบไม่ได้:**
- "พนักงาน XXX หยิบได้กี่ชิ้นต่อชั่วโมง"
- "ประสิทธิภาพการหยิบเป็นอย่างไร"
- "ใครหยิบเร็วที่สุด"

**แนวทางพัฒนา:**

**Step 1: เพิ่ม timestamp fields**
```sql
-- Migration: add_pick_timestamps.sql
ALTER TABLE picklist_items 
ADD COLUMN pick_started_at TIMESTAMP,
ADD COLUMN pick_completed_at TIMESTAMP;

ALTER TABLE face_sheet_items 
ADD COLUMN pack_started_at TIMESTAMP,
ADD COLUMN pack_completed_at TIMESTAMP;
```

**Step 2: อัพเดท Mobile API**
```typescript
// app/api/mobile/pick/scan/route.ts
// เพิ่มการบันทึก timestamp เมื่อเริ่มหยิบและหยิบเสร็จ
await supabase
  .from('picklist_items')
  .update({ 
    pick_started_at: new Date().toISOString(),
    // หรือ pick_completed_at เมื่อหยิบเสร็จ
  })
  .eq('id', itemId);
```

**Step 3: สร้าง Productivity Engine**
```typescript
// lib/intelligence/productivity-engine.ts
export function calculatePicksPerHour(employeeId: string, periodDays: number) {
  // Query picklist_items with timestamps
  // Calculate: total_picks / total_hours
  // Return: picks_per_hour, ranking, trend
}
```

**ไฟล์ที่ต้องสร้าง/แก้ไข:**
- `supabase/migrations/XXX_add_pick_timestamps.sql`
- `lib/intelligence/productivity-engine.ts`
- `app/api/ai/intelligence/productivity/route.ts`
- `app/api/mobile/pick/scan/route.ts` (แก้ไข)

**ประมาณการเวลา:** 3-5 วัน

---

### 3.2 ⚠️ Supplier Lead Time Tracking

**สถานะ:** ไม่มีการเก็บ Lead Time จริง
**ผลกระทบ:** Simulation ใช้ค่า default แทนค่าจริง

**คำถามที่ตอบไม่ได้:**
- "Lead Time ซัพพลายเออร์ XXX เฉลี่ยกี่วัน"
- "ซัพพลายเออร์ไหนส่งช้าบ่อย"

**แนวทางพัฒนา:**

**Step 1: เพิ่ม fields**
```sql
-- Migration: add_lead_time_tracking.sql
ALTER TABLE wms_receives 
ADD COLUMN po_date DATE,
ADD COLUMN expected_date DATE,
ADD COLUMN actual_receive_date DATE;

-- หรือสร้างตารางใหม่
CREATE TABLE supplier_lead_time_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES master_supplier(supplier_id),
  po_date DATE NOT NULL,
  expected_date DATE,
  actual_date DATE NOT NULL,
  lead_time_days INT GENERATED ALWAYS AS (actual_date - po_date) STORED,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Step 2: สร้าง Lead Time Engine**
```typescript
// lib/intelligence/leadtime-engine.ts
export function calculateSupplierLeadTime(supplierId: string) {
  // Query supplier_lead_time_history
  // Calculate: avg, p50, p90, std_deviation
  // Return: metrics with confidence
}
```

**ประมาณการเวลา:** 2-3 วัน

---

## 4. ช่องว่างระดับ Medium (น่าทำ)

### 4.1 ⚠️ Thai NLP Enhancement

**สถานะ:** Intent detection ใช้ keyword matching อย่างง่าย
**ผลกระทบ:** บางคำถามอาจไม่เข้าใจ

**ปัญหาปัจจุบัน:**
- ไม่เข้าใจคำพ้องความหมาย (เช่น "ของ" = "สินค้า" = "สต็อก")
- ไม่เข้าใจคำย่อ (เช่น "ออ" = "ออเดอร์")
- ไม่เข้าใจ typo (เช่น "สต๊อก" แทน "สต็อก")

**แนวทางพัฒนา:**

**Option A: Synonym Dictionary**
```typescript
// lib/ai/thai-synonyms.ts
export const SYNONYMS = {
  'สต็อก': ['stock', 'สินค้า', 'ของ', 'คงเหลือ', 'สต๊อก'],
  'ออเดอร์': ['order', 'คำสั่งซื้อ', 'ออ', 'ใบสั่ง'],
  'หมดอายุ': ['expire', 'เสีย', 'หมดอายุ', 'exp'],
  // ...
};

export function normalizeMessage(message: string): string {
  let normalized = message.toLowerCase();
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    for (const syn of synonyms) {
      normalized = normalized.replace(new RegExp(syn, 'gi'), key);
    }
  }
  return normalized;
}
```

**Option B: Fuzzy Matching**
```typescript
// ใช้ library เช่น fuse.js
import Fuse from 'fuse.js';

const fuse = new Fuse(KEYWORDS, {
  includeScore: true,
  threshold: 0.4, // ยอมรับ typo
});
```

**ประมาณการเวลา:** 1-2 วัน

---

### 4.2 ⚠️ Conversation Context

**สถานะ:** ไม่มี context ระหว่าง messages
**ผลกระทบ:** ต้องถามคำถามใหม่ทุกครั้ง

**ปัญหาปัจจุบัน:**
```
User: "สต็อก SKU-001 เหลือเท่าไร"
AI: "SKU-001 เหลือ 500 ชิ้น"
User: "แล้วที่โลเคชั่น A-01 ล่ะ"  ← ไม่เข้าใจว่าหมายถึง SKU-001
```

**แนวทางพัฒนา:**

```typescript
// lib/ai/context-manager.ts
interface ConversationContext {
  session_id: string;
  last_sku_id?: string;
  last_order_id?: string;
  last_location_id?: string;
  last_customer_id?: string;
  last_query_type?: string;
  messages: ChatMessage[];
}

export function extractContext(messages: ChatMessage[]): ConversationContext {
  const context: ConversationContext = { session_id: '', messages };
  
  // ดึง entity จาก messages ก่อนหน้า
  for (const msg of messages.slice(-5)) { // ดู 5 messages ล่าสุด
    const skuMatch = msg.content.match(/SKU-\w+/i);
    if (skuMatch) context.last_sku_id = skuMatch[0];
    
    const orderMatch = msg.content.match(/IV\d+/i);
    if (orderMatch) context.last_order_id = orderMatch[0];
    // ...
  }
  
  return context;
}

export function resolvePronouns(message: string, context: ConversationContext): string {
  // แทนที่ "มัน", "ตัวนั้น", "อันนั้น" ด้วย entity จาก context
  if (message.includes('มัน') && context.last_sku_id) {
    message = message.replace('มัน', context.last_sku_id);
  }
  return message;
}
```

**ประมาณการเวลา:** 2-3 วัน

---

### 4.3 ⚠️ Multi-language Support

**สถานะ:** รองรับเฉพาะไทย + อังกฤษบางส่วน
**ผลกระทบ:** ผู้ใช้ต่างชาติอาจใช้งานยาก

**แนวทางพัฒนา:**

```typescript
// lib/ai/language-detector.ts
export function detectLanguage(message: string): 'th' | 'en' {
  const thaiPattern = /[\u0E00-\u0E7F]/;
  return thaiPattern.test(message) ? 'th' : 'en';
}

// lib/ai/response-templates.ts
export const RESPONSES = {
  no_data: {
    th: 'ไม่พบข้อมูลตามเงื่อนไขที่ระบุ',
    en: 'No data found for the specified criteria',
  },
  // ...
};
```

**ประมาณการเวลา:** 1-2 วัน

---

## 5. ช่องว่างระดับ Low (อาจทำ)

### 5.1 Voice Input

**สถานะ:** ไม่มี
**ผลกระทบ:** ต้องพิมพ์ทุกครั้ง

**แนวทาง:** ใช้ Web Speech API หรือ third-party service

**ประมาณการเวลา:** 3-5 วัน

---

### 5.2 Export to Excel/PDF

**สถานะ:** ไม่มีใน AI Chat
**ผลกระทบ:** ต้อง copy ข้อมูลเอง

**แนวทาง:** เพิ่ม action "export" ใน response

**ประมาณการเวลา:** 1-2 วัน

---

### 5.3 Scheduled Reports

**สถานะ:** ไม่มี
**ผลกระทบ:** ต้องถามทุกครั้ง

**แนวทาง:** สร้าง cron job + notification

**ประมาณการเวลา:** 3-5 วัน

---

## 6. Roadmap แนะนำ

### Phase 1: Quick Wins (1-2 สัปดาห์)

| ลำดับ | งาน | เวลา | ผลกระทบ |
|-------|-----|------|---------|
| 1 | Thai Synonyms | 1 วัน | ปรับปรุง intent detection |
| 2 | Conversation Context | 2 วัน | UX ดีขึ้นมาก |
| 3 | Multi-language | 1 วัน | รองรับผู้ใช้ต่างชาติ |

### Phase 2: Core Features (2-4 สัปดาห์)

| ลำดับ | งาน | เวลา | ผลกระทบ |
|-------|-----|------|---------|
| 1 | Unit Cost / Value | 3 วัน | ตอบคำถามมูลค่าได้ |
| 2 | Productivity Tracking | 5 วัน | วัดประสิทธิภาพได้ |
| 3 | Lead Time Tracking | 3 วัน | Simulation แม่นยำขึ้น |

### Phase 3: Advanced Features (1-2 เดือน)

| ลำดับ | งาน | เวลา | ผลกระทบ |
|-------|-----|------|---------|
| 1 | Forecast API (SMA) | 5 วัน | พยากรณ์เบื้องต้นได้ |
| 2 | Forecast API (ML) | 2 สัปดาห์ | พยากรณ์แม่นยำ |
| 3 | Voice Input | 5 วัน | UX ดีขึ้น |
| 4 | Scheduled Reports | 5 วัน | Automation |

---

## 7. Technical Debt

### 7.1 Code Quality

| ปัญหา | ไฟล์ | แนวทางแก้ไข |
|-------|------|-------------|
| chat-service.ts ยาวเกินไป (2000+ lines) | lib/ai/chat-service.ts | แยกเป็น modules |
| Duplicate code ใน format functions | lib/ai/chat-service.ts | สร้าง shared formatter |
| Magic numbers ใน thresholds | lib/ai/reasoning-engine.ts | ย้ายไป config |

### 7.2 Testing

| ปัญหา | แนวทางแก้ไข |
|-------|-------------|
| ไม่มี unit tests สำหรับ AI | สร้าง tests ใน lib/ai/__tests__ |
| ไม่มี integration tests | สร้าง tests สำหรับ API endpoints |
| ไม่มี test data | สร้าง fixtures |

### 7.3 Documentation

| ปัญหา | แนวทางแก้ไข |
|-------|-------------|
| API docs ไม่ครบ | สร้าง OpenAPI spec |
| ไม่มี JSDoc | เพิ่ม JSDoc comments |

---

## 8. สรุป Priority Matrix

```
                    HIGH IMPACT
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │  Unit Cost/Value  │  Forecast API     │
    │  Productivity     │                   │
    │                   │                   │
LOW ├───────────────────┼───────────────────┤ HIGH
EFFORT│                 │                   │ EFFORT
    │  Thai Synonyms    │  Voice Input      │
    │  Context          │  ML Forecast      │
    │  Multi-lang       │                   │
    │                   │                   │
    └───────────────────┼───────────────────┘
                        │
                    LOW IMPACT
```

**แนะนำเริ่มจาก:**
1. Thai Synonyms + Context (Low effort, High impact)
2. Unit Cost/Value (Medium effort, High impact)
3. Forecast API SMA (Medium effort, High impact)
