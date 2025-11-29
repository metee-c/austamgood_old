# ตรวจสอบ preparation_areas Schema

เปิด Supabase Studio → SQL Editor แล้วรันคำสั่งนี้:

```sql
-- 1. ตรวจสอบ schema ของ preparation_areas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'preparation_areas'
ORDER BY ordinal_position;
```

```sql
-- 2. ตรวจสอบข้อมูลใน preparation_areas
SELECT * FROM preparation_areas LIMIT 10;
```

```sql
-- 3. หา preparation area ที่ area_code = PK001
SELECT * FROM preparation_areas WHERE area_code = 'PK001';
```

**กรุณา copy ผลลัพธ์มาให้ดูครับ** เพื่อจะได้แก้ API ให้ถูกต้อง
