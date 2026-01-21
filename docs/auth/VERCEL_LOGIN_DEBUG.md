# Vercel Login Debug Guide

## ปัญหา
- ทดสอบบน localhost:3000 ได้ แต่บน Vercel ไม่ได้
- กดปุ่มเข้าสู่ระบบแล้วไม่มีอะไรเกิดขึ้น

## สาเหตุที่เป็นไปได้

### 1. Cookie ไม่ถูก Set บน Production
- บน Vercel ต้องใช้ `secure: true` สำหรับ HTTPS
- `sameSite` setting อาจจะไม่เหมาะสม
- Domain setting อาจจะผิด

### 2. JWT_SECRET ไม่ได้ถูก Set บน Vercel
- ต้องเพิ่ม environment variable `JWT_SECRET` บน Vercel
- ไปที่ Vercel Dashboard → Project Settings → Environment Variables
- เพิ่ม `JWT_SECRET` ด้วยค่าเดียวกับใน `.env.local`

### 3. Supabase Connection
- ตรวจสอบว่า `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ถูก set บน Vercel

## การแก้ไขที่ทำไปแล้ว

### 1. เพิ่ม Debug Logs
- เพิ่ม console.log ใน `/api/auth/login` เพื่อดู:
  - Login attempt
  - Token generation
  - Cookie setting
  - Environment variables

- เพิ่ม console.log ใน `/api/auth/me` เพื่อดู:
  - All cookies received
  - auth_token existence
  - Token verification

- เพิ่ม console.log ใน `app/login/page.tsx` เพื่อดู:
  - Form submission
  - API response
  - Redirect

### 2. ปรับ Cookie Settings
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // true บน Vercel
  sameSite: 'lax' as const, // เปลี่ยนจาก 'strict' เป็น 'lax'
  maxAge: 24 * 60 * 60, // 24 hours
  path: '/',
  domain: undefined // ให้ browser จัดการ domain เอง
};
```

## วิธีตรวจสอบปัญหาบน Vercel

### 1. ดู Logs บน Vercel
1. ไปที่ Vercel Dashboard
2. เลือก Project
3. ไปที่ Deployments → Latest Deployment
4. คลิก "View Function Logs"
5. ลองเข้าสู่ระบบและดู logs ที่แสดง

### 2. ตรวจสอบ Environment Variables
1. ไปที่ Project Settings → Environment Variables
2. ตรวจสอบว่ามี:
   - `JWT_SECRET` (ต้องมี!)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (ถ้าใช้)

### 3. ตรวจสอบ Browser Console
1. เปิด Developer Tools (F12)
2. ไปที่ Console tab
3. ลองเข้าสู่ระบบและดู logs:
   - `🔐 [Login Page] Submitting login form...`
   - `🔐 [Login Page] Response status: 200`
   - `✅ [Login Page] Login successful, redirecting...`

4. ไปที่ Network tab
5. ดู request `/api/auth/login`:
   - Response Headers → Set-Cookie → ต้องมี `auth_token`

6. ไปที่ Application tab → Cookies
7. ตรวจสอบว่ามี cookie `auth_token` หรือไม่

## ขั้นตอนการแก้ไข

### ถ้า JWT_SECRET ไม่ได้ Set
1. ไปที่ Vercel Dashboard
2. Project Settings → Environment Variables
3. เพิ่ม `JWT_SECRET` ด้วยค่าจาก `.env.local`
4. Redeploy project

### ถ้า Cookie ไม่ถูก Set
1. ตรวจสอบ logs บน Vercel ว่ามี:
   - `🍪 [Login API] Setting auth_token cookie`
   - `🍪 [Login API] Cookie set successfully`

2. ถ้าไม่มี logs เหล่านี้ → ปัญหาอยู่ที่ login logic
3. ถ้ามี logs แต่ cookie ไม่ถูกส่งไปที่ browser → ปัญหาอยู่ที่ cookie settings

### ถ้า Cookie ถูก Set แต่ไม่ถูกส่งกลับมา
1. ตรวจสอบว่า domain ของ cookie ตรงกับ domain ของ Vercel หรือไม่
2. ลอง set `sameSite: 'none'` และ `secure: true` (สำหรับ cross-site cookies)

## ไฟล์ที่เกี่ยวข้อง
- `app/api/auth/login/route.ts` - Login API with cookie setting
- `app/api/auth/me/route.ts` - Check authentication API
- `app/login/page.tsx` - Login form
- `lib/auth/simple-auth.ts` - JWT token generation
- `proxy.ts` - JWT validation middleware

## การทดสอบ

### Local (localhost:3000)
```bash
npm run dev
```
- เปิด http://localhost:3000
- ลองเข้าสู่ระบบ
- ตรวจสอบ console logs

### Production (Vercel)
1. Deploy ไปที่ Vercel
2. เปิด Vercel URL
3. เปิด Developer Tools → Console
4. ลองเข้าสู่ระบบ
5. ดู logs ทั้งใน browser console และ Vercel function logs

## การใช้ Test Page

ฉันได้สร้าง `test-vercel-login.html` ไว้ให้แล้ว:

1. Deploy ไปที่ Vercel
2. เปิด `https://your-app.vercel.app/test-vercel-login.html`
3. กดปุ่มตามลำดับ:
   - Check Environment → ดู URL, protocol, host
   - Test Login → ใส่ email/password และกด Test Login
   - Check Cookies → ดู cookies (auth_token จะไม่แสดงเพราะเป็น HttpOnly)
   - Test /api/auth/me → ดูว่า cookie ถูกส่งไปหรือไม่

4. ดู logs ในแต่ละ section และส่งมาให้ดู

## สิ่งสำคัญที่ต้องตรวจสอบบน Vercel

### 1. Environment Variables (สำคัญมาก!)
ไปที่ Vercel Dashboard → Project Settings → Environment Variables

ต้องมี:
```
JWT_SECRET=austamgood-wms-jwt-secret-key-change-in-production-2025
NEXT_PUBLIC_SUPABASE_URL=https://iwlkslewdgenckuejbit.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**หลังจากเพิ่ม Environment Variables แล้ว ต้อง Redeploy!**

### 2. ตรวจสอบ Vercel Function Logs
1. Vercel Dashboard → Deployments → Latest
2. คลิก "View Function Logs"
3. ลองเข้าสู่ระบบและดู logs:
   - `🔐 [Login API] Login attempt for: ...`
   - `🍪 [Login API] Setting auth_token cookie`
   - `🍪 [Login API] JWT_SECRET exists: true/false` ← สำคัญ!

### 3. ถ้า JWT_SECRET ไม่มี
- Login จะสำเร็จ แต่ token จะใช้ default secret
- บน production จะใช้ secret ที่ต่างกัน → token ไม่ valid
- **ต้อง set JWT_SECRET บน Vercel และ Redeploy**

## Next Steps
1. **Set Environment Variables บน Vercel** (สำคัญที่สุด!)
2. **Redeploy** หลังจาก set env vars
3. ใช้ `test-vercel-login.html` เพื่อทดสอบ
4. ส่ง logs จาก test page มาให้ดู
5. ส่ง Vercel Function Logs มาให้ดูด้วย
