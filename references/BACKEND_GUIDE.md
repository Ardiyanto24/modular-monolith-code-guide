AI INSTRUCTION GUIDE: Backend Architecture — Go Modular Monolith (Universal Template, v1)

Instruksi ini adalah aturan mutlak (source of truth) untuk menyusun struktur repositori, penamaan berkas, dan pembagian layer pada backend berbasis Go yang dibangun sebagai **modular monolith** — satu binary, banyak module internal. AI harus mematuhi panduan ini secara ketat tanpa pengecualian, kecuali diarahkan lain oleh dokumen kebutuhan produk/arsitektur milik project yang sedang dikerjakan.

**Cara pakai dokumen ini:** ini adalah template generik. Ganti seluruh placeholder (`{project}`, `{module}`, `{module-a}`, dst.) dengan nama nyata sesuai domain bisnis project Anda sebelum dipakai sebagai instruksi kerja sehari-hari. Bagian yang ditandai *[Opsional]* hanya relevan kalau arsitektur project Anda memang membutuhkan pola tersebut (mis. multi-tenant, CLI tool terpisah) — hapus kalau tidak relevan, jangan dipaksakan.

Dokumen ini adalah satu dari empat panduan yang saling melengkapi:
- **`BACKEND_GUIDE.md`** (dokumen ini) — struktur module, layer, dan komunikasi antar module
- **`DATABASE_GUIDE.md`** — aturan database, migrasi, dan boundary data
- **`FRONTEND_GUIDE.md`** — struktur aplikasi frontend
- **`GIT_GUIDE.md`** — strategi commit, branch, dan deploy

Sumber kebenaran produk: dokumen requirement/arsitektur project Anda sendiri (PRD, architecture decision record, spesifikasi module, dsb). Kalau ada pertentangan antara dokumen ini dan dokumen sumber tersebut, **dokumen sumber yang menang** — laporkan pertentangan itu, jangan diam-diam memilih salah satu.

---

## 0. Prinsip Dasar: Satu Binary, Banyak Module, Interface sebagai Boundary

- Backend adalah **satu binary Go** — bukan kumpulan service yang di-deploy independen. Seluruh module yang didefinisikan project Anda hidup dalam proses yang sama.
- Setiap module mengekspos **interface Go**. Module lain memanggilnya sebagai **pemanggilan fungsi biasa dalam satu proses** — bukan HTTP call, bukan message queue. Ini beda fundamental dari pola microservices: tidak ada `internal/clients/{service}_client.go` yang menembak endpoint lewat jaringan; yang ada adalah pemanggilan langsung ke interface module lain lewat dependency injection.
- **Boundary antar module ditegakkan oleh disiplin package Go dan review, bukan oleh compiler seperti `internal/` pada microservices** — karena semua module memang berada dalam satu module Go (`go.mod` tunggal untuk seluruh binary), `internal/` di sini berfungsi mencegah import dari **luar binary** (mis. tool CLI terpisah), bukan mencegah module saling meng-import satu sama lain. Disiplin "module A tidak boleh query tabel milik module B" wajib dijaga manual lewat convention dan code review, didukung test yang memverifikasi module hanya memanggil lewat interface.
- Module fondasi yang dipakai lintas domain bisnis (mis. Auth, Notification — kalau project Anda punya) tetap **module di dalam binary yang sama**, bukan service terpisah — meskipun secara konseptual "generik lintas fitur", secara fisik mereka tetap satu deployment unit untuk saat ini.
- Kalau project Anda memang berbentuk microservices sungguhan (banyak binary, banyak deployment unit terpisah), sebagian besar aturan komunikasi antar-module di §3 tidak relevan dan perlu didesain ulang — dokumen ini secara spesifik untuk modular monolith.

---

## 1. Arsitektur Folder

