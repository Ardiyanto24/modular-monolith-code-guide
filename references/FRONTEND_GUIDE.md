AI INSTRUCTION GUIDE: Frontend Architecture — Multi-Domain Next.js + Atomic Design (Universal Template, v1)

Instruksi ini adalah aturan mutlak (source of truth) untuk menyusun struktur repositori, penamaan berkas, dan pembagian komponen pada seluruh aplikasi frontend dalam sistem ini. AI harus mematuhi panduan ini secara ketat tanpa pengecualian. Dokumen ini berdiri sendiri — seluruh aturan yang diperlukan untuk membangun frontend ada di sini, tidak merujuk ke dokumen lain untuk detail teknisnya.

**Cara pakai dokumen ini:** ini adalah template generik. Ganti seluruh placeholder (`{domain}`, `{subdomain}`, `{route-name}`, dst.) dengan nama nyata sesuai project Anda. Kalau project Anda hanya punya satu aplikasi frontend (bukan multi-domain/multi-subdomain), lewati bagian multi-domain di §1 dan §6, lalu terapkan §2-§9 langsung terhadap satu project itu.

Dokumen ini adalah satu dari empat panduan yang saling melengkapi:
- **`FRONTEND_GUIDE.md`** (dokumen ini) — struktur multi-domain/subdomain dan seluruh aturan internal tiap app Next.js
- **`BACKEND_GUIDE.md`** — struktur backend inti (modular monolith)
- **`DATABASE_GUIDE.md`** — aturan database untuk backend inti
- **`GIT_GUIDE.md`** — strategi commit, branch, tag, dan CI/CD lintas unit

Dokumen ini **tidak mengatur** git/version control maupun deployment — itu sepenuhnya diatur di `GIT_GUIDE.md` dan berlaku sama untuk semua unit (frontend maupun backend).

---

## 1. Struktur Root Multi-Domain *[Lewati bagian ini kalau project Anda hanya satu aplikasi frontend]*

Setiap subdomain adalah **aplikasi Next.js independen yang di-deploy terpisah**. Domain merepresentasikan satu brand/produk; satu domain boleh punya lebih dari satu subdomain.

```
frontend/
├── {domain}/
│   ├── {subdomain}/                # ROOT Next.js project — independen penuh
│   │   ├── src/
│   │   │   ├── app/                # Routing layer, lihat §2
│   │   │   ├── components/         # Atomic Design, lihat §3
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── package.json            # WAJIB sendiri, bukan workspace-shared (lihat §6)
│   │   ├── tsconfig.json           # WAJIB sendiri
│   │   ├── next.config.ts          # WAJIB sendiri
│   │   ├── .env.local              # WAJIB sendiri (lihat §7)
│   │   └── .gitignore
│   └── {subdomain-lain}/           # domain yang sama boleh punya >1 subdomain
│       └── ...                     # struktur identik, project independen sendiri
└── {domain-lain}/
    └── {subdomain}/
        └── ...
```

**Aturan penamaan (wajib):** `{domain}` dan `{subdomain}` lowercase, kebab-case kalau lebih dari satu kata. Nama harus mencerminkan produk/area bisnis, bukan nama teknis (`marketing-site` benar, `web1` salah).

**Contoh ilustratif** — domain/brand `example` dengan apex domain `example.com` dan dua subdomain lain:
```
frontend/example/landing/     → example.com (apex — lihat §5.A)
frontend/example/app/         → app.example.com
frontend/example/docs/        → docs.example.com
```

**Aturan wajib:** setiap `{subdomain}/` adalah root project yang lengkap dan bisa di-`build`/`dev`/`deploy` sendiri tanpa bergantung pada folder subdomain lain mana pun. Tidak boleh ada `import` yang menembus ke luar folder subdomain-nya sendiri — lihat §6.

Seluruh aturan di §2-§4 (routing, Atomic Design, coding standard) berlaku **di dalam** tiap `{subdomain}/src/`, persis seperti sebuah project Next.js tunggal.

---

## 2. Arsitektur Routing (App Router)

### A. Pola Generik

