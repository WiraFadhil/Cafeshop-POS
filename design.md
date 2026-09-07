# Design Guide — Cafe POS

Panduan arah visual untuk web kasir (POS) cafe ini. Dibuat supaya desainnya berangkat dari *konteks nyata* alat kasir & kertas struk — bukan dari template SaaS generik yang bisa dipakai produk apa saja.

Stack: HTML/CSS/JS murni. Semua warna di bawah didefinisikan sebagai CSS custom properties, tinggal ditaruh di `:root`.

---

## 0. Kenapa arah ini, bukan "monokrom" generik

Kalau diminta "modern minimalis, monokrom", default AI biasanya jatuh ke salah satu dari ini — **hindari semua**:
- background krem hangat + serif kontras tinggi + aksen terracotta
- background nyaris hitam (`#0B0B0B` / `#111`) + satu aksen neon
- kartu rounded seragam, radius sama semua, shadow abu-abu lembut di bawah tiap kartu
- eyebrow label ALL CAPS di atas tiap heading, label pakai em dash, panah `→` di tiap tombol

Arah desain di bawah ini berangkat dari objek fisik yang sudah dikenal orang di dunia kasir cafe: **kertas struk / nota pesanan**. Monokromnya bukan abu-abu SaaS, tapi hitam-tinta di atas kertas — dan penekanan (emphasis) dilakukan dengan *inversi warna* (tinta ↔ kertas), bukan dengan menambah warna aksen baru. Ini yang bikin POS ini terasa dibuat untuk cafe, bukan dashboard generik yang kulitnya diganti hitam-putih.

---

## 1. Warna

```css
:root {
  --ink:        #1A1816; /* hitam hangat, bukan hitam kebiruan — berasal dari kopi sangrai, bukan hitam default */
  --paper:      #FAF9F6; /* putih kertas struk, sedikit hangat, bukan putih murni */
  --line:       #D8D4CC; /* garis pembatas tipis, warna kertas yang sedikit lebih gelap */
  --graphite:   #6B665E; /* teks sekunder — timestamp, label kategori, catatan */
  --paper-dim:  #F0EEE8; /* latar panel/section, sedikit beda dari --paper agar ada hierarki tanpa shadow */

  /* Warna status — dipakai HANYA untuk sinyal data (stok, status order), bukan dekorasi */
  --status-ready:  #4A5D45; /* hijau lumut redup — order siap / stok aman */
  --status-out:    #8B4034; /* rust redup — stok habis / dibatalkan */
}
```

Aturan pemakaian:
- **Tidak ada warna aksen brand tambahan.** Penekanan (tombol utama, item terpilih, total harga) dibuat dengan membalik `--ink` dan `--paper` — teks tinta jadi latar, latar jadi teks. Ini konsisten dengan metafora struk: bagian yang "dicap" lebih tebal, bukan diberi warna lain.
- `--status-ready` / `--status-out` hanya muncul sebagai teks kecil atau titik status (dot), tidak pernah jadi warna latar tombol besar.
- Jangan pakai gradient di mana pun. Tidak ada permukaan yang butuh gradasi di alat kasir.

---

## 2. Tipografi

Dua keluarga font, dibedakan **secara fungsional**, bukan dekoratif:

| Peran | Font | Kenapa |
|---|---|---|
| UI, heading, label, nama menu | **Space Grotesk** | Grotesk dengan karakter geometris yang sedikit idiosinkratik di huruf `a` `e` `t` — terasa modern tanpa jadi Inter/Helvetica default |
| Angka: harga, jumlah, nomor order, jam, kode struk | **IBM Plex Mono** | Monospace membuat angka rata secara visual di kolom (harga di menu, subtotal di ticket) — ini alasan *fungsional* (data tabular), bukan sekadar gaya |

```css
:root {
  --font-ui:   'Space Grotesk', sans-serif;
  --font-data: 'IBM Plex Mono', monospace;
}
```

Aturan:
- Body teks & nama item pakai `--font-ui` ukuran 15–16px, line-height 1.5.
- Semua nominal rupiah, qty, waktu, dan nomor meja/order WAJIB pakai `--font-data` — supaya kasir bisa scan angka dengan cepat, sejajar secara visual. Ini beda dari tren "monospace buat label kecil" yang disebut di anti-pattern; di sini monospace dipakai karena datanya memang tabular/numerik, bukan buat gaya "techy".
- Jangan pakai huruf kapital semua (ALL CAPS) untuk label kategori. Pakai sentence case biasa: "Kopi susu", bukan "KOPI SUSU".
- Jangan menonjolkan satu kata di headline dengan italic/warna beda — tidak relevan untuk UI kasir yang isinya daftar & angka, bukan headline marketing.

---

## 3. Layout

Prinsip alignment: **left-aligned** untuk semua daftar (menu, ticket, riwayat) — ini alat kerja, bukan halaman promosi yang butuh center-aligned hero.

