# Design Document: WMS Login & Authentication System

## Overview

ระบบ Login, Authentication และ Permission Management สำหรับ WMS ที่ทำงานบน Next.js 15.5+ และ Supabase PostgreSQL โดยใช้ตาราง `master_system_user` ที่มีอยู่แล้วเป็นฐาน

**เป้าหมายหลัก:**
- Authentication ที่ปลอดภัยด้วย bcrypt password hashing
- Session management แบบ database-backed สำหรับ serverless architecture
- Role-Based Access Control (RBAC) แบบละเอียด 260+ permissions
- รองรับ 20 concurrent users บน Vercel + Supabase
- UX/UI ที่เป็นมิตรกับผู้ใช้ภาษาไทย

## Architecture

### High-Level Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │─────▶│  Next.js API │─────▶│  Supabase   │
│  (Client)   │◀─────│   Routes     │◀─────│  PostgreSQL │
└─────────────┘      └──────────────┘      └─────────────┘
     │                      │                      │
     │                      │                      │
  Cookies              Middleware            Database
  Session              Auth Check            Sessions
  Tokens               Permission            Users
                       Validation            Permissions
```

### Technology Stack

- **Frontend**: Next.js 15.5+ App Router, React 19.2+, TypeScript
- **Backend**: Next.js API Routes, Server Actions
- **Database**: Supabase PostgreSQL
- **Authentication**: Custom JWT-like tokens, bcrypt password hashing
- **Session Storage**: PostgreSQL sessions table
- **Deployment**: Vercel (Frontend), Supabase (Database)



## Components and Interfaces

### 1. Authentication Layer (`lib/auth/`)

#### 1.1 Password Management (`lib/auth/password.ts`)
```typescript
// Password hashing and verification
export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, hash: string): Promise<boolean>
export function validatePassword(password: string): { valid: boolean; errors: string[] }
```

#### 1.2 Session Management (`lib/auth/session.ts`)
```typescript
export interface SessionData {
  sessionId: string;
  userId: number;
  username: string;
  email: string;
  fullName: string;
  roles: Role[];
  permissions: Permission[];
  expiresAt: Date;
}

export async function createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<string>
export async function validateSession(token: string): Promise<SessionData | null>
export async function invalidateSession(token: string): Promise<boolean>
export async function invalidateAllUserSessions(userId: number): Promise<number>
export async function extendSession(token: string): Promise<boolean>
```

#### 1.3 Token Generation (`lib/auth/tokens.ts`)
```typescript
export function generateSessionToken(): string
export function generateResetToken(): string
export function generateVerificationToken(): string
```

#### 1.4 Permission Checking (`lib/auth/permissions.ts`)
```typescript
export function hasPermission(permissions: Permission[], moduleKey: string, action: string): boolean
export function hasAnyPermission(permissions: Permission[], checks: Array<{module: string, action: string}>): boolean
export function hasAllPermissions(permissions: Permission[], checks: Array<{module: string, action: string}>): boolean
export function filterByPermissions<T>(items: T[], permissions: Permission[], getRequiredPermission: (item: T) => {module: string, action: string}): T[]
```



### 2. API Routes (`app/api/auth/`)

#### 2.1 Login Endpoint (`app/api/auth/login/route.ts`)
```typescript
POST /api/auth/login
Request Body: {
  email: string;
  password: string;
}
Response: {
  success: boolean;
  user?: {
    userId: number;
    username: string;
    email: string;
    fullName: string;
  };
  error?: string;
}
```

**Flow:**
1. Validate email format and required fields
2. Check rate limiting (max 10 attempts per hour per IP/email)
3. Query master_system_user by email
4. Check is_active flag
5. Check locked_until timestamp
6. Verify password with bcrypt
7. Load user roles and permissions
8. Create session record
9. Set HTTP-only cookie with session token
10. Log login attempt
11. Return user data

#### 2.2 Logout Endpoint (`app/api/auth/logout/route.ts`)
```typescript
POST /api/auth/logout
Response: {
  success: boolean;
}
```

**Flow:**
1. Get session token from cookie
2. Invalidate session in database
3. Clear session cookie
4. Log logout event
5. Return success

#### 2.3 Session Validation (`app/api/auth/session/route.ts`)
```typescript
GET /api/auth/session
Response: {
  valid: boolean;
  user?: SessionData;
  expiresIn?: number;
}
```

**Flow:**
1. Get session token from cookie
2. Validate session (check expiry, invalidated flag)
3. Update last_activity_at
4. Return session data



#### 2.4 Password Reset Request (`app/api/auth/reset-password/request/route.ts`)
```typescript
POST /api/auth/reset-password/request
Request Body: {
  email: string;
}
Response: {
  success: boolean;
  message: string;
}
```

**Flow:**
1. Validate email format
2. Check rate limiting (max 3 requests per hour per email)
3. Query user by email (don't reveal if exists)
4. If exists: generate reset token, store in password_reset_tokens
5. Send email with reset link
6. Always return same success message
7. Log reset request

#### 2.5 Password Reset Validation (`app/api/auth/reset-password/validate/route.ts`)
```typescript
GET /api/auth/reset-password/validate?token=xxx
Response: {
  valid: boolean;
  email?: string;
}
```

**Flow:**
1. Validate token format
2. Query password_reset_tokens
3. Check expiry and used_at
4. Return validity status

#### 2.6 Password Reset Completion (`app/api/auth/reset-password/complete/route.ts`)
```typescript
POST /api/auth/reset-password/complete
Request Body: {
  token: string;
  newPassword: string;
}
Response: {
  success: boolean;
  error?: string;
}
```

**Flow:**
1. Validate token
2. Validate new password requirements
3. Hash new password
4. Update master_system_user.password_hash
5. Mark token as used
6. Invalidate all user sessions
7. Log password change
8. Return success



### 3. Middleware and Guards

#### 3.1 Authentication Middleware (`middleware.ts`)
```typescript
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  
  // Public routes that don't require auth
  const publicRoutes = ['/login', '/reset-password'];
  if (publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Validate session
  const session = await validateSession(token);
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Add user data to request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId.toString());
  requestHeaders.set('x-user-email', session.email);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

