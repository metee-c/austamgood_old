# 🔍 คู่มือ Debug ปัญหา Permission

**วันที่:** 8 ธันวาคม 2025  
**ปัญหา:** Login สำเร็จแต่แสดง "ไม่มีสิทธิ์เข้าถึง"

---

## 🎯 การเปลี่ยนแปลงที่ทำ

### 1. เพิ่ม Debug Logs ใน `hooks/useAuth.ts`

เพิ่ม console.log เพื่อติดตาม:
- ✅ การเรียก `/api/auth/me`
- ✅ การเรียก `/api/auth/permissions`
- ✅ จำนวน permissions ที่ได้รับ
- ✅ การ set state

### 2. เพิ่ม Debug Logs ใน `hooks/usePermission.ts`

เพิ่ม console.log เพื่อแสดง:
- ✅ User role
- ✅ จำนวน permissions
- ✅ Permission ที่กำลังเช็ค
- ✅ ผลลัพธ์การเช็ค

### 3. เพิ่ม Dashboard Permission

```sql
-- เพิ่ม permission สำหรับ Dashboard
INSERT INTO master_permission_module (module_name, module_key, description, parent_module_id, display_order, is_active, icon)
VALUES 
  ('Dashboard', 'dashboard', 'โมดูล Dashboard', NULL, 100, true, 'LayoutDashboard'),
  ('Dashboard - ดูภาพรวม', 'dashboard.overview.view', 'ดูภาพรวม Dashboard', 
   (SELECT module_id FROM master_permission_module WHERE module_key = 'dashboard'), 
   101, true, 'Eye');
```

---

## 🧪 วิธีทดสอบ

### ขั้นตอนที่ 1: Clear Browser Cache

1. เปิด DevTools (F12)
2. ไปที่ Application/Storage tab
3. คลิก "Clear site data"
4. Refresh หน้าเว็บ

### ขั้นตอนที่ 2: Login และดู Console Logs

1. เปิด Browser Console (F12 → Console tab)
2. Login ด้วย `metee.c@buzzpetsfood.com`
3. ดู logs ที่ควรปรากฏ:

**Logs ที่คาดหวัง:**
```
🔄 [useAuth] Starting fetchUser...
📡 [useAuth] Calling /api/auth/me...
📡 [useAuth] /api/auth/me response: {ok: true, status: 200}
✅ [useAuth] User authenticated: metee.c@buzzpetsfood.com
📡 [useAuth] Calling /api/auth/permissions...
🔑 [useAuth] Permissions API response: {success: true, permissions: [...], role_name: "Super Admin"}
🔑 [useAuth] Mapped permissions: ["dashboard", "dashboard.overview.view", ...]
🔑 [useAuth] Total permissions: 177
✅ [useAuth] Setting user state with 177 permissions
```

**เมื่อเข้าหน้า Dashboard:**
```
🔍 [usePermission] Checking "dashboard.overview.view" for user: {email: "metee.c@buzzpetsfood.com", role: "Super Admin", permissions_count: 177}
✅ [usePermission] Super Admin has full access to: dashboard.overview.view
```

### ขั้นตอนที่ 3: ตรวจสอบ Network Tab

1. เปิด DevTools → Network tab
2. Login
3. ตรวจสอบว่ามี requests:
   - ✅ `POST /api/auth/login` → 200
   - ✅ `GET /api/auth/me` → 200
   - ✅ `GET /api/auth/permissions` → 200

---

## 🔍 การวินิจฉัยปัญหา

### กรณีที่ 1: ไม่เห็น logs `/api/auth/permissions`

**สาเหตุ:** `useAuth` hook ไม่ถูกเรียกหลัง login

**วิธีแก้:**
- ตรวจสอบว่า `AuthProvider` ครอบ app ใน `layout.tsx`
- ตรวจสอบว่า `fetchUser()` ถูกเรียกใน `login()` function

### กรณีที่ 2: เห็น logs แต่ permissions = []

**สาเหตุ:** API `/api/auth/permissions` คืนค่าว่าง