```
backend/
├── cmd/
│   └── server/
│       └── main.go                     # entrypoint tunggal: wiring seluruh module, config, db, router, worker, graceful shutdown
│   └── cli/                            # [Opsional] hanya kalau project butuh CLI tool terpisah, lihat §4
│       └── main.go
├── internal/
│   ├── modules/
│   │   ├── {module-a}/                 # satu folder per module, nama sesuai domain bisnis project Anda
│   │   ├── {module-b}/
│   │   ├── {module-c}/
│   │   └── {module}/
│   │       ├── {module}_interface.go   # interface yang diekspor untuk dipanggil module lain
│   │       ├── {module}_service.go     # implementasi interface, business logic
│   │       ├── {module}_repository.go  # akses data milik module ini sendiri
│   │       ├── {module}_model.go       # struct GORM
│   │       ├── {module}_dto.go         # (hanya untuk module yang punya HTTP endpoint sendiri)
│   │       └── {module}_handler.go     # (hanya untuk module yang punya HTTP endpoint sendiri)
│   ├── httpapi/                        # HTTP layer bersama — router utama, wiring endpoint ke handler tiap module
│   │   ├── router.go
│   │   └── middleware/
│   ├── worker/                         # [Opsional] job/worker background kalau project butuh (mis. antrian, job async)
│   ├── shared/                         # lintas-module DALAM binary ini (lihat §6-7)
│   │   ├── apperror/
│   │   ├── httpx/
│   │   └── util/
│   └── config/
│       ├── env.go
│       └── database.go                 # koneksi database — lihat DATABASE_GUIDE.md §0 untuk pola single vs multi-tenant
├── migrations/                         # struktur folder migrasi tergantung pola database project Anda — lihat DATABASE_GUIDE.md §3.A
├── Dockerfile
├── .dockerignore
├── go.mod / go.sum                     # satu module Go untuk seluruh binary — tidak dipecah per module
└── .env.example
```

**Perbedaan paling signifikan dari versi microservices:** tidak ada folder `{service-name}/` yang masing-masing punya `go.mod` sendiri. Seluruh module hidup di bawah satu `internal/modules/`, satu `go.mod` di root.

**Penamaan:** `{module}` lowercase tanpa pemisah (mis. `orderprocessor`, bukan `order-processor` atau `order_processor`) — mengikuti konvensi resmi Go untuk nama package (huruf kecil semua, tanpa underscore/hyphen). Nama file Go tetap snake_case (`order_processor_service.go`).

---

## 2. Tanggung Jawab Tiap Layer

### A. Interface (`{module}_interface.go`)

Kontrak yang diekspor untuk dipanggil module lain — **ini pengganti peran HTTP client di sistem microservices**. Setiap module yang perlu dipanggil module lain wajib mendefinisikan interface publik di sini, bukan mengekspor struct implementasi secara langsung.

```go
// internal/modules/{module-a}/{module-a}_interface.go
package {module-a}

import "context"

type {ModuleA} interface {
	GetByID(ctx context.Context, id string) (*Entity, error)
	Create(ctx context.Context, input CreateInput) (*Entity, error)
	UpdateStatus(ctx context.Context, id string, status string) error
}
```

**Dilarang** module lain memanggil struct implementasi konkret secara langsung — selalu lewat tipe interface ini, di-inject saat wiring di `main.go`. Ini menjaga agar boundary antar module tetap bisa ditegakkan lewat disiplin meski secara teknis Go mengizinkan akses langsung dalam satu binary (lihat §0).

### B. Service (`{module}_service.go`)

Implementasi konkret dari interface — business logic, orkestrasi ke repository sendiri dan/atau ke interface module lain (§3), transformasi data. Menerima `context.Context` sebagai parameter pertama di setiap method yang melakukan I/O.

