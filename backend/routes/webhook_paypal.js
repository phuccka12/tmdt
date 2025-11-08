const express = require('express');
const paypal = require('../services/paypalClient');

/**
 * Process a parsed PayPal event. This function is exported so admin endpoints
 * can re-run processing for a stored webhook log.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} event - parsed webhook JSON
 * @param {object|null} logRow - optional webhook_logs row object
 */
async function processPaypalEvent(supabase, event, logRow = null) {
  const eventType = event && (event.event_type || event.eventType) ? (event.event_type || event.eventType) : 'unknown';

  if (!(eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.DENIED')) {
    // For non-handled events just mark processed and return
    if (logRow && logRow.id) {
      try { await supabase.from('webhook_logs').update({ processed: true }).eq('id', logRow.id); } catch (e) { /* ignore */ }
    }
    return { ok: true, received: eventType };
  }

  const resource = event.resource || {};
  const provider_payment_id = resource.id || (resource.billing_agreement_id) || null;
  let amount = null;
  try {
    amount = resource.amount && (resource.amount.value || resource.amount.total) ? (resource.amount.value || resource.amount.total) : null;
  } catch (e) { amount = null; }

  // Idempotency: check if payment already exists with provider_payment_id and status success
  if (provider_payment_id) {
    const existingRes = await supabase.from('payments').select('*').eq('provider_payment_id', provider_payment_id).limit(1).single().catch(() => ({ data: null }));
    const existing = existingRes && existingRes.data ? existingRes.data : existingRes.data;
    if (existing && existing.status === 'success') {
      if (logRow && logRow.id) {
        try { await supabase.from('webhook_logs').update({ processed: true }).eq('id', logRow.id); } catch (e) {}
      }
      return { ok: true, reason: 'already_processed' };
    }
  }

  // find order id from resource or existing payment
  let orderId = null;
  try { orderId = resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id; } catch (e) { orderId = null; }
  if (!orderId && provider_payment_id) {
    const pRes = await supabase.from('payments').select('order_id').eq('provider_payment_id', provider_payment_id).limit(1).single().catch(() => ({ data: null }));
    if (pRes && pRes.data && pRes.data.order_id) orderId = pRes.data.order_id;
  }

  // Handle capture completed
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    try {
      const paymentPayload = {
        provider: 'paypal',
        provider_payment_id: provider_payment_id || null,
        amount: amount || null,
        currency: (resource.amount && resource.amount.currency_code) || 'VND',
        status: 'success',
        raw: resource
      };

      if (provider_payment_id) {
        await supabase.from('payments').upsert({ ...paymentPayload, id: undefined }, { onConflict: ['provider_payment_id'] });
      } else {
        await supabase.from('payments').insert(paymentPayload);
      }

      if (orderId) {
        await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
      }

      if (logRow && logRow.id) {
        try { await supabase.from('webhook_logs').update({ processed: true }).eq('id', logRow.id); } catch (e) {}
      }

      return { ok: true };
    } catch (e) {
      if (logRow && logRow.id) {
        try { await supabase.from('webhook_logs').update({ processing_error: String(e && e.message ? e.message : e) }).eq('id', logRow.id); } catch (u) {}
      }
      throw e;
    }
  }

  // Other handled event types can be extended here
  if (logRow && logRow.id) {
    try { await supabase.from('webhook_logs').update({ processed: true }).eq('id', logRow.id); } catch (e) {}
  }
  return { ok: true };
}


/**
 * Register PayPal webhook route. Uses raw body parser so signature verification uses original payload.
 * @param {import('express').Application} app
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
function registerWebhook(app, supabase) {
  // handler function so we can mount the same logic at two paths
  const handler = async (req, res) => {
    try {
      // preserve raw text and parse safely
      const rawText = req.body.toString('utf8');
      let rawJson = null;
      try {
        rawJson = JSON.parse(rawText);
      } catch (e) {
        // fallback: if body isn't valid JSON, store raw as text
        rawJson = { _raw_text: rawText };
      }

      // determine event type early (may be undefined until parsed)
      const eventType = (rawJson && (rawJson.event_type || rawJson.eventType)) || 'unknown';

      // persist webhook log (initial)
      let logRow = null;
      try {
        const insertPayload = {
          provider: 'paypal',
          event_type: eventType,
          provider_event_id: (rawJson && rawJson.resource && (rawJson.resource.id || null)) || null,
          headers: req.headers || {},
          raw_payload: rawJson,
          verified: false,
          processed: false,
          processing_error: null
        };

        const { data: inserted, error: insertErr } = await supabase.from('webhook_logs').insert(insertPayload).select().limit(1).single();
        if (insertErr) {
          console.warn('[webhook/paypal] failed to insert webhook_log', insertErr);
        } else {
          logRow = inserted;
        }
      } catch (e) {
        console.warn('[webhook/paypal] unexpected error inserting webhook_log', e && e.message ? e.message : e);
      }

      // Verify signature
      const headers = {};
      // copy headers
      for (const k of Object.keys(req.headers)) {
        headers[k] = req.headers[k];
      }

      const verify = await paypal.verifyWebhookSignature(rawJson, headers);
      if (!verify || !verify.verified) {
        console.warn('[webhook/paypal] signature verify failed', verify);
        // update webhook log if present
        try {
          if (logRow && logRow.id) {
            await supabase.from('webhook_logs').update({ verified: false, processing_error: 'signature verification failed' }).eq('id', logRow.id);
          }
        } catch (e) {
          console.warn('[webhook/paypal] failed to update webhook_log after failed verify', e && e.message ? e.message : e);
        }
        return res.status(400).json({ error: 'invalid signature' });
      }

      // mark verified in log
      if (logRow && logRow.id) {
        try {
          await supabase.from('webhook_logs').update({ verified: true }).eq('id', logRow.id);
        } catch (e) {
          console.warn('[webhook/paypal] failed to mark webhook_log verified', e && e.message ? e.message : e);
        }
      }

      const event = rawJson;
      // delegate core processing to reusable function
      try {
        const result = await processPaypalEvent(supabase, event, logRow);
        // map result to HTTP response
        return res.status(200).json(result);
      } catch (e) {
        console.error('[webhook/paypal] processing error (delegated)', e);
        return res.status(500).json({ error: e && e.message ? e.message : String(e) });
      }
    } catch (err) {
      console.error('[webhook/paypal] unexpected error', err && (err.response ? err.response.data : err.message) || err);
      return res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
  };

  // use express.raw for these endpoints to preserve exact body
  app.post('/api/webhook/paypal', express.raw({ type: 'application/json' }), handler);
  // also accept older/ngrok path /api/paypal-webhook for convenience
  app.post('/api/paypal-webhook', express.raw({ type: 'application/json' }), handler);
}

// export register function and the processing helper so admin code can import it
module.exports = registerWebhook;
module.exports.processPaypalEvent = processPaypalEvent;
