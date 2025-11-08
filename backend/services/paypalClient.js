const axios = require('axios');

const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || null;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn('[paypal] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set in env');
}

const BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const tokenUrl = `${BASE}/v1/oauth2/token`;
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  try {
    const res = await axios.post(tokenUrl, 'grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return res.data.access_token;
  } catch (err) {
    console.error('[paypal] getAccessToken error', err && err.response ? err.response.data : err.message || err);
    throw err;
  }
}

async function createOrder({ total, currency = 'VND', return_url, cancel_url }) {
  const url = `${BASE}/v2/checkout/orders`;
  const token = await getAccessToken();
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: { currency_code: currency, value: String(total) }
      }
    ],
    application_context: {
      return_url,
      cancel_url
    }
  };

  try {
    const r = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    const data = r.data;
    let approveLink = null;
    if (data && Array.isArray(data.links)) {
      const l = data.links.find((x) => x.rel === 'approve');
      if (l) approveLink = l.href;
    }

    return { id: data.id, approveLink, raw: data };
  } catch (err) {
    console.error('[paypal] createOrder error', err && err.response ? err.response.data : err.message || err);
    throw err;
  }
}

// Verify webhook signature using PayPal verify endpoint
async function verifyWebhookSignature(rawBody, headers) {
  // headers expected from PayPal webhook
  const transmission_id = headers['paypal-transmission-id'] || headers['Paypal-Transmission-Id'];
  const transmission_time = headers['paypal-transmission-time'] || headers['Paypal-Transmission-Time'];
  const cert_url = headers['paypal-cert-url'] || headers['Paypal-Cert-Url'];
  const auth_algo = headers['paypal-auth-algo'] || headers['Paypal-Auth-Algo'];
  const transmission_sig = headers['paypal-transmission-sig'] || headers['Paypal-Transmission-Sig'];
  const webhook_id = PAYPAL_WEBHOOK_ID;

  if (!webhook_id) {
    console.warn('[paypal] PAYPAL_WEBHOOK_ID not configured - cannot verify webhook signature');
    return { verified: false, reason: 'no_webhook_id' };
  }

  const token = await getAccessToken();
  const url = `${BASE}/v1/notifications/verify-webhook-signature`;
  const payload = {
    auth_algo: auth_algo,
    cert_url: cert_url,
    transmission_id: transmission_id,
    transmission_sig: transmission_sig,
    transmission_time: transmission_time,
    webhook_id: webhook_id,
    webhook_event: rawBody
  };

  try {
    const r = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    return { verified: r.data && r.data.verification_status === 'SUCCESS', raw: r.data };
  } catch (err) {
    console.error('[paypal] verifyWebhookSignature error', err && err.response ? err.response.data : err.message || err);
    return { verified: false, error: err && err.response ? err.response.data : err };
  }
}

// Capture an order by PayPal order ID (token)
async function captureOrder(orderId) {
  const url = `${BASE}/v2/checkout/orders/${orderId}/capture`;
  const token = await getAccessToken();
  try {
    const r = await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    return { success: true, data: r.data };
  } catch (err) {
    console.error('[paypal] captureOrder error', err && err.response ? err.response.data : err.message || err);
    return { success: false, error: err && err.response ? err.response.data : err.message };
  }
}

module.exports = { createOrder, verifyWebhookSignature, captureOrder };
