// --- CONFIG ---
const SUPABASE_URL = "https://clayftcyyjramdidiemw.supabase.co";
const SUPABASE_KEY = "sb_publishable_LpYUMZsjZfLwjsI-lr_LRw_ck3-JUyz";
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let MENU_DATA = [];
let cart = [];
let activeCategory = "Semua";
let salesChart = null;
let statusChart = null;
window.currentView = "landing";
window.isStaffAuthenticated = false;
window.staffRole = null;
window.staffName = null;

// --- AUTH LOGIC ---

function checkStaffAuth() {
  const session = localStorage.getItem("gacoan_staff_session");
  const now = Date.now();

  if (session) {
    const data = JSON.parse(session);
    if (now - data.timestamp < 3600000) {
      window.isStaffAuthenticated = true;
      window.staffRole = data.role;
      window.staffName = data.username;
      updateStaffUI();
      switchView("barista");
      return;
    }
  }
  switchView("login");
}

async function handleLogin() {
  const user = document.getElementById("login-user").value;
  const pass = document.getElementById("login-pass").value;
  const btn = document.getElementById("btn-login");

  if (!user || !pass)
    return showNotification("Username & Password wajib diisi!", "error");

  btn.innerText = "MENGECEK...";
  btn.disabled = true;

  try {
    const { data, error } = await sbClient
      .from("users")
      .select("*")
      .eq("username", user)
      .eq("password", pass)
      .single();

    if (error || !data) throw new Error("Username atau password salah.");

    window.isStaffAuthenticated = true;
    window.staffRole = data.role;
    window.staffName = data.username;

    const sessionData = {
      username: data.username,
      role: data.role,
      timestamp: Date.now(),
    };

    localStorage.setItem("gacoan_staff_session", JSON.stringify(sessionData));

    showNotification(`Login berhasil! Halo ${data.username}`);
    updateStaffUI();
    switchView("barista");
  } catch (err) {
    showNotification(err.message, "error");
  } finally {
    btn.innerText = "MASUK PANEL";
    btn.disabled = false;
  }
}

function updateStaffUI() {
  const label = document.getElementById("staff-role-label");
  const welcome = document.getElementById("staff-welcome");
  const reports = document.getElementById("admin-reports");
  const title = document.getElementById("view-title-staff");

  if (label)
    label.innerText = window.staffRole
      ? window.staffRole.toUpperCase()
      : "STAFF";

  if (window.staffRole === "admin") {
    if (reports) reports.classList.remove("hidden");
    if (title) title.innerText = "Admin Management";
    if (welcome)
      welcome.innerText = `Halo, Admin ${window.staffName}. Monitor seluruh laporan keuangan.`;
  } else {
    if (reports) reports.classList.add("hidden");
    if (title) title.innerText = "Kitchen Central";
    if (welcome)
      welcome.innerText = `Halo, Barista ${window.staffName}. Monitor pesanan masuk sekarang.`;
  }
}

function handleLogout() {
  window.isStaffAuthenticated = false;
  window.staffRole = null;
  window.staffName = null;
  localStorage.removeItem("gacoan_staff_session");
  showNotification("Berhasil Logout.");
  switchView("landing");
}

// --- CORE LOGIC ---

// Lazy-load Chart.js only when staff dashboard needs it.
let chartScriptLoading = null;
function loadChartJS(cb) {
  if (window.Chart) return cb();
  if (!chartScriptLoading) {
    chartScriptLoading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });
  }
  chartScriptLoading.then(cb);
}

function fetchWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms),
    ),
  ]);
}

async function syncData() {
  if (MENU_DATA.length === 0) showMenuSkeleton();
  try {
    const [menuRes, ordersRes] = await Promise.all([
      fetchWithTimeout(
        sbClient.from("menu").select("*").order("nama"),
        15000,
      ),
      fetchWithTimeout(
        sbClient.from("orders").select("*").order("id", { ascending: false }),
        15000,
      ),
    ]);

    if (menuRes.error) throw menuRes.error;
    MENU_DATA = menuRes.data || [];
    if (ordersRes.error) throw ordersRes.error;
    const orders = ordersRes.data || [];

    renderMenu();
    renderBaristaGrid(orders);
    renderHistory();

    if (window.currentView === "barista" && window.isStaffAuthenticated) {
      loadChartJS(() => updateCharts(orders));
    }
  } catch (err) {
    console.error("Sync Error:", err);
    if (MENU_DATA.length === 0) showMenuError();
  }
}

