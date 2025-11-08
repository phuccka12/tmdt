const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Simple smoke test script to create an order then simulate a PayPal capture webhook.
// Usage: node scripts/smoke_payments.js <order_id>
// If you pass an existing order id, script will simulate a PAYMENT.CAPTURE.COMPLETED for that order.

const backendUrl = process.env.BACKEND_URL || 'http://localhost:54321';
const envPath = path.resolve(__dirname, '..', '.env');
let adminKey = process.env.ADMIN_API_KEY || null;
if (!adminKey && fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const m = raw.split(/\r?\n/).find(l => l.startsWith('ADMIN_API_KEY='));
  if (m) adminKey = m.split('=')[1].trim();
}

if (!adminKey) {
  console.error('ADMIN_API_KEY not found in env or process. Set ADMIN_API_KEY env or in backend/.env');
  process.exit(1);
}

const headers = { 'x-admin-api-key': adminKey };

async function simulateForOrder(orderId, txnId) {
  try {
    console.log('Simulating webhook for order', orderId, 'txnId', txnId || 'simulated-txn');
    const event = {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: txnId || `SIM-${Date.now()}`,
        amount: { value: '0.01', currency_code: 'USD' },
        supplementary_data: { related_ids: { order_id: orderId } }
      }
    };

    const res = await axios.post(`${backendUrl}/admin/webhooks/simulate`, { event }, { headers });
    console.log('Simulate response:', res.data);

    // check order status
    const o = await axios.get(`${backendUrl}/admin/webhooks?limit=20`, { headers });
    console.log('Recent webhook logs count:', (o.data && o.data.data) ? o.data.data.length : JSON.stringify(o.data));

    // fetch order via supabase not available here; user can check /orders page
    console.log('Done. Check Orders page or DB for order status.');
  } catch (err) {
    console.error('Simulate error', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/smoke_payments.js <order_id> [txnId]');
    process.exit(1);
  }
  const orderId = Number(args[0]);
  const txnId = args[1] || null;
  await simulateForOrder(orderId, txnId);
})();
