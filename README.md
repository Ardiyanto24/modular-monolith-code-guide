# Modular Monolith Code Guide

Skill [Claude Code](https://claude.com/claude-code) berisi empat panduan instruksi AI (dalam Bahasa Indonesia) untuk membangun aplikasi dengan arsitektur **backend Go modular monolith**, **database PostgreSQL**, **frontend Next.js multi-domain berbasis Atomic Design**, dan **strategi Git/CI-CD** yang konsisten.

Dokumen-dokumen ini awalnya ditulis sebagai instruksi kerja internal untuk satu produk, lalu digeneralisasi jadi template universal — seluruh referensi ke produk/perusahaan aslinya sudah dihapus dan diganti placeholder (`{module}`, `{domain}`, dst.) supaya bisa dipakai ulang di project apa pun.

## Isi

```
modular-monolith-code-guide/
├── SKILL.md                        # entry point skill — dibaca Claude untuk tahu kapan & bagaimana memakai panduan ini
└── references/
    ├── BACKEND_GUIDE.md            # struktur module Go, layer interface/service/repository/handler, testing, containerization
    ├── DATABASE_GUIDE.md           # konvensi skema, migrasi, boundary data lintas module, indexing
    ├── FRONTEND_GUIDE.md           # struktur Next.js App Router + Atomic Design, komunikasi ke backend
    └── GIT_GUIDE.md                # branching, commit granularity, tagging/versioning, aturan CI/CD & gating
```

Setiap dokumen ditulis dengan gaya "aturan mutlak" (source of truth) — lengkap dengan tabel, contoh kode, dan checklist validasi di bagian akhir — supaya AI (atau engineer manusia) bisa langsung mengikuti tanpa banyak interpretasi ulang.

Bagian yang ditandai **`[Opsional]`** (mis. pola database multi-tenant, CLI tool terpisah, frontend multi-domain) hanya perlu dipakai kalau arsitektur project Anda memang membutuhkannya — cukup dilewati kalau tidak relevan.

## Cara pakai sebagai Claude Code skill

**Level project** (hanya aktif di satu repo):
```bash
mkdir -p .claude/skills
cp -r modular-monolith-code-guide .claude/skills/
```

**Level user** (aktif di semua project Anda):
```bash
mkdir -p ~/.claude/skills
cp -r modular-monolith-code-guide ~/.claude/skills/
```

Setelah itu, Claude Code akan otomatis menawarkan skill ini ketika Anda meminta scaffold project baru, menata struktur folder, mendesain skema database, atau menentukan strategi Git — sesuai deskripsi trigger di `SKILL.md`.

## Cara pakai tanpa Claude Code

Dokumen di `references/` juga bisa dipakai langsung sebagai:
- **System prompt / project instructions** untuk AI assistant lain (ChatGPT, Cursor, dsb) — tinggal tempel isi file yang relevan.
- **Style guide manual** untuk tim engineering — ganti placeholder dengan nama domain bisnis Anda, lalu commit ke repo project sebagai `CONTRIBUTING.md` atau dokumen arsitektur.

## Mengadaptasi ke project Anda

1. Ganti seluruh placeholder (`{module}`, `{domain}`, `{project}`, dst.) dengan nama nyata.
2. Putuskan bagian `[Opsional]` mana yang relevan (multi-tenant? multi-domain frontend? CLI tool terpisah?) dan hapus yang tidak dipakai.
3. Kalau project Anda punya dokumen requirement/arsitektur sendiri yang bertentangan dengan aturan di sini, dokumen project Anda yang menang — panduan ini adalah titik awal, bukan aturan yang mengalahkan keputusan arsitektur nyata.

## Lisensi

MIT — lihat [LICENSE](LICENSE). Silakan pakai, modifikasi, dan sebarkan ulang.