function showMenuError() {
  const grid = document.getElementById("menu-grid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="menu-error">
        <p>Gagal memuat menu.</p>
        <button onclick="syncData()" class="btn btn-outline">Coba lagi</button>
    </div>`;
}

function renderMenu() {
  const grid = document.getElementById("menu-grid");
  const catsDiv = document.getElementById("category-list");
  if (!grid || !catsDiv) return;

  const cats = ["Semua", ...new Set(MENU_DATA.map((m) => m.kategori))];
  catsDiv.innerHTML = cats
    .map(
      (c) => `
                <button onclick="activeCategory='${c}';renderMenu()" 
                class="category-btn ${activeCategory === c ? "active" : ""}">${c}</button>
            `,
    )
    .join("");

  const filtered =
    activeCategory === "Semua"
      ? MENU_DATA
      : MENU_DATA.filter((m) => m.kategori === activeCategory);
  grid.innerHTML = filtered
    .map(
      (m) => `
                <div class="menu-item" data-selected="${cart.some((c) => c.id === m.id)}" onclick="addToCart(${m.id})">
                    <img src="${m.imageurl}" class="menu-item-img" alt="${m.nama}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Kopi'">
                    <h3 class="menu-item-name">${m.nama}</h3>
                    <div class="menu-item-row">
                        <span class="menu-item-price">Rp ${m.harga.toLocaleString()}</span>
                        <span class="menu-item-add">＋</span>
                    </div>
                </div>
            `,
    )
    .join("");
}

function showMenuSkeleton() {
  const grid = document.getElementById("menu-grid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 10 })
    .map(
      () => `
            <div class="menu-item">
                <div class="skeleton skeleton-img"></div>
                <div class="skeleton skeleton-line w70"></div>
                <div class="skeleton skeleton-line w40"></div>
            </div>
        `,
    )
    .join("");
}

function addToCart(id) {
  const item = MENU_DATA.find((m) => m.id === id);
  if (!item) return;
  const exist = cart.find((c) => c.id === id);
  if (exist) exist.qty++;
  else cart.push({ ...item, qty: 1 });
  updateCartUI();
  showNotification(`${item.nama} ditambahkan.`);
}

function updateCartUI() {
  const count = cart.reduce((a, b) => a + b.qty, 0);
  const total = cart.reduce((a, b) => a + b.harga * b.qty, 0);

  const ticket = document.getElementById("ticket-items");
  const payBtn = document.getElementById("ticket-pay");
  if (ticket) {
    if (cart.length === 0) {
      ticket.innerHTML =
        `<p class="ticket-empty">Belum ada pesanan.</p>`;
    } else {
      ticket.innerHTML = cart
        .map(
          (c) => `
                <div class="ticket-item-row slide-in">
                    <span class="ticket-item-name">${c.nama}</span>
                    <span class="ticket-item-qty">${c.qty}x</span>
                    <span class="ticket-item-line"></span>
                    <span class="ticket-item-price">${c.harga.toLocaleString()}</span>
                </div>
            `,
        )
        .join("");
    }
  }

  const tax = Math.round(total * 0.1);
  const grand = total + tax;
  if (document.getElementById("ticket-grand"))
    document.getElementById("ticket-grand").innerText = `Rp ${grand.toLocaleString()}`;
  const subEl = document.querySelector("#ticket-total .ticket-line:nth-child(1) .mono");
  const taxEl = document.querySelector("#ticket-total .ticket-line:nth-child(2) .mono");
  if (subEl) subEl.innerText = `Rp ${total.toLocaleString()}`;
  if (taxEl) taxEl.innerText = `Rp ${tax.toLocaleString()}`;
  if (payBtn) payBtn.disabled = count === 0;

  document.getElementById("checkout-total-label").innerText =
    `Rp ${total.toLocaleString()}`;
  document.getElementById("qris-price-label").innerText =
    `Rp ${total.toLocaleString()}`;

  renderMenu();
}

function openCheckout() {
  const modal = document.getElementById("modal-checkout");
  if (modal) modal.classList.remove("hidden");
  renderCheckoutItems();
}

function closeCheckout() {
  const modal = document.getElementById("modal-checkout");
  if (modal) modal.classList.add("hidden");
}

function renderCheckoutItems() {
  const list = document.getElementById("cart-items-list");
  if (cart.length === 0) return closeCheckout();
  list.innerHTML = cart
    .map(
      (c) => `
                <div class="checkout-item">
                    <div class="checkout-item-info">
                        <span class="checkout-item-name">${c.nama}</span>
                        <span class="checkout-item-price">Rp ${c.harga.toLocaleString()}</span>
                    </div>
                    <div class="qty-stepper">
                        <button onclick="changeQty(${c.id}, -1)" class="qty-btn minus">−</button>
                        <span class="qty-val">${c.qty}</span>
                        <button onclick="changeQty(${c.id}, 1)" class="qty-btn plus">＋</button>
                    </div>
                </div>
            `,
    )
    .join("");
}

function changeQty(id, delta) {
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
  updateCartUI();
  renderCheckoutItems();
}

function handlePayment() {
  const method = document.getElementById("payment-method").value;
  const tableNum = document.getElementById("input-table").value;
  if (!tableNum) return showNotification("No. Meja wajib diisi!", "error");

  if (method === "QRIS") {
    const qrisModal = document.getElementById("modal-qris");
    if (qrisModal) qrisModal.classList.remove("hidden");
  } else {
    finishOrderProcess("Tunai", null);
  }
}

function closeQRIS() {
  const qrisModal = document.getElementById("modal-qris");
  if (qrisModal) qrisModal.classList.add("hidden");
}

document.getElementById("input-receipt").onchange = (e) => {
  const file = e.target.files[0];
  const label = document.getElementById("file-name-label");
  if (file) {
    label.innerText = file.name;
    label.classList.add("text-orange-600");
  }
};

async function uploadAndFinish() {
  const fileInput = document.getElementById("input-receipt");
  if (!fileInput.files.length)
    return showNotification("Upload bukti bayar dulu!", "error");

  const btn = document.getElementById("btn-confirm-qris");
  btn.disabled = true;
  btn.innerText = "MENGIRIM...";

  const file = fileInput.files[0];
  const fileExt = file.name.split(".").pop();
  const filePath = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  try {
    const { error: uploadError } = await sbClient.storage
      .from("receipts")
      .upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = sbClient.storage
      .from("receipts")
      .getPublicUrl(filePath);
    await finishOrderProcess("QRIS", urlData.publicUrl);
  } catch (err) {
    btn.disabled = false;
    btn.innerText = "KIRIM BUKTI";
    showNotification("Gagal upload: " + err.message, "error");
  }
}

async function finishOrderProcess(method, photoUrl) {
  const meja = document.getElementById("input-table").value;
  const now = new Date();
  const waktuStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const orderObj = {
    id: Date.now(),
    meja: meja,
    items: cart.map((c) => ({ nama: c.nama, qty: c.qty, harga: c.harga })),
    total: cart.reduce((a, b) => a + b.harga * b.qty, 0),
    status: method === "QRIS" ? "Verifikasi" : "Antre",
    waktu: waktuStr,
    pembayaran: method,
    bukti_bayar: photoUrl,
  };

  try {
    const { error } = await sbClient.from("orders").insert([orderObj]);
    if (error) throw error;

    let history = JSON.parse(localStorage.getItem("gacoan_history") || "[]");
    history.unshift(orderObj);
    localStorage.setItem(
      "gacoan_history",
      JSON.stringify(history.slice(0, 10)),
    );

    showNotification("Pesanan diterima!");
    cart = [];
    updateCartUI();
    closeCheckout();
    closeQRIS();
    switchView("history");
  } catch (err) {
    showNotification("Gagal simpan pesanan.", "error");
  }
}

function renderBaristaGrid(orders) {
  const grid = document.getElementById("barista-grid");
  if (!grid || window.currentView !== "barista") return;

  const active = orders.filter((o) => o.status !== "Selesai");
  grid.innerHTML = active
    .map(
      (o) => `
                <div class="order-card ${o.status === "Verifikasi" ? "verifikasi" : ""}">
                    <div class="order-card-head">
                        <span class="order-card-table">Meja ${o.meja}</span>
                        <span class="order-card-time">${o.waktu}</span>
                    </div>
                    <span class="order-card-pay">${o.pembayaran}</span>
                    <div class="order-card-body">
                        ${o.items
                          .map(
                            (i) => `
                            <div class="order-line">
                                <span class="order-qty">${i.qty}x</span>
                                <span class="order-name">${i.nama}</span>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                    <div class="order-card-foot">
                        ${
                          o.status === "Verifikasi"
                            ? `
                            <button onclick="previewImage('${o.bukti_bayar}')" class="btn btn-ghost btn-block">Cek Bukti</button>
                            <button onclick="updateOrderStatus(${o.id}, 'Antre')" class="btn btn-ink btn-block">Terima Order</button>
                        `
                            : `
                            <button onclick="updateOrderStatus(${o.id}, 'Selesai')" class="btn btn-ink btn-block">Selesai &amp; Antar</button>
                        `
                        }
                    </div>
                </div>
            `,
    )
    .join("");

  if (active.length === 0) {
    grid.innerHTML = `<div class="order-empty">Belum Ada Order Aktif</div>`;
  }
}

async function updateOrderStatus(id, newStatus) {
  try {
    const { error } = await sbClient
      .from("orders")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) throw error;
    showNotification("Status diperbarui.");
    syncData();
  } catch (err) {
    showNotification("Gagal update.", "error");
  }
}

function updateCharts(orders) {
  const stats = { verifikasi: 0, antre: 0, selesai: 0 };
  const timeData = [0, 0, 0, 0];

  orders.forEach((o) => {
    if (o.status === "Verifikasi") stats.verifikasi++;
    else if (o.status === "Antre") stats.antre++;
    else stats.selesai++;

    const hour = parseInt(o.waktu.split(":")[0]);
    if (hour < 11) timeData[0]++;
    else if (hour < 15) timeData[1]++;
    else if (hour < 18) timeData[2]++;
    else timeData[3]++;
  });

  const ctxS = document.getElementById("statusChart");
  if (ctxS) {
    if (!statusChart) {
      statusChart = new Chart(ctxS.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["Verifikasi", "Proses", "Selesai"],
          datasets: [
            {
              data: [stats.verifikasi, stats.antre, stats.selesai],
              backgroundColor: ["#8B4034", "#D8D4CC", "#4A5D45"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#6B665E",
                font: { weight: "bold", size: 11 },
                padding: 15,
              },
            },
          },
          cutout: "70%",
        },
      });
    } else {
      statusChart.data.datasets[0].data = [
        stats.verifikasi,
        stats.antre,
        stats.selesai,
      ];
      statusChart.update();
    }
  }

  const ctxL = document.getElementById("salesChart");
  if (ctxL) {
    if (!salesChart) {
      salesChart = new Chart(ctxL.getContext("2d"), {
        type: "line",
        data: {
          labels: ["Pagi", "Siang", "Sore", "Malam"],
          datasets: [
            {
              label: "Orders",
              data: timeData,
              borderColor: "#1A1816",
              borderWidth: 3,
              tension: 0.4,
              pointBackgroundColor: "#FAF9F6",
              pointBorderColor: "#1A1816",
              pointRadius: 4,
              fill: true,
              backgroundColor: "rgba(26, 24, 22, 0.05)",
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            y: {
              grid: { color: "rgba(26,24,22,0.05)" },
              ticks: { color: "#6B665E", font: { size: 11 } },
            },
            x: {
              grid: { display: false },
              ticks: { color: "#6B665E", font: { size: 11 } },
            },
          },
          plugins: { legend: { display: false } },
        },
      });
    } else {
      salesChart.data.datasets[0].data = timeData;
      salesChart.update();
    }
  }
}

