AI INSTRUCTION GUIDE: Database Architecture — PostgreSQL (Universal Template, v1)

Instruksi ini adalah aturan mutlak (source of truth) untuk pengelolaan skema, migrasi, dan boundary data pada sistem ini. AI harus mematuhi panduan ini secara ketat tanpa pengecualian, kecuali diarahkan lain oleh dokumen kebutuhan produk/arsitektur milik project yang sedang dikerjakan.

**Cara pakai dokumen ini:** ini adalah template generik. Sebagian besar aturan di sini (konvensi penamaan, PK, migrasi, indexing) berlaku untuk **semua** project database relasional. Bagian yang ditandai *[Pola multi-tenant — opsional]* hanya relevan kalau project Anda memang butuh isolasi data per-tenant/per-klien secara fisik; kalau project Anda satu database biasa untuk semua data, lewati bagian itu dan perlakukan seluruh sistem sebagai satu tingkat database saja.

Dokumen ini adalah satu dari empat panduan yang saling melengkapi:
- **`BACKEND_GUIDE.md`** — struktur module backend, layer, dan komunikasi antar module
- **`DATABASE_GUIDE.md`** (dokumen ini) — aturan database, migrasi, dan boundary data
- **`FRONTEND_GUIDE.md`** — struktur aplikasi frontend
- **`GIT_GUIDE.md`** — strategi commit, branch, tag, dan CI/CD

Sumber kebenaran produk yang mendasari seluruh aturan di sini: dokumen requirement/arsitektur project Anda sendiri. Kalau ada pertentangan antara dokumen ini dan dokumen sumber tersebut, **dokumen sumber yang menang** — laporkan pertentangan itu alih-alih diam-diam memilih salah satu.

---

## 0. Satu Tingkat Database vs Dua Tingkat Database *[Pola multi-tenant — opsional]*

**Default untuk kebanyakan project: satu database.** Kalau project Anda bukan sistem multi-tenant dengan kebutuhan isolasi data fisik per-klien, lewati seluruh bagian §0 ini — perlakukan sistem sebagai satu database aplikasi biasa, dan aturan-aturan di §1-§8 tetap berlaku penuh terhadap database tunggal itu.

**Kalau project Anda memang multi-tenant dengan kebutuhan isolasi fisik per-tenant** (mis. SaaS B2B di mana tiap klien harus terisolasi penuh, bukan cukup dipisah lewat kolom `tenant_id`), berikut prinsip paling mendasar yang membedakan sistem seperti ini dari aplikasi CRUD biasa — **wajib dipahami sebelum menyentuh migrasi apa pun**:

| | Shared/Core DB | Tenant DB |
|---|---|---|
| Jumlah instance | Satu, dipakai bersama | Satu per tenant — bertambah terus seiring klien baru |
| Kapan dibuat | Sekali, saat sistem pertama kali di-deploy | Dinamis, setiap kali ada tenant baru diprovisioning (runtime, bukan deploy-time) |
| Migrasi | Linear seperti aplikasi pada umumnya — riwayat migrasi bertambah maju | **Cetakan yang di-replay** — migrasi yang sama dijalankan berulang kali terhadap database baru yang berbeda-beda, ditambah kebutuhan mereplay migrasi lama ke seluruh Tenant DB yang sudah ada kalau skema dasar berubah |
| Isi | Entity lintas-tenant: akun klien, order, job provisioning, registry/katalog global | Data & konfigurasi milik satu tenant saja |

Referensi: dokumen arsitektur produk Anda untuk pembagian tabel yang tepat antara dua tingkat ini.

**Konsekuensi langsung:** setiap aturan migrasi di dokumen ini (§5) berlaku beda antara dua tingkat ini kalau Anda memakai pola ini — jangan menyamakan keduanya begitu saja.

---

## 1. Infrastruktur

