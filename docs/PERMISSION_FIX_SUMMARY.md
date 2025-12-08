# ✅ สรุปการแก้ไขระบบสิทธิ์

**วันที่:** 2025-12-08  
**สถานะ:** ✅ แก้ไขเสร็จสิ้น

---

## 🎯 สิ่งที่แก้ไข

### 1. ✅ เพิ่ม Permission Keys ที่หายไป

เพิ่ม 5 permission keys ใหม่ในตาราง `master_permission_module`:

| Module Key | Module Name | Parent | สถานะ |
|-----------|-------------|--------|-------|
| `mobile.access` | Mobile - เข้าถึงระบบ | mobile (300) | ✅ เพิ่มแล้ว |
| `mobile.transfer` | Mobile ย้ายสินค้า | mobile (300) | ✅ เพิ่มแล้ว |
| `mobile.receive` | Mobile รับสินค้า | mobile (300) | ✅ เพิ่มแล้ว |
| `mobile.pick` | Mobile หยิบสินค้า | mobile (300) | ✅ เพิ่มแล้ว |
| `mobile.loading` | Mobile โหลดสินค้า | mobile (300) | ✅ เพิ่มแล้ว |

### 2. ✅ เพิ่มสิทธิ์ให้ Role "Driver RT"

เพิ่มสิทธิ์ `can_view = true` สำหรับ permission keys ใหม่ทั้งหมดให้กับ Role "Driver RT" (role_id: 12)

### 3. ✅ แก้ไข API `/api/auth/permissions`

**เปลี่ยนจาก:**
```typescript
.eq('role_id', userData.role_id);
```

**เป็น:**
```typescript
.eq('role_id', userData.role_id)
.eq('can_view', true); // ✅ กรองเฉพาะ permission ที่ can_view = true
```

**และเพิ่ม action flags ใน response:**
```typescript
{
  module_id: p.master_permission_module.module_id,
  module_key: p.master_permission_module.module_key,
  module_name: p.master_permission_module.module_name,
  can_view: p.can_view,      // ✅ เพิ่ม
  can_create: p.can_create,  // ✅ เพิ่ม
  can_edit: p.can_edit,      // ✅ เพิ่ม
  can_delete: p.can_delete   // ✅ เพิ่ม
}
```

---

## 📊 ผลลัพธ์

### ก่อนแก้ไข ❌

**User:** test@example.com (Role: Driver RT)

```
❌ ไม่สามารถเข้าหน้า /mobile ได้ (ใช้ mobile.access ที่ไม่มีในฐานข้อมูล)
❌ ไม่สามารถเข้าหน้า /mobile/transfer ได้ (ใช้ mobile.transfer ที่ไม่มีในฐานข้อมูล)
❌ ไม่สามารถเข้าหน้า /mobile/receive ได้ (ใช้ mobile.receive ที่ไม่มีในฐานข้อมูล)
❌ ไม่สามารถเข้าหน้า /mobile/pick ได้ (ใช้ mobile.pick ที่ไม่มีในฐานข้อมูล)
❌ ไม่สามารถเข้าหน้า /mobile/loading ได้ (ใช้ mobile.loading ที่ไม่มีในฐานข้อมูล)
```

### หลังแก้ไข ✅

**User:** test@example.com (Role: Driver RT)

```
✅ เข้าหน้า /mobile ได้ (มี mobile.access และ can_view = true)
✅ เข้าหน้า /mobile/transfer ได้ (มี mobile.transfer และ can_view = true)
✅ เข้าหน้า /mobile/receive ได้ (มี mobile.receive และ can_view = true)
✅ เข้าหน้า /mobile/pick ได้ (มี mobile.pick และ can_view = true)
✅ เข้าหน้า /mobile/loading ได้ (มี mobile.loading และ can_view = true)
```

---

## 🔍 การทดสอบ

### ทดสอบ Permission ของ User

