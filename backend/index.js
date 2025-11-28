const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');


dotenv.config({ path: path.resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
// Global error handlers to surface uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (err) => {
  console.error('[backend] Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('[backend] Unhandled Rejection at:', p, 'reason:', reason && reason.stack ? reason.stack : reason);
});
try {
  if (!fetchFn) fetchFn = require('node-fetch');
} catch (e) {
  // node-fetch not installed or cannot be required; if global fetch missing, password updates will fail later with clear error
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || null; // optional server-only key

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[backend] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// bucket used for product images
const PRODUCT_BUCKET = 'product-images';

const app = express();
app.use(cors());
// Allow larger JSON payloads (we accept base64 image uploads from frontend)
app.use(express.json({ limit: '30mb' }));
// Also accept URL-encoded bodies up to same limit
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// Public: submit a product review (server-side enforcement that user purchased product)
// The client must forward the user's access token in the Authorization header: `Authorization: Bearer <access_token>`
app.post('/reviews', express.json(), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authorization required' });

    // Resolve fetch implementation (node 18 has global fetch, otherwise use fetchFn if available)
    const fetchImpl = (typeof fetch === 'function') ? fetch : (typeof fetchFn === 'function' ? fetchFn : null);
    if (!fetchImpl) {
      console.error('[backend] no fetch implementation available to validate user token');
      return res.status(500).json({ error: 'Server missing fetch implementation' });
    }

    // Get user info from Supabase auth endpoint using the provided access token
    const authUrl = (SUPABASE_URL || '').replace(/\/$/, '') + '/auth/v1/user';
    const userResp = await fetchImpl(authUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY || '',
      },
    });

    if (!userResp.ok) {
      const text = await userResp.text().catch(() => '');
      console.warn('[backend] token validation failed', userResp.status, text);
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const userJson = await userResp.json();
    const userId = (userJson && (userJson.id || (userJson.user && userJson.user.id))) || null;
    if (!userId) return res.status(401).json({ error: 'Unable to determine user from token' });

    const { product_id, rating, title, content } = req.body || {};
    if (!product_id || !rating) return res.status(400).json({ error: 'product_id and rating required' });

    // Check whether this user has a PAID order containing this product
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id,status,order_items(product_id),payments(status)')
      .eq('user_id', userId)
      .limit(200);

    if (ordersError) {
      console.error('[backend] orders lookup failed for user', userId, ordersError);
      return res.status(500).json({ error: 'Failed to verify orders for user' });
    }

    const orders = ordersData || [];
    const hasPurchased = orders.some((o) => {
      const items = o.order_items || [];
      const includesProduct = items.some((it) => Number(it.product_id) === Number(product_id));
      const paidStatus = (o.status && String(o.status).toLowerCase() === 'paid') || (o.payments || []).some((p) => {
        const s = String(p.status || '').toLowerCase();
        return s === 'success' || s === 'completed' || s === 'paid';
      });
      return includesProduct && paidStatus;
    });

    if (!hasPurchased) {
      return res.status(403).json({ error: 'User has not purchased this product' });
    }

    // Insert review using service role key (server-side safe)
    const insertPayload = {
      product_id: product_id,
      user_id: userId,
      rating: rating,
      title: title || null,
      content: content || null,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase.from('product_reviews').insert(insertPayload).select();
    if (insertErr) {
      console.error('[backend] failed to insert product_review', insertErr);
      // If schema missing 'approved' or other columns, surface a helpful message
      return res.status(500).json({ error: insertErr.message || insertErr });
    }

    return res.json({ data: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (err) {
    console.error('[backend] /reviews error', err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Mount payment routes
try {
  const paymentsRouter = require('./routes/payments');
  // mount at /payments so routes defined inside file map to /payments/*
  app.use('/payments', paymentsRouter);
} catch (e) {
  console.warn('[backend] failed to mount payments routes', e && e.message);
}

// Mount webhook route
let webhookModule = null;
try {
  // the module exports the register function as default and processPaypalEvent helper
  webhookModule = require('./routes/webhook_paypal');
  if (typeof webhookModule === 'function') webhookModule(app, supabase);
} catch (e) {
  console.warn('[backend] failed to mount paypal webhook route', e && e.message);
}

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

// Admin: list webhook logs
app.get('/admin/webhooks', requireAdminApiKey, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const { data, error } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: get single webhook log by id
app.get('/admin/webhooks/:id', requireAdminApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const { data, error } = await supabase.from('webhook_logs').select('*').eq('id', id).limit(1).single();
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Temporary debug endpoint to check admin key presence on the running server.
// This is only enabled when NODE_ENV !== 'production' to avoid accidental exposure.
if (process.env.NODE_ENV !== 'production') {
  app.get('/admin/_debug', async (req, res) => {
    try {
      return res.json({ ok: true, hasAdminKey: !!ADMIN_API_KEY, adminKeyLength: ADMIN_API_KEY ? ADMIN_API_KEY.length : 0, nodeEnv: process.env.NODE_ENV || 'undefined' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  });
}

// Dev-only: simulate a PayPal webhook by inserting a webhook_log and invoking processor
if (process.env.NODE_ENV !== 'production') {
  app.post('/admin/webhooks/simulate', requireAdminApiKey, express.json(), async (req, res) => {
    try {
      const payload = req.body || {};
      const event = payload.event || {};
      // minimal validation
      if (!event || !event.event_type) return res.status(400).json({ error: 'missing event.event_type' });
      if (!webhookModule || typeof webhookModule.processPaypalEvent !== 'function') return res.status(500).json({ error: 'webhook processor unavailable' });

      // insert into webhook_logs
      const insertPayload = {
        provider: 'paypal',
        event_type: event.event_type,
        provider_event_id: event.resource && (event.resource.id || null) || null,
        headers: {},
        raw_payload: event,
        verified: true,
        processed: false,
        processing_error: null,
        created_at: new Date().toISOString()
      };

      const { data: inserted, error: insertErr } = await supabase.from('webhook_logs').insert(insertPayload).select().limit(1).single();
      if (insertErr) return res.status(500).json({ error: insertErr.message || insertErr });

      // call processor
      const result = await webhookModule.processPaypalEvent(supabase, event, inserted);
      return res.json({ ok: true, inserted, result });
    } catch (e) {
      console.error('[admin] simulate webhook error', e);
      return res.status(500).json({ error: e && e.message ? e.message : String(e) });
    }
  });
}

// Admin: reprocess a stored webhook log (replay processing). Protected by ADMIN_API_KEY.
app.post('/admin/webhooks/:id/reprocess', requireAdminApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    const { data: logRow, error: fetchErr } = await supabase.from('webhook_logs').select('*').eq('id', id).limit(1).single();
    if (fetchErr || !logRow) return res.status(404).json({ error: 'webhook log not found', details: fetchErr ? fetchErr.message || fetchErr : null });

    if (!webhookModule || typeof webhookModule.processPaypalEvent !== 'function') {
      return res.status(500).json({ error: 'webhook processing helper not available on server' });
    }

    // raw_payload stored as JSONB; pass it to processor
    const event = logRow.raw_payload || {};
    try {
      const result = await webhookModule.processPaypalEvent(supabase, event, logRow);
      return res.json({ ok: true, result });
    } catch (e) {
      // update processing_error on failure
      try { await supabase.from('webhook_logs').update({ processing_error: String(e && e.message ? e.message : e) }).eq('id', id); } catch (u) {}
      return res.status(500).json({ error: e && e.message ? e.message : String(e) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: create or update product (upsert)
app.post('/admin/products', requireAdminApiKey, async (req, res) => {
  const payload = req.body || {};
  // basic validation
  if (!payload || !payload.name) return res.status(400).json({ error: 'product payload with name required' });

  try {
    let result;
    if (payload.id) {
      // upsert when id provided (update or create)
      result = await supabase.from('products').upsert(payload).select();
    } else {
      // insert new product and return the created row (id generated by DB)
      result = await supabase.from('products').insert(payload).select();
    }

    const { data, error } = result;
    if (error) {
      // Log full error details to help diagnose RLS / policy issues
      console.error('[backend] supabase products insert/upsert error', {
        message: error.message || error,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
        table: 'products',
        payload
      });
      return res.status(500).json({ error: error.message || error, details: error.details || null, code: error.code || null });
    }
    return res.json({ data });
  } catch (err) {
    console.error('[backend] unexpected error in /admin/products', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// upload ảnh
app.post('/admin/upload-image', requireAdminApiKey, async (req, res, next) => {

  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/octet-stream')) {
    return next();
  }

  // default JSON handling (base64)
  try {
    const { fileName, fileBase64 } = req.body || {};
    if (!fileName || !fileBase64) return res.status(400).json({ error: 'fileName and fileBase64 required' });

    const buffer = Buffer.from(fileBase64, 'base64');
    const filePath = `${Date.now()}_${fileName}`;
    console.log('[backend] uploading image to storage (json)', { bucket: PRODUCT_BUCKET, filePath, size: buffer.length });

    const { error: uploadErr } = await supabase.storage.from(PRODUCT_BUCKET).upload(filePath, buffer, { cacheControl: '3600', upsert: false });
    if (uploadErr) {
      console.error('[backend] storage.upload error', uploadErr);
      return res.status(500).json({ error: uploadErr.message || uploadErr, details: uploadErr.details || null });
    }

    const { data: pub } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl || null;
    return res.json({ publicUrl });
  } catch (err) {
    console.error('[backend] /admin/upload-image error (json)', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Raw octet-stream handler for large files
app.post('/admin/upload-image', requireAdminApiKey, express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  try {
    const fileName = req.headers['x-file-name'] || req.query.fileName;
    if (!fileName) return res.status(400).json({ error: 'x-file-name header or fileName query required' });
    const buffer = Buffer.from(req.body);
    const filePath = `${Date.now()}_${String(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    console.log('[backend] uploading image to storage (octet-stream)', { bucket: PRODUCT_BUCKET, filePath, size: buffer.length });

    const { error: uploadErr } = await supabase.storage.from(PRODUCT_BUCKET).upload(filePath, buffer, { cacheControl: '3600', upsert: false });
    if (uploadErr) {
      console.error('[backend] storage.upload error (octet-stream)', uploadErr);
      return res.status(500).json({ error: uploadErr.message || uploadErr, details: uploadErr.details || null });
    }

    const { data: pub } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl || null;
    return res.json({ publicUrl });
  } catch (err) {
    console.error('[backend] /admin/upload-image error (octet)', err);
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

// Admin: list orders 
app.get('/admin/orders', requireAdminApiKey, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, status, created_at, user_id, order_items(id, product_id, quantity, unit_price)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ordersError) return res.status(500).json({ error: ordersError.message || ordersError });

    const orders = ordersData || [];

    // Collect user ids and fetch profiles in one query
    const userIds = Array.from(new Set(orders.map(o => o.user_id).filter(Boolean)));
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
      if (!profilesError && Array.isArray(profiles)) {
        profilesMap = profiles.reduce((m, p) => { m[p.id] = p; return m; }, {});
      }
    }

    // Attach profile object to each order for convenience
    const result = orders.map(o => ({ ...o, profile: (o.user_id ? profilesMap[o.user_id] : null) || null }));

    return res.json({ data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: update order 
app.put('/admin/orders/:id', requireAdminApiKey, express.json(), async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const payload = req.body || {};
    // only allow updating a subset of fields
    const allowed = ['status', 'processing_error', 'processed'];
    const toUpdate = {};
    // If the client sent `processed` but the DB doesn't have that column, avoid trying to update it
    const wantsProcessed = Object.prototype.hasOwnProperty.call(payload, 'processed');

    // helper: check whether a column exists by attempting a select of that column
    const columnExists = async (table, column) => {
      try {
        const { data, error } = await supabase.from(table).select(column).limit(1);
        if (error) return false;
        return true;
      } catch (e) {
        return false;
      }
    };

    // build toUpdate but skip processed until we confirm it exists
    for (const k of allowed) {
      if (k === 'processed') continue; // handled below
      if (k in payload) toUpdate[k] = payload[k];
    }

    if (wantsProcessed) {
      const exists = await columnExists('orders', 'processed');
      if (exists) {
        toUpdate.processed = payload.processed;
      } else {
        // If the only provided updatable field is `processed` and it's missing in DB, return a clear error
        if (Object.keys(toUpdate).length === 0) {
          return res.status(400).json({ error: "Server database schema missing 'processed' column on orders. Run migrations or remove the 'processed' field from the request." });
        }
        // otherwise, ignore processed silently (we still update other fields)
        console.warn('[backend] client asked to update `processed` but orders.processed column not found in DB; skipping that field');
      }
    }

    if (Object.keys(toUpdate).length === 0) return res.status(400).json({ error: 'no updatable fields provided' });

    const { data, error } = await supabase.from('orders').update(toUpdate).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Allow order cancellation by owner (with Bearer token) or by admin (with admin API key)
// POST /orders/:id/cancel
app.post('/orders/:id/cancel', express.json(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    const reason = req.body && req.body.reason ? String(req.body.reason).slice(0, 1000) : null;

    // Determine caller: admin by admin key OR user via token
    const key = req.headers['x-admin-api-key'] || req.query.admin_key;
    let callerIsAdmin = false;
    let callerUserId = null;
    if (ADMIN_API_KEY && key && key === ADMIN_API_KEY) {
      callerIsAdmin = true;
    } else {
      // validate bearer token
      const authHeader = req.headers.authorization || '';
      const token = (authHeader || '').split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Authorization required' });

      const fetchImpl = (typeof fetch === 'function') ? fetch : (typeof fetchFn === 'function' ? fetchFn : null);
      if (!fetchImpl) return res.status(500).json({ error: 'Server missing fetch implementation for token validation' });
      const authUrl = (SUPABASE_URL || '').replace(/\/$/, '') + '/auth/v1/user';
      const userResp = await fetchImpl(authUrl, { method: 'GET', headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_ROLE_KEY || '' } });
      if (!userResp.ok) return res.status(401).json({ error: 'Invalid or expired token' });
      const userJson = await userResp.json();
      callerUserId = userJson.id || (userJson.user && userJson.user.id) || null;
      if (!callerUserId) return res.status(401).json({ error: 'Unable to determine user from token' });
    }

    // load order
    const { data: orderData, error: orderErr } = await supabase.from('orders').select('*').eq('id', id).limit(1).single();
    if (orderErr || !orderData) return res.status(404).json({ error: 'Order not found' });
    const order = orderData;

    // permission: owner or admin
    if (!callerIsAdmin && String(order.user_id) !== String(callerUserId)) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }

    // Check cancelable state
    const status = String(order.status || '').toLowerCase();
    const nonCancelable = ['paid', 'confirmed', 'shipped', 'cancelled'];
    if (nonCancelable.includes(status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }
    // Check processed flag if present
    if (Object.prototype.hasOwnProperty.call(order, 'processed') && order.processed === true) {
      return res.status(400).json({ error: 'Order already processed/approved; cannot cancel' });
    }

    const updatePayload = { status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason };
    if (!callerIsAdmin) updatePayload.cancelled_by = callerUserId;

    const { data: updated, error: updateErr } = await supabase.from('orders').update(updatePayload).eq('id', id).select();
    if (updateErr) return res.status(500).json({ error: updateErr.message || updateErr });
    return res.json({ data: updated });
  } catch (e) {
    console.error('[backend] /orders/:id/cancel error', e);
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// Admin: get product variants
app.get('/admin/products/:id/variants', requireAdminApiKey, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { data, error } = await supabase.from('product_variants').select('*').eq('product_id', productId).order('id');
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data: data || [] });
  } catch (err) {
    console.error('[backend] GET /admin/products/:id/variants error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: save product variants
app.post('/admin/products/:id/variants', requireAdminApiKey, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { variants } = req.body; // array of {id?, size, stock, price_vnd}
    
    if (!Array.isArray(variants)) return res.status(400).json({ error: 'variants must be array' });

    // Delete old variants not in the new list
    const newIds = variants.filter(v => v.id).map(v => v.id);
    if (newIds.length > 0) {
      await supabase.from('product_variants').delete().eq('product_id', productId).not('id', 'in', `(${newIds.join(',')})`);
    } else {
      await supabase.from('product_variants').delete().eq('product_id', productId);
    }

    // Upsert variants
    for (const v of variants) {
      if (v.id) {
        // Update existing
        await supabase.from('product_variants').update({ size: v.size, stock: v.stock, price_vnd: v.price_vnd }).eq('id', v.id);
      } else {
        // Insert new
        await supabase.from('product_variants').insert({ product_id: productId, size: v.size, stock: v.stock, price_vnd: v.price_vnd });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[backend] /admin/products/:id/variants error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: create profile
app.post('/admin/profiles', requireAdminApiKey, async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    
    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name }
    });
    if (authError) return res.status(500).json({ error: authError.message || authError });
    
    // Upsert profile
    const { data: profileData, error: profileError } = await supabase.from('profiles').upsert({ 
      id: authData.user.id, 
      full_name, 
      email 
    }).select();
    if (profileError) return res.status(500).json({ error: profileError.message || profileError });
    
    return res.json({ data: profileData });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: list profiles
app.get('/admin/profiles', requireAdminApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: update profile
app.put('/admin/profiles/:id', requireAdminApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, password } = req.body;
    console.log('[backend] update profile', { id, full_name, email, hasPassword: !!password });

    // Update profile row
    const { data, error } = await supabase.from('profiles').update({ full_name, email }).eq('id', id).select();
    if (error) {
      console.error('[backend] profiles.update error', error);
      return res.status(500).json({ error: error.message || error });
    }

    // If password provided, call Supabase Admin REST API to update user's password
    if (password) {
      if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
        console.error('[backend] cannot update password - service role key or url missing');
        return res.status(500).json({ error: 'Server missing Supabase service role key or URL' });
      }

      const updateUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${id}`;
      try {
        console.log('[backend] calling supabase admin REST to update password for', id);
        const updateResponse = await fetchFn(updateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({ password }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('[backend] supabase admin update failed', updateResponse.status, errorText);
          return res.status(500).json({ error: `Failed to update password: ${errorText}` });
        }

        const updateData = await updateResponse.json();
        console.log('[backend] password updated successfully', updateData);
      } catch (e) {
        console.error('[backend] error calling supabase admin REST', e);
        return res.status(500).json({ error: e.message || e });
      }
    }

    return res.json({ data });
  } catch (err) {
    console.error('[backend] update profile error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Admin: delete profile
app.delete('/admin/profiles/:id', requireAdminApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ success: true });
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

    // fetch PAID orders within timeframe and embed order_items
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`id, total, status, created_at, order_items(id, quantity, unit_price)`)
      .eq('status', 'paid')
      .gte('created_at', start)
      .lt('created_at', end);

    if (ordersError) return res.status(500).json({ error: ordersError.message || ordersError });

    const orders = ordersData || [];

    // Aggregate totals and per-day breakdown
    const totals = { revenue: 0, items: 0, orders: 0 };
    const byDay = {}; // YYYY-MM-DD -> { revenue, items, orders }

    for (const order of orders) {
      const orderTotal = Number(order.total) || 0;
      const orderItems = order.order_items || [];
      const itemsCount = orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      totals.revenue += orderTotal;
      totals.items += itemsCount;
      totals.orders += 1;

      const day = order.created_at ? new Date(order.created_at).toISOString().slice(0,10) : 'unknown';
      if (!byDay[day]) byDay[day] = { revenue: 0, items: 0, orders: 0 };
      byDay[day].revenue += orderTotal;
      byDay[day].items += itemsCount;
      byDay[day].orders += 1;
    }

    // format byDay as array
    const breakdown = Object.keys(byDay).sort().map(d => ({ day: d, ...byDay[d] }));

    return res.json({ ok: true, period: { year, month }, totals, breakdown, ordersCount: orders.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || err });
  }
});

// ========== COUPONS ADMIN ENDPOINTS ==========

// GET /admin/coupons - list all coupons
app.get('/admin/coupons', requireAdminApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[backend] fetch coupons error', error);
      return res.status(500).json({ error: 'Failed to fetch coupons' });
    }

    res.json({ coupons: data || [] });
  } catch (e) {
    console.error('[backend] GET /admin/coupons exception', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/coupons - create new coupon
app.post('/admin/coupons', requireAdminApiKey, async (req, res) => {
  try {
    const { code, type, amount, usage_limit, starts_at, expires_at, active } = req.body;

    if (!code || !type || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields: code, type, amount' });
    }

    if (type !== 'fixed' && type !== 'percent') {
      return res.status(400).json({ error: 'Invalid type: must be fixed or percent' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', code.toUpperCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: code.toUpperCase(),
        type,
        amount: parseFloat(amount),
        usage_limit: usage_limit || null,
        starts_at: starts_at || new Date().toISOString(),
        expires_at: expires_at || null,
        active: active !== undefined ? active : true,
        used_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[backend] create coupon error', error);
      return res.status(500).json({ error: 'Failed to create coupon' });
    }

    res.json({ coupon: data });
  } catch (e) {
    console.error('[backend] POST /admin/coupons exception', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /admin/coupons/:id - update coupon
app.put('/admin/coupons/:id', requireAdminApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, amount, usage_limit, starts_at, expires_at, active } = req.body;

    const updates = {};
    if (code !== undefined) updates.code = code.toUpperCase();
    if (type !== undefined) updates.type = type;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (usage_limit !== undefined) updates.usage_limit = usage_limit || null;
    if (starts_at !== undefined) updates.starts_at = starts_at;
    if (expires_at !== undefined) updates.expires_at = expires_at || null;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[backend] update coupon error', error);
      return res.status(500).json({ error: 'Failed to update coupon' });
    }

    res.json({ coupon: data });
  } catch (e) {
    console.error('[backend] PUT /admin/coupons/:id exception', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/coupons/:id - delete coupon
app.delete('/admin/coupons/:id', requireAdminApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[backend] delete coupon error', error);
      return res.status(500).json({ error: 'Failed to delete coupon' });
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[backend] DELETE /admin/coupons/:id exception', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 54321;
console.log('[backend] Starting server on port', port);
app.listen(port, () => console.log(`[backend] admin server listening on ${port}`));
