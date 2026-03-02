#!/usr/bin/env node

// cc-lang — See which programming languages Claude Code works with most.
// Zero dependencies. Reads ~/.claude/projects/ session transcripts.

import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

const CONCURRENCY = 8;

const EXT_TO_LANG = {
  '.py': 'Python',    '.pyi': 'Python',
  '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.jsx': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.gd': 'GDScript',
  '.md': 'Markdown',  '.mdx': 'Markdown',
  '.html': 'HTML',    '.htm': 'HTML',
  '.css': 'CSS',      '.scss': 'CSS',      '.sass': 'CSS',
  '.yaml': 'YAML',    '.yml': 'YAML',
  '.json': 'JSON',    '.jsonc': 'JSON',
  '.sh': 'Shell',     '.bash': 'Shell',    '.zsh': 'Shell',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.tscn': 'Godot Scene', '.tres': 'Godot Scene', '.godot': 'Godot Project',
  '.ps1': 'PowerShell',
  '.lua': 'Lua',
  '.cpp': 'C++',  '.cc': 'C++',  '.cxx': 'C++',
  '.h': 'C/C++',  '.hpp': 'C/C++',
  '.c': 'C',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.kt': 'Kotlin',   '.kts': 'Kotlin',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.toml': 'TOML',
  '.sql': 'SQL',
  '.r': 'R',          '.R': 'R',
  '.txt': 'Text',
  '.gitignore': 'Config', '.env': 'Config', '.conf': 'Config', '.ini': 'Config',
};

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', blue: '\x1b[34m', purple: '\x1b[35m',
};

// Assign consistent colors per language category
function langColor(lang) {
  const map = {
    'Python': C.yellow, 'JavaScript': C.yellow, 'TypeScript': C.blue,
    'GDScript': C.cyan, 'Markdown': C.green, 'HTML': C.red,
    'Shell': C.dim, 'YAML': C.dim, 'JSON': C.dim, 'CSS': C.purple,
    'Rust': C.red, 'Go': C.cyan, 'C#': C.purple,
  };
  return map[lang] || C.dim;
}

function bar(pct, width = 20) {
  const filled = Math.round(pct * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function projectName(dir) {
  const stripped = dir.replace(/^-home-[^-]+/, '').replace(/^-/, '');
  return stripped || '~/ (home)';
}

function extToLang(filePath) {
  const bn = basename(filePath);
  if (!bn.includes('.')) return null;
  const ext = '.' + bn.split('.').pop().toLowerCase();
  return EXT_TO_LANG[ext] || null;
}

async function analyzeFile(filePath) {
  const editByLang = {}, writeByLang = {};

  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line || !line.includes('"tool_use"')) continue;
    if (!line.includes('"Edit"') && !line.includes('"Write"')) continue;

    let data;
    try { data = JSON.parse(line); } catch { continue; }

    const msg = data.message || data;
    if (!msg || !Array.isArray(msg.content)) continue;

    for (const item of msg.content) {
      if (!item || item.type !== 'tool_use') continue;
      if (item.name !== 'Edit' && item.name !== 'Write') continue;

      const path = (item.input || {}).file_path || '';
      const lang = extToLang(path);
      if (!lang) continue;

      if (item.name === 'Edit') {
        editByLang[lang] = (editByLang[lang] || 0) + 1;
      } else {
        writeByLang[lang] = (writeByLang[lang] || 0) + 1;
      }
    }
  }

  return { editByLang, writeByLang };
}

async function scan() {
  const projectsDir = join(homedir(), '.claude', 'projects');
  let projectDirs;
  try { projectDirs = await readdir(projectsDir); } catch { return null; }

  const tasks = [];
  for (const pd of projectDirs) {
    const pp = join(projectsDir, pd);
    const ps = await stat(pp).catch(() => null);
    if (!ps?.isDirectory()) continue;
    const files = await readdir(pp).catch(() => []);
    for (const f of files) {
      if (f.endsWith('.jsonl')) tasks.push({ path: join(pp, f), project: projectName(pd) });
    }
    for (const f of files) {
      const sp = join(pp, f, 'subagents');
      const ss = await stat(sp).catch(() => null);
      if (!ss?.isDirectory()) continue;
      const sfs = await readdir(sp).catch(() => []);
      for (const sf of sfs) {
        if (sf.endsWith('.jsonl')) tasks.push({ path: join(sp, sf), project: projectName(pd) });
      }
    }
  }

  const globalEdit = {}, globalWrite = {};

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async t => {
      const st = await stat(t.path).catch(() => null);
      if (!st || st.size < 100) return null;
      return analyzeFile(t.path).catch(() => null);
    }));

    for (const r of results) {
      if (!r) continue;
      for (const [lang, n] of Object.entries(r.editByLang)) {
        globalEdit[lang] = (globalEdit[lang] || 0) + n;
      }
      for (const [lang, n] of Object.entries(r.writeByLang)) {
        globalWrite[lang] = (globalWrite[lang] || 0) + n;
      }
    }
  }

  return { globalEdit, globalWrite };
}