```sql
-- ตรวจสอบ permissions ของ test@example.com
SELECT 
  u.email,
  r.role_name,
  pm.module_key,
  pm.module_name,
  rp.can_view,
  rp.can_create,
  rp.can_edit
FROM master_system_user u
JOIN master_system_role r ON u.role_id = r.role_id
JOIN role_permission rp ON r.role_id = rp.role_id
JOIN master_permission_module pm ON rp.module_id = pm.module_id
WHERE u.email = 'test@example.com'
  AND pm.module_key IN ('mobile.access', 'mobile.transfer', 'mobile.receive', 'mobile.pick', 'mobile.loading')
  AND rp.can_view = true
ORDER BY pm.module_key;
```

**ผลลัพธ์ที่คาดหวัง:**
```
email: test@example.com
role_name: Driver RT
module_key: mobile.access, can_view: true ✅
module_key: mobile.loading, can_view: true ✅
module_key: mobile.pick, can_view: true ✅
module_key: mobile.receive, can_view: true ✅
module_key: mobile.transfer, can_view: true ✅
```

---

## 🎯 สิ่งที่ยังต้องทำต่อ (Optional)

### 1. อัปเดต `usePermission` Hook (ถ้าต้องการตรวจสอบ action types)

```typescript
// hooks/usePermission.ts
export function usePermission(
  moduleKey: string, 
  action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // ตรวจสอบทั้ง permission key และ action type
    const permission = user.permissions?.find(p => p.module_key === moduleKey);
    if (!permission) return false;
    
    // Check specific action
    switch (action) {
      case 'view':
        return permission.can_view === true;
      case 'create':
        return permission.can_create === true;
      case 'edit':
        return permission.can_edit === true;
      case 'delete':
        return permission.can_delete === true;
      default:
        return false;
    }
  }, [user, moduleKey, action]);
}
```

### 2. เพิ่ม Permission Keys ให้ Role อื่นๆ

ถ้ามี roles อื่นที่ต้องการเข้าถึงหน้า Mobile:

```sql
-- เพิ่มสิทธิ์ให้ role อื่นๆ (เช่น Picker, Loader, etc.)
INSERT INTO role_permission (role_id, module_id, can_view, can_create, can_edit, can_delete)
SELECT 
  [ROLE_ID] as role_id,
  module_id,
  true as can_view,
  false as can_create,
  false as can_edit,
  false as can_delete
FROM master_permission_module
WHERE module_key IN ('mobile.access', 'mobile.transfer', 'mobile.receive', 'mobile.pick', 'mobile.loading')
ON CONFLICT (role_id, module_id) DO UPDATE
SET can_view = true, updated_at = CURRENT_TIMESTAMP;
```

---

## 📝 สรุป

✅ **แก้ไขเสร็จสิ้น:**
1. เพิ่ม 5 permission keys ใหม่ที่หน้าเว็บใช้
2. เพิ่มสิทธิ์ให้ Role "Driver RT" สำหรับ permission keys ใหม่
3. แก้ไข API `/api/auth/permissions` ให้กรอง `can_view = true`
4. API ตอนนี้ return action flags (`can_view`, `can_create`, `can_edit`, `can_delete`) ด้วย

✅ **ผลลัพธ์:**
- User test@example.com (Role: Driver RT) สามารถเข้าถึงหน้า Mobile ทั้งหมดได้แล้ว
- ระบบสิทธิ์ทำงานสอดคล้องกันระหว่างหน้าเว็บและฐานข้อมูล
- การจัดการสิทธิ์ที่หน้า `/master-data/users` และ `/master-data/roles` จะทำงานถูกต้อง

---

**หมายเหตุ:** ถ้าต้องการให้ระบบตรวจสอบ action types (view/create/edit/delete) อย่างละเอียด ให้อัปเดต `usePermission` hook ตามตัวอย่างในส่วน "สิ่งที่ยังต้องทำต่อ"
