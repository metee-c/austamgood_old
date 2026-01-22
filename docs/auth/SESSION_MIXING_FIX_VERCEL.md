# แก้ไขปัญหา Session Mixing บน Vercel

## 🚨 ปัญหา

**อาการ**: ผู้ใช้ที่ใช้งานบน Vercel จะเห็น user ของตัวเอง แต่พอรีเฟรชเด้งไปเป็น user ของคนอื่นที่กำลังทำงานพร้อมกัน

**ความร้ายแรง**: 🔴 CRITICAL - ปัญหาด้านความปลอดภัยร้ายแรง (Security Breach)

**สาเหตุหลัก**:
1. Cookie ถูก share ระหว่าง users เพราะ SameSite='lax'
2. Vercel Edge CDN cache response ที่มี Set-Cookie header
3. JWT token ไม่มี unique identifier
4. ไม่มี Cache-Control headers ที่เหมาะสม

---

## ✅ การแก้ไขที่ทำแล้ว

### 1. แก้ไข Cookie Settings (app/api/auth/login/route.ts)

**ก่อนแก้ไข**:
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // ❌ อนุญาตให้ cookie ถูกส่งใน cross-site requests
  maxAge: 24 * 60 * 60,
  path: '/',
  domain: undefined
};
```

**หลังแก้ไข**:
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const, // ✅ ป้องกัน cookie sharing
  maxAge: 24 * 60 * 60,
  path: '/',
  // ✅ NO domain specified - ป้องกัน cross-subdomain sharing
};

// ✅ เพิ่ม Cache-Control headers
response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
response.headers.set('Pragma', 'no-cache');
response.headers.set('Expires', '0');
```

### 2. เพิ่ม Unique Identifier ใน JWT Token (lib/auth/simple-auth.ts)

**ก่อนแก้ไข**:
```typescript
const tokenPayload: TokenPayload = {
  user_id: userData.user_id,
  username: userData.username,
  email: userData.email,
  full_name: userData.full_name,
  role_id: userData.role_id,
  employee_id: userData.employee_id
};
```

**หลังแก้ไข**:
```typescript
const crypto = require('crypto');
const jti = crypto.randomBytes(16).toString('hex'); // ✅ Unique token ID

const tokenPayload: TokenPayload = {
  user_id: userData.user_id,
  username: userData.username,
  email: userData.email,
  full_name: userData.full_name,
  role_id: userData.role_id,
  employee_id: userData.employee_id,
  jti // ✅ Add unique identifier
};
```

### 3. เพิ่ม Cache-Control Headers (app/api/auth/me/route.ts)

```typescript
const response = NextResponse.json({ ... });

// ✅ CRITICAL: Prevent Vercel edge caching
response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
response.headers.set('Pragma', 'no-cache');
response.headers.set('Expires', '0');
response.headers.set('Vary', 'Cookie'); // ✅ Tell CDN to vary by cookie

return response;
```

### 4. สร้าง Middleware (middleware.ts)

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // ✅ Prevent Vercel edge caching for all API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie');
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## 🔧 ขั้นตอนการ Deploy

### 1. ตรวจสอบ Environment Variables บน Vercel

```bash
# ต้องมี JWT_SECRET ที่ unique และ secure
JWT_SECRET=<your-secure-random-string-at-least-32-characters>
```

**วิธีสร้าง JWT_SECRET ที่ปลอดภัย**:
```bash
# ใช้ Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# หรือใช้ OpenSSL
openssl rand -hex 32
```

### 2. Deploy ไปยัง Vercel

```bash
# Commit changes
git add .
git commit -m "fix: prevent session mixing on Vercel"

# Push to Vercel
git push origin main
```

### 3. ตรวจสอบหลัง Deploy

1. เปิด Vercel Dashboard → Settings → Environment Variables
2. ตรวจสอบว่า `JWT_SECRET` ถูกตั้งค่าแล้ว
3. Redeploy ถ้าจำเป็น

---

## 🧪 การทดสอบ

### Test Case 1: Multiple Users Login

1. เปิด Browser A → Login เป็น User A
2. เปิด Browser B (Incognito) → Login เป็น User B
3. Refresh Browser A → ต้องยังเป็น User A
4. Refresh Browser B → ต้องยังเป็น User B

### Test Case 2: Cookie Isolation

1. Login เป็น User A
2. เปิด DevTools → Application → Cookies
3. ตรวจสอบ `auth_token` cookie:
   - `HttpOnly`: ✅ true
   - `Secure`: ✅ true (production)
   - `SameSite`: ✅ Strict
   - `Domain`: ✅ (ไม่มี หรือ specific domain)

### Test Case 3: Cache Headers

