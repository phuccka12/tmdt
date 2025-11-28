-- Migration 013: add cancellation metadata to orders
-- Adds columns to record when/why/by whom an order was cancelled
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid NULL;

-- No backfill is performed here; new orders will populate these fields when cancelled.
-- If you want to backfill historic cancellations, run an UPDATE statement as needed.
