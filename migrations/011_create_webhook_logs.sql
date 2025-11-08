-- Migration: create webhook_logs table for persistent webhook recording
-- Run this migration with your usual workflow (psql or supabase migrations)

CREATE TABLE IF NOT EXISTS webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT,
  provider_event_id TEXT,
  headers JSONB,
  raw_payload JSONB,
  verified BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
