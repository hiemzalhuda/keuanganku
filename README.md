# Aplikasi KeuanganKu (Kas RT)

Aplikasi web manajemen dana kas RT dengan port 3001.

## Fitur

- **Dana 17an** – iuran rutin 100%
- **Dana Baju Kaos** – iuran rutin 150%

Layanan: writevrous (input transaksi via UI / database), balance otomatis tanpa target/progress.

## Jalankan (Server Saat Ini)

```bash
cd /root/my-ai-web
npm install
node server.js
```

Akses: `http://192.168.18.11:3001`

## Deploy ke Server Baru

Skin chain:

1. Clone repo
2. Install dependencies
3. Jalankan aplikasi

Deploy instructions:

```bash
# 1️⃣ Clone repo
git clone https://github.com/hiemzalhuda/keuanganku.git /root/my-ai-web
cd /root/my-ai-web

# 2️⃣ Install dependencies
npm install

# 3️⃣ Jalankan
node server.js
```

## Kredensial (server saat ini)

| Akun | Password |
|------|----------|
| admin | admin123 |

## FAQ

**Aplikasi offline?** Titik remote benar, database ter-set ke `db.json` di folder lokal tanpa di-push ke GitHub (ter-cover)
**Jalankan data?** Gunakan file lokal `db.json` sebagai sumber data utama.
**Solusi akses?** Base URL: `http://IP_SERVER:3001`