- Tentukan sejak awal di mana Postgres berjalan (VPS sendiri yang di-manage sendiri, atau provider managed seperti RDS/Supabase/Neon/Cloud SQL) — keputusan ini mengubah cara Anda mengelola koneksi, backup, dan scaling, dokumentasikan pilihannya di sini.
- **Kalau self-managed:** satu proses Postgres bisa menampung banyak database secara fisik. Kalau memakai pola multi-tenant (§0), Shared/Core DB adalah satu `CREATE DATABASE`, dan tiap tenant punya `CREATE DATABASE` sendiri lagi — bukan schema-per-tenant dalam satu database, ini `CREATE DATABASE` sungguhan per tenant.
- Postgres **wajib** di-bind ke `localhost`/Unix socket saja kalau berjalan di VPS yang sama dengan backend. Port default **tidak pernah** diekspos ke jaringan publik tanpa alasan eksplisit — tidak ada pengecualian, termasuk untuk kebutuhan development/debugging jarak jauh (pakai SSH tunnel kalau perlu akses dari luar).
- **Role Postgres dua tingkat, wajib dipisah:**
  - Role admin/superuser — **hanya** dipakai oleh proses migrasi dan worker provisioning untuk `CREATE DATABASE`/`CREATE ROLE`. Tidak pernah dipakai kode yang melayani request harian.
  - Role aplikasi — dipakai runtime backend untuk query harian, hanya diberi akses ke database yang memang dibutuhkan. Kalau memakai pola multi-tenant (§0), tiap Tenant DB punya role Postgres sendiri, hanya diberi akses ke database miliknya sendiri.
  - Kredensial role admin dan role aplikasi **wajib** berasal dari environment variable yang berbeda (lihat `BACKEND_GUIDE.md` §9.G) — tidak pernah satu connection string dipakai untuk dua tujuan.

**Catatan soal Row Level Security (RLS):** kalau project Anda memakai pola multi-tenant fisik (§0, `CREATE DATABASE` per tenant), sistem **tidak memakai RLS sebagai mekanisme otorisasi** — isolasi antar-tenant sudah selesai di level `CREATE DATABASE`, tidak ada "baris milik tenant lain" yang perlu difilter dalam satu tabel yang sama. Kalau project Anda memakai pola satu database dengan kolom `tenant_id` (bukan `CREATE DATABASE` per tenant), RLS justru **relevan dan disarankan** sebagai lapisan pertahanan tambahan — pilih pola yang sesuai kebutuhan isolasi Anda dan dokumentasikan keputusannya secara eksplisit. Otorisasi *dalam* satu tenant/akun (apakah `user_id` yang login berhak akses `resource_id` tertentu) tetap jadi tanggung jawab aplikasi (module Auth, lihat `BACKEND_GUIDE.md` §3), bukan Postgres.

---

## 2. Prinsip Boundary: Akses Data Lintas Module

Berbeda dari sistem microservices (yang boundary-nya lintas *service* lewat HTTP), modular monolith punya boundary lintas *module dalam satu binary* (`BACKEND_GUIDE.md` §0):

- **Dilarang** satu module mengakses tabel milik module lain secara langsung lewat query SQL/GORM. Akses **wajib** lewat interface Go yang diekspor module pemilik data (mis. `UserRegistry.GetByID(...)`), dipanggil sebagai fungsi biasa dalam satu proses — **bukan** lewat HTTP client seperti pada microservices.
- **Dilarang** foreign key constraint fisik yang menyeberang dua database fisik berbeda (kalau memakai pola multi-tenant §0: menyeberang Shared/Core DB dan Tenant DB, atau antar Tenant DB) — secara fisik ini adalah database Postgres yang berbeda, FK antar database tidak mungkin dibuat di Postgres, tapi ini juga ditegaskan sebagai **prinsip** desain: kalau perlu data dari database lain, ambil lewat pemanggilan interface module pemilik data, simpan hanya ID mentah kalau perlu referensi.
- Pengecualian yang sah: FK **di dalam** database fisik yang sama antar tabel yang memang didesain berelasi langsung — dokumentasikan relasi FK yang disengaja ini di dokumen arsitektur project Anda.

---

## 3. Konvensi Skema

### A. Struktur File Migrasi

