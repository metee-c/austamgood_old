# แก้ไขปัญหาผู้ใช้ถูกออกจากระบบบ่อย (Session Auto-Logout Bug)

## ปัญหา

ผู้ใช้ถูกออกจากระบบอัตโนมัติแม้ว่าจะกำลังใช้งานอยู่

**รายงานจากผู้ใช้:**
> "บางทีคนใช้งานก็ใช้ระบบอยู่นะ แต่ระบบชอบเด้งหมดเซสชันออกเอง"

## สาเหตุ

### 1. ฟังก์ชันฐานข้อมูลหายไป
- `validate_session_token()` - ไม่มีใน migration 119
- `update_session_activity_by_token()` - ไม่มีใน migration 119
- ฟังก์ชันเหล่านี้ถูกเรียกใช้โดย `lib/auth/session.ts` แต่ไม่มีอยู่จริง

### 2. Session ไม่ขยายเวลาอัตโนมัติ
- Session duration: 24 ชั่วโมง (คงที่)
- Idle timeout: 30 นาที
- ไม่มีการขยายเวลาเมื่อผู้ใช้ทำงาน
- ผู้ใช้ถูกออกจากระบบหลัง 30 นาที แม้จะใช้งานอยู่

### 3. Session เยอะเกินไป
- บางผู้ใช้มี 50+ sessions ที่ active
- Session ที่หมดอายุไม่ถูกลบ
- ตัวอย่าง: RC001 มี 64 sessions, metee.c มี 55 sessions

## การแก้ไข: Migration 245

### ฟังก์ชันที่สร้างใหม่

#### 1. `validate_session_token(p_token)`
```sql
RETURNS TABLE (
    session_id UUID,
    user_id INTEGER,
    username VARCHAR(50),
    email VARCHAR(255),
    full_name VARCHAR(255),
    is_valid BOOLEAN,
    expires_in_seconds INTEGER,
    last_activity_minutes_ago INTEGER
)
```
- ตรวจสอบ session token
- คืนค่าข้อมูลผู้ใช้พร้อมเวลาหมดอายุ

#### 2. `update_session_activity_by_token(p_token)`
```sql
RETURNS BOOLEAN
```
- อัปเดต `last_activity_at` = เวลาปัจจุบัน
- **ขยาย `expired_at` ออกไปอีก 30 นาที**
- ทำให้ผู้ใช้อยู่ในระบบได้ตราบเท่าที่ยังใช้งาน

#### 3. `invalidate_session(p_token, p_invalidated_by)`
```sql
RETURNS BOOLEAN
```
- ทำให้ session หมดอายุ
- รองรับ parameter `invalidated_by` (optional)

## วิธีการทำงาน

```
ผู้ใช้ทำงาน → API Call → update_session_activity_by_token()
                              ↓
                    อัปเดต last_activity_at = NOW()
                    ขยาย expired_at = NOW() + 30 นาที
                              ↓
                    ผู้ใช้อยู่ในระบบต่อ!
```

### ตัวอย่าง

- ผู้ใช้ login เวลา 09:00 → Session หมดอายุ 09:30
- ผู้ใช้คลิกเวลา 09:25 → Session ขยายเป็น 09:55
- ผู้ใช้คลิกเวลา 09:50 → Session ขยายเป็น 10:20
- ผู้ใช้ทำงานต่อ → Session ขยายต่อเรื่อยๆ
- ผู้ใช้หยุดทำงาน → Session หมดอายุหลัง 30 นาทีของการไม่ใช้งาน

## การติดตั้ง

### ✅ Migration 245 รันสำเร็จแล้ว

Migration ถูกรันผ่าน MCP Supabase เรียบร้อยแล้ว

### ตรวจสอบฟังก์ชัน

```sql
-- ตรวจสอบว่าฟังก์ชันถูกสร้างแล้ว
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_session_token',
    'update_session_activity_by_token',
    'invalidate_session'
  );
```

ควรได้ผลลัพธ์ 3 แถว

## การทดสอบ

### 1. ทดสอบการขยาย Session

