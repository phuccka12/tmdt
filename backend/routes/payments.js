const paypal = require('../services/paypalClient');
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendOrderConfirmation } = require('../services/emailService');

// Load backend .env explicitly if this module is started independently
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const router = express.Router();

function hmacSHA256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

// Helper: get user id from Authorization: Bearer <token>
async function getUserIdFromReq(req) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    const authUrl = (SUPABASE_URL || '').replace(/\/$/, '') + '/auth/v1/user';
    const resp = await axios.get(authUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY || ''
      },
      timeout: 5000
    });
    if (resp && resp.data) return resp.data.id || (resp.data.user && resp.data.user.id) || null;
  } catch (e) {
    // ignore and return null
  }
  return null;
}

// Validate coupon: GET /payments/coupons/validate?code=CODE&subtotal=12345
router.get('/coupons/validate', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const subtotal = Number(req.query.subtotal || 0);
    if (!code) return res.status(400).json({ error: 'missing_code' });

    const { data: coupon, error } = await supabaseAdmin.from('coupons').select('*').eq('code', code).single();
    if (error || !coupon) return res.status(404).json({ error: 'coupon_not_found' });
    if (!coupon.active) return res.status(400).json({ error: 'coupon_inactive' });
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) return res.status(400).json({ error: 'coupon_not_started' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'coupon_expired' });
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return res.status(400).json({ error: 'coupon_usage_exhausted' });

    let discount = 0;
    if (coupon.type === 'percent') discount = Math.round(subtotal * (Number(coupon.amount) / 100));
    else discount = Math.round(Number(coupon.amount));
    if (discount > subtotal) discount = subtotal;

    return res.json({ ok: true, coupon: { id: coupon.id, code: coupon.code, type: coupon.type, amount: coupon.amount }, discount, new_total: subtotal - discount });
  } catch (err) {
    console.error('[payments] GET /coupons/validate', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /payments/orders - create order and (optionally) return payment_url
router.post('/orders', async (req, res) => {
  try {
    // Dev debug: log incoming payload to help diagnose missing fields
    if (process.env.NODE_ENV !== 'production') {
      try { console.log('[payments] incoming /orders payload:', JSON.stringify(req.body)); } catch (e) { console.log('[payments] incoming /orders payload (unserializable)'); }
    }

    const { user_id, items, shipping, payment_method = 'cod', coupon_code, full_name: incomingFullName } = req.body;
    // Allow guest checkout (user_id may be null), but items must be present
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'invalid_payload' });

    const subtotal = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  let discount = 0;
  let couponId = null;
  let couponRecord = null;

    // If coupon provided, validate and compute discount
    if (coupon_code) {
      const { data: coupon, error: couponErr } = await supabaseAdmin.from('coupons').select('*').eq('code', coupon_code).single();
      if (couponErr || !coupon) {
        return res.status(400).json({ error: 'invalid_coupon' });
      }
      if (!coupon.active) return res.status(400).json({ error: 'coupon_inactive' });
      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) return res.status(400).json({ error: 'coupon_not_started' });
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'coupon_expired' });
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return res.status(400).json({ error: 'coupon_usage_exhausted' });

      if (coupon.type === 'percent') {
        discount = Math.round(Number(subtotal) * (Number(coupon.amount) / 100));
      } else {
        discount = Math.round(Number(coupon.amount));
      }
      if (discount > subtotal) discount = subtotal;
  couponId = coupon.id;
  couponRecord = coupon;
    }

    const shipping_fee = 0;
    const total = Math.max(0, subtotal - discount + shipping_fee);

    // Validate items shape: ensure each item has unit_price and quantity
    if (!Array.isArray(items) || items.length === 0) {
      if (process.env.NODE_ENV !== 'production') console.warn('[payments] validation failed - items missing or empty', { items });
      return res.status(400).json({ error: 'invalid_payload', reason: 'items_required' });
    }
    const badItem = items.find((it) => typeof it.unit_price === 'undefined' || typeof it.quantity === 'undefined');
    if (badItem) {
      if (process.env.NODE_ENV !== 'production') console.warn('[payments] validation failed - item missing unit_price or quantity', { badItem, items });
      return res.status(400).json({ error: 'invalid_payload', reason: 'items_missing_unit_price_or_quantity' });
    }

    // Ensure full_name is provided (DB has NOT NULL constraint). Try body -> profile -> fallback.
    let fullName = incomingFullName || req.body.full_name || null;
    if (!fullName) {
      if (user_id) {
        try {
          const { data: profile, error: profileErr } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single();
          if (!profileErr && profile && profile.full_name) fullName = profile.full_name;
        } catch (e) {
          // ignore and fallback
        }
      }
      if (!fullName) fullName = 'Khách hàng';
    }

    // If payment method is COD, require shipping address and phone
    if (String(payment_method).toLowerCase() === 'cod') {
      const addr = (shipping && shipping.address) ? String(shipping.address).trim() : '';
      const ph = (shipping && shipping.phone) ? String(shipping.phone).trim() : '';
      if (!addr || !ph) {
        if (process.env.NODE_ENV !== 'production') console.warn('[payments] missing shipping info for COD', { shipping });
        return res.status(400).json({ error: 'missing_shipping_info', reason: 'address_and_phone_required' });
      }
    }

    // Insert order with subtotal/shipping/total and optional coupon_id
    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert([{
        user_id,
        full_name: fullName,
        subtotal: subtotal,
        shipping_fee: shipping_fee,
        total: total,
        coupon_id: couponId,
        discount_amount: discount,
        // Do not auto-mark COD as paid; leave as 'pending' so admin can confirm on delivery
        status: 'pending',
        address: shipping?.address || null,
        phone: shipping?.phone || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderData.id;

  const itemsToInsert = items.map(i => ({ order_id: orderId, variant_id: i.variant_id || null, product_id: i.product_id || null, unit_price: i.unit_price, quantity: i.quantity }));
    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    // create payments row
    const { data: paymentRow } = await supabaseAdmin.from('payments').insert([{
      order_id: orderId,
      provider: payment_method,
      provider_payment_id: null,
      amount: total,
      currency: 'VND',
      // For COD, mark payment as initiated (not success) until delivery/confirmation
      status: 'initiated',
      raw: { subtotal, discount, shipping_fee }
    }]).select().single();

    // If PayPal payment, create PayPal order and update payments row with provider id and approval link
    let paymentResponse = paymentRow;
    let paypalApproveLink = null;
    if (String(payment_method).toLowerCase() === 'paypal') {
      try {
        const return_url = process.env.PAYPAL_RETURN_URL || 'http://localhost:5173/checkout/success';
        const cancel_url = process.env.PAYPAL_CANCEL_URL || 'http://localhost:5173/checkout/cancel';
  // PayPal does not support VND in many markets; convert to USD for sandbox testing.
  const vndToUsdRate = Number(process.env.VND_USD_RATE) || 23000; // configurable via env for accuracy
  const usdAmount = (Number(total) / vndToUsdRate).toFixed(2);
  const { id: paypalOrderId, approveLink, raw } = await paypal.createOrder({ total: usdAmount, currency: 'USD', return_url, cancel_url });
  // attach original VND amount into raw for reference
  if (raw) raw.original_vnd = total;
        paypalApproveLink = approveLink;
        // update payment row with provider_payment_id and raw
        await supabaseAdmin.from('payments').update({ provider_payment_id: paypalOrderId, raw }).eq('id', paymentRow.id);
        paymentResponse = { ...paymentRow, provider_payment_id: paypalOrderId };
      } catch (e) {
        console.error('[payments] error creating paypal order', e && (e.response ? e.response.data : e.message) || e);
        // continue - return created order and note that paypal create failed
      }
    }

    // record coupon usage if used
    if (couponId) {
      try {
        await supabaseAdmin.from('coupon_usages').insert([{ coupon_id: couponId, user_id, order_id: orderId }]);
        // increment used_count safely by reading current count then updating
        try {
          const cur = couponRecord?.used_count || 0;
          await supabaseAdmin.from('coupons').update({ used_count: Number(cur) + 1 }).eq('id', couponId);
        } catch (uErr) {
          console.warn('Failed to increment coupon used_count', uErr && uErr.message);
        }
      } catch (e) {
        console.warn('Failed to record coupon usage', e && e.message);
      }
    }

  // Always return created payment row along with order so frontend can simulate/redirect
  return res.json({ ok: true, order: orderData, payment: paymentResponse, payment_url: paypalApproveLink });
  } catch (err) {
    console.error('[payments] POST /orders error', err);
    return res.status(500).json({ error: err.message || 'server_error' });
  }
});

