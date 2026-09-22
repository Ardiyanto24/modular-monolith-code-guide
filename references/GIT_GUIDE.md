AI INSTRUCTION GUIDE: Git Strategy & CI/CD — Single Binary Modular Monolith (Universal Template, v1)

Instruksi ini adalah aturan mutlak (source of truth) untuk strategi branching, commit, tagging, dan CI/CD pada repository ini. AI harus mematuhi panduan ini secara ketat tanpa pengecualian.

**Cara pakai dokumen ini:** ini adalah template generik untuk repository backend yang di-deploy sebagai **satu binary modular monolith** (lihat `BACKEND_GUIDE.md` §0) — bukan microservices. Kalau repository Anda berisi banyak unit yang di-deploy independen (mis. beberapa service backend, atau frontend di repo yang sama), sebagian aturan path-based/tagging per-unit di sini perlu disesuaikan atau digabung dengan pola versioning per-unit yang lebih umum.

Dokumen ini adalah satu dari empat panduan yang saling melengkapi:
- **`BACKEND_GUIDE.md`** — struktur module, layer, komunikasi antar module
- **`DATABASE_GUIDE.md`** — aturan database, migrasi, boundary data
- **`FRONTEND_GUIDE.md`** — struktur aplikasi frontend
- **`GIT_GUIDE.md`** (dokumen ini) — strategi commit, branch, tag, CI/CD

Sumber kebenaran produk: dokumen requirement/arsitektur project Anda sendiri.

---

## 0. Prinsip Dasar: Satu Repo, Satu Binary, Banyak Module

- Repository ini berisi **satu backend** yang di-deploy sebagai satu binary (`cmd/server`) plus, opsional, satu binary CLI terpisah (`cmd/cli` — lihat `BACKEND_GUIDE.md` §4). Kalau frontend berada di repo/deployment terpisah, itu di luar cakupan panduan ini — sesuaikan §1-§3 kalau repo Anda menggabungkan frontend dan backend dalam satu tempat.
- **Satu branch utama (`main`)**, tidak ada `develop`/`release/*` per Git Flow klasik.
- **Satu urutan versi (semver) untuk seluruh backend** — karena hanya ada satu binary yang di-deploy, bukan banyak service dengan versinya sendiri-sendiri. Tidak ada tag per-module (`backend/{module}@semver`) karena module tidak di-deploy independen.
- Granularitas yang dijaga bukan di level "unit mana yang berubah" (karena hanya ada satu unit deployment), melainkan di level **module dan layer** — commit tetap wajib granular per module/layer meski semuanya berakhir dalam satu rilis yang sama (lihat §3).

---

## 1. Branching

### A. `main` — Satu-satunya Branch Panjang Umur

- `main` selalu dalam keadaan bisa di-deploy (lolos test), meski belum tentu setiap commit di dalamnya sudah "dirilis" secara sengaja (rilis produksi ditandai tag, §2).
- Tidak boleh push langsung ke `main` — semua perubahan masuk lewat Pull Request, kecuali commit administratif kecil yang memang diizinkan otomatis (§4).

### B. Feature Branch — Diberi Prefix Module, Bukan Unit

Karena tidak ada banyak unit/service untuk dibedakan, prefix branch menyebut **module** yang disentuh, bukan nama service:

- Format: `feat/{module}-{deskripsi-singkat}`, `fix/{module}-{deskripsi-singkat}`, `chore/{module}-{deskripsi-singkat}`.
- `{module}` adalah salah satu module yang didefinisikan project Anda — mengikuti nama folder di `internal/modules/` (`BACKEND_GUIDE.md` §1).
- Contoh: `feat/orders-add-refund-flow`, `fix/notifications-quota-reset-bug`.
- Perubahan lintas module (mis. wiring baru di `main.go` yang menyentuh beberapa module sekaligus) memakai `chore/multi-{deskripsi}`, dijelaskan cakupannya di deskripsi PR — usahakan dihindari kalau perubahan sebenarnya bisa dipecah jadi beberapa PR per module.
- Perubahan pada `internal/shared/` (dipakai lintas module) memakai `chore/shared-{deskripsi}`.
- Branch dibuat dari `main` terbaru, umur idealnya pendek (jam-hari, bukan minggu).
- Merge ke `main` wajib lewat Pull Request.

### C. Tidak Ada Branch Panjang per Module

Tidak dibuat `develop/{module}` atau semacamnya. Stabilisasi dilakukan lewat automated testing di CI dan staged deployment (staging dulu, baru production, §3.C), bukan pembekuan branch manual.

---

## 2. Tagging & Versioning

Karena hanya ada satu binary yang di-deploy, versioning jauh lebih sederhana dari versi monorepo multi-unit:

### A. Format Tag

```
backend@{semver}                mis. backend@1.4.0
cli@{semver}                    mis. cli@1.4.0 (kalau project Anda punya CLI tool terpisah, lihat BACKEND_GUIDE.md §4)
```

