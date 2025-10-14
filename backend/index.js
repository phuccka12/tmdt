const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || null; // optional server-only key

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[backend] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

function requireAdminApiKey(req, res, next) {
  // Require ADMIN_API_KEY to be set in the server environment for admin endpoints.
  // This avoids accidentally exposing admin endpoints when the key isn't configured.
  const key = req.headers['x-admin-api-key'] || req.query.admin_key;
  if (!ADMIN_API_KEY) {
    console.error('[backend] ADMIN_API_KEY is not configured - admin endpoints are disabled');
    return res.status(503).json({ error: 'Admin API key not configured on server' });
  }

  if (key && key === ADMIN_API_KEY) return next();

  return res.status(403).json({ error: 'Forbidden' });
}

// Admin: set role for a user
app.post('/admin/set-role', requireAdminApiKey, async (req, res) => {
  const { user_id, role } = req.body;
  if (!user_id || !role) return res.status(400).json({ error: 'user_id and role required' });

  try {
    const { error } = await supabase.from('profiles').upsert({ id: user_id, role }, { onConflict: 'id' });
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: list products (simple proxy to supabase)
app.get('/admin/products', requireAdminApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true }).limit(100);
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: create or update product (upsert)
app.post('/admin/products', requireAdminApiKey, async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.id) return res.status(400).json({ error: 'product payload with id required' });
  try {
    const { data, error } = await supabase.from('products').upsert(payload).select();
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: delete product
app.delete('/admin/products/:id', requireAdminApiKey, async (req, res) => {
  const id = req.params.id;
  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

const port = process.env.PORT || 54321;
app.listen(port, () => console.log(`[backend] admin server listening on ${port}`));
