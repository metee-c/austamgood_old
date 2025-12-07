# Authentication System Documentation

## Overview

ระบบ Authentication ของ AustamGood WMS เป็นระบบที่ครบถ้วนและปลอดภัย ประกอบด้วย:

- **Session-based Authentication** - การจัดการ session ที่ปลอดภัย
- **Password Hashing** - การเข้ารหัสรหัสผ่านด้วย bcrypt
- **Rate Limiting** - การจำกัดจำนวนครั้งในการพยายาม login
- **Account Locking** - การล็อกบัญชีอัตโนมัติเมื่อพยายาม login ผิดหลายครั้ง
- **Password Reset** - การรีเซ็ตรหัสผ่านผ่าน token
- **Audit Logging** - การบันทึก log ทุกการกระทำที่สำคัญ
- **Role-based Access Control** - การควบคุมสิทธิ์ตาม role

## Architecture

### Database Layer

ระบบใช้ PostgreSQL (Supabase) เป็น database หลัก ประกอบด้วยตารางดังนี้:

1. **master_system_user** - ข้อมูลผู้ใช้
2. **sessions** - ข้อมูล session
3. **password_reset_tokens** - token สำหรับรีเซ็ตรหัสผ่าน
4. **login_attempts** - บันทึกการพยายาม login
5. **audit_logs** - บันทึก audit trail
6. **system_settings** - การตั้งค่าระบบ

### Authentication Layer

ตั้งอยู่ใน `lib/auth/` ประกอบด้วย:

- **password.ts** - การจัดการรหัสผ่าน (hash, verify, validate)
- **session.ts** - การจัดการ session
- **tokens.ts** - การจัดการ token สำหรับรีเซ็ตรหัสผ่าน
- **audit.ts** - การบันทึก audit logs
- **login-attempts.ts** - การจัดการ login attempts
- **middleware.ts** - middleware สำหรับป้องกัน routes
- **settings.ts** - การจัดการการตั้งค่าระบบ
- **auth-service.ts** - service หลักที่รวมทุกอย่างเข้าด้วยกัน

### API Routes

ตั้งอยู่ใน `app/api/auth/`:

- **POST /api/auth/login** - เข้าสู่ระบบ
- **POST /api/auth/logout** - ออกจากระบบ
- **GET /api/auth/me** - ดึงข้อมูลผู้ใช้ปัจจุบัน
- **POST /api/auth/register** - สร้างผู้ใช้ใหม่
- **POST /api/auth/password-reset/request** - ขอรีเซ็ตรหัสผ่าน
- **POST /api/auth/password-reset/reset** - รีเซ็ตรหัสผ่านด้วย token
- **POST /api/auth/change-password** - เปลี่ยนรหัสผ่าน (สำหรับผู้ใช้ที่ login แล้ว)

### UI Pages

- **/login** - หน้า login
- **/forgot-password** - หน้าขอรีเซ็ตรหัสผ่าน
- **/reset-password** - หน้ารีเซ็ตรหัสผ่าน

## Usage Examples

### 1. Login

```typescript
import { login } from '@/lib/auth';

const result = await login({
  email: 'user@example.com',
  password: 'password123',
  remember_me: true,
  ip_address: '127.0.0.1',
  user_agent: 'Mozilla/5.0...'
});

if (result.success) {
  console.log('Login successful:', result.user);
  console.log('Session token:', result.session_token);
} else {
  console.error('Login failed:', result.error);
}
```

### 2. Get Current Session

```typescript
import { getCurrentSession } from '@/lib/auth';

const sessionResult = await getCurrentSession();

if (sessionResult.success && sessionResult.session) {
  console.log('Current user:', sessionResult.session);
} else {
  console.log('Not authenticated');
}
```

### 3. Protect API Routes

```typescript
import { withAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const GET = withAuth(
  async (request) => {
    // request.user contains authenticated user data
    return NextResponse.json({
      message: 'Protected data',
      user: request.user
    });
  },
  {
    requireAuth: true,
    allowedRoles: ['Admin', 'Manager']
  }
);
```

### 4. Check Permissions

```typescript
import { checkUserPermissions } from '@/lib/auth';

const hasPermission = await checkUserPermissions(
  userId,
  ['orders.view', 'orders.create']
);

if (hasPermission) {
  // User has required permissions
}
```

### 5. Password Reset Flow

```typescript
// Step 1: Request reset token
import { requestPasswordReset } from '@/lib/auth';

const result = await requestPasswordReset({
  email: 'user@example.com',
  ip_address: '127.0.0.1'
});

// Step 2: Reset password with token
import { resetPassword } from '@/lib/auth';

const resetResult = await resetPassword({
  token: 'reset_token_here',
  new_password: 'newPassword123'
});
```

### 6. Audit Logging

```typescript
import { logAuditEntry } from '@/lib/auth';

await logAuditEntry({
  user_id: 1,
  action: 'ORDER_CREATE',
  entity_type: 'ORDER',
  entity_id: '12345',
  new_values: {
    order_number: 'ORD-001',
    customer_id: 100
  },
  ip_address: '127.0.0.1',
  session_id: 'session_id_here'
});
```

## Security Features

### 1. Password Requirements

- ความยาวอย่างน้อย 8 ตัวอักษร
- ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว
- ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว
- ต้องมีตัวเลขอย่างน้อย 1 ตัว

### 2. Account Locking

- ล็อกบัญชีอัตโนมัติหลังจากพยายาม login ผิด 5 ครั้ง (ตั้งค่าได้)
- ล็อกเป็นเวลา 30 นาที (ตั้งค่าได้)
- ปลดล็อกอัตโนมัติเมื่อหมดเวลา

