-- Migration: Normalize roles in public.profiles
-- Purpose: Trim whitespace and lowercase existing values in the `role` column
-- Idempotent: safe to run multiple times

BEGIN;

-- Only run if the column exists (safe-guard for environments where migration 006 hasn't been applied)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') > 0 THEN

    -- Trim and lowercase any non-null role values
    UPDATE public.profiles
    SET role = lower(trim(role))
    WHERE role IS NOT NULL AND role <> lower(trim(role));

  END IF;
END$$;

COMMIT;
