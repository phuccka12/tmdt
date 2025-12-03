#!/usr/bin/env node
/*
  simulate_webhook.js

  Usage (defaults read from backend/.env):
    node scripts/simulate_webhook.js --admin-key=YOUR_ADMIN_KEY --order-id=123 --provider-id=SIM-123

  This script will:
   - POST to /admin/webhooks/simulate with a PAYMENT.CAPTURE.COMPLETED payload
   - Poll the inserted webhook log until processed (or timeout)
   - Optionally query Supabase REST to show payments and order rows

  No new dependencies required (uses node-fetch already in backend/package.json).
*/

const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// load .env from backend
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BACKEND_BASE = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const ENV_ADMIN_KEY = process.env.ADMIN_API_KEY || null;

function parseArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split('=')[1];
}

const adminKey = parseArg('admin-key') || ENV_ADMIN_KEY;
if (!adminKey) {
  console.error('ADMIN API key required: pass --admin-key=... or set ADMIN_API_KEY in backend/.env');
  process.exit(1);
}

const orderId = parseArg('order-id') || null;
const providerId = parseArg('provider-id') || `SIMULATED-PAYPAL-${Date.now()}`;
const amount = parseArg('amount') || '100.00';
const currency = parseArg('currency') || 'VND';

async function postSimulate() {
  const url = `${BACKEND_BASE}/admin/webhooks/simulate?admin_key=${encodeURIComponent(adminKey)}`;
  const payload = {
    event: {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: providerId,
        amount: { value: amount, currency_code: currency },
        supplementary_data: { related_ids: {} }
      }
    }
  };
  if (orderId) payload.event.resource.supplementary_data.related_ids.order_id = Number(orderId);

  console.log('POST', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('Simulate request failed', res.status, json || await res.text().catch(() => ''));
    process.exit(1);
  }
  console.log('Simulate response:', JSON.stringify(json, null, 2));
  return json;
}

async function getWebhook(id) {
  const url = `${BACKEND_BASE}/admin/webhooks/${id}?admin_key=${encodeURIComponent(adminKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function queryPayments(provider_payment_id) {
  if (!SUPABASE_URL || !SRK) return null;
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/payments?provider_payment_id=eq.${encodeURIComponent(provider_payment_id)}&select=*`;
  const res = await fetch(url, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function queryOrder(id) {
  if (!SUPABASE_URL || !SRK || !id) return null;
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`;
  const res = await fetch(url, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function main(){
  try{
    const simulate = await postSimulate();
    const inserted = simulate && simulate.inserted ? simulate.inserted : null;
    if (!inserted || !inserted.id) {
      console.error('No inserted webhook log id returned');
      process.exit(1);
    }

    const id = inserted.id;
    console.log('Inserted webhook log id:', id);

    // Poll for processed status
    const timeoutMs = 15_000; // 15s
    const interval = 1000;
    let waited = 0;
    let last = null;
    while (waited < timeoutMs) {
      last = await getWebhook(id);
      if (last && last.log && last.log.processed) break;
      await sleep(interval);
      waited += interval;
    }
    console.log('Webhook log after polling:', JSON.stringify(last, null, 2));

    // Query payments
    const payments = await queryPayments(providerId);
    console.log('Payments query result for', providerId, ':', JSON.stringify(payments, null, 2));

    if (orderId) {
      const orders = await queryOrder(orderId);
      console.log('Order query result for', orderId, ':', JSON.stringify(orders, null, 2));
    }

    console.log('Done.');
    process.exit(0);
  } catch (e) {
    console.error('Error running simulate script', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
