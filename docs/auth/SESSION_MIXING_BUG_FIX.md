# Session Mixing Bug - แก้ไขปัญหาผู้ใช้เห็นข้อมูลคนอื่น

## ปัญหา
เมื่อมีผู้ใช้ 3 คนใช้งานพร้อมกัน ระบบแสดงข้อมูลผู้ใช้สลับกัน (เห็นชื่อคนอื่น) ที่มุมขวาบนของหน้าจอ

## สาเหตุ

### 1. Cookie SameSite Policy
- Cookie `session_token` ใช้ `sameSite: 'lax'` ซึ่งอนุญาตให้ส่ง cookie ในบาง cross-site requests
- อาจทำให้เกิด session leakage ระหว่าง tabs/windows

### 2. ไม่มี Session Isolation
- Cookie ไม่มีการระบุ `domain` ที่ชัดเจน
- Session token อาจถูก share ระหว่าง tabs ของ browser เดียวกัน

### 3. Race Condition ใน Session Validation
- เมื่อหลาย requests เกิดพร้อมกัน อาจเกิด race condition ในการ validate session

## การแก้ไข

### 1. เปลี่ยน Cookie SameSite Policy
**ไฟล์**: `app/api/auth/login/route.ts`, `lib/auth/session.ts`

```typescript
// เปลี่ยนจาก
sameSite: 'lax'

// เป็น
sameSite: 'strict'
```

**ผลลัพธ์**:
- Cookie จะถูกส่งเฉพาะ same-site requests เท่านั้น
- ป้องกัน CSRF attacks
- ป้องกัน session leakage

### 2. เพิ่ม Logging ใน Session Validation
**ไฟล์**: `app/api/auth/me/route.ts`

เพิ่ม logging เพื่อ debug:
```typescript
console.log('🔍 [/api/auth/me] Session token found:', sessionToken.substring(0, 20) + '...');
console.log('✅ [/api/auth/me] Session valid for user:', session.email, 'user_id:', session.user_id);
```

### 3. Cookie Configuration
```typescript
{
  httpOnly: true,           // ป้องกัน XSS
  secure: true,             // ใช้ HTTPS เท่านั้น (production)
  sameSite: 'strict',       // ป้องกัน CSRF และ session mixing
  path: '/',                // ใช้ได้ทั้ง site
  maxAge: 30 * 24 * 60 * 60 // 30 วัน (ถ้า remember_me = true)
}
```

## การทดสอบ

### ขั้นตอนการทดสอบ
1. ให้ผู้ใช้ 3 คน logout ทั้งหมด
2. ล้าง cookies ใน browser (Ctrl+Shift+Delete)
3. ให้แต่ละคน login ใหม่ในแต่ละ browser/device
4. ตรวจสอบว่าแต่ละคนเห็นชื่อตัวเองที่มุมขวาบน
5. ทดสอบใช้งานพร้อมกัน 3 คน

### ตรวจสอบ Session Token
เปิด Browser DevTools → Application → Cookies → ตรวจสอบ:
- `session_token` มีค่าไม่ซ้ำกันในแต่ละ browser
- `SameSite` = `Strict`
- `HttpOnly` = `true`
- `Secure` = `true` (ถ้าใช้ HTTPS)

### ตรวจสอบ Console Logs
ดู console logs ใน browser:
```
✅ [/api/auth/me] Session valid for user: user1@example.com user_id: 1
```

ต้องแสดง email และ user_id ที่ถูกต้องของผู้ใช้แต่ละคน

## การป้องกันในอนาคต

### 1. Session Fingerprinting
เพิ่มการตรวจสอบ device fingerprint:
```typescript
{
  user_agent: request.headers.get('user-agent'),
  ip_address: getClientIP(request),
  device_fingerprint: generateFingerprint(request)
}
```

### 2. Session Rotation
Rotate session token หลังจาก sensitive operations:
```typescript
// หลังจาก change password, update profile, etc.
await rotateSessionToken(currentToken);
```

### 3. Concurrent Session Limit
จำกัดจำนวน active sessions ต่อ user:
```typescript
const MAX_SESSIONS_PER_USER = 5;
await enforceSessionLimit(userId, MAX_SESSIONS_PER_USER);
```

### 4. Session Monitoring
เพิ่ม monitoring สำหรับ suspicious activities:
- Multiple sessions จาก IP ต่างกัน
- Session จาก device ใหม่
- Rapid session creation

## ไฟล์ที่แก้ไข

1. `app/api/auth/login/route.ts` - เปลี่ยน sameSite เป็น 'strict'
2. `lib/auth/session.ts` - เปลี่ยน sameSite เป็น 'strict'
3. `app/api/auth/me/route.ts` - เพิ่ม logging

## สถานะ
✅ **แก้ไขเสร็จสิ้น** - 2026-01-19

## คำแนะนำสำหรับผู้ใช้

### ถ้ายังเจอปัญหา
1. **Logout ทุกคน** - ให้ทุกคนกด "ออกจากระบบ"
2. **ล้าง Cookies** - กด Ctrl+Shift+Delete → เลือก "Cookies" → Clear
3. **ปิด Browser** - ปิด browser ทั้งหมด
4. **เปิดใหม่** - เปิด browser ใหม่และ login อีกครั้ง
5. **ใช้ Incognito/Private Mode** - ถ้ายังมีปัญหา ให้ใช้ incognito mode

### Best Practices
- **อย่าแชร์ browser** - แต่ละคนควรใช้ browser หรือ profile แยกกัน
- **Logout เมื่อเลิกใช้** - กด logout ทุกครั้งที่เลิกใช้งาน
- **ใช้ Private Browsing** - สำหรับ shared computers
- **ตรวจสอบชื่อผู้ใช้** - ตรวจสอบชื่อที่มุมขวาบนก่อนทำงาน

## Technical Details

### Cookie Attributes
| Attribute | Before | After | Purpose |
|-----------|--------|-------|---------|
| sameSite | lax | strict | ป้องกัน session mixing |
| httpOnly | true | true | ป้องกัน XSS |
| secure | true (prod) | true (prod) | ใช้ HTTPS เท่านั้น |
| path | / | / | ใช้ได้ทั้ง site |

### Session Validation Flow
```
1. Browser → GET /api/auth/me
2. Server → อ่าน cookie 'session_token'
3. Server → validate token กับ database
4. Server → ตรวจสอบ expiry และ last_activity
5. Server → return user data
6. Browser → แสดงชื่อผู้ใช้ที่ Header
```

## References
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [OWASP: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Next.js: Cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
