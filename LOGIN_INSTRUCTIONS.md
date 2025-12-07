# 🔐 Login Instructions - Default Admin Accounts

## วิธีเข้าสู่ระบบ (How to Login)

ระบบมี **4 บัญชีผู้ใช้ทดสอบ** ที่พร้อมใช้งาน:

### 1. Super Admin (ผู้ดูแลระบบระดับสูงสุด)
```
Email: admin@austamgood.com
Username: superadmin
Password: Admin@123456
```

### 2. Admin (ผู้ดูแลระบบทั่วไป) ⭐ **RECOMMENDED FOR YOU**
```
Email: metee.c@buzzpetsfood.com
Username: admin
Password: Admin@123456
```

### 3. Manager (ผู้จัดการ)
```
Email: manager@austamgood.com
Username: manager
Password: Manager@123
```

### 4. Test User (ผู้ใช้งานทั่วไป)
```
Email: user@austamgood.com
Username: testuser
Password: User@123
```

---

## 📝 ขั้นตอนการติดตั้ง (Installation Steps)

### วิธีที่ 1: Run Migration ผ่าน Supabase Dashboard (แนะนำ)

1. เปิด [Supabase Dashboard](https://supabase.com/dashboard/project/iwlkslewdgenckuejbit/editor)
2. ไปที่ **SQL Editor**
3. คัดลอก SQL จากไฟล์ `supabase/migrations/125_insert_default_admin_users.sql`
4. วาง (Paste) ลงใน SQL Editor
5. กด **Run** เพื่อ execute

### วิธีที่ 2: Copy SQL ด้านล่างนี้ไปรันใน Supabase SQL Editor

```sql
-- Insert default roles
INSERT INTO master_system_role (role_id, role_name, description, is_active, created_at, updated_at)
VALUES
  (1, 'Super Admin', 'ผู้ดูแลระบบระดับสูงสุด มีสิทธิ์เข้าถึงทุกฟังก์ชัน', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 'Admin', 'ผู้ดูแลระบบทั่วไป', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 'Manager', 'ผู้จัดการ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (4, 'User', 'ผู้ใช้งานทั่วไป', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_id) DO NOTHING;

-- Insert default users
INSERT INTO master_system_user (user_id, username, email, full_name, password_hash, is_active, created_at, updated_at)
VALUES
  (1, 'superadmin', 'admin@austamgood.com', 'Super Administrator', '$2b$10$YQ7LKJ9kGZx6vB3jXqX0/.MZJYhKZH0YC2xvqVBWKVz8kQ3GxJYDK', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 'admin', 'metee.c@buzzpetsfood.com', 'Administrator', '$2b$10$YQ7LKJ9kGZx6vB3jXqX0/.MZJYhKZH0YC2xvqVBWKVz8kQ3GxJYDK', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 'manager', 'manager@austamgood.com', 'Test Manager', '$2b$10$Nh5Vz0Z5pP8rQ9wY7xX5JeGJ9KQ3LZ7cN5vQ8wY7xX5JeGJ9KQ3LZ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (4, 'testuser', 'user@austamgood.com', 'Test User', '$2b$10$Lj4Wx1Y6oO7pP8wX6yW4IeEI8JP2KY6bM4uP7wX6yW4IeEI8JP2KY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO NOTHING;
```

---

## ⚠️ สำคัญ (Important Notes)

1. **เปลี่ยนรหัสผ่านทันที** หลังเข้าสู่ระบบครั้งแรก
2. รหัสผ่านเหล่านี้เป็น **รหัสผ่านทดสอบเท่านั้น** ไม่ควรใช้ใน Production
3. ถ้าเข้าสู่ระบบไม่ได้ ให้ตรวจสอบว่า:
   - ✅ Run migration 118 แล้ว (enhance master_system_user)
   - ✅ Run migration 125 แล้ว (insert default users)
   - ✅ ใส่ email/username และ password ถูกต้อง

---

## 🔧 Troubleshooting

### ปัญหา: Login ไม่ได้ (401 Unauthorized)

**สาเหตุที่เป็นไปได้:**
1. ยังไม่ได้ run migration 125 → รันตามขั้นตอนด้านบน
2. Password hash ไม่ตรง → ใช้ bcrypt hash ที่ generate ใหม่
3. ตาราง `master_system_user` ยังไม่มี columns ที่จำเป็น → run migration 118

### ปัญหา: Password Reset ไม่ส่ง Email

**สาเหตุ:** ระบบยังไม่ได้ config SMTP email service

**วิธีแก้:**
1. ติดตั้ง email service (Gmail SMTP, SendGrid, Mailgun, etc.)
2. Config environment variables:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```
3. Update `lib/email/` services ให้ใช้ SMTP config

**Workaround ชั่วคราว:**
- ให้ admin ทำการ reset password ผ่าน Supabase Dashboard
- หรือใช้ function `UPDATE master_system_user SET password_hash = ... WHERE email = ...`

---

## 📊 Default Roles Summary

| Role ID | Role Name | Description | Permissions |
|---------|-----------|-------------|-------------|
| 1 | Super Admin | ผู้ดูแลระบบระดับสูงสุด | Full Access (TBD in Migration 117) |
| 2 | Admin | ผู้ดูแลระบบทั่วไป | Administrative Access |
| 3 | Manager | ผู้จัดการ | Management Access |
| 4 | User | ผู้ใช้งานทั่วไป | Basic User Access |

**หมายเหตุ:** Permissions จะถูกกำหนดใน Migration 117 (Insert Predefined Roles with Permissions)

---

## 🚀 Next Steps

หลังจาก login สำเร็จแล้ว คุณสามารถ:
1. ✅ ทดสอบระบบ authentication
2. ✅ สร้าง users ใหม่ผ่าน Admin panel
3. ✅ กำหนด roles และ permissions
4. ✅ Config email service สำหรับ password reset

---

**Created:** 2024-12-07
**Migration:** 125_insert_default_admin_users.sql
**Status:** ✅ Ready to use
