// Script to fix user permissions for specific users
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const targetUsers = [
  'Suchitra.t@buzzpetsfood.com',
  'Thunwa.l@buzzpetsfood.com', 
  'thanyarat.p@buzzpetsfood.com'
];

async function fixUserPermissions() {
  try {
    console.log('🔧 Starting to fix user permissions...');
    
    // Step 1: Get metee's user info and role as reference
    console.log('\n📋 Getting reference user (metee.c@buzzpetsfood.com)...');
    const { data: meteeUser, error: meteeError } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        username,
        email,
        role_id,
        master_system_role!fk_master_system_user_role (
          role_name
        )
      `)
      .eq('email', 'metee.c@buzzpetsfood.com')
      .single();
    
    if (meteeError || !meteeUser) {
      console.error('❌ Could not find metee user:', meteeError);
      return;
    }
    
    console.log('✅ Reference user found:', {
      user_id: meteeUser.user_id,
      email: meteeUser.email,
      role_id: meteeUser.role_id,
      role_name: meteeUser.master_system_role?.role_name
    });
    
    // Step 2: Get all permissions for metee's role
    console.log('\n📋 Getting permissions for reference role...');
    const { data: meteePermissions, error: permError } = await supabase
      .from('role_permission')
      .select(`
        module_id,
        can_view,
        can_create,
        can_edit,
        can_delete
      `)
      .eq('role_id', meteeUser.role_id);
    
    if (permError) {
      console.error('❌ Error getting metee permissions:', permError);
      return;
    }
    
    console.log(`✅ Found ${meteePermissions?.length || 0} permissions for reference role`);
    
    // Step 3: Process each target user
    for (const email of targetUsers) {
      console.log(`\n👤 Processing user: ${email}`);
      
      // Get user info
      const { data: user, error: userError } = await supabase
        .from('master_system_user')
        .select(`
          user_id,
          username,
          email,
          role_id,
          is_active,
          master_system_role!fk_master_system_user_role (
            role_name
          )
        `)
        .eq('email', email)
        .single();
      
      if (userError || !user) {
        console.error(`❌ User not found: ${email}`, userError);
        continue;
      }
      
      console.log(`✅ User found:`, {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.master_system_role?.role_name,
        is_active: user.is_active
      });
      
      // If user has same role as metee, permissions should be the same
      if (user.role_id === meteeUser.role_id) {
        console.log(`✅ User already has same role as metee (${meteeUser.master_system_role?.role_name})`);
        console.log('   Permissions should be identical');
      } else {
        console.log(`⚠️  User has different role (${user.master_system_role?.role_name})`);
        
        // Get current permissions for this user's role
        const { data: currentPerms, error: currentPermError } = await supabase
          .from('role_permission')
          .select(`
            module_id,
            can_view,
            can_create,
            can_edit,
            can_delete
          `)
          .eq('role_id', user.role_id);
        
        if (!currentPermError && currentPerms) {
          console.log(`   Current permissions: ${currentPerms.length} modules`);
          
          // Compare with metee's permissions
          const missingPerms = meteePermissions.filter(meteePerm => 
            !currentPerms.some(currentPerm => currentPerm.module_id === meteePerm.module_id)
          );
          
          if (missingPerms.length > 0) {
            console.log(`   ❌ Missing ${missingPerms.length} permissions compared to metee`);
            console.log('   Missing modules:', missingPerms.map(p => p.module_id));
          } else {
            console.log(`   ✅ Has same number of permissions as metee`);
          }
        }
      }
      
      // Option 1: Update user to have same role as metee
      console.log(`\n🔧 Option 1: Update role to match metee...`);
      const { error: updateError } = await supabase
        .from('master_system_user')
        .update({ role_id: meteeUser.role_id })
        .eq('user_id', user.user_id);
      
      if (updateError) {
        console.error(`❌ Error updating role for ${email}:`, updateError);
      } else {
        console.log(`✅ Updated role for ${email} to match metee`);
      }
    }
    
    // Step 4: Verify results
    console.log('\n🔍 Verifying results...');
    for (const email of targetUsers) {
      const { data: finalUser, error: finalError } = await supabase
        .from('master_system_user')
        .select(`
          user_id,
          email,
          role_id,
          master_system_role!fk_master_system_user_role (
            role_name
          )
        `)
        .eq('email', email)
        .single();
      
      if (!finalError && finalUser) {
        const { data: finalPerms } = await supabase
          .from('role_permission')
          .select('module_id')
          .eq('role_id', finalUser.role_id);
        
        console.log(`✅ ${email}: ${finalUser.master_system_role?.role_name} (${finalPerms?.length || 0} permissions)`);
      }
    }
    
    console.log('\n✅ Permission fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing permissions:', error);
  }
}

// Run the script
fixUserPermissions();
