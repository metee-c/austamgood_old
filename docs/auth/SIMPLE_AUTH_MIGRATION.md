# การเปลี่ยนแปลงระบบ Authentication เป็นแบบง่าย

## สรุปการเปลี่ยนแปลง

เปลี่ยนจากระบบ authentication ที่ซับซ้อนด้วย session management ในฐานข้อมูล มาเป็นระบบแบบง่ายที่ใช้ JWT token เท่านั้น

## ไฟล์ที่สร้างใหม่

### 1. `lib/auth/simple-auth.ts`
ระบบ authentication แบบง่าย ประกอบด้วย:
- `simpleLogin()` - เข้าสู่ระบบโดยเช็คจาก `master_system_user`
- `verifyToken()` - ตรวจสอบ JWT token
- `getUserFromToken()` - ดึงข้อมูลผู้ใช้จาก token
- `simpleChangePassword()` - เปลี่ยนรหัสผ่าน

### 2. `lib/api/simple-with-auth.ts`
Middleware สำหรับ API routes ที่ต้องการ authentication:
- `withSimpleAuth()` - Wrapper function สำหรับ API handlers
- `getUserFromRequest()` - ดึงข้อมูล user จาก authenticated request

### 3. `app/api/auth/logout/route.ts`
API สำหรับออกจากระบบ (ลบ cookie)

## ไฟล์ที่แก้ไข

### 1. `app/api/auth/login/route.ts`
- เปลี่ยนจากใช้ `login()` เป็น `simpleLogin()`
- เปลี่ยน cookie จาก `session_token` เป็น `auth_token`
- ลบการจัดการ session ในฐานข้อมูล

### 2. `app/api/auth/me/route.ts`
- เปลี่ยนจากใช้ `getCurrentSession()` เป็น `getUserFromToken()`
- อ่าน cookie `auth_token` แทน `session_token`

### 3. `app/api/auth/change-password/route.ts`
- เปลี่ยนจากใช้ `changePassword()` เป็น `simpleChangePassword()`
- ใช้ `getUserFromToken()` แทน `getCurrentSession()`

### 4. `hooks/useAuth.ts`
- ลบการจัดการ session state
- อัพเดทให้ทำงานกับ JWT token

## การใช้งาน

### การเข้าสู่ระบบ

```typescript
const result = await simpleLogin({
  email: 'user@example.com',
  password: 'password123'
});

if (result.success) {
  // result.token จะถูกเก็บใน cookie 'auth_token' อัตโนมัติ
  console.log('User:', result.user);
}
```

### การตรวจสอบ Authentication ใน API Route

```typescript
import { withSimpleAuth, getUserFromRequest } from '@/lib/api/simple-with-auth';

export const GET = withSimpleAuth(async (request) => {
  const user = getUserFromRequest(request);
  
  // ใช้ user.user_id, user.email, etc.
  return NextResponse.json({ user });
});
```

### การดึงข้อมูลผู้ใช้ปัจจุบัน

```typescript
// ใน Client Component
const { user, isAuthenticated } = useAuth();

// ใน API Route
const token = request.cookies.get('auth_token')?.value;
const result = await getUserFromToken(token);
```

## Environment Variables

เพิ่ม `JWT_SECRET` ใน `.env.local`:

```bash
JWT_SECRET=your-secret-key-change-in-production
```

## ข้อดีของระบบใหม่

1. **ง่ายกว่า** - ไม่ต้องจัดการ session ในฐานข้อมูล
2. **เร็วกว่า** - ไม่ต้อง query ฐานข้อมูลทุกครั้งที่ตรวจสอบ auth
3. **Stateless** - ไม่มี session state ในฐานข้อมูล
4. **Scalable** - ง่ายต่อการ scale แนวนอน

## ข้อควรระวัง

1. **JWT Secret** - ต้องเก็บ `JWT_SECRET` ให้ปลอดภัย
2. **Token Expiry** - Token หมดอายุใน 24 ชั่วโมง (ปรับได้ใน `simple-auth.ts`)
3. **Logout** - การ logout จะลบ cookie แต่ token ยังใช้งานได้จนกว่าจะหมดอายุ

## การ Migrate

ระบบใหม่จะทำงานแยกจากระบบเดิม ไม่กระทบกับ:
- ตาราง `user_sessions` ในฐานข้อมูล
- ไฟล์ `lib/auth/session.ts` เดิม
- ไฟล์ `lib/auth/auth-service.ts` เดิม

หากต้องการใช้ระบบเดิม สามารถเปลี่ยน import กลับได้

## การทดสอบ

1. ทดสอบเข้าสู่ระบบ:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

2. ทดสอบดึงข้อมูลผู้ใช้:
```bash
curl http://localhost:3000/api/auth/me \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

3. ทดสอบออกจากระบบ:
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

## สรุป

ระบบ authentication แบบใหม่นี้เรียบง่ายและใช้งานง่ายกว่า โดยเช็คข้อมูลผู้ใช้จาก `master_system_user` เท่านั้น และใช้ JWT token สำหรับการจัดการ session แทนการเก็บใน database