### 3. Rate Limiting

- จำกัดจำนวนครั้งในการพยายาม login ต่อ IP address
- จำกัดจำนวนครั้งในการขอรีเซ็ตรหัสผ่าน

### 4. Session Management

- Session มีอายุ 24 ชั่วโมง (ตั้งค่าได้)
- Session จะหมดอายุอัตโนมัติเมื่อไม่มีการใช้งาน 30 นาที (ตั้งค่าได้)
- สามารถมี session พร้อมกันได้สูงสุด 5 sessions (ตั้งค่าได้)

### 5. Password Reset Tokens

- Token มีอายุ 1 ชั่วโมง (ตั้งค่าได้)
- Token ใช้ได้เพียงครั้งเดียว
- จำกัดจำนวนครั้งในการขอ token ต่อชั่วโมง

## Configuration

การตั้งค่าระบบสามารถปรับได้ผ่านตาราง `system_settings`:

```sql
-- ตัวอย่างการตั้งค่า
UPDATE system_settings 
SET setting_value = '48' 
WHERE setting_key = 'auth.session_duration_hours';

UPDATE system_settings 
SET setting_value = '10' 
WHERE setting_key = 'auth.max_login_attempts';
```

หรือใช้ผ่าน API:

```typescript
import { updateAuthSettings } from '@/lib/auth';

await updateAuthSettings(
  {
    session_duration: 48,
    max_attempts: 10,
    lock_duration: 60
  },
  adminUserId
);
```

## Database Functions

ระบบใช้ PostgreSQL functions สำหรับการทำงานที่สำคัญ:

- **create_session()** - สร้าง session ใหม่
- **validate_session_token()** - ตรวจสอบ session token
- **invalidate_session()** - ยกเลิก session
- **create_reset_token()** - สร้าง password reset token
- **validate_reset_token()** - ตรวจสอบ reset token
- **use_reset_token()** - ใช้ reset token เพื่อเปลี่ยนรหัสผ่าน
- **log_login_attempt()** - บันทึกการพยายาม login
- **check_rate_limit()** - ตรวจสอบ rate limit
- **log_audit()** - บันทึก audit log

## Maintenance

### Cleanup Tasks

ระบบมี functions สำหรับทำความสะอาดข้อมูลเก่า:

```typescript
import { 
  cleanupExpiredTokens,
  cleanupOldLoginAttempts
} from '@/lib/auth';

// ทำความสะอาด tokens ที่หมดอายุ
await cleanupExpiredTokens();

// ทำความสะอาด login attempts เก่า
await cleanupOldLoginAttempts();
```

แนะนำให้รัน cleanup tasks เป็นประจำผ่าน cron job

### Monitoring

ตรวจสอบสถานะระบบผ่าน:

```typescript
import { 
  getLoginAttemptStats,
  getSuspiciousLoginPatterns,
  getAuditStatistics
} from '@/lib/auth';

// สถิติการ login
const stats = await getLoginAttemptStats(24); // 24 ชั่วโมงที่ผ่านมา

// รูปแบบการ login ที่น่าสงสัย
const suspicious = await getSuspiciousLoginPatterns(24, 5);

// สถิติ audit logs
const auditStats = await getAuditStatistics(30); // 30 วันที่ผ่านมา
```

## Testing

### Development Mode

ในโหมด development, password reset token จะถูกส่งกลับมาใน API response เพื่อความสะดวกในการทดสอบ:

```typescript
// ใน development mode
const result = await requestPasswordReset({ email: 'test@example.com' });
console.log('Reset token:', result.token); // จะมี token ส่งกลับมา
```

### Test Accounts

สร้าง test accounts สำหรับทดสอบ:

```sql
-- สร้าง test user
INSERT INTO master_system_user (
  username, email, password_hash, full_name, role_id, is_active
) VALUES (
  'testuser',
  'test@example.com',
  '$2a$12$...', -- hash ของ 'Password123'
  'Test User',
  1,
  true
);
```

## Troubleshooting

### ปัญหาที่พบบ่อย

1. **ไม่สามารถ login ได้**
   - ตรวจสอบว่าบัญชีไม่ถูกล็อก
   - ตรวจสอบว่าบัญชี active (is_active = true)
   - ตรวจสอบ rate limiting

2. **Session หมดอายุเร็วเกินไป**
   - ตรวจสอบการตั้งค่า `auth.session_duration_hours`
   - ตรวจสอบการตั้งค่า `auth.session_idle_timeout_minutes`

3. **Password reset token ไม่ทำงาน**
   - ตรวจสอบว่า token ยังไม่หมดอายุ
   - ตรวจสอบว่า token ยังไม่ถูกใช้งานไปแล้ว

## Best Practices

1. **ใช้ HTTPS เสมอ** - ในการ production ต้องใช้ HTTPS เท่านั้น
2. **ตั้งค่า secure cookies** - ตั้งค่า `secure: true` สำหรับ cookies ใน production
3. **ใช้ strong passwords** - บังคับให้ผู้ใช้ใช้รหัสผ่านที่แข็งแรง
4. **Monitor audit logs** - ตรวจสอบ audit logs เป็นประจำ
5. **Regular cleanup** - รัน cleanup tasks เป็นประจำ
6. **Rate limiting** - ตั้งค่า rate limiting ที่เหมาะสม
7. **Session timeout** - ตั้งค่า session timeout ที่เหมาะสมกับการใช้งาน

## Future Enhancements

- Two-Factor Authentication (2FA)
- Email verification
- OAuth integration (Google, Microsoft)
- Biometric authentication
- Advanced threat detection
- IP whitelisting/blacklisting