- Migrasi ditulis lewat `golang-migrate`, format `NNNN_description.up.sql` / `.down.sql`, raw SQL — **bukan** ORM migration tool otomatis (`db.AutoMigrate()` GORM dilarang di jalur produksi, lihat `BACKEND_GUIDE.md` §5.A).
- **Struktur folder migrasi tergantung pola database Anda (§0):**
  - Satu database → satu folder `migrations/`, migrasi linear seperti biasa.
  - Pola multi-tenant → dua folder terpisah: `migrations/shared/` (migrasi linear untuk Shared/Core DB) dan `migrations/tenant-template/` (cetakan skema dasar Tenant DB — dijalankan penuh dari awal setiap kali Tenant DB baru dibuat, bukan "migrasi incremental" dalam pengertian biasa untuk database yang sudah eksis lama).

### B. Penamaan

- Nama tabel snake_case plural (`orders`, `provisioning_jobs`) — konsisten di seluruh dokumen sumber project Anda, jangan menerjemahkan ulang ke PascalCase/singular mengikuti konvensi ORM lain.
- Nama kolom snake_case (`user_id`, `created_at`), tag GORM eksplisit `gorm:"column:..."` (lihat `BACKEND_GUIDE.md` §5.B) — jangan mengandalkan auto-mapping.
- Foreign key kolom eksplisit dengan suffix `_id` (`order_id`, `user_id`), konsisten dengan skema yang sudah didefinisikan di dokumen arsitektur data project Anda.

### C. Penamaan Artefak Khas Domain Anda *[Isi sesuai kebutuhan project]*

Kalau project Anda punya string bebas yang jadi kontrak antara backend dan frontend/konsumen lain (bukan nama tabel/kolom — mis. tipe kategori, key konfigurasi dinamis), string itu butuh konvensi penamaan sendiri, terpisah dari konvensi kolom database. Contoh pola yang umum dipakai:

- **Tipe/kategori yang dipetakan ke komponen frontend**: kebab-case (`hero-banner`, `product-grid`) — alasan kebab-case (bukan snake_case seperti kolom database): identifier ini pada akhirnya dipetakan ke nama komponen di ekosistem frontend, dan kebab-case adalah konvensi umum di sana.
- **Key konfigurasi hierarkis**: dotted path snake_case (`theme.primary_color`, `seo.default_title`) — prefix sebelum titik pertama menunjukkan kelompok logis, tidak wajib cocok dengan struktur folder atau tabel apa pun, murni konvensi penamaan supaya mudah dibaca manusia.
- Kalau menemukan kebutuhan artefak baru jenis ini saat implementasi, **ikuti pola yang sudah ditetapkan** di dokumen kosakata/konvensi project Anda — jangan memilih gaya baru per kasus.

### D. Primary Key

- `UUID` native Postgres (extension `pgcrypto`), default `gen_random_uuid()`, tipe kolom `uuid` — bukan autoincrement integer, bukan `cuid()`.
- GORM: kolom `id` bertipe `string`, tag `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey"`.

### E. Timestamp Wajib

- Setiap tabel (kecuali tabel junction murni) wajib punya `created_at` dan `updated_at`.
- Kalau ada tabel yang sengaja tidak punya kolom tertentu yang biasanya ada di tabel sejenis (mis. tabel konfigurasi tanpa kolom `status` karena tidak melalui alur draft/publish), itu **wajib** didokumentasikan sebagai keputusan eksplisit di dokumen arsitektur data — bukan dianggap kelalaian, dan jangan "diperbaiki" dengan menambahkan kolom itu demi konsistensi kosmetik.

### F. Payload JSON Bebas — Wajib Dipertahankan Kalau Memang Didesain Begitu, Bukan Cela yang Perlu Diperbaiki

**Ini aturan paling penting untuk dipahami sebelum menyentuh skema yang memakai kolom payload fleksibel:**

