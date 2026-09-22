# Modular Monolith Code Guide — Agent Instructions

Ini adalah standing instructions untuk AI coding agent (Codex, Cursor, Gemini CLI, Antigravity, Claude Code, dsb.) yang bekerja di project yang mengadopsi konvensi ini. Empat dokumen referensi lengkap ada di `references/` — baca **hanya file yang relevan** dengan task yang sedang dikerjakan, jangan load semuanya sekaligus kalau task-nya cuma menyentuh satu layer.

## Kapan baca panduan yang mana

| Situasi | Baca |
|---|---|
| Scaffold/rapikan backend Go (struktur module, layer interface/service/repository/handler, komunikasi antar module, testing, containerization) | `references/BACKEND_GUIDE.md` |
| Desain skema database, migrasi, boundary data lintas module, indexing, konvensi penamaan tabel/kolom | `references/DATABASE_GUIDE.md` |
| Scaffold/rapikan frontend Next.js (App Router, Atomic Design, struktur komponen, komunikasi ke backend) | `references/FRONTEND_GUIDE.md` |
| Strategi branching, format commit, tagging/versioning, aturan CI/CD, aksi yang butuh konfirmasi user | `references/GIT_GUIDE.md` |

Keempat dokumen saling mereferensikan satu sama lain — kalau menemukan referensi silang yang relevan dengan pekerjaan yang sedang dilakukan, buka juga dokumen yang dirujuk.

## Cara pakai panduan ini di project nyata

Setiap dokumen adalah **template**, bukan konfigurasi siap pakai:

1. **Ganti placeholder** (`{module}`, `{domain}`, `{subdomain}`, `{route-name}`, `{project}`, dst.) dengan nama nyata sesuai domain bisnis project yang sedang dikerjakan. Jangan biarkan placeholder literal muncul di kode/commit message yang dihasilkan.
2. **Perhatikan tag `[Opsional]`** — bagian yang ditandai begitu (mis. pola multi-tenant di `DATABASE_GUIDE.md`, CLI tool terpisah di `BACKEND_GUIDE.md`, multi-domain frontend di `FRONTEND_GUIDE.md`) hanya relevan kalau arsitektur project memang membutuhkannya. Kalau project-nya single-tenant/single-app biasa, lewati bagian itu.
3. **Dokumen sumber project menang.** Kalau project punya PRD/architecture decision record sendiri yang bertentangan dengan aturan di sini, ikuti dokumen sumber project itu dan beri tahu user soal pertentangannya — jangan diam-diam memilih salah satu.
4. **Jalankan checklist di akhir tiap dokumen** sebelum melaporkan sebuah module/halaman/perubahan skema/rilis sebagai "selesai".

## Prinsip inti yang mengikat keempat dokumen

- **Backend**: satu binary, banyak module, komunikasi antar module wajib lewat interface Go langsung (bukan HTTP), boundary ditegakkan disiplin+review bukan compiler.
- **Database**: migrasi lewat `golang-migrate` (bukan `AutoMigrate`), satu module tidak boleh query tabel module lain secara langsung, payload JSON fleksibel dipertahankan sebagai `jsonb` bebas (bukan dipecah jadi kolom demi "kerapian" semu).
- **Frontend**: Atomic Design ketat — tiap komponen wajib folder sendiri + `.module.css` pasangan, `page.tsx` hanya fetch data lalu panggil Template, tidak ada logic UI langsung di routing layer.
- **Git**: commit granular per module/per layer (bukan satu commit besar per fitur), tag rilis dan aksi berdampak luas (repo baru, deploy production, migrasi massal) selalu menunggu instruksi eksplisit user — lihat `references/GIT_GUIDE.md` §5 untuk daftar lengkap aksi yang butuh konfirmasi.

## Bahasa

Seluruh isi dokumen referensi ditulis dalam Bahasa Indonesia dengan gaya "aturan mutlak" (source of truth) — tegas, langsung ke aturan, lengkap dengan tabel dan checklist.