```go
// internal/modules/{module-a}/{module-a}_service.go
package {module-a}

type service struct {
	repo      Repository
	moduleB   {moduleb}.{ModuleB} // interface module lain, di-inject
	moduleC   {modulec}.{ModuleC}
}

func NewService(repo Repository, mb {moduleb}.{ModuleB}, mc {modulec}.{ModuleC}) {ModuleA} {
	return &service{repo: repo, moduleB: mb, moduleC: mc}
}

func (s *service) Create(ctx context.Context, input CreateInput) (*Entity, error) {
	ref, err := s.moduleB.GetByID(ctx, input.RefID) // panggilan fungsi biasa, bukan HTTP
	if err != nil {
		return nil, fmt.Errorf("mengambil referensi: %w", err)
	}
	// ... orkestrasi business logic
}
```

### C. Repository (`{module}_repository.go`)

Query GORM untuk data milik module ini sendiri. Tidak ada business logic. Mengimplementasikan interface `Repository` yang didefinisikan di file service.

**Dilarang** repository satu module melakukan query ke tabel milik module lain (`DATABASE_GUIDE.md` §2) — kalau butuh data itu, panggil interface module pemilik lewat service layer, bukan query langsung.

### D. Model (`{module}_model.go`)

Struct GORM yang mencerminkan tabel — tag `gorm:"column:...;type:..."` mengikuti skema fisik hasil migrasi (`DATABASE_GUIDE.md` §3), bukan didesain bebas oleh GORM. Migrasi (`migrations/`) adalah source of truth skema, model tinggal mencerminkannya.

### E. DTO dan Handler (`{module}_dto.go`, `{module}_handler.go`) — hanya untuk module dengan endpoint HTTP sendiri

Tidak semua module butuh ini. Tentukan berdasarkan apakah module dipanggil dari luar binary atau murni dari dalam:

| Kondisi module | Punya endpoint HTTP? |
|---|---|
| Dipanggil langsung oleh client eksternal (web app, mobile app, service lain di luar binary) | Ya |
| Jadi middleware/dipanggil module lain untuk otorisasi request masuk | Ya |
| Hanya dipanggil murni lewat interface Go dari module lain di dalam binary yang sama, tidak diakses langsung dari luar | Tidak perlu |
| CLI tool internal (§4) | Tidak — command line, bukan HTTP |

Module tanpa endpoint HTTP tidak perlu file `_dto.go`/`_handler.go` — cukup interface, service, repository, model.

---

## 3. Komunikasi Antar Module dan Autentikasi

### A. Antar Module dalam Binary yang Sama — Wajib Lewat Interface, Bukan HTTP

Ini pembalikan total dari versi microservices:

- Module A memanggil Module B lewat interface Go yang di-inject saat wiring di `main.go` — **bukan** `internal/clients/{module}_client.go` yang menembak HTTP.
- Tidak ada `{MODULE}_SERVICE_URL` environment variable untuk komunikasi antar module dalam binary yang sama (env var jenis ini hanya relevan kalau memanggil sistem eksternal sungguhan, mis. API pihak ketiga — lihat §3.C).
- Dependency antar module tetap harus terarah jelas, mengikuti dependency yang sudah didokumentasikan di dokumen arsitektur project Anda — dependency melingkar antar module adalah sinyal masalah arsitektur, sama seriusnya dengan circular dependency antar service pada microservices.

### B. Auth/Identity — Module Internal vs Provider Eksternal *[Sesuaikan dengan keputusan project Anda]*

Kalau project Anda memilih menerbitkan/memverifikasi session/token sendiri (bukan mendelegasikan ke provider identity eksternal seperti Auth0/Clerk/Firebase Auth):

- Auth/Identity adalah **module di dalam binary ini sendiri** yang menerbitkan dan memverifikasi session/token untuk klien — bukan JWT dari provider identity eksternal.
- Verifikasi dilakukan di middleware HTTP (`internal/httpapi/middleware/authenticate.go`), memanggil interface Auth/Identity lewat pemanggilan fungsi biasa (§3.A) — bukan fetch JWKS dari URL eksternal.
- Hasil verifikasi (klaim identitas — mis. `user_id`) diteruskan lewat `context.Context`, sama seperti idiom Go yang benar untuk data request-scoped.
- Middleware ini **wajib** memverifikasi kepemilikan resource (mis. `resource_id` yang diakses memang milik `owner_id`/`user_id` yang sedang login) sebelum meneruskan request ke module yang memuat data sensitif.