```
src/
├── app/                            # ROUTING LAYER (Hanya untuk Routing & Data Fetching)
│   ├── (route-group-1)/            # mis. (public), (marketing), (shop) — sesuai kebutuhan project
│   │   ├── layout.tsx
│   │   ├── page.tsx                # HANYA memanggil <RootTemplate /> (nama sesuai halaman ini)
│   │   ├── {route-name}/
│   │   │   └── page.tsx            # HANYA memanggil <{RouteName}Template />
│   │   └── {route-name}/[slug]/
│   │       └── page.tsx            # HANYA memanggil <{RouteName}DetailTemplate />
│   └── (route-group-2)/            # mis. (admin), (dashboard)
│       └── ...
├── components/                     # UI COMPONENT LAYER, lihat §3
├── hooks/
├── lib/
├── types/
└── utils/
```

**Aturan penamaan (wajib):** `{route-name}` di `components/` HARUS identik dengan nama folder route yang bersangkutan di `src/app/` (lowercase, sama persis). `{RouteName}` untuk Template pakai PascalCase dari nama route yang sama.

### B. Route Groups

`src/app/(public)/`: URL publik, layout mengurus navigasi publik.
`src/app/(admin)/`: URL dashboard/CMS, layout memuat Sidebar Admin & Route Guard.
Nama dan jumlah route group lain mengikuti kebutuhan project — pola pengelompokan ini yang wajib, bukan nama spesifiknya.

### C. Dynamic Route (`[slug]`, `[id]`)

Route dinamis **tidak** mendapat folder organism baru terpisah. Mereka tetap masuk ke folder organism induknya, dibedakan lewat **prefix nama file**, dan Template-nya dibedakan lewat **suffix `Detail`**.

| Route | Folder Organism | Nama Template |
|---|---|---|
| `{route-name}/page.tsx` | `organisms/{route-name}/{RouteName}{Section}/{RouteName}{Section}.tsx` | `templates/{RouteName}Template/{RouteName}Template.tsx` |
| `{route-name}/[slug]/page.tsx` | `organisms/{route-name}/{RouteName}Detail{Section}/...` (folder komponen diberi prefix `{RouteName}Detail...`) | `templates/{RouteName}DetailTemplate/{RouteName}DetailTemplate.tsx` |

**Contoh ilustratif:**

| Route | Folder Organism | Nama Template |
|---|---|---|
| `blog/page.tsx` | `organisms/blog/BlogListSection/BlogListSection.tsx` | `templates/BlogTemplate/BlogTemplate.tsx` |
| `blog/[slug]/page.tsx` | `organisms/blog/BlogDetailHeader/BlogDetailHeader.tsx` | `templates/BlogDetailTemplate/BlogDetailTemplate.tsx` |
| `(admin)/articles/[id]/page.tsx` | `organisms/articles/ArticleEditForm/ArticleEditForm.tsx` | `templates/ArticleEditTemplate/ArticleEditTemplate.tsx` |

Alasan tidak dipisah folder: konten list dan detail dari domain yang sama biasanya saling berbagi tipe data dan sering saling mereferensikan (kartu di list, link ke detail) — memisah folder cuma menambah lompatan navigasi tanpa manfaat nyata. Yang wajib dipisah adalah **nama file dan nama Template**, bukan foldernya.

---

## 3. Atomic Design — Struktur Komponen

### A. Struktur Folder

```
components/
├── atoms/
│   └── {ComponentName}/             # SATU FOLDER per komponen (wajib, lihat §3.F)
│       ├── {ComponentName}.tsx
│       └── {ComponentName}.module.css
├── molecules/
│   ├── shared/                      # DEFAULT untuk semua molecule baru (lihat §3.C)
│   │   └── {ComponentName}/
│   │       ├── {ComponentName}.tsx
│   │       └── {ComponentName}.module.css
│   └── {route-name}/                # HANYA jika ada alasan eksplisit tidak bisa digeneralisasi
│       └── {ComponentName}/
│           ├── {ComponentName}.tsx
│           └── {ComponentName}.module.css
├── organisms/
│   ├── shared/
│   │   ├── {route-group-1}/         # komponen lintas-halaman DI DALAM satu route group
│   │   │   └── {ComponentName}/
│   │   │       ├── {ComponentName}.tsx
│   │   │       └── {ComponentName}.module.css
│   │   └── {route-group-2}/
│   └── {route-name}/                # satu subfolder per route/halaman — nama HARUS sama persis
│       │                             # dengan nama folder route-nya di src/app/
│       └── {RouteName}{SectionName}/   # lalu satu subfolder LAGI per komponen di dalamnya
│           ├── {RouteName}{SectionName}.tsx
│           └── {RouteName}{SectionName}.module.css
└── templates/
    └── {RouteName}Template/         # Template juga dapat folder sendiri
        ├── {RouteName}Template.tsx
        └── {RouteName}Template.module.css
```