- `backend@{semver}` untuk binary server (`cmd/server`) — satu urutan versi untuk seluruh module HTTP, karena semuanya dikompilasi dan di-deploy sebagai satu artefak.
- `cli@{semver}` **terpisah** dari `backend@{semver}` — kalau project Anda punya CLI tool internal (`BACKEND_GUIDE.md` §4), meski dikompilasi dari kode di repo yang sama, CLI ini didistribusikan sebagai binary mandiri ke mesin engineer, bukan di-deploy sebagai bagian dari server. Perubahan pada module HTTP tidak otomatis butuh rilis `cli` baru, dan sebaliknya. Kalau project Anda tidak punya CLI terpisah, hapus baris ini.
- Semver (`MAJOR.MINOR.PATCH`) standar: `MAJOR` untuk perubahan kontrak API/skema yang tidak backward-compatible, `MINOR` untuk fitur baru backward-compatible, `PATCH` untuk bug fix.

### B. Kapan Tag Dibuat

- Setelah commit relevan sudah di `main` dan lolos staging.
- Membuat tag rilis (memicu deploy production) **wajib menunggu instruksi eksplisit dari user** — tidak pernah dianggap diizinkan otomatis hanya karena staging stabil (§5).
- Satu tag boleh mencakup gabungan beberapa PR yang sudah masuk `main`.

### C. Changelog

- Satu `CHANGELOG.md` di root repo, mencakup seluruh backend (server + CLI kalau ada) — karena hanya ada satu repo/binary utama, tidak perlu dipecah per module.
- Format Keep a Changelog, di-update sebagai bagian dari commit yang membuat tag baru.

---

## 3. CI/CD — GitHub Actions

### A. Tidak Ada Path-Based Trigger per Module

Berbeda dari versi microservices yang men-trigger CI berbeda tergantung folder yang berubah — karena seluruh module dikompilasi jadi **satu binary**, perubahan di module manapun tetap butuh build+test seluruh binary untuk memastikan tidak ada regresi lintas module (mengingat module saling memanggil lewat interface Go langsung, `BACKEND_GUIDE.md` §3.A — perubahan interface satu module bisa mematahkan compile module lain).

- **Satu workflow file**: `.github/workflows/backend.yml`, trigger pada setiap push/PR ke `main` tanpa filter `paths:`.
- Job: `go build ./...`, `go test ./...`, build image Docker untuk `cmd/server`.
- Kalau ada binary CLI (`cmd/cli`), build sebagai job terpisah dalam workflow yang sama (bukan workflow file terpisah) — supaya tetap satu status CI yang mudah dipantau, meski artefaknya dua binary berbeda.

### B. Staging dan Production

- Merge ke `main` yang lolos CI → deploy otomatis ke staging.
- Deploy production dipicu oleh tag rilis (§2.B), tidak otomatis dari merge biasa.

---

## 4. Granularitas Commit — Per Module dan Per Layer

Meski hanya ada satu unit deployment, granularitas commit **tetap wajib per module dan per layer** — supaya histori git tetap bisa ditelusuri dengan jelas module mana yang berubah kapan, dan review PR tetap fokus.

### A. Satu Resource/Module Baru dari Nol

| Level | Kapan commit | Contoh scope commit |
|---|---|---|
| Migrasi | Setelah model + migrasi selesai | `feat(db): add order_items table` |
| Model GORM | Setelah model dibuat, mencerminkan migrasi | `feat({module}/model): add Order model` |
| Repository | Setelah 1 repository selesai | `feat({module}/repository): add order repository` |
| Interface | Setelah interface publik didefinisikan | `feat({module}/interface): define OrderService interface` |
| Service | Setelah 1 service selesai | `feat({module}/service): add refund logic` |
| DTO (jika ada endpoint HTTP) | Setelah DTO selesai | `feat({module}/dto): add refund response dto` |
| Handler (jika ada endpoint HTTP) | Setelah 1 handler selesai | `feat({module}/handler): add refund endpoint handler` |
| Wiring ke router/`main.go` | Setelah endpoint didaftarkan | `feat({module}): wire refund endpoint to router` |
| Pemanggilan ke module lain (interface) | Setelah pemanggilan diimplementasikan | `feat({module-a}/service): call {module-b} on refund` |
| Shared util | Setelah 1 util selesai | `feat(shared/httpx): add JSON response helper` |
| Test | Setelah `_test.go` selesai (commit terpisah dari kode produksinya) | `test({module}/service): add refund unit tests` |
| Dokumentasi | Setelah update CHANGELOG | `docs: update CHANGELOG for 1.4.0` |

**Contoh konkret satu module baru dari nol:**
```
feat(db): orders table already covered — no new migration needed
feat(orders/model): add Order model
feat(orders/repository): add order repository
feat(orders/interface): define OrderService interface
feat(orders/service): add refund validation logic
feat(orders/dto): add refund request/response dto
feat(orders/handler): add refund endpoint handler
feat(orders): wire refund endpoint to router
test(orders/service): add refund validation unit tests
```
Sembilan commit terpisah — bukan satu commit "feat: refund selesai".