#### 3.2 Permission Guard Hook (`hooks/usePermission.ts`)
```typescript
export function usePermission(moduleKey: string, action: string): boolean {
  const { permissions } = useAuth();
  return hasPermission(permissions, moduleKey, action);
}

export function useHasAnyPermission(checks: Array<{module: string, action: string}>): boolean {
  const { permissions } = useAuth();
  return hasAnyPermission(permissions, checks);
}
```

#### 3.3 API Permission Middleware (`lib/auth/api-middleware.ts`)
```typescript
export function requirePermission(moduleKey: string, action: string) {
  return async (req: NextRequest) => {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!hasPermission(session.permissions, moduleKey, action)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return null; // Permission granted
  };
}
```



## Data Models

### Database Tables (Already Created in Migrations 115-124)

#### master_system_user (Enhanced)
```sql
- user_id (PK)
- username (unique)
- email (unique)
- full_name
- phone_number
- employee_id (FK)
- password_hash (bcrypt, cost 12)
- failed_login_attempts (default 0)
- locked_until (nullable timestamp)
- last_login_at
- password_changed_at
- force_password_change (boolean)
- two_factor_enabled (boolean)
- two_factor_secret
- email_verified (boolean)
- email_verification_token
- is_active
- created_at
- updated_at
- created_by
- remarks
```

#### sessions
```sql
- session_id (PK, UUID)
- user_id (FK)
- token (unique, 128 chars)
- created_at
- expired_at (created_at + 24 hours)
- last_activity_at
- ip_address (INET)
- user_agent
- device_info (JSONB)
- invalidated (boolean, default false)
- invalidated_at
- invalidated_by (FK to user_id)
```

#### password_reset_tokens
```sql
- token_id (PK, UUID)
- user_id (FK)
- token (unique, 64 chars)
- created_at
- expired_at (created_at + 1 hour)
- used_at (nullable)
- ip_address
```

#### login_attempts
```sql
- attempt_id (PK, UUID)
- email
- user_id (FK, nullable)
- ip_address
- user_agent
- attempted_at
- success (boolean)
- failure_reason
- session_id (FK, nullable)
```

#### system_settings
```sql
- setting_id (PK, UUID)
- setting_key (unique, format: module.setting_name)
- setting_value (text)
- setting_type (string|number|boolean|json)
- description
- created_at
- updated_at
- updated_by (FK)
```

#### audit_logs
```sql
- log_id (PK, UUID)
- user_id (FK)
- action
- entity_type
- entity_id
- old_values (JSONB)
- new_values (JSONB)
- ip_address
- user_agent
- created_at
- session_id (FK)
```



### TypeScript Interfaces