1. Login เป็น User A
2. เปิด DevTools → Network
3. ดู Response Headers ของ `/api/auth/me`:
   ```
   Cache-Control: private, no-cache, no-store, must-revalidate
   Pragma: no-cache
   Expires: 0
   Vary: Cookie
   ```

---

## 📊 สรุปการเปลี่ยนแปลง

| ไฟล์ | การเปลี่ยนแปลง | เหตุผล |
|------|----------------|--------|
| `app/api/auth/login/route.ts` | เปลี่ยน SameSite เป็น 'strict', เพิ่ม Cache-Control headers | ป้องกัน cookie sharing และ CDN caching |
| `lib/auth/simple-auth.ts` | เพิ่ม `jti` (JWT ID) ใน token payload | ทำให้ token unique ต่อแต่ละ login |
| `app/api/auth/me/route.ts` | เพิ่ม Cache-Control headers | ป้องกัน Vercel cache user data |
| `middleware.ts` | สร้างใหม่ | ป้องกัน caching ทุก API routes |

---

## ⚠️ คำเตือน

### ❌ สิ่งที่ไม่ควรทำ

1. **ไม่ควรใช้ SameSite='lax'** - อนุญาตให้ cookie ถูกส่งใน cross-site requests
2. **ไม่ควรตั้ง domain ใน cookie** - อาจทำให้ cookie ถูก share ข้าม subdomains
3. **ไม่ควรใช้ JWT_SECRET แบบ default** - ต้องใช้ค่าที่ random และ secure
4. **ไม่ควรลืมตั้ง Cache-Control headers** - Vercel จะ cache response

### ✅ Best Practices

1. **ใช้ SameSite='strict'** - ป้องกัน CSRF และ cookie sharing
2. **ใช้ HttpOnly + Secure cookies** - ป้องกัน XSS
3. **เพิ่ม unique identifier ใน JWT** - ป้องกัน token reuse
4. **ตั้ง Cache-Control headers** - ป้องกัน CDN caching
5. **ใช้ HTTPS ใน production** - จำเป็นสำหรับ Secure cookies

---

## 🔍 การ Debug

### ตรวจสอบ Cookie บน Browser

```javascript
// เปิด Console ใน Browser
document.cookie
  .split(';')
  .map(c => c.trim())
  .filter(c => c.startsWith('auth_token='))
```

### ตรวจสอบ JWT Token

```javascript
// Decode JWT token (ไม่ต้อง verify)
const token = 'your-jwt-token';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// ต้องมี: user_id, email, jti, iat, exp
```

### ตรวจสอบ Response Headers

```bash
# ใช้ curl
curl -I https://your-app.vercel.app/api/auth/me

# ต้องมี:
# Cache-Control: private, no-cache, no-store, must-revalidate
# Pragma: no-cache
# Expires: 0
# Vary: Cookie
```

---

## 📝 Checklist ก่อน Deploy

- [ ] ตั้งค่า `JWT_SECRET` บน Vercel Environment Variables
- [ ] แก้ไข `app/api/auth/login/route.ts` (SameSite='strict')
- [ ] แก้ไข `lib/auth/simple-auth.ts` (เพิ่ม jti)
- [ ] แก้ไข `app/api/auth/me/route.ts` (Cache-Control headers)
- [ ] สร้าง `middleware.ts`
- [ ] Build และทดสอบ local
- [ ] Deploy ไปยัง Vercel
- [ ] ทดสอบด้วย multiple users
- [ ] ตรวจสอบ cookie settings
- [ ] ตรวจสอบ response headers

---

## 🆘 ถ้ายังมีปัญหา

### ปัญหา: ยังเห็น user ของคนอื่นอยู่

**วิธีแก้**:
1. Clear browser cache และ cookies ทั้งหมด
2. Logout ทุก users
3. Login ใหม่
4. ตรวจสอบว่า JWT_SECRET ถูกตั้งค่าบน Vercel แล้ว

### ปัญหา: Cookie ไม่ถูกตั้งค่า

**วิธีแก้**:
1. ตรวจสอบว่าใช้ HTTPS ใน production
2. ตรวจสอบ `secure: true` ใน cookie options
3. ตรวจสอบ browser console สำหรับ cookie warnings

### ปัญหา: Token หมดอายุเร็วเกินไป

**วิธีแก้**:
1. เปลี่ยน `JWT_EXPIRY` ใน `lib/auth/simple-auth.ts`
2. ปัจจุบันตั้งเป็น '24h' (24 ชั่วโมง)

---

**อัพเดทล่าสุด**: 22 มกราคม 2026  
**สถานะ**: ✅ แก้ไขเสร็จแล้ว - รอ deploy และทดสอบ  
**ความสำคัญ**: 🔴 CRITICAL
