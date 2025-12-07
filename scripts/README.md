# Admin Scripts

Scripts สำหรับจัดการระบบ authentication และ user management

## Prerequisites

ต้องมี environment variables ใน `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Scripts

### 1. List Users
แสดงรายชื่อผู้ใช้ทั้งหมดในระบบ

```bash
node scripts/list-users.js
```

### 2. Reset User Password
Reset รหัสผ่านของผู้ใช้ (สำหรับกรณีที่ผู้ใช้ลืมรหัสผ่าน)

```bash
node scripts/reset-user-password.js <email> <new-password>
```

**ตัวอย่าง:**
```bash
node scripts/reset-user-password.js metee.c@buzzpetsfood.com NewPassword123
```

**หมายเหตุ:**
- รหัสผ่านใหม่จะถูก hash ด้วย bcrypt ก่อนบันทึก
- ผู้ใช้จะถูกบังคับให้เปลี่ยนรหัสผ่านในครั้งถัดไปที่ login
- Failed login attempts จะถูก reset เป็น 0
- Account lock จะถูกปลดล็อคอัตโนมัติ

## ตัวอย่างการใช้งาน

### กรณีผู้ใช้ลืมรหัสผ่าน

1. ดูรายชื่อผู้ใช้ก่อน:
```bash
node scripts/list-users.js
```

2. Reset รหัสผ่านให้ผู้ใช้:
```bash
node scripts/reset-user-password.js user@example.com TempPassword123
```

3. แจ้งรหัสผ่านชั่วคราวให้ผู้ใช้
4. ผู้ใช้ login ด้วยรหัสผ่านชั่วคราว
5. ระบบจะบังคับให้เปลี่ยนรหัสผ่านใหม่

## Security Notes

⚠️ **คำเตือน:**
- Scripts เหล่านี้ใช้ Service Role Key ที่มีสิทธิ์เต็ม
- ใช้เฉพาะในสภาพแวดล้อมที่ปลอดภัย
- อย่า commit Service Role Key ลง git
- ควรมีเฉพาะ admin เท่านั้นที่เข้าถึง scripts เหล่านี้
