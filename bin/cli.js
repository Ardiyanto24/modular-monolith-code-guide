#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

const PKG_ROOT = path.join(__dirname, "..");
const CWD = process.cwd();

const TOOL_DEFS = {
  claude: { label: "Claude Code", desc: "install sebagai skill (SKILL.md + references/)" },
  codex: { label: "Codex", desc: "AGENTS.md di root project" },
  cursor: { label: "Cursor", desc: ".cursor/rules/*.mdc di root project" },
  gemini: { label: "Gemini CLI", desc: "GEMINI.md di root project" },
  antigravity: { label: "Google Antigravity", desc: "AGENTS.md + GEMINI.md di root project" },
};

const ROOT_FILES_BY_TOOL = {
  codex: ["AGENTS.md"],
  cursor: [".cursor"],
  gemini: ["GEMINI.md", "AGENTS.md"],
  antigravity: ["AGENTS.md", "GEMINI.md"],
};

function parseArgs(argv) {
  const args = {
    tools: new Set(),
    scope: "project",
    dir: CWD,
    force: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") {
      Object.keys(TOOL_DEFS).forEach((t) => args.tools.add(t));
    } else if (["--claude", "--codex", "--cursor", "--gemini", "--antigravity"].includes(a)) {
      args.tools.add(a.slice(2));
    } else if (a === "--user") {
      args.scope = "user";
    } else if (a === "--project") {
      args.scope = "project";
    } else if (a === "--force") {
      args.force = true;
    } else if (a === "-y" || a === "--yes") {
      args.yes = true;
    } else if (a === "--dir") {
      args.dir = path.resolve(argv[++i] || CWD);
    } else if (a.startsWith("--dir=")) {
      args.dir = path.resolve(a.slice("--dir=".length));
    } else if (a === "-h" || a === "--help") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
modular-monolith-code-guide - pasang panduan arsitektur & coding standard ke project Anda

Usage:
  npx github:Ardiyanto24/modular-monolith-code-guide [options]

Options:
  --all              install untuk semua tool (Claude Code, Codex, Cursor, Gemini CLI, Antigravity)
  --claude           install skill untuk Claude Code
  --codex            install AGENTS.md untuk Codex
  --cursor           install .cursor/rules untuk Cursor
  --gemini           install GEMINI.md untuk Gemini CLI
  --antigravity      install AGENTS.md + GEMINI.md untuk Google Antigravity
  --user             (khusus Claude Code) install ke ~/.claude/skills, bukan .claude/skills project ini
  --dir <path>       target project directory (default: direktori saat ini)
  --force            timpa file yang sudah ada di target
  -y, --yes          lewati prompt interaktif; tanpa flag tool lain, defaultnya --all
  -h, --help         tampilkan bantuan ini

Tanpa opsi apa pun dan dijalankan di terminal interaktif, akan muncul prompt untuk memilih tool.
Referensi lengkap: https://github.com/Ardiyanto24/modular-monolith-code-guide
`);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptTools() {
  console.log("\nPilih tool yang mau dipasangi panduan ini (pisahkan koma), atau Enter untuk semua:\n");
  Object.entries(TOOL_DEFS).forEach(([key, t]) => {
    console.log(`  ${key.padEnd(12)} ${t.label} - ${t.desc}`);
  });
  const answer = await ask("\n> ");
  if (!answer) return Object.keys(TOOL_DEFS);
  const picked = answer
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => TOOL_DEFS[s]);
  return picked.length ? picked : Object.keys(TOOL_DEFS);
}

function copyFile(src, dest, force) {
  if (fs.existsSync(dest) && !force) {
    console.log(`  lewati (sudah ada): ${path.relative(CWD, dest)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  tulis: ${path.relative(CWD, dest)}`);
}

function copyDir(src, dest, force) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d, force);
    } else {
      copyFile(s, d, force);
    }
  }
}

function installReferences(targetDir, force) {
  copyDir(path.join(PKG_ROOT, "references"), path.join(targetDir, "references"), force);
}

function installClaude(scope, force) {
  const base =
    scope === "user" ? path.join(os.homedir(), ".claude", "skills") : path.join(CWD, ".claude", "skills");
  const dest = path.join(base, "modular-monolith-code-guide");
  copyFile(path.join(PKG_ROOT, "SKILL.md"), path.join(dest, "SKILL.md"), force);
  copyDir(path.join(PKG_ROOT, "references"), path.join(dest, "references"), force);
  console.log(`Claude Code skill terpasang di: ${dest}`);
}

function installRootFiles(files, targetDir, force) {
  for (const f of files) {
    const src = path.join(PKG_ROOT, f);
    const dest = path.join(targetDir, f);
    if (fs.lstatSync(src).isDirectory()) {
      copyDir(src, dest, force);
    } else {
      copyFile(src, dest, force);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  let tools = Array.from(args.tools);
  if (tools.length === 0) {
    if (process.stdin.isTTY && !args.yes) {
      tools = await promptTools();
    } else {
      tools = Object.keys(TOOL_DEFS);
    }
  }

  fs.mkdirSync(args.dir, { recursive: true });
  console.log(`\nMemasang panduan untuk: ${tools.join(", ")}`);
  console.log(`Target: ${args.dir}\n`);

  let needsRootReferences = false;

  for (const t of tools) {
    if (t === "claude") {
      installClaude(args.scope, args.force);
      continue;
    }
    const files = ROOT_FILES_BY_TOOL[t];
    if (!files) continue;
    installRootFiles(files, args.dir, args.force);
    needsRootReferences = true;
  }

  if (needsRootReferences) {
    installReferences(args.dir, args.force);
  }

  console.log("\nSelesai. Detail cara pakai tiap tool ada di README:");
  console.log("https://github.com/Ardiyanto24/modular-monolith-code-guide\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
