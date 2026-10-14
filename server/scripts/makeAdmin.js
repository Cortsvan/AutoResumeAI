import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !email.includes('@')) {
  console.error('\n❌ Usage: node server/scripts/makeAdmin.js <user-email>');
  console.error('Example: node server/scripts/makeAdmin.js admin@example.com\n');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\n❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log(`\n🔍 Looking up user account for "${email}" in Supabase...`);

  // 1. Check profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  let targetUserId = profile?.id;

  // 2. If not found in profiles, check auth.users directly
  if (!targetUserId) {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error('❌ Could not query auth.users:', usersError.message);
      process.exit(1);
    }
    const matching = usersData.users.find((u) => u.email?.toLowerCase() === email);
    if (!matching) {
      console.error(`\n❌ User "${email}" was not found in registered accounts.`);
      console.error('👉 Please sign up on the AutoResumeAI website first with this email address,');
      console.error('   then run this command again to grant administrator privileges.\n');
      process.exit(1);
    }
    targetUserId = matching.id;

    // Insert profile
    await supabase.from('profiles').upsert({
      id: targetUserId,
      email: matching.email,
      role: 'admin',
      is_unlimited: true,
      account_status: 'active',
    });
  } else {
    // Update existing profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        is_unlimited: true,
        account_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('❌ Failed to update user profile:', updateError.message);
      process.exit(1);
    }
  }

  // 3. Write audit log
  await supabase.from('admin_audit_logs').insert({
    admin_id: targetUserId,
    admin_email: email,
    target_user_id: targetUserId,
    target_user_email: email,
    action: 'PROMOTE_TO_ADMIN',
    details: { promotedVia: 'cli_make_admin_script' },
  });

  console.log('\n======================================================');
  console.log(`🎉 SUCCESS: ${email} is now an Administrator!`);
  console.log('   - Role: admin');
  console.log('   - AI Access: Unlimited personal AI usage');
  console.log('   - Admin Dashboard: Access enabled at /#/admin');
  console.log('   - Spending Guard: Still active ($4 threshold protection)');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
