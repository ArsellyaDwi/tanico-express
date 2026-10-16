# TaniCo - Platform Pasar Pertanian & Manajemen Digital

TaniCo adalah platform pasar pertanian dan sistem manajemen komprehensif yang mengintegrasikan frontend Next.js 15 (App Router), backend Express.js, dan database PostgreSQL menggunakan Prisma ORM.

---

## Arsitektur Proyek

Seluruh proyek dikelola langsung dalam satu root tunggal:

```text
tanico/
├── api/                  # Serverless function entry points (Vercel)
├── prisma/               # Schema database, migrasi, dan seed script Prisma
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.js
├── public/               # Asset statis publik (gambar, favicon, media)
├── server/               # Backend API Express.js
│   ├── controllers/      # Route controllers (admin, produk, pesanan, dll.)
│   ├── middleware/       # Auth, upload, validation middleware
│   ├── routes/           # Express router endpoints
│   ├── services/         # Business logic & integrations
│   ├── app.js            # Express application instance
│   ├── index.js          # Standalone Express server entrypoint
│   ├── start-dev.js      # Development runner (Express + Next.js)
│   └── start-prod.js     # Production runner
├── src/                  # Frontend Next.js 15 (App Router)
│   ├── app/              # Next.js App Router pages & layouts
│   ├── components/       # Komponen UI React
│   ├── context/          # React Context providers
│   ├── lib/              # Client & shared libraries
│   ├── utils/            # Helper utilities
│   └── middleware.js     # Next.js edge middleware
├── .env                  # Environment variables lokal
├── .env.example          # Panduan template environment variables
├── .eslintrc.json        # Konfigurasi ESLint
├── .gitignore            # Aturan ignore Git
├── jsconfig.json         # Konfigurasi path alias (@/* -> src/*)
├── metadata.json         # Metadata konfigurasi aplikasi
├── next.config.mjs       # Konfigurasi Next.js & API proxy
├── package.json          # Dependensi & script tunggal
├── postcss.config.mjs    # Konfigurasi PostCSS & Tailwind CSS
└── README.md             # Dokumentasi proyek
```

---

## Persyaratan Sistem

- **Node.js**: Versi 20 atau 22 (LTS)
- **NPM**: Versi 10+
- **PostgreSQL**: Database (Supabase / Neon / Cloud SQL / Local)

---

## Panduan Instalasi & Menjalankan Aplikasi

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env` jika belum ada:
```bash
cp .env.example .env
```
Pastikan variabel `DATABASE_URL` dan konfigurasi autentikasi sudah terisi dengan benar.

### 3. Setup Database (Prisma)
Generate Prisma Client:
```bash
npm run prisma:generate
```

Push skema ke database:
```bash
npm run prisma:push
```

Jalankan seeder awal:
```bash
npm run prisma:seed
```

### 4. Menjalankan Aplikasi

#### Mode Development
Menjalankan Express Backend (Port 5000) dan Next.js Frontend (Port 3000) secara bersamaan:
```bash
npm run dev
```

#### Mode Production
Build aplikasi:
```bash
npm run build
```

Jalankan server production:
```bash
npm run start
```

---

## Skrip NPM yang Tersedia

| Skrip | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan Express backend dan Next.js frontend bersamaan untuk development |
| `npm run build` | Menjalankan prisma generate dan build Next.js ke direktori `dist/` |
| `npm run start` | Menjalankan server production |
| `npm run server` | Menjalankan backend Express saja di port 5000 |
| `npm run prisma:generate` | Men-generate Prisma Client |
| `npm run prisma:push` | Menyinkronkan skema Prisma dengan database |
| `npm run prisma:migrate` | Menerapkan migrasi database Prisma |
| `npm run prisma:seed` | Mengisi data awal database (roles, super admin, data sampel) |
| `npm run clean` | Membersihkan cache build `.next/`, `out/`, dan `dist/` |
| `npm run lint` | Menjalankan verifikasi linting |