**Prinsip folder `organisms/` dan `molecules/`:** nama subfolder route-nya (level pertama) HARUS mengikuti nama route/halaman di `src/app/`. Di dalam subfolder route itu, SETIAP komponen individual mendapat subfolder-nya sendiri lagi (nama sama dengan nama komponennya) — bukan file `.tsx` yang langsung sejajar di folder route. Ini bukan sekadar konvensi kosmetik — ini yang membuat AI (atau manusia) bisa langsung menebak lokasi kode dari nama halaman maupun nama komponennya, tanpa harus scroll folder flat berisi puluhan file.

**Contoh ilustratif** (untuk route `src/app/(public)/about/page.tsx` — sesuaikan nama section dengan halaman project Anda):
```
components/organisms/about/
├── AboutHeroSection/
│   ├── AboutHeroSection.tsx
│   └── AboutHeroSection.module.css
├── TeamSection/
│   ├── TeamSection.tsx
│   └── TeamSection.module.css
└── MilestoneSection/
    ├── MilestoneSection.tsx
    └── MilestoneSection.module.css

components/templates/AboutTemplate/AboutTemplate.tsx
components/templates/AboutTemplate/AboutTemplate.module.css
```

### B. Atoms — Komponen Tunggal Terkecil

Tidak boleh mengimpor komponen lain dari `components/`. Sangat reusable, hanya menerima data lewat props. Tidak perlu subfolder per halaman (kalau sebuah atom terasa spesifik ke satu halaman, itu tanda dia sebenarnya molecule atau organism, bukan atom) — TAPI setiap atom tetap WAJIB punya folder sendiri berisi `.tsx` + `.module.css`-nya (lihat §3.F).

Contoh: `atoms/Button/Button.tsx`, `atoms/Badge/Badge.tsx`, `atoms/Avatar/Avatar.tsx`, `atoms/Typography/Typography.tsx`.

### C. Molecules — Gabungan Atoms

**Kebijakan default (wajib, tanpa perlu menimbang-nimbang):** SEMUA molecule baru dibuat langsung di `molecules/shared/`. AI tidak boleh menebak-nebak apakah sebuah molecule "akan reusable atau tidak" — itu keputusan yang tidak bisa diambil AI secara andal di awal. `molecules/{route-name}/` HANYA dipakai kalau molecule itu punya business logic yang secara eksplisit terikat ke satu halaman (bukan sekadar dugaan) — misalnya sebuah komponen input group yang isinya rumus/logic khusus satu fitur tertentu.

Contoh generik yang selalu masuk `molecules/shared/{ComponentName}/`: `FormField`, `SearchBar`, `ProductCard`.

### D. Organisms — Section Halaman & UI Kompleks

**Aturan wajib:** setiap "section" pada sebuah halaman = 1 komponen Organism, dengan foldernya sendiri di dalam `organisms/{route-name}/{RouteName}{SectionName}/` (nama route sama persis dengan folder route-nya), kecuali dipakai di ≥2 halaman (lihat aturan promosi di §3.G).

Komponen yang dipakai lintas halaman (misal navigasi utama, footer, atau section yang muncul di lebih dari satu route) masuk ke `organisms/shared/{route-group}/{ComponentName}/`.

### E. Templates — Tata Letak Halaman

**Aturan wajib: 1 Route = 1 Template.** Setiap `page.tsx` yang merender UI (bukan cuma redirect/API) WAJIB punya persis satu Template pasangannya di `components/templates/{RouteName}Template/{RouteName}Template.tsx`, apa pun nama dan jumlah halamannya.

Template bertugas: menyusun urutan Organism dari folder `organisms/{route-name}/` + `organisms/shared/{route-group}/` yang relevan, dan meneruskan data (props) yang sudah diambil di `page.tsx` (RSC) ke masing-masing Organism. Template TIDAK fetch data sendiri.

