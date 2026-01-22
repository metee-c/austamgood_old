# 🚀 Deploy Session Mixing Fix to Vercel

## ⚠️ ปัญหาที่แก้ไข

**Session Mixing**: ผู้ใช้เห็น user ของคนอื่นหลังจาก refresh

---

## 📋 Checklist ก่อน Deploy

### 1. ตรวจสอบไฟล์ที่แก้ไข

- [x] `app/api/auth/login/route.ts` - Cookie SameSite='strict' + Cache-Control
- [x] `lib/auth/simple-auth.ts` - เพิ่ม jti ใน JWT token
- [x] `app/api/auth/me/route.ts` - Cache-Control headers
- [x] `middleware.ts` - ป้องกัน API caching

### 2. ตั้งค่า Environment Variables บน Vercel

```bash
# 1. ไปที่ Vercel Dashboard
https://vercel.com/your-team/your-project/settings/environment-variables

# 2. เพิ่ม JWT_SECRET (ถ้ายังไม่มี)
JWT_SECRET=<your-secure-random-string>

# 3. สร้าง JWT_SECRET ที่ปลอดภัย:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 ขั้นตอนการ Deploy

### Step 1: Commit Changes

```bash
# 1. ตรวจสอบไฟล์ที่เปลี่ยนแปลง
git status

# 2. Add ไฟล์ทั้งหมด
git add app/api/auth/login/route.ts
git add lib/auth/simple-auth.ts
git add app/api/auth/me/route.ts
git add middleware.ts
git add docs/auth/SESSION_MIXING_FIX_VERCEL.md
git add DEPLOY_SESSION_FIX.md

# 3. Commit
git commit -m "fix(auth): prevent session mixing on Vercel

- Change cookie SameSite from 'lax' to 'strict'
- Add unique jti (JWT ID) to prevent token reuse
- Add Cache-Control headers to prevent CDN caching
- Create middleware to prevent API route caching
- CRITICAL: Fix security issue where users see other users' sessions"
```

### Step 2: Push to Repository

```bash
# Push to main branch (จะ trigger Vercel auto-deploy)
git push origin main
```

### Step 3: ตรวจสอบ Vercel Deployment

1. ไปที่ Vercel Dashboard
2. รอ deployment เสร็จ (ประมาณ 2-3 นาที)
3. ตรวจสอบ deployment logs สำหรับ errors

---

## 🧪 การทดสอบหลัง Deploy

### Test 1: Multiple Users (CRITICAL)

```bash
# 1. เปิด Browser A (Chrome)
https://your-app.vercel.app/login
# Login เป็น user1@example.com

# 2. เปิด Browser B (Firefox หรือ Chrome Incognito)
https://your-app.vercel.app/login
# Login เป็น user2@example.com

# 3. Refresh Browser A หลายๆ ครั้ง
# ✅ ต้องยังเป็น user1@example.com

# 4. Refresh Browser B หลายๆ ครั้ง
# ✅ ต้องยังเป็น user2@example.com
```

### Test 2: Cookie Settings

```javascript
// เปิด DevTools → Application → Cookies
// ตรวจสอบ auth_token cookie:

// ✅ ต้องมี:
HttpOnly: true
Secure: true (ใน production)
SameSite: Strict
Path: /
Domain: (ไม่มี หรือ specific domain)
```

### Test 3: Response Headers

```bash
# ใช้ curl หรือ DevTools Network tab
curl -I https://your-app.vercel.app/api/auth/me

# ✅ ต้องมี headers:
Cache-Control: private, no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
Vary: Cookie
```

### Test 4: JWT Token

```javascript
// เปิด Console ใน Browser
const token = document.cookie
  .split(';')
  .find(c => c.trim().startsWith('auth_token='))
  ?.split('=')[1];

// Decode JWT (ไม่ต้อง verify)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);

// ✅ ต้องมี:
// - user_id
// - email
// - jti (unique identifier)
// - iat (issued at)
// - exp (expiry)
```

---

## ✅ ผลลัพธ์ที่คาดหวัง

### ก่อนแก้ไข ❌
- User A login → refresh → เห็น User B
- Cookie SameSite='lax' → อนุญาต cross-site requests
- ไม่มี Cache-Control → Vercel cache response
- JWT ไม่มี unique ID → token reuse

### หลังแก้ไข ✅
- User A login → refresh → ยังเป็น User A
- Cookie SameSite='strict' → ป้องกัน cookie sharing
- มี Cache-Control → ไม่ cache response
- JWT มี jti → ป้องกัน token reuse

---

## 🔍 Troubleshooting

### ปัญหา: ยังเห็น user ของคนอื่นอยู่

**วิธีแก้**:
```bash
# 1. ตรวจสอบ JWT_SECRET บน Vercel
# ไปที่ Vercel Dashboard → Settings → Environment Variables

# 2. Clear browser cache ทั้งหมด
# Chrome: Ctrl+Shift+Delete → Clear all

# 3. Logout ทุก users และ login ใหม่

# 4. ตรวจสอบ deployment logs
# Vercel Dashboard → Deployments → Latest → View Function Logs
```

### ปัญหา: Cookie ไม่ถูกตั้งค่า

**วิธีแก้**:
```bash
# 1. ตรวจสอบว่าใช้ HTTPS
# Vercel ใช้ HTTPS โดย default

# 2. ตรวจสอบ browser console
# F12 → Console → ดู cookie warnings

# 3. ตรวจสอบ response headers
# F12 → Network → เลือก /api/auth/login → Headers
```

### ปัญหา: Middleware ไม่ทำงาน

**วิธีแก้**:
```bash
# 1. ตรวจสอบว่า middleware.ts อยู่ที่ root ของ project
ls -la middleware.ts

# 2. ตรวจสอบ Next.js version
# ต้องเป็น Next.js 12+ เพื่อใช้ middleware

# 3. Rebuild และ redeploy
npm run build
git push origin main
```

---

## 📊 Monitoring

### ตรวจสอบ Logs บน Vercel

```bash
# 1. ไปที่ Vercel Dashboard
https://vercel.com/your-team/your-project

# 2. คลิก "Deployments" → เลือก latest deployment

# 3. คลิก "View Function Logs"

# 4. ค้นหา logs:
# - "🍪 [Login API] Setting auth_token cookie"
# - "✅ [Auth Me API] User authenticated"
# - "👤 [Auth Me API] User ID: xxx"
```

### ตรวจสอบ Errors

```bash
# ดู error logs
# Vercel Dashboard → Deployments → Latest → Runtime Logs

# ค้นหา:
# - "❌" (error indicators)
# - "Session mixing"
# - "Cookie"
# - "JWT"
```

---

## 🎯 Success Criteria

- [ ] Multiple users สามารถ login พร้อมกันได้โดยไม่เห็น session ของกัน
- [ ] Refresh page ไม่ทำให้เปลี่ยน user
- [ ] Cookie มี SameSite='strict'
- [ ] Response มี Cache-Control headers
- [ ] JWT token มี jti (unique identifier)
- [ ] ไม่มี error ใน Vercel logs
- [ ] ทดสอบกับ 3+ users พร้อมกันผ่าน

---

## 📞 Support

ถ้ายังมีปัญหา:
1. ตรวจสอบ `docs/auth/SESSION_MIXING_FIX_VERCEL.md` สำหรับรายละเอียด
2. ดู Vercel logs สำหรับ errors
3. ทดสอบ local ก่อน deploy

---

**Deploy Date**: 22 มกราคม 2026  
**Priority**: 🔴 CRITICAL  
**Status**: ⏳ Ready to Deploy