// Dev helper: simulate payment redirect (marks payment success)
router.get('/redirect-simulate', async (req, res) => {
  try {
    const { order_id, payment_id } = req.query;
    if (!order_id || !payment_id) return res.status(400).send('missing params');
    await supabaseAdmin.from('payments').update({ status: 'success' }).eq('id', payment_id);
    await supabaseAdmin.from('orders').update({ status: 'paid' }).eq('id', order_id);
    return res.send(`<html><body>Payment simulated success. Order ${order_id} marked as paid. <a href="/">Back</a></body></html>`);
  } catch (err) {
    console.error('[payments] redirect-simulate', err);
    return res.status(500).send('server error');
  }
});

// GET /payments/orders/:id - return order details (order, items, payments, profile)
router.get('/orders/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(*)), payments(*), profiles(email, full_name)')
      .eq('id', id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'order_not_found' });

    // Allow access if requester is admin (ADMIN_API_KEY) or the order owner
    const adminKey = req.headers['x-admin-api-key'] || req.query.admin_key;
    if (process.env.ADMIN_API_KEY && adminKey && adminKey === process.env.ADMIN_API_KEY) {
      return res.json({ ok: true, order });
    }

    const userId = await getUserIdFromReq(req);
    if (userId && String(userId) === String(order.user_id)) {
      return res.json({ ok: true, order });
    }

    return res.status(403).json({ error: 'forbidden' });
  } catch (err) {
    console.error('[payments] GET /orders/:id error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /payments/orders/:id/support - admin-only: add support note and optionally update order status
router.post('/orders/:id/support', express.json(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    // Check admin key first
    const adminKey = req.headers['x-admin-api-key'] || req.query.admin_key;
    const isAdmin = process.env.ADMIN_API_KEY && adminKey && adminKey === process.env.ADMIN_API_KEY;

    // If not admin, validate requester is order owner
    let requesterUserId = null;
    if (!isAdmin) {
      requesterUserId = await getUserIdFromReq(req);
      if (!requesterUserId) return res.status(403).json({ error: 'forbidden' });
      // verify ownership
      const { data: orderRow } = await supabaseAdmin.from('orders').select('user_id').eq('id', id).limit(1).single();
      if (!orderRow || String(orderRow.user_id) !== String(requesterUserId)) return res.status(403).json({ error: 'forbidden' });
    }

    const { note, action, set_status } = req.body || {};
    if (!note && !set_status && !action) return res.status(400).json({ error: 'nothing_to_do' });

    // Store support message in webhook_logs for audit/history
    const logPayload = {
      provider: 'support',
      event_type: action || 'support_note',
      provider_event_id: String(id),
      headers: {},
      raw_payload: { note, action, by_admin: isAdmin ? true : false, user_id: requesterUserId || null },
      // Support notes created by users should not be auto-verified.
      // Only external provider webhooks (e.g. PayPal) or explicit admin actions are considered verified.
      verified: false,
      processed: false,
      processing_error: null,
      created_at: new Date().toISOString()
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin.from('webhook_logs').insert(logPayload).select().limit(1).single();
    if (insertErr) console.warn('[payments] failed to insert support log', insertErr);

    let orderUpdate = null;
    if (isAdmin && set_status) {
      try {
        const { data, error: updErr } = await supabaseAdmin.from('orders').update({ status: set_status }).eq('id', id).select().single();
        if (updErr) console.warn('[payments] orders.update returned error', updErr);
        orderUpdate = data || null;
      } catch (e) {
        console.warn('[payments] orders.update exception', e);
      }
    }

    return res.json({ ok: true, inserted: inserted || null, order: orderUpdate });
  } catch (err) {
    console.error('[payments] POST /orders/:id/support error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Momo create payment
router.post('/momo', async (req, res) => {
  try {
    const { orderId, amount, orderInfo = '' } = req.body;
    if (!orderId || !amount) return res.status(400).json({ error: 'missing_params' });

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const notifyUrl = process.env.MOMO_NOTIFY_URL;
    const returnUrl = process.env.MOMO_RETURN_URL;
    const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';

    const requestId = `req_${Date.now()}`;
    const orderIdStr = String(orderId);
    const amountStr = String(Math.round(Number(amount)));

    const rawSignature = `accessKey=${accessKey}&amount=${amountStr}&extraData=&ipnUrl=${notifyUrl}&orderId=${orderIdStr}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&requestId=${requestId}&requestType=captureWallet`;
    const signature = hmacSHA256(secretKey, rawSignature);

    const payload = {
      partnerCode,
      accessKey,
      requestId,
      amount: amountStr,
      orderId: orderIdStr,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: notifyUrl,
      extraData: '',
      requestType: 'captureWallet',
      signature,
    };

    const { data } = await axios.post(endpoint, payload, { timeout: 10000 });
    if (!data || !data.payUrl) return res.status(500).json({ error: 'momo_no_payurl', detail: data });
    return res.json({ payment_url: data.payUrl, raw: data });
  } catch (err) {
    console.error('[payments] momo create error', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Momo webhook (IPN)
router.post('/momo-webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body || {};
    const secretKey = process.env.MOMO_SECRET_KEY;
    const rawSign = `accessKey=${payload.accessKey}&amount=${payload.amount}&extraData=${payload.extraData || ''}&message=${payload.message || ''}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&orderType=${payload.orderType || ''}&partnerCode=${payload.partnerCode}&requestId=${payload.requestId}&responseTime=${payload.responseTime || ''}&resultCode=${payload.resultCode}&transId=${payload.transId || ''}`;
    const expected = hmacSHA256(secretKey, rawSign);
    if (expected !== payload.signature) {
      console.warn('[payments] momo webhook invalid signature');
      return res.status(400).json({ error: 'invalid_signature' });
    }

    const orderId = Number(payload.orderId);
    const providerPaymentId = payload.transId;
    const status = payload.resultCode === 0 ? 'success' : 'failed';

    await supabaseAdmin.from('payments').insert([{ order_id: orderId, provider: 'momo', provider_payment_id: providerPaymentId, amount: Number(payload.amount), status, raw_payload: payload }]);
    if (status === 'success') {
      await supabaseAdmin.from('orders').update({ status: 'paid' }).eq('id', orderId);
    }

    return res.json({ result: 'OK' });
  } catch (err) {
    console.error('[payments] momo webhook handler error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// VNPay create
router.get('/vnpay-create', async (req, res) => {
  try {
    const { orderId, amount } = req.query;
    if (!orderId || !amount) return res.status(400).json({ error: 'missing_params' });

    const vnpUrl = process.env.VNPAY_PAYMENT_URL;
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const hashSecret = process.env.VNPAY_HASH_SECRET;
    const returnUrl = process.env.VNPAY_RETURN_URL;

    const createDate = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
    const txnRef = String(orderId);
    const amountCent = String(Math.round(Number(amount)) * 100);

    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: amountCent,
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Payment for order ${txnRef}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_CreateDate: createDate,
    };

    const sortedKeys = Object.keys(vnpParams).sort();
    const hashData = sortedKeys.map(k => `${k}=${vnpParams[k]}`).join('&');
    const secureHash = crypto.createHmac('sha512', hashSecret).update(hashData).digest('hex');
    const query = qs.stringify(vnpParams) + `&vnp_SecureHash=${secureHash}`;
    const paymentUrl = `${vnpUrl}?${query}`;

    return res.json({ payment_url: paymentUrl });
  } catch (err) {
    console.error('[payments] vnpay create error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// VNPay return handler
router.get('/vnpay-return', async (req, res) => {
  try {
    const params = { ...req.query };
    const secureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const sortedKeys = Object.keys(params).sort();
    const hashData = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const computedHash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET).update(hashData).digest('hex');

    if (computedHash !== secureHash) {
      console.warn('[payments] vnpay return invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const txnRef = Number(params.vnp_TxnRef);
    const rspCode = params.vnp_ResponseCode;
    if (rspCode === '00') {
      await supabaseAdmin.from('payments').insert([{ order_id: txnRef, provider: 'vnpay', provider_payment_id: params.vnp_TransactionNo || null, amount: Number(params.vnp_Amount) / 100, status: 'success', raw_payload: params }]);
      await supabaseAdmin.from('orders').update({ status: 'paid' }).eq('id', txnRef);
      return res.send('<html><body>Payment success. You can close this window.</body></html>');
    }

    await supabaseAdmin.from('payments').insert([{ order_id: txnRef, provider: 'vnpay', amount: Number(params.vnp_Amount) / 100, status: 'failed', raw_payload: params }]);
    return res.send('<html><body>Payment failed or cancelled.</body></html>');
  } catch (err) {
    console.error('[payments] vnpay return handler error', err);
    return res.status(500).send('server error');
  }
});

// Simple PayPal capture endpoint - call after buyer approves
router.post('/paypal/capture', async (req, res) => {
  try {
    const { token, order_id } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });

    // Call PayPal capture API
    const result = await paypal.captureOrder(token);
    
    // Handle ORDER_ALREADY_CAPTURED - treat as success
    let capture, captureId, amount, currency;
    if (!result.success) {
      const errDetails = result.error?.details?.[0];
      if (errDetails?.issue === 'ORDER_ALREADY_CAPTURED') {
        console.log('[paypal/capture] order already captured, proceeding with DB update...');
        capture = { id: token, status: 'COMPLETED' };
        captureId = token;
        amount = '0';
        currency = 'USD';
      } else {
        return res.status(500).json({ error: 'capture_failed', detail: result.error });
      }
    } else {
      capture = result.data;
      captureId = (capture.purchase_units && capture.purchase_units[0] && capture.purchase_units[0].payments && capture.purchase_units[0].payments.captures && capture.purchase_units[0].payments.captures[0] && capture.purchase_units[0].payments.captures[0].id) || token;
      amount = (capture.purchase_units && capture.purchase_units[0] && capture.purchase_units[0].payments && capture.purchase_units[0].payments.captures && capture.purchase_units[0].payments.captures[0] && capture.purchase_units[0].payments.captures[0].amount && capture.purchase_units[0].payments.captures[0].amount.value) || '0';
      currency = (capture.purchase_units && capture.purchase_units[0] && capture.purchase_units[0].payments && capture.purchase_units[0].payments.captures && capture.purchase_units[0].payments.captures[0] && capture.purchase_units[0].payments.captures[0].amount && capture.purchase_units[0].payments.captures[0].amount.currency_code) || 'USD';
    }

    // Find payment by provider_payment_id = token (order id)
    const { data: existingPayment } = await supabaseAdmin.from('payments').select('*').eq('provider_payment_id', token).limit(1).single();
    
    if (existingPayment) {
      // Always update payment and order (even if already success - handles ORDER_ALREADY_CAPTURED case)
      await supabaseAdmin.from('payments').update({ status: 'success', raw: capture }).eq('id', existingPayment.id);
      await supabaseAdmin.from('orders').update({ status: 'paid' }).eq('id', existingPayment.order_id);
      
      // Send order confirmation email
      try {
        const { data: orderData } = await supabaseAdmin.from('orders').select('*, order_items(*, products(*)), profiles(email, full_name)').eq('id', existingPayment.order_id).single();
        if (orderData && orderData.profiles && orderData.profiles.email) {
          const items = (orderData.order_items || []).map(item => ({
            name: item.products?.name || 'Sản phẩm',
            quantity: item.quantity,
            price: item.price,
          }));
          await sendOrderConfirmation({
            to: orderData.profiles.email,
            customerName: orderData.profiles.full_name || 'Khách hàng',
            orderId: existingPayment.order_id,
            total: orderData.total,
            items,
          });
        }
      } catch (emailErr) {
        console.error('[paypal/capture] email send failed (non-blocking):', emailErr);
      }
      
      return res.json({ ok: true, order_id: existingPayment.order_id, capture_id: captureId });
    } else if (order_id) {
      // fallback: create payment if not exists
      await supabaseAdmin.from('payments').insert({ order_id: Number(order_id), provider: 'paypal', provider_payment_id: captureId, amount, currency, status: 'success', raw: capture });
      await supabaseAdmin.from('orders').update({ status: 'paid' }).eq('id', order_id);
      return res.json({ ok: true, order_id, capture_id: captureId });
    } else {
      return res.status(404).json({ error: 'payment_not_found' });
    }
  } catch (err) {
    console.error('[payments] /paypal/capture error', err);
    return res.status(500).json({ error: err.message || 'server_error' });
  }
});

module.exports = router;
// Admin: mark a webhook log as verified
router.post('/admin/webhooks/:id/verify', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const adminKey = req.headers['x-admin-api-key'] || req.query.admin_key;
    if (!(process.env.ADMIN_API_KEY && adminKey && adminKey === process.env.ADMIN_API_KEY)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabaseAdmin.from('webhook_logs').update({ verified: true }).eq('id', id).select().single();
    if (error) {
      console.warn('[payments] admin verify webhook update failed', error);
      return res.status(500).json({ error: 'update_failed' });
    }

    return res.json({ ok: true, updated: data });
  } catch (err) {
    console.error('[payments] POST /admin/webhooks/:id/verify error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});
router.get('/providers', (req, res) => {
  try {
    const providers = {
      momo: Boolean(process.env.MOMO_SECRET_KEY && process.env.MOMO_ACCESS_KEY && process.env.MOMO_PARTNER_CODE && process.env.MOMO_NOTIFY_URL && process.env.MOMO_RETURN_URL),
      vnpay: Boolean(process.env.VNPAY_HASH_SECRET && process.env.VNPAY_TMN_CODE && process.env.VNPAY_PAYMENT_URL && process.env.VNPAY_RETURN_URL),
      paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    };
    return res.json({ ok: true, providers });
  } catch (err) {
    console.error('[payments] GET /providers error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});