### B. Larangan Lintas Module dalam Satu Commit

**Dilarang** satu commit menyentuh lebih dari satu module (`internal/modules/{a}/` dan `internal/modules/{b}/`) sekaligus, kecuali perubahan root-level (§4.C) atau wiring lintas-module yang memang secara alami satu kesatuan perubahan kecil (mis. menambah satu baris pemanggilan interface di `service A` yang memanggil `interface B` yang sudah ada sebelumnya — ini boleh satu commit karena perubahan riilnya cuma di module A, module B tidak ikut berubah).

Kalau perubahan benar-benar butuh mengubah kedua module sekaligus (mis. menambah method baru di interface B **dan** pemanggilnya di A), pecah jadi dua commit berurutan: dulu tambah method di interface+service B, baru tambah pemanggilan di A — supaya tiap commit tetap bisa diaudit sebagai satu perubahan logis di satu module.

### C. Perubahan Root-Level

Untuk file yang bukan milik satu module spesifik (`docker-compose.yml`, `Dockerfile`, `go.mod` root, `README.md`, workflow CI):

- Scope commit: `chore(root)` atau `docs(root)`.
- Masuk lewat PR biasa seperti module lain, scope-nya `root`.

---

## 5. Gating — Aksi yang Wajib Menunggu Instruksi Eksplisit

**Boleh dilakukan otomatis:**
- `git init` (kalau `.git/` belum ada), commit lokal ke feature branch, `.gitignore`.
- Push feature branch ke remote yang **sudah ada**.
- Membuka Pull Request dari feature branch ke `main`.
- Deploy otomatis ke **staging** yang dipicu CI dari merge ke `main`.

**WAJIB MENUNGGU INSTRUKSI EKSPLISIT dari user:**
- Membuat repository baru (GitHub/GitLab/dst).
- Push pertama kali ke remote yang baru dibuat.
- Merge PR ke `main` untuk perubahan signifikan (AI dapat menyiapkan PR, keputusan merge dikonfirmasi user, kecuali user sudah menyatakan kebijakan auto-merge untuk kasus tertentu).
- **Membuat git tag rilis** (`backend@{semver}` atau `cli@{semver}`) — selalu butuh instruksi eksplisit, tidak pernah dianggap diizinkan hanya karena staging sudah stabil.
- Deploy manual ke production di luar alur tag.
- Mengubah workflow CI/CD yang menyentuh kredensial/secret produksi (termasuk kredensial infrastruktur, koneksi database role admin — lihat `DATABASE_GUIDE.md` §1).
- Menjalankan migrasi yang mengubah skema secara masal ke banyak database sekaligus (mis. replay migrasi Tenant DB ke semua tenant yang sudah eksis, `DATABASE_GUIDE.md` §4.B, kalau project Anda memakai pola multi-tenant) — ini operasi berdampak luas ke data produksi milik banyak klien sekaligus, selalu butuh konfirmasi eksplisit sebelum dieksekusi meski kodenya sendiri sudah lolos review.

Ringkasan: **git init, commit lokal, push ke remote yang sudah ada, buka PR, deploy staging otomatis → boleh otomatis. Buat repo baru, push pertama ke remote baru, merge PR besar, buat tag rilis, deploy production, migrasi massal ke banyak database sekaligus → tunggu instruksi eksplisit.**

---

## 6. Checklist Validasi Sebelum Selesai (untuk AI)

- [ ] Feature branch diberi nama sesuai pola `{type}/{module}-{deskripsi}` (§1.B)
- [ ] Branch dibuat dari `main` terbaru
- [ ] Tidak ada satu commit yang menyentuh lebih dari satu module, kecuali perubahan root-level atau wiring kecil satu arah (§4.B-C)
- [ ] Setiap layer (migrasi/model/repository/interface/service/dto/handler) yang dibuat sudah punya commit terpisah, urut bottom-up (§4.A)
- [ ] Pesan commit mengikuti `type(scope): deskripsi`, scope menyebut module secara eksplisit (§4.A)
- [ ] Tag rilis (jika dibuat) memakai format `backend@semver` atau `cli@semver` (§2.A)
- [ ] Tidak ada push langsung ke `main` di luar merge PR
- [ ] Tidak ada tag rilis dibuat, repo baru dibuat, deploy production dilakukan, atau migrasi massal lintas database dijalankan tanpa instruksi eksplisit user (§5)
- [ ] `CHANGELOG.md` root diperbarui kalau perubahan ini bagian dari rilis bertag (§2.C)
- [ ] Tidak ada `.env` atau kredensial yang ter-commit

Jalankan `git log --oneline` di akhir task untuk menunjukkan bahwa commit sudah terpisah per module/layer, bukan satu commit tunggal untuk seluruh fitur.
