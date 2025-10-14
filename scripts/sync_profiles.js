// Sync profiles from Supabase Admin API into public.profiles
// Usage: node scripts/sync_profiles.js

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listAllUsers() {
  const perPage = 100;
  let page = 1;
  let all = [];
  while (true) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users = res.data?.users ?? res.data ?? [];
    if (!users || users.length === 0) break;
    all = all.concat(users);
    if (users.length < perPage) break;
    page++;
  }
  return all;
}

(async () => {
  try {
    console.log('Fetching users via admin API...');
    const users = await listAllUsers();
    console.log(`Fetched ${users.length} users`);

    for (const u of users) {
      const id = u.id;
      const full_name = (u.user_metadata && u.user_metadata.full_name) ? u.user_metadata.full_name : null;
      const role = (u.user_metadata && u.user_metadata.role) ? u.user_metadata.role : 'user';
      const email = u.email || null;

      const { error: upErr } = await supabase.from('profiles').upsert({ id, full_name, email, role }, { onConflict: 'id' });
      if (upErr) console.error('Upsert error for', id, upErr.message || upErr);
      else console.log('Upserted profile for', id);
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed', err);
    process.exit(1);
  }
})();