**Contoh ilustratif** (untuk route `about`, sesuaikan nama komponen dengan section riil di project Anda):
```tsx
// components/templates/AboutTemplate/AboutTemplate.tsx
import { Navbar } from '@/components/organisms/shared/public/Navbar/Navbar';
import { Footer } from '@/components/organisms/shared/public/Footer/Footer';
import { AboutHeroSection } from '@/components/organisms/about/AboutHeroSection/AboutHeroSection';
import { TeamSection } from '@/components/organisms/about/TeamSection/TeamSection';
import { MilestoneSection } from '@/components/organisms/about/MilestoneSection/MilestoneSection';

export function AboutTemplate({ team, milestones }: AboutTemplateProps) {
  return (
    <>
      <Navbar />
      <AboutHeroSection />
      <TeamSection team={team} />
      <MilestoneSection milestones={milestones} />
      <Footer />
    </>
  );
}
```

### F. Aturan Wajib: Setiap Komponen Punya Folder Sendiri + CSS Module Pasangan

**Wajib, tanpa pengecualian implisit — dua lapis aturan sekaligus, berlaku untuk KEEMPAT level Atomic Design (Atom, Molecule, Organism, Template):**

1. **Folder-per-komponen**: setiap komponen mendapat SATU FOLDER sendiri, nama folder identik dengan nama komponennya (PascalCase). Dilarang menaruh file `.tsx` langsung sejajar di folder level atas (`atoms/`, `molecules/shared/`, dst.) tanpa folder pembungkus.
2. **Pasangan `.tsx` + `.module.css`**: di dalam folder komponen tersebut, WAJIB ada file `.module.css` dengan nama identik dengan file `.tsx`-nya (beda ekstensi saja). Tidak ada komponen — Atom sekecil apa pun, Molecule, Organism, maupun Template — yang boleh dibuat hanya dengan `.tsx` tanpa `.module.css` pasangannya, kecuali pengecualian eksplisit di bawah.

Pola penamaan (wajib, tidak boleh disingkat/digabung/diratakan):
```
components/atoms/Button/Button.tsx
components/atoms/Button/Button.module.css

components/molecules/shared/FormField/FormField.tsx
components/molecules/shared/FormField/FormField.module.css

components/organisms/{route-name}/{RouteName}HeroSection/{RouteName}HeroSection.tsx
components/organisms/{route-name}/{RouteName}HeroSection/{RouteName}HeroSection.module.css

components/templates/{RouteName}Template/{RouteName}Template.tsx
components/templates/{RouteName}Template/{RouteName}Template.module.css
```

Cara pakai di dalam komponen (import relatif, karena satu folder):
```tsx
// components/atoms/Button/Button.tsx
import styles from './Button.module.css';

export function Button({ children }: ButtonProps) {
  return <button className={styles.button}>{children}</button>;
}
```

Import dari luar folder komponen tetap lewat path alias, menunjuk ke file `.tsx` di dalam folder komponennya:
```tsx
// BENAR
import { Button } from '@/components/atoms/Button/Button';

// SALAH (folder tanpa nama file di akhir path, atau file .tsx diratakan tanpa folder)
import { Button } from '@/components/atoms/Button';
```

**Aturan tambahan:**
- Kalau sebuah komponen benar-benar tidak butuh styling sendiri (murni wrapper/logic tanpa markup bervisual — mis. komponen ikon yang cuma merender elemen SVG dari library, sangat jarang di luar itu), boleh TANPA `.module.css`, TAPI folder-per-komponennya tetap wajib ada (`atoms/Icon/Icon.tsx` sendirian di dalam folder `Icon/`). Pengecualian ini hanya untuk aturan #2 (pasangan CSS), bukan untuk aturan #1 (folder sendiri) — folder tetap wajib di semua kasus. Pengecualian ini dicatat eksplisit (mis. komentar singkat di file) supaya tidak disalahartikan sebagai kelalaian saat checklist di §9 dijalankan.
- Dilarang menaruh styling gabungan lintas komponen dalam satu `.module.css` besar (mis. satu `organisms.module.css` untuk banyak Organism). Setiap komponen = satu file CSS Module miliknya sendiri di dalam foldernya sendiri.
- File global (`globals.css`, variabel warna, reset CSS) tetap boleh ada satu di `src/app/globals.css`, tapi itu di luar cakupan aturan ini — aturan ini khusus untuk folder dan styling milik komponen individual.
- `*.module.css` TIDAK BOLEH diletakkan di `src/app/**` mana pun. Kalau AI menemukan `*.module.css` tersisa di dalam `src/app/`, itu adalah sisa struktur yang harus dipindahkan ke folder komponen yang sesuai, bukan dipertahankan.

