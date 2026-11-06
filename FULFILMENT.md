# PROOF: fulfilment setup (what Dezz must do)

The demo build takes **no payment** and **sends nothing**. On checkout it:
1. renders a print-ready PNG (portrait, nose at top, full bleed: 9"x33" for the 8.0/8.25 shapes or 9.5"x34" for 8.5, at `printDpi`; 150 DPI gives 1350x4950 px, BoardPusher's minimum),
2. builds an order JSON (customer, shipping, shape, stain, grip, text, artwork metadata, SHA-256 of the PNG),
3. passes both to `fulfilment.js` -> the provider in `product.js` -> `fulfilment.active` (currently `"mock"`, which saves a log in the browser's localStorage only).
Both files can be downloaded on the confirmation screen ("PRINT FILE" and "ORDER JSON").

## Honest limits
- BoardPusher has **no public order API**. Orders reach BoardPusher through its **Shopify app** (they also have Etsy/Woo-type integrations). So the real route is: a customer pays on Shopify, the Shopify order holds the BoardPusher product and artwork, and BoardPusher prints and ships.
- Secrets (Shopify Admin token, webhook secret) must **never** go in browser code. `product.js` fields are placeholders that show where they go; in production they live in a small server or serverless function that `fulfilment.js` calls. `ALLOW_NETWORK = false` in `fulfilment.js` blocks all network calls until you change that deliberately.
- Stain layers, grip choices and "custom print grip" are tagged [CHECK]: confirm with BoardPusher that each can be made before you sell them.

## Sign-ups Dezz must do himself
1. **Shopify store** (shopify.com, paid plan after trial). Turn on **Shopify Payments** (or Stripe/PayPal) in Settings -> Payments. This is the real payment step; the site's mock checkout gets replaced by a Shopify checkout link or Buy Button.
2. **BoardPusher account + Shopify app** (boardpusher.com -> "Sell with Shopify"). Install the app, create 3 deck products (8", 8.25", 8.5"), and add a payment card for BoardPusher's base cost (about $49.99 per deck).
3. **Shopify custom app** (Settings -> Apps -> Develop apps): give it `write_orders` and `read_products` scopes and copy the **Admin API access token** (server side only).
4. (Optional) **Make / Zapier / n8n** account if you'd rather use the webhook route; or an inbox for the email route.
5. File storage for artwork (Shopify Files, S3, Cloudinary): the PNG needs a public URL the maker can fetch.

## Where each value goes (`product.js` -> `fulfilment`)
| Key | What | Where from |
|---|---|---|
| `active` | `"mock"`, `"boardpusher"`, `"webhook"` or `"email"` | your choice |
| `printDpi` | 150 (minimum) or 300 | BoardPusher spec |
| `providers.boardpusher.storeDomain` | `yourstore.myshopify.com` | Shopify admin |
| `providers.boardpusher.accessToken` | Admin API token. **Server env var only**, leave blank in the browser | step 3 |
| `providers.boardpusher.productVariantMap` | `{street:<variant id>, park:<id>, wall:<id>}` | Shopify product -> variant id of each BoardPusher deck |
| `providers.webhook.url` / `secret` / `dryRun` | your Make/Zapier/server URL; HMAC secret (server side); set `dryRun:false` and `ALLOW_NETWORK=true` to send | step 4 |
| `providers.email.to` | the inbox that receives manual orders | you |
| `shapeMap` | BoardPusher product names per shape (a hint written into the order JSON) | already filled |

## Go-live checklist
1. Do the sign-ups, make one test order end to end in Shopify test mode, and check BoardPusher receives it and accepts the PNG.
2. Move the boardpusher/webhook call to a server endpoint that also uploads the PNG; set `active`.
3. Replace the mock press with a real checkout redirect **before** marking the order paid. Keep the "TEST ORDER" banner until then.
4. Update the prices in `product.js` (`price`) to the real retail price.
