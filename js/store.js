/* ============================================================
   Storefront — catalog, availability by date, cart, checkout
   ============================================================ */

let PRODUCTS = [];
let RESERVED = {};           // productId -> qty reserved on selected date
let CART = [];               // { productId, name, price, qty }
let SELECTED_DATE = "";
let SELECTED_SLOT = "";

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---------------- Init ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  initFirebase();

  // Business text
  $("#tagline").textContent = BUSINESS.tagline;
  $("#service-area").textContent = BUSINESS.serviceArea;
  $("#contact-phone").textContent = BUSINESS.phone;
  $("#contact-phone").href = "tel:" + BUSINESS.phone.replace(/[^+\d]/g, "");
  $("#contact-email").textContent = BUSINESS.email;
  $("#contact-email").href = "mailto:" + BUSINESS.email;
  $("#contact-wa").href = "https://wa.me/" + BUSINESS.whatsapp;
  $("#deposit-note").textContent =
    `A ${BUSINESS.depositPercent}% deposit secures your booking. Balance due on delivery.`;

  // Date picker: today onward
  const dateInput = $("#rental-date");
  const today = new Date();
  dateInput.min = today.toISOString().split("T")[0];
  dateInput.addEventListener("change", onDateChange);

  // Time slots
  const slotSel = $("#rental-slot");
  TIME_SLOTS.forEach(s => {
    const o = document.createElement("option");
    o.value = o.textContent = s;
    slotSel.appendChild(o);
  });
  slotSel.addEventListener("change", () => { SELECTED_SLOT = slotSel.value; });

  if (DEMO_MODE) $("#demo-banner").classList.remove("hidden");

  PRODUCTS = await fetchProducts();
  renderCategories();
  renderProducts();
  renderCart();
});

/* ---------------- Availability ---------------- */

async function onDateChange() {
  SELECTED_DATE = $("#rental-date").value;
  if (!SELECTED_DATE) return;
  $("#availability-note").textContent = "Checking availability…";
  RESERVED = await getAvailabilityMap(SELECTED_DATE);
  $("#availability-note").textContent =
    "Showing live availability for " + prettyDate(SELECTED_DATE) + ".";
  renderProducts();
  renderCart();
}

function availableQty(p) {
  if (!SELECTED_DATE) return p.qty;
  return Math.max(0, p.qty - (RESERVED[p.id] || 0));
}

function prettyDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-BB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

/* ---------------- Catalog ---------------- */

function renderCategories() {
  const cats = ["All", ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
  const bar = $("#category-bar");
  bar.innerHTML = "";
  cats.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "cat-chip" + (i === 0 ? " active" : "");
    b.textContent = c;
    b.onclick = () => {
      $$(".cat-chip").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderProducts(c === "All" ? null : c);
    };
    bar.appendChild(b);
  });
}

function renderProducts(category = null) {
  const grid = $("#product-grid");
  grid.innerHTML = "";
  const list = PRODUCTS.filter(p => !category || p.category === category);

  if (!list.length) {
    grid.innerHTML = `<p class="muted">No products in this category yet.</p>`;
    return;
  }

  list.forEach(p => {
    const avail = availableQty(p);
    const inCart = CART.find(i => i.productId === p.id);
    const badge = !SELECTED_DATE
      ? `<span class="badge badge-ok">${p.qty} in fleet</span>`
      : avail === 0
        ? `<span class="badge badge-out">Booked out on your date</span>`
        : avail <= 2
          ? `<span class="badge badge-low">Only ${avail} left for your date</span>`
          : `<span class="badge badge-ok">${avail} available on your date</span>`;

    const card = document.createElement("article");
    card.className = "card product-card";
    card.innerHTML = `
      <div class="product-img">${p.img
        ? `<img src="${escAttr(p.img)}" alt="${escAttr(p.name)}">`
        : `<span class="product-initial">${esc(p.name[0])}</span>`}</div>
      <div class="product-body">
        <div class="product-top">
          <h3>${esc(p.name)}</h3>
          <span class="price">${money(p.price)}<small class="muted">/day</small></span>
        </div>
        <p class="muted product-desc">${esc(p.desc || "")}</p>
        ${badge}
        <div class="product-actions">
          ${inCart
            ? `<div class="qty-ctrl">
                 <button class="btn btn-ghost btn-small" onclick="changeQty('${p.id}', -1)">−</button>
                 <strong>${inCart.qty}</strong>
                 <button class="btn btn-ghost btn-small" onclick="changeQty('${p.id}', 1)">+</button>
               </div>`
            : `<button class="btn btn-primary btn-small" ${avail === 0 && SELECTED_DATE ? "disabled" : ""}
                 onclick="addToCart('${p.id}')">Add to cart</button>`}
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

/* ---------------- Cart ---------------- */

function addToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  CART.push({ productId: p.id, name: p.name, price: p.price, qty: 1 });
  toast(p.name + " added to cart");
  renderProducts(activeCategory());
  renderCart();
}

function changeQty(id, delta) {
  const item = CART.find(i => i.productId === id);
  if (!item) return;
  const p = PRODUCTS.find(x => x.id === id);
  const max = SELECTED_DATE ? availableQty(p) : p.qty;
  item.qty += delta;
  if (item.qty <= 0) CART = CART.filter(i => i.productId !== id);
  else if (item.qty > max) { item.qty = max; toast("That's all we have for that date"); }
  renderProducts(activeCategory());
  renderCart();
}

function activeCategory() {
  const a = $(".cat-chip.active");
  return a && a.textContent !== "All" ? a.textContent : null;
}

function cartSubtotal() {
  return CART.reduce((s, i) => s + i.price * i.qty, 0);
}

function renderCart() {
  const count = CART.reduce((s, i) => s + i.qty, 0);
  $("#cart-count").textContent = count;
  const body = $("#cart-items");
  body.innerHTML = "";

  if (!CART.length) {
    body.innerHTML = `<p class="muted" style="padding:24px 0;text-align:center">
      Your cart is empty.<br>Pick a date above, then add items.</p>`;
  } else {
    CART.forEach(i => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div>
          <strong>${esc(i.name)}</strong>
          <div class="muted">${money(i.price)} × ${i.qty}</div>
        </div>
        <div class="qty-ctrl">
          <button class="btn btn-ghost btn-small" onclick="changeQty('${i.productId}', -1)">−</button>
          <strong>${i.qty}</strong>
          <button class="btn btn-ghost btn-small" onclick="changeQty('${i.productId}', 1)">+</button>
        </div>
        <div class="price">${money(i.price * i.qty)}</div>`;
      body.appendChild(row);
    });
  }

  const sub = cartSubtotal();
  const dep = sub * BUSINESS.depositPercent / 100;
  $("#cart-subtotal").textContent = money(sub);
  $("#cart-deposit").textContent = money(dep);
  $("#checkout-btn").disabled = !CART.length;
}