- Kolom payload/konfigurasi yang memang didesain bebas bentuk **wajib** bertipe `jsonb`, **tanpa** constraint struktur di level kolom/tabel (tidak ada kolom terpisah per field, tidak ada `CHECK` constraint yang memvalidasi bentuk JSON-nya).
- Validasi struktur terjadi di **application layer**, saat data dibaca (render/consume) dan saat data ditulis (create/update) — dengan mencocokkan terhadap schema yang tersimpan terpisah (mis. tabel manifest/definisi field terkait), didokumentasikan di dokumen arsitektur data project Anda.
- **Dilarang** "merapikan" ini dengan memecah payload jadi kolom-kolom terpisah meski itu terlihat lebih idiomatic untuk GORM/SQL — kalau desain aslinya memang menopang model dinamis (tipe/kategori baru = baris definisi baru, bukan kolom/migrasi baru), memecahnya jadi kolom adalah regresi arsitektur, bukan perbaikan.

---

## 4. Migrasi Tenant DB — Cetakan yang Direplay *[Pola multi-tenant — opsional]*

Bagian ini hanya berlaku kalau project Anda memakai pola multi-tenant dari §0. Kalau tidak, lewati bagian ini.

### A. Menjalankan migrasi untuk tenant baru (provisioning)

Setiap kali tenant baru diprovisioning, module provisioning menjalankan **seluruh** isi `migrations/tenant-template/` secara berurutan terhadap database yang baru dibuat — bukan migrasi incremental terhadap database yang sudah eksis. Ini job satu-kali per tenant, dipicu programatik dari dalam provisioning pipeline, **bukan** dijalankan manual lewat command line seperti migrasi Shared/Core DB biasa.

### B. Menjalankan migrasi baru terhadap tenant yang sudah eksis (skema dasar berubah)

Kalau skema dasar Tenant DB berubah, migrasi baru itu **wajib direplay ke setiap Tenant DB yang sudah ada satu per satu** — ini pekerjaan berbeda dari §4.A, dan butuh skrip maintenance tersendiri yang bisa iterasi semua tenant.

**Aturan wajib:** migrasi baru untuk Tenant DB **harus backward-compatible** terhadap tenant yang mungkin sedang menjalankan skema versi sebelumnya saat proses replay belum selesai ke semua tenant (mis. kolom baru harus nullable dulu, bukan `NOT NULL` langsung) — karena replay ke puluhan/ratusan Tenant DB tidak terjadi atomik dalam satu transaksi, ada jeda waktu di mana sebagian tenant sudah ter-update dan sebagian belum.

### C. Versi skema Tenant DB

Setiap Tenant DB perlu mencatat **versi skema dasarnya sendiri** — tabel kecil (mis. `schema_version` dengan satu baris berisi nomor migrasi terakhir yang berhasil dijalankan terhadap Tenant DB itu) supaya sistem bisa mengetahui tenant mana yang skemanya masih tertinggal dan perlu di-replay.

### D. Kegagalan migrasi di tengah provisioning

Kalau `CREATE DATABASE` berhasil tapi migrasi skema dasar gagal di tengah jalan (§4.A):
- Tenant DB yang setengah jadi **tidak** langsung di-`DROP` otomatis — job provisioning masuk status `failed` mengikuti pola job table, Tenant DB yang gagal dibiarkan ada untuk keperluan debugging manual oleh tim.
- Retry migrasi **wajib idempotent** — setiap statement migrasi individual harus aman dijalankan ulang (mis. `CREATE TABLE IF NOT EXISTS`, bukan `CREATE TABLE` polos) supaya retry dari step yang gagal tidak error karena sebagian tabel sudah sempat terbuat di percobaan sebelumnya.
- Pembersihan Tenant DB yang gagal permanen (setelah retry habis) adalah tindakan manual lewat Admin/Ops, bukan otomatis.

---

## 5. Migrasi — Aturan Umum (Semua Tingkat Database)

- Satu perubahan skema untuk satu resource/tabel = satu migrasi, nama deskriptif.
- Dilarang menumpuk perubahan skema beberapa resource yang tidak berkaitan dalam satu migrasi.
- Migrasi yang mengubah kolom yang sudah dipakai production mengikuti pola backward-compatible bertahap (tambah kolom baru → migrasi data → hapus kolom lama di migrasi terpisah).
- Seed data (kalau dibutuhkan untuk development) ditulis sebagai script terpisah per resource, bukan ditumpuk dalam satu file besar.

