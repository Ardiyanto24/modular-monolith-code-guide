# Modular Monolith Code Guide

[![npx](https://img.shields.io/badge/npx-github%3AArdiyanto24%2Fmodular--monolith--code--guide-cb3837?logo=npm&logoColor=white)](#quick-start-npx)
[![License: MIT](https://img.shields.io/github/license/Ardiyanto24/modular-monolith-code-guide?color=blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Ardiyanto24/modular-monolith-code-guide?style=flat&color=yellow)](https://github.com/Ardiyanto24/modular-monolith-code-guide/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/Ardiyanto24/modular-monolith-code-guide)](https://github.com/Ardiyanto24/modular-monolith-code-guide/commits/main)
[![Language](https://img.shields.io/badge/docs-Bahasa%20Indonesia-red)](#)

**Works with:**
[![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-D97757?logo=claude&logoColor=white)](#1-claude-code-skillmd)
[![Codex](https://img.shields.io/badge/Codex-AGENTS.md-412991)](#2-codex--any-agentsmd-reader-agentsmd)
[![Cursor](https://img.shields.io/badge/Cursor-rules-000000?logo=cursor&logoColor=white)](#3-cursor-cursorrules)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-GEMINI.md-4285F4?logo=googlegemini&logoColor=white)](#4-gemini-cli-geminimd)
[![Antigravity](https://img.shields.io/badge/Antigravity-AGENTS.md-34A853)](#5-google-antigravity-agentsmd--geminimd)

Empat panduan instruksi AI (dalam Bahasa Indonesia) untuk membangun aplikasi dengan arsitektur **backend Go modular monolith**, **database PostgreSQL**, **frontend Next.js multi-domain berbasis Atomic Design**, dan **strategi Git/CI-CD** yang konsisten — dipaketkan supaya bisa langsung dipakai sebagai skill/rules/context file di **Claude Code, Codex, Cursor, Gemini CLI, dan Google Antigravity**.

Dokumen-dokumen ini awalnya ditulis sebagai instruksi kerja internal untuk satu produk, lalu digeneralisasi jadi template universal — seluruh referensi ke produk/perusahaan aslinya sudah dihapus dan diganti placeholder (`{module}`, `{domain}`, dst.) supaya bisa dipakai ulang di project apa pun.

## Quick start (npx)

Cara tercepat — jalankan di root project Anda, tidak perlu clone/install apa pun, dan tidak butuh akun npm (dijalankan langsung dari GitHub, bukan dari npm registry):

```bash
npx github:Ardiyanto24/modular-monolith-code-guide
```

Tanpa flag, CLI akan menanyakan tool mana yang mau dipasangi (Claude Code, Codex, Cursor, Gemini CLI, Antigravity — bisa pilih beberapa sekaligus atau Enter untuk semua). Untuk non-interaktif (mis. di script/CI):

```bash
npx github:Ardiyanto24/modular-monolith-code-guide --all              # semua tool
npx github:Ardiyanto24/modular-monolith-code-guide --cursor --codex   # tool tertentu saja
npx github:Ardiyanto24/modular-monolith-code-guide --claude --user    # skill Claude Code level user (~/.claude/skills), bukan project ini
npx github:Ardiyanto24/modular-monolith-code-guide --dir ./apps/api   # install ke direktori lain, bukan cwd
npx github:Ardiyanto24/modular-monolith-code-guide --force            # timpa file yang sudah ada
npx github:Ardiyanto24/modular-monolith-code-guide --help             # semua opsi
```

File yang sudah ada di target tidak akan ditimpa kecuali `--force` — aman dijalankan berulang kali. Kalau lebih suka copy manual tanpa Node/npm, lihat [Cara pakai per tool](#cara-pakai-per-tool) di bawah.

## Isi

```
modular-monolith-code-guide/
├── bin/cli.js                      # CLI installer (dijalankan lewat `npx github:Ardiyanto24/modular-monolith-code-guide`)
├── package.json
├── SKILL.md                        # entry point untuk Claude Code
├── AGENTS.md                       # entry point cross-tool (Codex, Cursor, Antigravity, dst.)
├── GEMINI.md                       # entry point untuk Gemini CLI (import @AGENTS.md)
├── .cursor/
│   └── rules/                      # Cursor project rules, auto-attach per jenis file
│       ├── backend-go-modular-monolith.mdc
│       ├── database-postgres.mdc
│       ├── frontend-nextjs-atomic-design.mdc
│       └── git-workflow.mdc
└── references/                     # isi lengkap keempat panduan — sumber kebenaran bersama
    ├── BACKEND_GUIDE.md            # struktur module Go, layer interface/service/repository/handler, testing, containerization
    ├── DATABASE_GUIDE.md           # konvensi skema, migrasi, boundary data lintas module, indexing
    ├── FRONTEND_GUIDE.md           # struktur Next.js App Router + Atomic Design, komunikasi ke backend
    └── GIT_GUIDE.md                # branching, commit granularity, tagging/versioning, aturan CI/CD & gating
```

Setiap dokumen di `references/` ditulis dengan gaya "aturan mutlak" (source of truth) — lengkap dengan tabel, contoh kode, dan checklist validasi di bagian akhir — supaya AI (atau engineer manusia) bisa langsung mengikuti tanpa banyak interpretasi ulang. `SKILL.md`, `AGENTS.md`, `GEMINI.md`, dan `.cursor/rules/*.mdc` semuanya cuma **pointer ringkas** ke `references/` — satu sumber kebenaran, banyak pintu masuk sesuai tool yang Anda pakai.

Bagian yang ditandai **`[Opsional]`** (mis. pola database multi-tenant, CLI tool terpisah, frontend multi-domain) hanya perlu dipakai kalau arsitektur project Anda memang membutuhkannya — cukup dilewati kalau tidak relevan.

## Cara pakai per tool

Ini instruksi copy-manual (tanpa `npx`) kalau Anda lebih suka begitu, atau ingin paham persis apa yang dipasang `npx github:Ardiyanto24/modular-monolith-code-guide` di baliknya. Prinsip umum: **copy isi repo ini (bukan foldernya sendiri) ke root project Anda**, kecuali disebutkan lain. Semua path relatif di dalam `AGENTS.md`/`.mdc` mengasumsikan `references/` ada satu level sejajar.

### 1. Claude Code (`SKILL.md`)

Install sebagai skill, level project (hanya aktif di satu repo) atau level user (aktif di semua project):
```bash
# level project
mkdir -p .claude/skills && cp -r modular-monolith-code-guide .claude/skills/

# level user
mkdir -p ~/.claude/skills && cp -r modular-monolith-code-guide ~/.claude/skills/
```
Claude Code otomatis menawarkan skill ini saat Anda scaffold project baru, menata struktur folder, mendesain skema database, atau menentukan strategi Git — sesuai deskripsi trigger di `SKILL.md`.

### 2. Codex (& tool AGENTS.md lain) (`AGENTS.md`)

[AGENTS.md](https://agents.md) adalah standar terbuka lintas-tool (dinaungi Agentic AI Foundation, Linux Foundation) yang dibaca native oleh Codex CLI, dan juga otomatis dibaca Cursor & Antigravity. Cukup taruh `AGENTS.md` + `references/` di root project:
```bash
cp AGENTS.md /path/to/your-project/
cp -r references /path/to/your-project/
```
Codex membaca `AGENTS.md` di root repo secara otomatis, tidak perlu konfigurasi tambahan.

### 3. Cursor (`.cursor/rules/`)

```bash
cp -r .cursor /path/to/your-project/
cp -r references /path/to/your-project/
```
Empat rule `.mdc` (backend/database/frontend/git) auto-attach berdasarkan glob file yang sedang Anda edit (mis. rule backend hanya aktif saat menyentuh `*.go`) — lebih presisi daripada satu `AGENTS.md` besar. Cursor juga otomatis membaca `AGENTS.md` di root sebagai fallback kalau Anda taruh itu juga.

### 4. Gemini CLI (`GEMINI.md`)

```bash
cp GEMINI.md AGENTS.md /path/to/your-project/
cp -r references /path/to/your-project/
```
`GEMINI.md` di sini cuma satu baris (`@AGENTS.md`) yang meng-import isi `AGENTS.md` lewat [import syntax Gemini CLI](https://geminicli.com/docs/cli/gemini-md/) — jadi tidak ada duplikasi konten. Bisa juga ditaruh di `~/.gemini/GEMINI.md` supaya aktif di semua project Anda.

### 5. Google Antigravity (`AGENTS.md` / `GEMINI.md`)

Sejak Antigravity versi 1.20.5, kedua file `AGENTS.md` dan `GEMINI.md` di root workspace dibaca otomatis — cukup ikuti langkah #2 atau #4 di atas, salah satu saja cukup. Antigravity juga punya sistem Skills native (`SKILL.md` + folder `scripts/`/`examples/`/`resources/`) yang mirip Claude Code; `SKILL.md` di repo ini kemungkinan besar kompatibel juga, tapi path discovery-nya bisa berbeda antar versi IDE — cek dokumentasi Antigravity Anda kalau ingin install lewat jalur Skills, bukan `AGENTS.md`.

## Mengadaptasi ke project Anda

1. Ganti seluruh placeholder (`{module}`, `{domain}`, `{project}`, dst.) dengan nama nyata.
2. Putuskan bagian `[Opsional]` mana yang relevan (multi-tenant? multi-domain frontend? CLI tool terpisah?) dan hapus yang tidak dipakai.
3. Kalau project Anda punya dokumen requirement/arsitektur sendiri yang bertentangan dengan aturan di sini, dokumen project Anda yang menang — panduan ini adalah titik awal, bukan aturan yang mengalahkan keputusan arsitektur nyata.

## Lisensi

MIT — lihat [LICENSE](LICENSE). Silakan pakai, modifikasi, dan sebarkan ulang.
