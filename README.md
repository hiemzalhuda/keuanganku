# Aplikasi KeuanganKu (Kas RT)

Aplikasi web manajemen dana kas RT dengan port 3001.

## Fitur

- **Dana 17an** – iuran rutin 100%
- **Dana Baju Kaos** – iuran rutin 150%
- Input transaksi via UI / database
- Balance otomatis, tanpa target/progress

## Jalankan (Server Saat Ini)

```bash
cd /root/my-ai-web
npm install
node server.js
```

Akses di: `http://192.168.18.11:3001`

## Deploy ke Server Baru

### Persyaratton Seting Server

| Item | Spesifikasi |
|------|-------------|
| OS | Linux/ARM64 (terutama Armbian STB) |
| Node.js | >= 18 |
| RAM | minimal 1 GB |
| Directory | `/root/my-ai-web` (atau lokasi yang diinginkan) |

### Instalasi

```bash
# 1️⃣ Clone repo
git clone https://github.com/hiemzalhuda/keuanganku.git /root/my-ai-web
cd /root/my-ai-web

# 2️⃣ Install dependencies
npm install

# 3️⃣ Jalankan
node server.js
```

Data diperoleh dari `db.json`. Tanpa modifikasi file diatur ke /root/my-ai-web. Data di repo tidak tersimpan (db.json tidak ada di .gitignore).

### Modifikasi Lokal Android (Opsional)

Aplikasi Mahasiswa (Android) bisa diintegrasikan dengan `/api/login` untuk memasukkan transaksi. Perlu diarahkan:

- Base URL: `http://192.168.18.11:3001`
- Endpoint `/api/add` dan autentikasi (TIDAK dikirim lewat repo).

## Kredensial (server saat ini)

| Akun | Password |
|------|----------|
| admin | admin123 |

Selamat gunakan.