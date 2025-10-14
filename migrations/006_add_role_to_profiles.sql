-- Migration: add role column to profiles for RBAC
BEGIN;

-- Add a role column to profiles to store user role (e.g., 'user', 'admin')
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Allow SELECT role for authenticated users when reading their own profile
CREATE POLICY IF NOT EXISTS "Profiles: select role for authenticated" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR auth.role() = 'service_role');

-- Optional index for faster lookups by role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

COMMIT;

/*
Usage: run this SQL in your Supabase SQL editor or with psql. It will add a `role` column
to the `profiles` table with default 'user'. Administrators can update this value to 'admin'.
*/
