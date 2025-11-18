import http from 'http';
const endpoints = ['/admin/_debug','/admin/orders'];
const ADMIN = 'ec8866ba7f6f0753f2da35c8b9665da1fda47c9fb097063aab0208a8e7ece049';

function fetchPath(p){
  return new Promise((resolve)=>{
    const opts = { hostname: 'localhost', port: 54321, path: p, method: 'GET', headers: { 'x-admin-api-key': ADMIN } };
    const req = http.request(opts, res=>{
      let d='';
      res.on('data', c=> d+=c);
      res.on('end', ()=> resolve({ path: p, status: res.statusCode, headers: res.headers, body: d }));
    });
    req.on('error', e=> resolve({ path: p, error: String(e) }));
    req.end();
  });
}

(async ()=>{
  for (const p of endpoints){
    const r = await fetchPath(p);
    console.log('---', p, '---');
    console.log(JSON.stringify(r, null, 2));
  }
})();