const jsonMode = process.argv.includes('--json');
if (!jsonMode) process.stdout.write(`  ${C.dim}Scanning file edits...${C.reset}\r`);

const data = await scan();
if (!data) {
  console.error('Could not read ~/.claude/projects/');
  process.exit(1);
}

const { globalEdit, globalWrite } = data;

const editList = Object.entries(globalEdit).sort((a, b) => b[1] - a[1]);
const writeList = Object.entries(globalWrite).sort((a, b) => b[1] - a[1]);
const totalEdit = editList.reduce((s, [, v]) => s + v, 0);
const totalWrite = writeList.reduce((s, [, v]) => s + v, 0);
const totalOps = totalEdit + totalWrite;

// Combined view: edit + write per language
const allLangs = new Set([...Object.keys(globalEdit), ...Object.keys(globalWrite)]);
const combined = Array.from(allLangs).map(lang => ({
  lang,
  edits: globalEdit[lang] || 0,
  writes: globalWrite[lang] || 0,
  total: (globalEdit[lang] || 0) + (globalWrite[lang] || 0),
})).sort((a, b) => b.total - a.total);

if (jsonMode) {
  console.log(JSON.stringify({
    version: '1.0.0',
    totalEdits: totalEdit,
    totalNewFiles: totalWrite,
    byLanguage: combined.map(({ lang, edits, writes, total }) => ({
      language: lang, edits, newFiles: writes, total,
      editPct: totalEdit > 0 ? +(edits / totalEdit * 100).toFixed(1) : 0,
    })),
  }, null, 2));
  process.exit(0);
}

// ── Display ──────────────────────────────────────────────────────

const pct = (n, d) => d > 0 ? (n / d * 100).toFixed(1) + '%' : '0%';

console.log(`\n  ${C.bold}${C.green}cc-lang — Language Breakdown${C.reset}`);
console.log(`  ${'═'.repeat(38)}`);

console.log(`\n  ${C.bold}▸ Overview${C.reset}`);
console.log(`    Total edits:      ${C.bold}${totalEdit.toLocaleString()}${C.reset}`);
console.log(`    New files:        ${C.bold}${totalWrite.toLocaleString()}${C.reset}`);
console.log(`    Languages active: ${C.dim}${combined.filter(l => l.total > 0).length}${C.reset}`);

// Top language
const top = combined[0];
if (top) {
  const color = langColor(top.lang);
  console.log(`    Primary language: ${color}${C.bold}${top.lang}${C.reset} ${C.dim}(${pct(top.total, totalOps)})${C.reset}`);
}

// Edit breakdown
if (editList.length > 0) {
  console.log(`\n  ${C.bold}▸ Edits by language${C.reset}`);
  const maxEdit = editList[0][1];
  for (const [lang, n] of editList.slice(0, 10)) {
    const color = langColor(lang);
    const b = bar(n / maxEdit, 16);
    console.log(`    ${color}${lang.padEnd(16)}${C.reset}  ${C.dim}${b}${C.reset}  ${n.toLocaleString().padStart(6)}  ${C.dim}${pct(n, totalEdit)}${C.reset}`);
  }
}

// New files breakdown
if (writeList.length > 0) {
  console.log(`\n  ${C.bold}▸ New files created by language${C.reset}`);
  const maxWrite = writeList[0][1];
  for (const [lang, n] of writeList.slice(0, 10)) {
    const color = langColor(lang);
    const b = bar(n / maxWrite, 16);
    console.log(`    ${color}${lang.padEnd(16)}${C.reset}  ${C.dim}${b}${C.reset}  ${n.toLocaleString().padStart(6)}  ${C.dim}${pct(n, totalWrite)}${C.reset}`);
  }
}

// Edit vs new file per lang (top 6)
console.log(`\n  ${C.bold}▸ Edit vs. new file ratio (top 6)${C.reset}`);
for (const { lang, edits, writes } of combined.slice(0, 6)) {
  const ratio = writes > 0 ? (edits / writes).toFixed(1) : '∞';
  const total = edits + writes;
  const color = langColor(lang);
  console.log(`    ${color}${lang.padEnd(16)}${C.reset}  ${C.dim}${edits.toLocaleString()} edits / ${writes.toLocaleString()} new${C.reset}  ${C.dim}(${ratio}:1)${C.reset}`);
}

console.log();
console.log(`  ${C.dim}─── Share ───${C.reset}`);
if (top) {
  console.log(`  ${C.dim}My #1 Claude Code language: ${top.lang} (${pct(top.total, totalOps)} of all file operations)`);
}
console.log(`  ${C.dim}#ClaudeCode${C.reset}`);
console.log();
