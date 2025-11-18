const http = require('http');
const endpoints = ['/admin/_debug','/admin/orders'];

function fetchPath(p){
  return new Promise((resolve)=>{
    const opts = { hostname: 'localhost', port: 54321, path: p, method: 'GET' };
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
