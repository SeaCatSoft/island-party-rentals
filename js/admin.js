/* ============================================================
   Back office — staff login, product management, orders
   ============================================================ */

const $ = s => document.querySelector(s);
let EDITING_ID = null;
let ORDERS_CACHE = [];

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  if (DEMO_MODE) {
    $("#demo-note").classList.remove("hidden");
  } else {
    onAdminAuthChange(user => user ? showDashboard() : showLogin());
  }
});

/* ---------------- Auth ---------------- */

async function doLogin(e) {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    await adminLogin($("#login-email").value.trim(), $("#login-password").value);
    showDashboard();
  } catch (err) {
    $("#login-error").textContent = err.message || "Sign-in failed. Check your email and password.";
  }
}

function doLogout() {
  adminLogout();
  showLogin();
}

function showLogin() {
  $("#login-view").classList.remove("hidden");
  $("#dash-view").classList.add("hidden");
}

async function showDashboard() {
  $("#login-view").classList.add("hidden");
  $("#dash-view").classList.remove("hidden");
  await Promise.all([loadProducts(), loadOrders()]);
}

/* ---------------- Tabs ---------------- */

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach(p =>
    p.classList.toggle("hidden", p.id !== "tab-" + name));
}

/* ---------------- Products ---------------- */

async function loadProducts() {
  const list = await fetchProducts(true);
  const tbody = $("#products-tbody");
  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No products yet — add your first one above.</td></tr>`;
    return;
  }
  list.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${esc(p.name)}</strong><div class="muted" style="font-size:0.85em">${esc(p.desc || "")}</div></td>
      <td>${esc(p.category || "—")}</td>
      <td>${money(p.price)}</td>
      <td>${p.qty}</td>
      <td>${p.active ? '<span class="badge badge-ok">Live</span>' : '<span class="badge badge-out">Hidden</span>'}</td>
      <td>
        <button class="btn btn-ghost btn-small" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn btn-ghost btn-small" onclick="removeProduct('${p.id}', '${escAttr(p.name)}')">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
  window._products = list;
}

function editProduct(id) {
  const p = window._products.find(x => x.id === id);
  if (!p) return;
  EDITING_ID = id;
  $("#pf-name").value = p.name;
  $("#pf-category").value = p.category || "";
  $("#pf-price").value = p.price;
  $("#pf-qty").value = p.qty;
  $("#pf-img").value = p.img || "";
  $("#pf-desc").value = p.desc || "";
  $("#pf-active").checked = !!p.active;
  $("#product-form-title").textContent = "Edit product";
  $("#pf-save").textContent = "Save changes";
  $("#pf-cancel").classList.remove("hidden");
  switchTab("products");
  $("#pf-name").focus();
}

function cancelEdit() {
  EDITING_ID = null;
  $("#product-form").reset();
  $("#pf-active").checked = true;
  $("#product-form-title").textContent = "Add a product";
  $("#pf-save").textContent = "Add product";
  $("#pf-cancel").classList.add("hidden");
}

async function submitProduct(e) {
  e.preventDefault();
  const product = {
    name: $("#pf-name").value.trim(),
    category: $("#pf-category").value.trim(),
    price: parseFloat($("#pf-price").value) || 0,
    qty: parseInt($("#pf-qty").value, 10) || 0,
    img: $("#pf-img").value.trim(),
    desc: $("#pf-desc").value.trim(),
    active: $("#pf-active").checked
  };
  const wasEditing = !!EDITING_ID;
  await saveProduct(product, EDITING_ID);
  cancelEdit();
  await loadProducts();
  toast(wasEditing ? "Product updated" : "Product added");
}

async function removeProduct(id, name) {
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
  await deleteProduct(id);
  await loadProducts();
  toast("Product deleted");
}

/* ---------------- Orders ---------------- */

async function loadOrders() {
  ORDERS_CACHE = await fetchAllOrders();
  renderOrders();
}

function renderOrders() {
  const filter = $("#order-filter").value;
  const dateFilter = $("#order-date-filter").value;
  const tbody = $("#orders-tbody");
  tbody.innerHTML = "";

  let list = ORDERS_CACHE;
  if (filter !== "all") list = list.filter(o => o.status === filter);
  if (dateFilter) list = list.filter(o => o.date === dateFilter);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No orders match.</td></tr>`;
    return;
  }

  list.forEach(o => {
    const items = (o.items || []).map(i => `${i.qty} × ${esc(i.name)}`).join("<br>");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${esc(o.ref)}</td>
      <td>${esc(o.date)}<div class="muted" style="font-size:0.82em">${esc(o.timeSlot || "")}</div></td>
      <td><strong>${esc(o.customer?.name || "")}</strong>
        <div class="muted" style="font-size:0.82em">${esc(o.customer?.phone || "")}<br>${esc(o.customer?.email || "")}</div></td>
      <td style="font-size:0.88em">${items}</td>
      <td>${money(o.subtotal)}<div class="muted" style="font-size:0.82em">dep. ${money(o.deposit)} · ${esc(PAYMENT_METHODS[o.paymentMethod]?.label || o.paymentMethod)}</div></td>
      <td><span class="badge badge-status-${o.status}">${statusLabel(o.status)}</span></td>
      <td>
        <select class="status-select" onchange="setStatus('${o.id}', this.value)">
          ${["pending-deposit","deposit-paid","completed","cancelled"].map(s =>
            `<option value="${s}" ${s === o.status ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}
        </select>
      </td>`;
    tbody.appendChild(tr);
  });
}

function statusLabel(s) {
  return { "pending-deposit": "Awaiting deposit", "deposit-paid": "Deposit paid",
           "completed": "Completed", "cancelled": "Cancelled" }[s] || s;
}

async function setStatus(id, status) {
  await updateOrderStatus(id, status);
  const o = ORDERS_CACHE.find(x => x.id === id);
  if (o) o.status = status;
  renderOrders();
  toast("Order updated");
}

/* ---------------- Helpers ---------------- */

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2000);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escAttr(s) { return esc(s); }
