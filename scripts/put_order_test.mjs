import http from 'http';
const ADMIN = 'ec8866ba7f6f0753f2da35c8b9665da1fda47c9fb097063aab0208a8e7ece049';

async function put(id, body){
  return new Promise((resolve)=>{
    const opts = { hostname: 'localhost', port: 54321, path: `/admin/orders/${id}`, method: 'PUT', headers: { 'x-admin-api-key': ADMIN, 'Content-Type': 'application/json' } };
    const req = http.request(opts, res=>{
      let d='';
      res.on('data', c=> d+=c);
      res.on('end', ()=> resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', e=> resolve({ error: String(e) }));
    req.write(JSON.stringify(body));
    req.end();
  });
}

(async ()=>{
  console.log(await put(58, { status: 'processing' }));
  console.log(await put(59, { status: 'processing' }));
  console.log(await put(60, { status: 'processing' }));
})();
