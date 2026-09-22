---
name: modular-monolith-code-guide
description: Kumpulan aturan arsitektur dan konvensi penulisan kode untuk backend Go modular monolith, skema database PostgreSQL, frontend Next.js multi-domain dengan Atomic Design, dan strategi Git/branching/tagging/CI-CD. Gunakan skill ini setiap kali diminta scaffold project baru dari nol, menata atau merapikan struktur folder backend maupun frontend, mendesain skema database dan migrasi, menentukan strategi branching/commit/tagging, atau melakukan review struktur kode terhadap konvensi tim — bahkan kalau user tidak secara eksplisit menyebut "style guide", "architecture guide", "coding standard", atau nama skill ini. Cocok dipakai di awal project (scaffolding dari nol) maupun saat menambah fitur baru ke project yang sudah mengikuti konvensi ini. Trigger juga saat user menyebut istilah seperti "modular monolith", "atomic design", "module boundary", "interface antar module", atau menanyakan bagaimana memisahkan layer service/repository/handler.
---

# Modular Monolith Code Guide

Skill ini berisi empat panduan instruksi AI yang saling melengkapi, ditulis sebagai template generik (bukan terikat ke satu produk/perusahaan tertentu). Tujuannya: memberi Claude aturan yang cukup detail dan tegas soal struktur folder, penamaan, pembagian layer, dan granularitas commit, supaya kode yang dihasilkan konsisten dan bisa langsung ditebak lokasinya — persis seperti style guide internal yang dipatuhi tim manusia.

## Kapan memakai panduan yang mana

| Situasi | Baca | 
|---|---|
| Scaffold/rapikan backend Go (struktur module, layer interface/service/repository/handler, komunikasi antar module, testing, containerization) | [`references/BACKEND_GUIDE.md`](references/BACKEND_GUIDE.md) |
| Desain skema database, migrasi, boundary data lintas module, indexing, konvensi penamaan tabel/kolom | [`references/DATABASE_GUIDE.md`](references/DATABASE_GUIDE.md) |
| Scaffold/rapikan frontend Next.js (App Router, Atomic Design, struktur komponen, komunikasi ke backend) | [`references/FRONTEND_GUIDE.md`](references/FRONTEND_GUIDE.md) |
| Strategi branching, format commit, tagging/versioning, aturan CI/CD, aksi yang butuh konfirmasi user | [`references/GIT_GUIDE.md`](references/GIT_GUIDE.md) |

Baca **hanya file yang relevan** dengan task yang sedang dikerjakan — jangan load keempatnya sekaligus kalau task-nya cuma menyentuh satu layer. Keempat dokumen saling mereferensikan satu sama lain (mis. `BACKEND_GUIDE.md` merujuk ke `DATABASE_GUIDE.md` untuk aturan migrasi) — kalau menemukan referensi silang yang relevan dengan pekerjaan yang sedang dilakukan, buka juga dokumen yang dirujuk.

## Cara pakai panduan ini di project nyata

Setiap dokumen adalah **template**, bukan konfigurasi siap pakai:

1. **Ganti placeholder** (`{module}`, `{domain}`, `{subdomain}`, `{route-name}`, `{project}`, dst.) dengan nama nyata sesuai domain bisnis project yang sedang dikerjakan. Jangan biarkan placeholder literal muncul di kode/commit message yang dihasilkan.
2. **Perhatikan tag `[Opsional]`** — bagian yang ditandai begitu (mis. pola multi-tenant di `DATABASE_GUIDE.md` §0/§4, CLI tool terpisah di `BACKEND_GUIDE.md` §4, multi-domain frontend di `FRONTEND_GUIDE.md` §1/§6) hanya relevan kalau arsitektur project memang membutuhkannya. Kalau project-nya single-tenant/single-app biasa, lewati bagian itu dan terapkan sisanya seperti biasa terhadap satu unit.
3. **Dokumen sumber project menang.** Kalau project punya PRD/architecture decision record sendiri yang bertentangan dengan aturan di sini, ikuti dokumen sumber project itu dan beri tahu user soal pertentangannya — jangan diam-diam memilih salah satu.
4. **Jalankan checklist di akhir tiap dokumen** sebelum melaporkan sebuah module/halaman/perubahan skema/rilis sebagai "selesai". Checklist itu bukan formalitas — ini cara memverifikasi aturan-aturan di atasnya sudah benar-benar diikuti, bukan cuma dibaca.

## Prinsip inti yang mengikat keempat dokumen

Kalau hanya sempat membaca satu paragraf, ini intisarinya:

- **Backend**: satu binary, banyak module, komunikasi antar module wajib lewat interface Go langsung (bukan HTTP), boundary ditegakkan disiplin+review bukan compiler.
- **Database**: migrasi lewat `golang-migrate` (bukan `AutoMigrate`), satu module tidak boleh query tabel module lain secara langsung, payload JSON fleksibel dipertahankan sebagai `jsonb` bebas (bukan dipecah jadi kolom demi "kerapian" semu).
- **Frontend**: Atomic Design ketat — tiap komponen wajib folder sendiri + `.module.css` pasangan, `page.tsx` hanya fetch data lalu panggil Template, tidak ada logic UI langsung di routing layer.
- **Git**: commit granular per module/per layer (bukan satu commit besar per fitur), tag rilis dan aksi berdampak luas (repo baru, deploy production, migrasi massal) selalu menunggu instruksi eksplisit user — lihat `GIT_GUIDE.md` §5 untuk daftar lengkap aksi yang butuh konfirmasi.

## Bahasa

Seluruh isi dokumen referensi ditulis dalam Bahasa Indonesia, mengikuti gaya penulisan "aturan mutlak" (source of truth) yang tegas dan langsung ke aturan, dengan tabel dan checklist. Kalau user meminta versi Bahasa Inggris, terjemahkan per dokumen saat dibutuhkan — jangan menerjemahkan semuanya di muka tanpa diminta.
