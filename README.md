# cc-lang

**See which programming languages Claude Code works with most.**

Zero dependencies. Reads `~/.claude/projects/` session transcripts and counts every Edit and Write tool call by language.

```
npx cc-lang
```

## Sample Output

```
  cc-lang — Language Breakdown
  ══════════════════════════════════════

  ▸ Overview
    Total edits:      12,847
    New files:         3,291
    Languages active: 18
    Primary language: GDScript (35.8% of all file ops)

  ▸ Edits by language
    GDScript          ████████████████   4,598   35.8%
    Python            █████████░░░░░░░   2,844   22.1%
    Markdown          ████████░░░░░░░░   2,712   21.1%
    JavaScript        ████░░░░░░░░░░░░   1,234    9.6%
    TypeScript        ██░░░░░░░░░░░░░░     682    5.3%

  ▸ New files created by language
    JavaScript        ████████████████   2,187   66.4%
    Markdown          █████░░░░░░░░░░░     712   21.6%
    HTML              ██░░░░░░░░░░░░░░     201    6.1%
    ...

  ▸ Edit vs. new file ratio (top 6)
    GDScript          4598 edits / 332 new   (13.8:1)
    Python            2844 edits / 401 new   (7.1:1)
    Markdown          2712 edits / 712 new   (3.8:1)
    JavaScript        1234 edits / 2187 new  (0.6:1)
    TypeScript         682 edits / 890 new   (0.8:1)
```

## What the ratio tells you

- **High ratio (10+:1)**: You're iterating on existing code — steady development on a live codebase
- **Low ratio (<1:1)**: You're mostly creating new files — scaffolding, generating content, building fresh
- **~1:1**: Balanced mix of new features and refinement

GDScript at 13.8:1 means Claude is deeply iterating on Godot game code. JavaScript at 0.2:1 means Claude mostly spins up new `.js` files (cc-toolkit tools, scripts) without revisiting them.

## Usage

```bash
npx cc-lang          # terminal output
npx cc-lang --json   # JSON output for piping
```

Or open the [browser version](https://yurukusa.github.io/cc-lang/) — drag-drop your `~/.claude/projects/` folder.

## How it works

Scans every `.jsonl` session transcript (including subagent logs). For each `Edit` or `Write` tool call, extracts the `file_path` extension and maps it to a language. Counts edits (modifications to existing files) and writes (new file creations) separately.

Supported: Python, JavaScript, TypeScript, GDScript, Markdown, HTML, CSS, YAML, JSON, Shell, Rust, Go, Java, Ruby, PHP, C/C++, C#, Swift, Kotlin, Vue, Svelte, TOML, SQL, PowerShell, Lua, R, and more.

## Part of cc-toolkit

One of 62 Claude Code analytics tools. See the full collection at [yurukusa.github.io/cc-toolkit](https://yurukusa.github.io/cc-toolkit/).