### 3.1 Layar Kasir (Order Screen) — layar utama

```
┌─────────────────────────────┬──────────────────────┐
│ [Semua] [Kopi] [Non-Kopi]    │  PESANAN #0231        │ ← nomor order pakai --font-data
│ [Makanan] [Snack]            │  Meja 4 · 14:32       │
├─────────────────────────────┤ ──────────────────── │ ← hairline, bukan shadow
│  ┌────────┐ ┌────────┐       │  Kopi Susu       2x   │
│  │ Kopi    │ │ Latte  │       │  ................18.000│ ← leader dots ke harga (font-data)
│  │ Susu    │ │        │       │  Croffle         1x   │
│  │ 9.000   │ │ 15.000 │       │  ................25.000│
│  └────────┘ └────────┘       │ ──────────────────── │
│  ┌────────┐ ┌────────┐       │  Subtotal      43.000 │
│  │ ...    │ │ ...    │       │  Pajak (10%)    4.300 │
│  └────────┘ └────────┘       │  TOTAL         47.300 │
│                               │                        │
│                               │  [ BAYAR ]  ← ink-fill │
└─────────────────────────────┴──────────────────────┘
   panel menu (scroll)            panel ticket (fixed)
```

Detail penting:
- Panel kanan (ticket) **bukan kartu dengan shadow** — dia berbatas garis tipis (`--line`) di kiri saja, seperti robekan kertas dari roll di sebelah kiri. Latar `--paper-dim` sedikit beda dari panel menu supaya ada hierarki tanpa shadow.
- Item di ticket dipisah garis tipis antar baris, bukan dibungkus card masing-masing.
- Harga pakai leader dots (titik-titik) menyambung nama item ke nominal — pola nota/menu restoran asli, sekaligus bikin kolom harga rata kanan tanpa perlu tabel HTML kaku.
- Tombol "Bayar" full-width di bawah, ink-fill (latar `--ink`, teks `--paper`) — satu-satunya elemen solid-fill di layar ini, jadi otomatis paling menonjol tanpa perlu warna lain.

### 3.2 Kartu menu (grid kiri)

Flat, tanpa shadow, tanpa radius besar:
```css
.menu-item {
  border: 1px solid var(--line);
  border-radius: 4px; /* radius kecil murni buat target sentuh di touchscreen kasir, bukan gaya */
  padding: 12px;
}
.menu-item[data-selected="true"] {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
```
Radius 4px konsisten di semua elemen yang bisa disentuh (touch target), radius 0 di semua elemen struktural (panel, garis pembatas). Dua nilai radius saja di seluruh sistem, masing-masing punya alasan (sentuh vs struktur) — bukan satu radius acak ditempel ke semuanya.

### 3.3 Struk / Riwayat Order

Halaman riwayat ditampilkan sebagai daftar struk vertikal (bukan tabel data generik), tiap struk punya garis putus-putus (`border-top: 1px dashed var(--line)`) di atasnya meniru sobekan kertas thermal. Ini satu-satunya tempat elemen "dekoratif" dipakai, dan dipakai karena relevan dengan objeknya (struk), bukan ditaruh di semua section.

---

## 4. Motion

Alat kasir dipakai berulang-ulang oleh kasir yang sama sepanjang hari — animasi yang muncul di setiap aksi lama-lama mengganggu. Jadi:
- **Tidak ada** fade-in/slide-up saat halaman load atau saat scroll.
- Satu momen animasi yang dipertahankan: saat item ditambahkan ke ticket, barisnya slide-in singkat (150ms) dari kanan, seperti baris baru tercetak di printer struk. Ini animasi yang merespons aksi user, bukan animasi ambient.
- Tombol & item menu cukup pakai transisi warna instan (background-color 100ms) saat ditekan — feedback, bukan showcase.

---

## 5. Checklist sebelum kirim ke produksi

- [ ] Tidak ada warna selain `--ink`, `--paper`, `--line`, `--graphite`, `--paper-dim`, dan 2 warna status di atas.
- [ ] Semua angka (harga, qty, waktu, nomor order) pakai `--font-data`.
- [ ] Tidak ada shadow di mana pun.
- [ ] Hanya 2 nilai border-radius dipakai (4px untuk elemen sentuh, 0 untuk elemen struktural).
- [ ] Tidak ada ALL CAPS untuk label kategori/menu.
- [ ] Tombol "Bayar" / CTA utama adalah satu-satunya elemen ink-fill penuh per layar.
- [ ] Kontras teks vs latar sudah dicek (terutama `--graphite` di atas `--paper-dim`) — kasir sering kerja di ruangan dengan cahaya berubah-ubah.
- [ ] Responsive: di layar sempit, panel ticket pindah ke bawah panel menu atau jadi drawer yang bisa ditarik naik — bukan disembunyikan total.