Kalau project Anda memakai provider identity eksternal, ganti bagian ini dengan pola verifikasi token/JWKS provider tersebut — prinsip "verifikasi di middleware, hasil diteruskan lewat context" tetap berlaku.

### C. Komunikasi ke Sistem Eksternal Sungguhan

Untuk pemanggilan ke sistem **di luar binary ini** (API pihak ketiga, object storage, payment gateway, dst) — ini **tetap** lewat HTTP client, dikumpulkan di `internal/modules/{module}/{module}_external_client.go` (bukan `internal/clients/` terpisah seperti versi microservices, karena biasanya tidak ada cukup banyak sistem eksternal untuk dikumpulkan jadi satu folder client bersama — cukup taruh di dalam module yang memanggilnya).

- Base URL/kredensial API eksternal lewat env var, diakses lewat `internal/config/env.go` (§7.G) — tidak pernah hardcode.

---

## 4. CLI Tool Internal — Binary Terpisah, Bukan HTTP Service *[Opsional]*

Kalau project Anda butuh command line tool internal (mis. tool maintenance yang dijalankan manual oleh engineer), berikut aturan khusus untuk kategori ini:

### A. Struktur

- Entrypoint terpisah: `cmd/cli/main.go`, di-compile jadi binary sendiri (`{project}-cli`), terpisah dari binary server utama (`cmd/server/main.go`) — meski keduanya berbagi kode dari `internal/modules/` yang sama.
- Struktur command mengikuti pola `cobra` (library CLI Go yang umum) atau `flag` standar library kalau command tetap sederhana — pilih yang paling minim dependency selama kebutuhan CLI masih sederhana.

### B. Kontrak

- `{project}-cli {command} <argumen>` — dokumentasikan argumen wajib dan flag opsional per command.
- **Exit code**: `0` untuk sukses, non-zero untuk gagal (standar Unix) — supaya bisa dicek dari script/SOP kalau perlu, meski dipakai manual oleh engineer.
- Output ke stdout untuk hasil sukses, stderr untuk error — **tidak** menulis ke file log terpisah kalau CLI tool ini dipakai interaktif oleh manusia, bukan proses background.

### C. Testing dan Definition of Done

Checklist khusus CLI tool ini (terpisah dari checklist HTTP module di §12, karena kategorinya beda):

- [ ] Bisa dijalankan sebagai binary mandiri (`go build -o {project}-cli ./cmd/cli`)
- [ ] Exit code `0` untuk sukses, non-zero untuk tiap kondisi gagal yang terdefinisi
- [ ] Pesan error di stderr cukup jelas untuk dibaca manusia langsung dari terminal (bukan JSON terstruktur seperti response API)
- [ ] Unit test untuk logic command menggunakan mock interface yang sama seperti module lain (§10) — tidak perlu binary sungguhan untuk unit test
- [ ] Didokumentasikan di README cara distribusi ke mesin engineer (`go install` dari repo, atau binary di-attach ke release)

---

## 5. GORM & Migrasi — Aturan Skema

### A. Migrasi via `golang-migrate`, BUKAN `db.AutoMigrate()`

**`db.AutoMigrate()` dilarang dipakai di jalur startup/produksi.** Alasan: tidak menghasilkan riwayat migrasi yang reproducible & ter-review lewat git, dan tidak cocok dengan kebutuhan migrasi-sebagai-cetakan kalau project Anda memakai pola database dinamis per-tenant (`DATABASE_GUIDE.md` §4). `AutoMigrate` paling jauh boleh dipakai untuk eksplorasi struct model secara lokal lalu dibuang.

- Format file: `migrations/{scope}/NNNN_description.up.sql` / `.down.sql` — struktur folder `{scope}` mengikuti pola database project Anda (lihat `DATABASE_GUIDE.md` §3.A untuk pola single-tenant vs multi-tenant).

