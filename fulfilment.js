// PROOF fulfilment adapters. Configure in product.js -> PRODUCT.fulfilment. See FULFILMENT.md.
// SAFETY: this demo build never makes network calls. Real providers must run on a server you control.
export const ALLOW_NETWORK = false;

async function sha256Hex(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

export const providers = {
  // Active by default: records the order locally so the flow can be demoed end to end.
  async mock(order, files) {
    const log = JSON.parse(localStorage.proofMockOrders || '[]');
    log.push({ order_no: order.order_no, at: order.created_at, artwork: files.printName, artwork_bytes: files.printBlob ? files.printBlob.size : 0, sha256: files.printSha });
    localStorage.proofMockOrders = JSON.stringify(log.slice(-50));
    return { ok: true, provider: 'mock', ref: 'MOCK-' + order.serial, message: 'Stored in this browser only. Nothing was sent or made.' };
  },
  // BoardPusher has no public order API; its route is a Shopify store + the BoardPusher Shopify app.
  // Production flow: your server creates a Shopify order for the mapped variant, with the print PNG URL as a line-item property.
  async boardpusher(order, files, cfg) {
    const missing = ['storeDomain', 'accessToken'].filter(k => !cfg[k]);
    if (!cfg.productVariantMap || !cfg.productVariantMap[order.product.shape_id]) missing.push('productVariantMap.' + order.product.shape_id);
    const wouldSend = {
      endpoint: `https://${cfg.storeDomain || '<store>.myshopify.com'}/admin/api/<version>/orders.json`,
      order: { email: order.customer.email, financial_status: 'paid', send_receipt: false,
        line_items: [{ variant_id: (cfg.productVariantMap || {})[order.product.shape_id] || '<variant id>', quantity: 1,
          properties: [{ name: 'Proof No.', value: order.serial }, { name: 'Artwork', value: '<public URL of ' + files.printName + '>' }] }],
        shipping_address: { name: order.customer.name, address1: order.shipping.address, city: order.shipping.city, zip: order.shipping.postcode, country: order.shipping.country } }
    };
    return { ok: false, provider: 'boardpusher', stub: true, missing, wouldSend, message: 'Stub only: run this on a server once Shopify + BoardPusher are connected.' };
  },
  // Generic JSON webhook (Make, Zapier, n8n or your own backend).
  async webhook(order, files, cfg) {
    const body = JSON.stringify({ order, artwork: { name: files.printName, sha256: files.printSha, url: '<upload the PNG to storage, then put its URL here>' } });
    const request = { method: 'POST', url: cfg.url || '<not set>', headers: { 'content-type': 'application/json', 'x-proof-signature': cfg.secret ? 'sha256=' + await sha256Hex(cfg.secret + body) : '<no secret>' }, bodyBytes: body.length };
    if (!ALLOW_NETWORK || cfg.dryRun !== false || !cfg.url) return { ok: false, provider: 'webhook', dryRun: true, request, message: 'Dry run: no network call made.' };
    const r = await fetch(cfg.url, { method: 'POST', headers: request.headers, body });
    return { ok: r.ok, provider: 'webhook', status: r.status };
  },
  // Email handoff (for a manual first week): previews the message a server would send.
  async email(order, files, cfg) {
    return { ok: false, provider: 'email', dryRun: true, preview: { to: cfg.to || '<not set>', subject: `New PROOF order ${order.order_no}`, attachments: [files.printName, files.jsonName] }, message: 'Dry run: no email sent.' };
  }
};

export async function submitOrder(order, files, conf) {
  const name = (conf && conf.active) || 'mock', p = providers[name];
  if (!p) return { ok: false, provider: name, message: 'Unknown provider' };
  files.printSha = files.printBlob ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await files.printBlob.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('') : null;
  const res = await p(order, files, (conf.providers || {})[name] || {});
  console.info('[fulfilment]', name, res);
  return res;
}
