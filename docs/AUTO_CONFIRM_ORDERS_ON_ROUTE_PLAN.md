# Auto-Confirm Orders on Route Plan Creation

## Overview
เมื่อสร้างแผนจัดเส้นทาง (Route Plan) ใหม่ที่หน้า `/receiving/routes` ระบบจะอัปเดตสถานะของออเดอร์ประเภท "จัดเส้นทาง" (route_planning) จาก "ร่าง" (draft) ไปเป็น "ยืนยัน" (confirmed) โดยอัตโนมัติ

## Business Logic

### เมื่อไหร่ที่จะอัปเดตสถานะ
- เมื่อมีการสร้าง Route Plan ใหม่ (INSERT into `receiving_route_plans`)
- Route Plan ที่สร้างต้องมีสถานะเป็น `'draft'`

### ออเดอร์ไหนที่จะถูกอัปเดต
ระบบจะอัปเดตเฉพาะออเดอร์ที่:
1. อยู่ใน Route Plan ที่เพิ่งสร้าง (ผ่าน `receiving_route_trips` และ `receiving_route_stops`)
2. มี `order_type = 'route_planning'`
3. มีสถานะปัจจุบันเป็น `status = 'draft'`

### การเปลี่ยนแปลงสถานะ
- **จาก**: `status = 'draft'`
- **ไป**: `status = 'confirmed'`
- **อัปเดต**: `updated_at = NOW()`

## Technical Implementation

### Database Trigger
**File**: `supabase/migrations/140_auto_confirm_orders_on_route_plan_creation.sql`

#### Function: `update_order_on_route_stop_creation()`
```sql
CREATE OR REPLACE FUNCTION update_order_on_route_stop_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.order_id IS NOT NULL THEN
    -- Check if the route plan is in draft status
    SELECT rp.status INTO v_plan_status
    FROM receiving_route_trips rt
    INNER JOIN receiving_route_plans rp ON rt.plan_id = rp.plan_id
    WHERE rt.trip_id = NEW.trip_id;
    
    -- Only update if plan is in draft status
    IF v_plan_status = 'draft' THEN
      UPDATE wms_orders
      SET 
        status = 'confirmed',
        updated_at = NOW()
      WHERE order_id = NEW.order_id
        AND order_type = 'route_planning'
        AND status = 'draft';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Trigger: `trigger_update_order_on_route_stop_creation`
- **Table**: `receiving_route_stops`
- **Event**: `AFTER INSERT`
- **For Each**: `ROW`

### Why Trigger on Route Stops?
เดิมพยายามใช้ trigger บน `receiving_route_plans` แต่พบว่าตอนที่ INSERT route plan ยังไม่มี trips และ stops ถูกสร้าง (สร้างทีหลัง 3-4 วินาที) ดังนั้นจึงเปลี่ยนมาใช้ trigger บน `receiving_route_stops` แทน เพราะ:
1. Route stops ถูกสร้างหลังจาก route plan และ trips
2. แต่ละ stop มี order_id ที่ต้องอัปเดต
3. Trigger จะทำงานทันทีที่ stop ถูกสร้าง พร้อมกับ order_id

## Data Flow

```
1. User creates Route Plan at /receiving/routes
   ↓
2. INSERT into receiving_route_plans (status='draft')
   ↓
3. System creates trips: INSERT into receiving_route_trips
   ↓
4. System creates stops: INSERT into receiving_route_stops (with order_id)
   ↓
5. Trigger: trigger_update_order_on_route_stop_creation fires (for each stop)
   ↓
6. Function: update_order_on_route_stop_creation() executes
   ↓
7. Check if route plan status = 'draft'
   ↓
8. UPDATE wms_orders SET status='confirmed'
   WHERE order_id = NEW.order_id
   AND order_type='route_planning' 
   AND status='draft'
   ↓
9. Orders displayed at /receiving/orders show status='confirmed'
```

## Testing

### Test Case 1: Existing Route Plans (Manual Update)
**Route Plan 163**: RP-20251214-001
- IV25112289 (order_id: 5606) - status: draft → confirmed ✅
- IV25112111 (order_id: 5604) - status: draft → confirmed ✅

**Route Plan 164**: RP-20251214-001
- IV25112289 (order_id: 5609) - status: draft → confirmed ✅
- IV25112111 (order_id: 5607) - status: draft → confirmed ✅

### Test Case 2: New Route Plan (Automatic)
เมื่อสร้าง Route Plan ใหม่ในอนาคต trigger จะทำงานโดยอัตโนมัติทันทีที่ route stops ถูกสร้าง

**Timeline Analysis** (from plan_id: 164):
- 09:46:48 - Route plan created
- 09:46:52 - Route trips created (4 seconds later)
- 09:46:52 - Route stops created → **Trigger fires here**
- Orders updated to 'confirmed' immediately

## Benefits

1. **Automation**: ไม่ต้องอัปเดตสถานะออเดอร์ด้วยตนเอง
2. **Consistency**: สถานะออเดอร์จะสอดคล้องกับการสร้าง Route Plan เสมอ
3. **Data Integrity**: ใช้ database trigger ทำให้มั่นใจว่าจะไม่มีการพลาด
4. **Real-time**: อัปเดตทันทีที่สร้าง Route Plan

## Related Files

- **Migration**: `supabase/migrations/140_auto_confirm_orders_on_route_plan_creation.sql`
- **Orders Page**: `app/receiving/orders/page.tsx`
- **Routes Page**: `app/receiving/routes/page.tsx`
- **Route Plans API**: `app/api/route-plans/route.ts`

## Notes

- Trigger ทำงานเฉพาะกับ Route Plan ที่มีสถานะ `'draft'` เท่านั้น
- ออเดอร์ที่ไม่ใช่ประเภท `'route_planning'` จะไม่ถูกอัปเดต
- ออเดอร์ที่มีสถานะอื่นนอกจาก `'draft'` จะไม่ถูกอัปเดต
- การอัปเดตจะเกิดขึ้นที่ระดับ database ไม่ต้องแก้ไข frontend code
- Trigger ทำงานทีละ row (FOR EACH ROW) ดังนั้นถ้ามี 10 stops จะมี 10 orders ถูกอัปเดต
- การอัปเดตเกิดขึ้นทันทีที่ route stop ถูกสร้าง ไม่ต้องรอให้ route plan เสร็จสมบูรณ์

## Troubleshooting

### ถ้าออเดอร์ไม่ถูกอัปเดต ให้ตรวจสอบ:
1. Route plan มีสถานะเป็น 'draft' หรือไม่
2. Order มี order_type = 'route_planning' หรือไม่
3. Order มีสถานะเป็น 'draft' หรือไม่
4. Route stop มี order_id ที่ถูกต้องหรือไม่

### ตรวจสอบ trigger:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_update_order_on_route_stop_creation';

-- Check if function exists
SELECT * FROM pg_proc 
WHERE proname = 'update_order_on_route_stop_creation';
```
