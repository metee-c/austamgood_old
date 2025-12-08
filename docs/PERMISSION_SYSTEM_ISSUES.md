# 🔴 ปัญหาระบบสิทธิ์ (Permission System Issues)

**วันที่:** 2025-12-08  
**สถานะ:** 🔴 Critical - ระบบสิทธิ์ทำงานไม่สอดคล้องกัน

---

## 📋 สรุปปัญหา

ระบบสิทธิ์มีความไม่สอดคล้องกันระหว่าง:
1. **Permission keys ที่หน้าเว็บใช้** (ใน PermissionGuard)
2. **Permission keys ที่มีในฐานข้อมูล** (ตาราง master_permission_module)
3. **การจัดการสิทธิ์ที่หน้า** `/master-data/users` และ `/master-data/roles`

---

## 🔍 รายละเอียดปัญหา

### ปัญหาที่ 1: Permission Keys ไม่ตรงกัน

| หน้า | Permission ที่ใช้ | สถานะ | Permission ที่ควรใช้ |
|------|------------------|-------|---------------------|
| `/mobile` | `mobile.access` | ❌ ไม่มีในฐานข้อมูล | `mobile.view` |
| `/mobile/transfer` | `mobile.transfer` | ❌ ไม่มีในฐานข้อมูล | `mobile.transfer.view` |
| `/mobile/receive` | `mobile.receive` | ❌ ไม่มีในฐานข้อมูล | `mobile.receive.view` |
| `/mobile/pick` | `mobile.pick` | ❌ ไม่มีในฐานข้อมูล | `mobile.pick.view` |
| `/mobile/loading` | `mobile.loading` | ❌ ไม่มีในฐานข้อมูล | `mobile.loading.view` |

### ปัญหาที่ 2: API `/api/auth/permissions` ไม่กรอง `can_view`

**ปัญหา:**
- API return ทุก module ที่มีใน `role_permission` โดยไม่สนใจว่า `can_view = true` หรือ `false`
- ทำให้ user ได้รับ permission list ที่มี module ที่ไม่ควรเข้าถึง

**ตัวอย่าง:**
```sql
-- Role "Driver RT" (role_id: 12)
SELECT module_key, can_view FROM role_permission rp
JOIN master_permission_module pm ON rp.module_id = pm.module_id
WHERE rp.role_id = 12 AND pm.module_key = 'mobile';

-- Result: module_key = 'mobile', can_view = false
-- แต่ API จะ return 'mobile' ให้ user ด้วย!
```

### ปัญหาที่ 3: `usePermission` Hook ตรวจสอบแค่ว่ามี Permission Key หรือไม่

**โค้ดปัจจุบัน:**
```typescript
export function usePermission(moduleKey: string): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // ❌ ตรวจสอบแค่ว่า moduleKey มีใน permissions array หรือไม่
    // ไม่ได้ตรวจสอบว่า can_view, can_create, can_edit, etc.
    return user.permissions?.includes(moduleKey) || false;
  }, [user, moduleKey]);
}
```

**ปัญหา:**
- Hook ไม่ได้ตรวจสอบว่า user มีสิทธิ์ `can_view`, `can_create`, `can_edit` หรือไม่
- ตรวจสอบแค่ว่า permission key มีอยู่ใน array หรือไม่

---

## 🎯 วิธีแก้ไข

### แก้ไขที่ 1: เพิ่ม Permission Keys ที่หายไปในฐานข้อมูล

```sql
-- เพิ่ม permission keys ที่หน้าใช้แต่ยังไม่มีในฐานข้อมูล
INSERT INTO master_permission_module (module_name, module_key, description, parent_module_id, display_order, is_active)
VALUES 
  ('Mobile - เข้าถึงระบบ', 'mobile.access', 'เข้าถึงระบบ Mobile ทั้งหมด', 300, 1, true),
  ('Mobile Transfer', 'mobile.transfer', 'เข้าถึงหน้าย้ายสินค้า', 300, 10, true),
  ('Mobile Receive', 'mobile.receive', 'เข้าถึงหน้ารับสินค้า', 300, 20, true),
  ('Mobile Pick', 'mobile.pick', 'เข้าถึงหน้าหยิบสินค้า', 300, 30, true),
  ('Mobile Loading', 'mobile.loading', 'เข้าถึงหน้าโหลดสินค้า', 300, 40, true);
```

### แก้ไขที่ 2: แก้ไข API `/api/auth/permissions` ให้กรอง `can_view`

