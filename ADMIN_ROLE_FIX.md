Run these SQL commands in your Supabase SQL editor to normalize role values in the profiles table.

-- Trim role for a single user (replace the email):
-- UPDATE public.profiles SET role = trim(role) WHERE email = 'phuccao03738@gmail.com';

-- Trim and lowercase role for all rows (safe, idempotent):
-- UPDATE public.profiles SET role = lower(trim(role)) WHERE role IS NOT NULL;

-- Optional: verify results
-- SELECT id, email, role FROM public.profiles WHERE role ILIKE '%admin%';

If you prefer, you can call the backend admin endpoint POST /admin/set-role with the correct ADMIN_API_KEY to set a specific user's role to 'admin'.
