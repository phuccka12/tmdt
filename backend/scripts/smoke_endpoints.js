const http = require('http');
const fetch = require('node-fetch');

const BASE = process.env.BACKEND_URL || 'http://localhost:54321';
const endpoints = [
  '/payments/orders',
  '/payments/redirect-simulate',
  '/payments/momo',
  '/payments/vnpay-create',
];

(async () => {
  console.log('Backend smoke test base:', BASE);
  for (const ep of endpoints) {
    const url = BASE + ep;
    try {
      const method = ep === '/payments/orders' || ep === '/payments/momo' ? 'POST' : 'GET';
      const opts = { method, headers: { 'Content-Type': 'application/json' }, timeout: 5000 };
      if (method === 'POST') opts.body = JSON.stringify({ test: true });
      const res = await fetch(url, opts);
      console.log(`${method} ${ep} -> ${res.status} ${res.statusText}`);
      try { const body = await res.text(); console.log('  body:', body.slice(0, 200)); } catch(e){}
    } catch (err) {
      console.warn(`${ep} -> error:`, err.message || err);
    }
  }
})();