1. Login เข้าระบบ
2. รอ 5 นาที
3. คลิกหน้าต่างๆ
4. ตรวจสอบ session expiry:

```sql
SELECT 
  u.username,
  s.expired_at,
  s.last_activity_at,
  EXTRACT(EPOCH FROM (s.expired_at - CURRENT_TIMESTAMP))/60 as minutes_until_expiry
FROM user_sessions s
JOIN master_system_user u USING (user_id)
WHERE s.invalidated = false
ORDER BY s.last_activity_at DESC
LIMIT 10;
```

`expired_at` ควรขยายออกไปทุกครั้งที่มี activity

### 2. ตรวจสอบ Active Sessions

```bash
node scripts/check-active-sessions.js
```

## การตั้งค่า

### ปรับ Idle Timeout

```sql
-- เปลี่ยนจาก 30 นาที เป็น 60 นาที
UPDATE system_settings
SET setting_value = '60'
WHERE setting_key = 'auth.session_idle_timeout_minutes';
```

### ลบ Session ที่หมดอายุ

```sql
-- ทำให้ session ที่หมดอายุเป็น invalid
UPDATE user_sessions
SET invalidated = true,
    invalidated_at = CURRENT_TIMESTAMP
WHERE expired_at < CURRENT_TIMESTAMP
  AND invalidated = false;
```

## ผลลัพธ์ที่คาดหวัง

✅ ผู้ใช้อยู่ในระบบได้ตราบเท่าที่ยังทำงาน
✅ Session ขยายเวลาอัตโนมัติทุก API call
✅ Session ที่ไม่ใช้งานหมดอายุหลัง 30 นาที
✅ ไม่มีการออกจากระบบกะทันหันระหว่างทำงาน
✅ แต่ละผู้ใช้มี session แยกกัน (sameSite: strict)

## ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/245_fix_session_functions_and_extend_duration.sql` - Migration ใหม่
- `lib/auth/session.ts` - การจัดการ session (เรียกใช้ฟังก์ชัน)
- `lib/auth/settings.ts` - การตั้งค่า session timeout
- `app/api/auth/me/route.ts` - Endpoint ผู้ใช้ปัจจุบัน
- `scripts/check-active-sessions.js` - เครื่องมือตรวจสอบ

## Checklist การทดสอบ

- [x] Migration 245 รันสำเร็จ
- [x] ฟังก์ชันถูกสร้างในฐานข้อมูล
- [ ] ผู้ใช้ login สำเร็จ
- [ ] Session ขยายเวลาเมื่อมี activity
- [ ] ผู้ใช้อยู่ในระบบได้ระหว่างทำงาน
- [ ] Session ที่ไม่ใช้งานหมดอายุหลัง 30 นาที
- [ ] ไม่มี session mixing ระหว่างผู้ใช้
- [ ] Log แสดงข้อมูลผู้ใช้ที่ถูกต้อง

## ขั้นตอนถัดไป

1. ✅ รัน migration 245 ใน production
2. ⏳ ติดตาม feedback จากผู้ใช้เกี่ยวกับปัญหาการออกจากระบบ
3. ⏳ ปรับ idle timeout ถ้าจำเป็น (ปัจจุบัน 30 นาที)
4. ⏳ สร้างระบบลบ session ที่หมดอายุอัตโนมัติ
5. ⏳ เพิ่ม dashboard สำหรับ admin ดู session activity

## สรุป

Migration 245 แก้ไขปัญหาผู้ใช้ถูกออกจากระบบบ่อยโดย:

1. สร้างฟังก์ชันที่หายไป (`validate_session_token`, `update_session_activity_by_token`, `invalidate_session`)
2. ทำให้ session ขยายเวลาอัตโนมัติเมื่อผู้ใช้ทำงาน
3. Session หมดอายุเฉพาะเมื่อไม่มี activity เป็นเวลา 30 นาที

ผู้ใช้จะสามารถทำงานได้อย่างต่อเนื่องโดยไม่ถูกออกจากระบบกะทันหัน
