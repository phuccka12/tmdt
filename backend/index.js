const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load backend/.env explicitly so server works even when started from repo root
dotenv.config({ path: path.resolve(__dirname, '.env') });

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

// Admin: list profiles (basic info)
app.get('/admin/profiles', requireAdminApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('id,full_name,email,role,updated_at').order('updated_at', { ascending: false }).limit(1000);
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: monthly reports (income/estimate) based on cart rows
app.get('/admin/reports/monthly', requireAdminApiKey, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1); // 1-12

    // compute start/end in ISO
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();

    // fetch cart rows within timeframe and embed variant + product
    const { data, error } = await supabase
      .from('cart')
      .select(`id,quantity,created_at,variant:product_variants(id,price_vnd,product:products(id,name,price))`)
      .gte('created_at', start)
      .lt('created_at', end);

    if (error) return res.status(500).json({ error: error.message || error });

    const rows = data || [];

    // Helper to parse product.price string like "1.299.000đ"
    const parsePrice = (p) => {
      if (!p) return 0;
      if (typeof p === 'number') return p;
      try {
        return Number(String(p).replace(/[^\d]/g, '')) || 0;
      } catch (e) { return 0; }
    };

    // Aggregate totals and per-day breakdown
    const totals = { revenue: 0, items: 0 };
    const byDay = {}; // YYYY-MM-DD -> { revenue, items }

    for (const r of rows) {
      const qty = Number(r.quantity) || 0;
      const variant = r.variant || null;
      const unit = (variant && (variant.price_vnd || parsePrice(variant.product?.price))) || 0;
      const rev = unit * qty;
      totals.revenue += rev;
      totals.items += qty;

      const day = r.created_at ? new Date(r.created_at).toISOString().slice(0,10) : 'unknown';
      if (!byDay[day]) byDay[day] = { revenue: 0, items: 0 };
      byDay[day].revenue += rev;
      byDay[day].items += qty;
    }

    // format byDay as array
    const breakdown = Object.keys(byDay).sort().map(d => ({ day: d, ...byDay[d] }));

    return res.json({ ok: true, period: { year, month }, totals, breakdown, rowsCount: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

const port = process.env.PORT || 54321;
app.listen(port, () => console.log(`[backend] admin server listening on ${port}`));
