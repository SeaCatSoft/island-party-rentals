/* ============================================================
   Data layer — talks to Firebase Firestore, or runs an
   in-memory demo when Firebase isn't configured yet.
   ============================================================ */

let _db = null;

const DEMO_PRODUCTS = [
  { id: "p1", name: "20x20 Party Tent", category: "Tents", price: 350, qty: 4, active: true,
    desc: "White frame tent, seats up to 40 guests. Setup and takedown included.", img: "" },
  { id: "p2", name: "Bounce Castle (Tropical)", category: "Kids", price: 250, qty: 3, active: true,
    desc: "13ft x 13ft bouncer with palm tree theme. Blower and mats included.", img: "" },
  { id: "p3", name: "Folding Table (6ft)", category: "Tables & Chairs", price: 15, qty: 40, active: true,
    desc: "Seats 6–8. Sturdy resin top, folds flat.", img: "" },
  { id: "p4", name: "Folding Chair (White)", category: "Tables & Chairs", price: 3, qty: 200, active: true,
    desc: "Classic white event chair.", img: "" },
  { id: "p5", name: "PA Speaker + Mic", category: "Sound & Lights", price: 120, qty: 5, active: true,
    desc: "Battery powered 12\" speaker with wireless mic. Bluetooth ready.", img: "" },
  { id: "p6", name: "String Lights (50ft)", category: "Sound & Lights", price: 40, qty: 12, active: true,
    desc: "Warm white festoon lights for tents and patios.", img: "" },
  { id: "p7", name: "Cotton Candy Machine", category: "Fun Food", price: 90, qty: 2, active: true,
    desc: "Includes 50 servings of sugar floss and cones.", img: "" },
  { id: "p8", name: "Popcorn Cart", category: "Fun Food", price: 85, qty: 2, active: true,
    desc: "Vintage-style cart with 50 servings of kernels and bags.", img: "" }
];
let DEMO_ORDERS = [];

function initFirebase() {
  if (DEMO_MODE) return;
  firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.firestore();
}

/* ---------------- Products ---------------- */

async function fetchProducts(includeInactive = false) {
  if (DEMO_MODE) {
    return DEMO_PRODUCTS.filter(p => includeInactive || p.active);
  }
  const snap = await _db.collection("products").get();
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return list.filter(p => includeInactive || p.active);
}

async function saveProduct(product, id = null) {
  if (DEMO_MODE) {
    if (id) {
      const i = DEMO_PRODUCTS.findIndex(p => p.id === id);
      if (i > -1) DEMO_PRODUCTS[i] = { ...DEMO_PRODUCTS[i], ...product };
    } else {
      DEMO_PRODUCTS.push({ id: "p" + Date.now(), ...product });
    }
    return;
  }
  if (id) await _db.collection("products").doc(id).update(product);
  else await _db.collection("products").add(product);
}

async function deleteProduct(id) {
  if (DEMO_MODE) {
    const i = DEMO_PRODUCTS.findIndex(p => p.id === id);
    if (i > -1) DEMO_PRODUCTS.splice(i, 1);
    return;
  }
  await _db.collection("products").doc(id).delete();
}

/* ---------------- Availability ----------------
   Availability for a date = quantity owned minus quantities in
   all non-cancelled orders booked for that same date.           */

async function fetchOrdersForDate(dateStr) {
  if (DEMO_MODE) {
    return DEMO_ORDERS.filter(o => o.date === dateStr && o.status !== "cancelled");
  }
  const snap = await _db.collection("orders").where("date", "==", dateStr).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(o => o.status !== "cancelled");
}

async function getAvailabilityMap(dateStr) {
  const orders = await fetchOrdersForDate(dateStr);
  const reserved = {};
  for (const o of orders) {
    for (const item of o.items || []) {
      reserved[item.productId] = (reserved[item.productId] || 0) + item.qty;
    }
  }
  return reserved; // productId -> qty reserved on that date
}

/* ---------------- Orders ---------------- */

function makeOrderRef() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "IPR-" + s;
}

async function createOrder(order) {
  order.ref = makeOrderRef();
  order.createdAt = new Date().toISOString();
  order.status = "pending-deposit";

  // Re-check availability at the moment of ordering to prevent
  // two customers booking the last unit at the same time.
  const reserved = await getAvailabilityMap(order.date);
  const products = await fetchProducts();
  for (const item of order.items) {
    const p = products.find(x => x.id === item.productId);
    const free = (p ? p.qty : 0) - (reserved[item.productId] || 0);
    if (item.qty > free) {
      throw new Error(
        `Sorry — only ${Math.max(free, 0)} of "${item.name}" left for ${order.date}. Please adjust your cart.`
      );
    }
  }

  if (DEMO_MODE) {
    order.id = "o" + Date.now();
    DEMO_ORDERS.push(order);
  } else {
    const doc = await _db.collection("orders").add(order);
    order.id = doc.id;
  }
  return order;
}

async function fetchAllOrders() {
  if (DEMO_MODE) return [...DEMO_ORDERS].reverse();
  const snap = await _db.collection("orders").orderBy("createdAt", "desc").limit(300).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateOrderStatus(id, status) {
  if (DEMO_MODE) {
    const o = DEMO_ORDERS.find(x => x.id === id);
    if (o) o.status = status;
    return;
  }
  await _db.collection("orders").doc(id).update({ status });
}

/* ---------------- Invoice emails (EmailJS) ---------------- */

function buildItemLines(order) {
  return order.items
    .map(i => `${i.qty} × ${i.name} — ${money(i.price * i.qty)}`)
    .join("\n");
}

async function sendInvoiceEmails(order) {
  if (!EMAIL_ENABLED || typeof emailjs === "undefined") {
    console.log("EmailJS not configured — skipping invoice emails.");
    return { sent: false };
  }
  emailjs.init({ publicKey: EMAILJS.publicKey });

  const params = {
    order_ref: order.ref,
    customer_name: order.customer.name,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    delivery_address: order.customer.address,
    rental_date: order.date,
    time_slot: order.timeSlot,
    item_lines: buildItemLines(order),
    subtotal: money(order.subtotal),
    deposit: money(order.deposit),
    balance: money(order.subtotal - order.deposit),
    payment_method: PAYMENT_METHODS[order.paymentMethod].label,
    payment_instructions: PAYMENT_METHODS[order.paymentMethod].instructions,
    business_name: BUSINESS.name,
    business_phone: BUSINESS.phone,
    business_email: BUSINESS.email,
    admin_email: BUSINESS.adminNotifyEmail
  };

  const results = await Promise.allSettled([
    emailjs.send(EMAILJS.serviceId, EMAILJS.customerTemplateId, params),
    emailjs.send(EMAILJS.serviceId, EMAILJS.adminTemplateId, params)
  ]);
  results.forEach(r => { if (r.status === "rejected") console.error("Email failed:", r.reason); });
  return { sent: results.some(r => r.status === "fulfilled") };
}

/* ---------------- Admin auth ---------------- */

async function adminLogin(email, password) {
  if (DEMO_MODE) {
    // Demo credentials so you can preview the back office
    if (email === "admin@demo.com" && password === "demo1234") return { email };
    throw new Error("Demo mode: use admin@demo.com / demo1234");
  }
  const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
  return cred.user;
}

function adminLogout() {
  if (!DEMO_MODE) firebase.auth().signOut();
}

function onAdminAuthChange(cb) {
  if (DEMO_MODE) return; // demo handles auth in-page
  firebase.auth().onAuthStateChanged(cb);
}