### B. Model GORM

- PK: kolom `ID` bertipe `string`, tag `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey"` — menyelaraskan `DATABASE_GUIDE.md` §3.D.
- Kolom snake_case di database, tag `gorm:"column:created_at"` eksplisit.
- `CreatedAt`/`UpdatedAt` wajib ada di tiap tabel non-junction, kecuali ada pengecualian eksplisit yang didokumentasikan (`DATABASE_GUIDE.md` §3.E) — jangan mengasumsikan pengecualian tanpa dokumentasi tertulis.
- Kolom yang menyimpan payload/konfigurasi bebas bentuk bertipe `datatypes.JSON` (dari `gorm.io/datatypes`) atau `[]byte` dengan marshal/unmarshal manual — **tidak** dipecah jadi struct field terpisah kalau memang didesain sebagai payload fleksibel (`DATABASE_GUIDE.md` §3.F).

### C. Koneksi GORM — Satu Koneksi vs Registry Dinamis *[Sesuaikan dengan pola database project Anda]*

**Kalau project Anda satu database untuk semua data** (pola paling umum): satu `*gorm.DB`, diinstansiasi sekali di `internal/config/database.go`, dipakai seluruh module. Tidak perlu bagian ini lebih lanjut.

**Kalau project Anda multi-tenant dengan database terisolasi per-tenant** (`DATABASE_GUIDE.md` §0) — butuh **registry koneksi dinamis**, bukan satu koneksi tetap:

```go
// internal/config/database.go
type TenantConnectionRegistry struct {
	mu    sync.RWMutex
	pools map[string]*gorm.DB // key: tenant_id
}

func (r *TenantConnectionRegistry) GetOrOpen(ctx context.Context, tenantID string) (*gorm.DB, error) {
	r.mu.RLock()
	if db, ok := r.pools[tenantID]; ok {
		r.mu.RUnlock()
		return db, nil
	}
	r.mu.RUnlock()
	// buka koneksi baru, simpan ke map, kembalikan
}
```
- Kalau skala tenant masih kecil, seluruh koneksi Tenant DB **boleh dibiarkan terbuka sekaligus** tanpa masalah resource berarti — baru pertimbangkan mekanisme eviction/LRU kalau skala membesar.
- **Kapan koneksi baru dibuka:** saat tenant baru selesai diprovisioning, *atau* lazy saat request pertama untuk tenant itu masuk — pilih salah satu pola secara konsisten, jangan campur keduanya tanpa alasan jelas. Kalau tidak ada instruksi lain, default ke lazy-open karena lebih sederhana.
- Koneksi Tenant DB **wajib** memakai role aplikasi per-tenant (`DATABASE_GUIDE.md` §1), bukan role admin — connection string per tenant disusun dari kredensial role tenant itu, bukan satu `DATABASE_URL` global.

---

## 6. Search-Before-Create

Cek `internal/shared/util/` dulu sebelum bikin function baru. Kalau logic yang sama dibutuhkan di ≥2 module, itu sinyal untuk naik level ke `internal/shared/` (§7) — bukan mengulang implementasi, dan **bukan** sinyal untuk membuat module/service baru seperti pada microservices (karena tidak ada biaya deployment tambahan untuk berbagi kode dalam satu binary).

## 7. Kapan Logic "Naik Level" ke `internal/shared/`

Dipakai 1 module saja → tetap di `internal/modules/{module}/`. Dipakai ≥2 module → naik ke `internal/shared/util/` atau `internal/shared/apperror/`. Karena semua module ada dalam satu binary, "naik level" ini murni soal organisasi file, bukan soal boundary compiler seperti `internal/` pada microservices — tetap disiplin tidak menaruh logic spesifik satu module di `shared/` hanya karena "mungkin nanti dipakai module lain".

---

## 8. Kontainerisasi

### A. Prinsip 12-Factor

