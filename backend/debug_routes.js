// Debug helper: print routes exposed by the payments router
const path = require('path');
const payments = require(path.resolve(__dirname, 'routes', 'payments'));

function listRoutes(router, prefix = '') {
  const routes = [];
  router.stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {}).join(',').toUpperCase();
      routes.push({ path: prefix + layer.route.path, methods });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // nested router
      routes.push(...listRoutes(layer.handle, prefix + (layer.regexp && layer.regexp.source ? '' : '')));
    }
  });
  return routes;
}

try {
  const r = listRoutes(payments);
  console.log('payments router routes:');
  console.log(JSON.stringify(r, null, 2));
} catch (err) {
  console.error('failed to inspect payments router', err);
}