#### User and Session Types (`types/auth.ts`)
```typescript
export interface User {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  employeeId?: number;
  isActive: boolean;
  lastLoginAt?: Date;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface Role {
  roleId: number;
  roleName: string;
  roleKey: string;
  description?: string;
  isSystem: boolean;
}

export interface Permission {
  moduleId: number;
  moduleKey: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canImport: boolean;
  canExport: boolean;
  canPrint: boolean;
  canScan: boolean;
  canAssign: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canRollback: boolean;
  canPublish: boolean;
  canOptimize: boolean;
  canChangeStatus: boolean;
  canManageCoordinates: boolean;
  canResetReservations: boolean;
}

export interface SessionData {
  sessionId: string;
  userId: number;
  username: string;
  email: string;
  fullName: string;
  roles: Role[];
  permissions: Permission[];
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export interface LoginAttempt {
  attemptId: string;
  email: string;
  userId?: number;
  ipAddress?: string;
  userAgent?: string;
  attemptedAt: Date;
  success: boolean;
  failureReason?: string;
}
```



## Error Handling

### Error Types and Messages

```typescript
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_USED = 'TOKEN_USED',
  PASSWORD_WEAK = 'PASSWORD_WEAK',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
}

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.INVALID_CREDENTIALS]: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  [AuthErrorCode.ACCOUNT_LOCKED]: 'บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ในอีก {minutes} นาที',
  [AuthErrorCode.ACCOUNT_INACTIVE]: 'บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
  [AuthErrorCode.SESSION_EXPIRED]: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  [AuthErrorCode.SESSION_INVALID]: 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบอีกครั้ง',
  [AuthErrorCode.RATE_LIMIT_EXCEEDED]: 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่',
  [AuthErrorCode.TOKEN_EXPIRED]: 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่',
  [AuthErrorCode.TOKEN_INVALID]: 'ลิงก์ไม่ถูกต้อง',
  [AuthErrorCode.TOKEN_USED]: 'ลิงก์นี้ถูกใช้งานแล้ว',
  [AuthErrorCode.PASSWORD_WEAK]: 'รหัสผ่านไม่ตรงตามเงื่อนไข',
  [AuthErrorCode.PERMISSION_DENIED]: 'คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้',
  [AuthErrorCode.EMAIL_NOT_VERIFIED]: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ',
};
```

### Error Response Format

```typescript
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AuthError;
}
```



## Testing Strategy

### Unit Tests

