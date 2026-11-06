// ===== PRODUCT CONFIG: everything product-specific lives here =====
window.PRODUCT = {
  brand: "PROOF",
  name: "Custom 7-ply maple deck",
  price: 94, currency: "$", priceNote: "mock price",
  maker: "Made to order by our partner, ships in about 3 days + transit.",
  checkNote: "Options shown in preview; final availability confirmed at order.",
  plies: 7,
  stainPresets: {
    "Natural":   ["#E3C79A","#E3C79A","#E3C79A","#E3C79A","#E3C79A","#E3C79A","#E3C79A"],
    "Sunset":    ["#E3C79A","#D9442B","#F08A3C","#FFB54A","#F08A3C","#D9442B","#E3C79A"],
    "Night Ply": ["#E3C79A","#2B2B2B","#1d2a3a","#E3C79A","#1d2a3a","#2B2B2B","#E3C79A"]
  },
  stainJars: ["#E3C79A","#D9442B","#FFB54A","#2B2B2B","#3f6b4a","#1d2a3a","#c9a0dc"],
  moulds: [ // width in inches, concave 0..1, kick 0..1
    { id:"street", label:"Street 8.0",        width:8.0,  concave:.7, kick:.8 },
    { id:"park",   label:"Park 8.25",         width:8.25, concave:.55,kick:.7 },
    { id:"wall",   label:"Wall-art flat-ish", width:8.5,  concave:.15,kick:.25 }
  ],
  // put Canva exports here; missing files fall back to procedural art
  graphics: [1,2,3,4,5,6,7,8].map(i => `assets/canva/deck_0${i}.webp`), // BOT1 Canva-made originals (800x3200 -> webp); thumbnails = *_t.webp
  grips: [ { id:"black", label:"Plain black", color:"#151413" }, { id:"clear", label:"Clear", color:null }, { id:"print", label:"Custom print", color:"#1d1c1b" } ],
  // ===== FULFILMENT (see FULFILMENT.md). No real network calls are made in this demo build. =====
  fulfilment: {
    active: "mock",            // "mock" | "boardpusher" | "webhook" | "email"
    printDpi: 150,             // BoardPusher minimum is 150 DPI, 300 recommended (needs >=2700x9900 source art)
    providers: {
      mock: {},
      boardpusher: {           // route: Shopify store + BoardPusher Shopify app (no public API)
        storeDomain: "",       // e.g. "proof-decks.myshopify.com"
        accessToken: "",       // Shopify Admin API token: put it on a SERVER, never in this file in production
        productVariantMap: {}  // { street: "<shopify variant id>", park: "...", wall: "..." }
      },
      webhook: { url: "", secret: "", dryRun: true },   // e.g. Make/Zapier/n8n/your backend
      email: { to: "", dryRun: true }
    },
    shapeMap: { street: "BoardPusher 8 Inch Skateboard Deck", park: "BoardPusher 8-1/4 Skateboard Deck", wall: "BoardPusher 8-1/2 Skateboard Deck" }
  }
};