### G. Kapan Komponen "Naik Level" ke `shared/`

Gunakan aturan ini agar AI tidak ragu-ragu menaruh file di mana:

- Dipakai di **1 halaman saja** → tetap di `organisms/{route-name}/` (atau `molecules/{route-name}/`).
- Dipakai di **≥2 halaman**, dan strukturnya identik → **pindahkan** ke `organisms/shared/{route-group}/` (atau `molecules/shared/`), lalu update semua import.
- Dipakai di **≥2 halaman**, tapi variasinya signifikan (beda layout/logic, bukan cuma beda props) → JANGAN dipaksa jadi satu shared component. Biarkan masing-masing halaman punya versinya sendiri, atau pecah bagian yang sama persis ke Molecule/Atom shared, sisanya tetap page-scoped.

---

## 4. Search-Before-Create (Wajib Sebelum Membuat Komponen Baru)

Sebelum AI membuat file Organism atau Molecule baru, AI WAJIB terlebih dahulu:

1. Cek isi `components/organisms/shared/{route-group}/` dan `components/molecules/shared/` — apakah sudah ada komponen dengan fungsi serupa?
2. Kalau sudah ada tapi butuh sedikit variasi → tambahkan props opsional ke komponen yang ada, JANGAN duplikasi dengan nama baru (`HeroSectionV2`, `HeroSection2`, dst. dilarang).
3. Kalau benar-benar belum ada dan memang spesifik ke satu halaman → baru buat di `organisms/{route-name}/` atau `molecules/{route-name}/` (untuk molecule, lihat kebijakan default di §3.C — ini pengecualian yang harus punya alasan jelas).

Pencarian ini **hanya** dilakukan di dalam `{subdomain}/src/components/` yang sedang dikerjakan — tidak ada pencarian atau promosi komponen lintas subdomain (lihat §6).

---

## 5. Alur Kerja Pembuatan Halaman Baru (SOP untuk AI)

```
[Langkah 1: Identifikasi Route]      ➔ Tentukan route group (mis. public/admin), tentukan nama route
[Langkah 2: Siapkan Folder Organism] ➔ Buat components/organisms/{route-name}/ jika belum ada
[Langkah 3: Pecah Komponen]          ➔ Pecah UI jadi Atoms (shared), Molecules (default shared), Organisms ({route-name})
[Langkah 4: Implementasi Bottom-Up]  ➔ Atoms ➔ Molecules ➔ Organisms
[Langkah 5: Buat Template]           ➔ components/templates/{RouteName}Template/{RouteName}Template.tsx — WAJIB, tidak boleh dilewati
[Langkah 6: Orkestrasi]              ➔ src/app/(route-group)/{route-name}/page.tsx HANYA fetch data + memanggil Template
```

**Larangan eksplisit:** `page.tsx` tidak boleh berisi JSX section langsung (mis. `<section>...banyak markup...</section>`). Kalau ditemukan, itu bug arsitektur — pindahkan ke Organism yang sesuai lalu panggil lewat Template.

Granularitas commit untuk tiap langkah di atas (satu Atom/Molecule/Organism/Template = satu commit terpisah) diatur penuh di `GIT_GUIDE.md` — dokumen ini hanya mengatur urutan dan struktur teknisnya.

---

## 6. Independensi Antar Subdomain *[Lewati bagian ini kalau project Anda hanya satu aplikasi frontend]*

**Prinsip:** tiap subdomain adalah unit deploy independen. Independensi ini dijaga secara ketat, bukan sekadar folder terpisah secara kosmetik.