#### Password Utilities Tests
```typescript
describe('Password Utilities', () => {
  test('should hash password with bcrypt cost 12', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^\$2[ayb]\$.{56}$/);
  });
  
  test('should verify correct password', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });
  
  test('should reject incorrect password', async () => {
    const hash = await hashPassword('Test123!@#');
    const isValid = await verifyPassword('WrongPassword', hash);
    expect(isValid).toBe(false);
  });
  
  test('should validate password requirements', () => {
    const result = validatePassword('Test123!@#');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  test('should reject weak password', () => {
    const result = validatePassword('weak');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

#### Session Management Tests
```typescript
describe('Session Management', () => {
  test('should create session with valid token', async () => {
    const token = await createSession(1);
    expect(token).toHaveLength(128);
  });
  
  test('should validate active session', async () => {
    const token = await createSession(1);
    const session = await validateSession(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(1);
  });
  
  test('should reject expired session', async () => {
    // Create session with past expiry
    const token = await createExpiredSession(1);
    const session = await validateSession(token);
    expect(session).toBeNull();
  });
  
  test('should invalidate session', async () => {
    const token = await createSession(1);
    await invalidateSession(token);
    const session = await validateSession(token);
    expect(session).toBeNull();
  });
});
```

#### Permission Checking Tests
```typescript
describe('Permission Checking', () => {
  test('should grant permission when user has it', () => {
    const permissions: Permission[] = [{
      moduleKey: 'warehouse.inbound',
      canView: true,
      canCreate: false,
    }];
    expect(hasPermission(permissions, 'warehouse.inbound', 'view')).toBe(true);
  });
  
  test('should deny permission when user lacks it', () => {
    const permissions: Permission[] = [{
      moduleKey: 'warehouse.inbound',
      canView: true,
      canCreate: false,
    }];
    expect(hasPermission(permissions, 'warehouse.inbound', 'create')).toBe(false);
  });
  
  test('should check multiple permissions with AND logic', () => {
    const permissions: Permission[] = [{
      moduleKey: 'orders',
      canView: true,
      canCreate: true,
      canEdit: false,
    }];
    const checks = [
      { module: 'orders', action: 'view' },
      { module: 'orders', action: 'create' },
    ];
    expect(hasAllPermissions(permissions, checks)).toBe(true);
  });
});
```



### Integration Tests

#### Login Flow Test
```typescript
describe('Login Flow', () => {
  test('should complete full login flow', async () => {
    // 1. Submit login credentials
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test123!@#',
      }),
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    
    // 2. Verify session cookie is set
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('session_token');
    
    // 3. Validate session
    const sessionResponse = await fetch('/api/auth/session', {
      headers: { Cookie: cookies },
    });
    expect(sessionResponse.status).toBe(200);
    const sessionData = await sessionResponse.json();
    expect(sessionData.valid).toBe(true);
  });
  
  test('should reject invalid credentials', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'WrongPassword',
      }),
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_CREDENTIALS');
  });
  
  test('should lock account after 5 failed attempts', async () => {
    // Attempt login 5 times with wrong password
    for (let i = 0; i < 5; i++) {
      await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'WrongPassword',
        }),
      });
    }
    
    // 6th attempt should be locked
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test123!@#',
      }),
    });
    
    expect(response.status).toBe(423);
    const data = await response.json();
    expect(data.error).toBe('ACCOUNT_LOCKED');
  });
});
```

#### Password Reset Flow Test
```typescript
describe('Password Reset Flow', () => {
  test('should complete full password reset flow', async () => {
    // 1. Request password reset
    const requestResponse = await fetch('/api/auth/reset-password/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(requestResponse.status).toBe(200);
    
    // 2. Get token from database (in real test, from email)
    const token = await getLatestResetToken('test@example.com');
    
    // 3. Validate token
    const validateResponse = await fetch(`/api/auth/reset-password/validate?token=${token}`);
    expect(validateResponse.status).toBe(200);
    const validateData = await validateResponse.json();
    expect(validateData.valid).toBe(true);
    
    // 4. Complete password reset
    const completeResponse = await fetch('/api/auth/reset-password/complete', {
      method: 'POST',
      body: JSON.stringify({
        token,
        newPassword: 'NewPassword123!@#',
      }),
    });
    expect(completeResponse.status).toBe(200);
    
    // 5. Login with new password
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'NewPassword123!@#',
      }),
    });
    expect(loginResponse.status).toBe(200);
  });
});
```



## Security Considerations

### 1. Password Security
- Bcrypt hashing with cost factor 12
- Minimum 8 characters with complexity requirements
- No password in logs or error messages
- Password change invalidates all sessions

### 2. Session Security
- HTTP-only cookies (prevent XSS)
- Secure flag in production (HTTPS only)
- SameSite=Strict (prevent CSRF)
- 24-hour expiration with idle timeout
- Database-backed (works with serverless)

### 3. Rate Limiting
- Login: 10 attempts per hour per IP/email
- Password reset: 3 requests per hour per email
- Account lock: 15 minutes after 5 failed attempts

### 4. Token Security
- Cryptographically secure random generation
- Single-use tokens for password reset
- Short expiration (1 hour for reset tokens)
- Stored hashed in database

### 5. Input Validation
- Email format validation
- SQL injection prevention (prepared statements)
- XSS prevention (output encoding)
- CSRF protection (SameSite cookies)

### 6. Audit Logging
- All login attempts logged
- Permission changes logged
- Admin actions logged
- 90-day retention

## Performance Optimization

### 1. Database Queries
- Indexed columns: email, username, token, session_id
- Connection pooling via Supabase
- Prepared statements for repeated queries

### 2. Session Caching
- Permissions cached in session data
- No database query per permission check
- Session validation: < 100ms

### 3. Serverless Optimization
- Stateless authentication
- Database sessions (not in-memory)
- Minimal cold start impact

### 4. Expected Load
- 20 concurrent users
- ~100 database queries/day
- ~50MB bandwidth/day
- ~10MB storage for sessions/tokens

## Deployment Considerations

### Vercel Configuration
```javascript
// next.config.js
module.exports = {
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ],
};
```

### Environment Variables
```
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# App
NEXT_PUBLIC_APP_URL=https://wms.example.com
NODE_ENV=production

# Session
SESSION_SECRET=<random-64-char-string>
SESSION_DURATION_HOURS=24
IDLE_TIMEOUT_MINUTES=120

# Email (for password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<password>
FROM_EMAIL=noreply@example.com
```

## Monitoring and Maintenance

### Health Checks
- Session validation endpoint
- Database connection check
- Failed login rate monitoring

### Cleanup Jobs
- Daily: Delete expired sessions (> 7 days old)
- Daily: Delete expired reset tokens (> 7 days old)
- Weekly: Archive old audit logs (> 90 days)

### Alerts
- High failed login rate (> 50/hour)
- Account lockouts (> 5/hour)
- Database connection failures
- Session creation failures

---

**Design Document Complete**
- Database schema: ✅ (Migrations 115-124)
- API endpoints: ✅ Defined
- Authentication flow: ✅ Specified
- Permission system: ✅ Designed
- Security measures: ✅ Documented
- Testing strategy: ✅ Outlined
- Deployment plan: ✅ Ready

Next: Create Tasks Document for Implementation