```typescript
// app/api/auth/permissions/route.ts
export async function GET(request: NextRequest) {
  // ... existing code ...

  // ✅ เพิ่มการกรอง can_view = true
  const { data: permissions, error: permError } = await supabase
    .from('role_permission')
    .select(`
      module_id,
      can_view,
      can_create,
      can_edit,
      can_delete,
      master_permission_module!inner(
        module_id,
        module_key,
        module_name,
        is_active
      )
    `)
    .eq('role_id', userData.role_id)
    .eq('can_view', true); // ✅ เพิ่มเงื่อนไขนี้

  // Transform permissions
  const userPermissions = permissions?.map((p: any) => ({
    module_id: p.master_permission_module.module_id,
    module_key: p.master_permission_module.module_key,
    module_name: p.master_permission_module.module_name,
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete
  })) || [];

  return NextResponse.json({
    success: true,
    permissions: userPermissions,
    role_name: roleName
  });
}
```

### แก้ไขที่ 3: อัปเดต `usePermission` Hook ให้รองรับ Action Types

```typescript
// hooks/usePermission.ts

/**
 * Hook to check if user has a specific permission with action type
 */
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
    
    // ✅ ตรวจสอบทั้ง permission key และ action type
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

### แก้ไขที่ 4: อัปเดตหน้าเว็บให้ใช้ Permission Keys ที่ถูกต้อง

```typescript
// ❌ เดิม
<PermissionGuard permission="mobile.transfer">

// ✅ ใหม่ (เลือก 1 ใน 2 วิธี)

// วิธีที่ 1: ใช้ parent permission
<PermissionGuard permission="mobile.transfer.view">

// วิธีที่ 2: เพิ่ม permission ใหม่และใช้
<PermissionGuard permission="mobile.transfer">
```

---

## 📊 ตัวอย่างการทดสอบ

### ทดสอบ User: test@example.com (Role: Driver RT)

```sql
-- 1. ตรวจสอบ role และ permissions
SELECT 
  u.user_id,
  u.email,
  r.role_name,
  pm.module_key,
  rp.can_view,
  rp.can_create
FROM master_system_user u
JOIN master_system_role r ON u.role_id = r.role_id
JOIN role_permission rp ON r.role_id = rp.role_id
JOIN master_permission_module pm ON rp.module_id = pm.module_id
WHERE u.email = 'test@example.com'
  AND pm.module_key LIKE 'mobile%'
ORDER BY pm.module_key;
```

**ผลลัพธ์ที่คาดหวัง:**
- ✅ `mobile.view` - can_view: true
- ✅ `mobile.transfer.view` - can_view: true
- ✅ `mobile.transfer.scan` - can_view: true
- ✅ `mobile.transfer.move` - can_view: true
- ✅ `mobile.transfer.complete` - can_view: true

---

## ✅ Checklist การแก้ไข

- [ ] เพิ่ม permission keys ที่หายไป (`mobile.access`, `mobile.transfer`, etc.)
- [ ] แก้ไข API `/api/auth/permissions` ให้กรอง `can_view = true`
- [ ] อัปเดต `usePermission` hook ให้รองรับ action types
- [ ] อัปเดตหน้าเว็บทั้งหมดให้ใช้ permission keys ที่ถูกต้อง
- [ ] ทดสอบการเข้าถึงหน้าต่างๆ กับ roles ต่างๆ
- [ ] อัปเดตเอกสาร AUTHENTICATION_SYSTEM.md

---

## 🔗 ไฟล์ที่เกี่ยวข้อง

- `app/api/auth/permissions/route.ts` - API สำหรับโหลด permissions
- `hooks/usePermission.ts` - Hook สำหรับตรวจสอบสิทธิ์
- `components/auth/PermissionGuard.tsx` - Component สำหรับป้องกันการเข้าถึง
- `app/mobile/*/page.tsx` - หน้า Mobile ทั้งหมด
- `app/master-data/users/page.tsx` - หน้าจัดการผู้ใช้
- `app/master-data/roles/page.tsx` - หน้าจัดการบทบาท

---

**สรุป:** ระบบสิทธิ์มีปัญหาความไม่สอดคล้องกันระหว่าง permission keys ที่ใช้ในโค้ดกับที่มีในฐานข้อมูล และ API ไม่ได้กรอง `can_view` ทำให้การจัดการสิทธิ์ไม่ทำงานตามที่คาดหวัง