- **Dilarang** membuat shared package, shared component library, atau workspace tooling (Turborepo/Nx/pnpm workspace) yang menghubungkan dua atau lebih subdomain. Setiap subdomain punya `node_modules`, `package.json`, dan siklus build sepenuhnya sendiri.
- **Dilarang** `import` lintas folder subdomain dalam bentuk apa pun (relative path maupun alias).
- **Kalau ada UI yang identik dibutuhkan di ≥2 subdomain** (mis. Navbar/Footer perusahaan yang sama di semua produk): **duplikasi dengan sengaja**. Salin komponennya ke masing-masing subdomain sebagai kode independen milik subdomain tersebut, dan perlakukan sebagai komponen yang **kebetulan sama hari ini**, bukan yang wajib selalu identik. Ini adalah tradeoff yang diterima secara sadar demi independensi deploy penuh — subdomain tidak boleh saling menunggu rilis package bersama hanya untuk mengubah Navbar.
- Konsekuensi dari aturan duplikasi: kalau Navbar di satu subdomain perlu berubah, itu **tidak otomatis** mengubah Navbar di subdomain lain. Kalau perubahan itu memang harus konsisten di semua produk, itu jadi tugas manual — ubah di tiap subdomain masing-masing, dengan commit terpisah per subdomain (`GIT_GUIDE.md`).

### A. Apex Domain adalah Subdomain Juga

Setiap domain bisnis punya satu app yang hidup di apex-nya sendiri (mis. `example.com`, tanpa prefix subdomain) — biasanya landing page, homepage, atau portal domain tersebut. App ini **bukan** entitas di luar pola domain/subdomain, dan **bukan** ditaruh di level lebih tinggi dari `{domain}/`. Ia diperlakukan sebagai **subdomain biasa**, hanya kebetulan tidak punya prefix di URL produksinya.

- Tidak ada folder khusus atau perlakuan struktural berbeda untuk apex domain — dia tetap `frontend/{domain}/{subdomain-apex}/` mengikuti §1, dengan seluruh aturan independensi di atas berlaku sama seperti subdomain lain.
- Nama foldernya **tidak distandarkan wajib** (boleh `landing`, `home`, `main`, `www`, atau nama lain yang mencerminkan perannya) — pilih nama yang jelas menandakan "ini apex", konsisten dalam satu domain, tapi tidak perlu dipaksa sama di semua domain lain dalam repo.
- Kalau apex domain perlu menampilkan/menautkan ke subdomain lain dalam domain yang sama (mis. landing `example.com` punya tombol masuk ke `app.example.com`), tautannya berupa **link biasa ke URL publik subdomain lain** (bukan import kode) — aturan independensi tetap berlaku penuh, apex domain tidak mengimpor apa pun dari subdomain lain.

---

## 7. Komunikasi ke Backend

Frontend memanggil backend sebagai satu HTTP API eksternal lewat satu base URL (lihat `BACKEND_GUIDE.md`), bukan sebagai bagian dari monorepo yang sama — bahkan kalau backend juga berupa modular monolith dengan satu base URL untuk banyak module internal.

- Base URL backend **wajib** disimpan sebagai environment variable di `.env.local` milik subdomain tersebut, tidak pernah di-hardcode di kode.
- Penamaan env var: `NEXT_PUBLIC_API_URL` untuk pemanggilan dari client, atau `API_URL` (tanpa prefix `NEXT_PUBLIC_`) untuk pemanggilan dari server component/route handler yang tidak perlu terekspos ke browser.
  ```
  # .env.local milik frontend/{domain}/{subdomain}
  API_URL=https://api.example.com
  NEXT_PUBLIC_API_URL=https://api.example.com
  ```
- Pemanggilan API sebaiknya dikumpulkan lewat modul klien di `src/lib/api/{resource-name}.ts` per resource/domain fungsional (mis. `content.ts`, `orders.ts`) — bukan `fetch()` tersebar langsung di dalam Organism/Template. Ini menjaga agar kalau kontrak API suatu bagian backend berubah, perubahannya terlokalisasi di satu file, meski secara jaringan semuanya menuju base URL yang sama.
- Subdomain **tidak boleh** mengasumsikan struktur internal backend (nama tabel, module mana yang menangani suatu logika, dst) — subdomain hanya bicara ke kontrak API publik yang didefinisikan di dokumen spesifikasi API project Anda.

---

## 8. Standar Penulisan Kode (Coding Standard)

### A. Server Components Secara Default + Pola Client Islands

Semua file di `src/app` adalah RSC secara default. Fetching data dilakukan di `page.tsx` menggunakan `async/await`.

