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

async function syncData() {
  try {
    const { data: menu, error: menuErr } = await sbClient
      .from("menu")
      .select("*")
      .order("nama");
    if (menuErr) throw menuErr;
    MENU_DATA = menu || [];

    const { data: orders, error: orderErr } = await sbClient
      .from("orders")
      .select("*")
      .order("id", { ascending: false });
    if (orderErr) throw orderErr;

    renderMenu();
    renderBaristaGrid(orders || []);
    renderHistory();

    if (window.currentView === "barista" && window.isStaffAuthenticated) {
      updateCharts(orders || []);
    }
  } catch (err) {
    console.error("Sync Error:", err);
  }
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
                class="category-btn px-4 py-2.5 md:px-5 md:py-3 rounded-xl border-2 border-orange-50 font-black text-[9px] md:text-[10px] uppercase tracking-widest whitespace-nowrap transition-all bg-white text-stone-400
                ${activeCategory === c ? "active" : ""}">${c}</button>
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
                <div class="menu-card bg-white rounded-2xl p-3 md:p-4 flex flex-col group">
                    <div class="relative overflow-hidden rounded-xl mb-4 aspect-square bg-orange-50">
                        <img src="${m.imageurl}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/300?text=Kopi+Gacoan'">
                    </div>
                    <h3 class="font-black text-[10px] md:text-xs h-8 md:h-10 line-clamp-2 text-stone-800 leading-tight mb-2 uppercase tracking-tight">${m.nama}</h3>
                    <div class="flex justify-between items-center mt-auto">
                        <span class="text-orange-600 font-black text-xs md:text-sm tracking-tighter">Rp ${m.harga.toLocaleString()}</span>
                        <button onclick="addToCart(${m.id})" class="bg-stone-900 text-white w-7 h-7 md:w-9 md:h-9 rounded-lg font-black hover:bg-orange-600 hover:scale-110 active:scale-90 transition-all shadow-lg flex items-center justify-center">＋</button>
                    </div>
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
  const float = document.getElementById("cart-floating");
  if (float) float.classList.toggle("hidden", count === 0);
  document.getElementById("cart-count").innerText = count;
  document.getElementById("cart-total").innerText =
    `Rp ${total.toLocaleString()}`;
  document.getElementById("checkout-total-label").innerText =
    `Rp ${total.toLocaleString()}`;
  document.getElementById("qris-price-label").innerText =
    `Rp ${total.toLocaleString()}`;
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
                <div class="flex justify-between items-center py-4 bg-orange-50 px-4 rounded-xl border border-orange-100">
                    <div class="flex-1">
                        <p class="font-black text-[10px] uppercase tracking-tighter leading-none mb-1 text-stone-800">${c.nama}</p>
                        <p class="text-[9px] text-orange-600 font-black uppercase tracking-widest">Rp ${c.harga.toLocaleString()}</p>
                    </div>
                    <div class="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-orange-100 shadow-sm">
                        <button onclick="changeQty(${c.id}, -1)" class="w-5 h-5 flex items-center justify-center font-black text-stone-300 hover:text-red-600 transition-colors">－</button>
                        <span class="font-black text-[10px] w-4 text-center text-stone-900">${c.qty}</span>
                        <button onclick="changeQty(${c.id}, 1)" class="w-5 h-5 flex items-center justify-center font-black text-orange-600 hover:scale-125 transition-all">＋</button>
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
                <div class="dark-glass rounded-[2rem] p-6 transition-all border-l-[6px] ${o.status === "Verifikasi" ? "border-l-orange-500" : "border-l-amber-600"}">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-widest text-orange-500/60 block mb-1">Meja ${o.meja}</span>
                            <span class="text-[10px] font-bold text-stone-500">${o.waktu}</span>
                        </div>
                        <div class="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest text-white/40">${o.pembayaran}</div>
                    </div>
                    <div class="space-y-3 mb-8 min-h-[100px] overflow-y-auto no-scrollbar">
                        ${o.items
                          .map(
                            (i) => `
                            <div class="flex items-center gap-3">
                                <span class="w-6 h-6 flex items-center justify-center bg-orange-600 rounded-lg text-[10px] font-black text-white">${i.qty}</span>
                                <span class="text-xs font-bold text-stone-200">${i.nama}</span>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                    <div class="pt-6 border-t border-white/5 space-y-3">
                        ${
                          o.status === "Verifikasi"
                            ? `
                            <button onclick="previewImage('${o.bukti_bayar}')" class="w-full py-3 bg-white/5 text-orange-400 rounded-xl font-black text-[9px] uppercase tracking-widest border border-orange-500/20">Cek Bukti</button>
                            <button onclick="updateOrderStatus(${o.id}, 'Antre')" class="w-full py-3 bg-orange-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Terima Order</button>
                        `
                            : `
                            <button onclick="updateOrderStatus(${o.id}, 'Selesai')" class="w-full py-4 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Selesai & Antar</button>
                        `
                        }
                    </div>
                </div>
            `,
    )
    .join("");

  if (active.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-24 text-stone-700 font-black uppercase tracking-widest italic text-[10px]">Belum Ada Order Aktif</div>`;
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
              backgroundColor: ["#ea580c", "#d97706", "#10b981"],
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
                color: "#78716c",
                font: { weight: "bold", size: 9 },
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
              borderColor: "#f59e0b",
              borderWidth: 4,
              tension: 0.4,
              pointBackgroundColor: "#fff",
              pointRadius: 4,
              fill: true,
              backgroundColor: "rgba(234, 88, 12, 0.05)",
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            y: {
              grid: { color: "rgba(255,255,255,0.03)" },
              ticks: { color: "#57534e", font: { size: 9 } },
            },
            x: {
              grid: { display: false },
              ticks: { color: "#57534e", font: { size: 9 } },
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
    list.innerHTML = `<div class="text-center py-32 text-stone-300 font-black italic text-[10px] tracking-widest">Belum ada riwayat pesanan.</div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (h) => `
                <div class="bg-white p-5 md:p-6 rounded-[2rem] border border-orange-50 flex justify-between items-center shadow-sm">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-[8px] font-black text-stone-300 uppercase tracking-widest">#ORD-${h.id.toString().slice(-6)}</span>
                            <span class="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${h.status === "Verifikasi" ? "bg-orange-50 text-orange-600" : h.status === "Antre" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}">
                                ${h.status}
                            </span>
                        </div>
                        <p class="font-black text-stone-800 text-xs md:text-sm mb-1 uppercase tracking-tight">${h.items.map((i) => i.nama).join(", ")}</p>
                        <p class="text-[8px] font-bold text-stone-400 uppercase tracking-widest">${h.waktu} • ${h.pembayaran}</p>
                    </div>
                    <p class="font-black text-orange-600 text-lg md:text-xl tracking-tighter">Rp ${h.total.toLocaleString()}</p>
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
  toast.className = `fixed top-4 md:top-10 left-1/2 -translate-x-1/2 z-[999] px-6 py-4 md:px-8 md:py-5 rounded-2xl md:rounded-[2rem] shadow-2xl transition-all duration-500 opacity-100 translate-y-0 text-white flex items-center gap-4 w-[90%] md:min-w-[340px] md:w-auto shadow-orange-900/20 ${type === "success" ? "bg-stone-900" : "bg-red-600"}`;

  setTimeout(() => {
    toast.classList.replace("opacity-100", "opacity-0");
    toast.classList.add("translate-y-[-20px]");
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