**วิธีแก้:**
```sql
-- ตรวจสอบ role ของ user
SELECT user_id, email, role_id, 
       (SELECT role_name FROM master_system_role WHERE role_id = master_system_user.role_id)
FROM master_system_user
WHERE email = 'metee.c@buzzpetsfood.com';

-- ตรวจสอบจำนวน permissions
SELECT COUNT(*) FROM master_permission_module WHERE is_active = true AND module_key IS NOT NULL;
```

### กรณีที่ 3: มี permissions แต่ยังแสดง "ไม่มีสิทธิ์"

**สาเหตุ:** Permission key ไม่ตรงกัน

**วิธีแก้:**
```javascript
// ดู permission key ที่หน้าใช้
console.log('Permission key:', 'dashboard.overview.view');

// ดู permissions ที่ user มี
console.log('User permissions:', user.permissions);

// เช็คว่ามีหรือไม่
console.log('Has permission:', user.permissions?.includes('dashboard.overview.view'));
```

### กรณีที่ 4: Super Admin ยังไม่มีสิทธิ์

**สาเหตุ:** Logic ใน `usePermission` ไม่ทำงาน

**วิธีแก้:**
```typescript
// ตรวจสอบ role_name
console.log('User role:', user.role_name);
console.log('Is Super Admin:', user.role_name === 'Super Admin');
```

---

## 🛠️ วิธีแก้ไขปัญหาทั่วไป

### แก้ไขที่ 1: Force Refresh Permissions

```typescript
// ใน useAuth hook
const refetch = useCallback(async () => {
  console.log('🔄 Force refetching user and permissions...');
  await fetchUser();
}, [fetchUser]);
```

### แก้ไขที่ 2: เพิ่ม Permission ที่หายไป

```sql
-- เพิ่ม permission ใหม่
INSERT INTO master_permission_module (module_name, module_key, parent_module_id, is_active)
VALUES ('Permission Name', 'permission.key', NULL, true);
```

### แก้ไขที่ 3: Clear Session และ Login ใหม่

```bash
# ใน Browser Console
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
location.reload();
```

---

## 📊 Checklist การตรวจสอบ

### Database Layer
- [ ] User มี `role_id` (ไม่เป็น NULL)
- [ ] Role มีชื่อ "Super Admin" หรือ "Admin"
- [ ] Permission module มี `module_key` (ไม่เป็น NULL)
- [ ] Permission `dashboard.overview.view` มีในฐานข้อมูล

### API Layer
- [ ] `/api/auth/me` คืน user data ถูกต้อง
- [ ] `/api/auth/permissions` คืน permissions array
- [ ] Super Admin ได้รับ permissions ทั้งหมด (177 permissions)

### Frontend Layer
- [ ] `AuthProvider` ครอบ app ใน `layout.tsx`
- [ ] `useAuth` hook ถูกเรียกใช้
- [ ] `fetchUser()` ถูกเรียกหลัง login
- [ ] `user.permissions` มีค่า (ไม่เป็น undefined หรือ [])
- [ ] `usePermission` hook ตรวจสอบ role ถูกต้อง

### Browser
- [ ] Cookie `session_token` ถูกตั้งค่า
- [ ] ไม่มี CORS errors
- [ ] ไม่มี JavaScript errors
- [ ] Console logs แสดงผลถูกต้อง

---

## 🎯 ผลลัพธ์ที่คาดหวัง

หลังจากแก้ไขและทดสอบแล้ว:

1. ✅ Login สำเร็จ
2. ✅ `/api/auth/permissions` ถูกเรียก
3. ✅ Super Admin ได้รับ 177 permissions
4. ✅ เข้าหน้า Dashboard ได้
5. ✅ ไม่แสดง "ไม่มีสิทธิ์เข้าถึง"

---

## 📞 ขั้นตอนต่อไป

ถ้ายังมีปัญหา:

1. **Copy logs ทั้งหมด** จาก Browser Console
2. **Copy Network requests** จาก Network tab
3. **ส่งให้ทีมตรวจสอบ** พร้อมข้อมูล:
   - User email
   - Role name
   - จำนวน permissions ที่ได้รับ
   - Permission key ที่กำลังเช็ค

---

**เอกสารนี้สร้างโดย:** Kiro AI  
**วันที่:** 8 ธันวาคม 2025  
**เวอร์ชัน:** 1.0
