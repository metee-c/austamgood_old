# วิธีแก้ปัญหา: Trips ไม่ถูกบันทึกลงฐานข้อมูล

## สาเหตุ
Database ยังไม่มี column `is_overweight` ใน table `receiving_route_trips` ทำให้การบันทึก trips ล้มเหลว

## วิธีแก้ไข

### วิธีที่ 1: ใช้ Supabase Dashboard (แนะนำ)
1. เปิด Supabase Dashboard: https://supabase.com/dashboard
2. เลือก Project ของคุณ
3. ไปที่ SQL Editor
4. รัน SQL นี้:

```sql
ALTER TABLE "public"."receiving_route_trips"
ADD COLUMN IF NOT EXISTS "is_overweight" boolean DEFAULT false;

COMMENT ON COLUMN "public"."receiving_route_trips"."is_overweight" 
IS 'แฟล็กบ่งชี้ว่าเที่ยวนี้มีน้ำหนักเกินความจุรถ (เกิดจากการบังคับจำนวนรถสูงสุด)';
```

5. กด Run
6. รีเฟรชหน้าเว็บและลองจัดเส้นทางใหม่

### วิธีที่ 2: ใช้ Supabase CLI (ถ้ามี Docker)
```bash
cd supabase
supabase db reset --local
```

### วิธีที่ 3: ใช้ psql (ถ้าเชื่อมต่อ database โดยตรง)
```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20241111_add_is_overweight_to_trips.sql
```

## ตรวจสอบว่าแก้ไขสำเร็จ
1. ลองจัดเส้นทางใหม่
2. เปิด Browser Console (F12)
3. ดู log ว่ามีข้อความ "✅ Saved X stops for trip Y" หรือไม่
4. ถ้าไม่มี error แสดงว่าสำเร็จ

## หลังจากแก้ไขแล้ว
- ฟีเจอร์ย้ายออเดอร์จะทำงานได้ปกติ
- Trips จะถูกบันทึกลงฐานข้อมูลแทนที่จะเก็บใน settings
- แผนที่จะแสดงข้อมูลจาก database จริง
