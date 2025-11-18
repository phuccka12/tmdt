-- 012_add_processed_to_orders.sql
-- Add a boolean `processed` column to orders to track whether an order was handled by staff.
-- This migration is idempotent (uses IF NOT EXISTS) so it can be re-run safely.

BEGIN;

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Ensure existing rows have a deterministic value
UPDATE orders SET processed = false WHERE processed IS NULL;

COMMIT;

-- To apply locally with psql:
-- psql "postgres://<user>:<pass>@<host>:<port>/<db>" -f migrations/012_add_processed_to_orders.sql

-- If you use the Supabase CLI (recommended for Supabase projects):
-- 1) Install: npm install -g supabase
-- 2) Run the migration (adjust current directory):
--    supabase db remote set <YOUR_DB_URL>
--    psql "<YOUR_DB_URL>" -f migrations/012_add_processed_to_orders.sql

-- Note: Applying migrations requires access to your project's database. If you want I can
-- generate a matching rollback migration or a SQL file to remove the column.
