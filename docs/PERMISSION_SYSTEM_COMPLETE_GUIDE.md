# คู่มือระบบจัดการสิทธิ์ (Permission System) - ฉบับสมบูรณ์

## 📋 สารบัญ
1. [โครงสร้างฐานข้อมูล](#โครงสร้างฐานข้อมูล)
2. [การทำงานของระบบ (Flow)](#การทำงานของระบบ-flow)
3. [การสร้างและจัดการ Role](#การสร้างและจัดการ-role)
4. [การสร้างและจัดการ User](#การสร้างและจัดการ-user)
5. [การเช็คสิทธิ์ในหน้าต่างๆ](#การเช็คสิทธิ์ในหน้าต่างๆ)
6. [การแก้ไขปัญหาที่พบบ่อย](#การแก้ไขปัญหาที่พบบ่อย)

---

## 📊 โครงสร้างฐานข้อมูล

### 1. ตาราง `master_system_role` - บทบาท/ตำแหน่ง
```sql
CREATE TABLE master_system_role (
  role_id BIGSERIAL PRIMARY KEY,
  role_name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**ตัวอย่าง Roles:**
- Super Admin (role_id: 1)
- Admin (role_id: 2)
- Driver RT (role_id: 12)
- Warehouse Manager
- Picker

### 2. ตาราง `master_permission_module` - รายการสิทธิ์
```sql
CREATE TABLE master_permission_module (
  module_id BIGSERIAL PRIMARY KEY,
  module_name VARCHAR NOT NULL,
  module_key VARCHAR UNIQUE,  -- ⚠️ ต้องไม่เป็น NULL
  description TEXT,
  parent_module_id BIGINT REFERENCES master_permission_module(module_id),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  icon VARCHAR,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**โครงสร้าง Permission Key (Hierarchical):**
```
mobile                          -- Parent module
├── mobile.access               -- เข้าถึงระบบ Mobile
├── mobile.view                 -- ดูเมนู Mobile
├── mobile.transfer             -- ย้ายสินค้า (Parent)
│   ├── mobile.transfer.view    -- ดูรายการย้าย
│   ├── mobile.transfer.scan    -- สแกนสินค้า
│   ├── mobile.transfer.move    -- ย้ายสินค้า
│   └── mobile.transfer.complete -- ทำเสร็จ
├── mobile.pick                 -- หยิบสินค้า
├── mobile.loading              -- โหลดสินค้า
└── mobile.receive              -- รับสินค้า
```

### 3. ตาราง `role_permission` - สิทธิ์ของแต่ละ Role
```sql
CREATE TABLE role_permission (
  role_id BIGINT REFERENCES master_system_role(role_id),
  module_id BIGINT REFERENCES master_permission_module(module_id),
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  can_import BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  can_print BOOLEAN DEFAULT false,
  can_scan BOOLEAN DEFAULT false,
  can_assign BOOLEAN DEFAULT false,
  can_complete BOOLEAN DEFAULT false,
  can_cancel BOOLEAN DEFAULT false,
  can_rollback BOOLEAN DEFAULT false,
  can_publish BOOLEAN DEFAULT false,
  can_optimize BOOLEAN DEFAULT false,
  can_change_status BOOLEAN DEFAULT false,
  can_manage_coordinates BOOLEAN DEFAULT false,
  can_reset_reservations BOOLEAN DEFAULT false,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, module_id)
);
```

**ตัวอย่างการกำหนดสิทธิ์:**
```sql
-- Role "Driver RT" มีสิทธิ์ mobile.transfer (can_view = true)
INSERT INTO role_permission (role_id, module_id, can_view)
VALUES (12, 516, true);
```

### 4. ตาราง `master_system_user` - ผู้ใช้งาน
```sql
CREATE TABLE master_system_user (
  user_id BIGSERIAL PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR NOT NULL,
  phone_number VARCHAR,
  employee_id BIGINT REFERENCES master_employee(employee_id),
  password_hash VARCHAR NOT NULL,
  role_id BIGINT REFERENCES master_system_role(role_id),  -- ⚠️ สำคัญ!
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  force_password_change BOOLEAN DEFAULT false,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 การทำงานของระบบ (Flow)

### 1. Login Flow
```
User Login (email + password)
    ↓
[API] /api/auth/login
    ↓
Verify credentials
    ↓
Create session → user_sessions table
    ↓
Return session token (stored in cookie)
```

### 2. Permission Loading Flow
```
User logged in
    ↓
[Frontend] useAuth hook calls /api/auth/permissions
    ↓
[API] /api/auth/permissions
    ↓
Query user's role_id from master_system_user
    ↓
IF role = "Admin" OR "Super Admin":
    → Return ALL permissions (WHERE module_key IS NOT NULL)
ELSE:
    → Query role_permission WHERE role_id = user.role_id AND can_view = true
    ↓
    → JOIN with master_permission_module
    ↓
    → Return permissions array
    ↓
[Frontend] Store permissions in user state
    ↓
user.permissions = ['mobile.transfer', 'mobile.pick', ...]
```

### 3. Permission Check Flow (ในหน้าต่างๆ)
```
Page Component
    ↓
<PermissionGuard permission="mobile.transfer">
    ↓
usePermission("mobile.transfer")
    ↓
Check: user.permissions.includes("mobile.transfer")
    ↓
IF true: Show page content
IF false: Show "ไม่มีสิทธิ์เข้าถึง" message
```

---

## 👥 การสร้างและจัดการ Role

### วิธีที่ 1: ผ่าน UI (หน้า Master Data > Roles)
1. ไปที่ `/master-data/roles`
2. คลิก "เพิ่ม Role"
3. กรอกข้อมูล:
   - ชื่อ Role (เช่น "Driver RT")
   - คำอธิบาย
4. คลิก "บันทึก"
5. คลิก "จัดการสิทธิ์" เพื่อกำหนด permissions

### วิธีที่ 2: ผ่าน SQL
```sql
-- 1. สร้าง Role
INSERT INTO master_system_role (role_name, description, is_active)
VALUES ('Driver RT', 'พนักงานขับรถ RT', true)
RETURNING role_id;

-- 2. กำหนดสิทธิ์ให้ Role (สมมติ role_id = 12)
INSERT INTO role_permission (role_id, module_id, can_view)
SELECT 12, module_id, true
FROM master_permission_module
WHERE module_key IN (
  'mobile.access',
  'mobile.view',
  'mobile.transfer',
  'mobile.transfer.view',
  'mobile.transfer.scan',
  'mobile.transfer.move',
  'mobile.transfer.complete',
  'mobile.pick',
  'mobile.loading',
  'mobile.receive'
);
```

### การแก้ไขสิทธิ์ของ Role
```sql
-- เพิ่มสิทธิ์
INSERT INTO role_permission (role_id, module_id, can_view, can_create)
VALUES (12, 516, true, true)
ON CONFLICT (role_id, module_id) 
DO UPDATE SET can_view = true, can_create = true;

-- ลบสิทธิ์
DELETE FROM role_permission
WHERE role_id = 12 AND module_id = 516;

-- ดูสิทธิ์ทั้งหมดของ Role
SELECT 
  r.role_name,
  pm.module_key,
  pm.module_name,
  rp.can_view,
  rp.can_create,
  rp.can_edit,
  rp.can_delete
FROM role_permission rp
JOIN master_system_role r ON rp.role_id = r.role_id
JOIN master_permission_module pm ON rp.module_id = pm.module_id
WHERE r.role_id = 12
ORDER BY pm.module_key;
```

---

## 👤 การสร้างและจัดการ User

### วิธีที่ 1: ผ่าน UI (หน้า Master Data > Users)
1. ไปที่ `/master-data/users`
2. คลิก "เพิ่มผู้ใช้"
3. กรอกข้อมูล:
   - Username
   - Email
   - ชื่อ-นามสกุล
   - เบอร์โทร
   - **Role** (เลือกจาก dropdown)
   - รหัสผ่าน
4. คลิก "บันทึก"

### วิธีที่ 2: ผ่าน API
```javascript
// POST /api/users
const response = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'RT001',
    email: 'test@example.com',
    full_name: 'Test User',
    phone_number: '0812345678',
    role_id: 12,  // ⚠️ สำคัญ! ต้องระบุ role_id
    password: 'password123',
    is_active: true
  })
});
```

### วิธีที่ 3: ผ่าน SQL
```sql
-- 1. Hash password ก่อน (ใช้ bcrypt)
-- ตัวอย่างนี้ใช้ password = "password123"
-- Hash: $2b$10$...

INSERT INTO master_system_user (
  username,
  email,
  full_name,
  phone_number,
  role_id,  -- ⚠️ สำคัญ!
  password_hash,
  is_active
)
VALUES (
  'RT001',
  'test@example.com',
  'Test User',
  '0812345678',
  12,  -- Role "Driver RT"
  '$2b$10$abcdefghijklmnopqrstuvwxyz...',
  true
);
```

### การแก้ไข Role ของ User
```sql
-- เปลี่ยน Role
UPDATE master_system_user
SET role_id = 12, updated_at = CURRENT_TIMESTAMP
WHERE email = 'test@example.com';

-- ตรวจสอบ Role ของ User
SELECT 
  u.user_id,
  u.username,
  u.email,
  u.role_id,
  r.role_name
FROM master_system_user u
LEFT JOIN master_system_role r ON u.role_id = r.role_id
WHERE u.email = 'test@example.com';
```

### ⚠️ สิ่งสำคัญหลังแก้ไข Role
**User ต้อง Logout และ Login ใหม่** เพื่อให้ permissions ถูก refresh!

---

## 🔐 การเช็คสิทธิ์ในหน้าต่างๆ

### 1. การป้องกันหน้าทั้งหมด (Page Level)
```tsx
// app/mobile/transfer/page.tsx
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function MobileTransferPage() {
  return (
    <PermissionGuard 
      permission="mobile.transfer"
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการย้ายและเติมสต็อก</p>
          </div>
        </div>
      }
    >
      <MobileTransferContent />
    </PermissionGuard>
  );
}
```

### 2. การซ่อน/แสดงปุ่มหรือ Component
```tsx
import { usePermission } from '@/hooks/usePermission';

function MyComponent() {
  const canCreate = usePermission('mobile.transfer.create');
  const canEdit = usePermission('mobile.transfer.edit');
  
  return (
    <div>
      {canCreate && (
        <button onClick={handleCreate}>สร้างใหม่</button>
      )}
      
      {canEdit && (
        <button onClick={handleEdit}>แก้ไข</button>
      )}
    </div>
  );
}
```

### 3. การเช็คหลายสิทธิ์พร้อมกัน
```tsx
import { useHasAnyPermission, useHasAllPermissions } from '@/hooks/usePermission';

function MyComponent() {
  // เช็คว่ามีสิทธิ์อย่างใดอย่างหนึ่ง (OR)
  const canAccessMobile = useHasAnyPermission([
    'mobile.transfer',
    'mobile.pick',
    'mobile.loading'
  ]);
  
  // เช็คว่ามีสิทธิ์ทั้งหมด (AND)
  const canManageTransfer = useHasAllPermissions([
    'mobile.transfer.view',
    'mobile.transfer.edit',
    'mobile.transfer.complete'
  ]);
  
  return (
    <div>
      {canAccessMobile && <MobileMenu />}
      {canManageTransfer && <TransferManagement />}
    </div>
  );
}
```

### 4. การเช็คสิทธิ์ตาม Role
```tsx
import { useHasRole, useHasAnyRole } from '@/hooks/usePermission';

function MyComponent() {
  const isAdmin = useHasRole('Admin');
  const isSuperAdmin = useHasRole('Super Admin');
  const isAdminOrSuperAdmin = useHasAnyRole(['Admin', 'Super Admin']);
  
  return (
    <div>
      {isAdminOrSuperAdmin && <AdminPanel />}
    </div>
  );
}
```

### 5. การเช็คสิทธิ์ใน API Route
```typescript
// app/api/mobile/transfer/route.ts
import { getCurrentSession } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';

export async function POST(request: Request) {
  const session = await getCurrentSession();
  
  if (!session.success || !session.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // เช็คสิทธิ์
  const canTransfer = await hasPermission(
    session.session.user_id,
    'mobile.transfer.create'
  );
  
  if (!canTransfer) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการสร้างรายการย้ายสินค้า' },
      { status: 403 }
    );
  }
  
  // ดำเนินการต่อ...
}
```

---

## 🔧 การแก้ไขปัญหาที่พบบ่อย

### ปัญหา 1: User login แล้วแต่ไม่มีสิทธิ์เข้าหน้าใดๆ

**สาเหตุ:**
- User ไม่มี `role_id` หรือ `role_id = NULL`
- Role ไม่มี permissions

**วิธีแก้:**
```sql
-- 1. ตรวจสอบ role_id ของ user
SELECT user_id, username, email, role_id
FROM master_system_user
WHERE email = 'test@example.com';

-- 2. ถ้า role_id เป็น NULL ให้กำหนด role
UPDATE master_system_user
SET role_id = 12
WHERE email = 'test@example.com';

-- 3. ตรวจสอบว่า role มี permissions หรือไม่
SELECT COUNT(*)
FROM role_permission
WHERE role_id = 12 AND can_view = true;

-- 4. ถ้าไม่มี ให้เพิ่ม permissions
INSERT INTO role_permission (role_id, module_id, can_view)
SELECT 12, module_id, true
FROM master_permission_module
WHERE module_key = 'mobile.transfer';
```

### ปัญหา 2: แก้ไข permissions แล้วแต่ user ยังเข้าไม่ได้

**สาเหตุ:** Permissions ถูก cache ไว้ใน session

**วิธีแก้:**
1. User ต้อง **Logout**
2. **Login ใหม่**
3. Permissions จะถูก refresh อัตโนมัติ

### ปัญหา 3: Super Admin ไม่มีสิทธิ์บางหน้า

**สาเหตุ:** Permission modules มี `module_key = NULL`

**วิธีแก้:**
```sql
-- ตรวจสอบ permissions ที่ module_key เป็น NULL
SELECT module_id, module_name, module_key
FROM master_permission_module
WHERE module_key IS NULL AND is_active = true;

-- แก้ไขโดยกำหนด module_key ให้ถูกต้อง
UPDATE master_permission_module
SET module_key = 'master_data.customer'
WHERE module_id = 3 AND module_key IS NULL;
```

**หรือ** API `/api/auth/permissions` จะกรอง `NULL` ออกอัตโนมัติแล้ว (ตาม fix ล่าสุด)

### ปัญหา 4: Permission key ไม่ตรงกับที่ใช้ในหน้า

**สาเหตุ:** Permission key ในฐานข้อมูลไม่ตรงกับที่ใช้ใน `PermissionGuard`

**วิธีแก้:**
```sql
-- ตรวจสอบ permission key ที่มีในฐานข้อมูล
SELECT module_id, module_key, module_name
FROM master_permission_module
WHERE module_key LIKE 'mobile%'
ORDER BY module_key;

-- ถ้าไม่มี ให้เพิ่ม
INSERT INTO master_permission_module (
  module_name,
  module_key,
  parent_module_id,
  is_active
)
VALUES (
  'Mobile ย้ายสินค้า',
  'mobile.transfer',
  300,  -- parent module_id ของ 'mobile'
  true
);
```

### ปัญหา 5: API ส่ง permissions กลับมาแต่ frontend ไม่เห็น

**วิธี Debug:**
1. เปิด Browser Console (F12)
2. ดู logs:
   ```
   🔑 [useAuth] Permissions API response: {...}
   🔑 [useAuth] Mapped permissions: [...]
   🔑 [usePermission] Check "mobile.transfer": true/false
   🔑 [usePermission] User permissions: [...]
   ```
3. ตรวจสอบว่า:
   - API ส่ง permissions กลับมาหรือไม่
   - `user.permissions` มี permission ที่ต้องการหรือไม่
   - `usePermission` เช็คถูกต้องหรือไม่

---

## 📝 Checklist การตรวจสอบ Permissions

เมื่อ user ไม่สามารถเข้าหน้าใดๆ ได้ ให้ตรวจสอบตามลำดับ:

- [ ] 1. User มี `role_id` หรือไม่?
  ```sql
  SELECT role_id FROM master_system_user WHERE email = 'user@example.com';
  ```

- [ ] 2. Role มี permissions หรือไม่?
  ```sql
  SELECT COUNT(*) FROM role_permission WHERE role_id = ? AND can_view = true;
  ```

- [ ] 3. Permission key ถูกต้องหรือไม่?
  ```sql
  SELECT module_key FROM master_permission_module WHERE module_key = 'mobile.transfer';
  ```

- [ ] 4. Permission key ไม่เป็น NULL หรือไม่?
  ```sql
  SELECT COUNT(*) FROM master_permission_module WHERE module_key IS NULL AND is_active = true;
  ```

- [ ] 5. User logout/login ใหม่แล้วหรือยัง?

- [ ] 6. ดู Browser Console มี error หรือไม่?

- [ ] 7. ดู Server logs มี error หรือไม่?

---

## 🎯 สรุป

### การทำงานของระบบ Permissions:
1. **User** มี **Role** (ผ่าน `role_id`)
2. **Role** มี **Permissions** (ผ่าน `role_permission`)
3. **Permissions** อ้างอิงจาก **Permission Modules** (ผ่าน `module_key`)
4. เมื่อ login → API ส่ง permissions กลับมาเป็น array of `module_key`
5. Frontend เช็คสิทธิ์ด้วย `usePermission(module_key)`
6. ถ้ามีสิทธิ์ → แสดงหน้า, ถ้าไม่มี → แสดง "ไม่มีสิทธิ์"

### สิ่งสำคัญที่ต้องจำ:
- ✅ User **ต้องมี** `role_id`
- ✅ Role **ต้องมี** permissions (`can_view = true`)
- ✅ Permission **ต้องมี** `module_key` (ไม่เป็น NULL)
- ✅ Permission key **ต้องตรง** กับที่ใช้ใน `PermissionGuard`
- ✅ แก้ไข permissions แล้ว **ต้อง logout/login ใหม่**

---

**เอกสารนี้อัปเดตล่าสุด:** 8 ธันวาคม 2025