function openCart()  { $("#cart-drawer").classList.add("open"); }
function closeCart() { $("#cart-drawer").classList.remove("open"); }

/* ---------------- Checkout ---------------- */

function openCheckout() {
  if (!CART.length) return;
  if (!SELECTED_DATE) {
    toast("Please pick your rental date first");
    closeCart();
    $("#rental-date").focus();
    return;
  }
  if (!SELECTED_SLOT) SELECTED_SLOT = $("#rental-slot").value;
  closeCart();

  // Payment method radios
  const payBox = $("#payment-methods");
  payBox.innerHTML = "";
  Object.entries(PAYMENT_METHODS).forEach(([key, m], i) => {
    const id = "pay-" + key;
    payBox.insertAdjacentHTML("beforeend", `
      <label class="pay-option" for="${id}">
        <input type="radio" name="payment" id="${id}" value="${key}" ${i === 0 ? "checked" : ""}>
        <span>${esc(m.label)}</span>
      </label>`);
  });

  const sub = cartSubtotal();
  const dep = sub * BUSINESS.depositPercent / 100;
  $("#co-summary").innerHTML = `
    <div class="co-line"><span>${prettyDate(SELECTED_DATE)} · ${esc(SELECTED_SLOT)}</span></div>
    ${CART.map(i => `<div class="co-line"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
    <div class="co-line co-total"><span>Total</span><span>${money(sub)}</span></div>
    <div class="co-line co-deposit"><span>Deposit due now (${BUSINESS.depositPercent}%)</span><span>${money(dep)}</span></div>
    <div class="co-line muted"><span>Balance on delivery</span><span>${money(sub - dep)}</span></div>`;

  $("#checkout-modal").classList.add("open");
}

function closeCheckout() { $("#checkout-modal").classList.remove("open"); }

async function placeOrder(e) {
  e.preventDefault();
  const btn = $("#place-order-btn");
  btn.disabled = true;
  btn.textContent = "Placing your order…";

  const sub = cartSubtotal();
  const order = {
    items: CART.map(i => ({ ...i })),
    date: SELECTED_DATE,
    timeSlot: SELECTED_SLOT,
    customer: {
      name: $("#co-name").value.trim(),
      email: $("#co-email").value.trim(),
      phone: $("#co-phone").value.trim(),
      address: $("#co-address").value.trim()
    },
    subtotal: sub,
    deposit: sub * BUSINESS.depositPercent / 100,
    paymentMethod: document.querySelector("input[name=payment]:checked").value
  };

  try {
    const saved = await createOrder(order);
    await sendInvoiceEmails(saved);
    showConfirmation(saved);
    CART = [];
    RESERVED = await getAvailabilityMap(SELECTED_DATE);
    renderProducts(activeCategory());
    renderCart();
  } catch (err) {
    alert(err.message || "Something went wrong placing the order. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Place order";
  }
}

function showConfirmation(order) {
  closeCheckout();
  const m = PAYMENT_METHODS[order.paymentMethod];
  $("#confirm-body").innerHTML = `
    <p class="confirm-ref">Order reference<br><span class="mono">${order.ref}</span></p>
    <p>Thanks, <strong>${esc(order.customer.name)}</strong>! Your items are reserved for
      <strong>${prettyDate(order.date)}</strong>, ${esc(order.timeSlot)}.</p>
    <div class="confirm-pay card">
      <h3>Pay your ${money(order.deposit)} deposit via ${esc(m.label)}</h3>
      <pre class="pay-instructions">${esc(m.instructions)}</pre>
      <p class="hint">Quote reference <strong class="mono">${order.ref}</strong> with your payment.
      Your booking is confirmed once the deposit is received.</p>
    </div>
    <p class="muted">An invoice has been ${EMAIL_ENABLED ? "emailed to you" : "recorded"} —
      questions? Call us at ${esc(BUSINESS.phone)}.</p>`;
  $("#confirm-modal").classList.add("open");
}

function closeConfirm() { $("#confirm-modal").classList.remove("open"); }

/* ---------------- Helpers ---------------- */

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escAttr(s) { return esc(s); }
