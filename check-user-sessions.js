require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserSessions() {
  console.log('🔍 Checking active user sessions...\n');

  // Get all active sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('user_sessions')
    .select(`
      session_id,
      user_id,
      token,
      invalidated,
      created_at,
      last_activity_at,
      master_system_user!user_sessions_user_id_fkey(
        user_id,
        username,
        employee_id
      )
    `)
    .eq('invalidated', false)
    .order('last_activity_at', { ascending: false });

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    return;
  }

  console.log(`Found ${sessions.length} active sessions\n`);

  let withEmployee = 0;
  let withoutEmployee = 0;

  for (const session of sessions) {
    const user = session.master_system_user;
    const employeeId = user?.employee_id;
    const lastActivity = new Date(session.last_activity_at).toLocaleString('th-TH');

    if (employeeId) {
      console.log(`✅ ${user.username} (user_id: ${user.user_id}) → employee_id: ${employeeId} | Last: ${lastActivity}`);
      withEmployee++;
    } else {
      console.log(`❌ ${user.username} (user_id: ${user.user_id}) → NO employee_id | Last: ${lastActivity}`);
      withoutEmployee++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   With employee_id: ${withEmployee}`);
  console.log(`   Without employee_id: ${withoutEmployee}`);

  if (withoutEmployee > 0) {
    console.log(`\n⚠️  ${withoutEmployee} active sessions have NO employee_id!`);
    console.log(`   These users CANNOT create move items.`);
    console.log(`\n💡 Solution: Assign employee_id to these users in master_system_user table.`);
  }
}

checkUserSessions().catch(console.error);
