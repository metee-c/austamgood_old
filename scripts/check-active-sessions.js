const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActiveSessions() {
  console.log('🔍 Checking active sessions...\n');

  try {
    // Get all active sessions
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select(`
        session_id,
        user_id,
        created_at,
        last_activity_at,
        expired_at,
        invalidated,
        ip_address,
        user_agent
      `)
      .eq('invalidated', false)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No active sessions found');
      return;
    }

    console.log(`📊 Found ${sessions.length} active sessions\n`);

    // Get user info separately
    const userIds = [...new Set(sessions.map(s => s.user_id))];
    const { data: users } = await supabase
      .from('master_system_user')
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    const userMap = {};
    (users || []).forEach(user => {
      userMap[user.user_id] = user;
    });

    // Group by user
    const sessionsByUser = {};
    sessions.forEach(session => {
      const user = userMap[session.user_id];
      
      if (!sessionsByUser[session.user_id]) {
        sessionsByUser[session.user_id] = {
          email: user?.email || 'Unknown',
          fullName: user?.full_name || 'Unknown',
          sessions: []
        };
      }
      
      sessionsByUser[session.user_id].sessions.push(session);
    });

    // Display sessions by user
    Object.entries(sessionsByUser).forEach(([userId, userData]) => {
      console.log(`👤 User: ${userData.fullName} (${userData.email})`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Active Sessions: ${userData.sessions.length}`);
      
      userData.sessions.forEach((session, index) => {
        const lastActivity = new Date(session.last_activity_at);
        const minutesAgo = Math.floor((Date.now() - lastActivity.getTime()) / 60000);
        const expiredAt = new Date(session.expired_at);
        const hoursUntilExpiry = Math.floor((expiredAt.getTime() - Date.now()) / 3600000);
        
        console.log(`\n   Session ${index + 1}:`);
        console.log(`   - Session ID: ${session.session_id}`);
        console.log(`   - Created: ${new Date(session.created_at).toLocaleString('th-TH')}`);
        console.log(`   - Last Activity: ${minutesAgo} minutes ago`);
        console.log(`   - Expires: in ${hoursUntilExpiry} hours`);
        console.log(`   - IP: ${session.ip_address || 'N/A'}`);
        console.log(`   - User Agent: ${session.user_agent?.substring(0, 50) || 'N/A'}...`);
      });
      
      console.log('\n' + '='.repeat(80) + '\n');
    });

    // Summary
    console.log('📈 Summary:');
    console.log(`   Total Users: ${Object.keys(sessionsByUser).length}`);
    console.log(`   Total Active Sessions: ${sessions.length}`);
    console.log(`   Average Sessions per User: ${(sessions.length / Object.keys(sessionsByUser).length).toFixed(1)}`);

    // Check for potential issues
    console.log('\n⚠️  Potential Issues:');
    let issuesFound = false;

    Object.entries(sessionsByUser).forEach(([userId, userData]) => {
      if (userData.sessions.length > 3) {
        console.log(`   - User ${userData.email} has ${userData.sessions.length} active sessions (suspicious)`);
        issuesFound = true;
      }

      // Check for sessions from different IPs
      const ips = new Set(userData.sessions.map(s => s.ip_address).filter(Boolean));
      if (ips.size > 1) {
        console.log(`   - User ${userData.email} has sessions from ${ips.size} different IPs`);
        issuesFound = true;
      }
    });

    if (!issuesFound) {
      console.log('   None detected');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkActiveSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
