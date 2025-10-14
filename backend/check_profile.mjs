import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const email = process.argv[2] || 'phuccao03738@gmail.com';

(async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('id, email, role').eq('email', email).limit(1).single();
    if (error) {
      console.error('Query error', error.message || error);
      process.exit(2);
    }
    if (!data) {
      console.log('No profile found for', email);
      process.exit(0);
    }
    console.log('Profile row:', data);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error', err.message || err);
    process.exit(3);
  }
})();