function renderHistory() {
  const list = document.getElementById("history-list");
  if (!list || window.currentView !== "history") return;
  const data = JSON.parse(localStorage.getItem("gacoan_history") || "[]");

  if (data.length === 0) {
    list.innerHTML = `<div class="history-empty">Belum ada riwayat pesanan.</div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (h) => `
                <div class="receipt-card">
                    <div class="receipt-top">
                        <span class="receipt-no">#ORD-${h.id.toString().slice(-6)}</span>
                        <span class="receipt-status status-pill ${h.status.toLowerCase()}">${h.status}</span>
                    </div>
                    <div class="receipt-items">${h.items
                      .map((i) => `<span class="receipt-item">${i.nama} ×${i.qty}</span>`)
                      .join("")}</div>
                    <p class="receipt-meta">${h.waktu} · ${h.pembayaran}</p>
                    <div class="receipt-foot">
                        <span class="receipt-label">Total</span>
                        <span class="receipt-total">Rp ${h.total.toLocaleString()}</span>
                    </div>
                </div>
            `,
    )
    .join("");
}

function switchView(viewName) {
  if (viewName === "barista" && !window.isStaffAuthenticated) {
    viewName = "login";
  }

  document
    .querySelectorAll(".view-content")
    .forEach((s) => s.classList.add("hidden"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove("hidden");
    window.currentView = viewName;
    syncData();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// --- THE ACTUAL FIX FOR IMAGE VISIBILITY ---
function previewImage(url) {
  if (!url || url === "null" || url === "undefined" || url.trim() === "") {
    return showNotification("Bukti transfer tidak tersedia.", "error");
  }

  const modal = document.getElementById("modal-preview");
  const previewImg = document.getElementById("preview-img");

  if (modal && previewImg) {
    // Sembunyikan gambar saat loading
    previewImg.style.opacity = "0";
    previewImg.src = url;

    // Pastikan modal muncul
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Tampilkan gambar saat sudah siap
    previewImg.onload = function () {
      previewImg.style.opacity = "1";
    };
  }
}

function closePreview() {
  const modal = document.getElementById("modal-preview");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function showNotification(text, type = "success") {
  const toast = document.getElementById("notification");
  const toastText = document.getElementById("notification-text");
  const toastIcon = document.getElementById("notification-icon");
  if (!toast || !toastText) return;

  toastText.innerText = text;
  toastIcon.innerText = type === "success" ? "✓" : "!";
  toast.classList.remove("error");
  if (type === "error") toast.classList.add("error");
  toast.classList.add("show");

  clearTimeout(showNotification._t);
  showNotification._t = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

sbClient
  .channel("pos-sync")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "orders" },
    () => syncData(),
  )
  .subscribe();

window.onload = () => {
  switchView("landing");
};