**Hindari** membuat seluruh halaman jadi client component lewat file terpisah seperti `{RouteName}PageClient.tsx`. Kalau hanya sebagian kecil UI yang butuh interaktivitas (`useState`, animasi, dsb.), taruh `'use client'` **sedekat mungkin ke leaf component** — biasanya di level Molecule atau Organism kecil yang memang butuh, bukan di seluruh page. Ini disebut pola "client islands": mayoritas halaman tetap RSC (cepat, SEO-friendly), hanya pulau kecil yang jadi client component.

Kalau memang seluruh Template butuh jadi client component (jarang, tapi kadang perlu, mis. halaman dengan form multi-step interaktif penuh), boleh — tapi filenya tetap `components/templates/{RouteName}Template/{RouteName}Template.tsx` dengan `'use client'` di baris atas, BUKAN file terpisah `*PageClient.tsx` di dalam `src/app/`.

### B. Pola Penulisan Impor (Clean Imports)

Gunakan Path Aliases, mengarah ke file `.tsx` di dalam folder komponennya sendiri (§3.F):
```
// BENAR
import { Button } from '@/components/atoms/Button/Button';
import { HeroSection } from '@/components/organisms/{route-name}/HeroSection/HeroSection';
import { Navbar } from '@/components/organisms/shared/{route-group}/Navbar/Navbar';

// SALAH
import { Button } from '../../components/atoms/Button/Button';
import { Button } from '@/components/atoms/Button';        // hilang nama file, cuma nama folder
```

### C. Pemisahan State dan Logika Bisnis

Jangan menaruh logika bisnis rumit (query database langsung, panggilan API kompleks) di Atoms/Molecules. Data diambil di `page.tsx` (RSC) lewat modul `src/lib/api/{resource-name}.ts` (§7), diteruskan sebagai props ke Template, lalu ke Organism.

---

## 9. Checklist Validasi Sebelum Selesai (untuk AI)

Sebelum menganggap sebuah halaman/subdomain baru "selesai", pastikan:

- [ ] `page.tsx` tidak berisi JSX section langsung, hanya fetch data + `<{RouteName}Template />`
- [ ] Ada file `components/templates/{RouteName}Template/{RouteName}Template.tsx`
- [ ] Setiap section punya file Organism sendiri di `components/organisms/{route-name}/`
- [ ] Tidak ada file `*PageClient.tsx` baru dibuat kecuali benar-benar tidak bisa dihindari
- [ ] Komponen yang dipakai di ≥2 halaman DALAM SATU SUBDOMAIN sudah dipindah ke `shared/`, bukan diduplikasi
- [ ] Tidak ada file `*.module.css` yang tersisa di dalam `src/app/**`
- [ ] Setiap komponen baru (Atom/Molecule/Organism/Template) punya foldernya sendiri (nama folder = nama komponen), tidak ada file `.tsx` yang diratakan langsung di `atoms/`, `molecules/shared/`, dll. (§3.F)
- [ ] Setiap file `.tsx` baru di dalam folder komponennya punya `.module.css` pasangan dengan nama identik (§3.F), kecuali pengecualian ikon murni yang dicatat eksplisit — jalankan `find src/components -name "*.tsx"` dibandingkan dengan `find src/components -name "*.module.css"`, jumlah dan nama harus berpasangan
- [ ] Tidak ada nama file duplikat/varian (`*V2`, `*New`, `*Copy`) — indikasi search-before-create dilewati
- [ ] Route dinamis (`[slug]`, `[id]`) tidak membuat folder organism baru, hanya file baru di folder induk yang sama
- [ ] Subdomain baru (jika ada, §1) dibuat karena alasan eksplisit (audiens/deploy/rilis berbeda), bukan sekadar mengelompokkan halaman
- [ ] Tidak ada `import` yang menembus ke folder subdomain lain (§6)
- [ ] Tidak ada shared package/workspace tooling baru yang menghubungkan >1 subdomain (§6)
- [ ] Base URL backend inti diambil dari environment variable, bukan hardcode, mengikuti pola `API_URL`/`NEXT_PUBLIC_API_URL` (§7)
- [ ] Pemanggilan API dikumpulkan di `src/lib/api/{resource-name}.ts`, bukan tersebar di komponen
- [ ] `package.json`, `tsconfig.json`, `.env.local` subdomain ini berdiri sendiri, tidak diwariskan dari root repo

Jalankan `tree src/components -L 3` (atau setara) di akhir task dan tempelkan hasilnya sebagai bukti struktur sudah sesuai sebelum melaporkan pekerjaan selesai.
