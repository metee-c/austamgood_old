# การปรับปรุงระบบ Loadlist และ Picklist

## สรุปการแก้ไข (27 พฤศจิกายน 2568)

### ปัญหาเดิม
- ช่อง **"ประตูโหลด"** และ **"คิวลำดับโหลด"** อยู่ที่หน้า **สร้างใบโหลดสินค้า** (`/receiving/loadlists`)
- ผู้ใช้ต้องระบุประตูโหลดเพียงครั้งเดียวสำหรับทุก picklist ในใบโหลด
- พนักงานไม่สามารถทราบได้ว่าแต่ละ picklist ต้องนำสินค้าไปวางรอที่ประตูไหน

### การแก้ไขที่ทำ

#### 1. Database Changes
- ✅ เพิ่มคอลัมน์ `loading_door_number` ในตาราง `picklists`
- ✅ สร้าง index สำหรับ `loading_door_number` เพื่อเพิ่มประสิทธิภาพการค้นหา
- ✅ ลบการบันทึก `loading_door_number` และ `loading_queue_number` ออกจากตาราง `loadlists`

#### 2. UI Changes - หน้า Picklists (`/receiving/picklists`)

**ฟอร์ม "สร้าง Picklist จากแผนรถที่เผยแพร่แล้ว":**
- ✅ แสดงรายการ trips เป็นตารางแทนการ์ด
- ✅ เพิ่มคอลัมน์ **"ประตูโหลด"** ให้ผู้ใช้เลือกสำหรับแต่ละ trip
- ✅ เพิ่ม checkbox เพื่อเลือกหลาย trips พร้อมกัน
- ✅ ปุ่ม "สร้าง Picklist" จะสร้างทีละหลายรายการพร้อมกัน

**ตารางหลัก Picklists:**
- ✅ เพิ่มคอลัมน์ **"ประตูโหลด"** เพื่อแสดงประตูที่กำหนดให้แต่ละ picklist
- ✅ แสดงข้อมูลประตูโหลดด้วยสีน้ำเงิน (font-mono) เพื่อให้เห็นชัดเจน

#### 3. UI Changes - หน้า Loadlists (`/receiving/loadlists`)

**ฟอร์ม "สร้างใบโหลดสินค้า":**
- ✅ ลบช่อง **"ประตูโหลด"** ออก
- ✅ ลบช่อง **"คิวลำดับโหลด"** ออก
- ✅ ลดจำนวนคอลัมน์ในตารางจาก 15 เป็น 13 คอลัมน์

**ฟิลด์ที่เหลือ:**
- ผู้เช็คโหลดสินค้า (checker_employee_id)
- ประเภทรถ (vehicle_type)
- ทะเบียนรถ (vehicle_id)
- คนขับ (driver_employee_id)
- เลขงานจัดส่ง (delivery_number)

#### 4. API Changes

**`POST /api/picklists/create-from-trip`:**
- ✅ รับพารามิเตอร์ `loading_door_number` เพิ่มเติม
- ✅ บันทึก `loading_door_number` ลงในตาราง `picklists`

**`GET /api/picklists`:**
- ✅ ดึงข้อมูล `loading_door_number` มาแสดงในตาราง

**`POST /api/loadlists`:**
- ✅ ลบการรับและบันทึก `loading_door_number` และ `loading_queue_number`
- ✅ ลบการ validate ฟิลด์ทั้งสองนี้

### ประโยชน์ที่ได้รับ

1. **ความชัดเจนสำหรับพนักงาน**
   - พนักงานสามารถดูได้ทันทีว่าแต่ละ picklist ต้องนำสินค้าไปวางรอที่ประตูไหน
   - ข้อมูลแสดงบนหัวรายงานใบหยิบสินค้า

2. **ความยืดหยุ่นในการจัดการ**
   - สามารถกำหนดประตูโหลดที่แตกต่างกันสำหรับแต่ละ picklist
   - เหมาะกับกรณีที่มีหลายประตูโหลดทำงานพร้อมกัน

3. **ลดความซับซ้อน**
   - ลดจำนวนฟิลด์ที่ต้องกรอกในหน้าสร้างใบโหลด
   - ทำให้ workflow ชัดเจนขึ้น: สร้าง Picklist → กำหนดประตู → สร้างใบโหลด

### การใช้งานใหม่

#### ขั้นตอนที่ 1: สร้าง Picklist
1. ไปที่หน้า **รายการหยิบสินค้า** (`/receiving/picklists`)
2. คลิกปุ่ม **"สร้าง Picklist จากแผนรถ"**
3. เลือก trips ที่ต้องการสร้าง picklist (ติ๊กถูก checkbox)
4. **กำหนดประตูโหลด** สำหรับแต่ละ trip (D01, D02, D03, ...)
5. คลิก **"สร้าง Picklist"**

#### ขั้นตอนที่ 2: สร้างใบโหลด
1. ไปที่หน้า **ใบโหลดสินค้า** (`/receiving/loadlists`)
2. คลิกปุ่ม **"สร้างใบโหลดใหม่"**
3. เลือก picklists ที่ต้องการโหลด
4. กรอกข้อมูล:
   - ผู้เช็คโหลดสินค้า
   - ประเภทรถ
   - ทะเบียนรถ (optional)
   - คนขับ (optional)
   - เลขงานจัดส่ง
5. คลิก **"สร้าง"**

### ไฟล์ที่แก้ไข

```
✅ supabase/migrations/040_add_loading_door_to_picklists.sql (ใหม่)
✅ app/receiving/picklists/page.tsx
✅ app/receiving/loadlists/page.tsx
✅ app/api/picklists/create-from-trip/route.ts
✅ app/api/loadlists/route.ts
```

### Migration SQL

```sql
-- เพิ่มคอลัมน์ loading_door_number ในตาราง picklists
ALTER TABLE public.picklists
ADD COLUMN IF NOT EXISTS loading_door_number character varying;

COMMENT ON COLUMN public.picklists.loading_door_number 
IS 'ประตูโหลดสินค้าที่กำหนดให้ picklist นี้ (เช่น D01, D02)';

-- สร้าง index
CREATE INDEX IF NOT EXISTS idx_picklists_loading_door 
ON public.picklists(loading_door_number) 
WHERE loading_door_number IS NOT NULL;
```

### หมายเหตุ

- ข้อมูล picklists ที่มีอยู่แล้วจะมี `loading_door_number = NULL`
- สามารถอัพเดตข้อมูลเก่าได้ภายหลังผ่าน UI หรือ SQL
- ระบบยังคงทำงานได้ปกติแม้ไม่ระบุประตูโหลด (optional field)

---

**สถานะ:** ✅ เสร็จสมบูรณ์
**วันที่:** 27 พฤศจิกายน 2568
**ผู้พัฒนา:** Kiro AI Assistant