- Config lewat environment variable — semua akses `os.Getenv` hanya lewat `internal/config/env.go`, fail-fast di startup kalau ada var wajib yang hilang.
- Stateless process untuk binary server (`cmd/server`) — state apa pun yang bersifat cache/registry koneksi (§5.C) di-rebuild dari database saat startup, tidak disimpan di file lokal.
- Port lewat env var (`PORT`).
- Log ke stdout/stderr, `log/slog` untuk structured logging.
- Graceful shutdown: `signal.NotifyContext` + `server.Shutdown(ctx)`, menutup **seluruh** koneksi database yang terbuka (termasuk seluruh koneksi di registry dinamis §5.C kalau ada) saat shutdown — bukan cuma satu koneksi seperti pola service biasa.

### B. Dockerfile

Satu Dockerfile untuk binary server, multi-stage build:
- Stage `builder`: image Go resmi versi terbaru yang didukung, compile static binary (`CGO_ENABLED=0 go build -o /out/server ./cmd/server`), install `golang-migrate` CLI di stage yang sama untuk job migrasi.
- Stage `runtime`: base image minimal (`gcr.io/distroless/static-debian12` atau `scratch`) — image akhir hanya berisi binary statis.

**Binary CLI (kalau ada, §4) di-build terpisah** — tidak masuk image Docker yang sama dengan server, karena biasanya dijalankan di mesin engineer, bukan sebagai container yang berjalan terus.

### C. Docker Compose (Dev Lokal)

```yaml
db-migrate:
  build:
    context: .
    target: builder
  env_file: .env
  command: ["migrate", "-path", "migrations/{scope}", "-database", "$DATABASE_URL", "up"]

server:
  build:
    context: .
    target: runtime
  depends_on: [db-migrate]
  ...
```
Kalau project Anda multi-tenant dengan migrasi cetakan (`DATABASE_GUIDE.md` §4.A), migrasi tenant **tidak** dijalankan lewat docker-compose — itu dieksekusi programatik saat tenant diprovisioning, bukan job startup.

### D. `.gitignore`

Minimal: `bin/`, `*.exe`, `.env`, `*.log`.

---

## 9. Standar Penulisan Kode

### A. Satu File, Satu Tanggung Jawab

Batas ±200–250 baris. Kalau lewat, pecah jadi sub-file dalam module yang sama, atau itu sinyal module perlu dipecah lebih halus lagi (bukan sinyal untuk keluar jadi service terpisah, karena tidak ada konsep "service terpisah" di sistem ini).

### B. Error Handling Terpusat — Pola `httpx.Wrap`

```go
// internal/shared/httpx/handler.go
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

func Wrap(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			apperror.WriteJSON(w, err)
		}
	}
}
```
`internal/shared/apperror/` mendefinisikan `AppError` (`NotFoundError`, `ValidationError`, dst). Format JSON error: `{ "error": { "code": "...", "message": "...", "details": null } }`.

### C. Dependency Arah Satu Jalur

`router → handler → service → (repository dan/atau interface module lain) → gorm`. Untuk module lintas-module, arah tambahannya: `service A → interface module B → service B → repository B` — tidak boleh service A langsung memanggil repository B, harus lewat interface publik B.

### D. Import — Module Path Absolut Native

Path absolut dari module root (`{project}/internal/modules/{module}`).

### E. `context.Context` Wajib di Setiap Method I/O

Termasuk saat memanggil interface module lain — konteks dari request HTTP asli diteruskan sepanjang rantai pemanggilan, bahkan ketika rantai itu melintasi beberapa module dalam satu binary (bukan hanya dalam satu module seperti pada microservices, karena di sini tidak ada boundary HTTP baru yang "memotong" context saat berpindah module).

### F. Error Wrapping

`fmt.Errorf("mendeskripsikan konteks: %w", err)`. Dilarang menelan error diam-diam.

### G. Environment Variables