---

## 6. Indexing

- Kolom yang dipakai sebagai foreign key wajib diberi index.
- Kolom yang sering dipakai untuk filter/where clause yang sudah diketahui sejak desain (mis. kolom tipe/kategori, `status`) diberi index eksplisit — bukan ditambahkan reaktif setelah masalah performa muncul, tapi juga tidak index semua kolom "just in case".
- Kolom unique memakai constraint `UNIQUE` yang otomatis membuat index sekaligus — jangan buat index manual terpisah untuk hal yang sama.

---

## 7. Testing dengan Database

- **Unit test** (business logic di Service layer): mock `Repository` interface, tidak menyentuh Postgres sama sekali — sama seperti konvensi Go pada umumnya (lihat `BACKEND_GUIDE.md` §10).
- **Integration test untuk module yang membaca/menulis database tetap** (bukan yang dibuat dinamis): pakai satu database test yang di-setup sekali di awal test suite (bukan sekali per test case), reset isinya (`TRUNCATE`, bukan `DROP`+`CREATE` ulang) antar test case kalau perlu state bersih.
- **Kalau memakai pola multi-tenant (§0), integration test untuk module provisioning**: dijalankan terhadap **Postgres lokal sungguhan** (bukan mock) karena yang diuji justru adalah kemampuan sistem melakukan `CREATE DATABASE` dan menjalankan migrasi — mock di titik ini akan menyembunyikan bug yang justru paling penting diketahui. Setiap test run membuat database dengan nama unik (mis. suffix random/timestamp) dan **wajib** membersihkannya (`DROP DATABASE`) di teardown, supaya test tidak meninggalkan sampah database yang menumpuk di instance Postgres development.
- Kalau butuh isolasi test dari data development dan provider Anda tidak menyediakan fitur branching database, gunakan Postgres terpisah (port berbeda) atau container Postgres lokal untuk CI.

---

## 8. Checklist Validasi Sebelum Selesai (untuk AI)

Sebelum menganggap perubahan skema/tabel baru "selesai", pastikan:

- [ ] Tabel diarahkan ke database yang benar — kalau memakai pola multi-tenant, Shared/Core DB untuk entity lintas-tenant, Tenant DB untuk data milik satu tenant (§0)
- [ ] Tidak ada akses lintas module langsung ke tabel — wajib lewat interface Go module pemilik data (§2)
- [ ] Tidak ada FK yang menyeberang dua database fisik berbeda (§2)
- [ ] Migrasi ditulis di folder yang benar sesuai pola database project Anda (§3.A)
- [ ] Nama tabel/kolom mengikuti snake_case, FK bersuffix `_id` (§3.B)
- [ ] Artefak khas domain (tipe/kategori, key konfigurasi) mengikuti konvensi yang sudah ditetapkan project Anda (§3.C)
- [ ] Primary key UUID native, bukan autoincrement (§3.D)
- [ ] `created_at`/`updated_at` ada di tabel yang relevan; pengecualian kolom didokumentasikan eksplisit, bukan diam-diam (§3.E)
- [ ] Kolom payload JSON yang memang didesain bebas bentuk tetap `jsonb` tanpa constraint struktur — validasi ada di application layer, bukan di database (§3.F)
- [ ] Migrasi Tenant DB baru (kalau ada) bersifat backward-compatible untuk mengakomodasi jeda replay antar-tenant (§4.B)
- [ ] Statement migrasi idempotent (aman di-retry) — relevan khususnya untuk migrasi yang dijalankan programatik saat provisioning (§4.D)
- [ ] Migrasi satu resource tidak dicampur dengan resource lain yang tidak berkaitan (§5)
- [ ] Foreign key column punya index (§6)
- [ ] Test yang menyentuh `CREATE DATABASE` sungguhan membersihkan database test di teardown (§7)
