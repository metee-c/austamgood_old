require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseSessionMixing() {
  console.log('\n🔍 วิเคราะห์ปัญหา Session Mixing บน Vercel\n');
  console.log('='.repeat(80));
  
  // 1. ตรวจสอบ JWT_SECRET
  console.log('\n📌 1. ตรวจสอบ JWT_SECRET:');
  console.log('-'.repeat(80));
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
    console.log('❌ JWT_SECRET ไม่ได้ตั้งค่าหรือใช้ค่า default');
    console.log('   → ต้องตั้งค่า JWT_SECRET ที่ Vercel Environment Variables');
  } else {
    console.log('✅ JWT_SECRET ถูกตั้งค่าแล้ว');
    console.log(`   Length: ${jwtSecret.length} characters`);
  }
  
  // 2. ตรวจสอบ Active Users
  console.log('\n📌 2. ตรวจสอบผู้ใช้ที่ล็อกอินอยู่:');
  console.log('-'.repeat(80));
  
  const { data: users, error: usersError } = await supabase
    .from('master_system_user')
    .select('user_id, username, email, full_name, last_login')
    .eq('is_active', true)
    .not('last_login', 'is', null)
    .order('last_login', { ascending: false })
    .limit(10);
  
  if (usersError) {
    console.log('❌ Error:', usersError.message);
  } else if (users && users.length > 0) {
    console.log(`✅ พบผู้ใช้ที่ล็อกอินล่าสุด ${users.length} คน:`);
    users.forEach((user, index) => {
      const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('th-TH') : 'N/A';
      console.log(`   ${index + 1}. ${user.full_name} (${user.email}) - Last Login: ${lastLogin}`);
    });
  }
  
  // 3. สรุปปัญหาที่เป็นไปได้
  console.log('\n📌 3. สาเหตุที่เป็นไปได้:');
  console.log('-'.repeat(80));
  console.log(`
❌ ปัญหา: Cookie Sharing / Session Mixing บน Vercel

🔍 สาเหตุที่เป็นไปได้:

1. **Cookie Domain ไม่ถูกต้อง**
   - Cookie ถูกตั้งค่าให้ share ข้ามทุก subdomain
   - ควรตั้ง domain เป็น undefined หรือ specific domain

2. **Cookie SameSite ไม่เหมาะสม**
   - ปัจจุบันใช้ 'lax' ซึ่งอาจทำให้ cookie ถูก share
   - ควรเปลี่ยนเป็น 'strict' หรือ 'none' (ถ้าใช้ HTTPS)

3. **JWT Token ไม่มี User-Specific Data**
   - Token อาจไม่มีข้อมูลที่ unique พอ
   - ควรเพิ่ม timestamp, random nonce, หรือ session_id

4. **Vercel Edge Caching**
   - Vercel อาจ cache response ที่มี Set-Cookie header
   - ต้องตั้งค่า Cache-Control ให้ถูกต้อง

5. **Browser Cache**
   - Browser อาจ cache cookie ระหว่าง users
   - ต้อง clear cookie เมื่อ logout

📋 วิธีแก้ไข:

1. ✅ เปลี่ยน Cookie SameSite เป็น 'strict'
2. ✅ เพิ่ม unique identifier ใน JWT token
3. ✅ ตั้งค่า Cache-Control headers ให้ถูกต้อง
4. ✅ เพิ่ม user_id + timestamp ใน cookie name
5. ✅ ใช้ HttpOnly + Secure cookies
6. ✅ Clear cookie เมื่อ logout
7. ✅ ตรวจสอบ JWT token ทุกครั้งที่ใช้งาน
  `);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 สรุป');
  console.log('='.repeat(80));
  console.log(`
⚠️  ปัญหานี้ร้ายแรงมาก - ต้องแก้ไขทันที!

🔧 ขั้นตอนการแก้ไข:
1. แก้ไข cookie settings ใน login API
2. เพิ่ม unique identifier ใน JWT
3. ตั้งค่า Cache-Control headers
4. ทดสอบบน Vercel ด้วย multiple users

📝 ไฟล์ที่ต้องแก้ไข:
- app/api/auth/login/route.ts
- lib/auth/simple-auth.ts
- app/api/auth/me/route.ts
- middleware.ts (ถ้ามี)
  `);
}

diagnoseSessionMixing().catch(console.error);