Semua akses `os.Getenv` hanya lewat `internal/config/env.go`, fail-fast di startup. Kategori variabel yang wajib dipisah (lihat `DATABASE_GUIDE.md` §1):
- Connection string database dengan role admin (dipakai migrasi/provisioning saja)
- Connection string database dengan role aplikasi (dipakai runtime)
- Kredensial API eksternal (payment gateway, object storage, dst)

---

## 10. Testing

File test co-located, suffix `_test.go`.

- Library: `github.com/stretchr/testify`, table-driven test.
- Service ditest dengan `Repository` interface **dan** interface module lain (§3.A) di-mock — unit test cepat, tidak butuh DB maupun module lain hidup.
- Repository ditest sebagai integration test — lihat `DATABASE_GUIDE.md` §7 untuk strategi test kalau project Anda punya database dinamis per-tenant.
- Test untuk alur lintas-module ditulis sebagai integration test yang men-setup beberapa module sungguhan sekaligus (bukan HTTP call bertingkat seperti microservices) — lebih murah dan cepat dijalankan karena semuanya dalam satu proses.

---

## 11. Kapan Menambah Module Baru vs Menambah ke Module yang Ada

- Module baru dibuat kalau tanggung jawabnya benar-benar berbeda domain dari module yang sudah ada.
- **Bukan** alasan sah untuk membuat module baru: "supaya bisa di-deploy terpisah" (tidak ada deployment terpisah dalam modular monolith), "supaya lebih modular" tanpa tanggung jawab domain yang jelas berbeda.
- Kalau ragu apakah sesuatu masuk module yang sudah ada atau perlu module baru, cek dulu apakah fungsinya sudah disebutkan di dokumen kebutuhan module/arsitektur project Anda — kalau tidak ketemu di manapun, tanyakan ke pengguna sebelum membuat module baru sendiri.

---

## 12. Checklist Validasi Sebelum Selesai (untuk AI)

Sebelum menganggap sebuah module/endpoint baru "selesai" (untuk module dengan HTTP endpoint):

- [ ] Module tidak mengakses tabel milik module lain secara langsung — lewat interface (§2.A, §2.C)
- [ ] Interface publik didefinisikan di `{module}_interface.go`, bukan struct implementasi yang diekspor langsung
- [ ] Tidak ada HTTP client (`internal/clients/`) dibuat untuk komunikasi antar module dalam binary yang sama — itu wajib pemanggilan fungsi langsung (§3.A)
- [ ] Auth/Identity (kalau ada) diverifikasi di middleware sebelum request masuk ke module yang menangani data sensitif, termasuk verifikasi kepemilikan resource (§3.B)
- [ ] Layer router, handler, service, repository, model ada sebagai file terpisah (untuk module yang punya HTTP endpoint)
- [ ] Handler tidak berisi query GORM langsung
- [ ] Repository tidak mengakses tabel milik module lain
- [ ] Service bergantung ke `Repository` dan interface module lain sebagai tipe interface, bukan struct konkret
- [ ] Kalau memakai registry koneksi dinamis (§5.C), koneksi diambil lewat registry, bukan membuka koneksi baru sembarang tempat
- [ ] Migrasi lewat `golang-migrate` di folder yang benar, bukan `db.AutoMigrate()`
- [ ] Model GORM tidak memecah kolom payload/konfigurasi fleksibel jadi field terpisah kalau memang didesain sebagai payload bebas
- [ ] Setiap method service/repository yang I/O menerima `context.Context` sebagai parameter pertama
- [ ] Semua akses `os.Getenv` lewat `internal/config/env.go`
- [ ] File test co-located dengan suffix `_test.go`
- [ ] Module baru (jika ada) dibuat karena alasan domain eksplisit (§11), bukan alasan deployment yang tidak relevan untuk monolith

Untuk CLI tool internal (jika ada, §4), gunakan checklist terpisah di §4.C.

Jalankan `go build ./...` dan `tree backend -L 4 -I 'bin'` di akhir task dan tempelkan hasilnya sebagai bukti struktur & kompilasi sudah sesuai sebelum melaporkan pekerjaan selesai.
