---
name: project-sync
description: Bring the project's records up to date after work on the dental clinic app — CLAUDE.md (rules/conventions), Claude's memory (decisions, preferences), docs/03-rebuild-plan.md (roadmap status) and the Notion project page + technical design (checkboxes, status, decisions). Use when a phase or feature is finished, when the user makes product decisions, after an interview, or when the user says "update notion", "sync", "update claude.md", "update the plan" or "update memory".
---

# Project sync

Keeps four records consistent with what was actually built and decided. Each has a different job — put information in the right one, and never duplicate it.

| Record | Holds | Does NOT hold |
|---|---|---|
| `CLAUDE.md` (repo root) | Rules and conventions every future change must follow (architecture, validation, security, UI, "done means") | Progress, dates, decisions about features |
| Claude memory (`~/.claude/projects/-home-m7md-Projects-dental-Dental-mang/memory/`) | Product decisions, user preferences, things not derivable from code/git | Code structure, anything already in CLAUDE.md or docs |
| `docs/03-rebuild-plan.md` | The plan: decisions table, roadmap, interview decisions (§16+) | Implementation detail |
| Notion | The user's view: status, roadmap checkboxes, decisions, technical design | Anything the user didn't write that contradicts the repo |

Notion IDs:
- Project page "🏥 Clinic Management System": `287de7e66f4b803795abefc9ab35a319`
- Sub-page "v2 Technical Design": `3eade7e66f4b81be8203c449871ca969`

## Steps

### 1. Find out what changed (facts only)

```bash
git log --oneline -15
git status --short | head -40
```

Plus, when a phase/feature finished: latest test counts (`pnpm test`, `pnpm --filter clinic test:e2e`), new routes from `pnpm build`, new migrations in `apps/clinic/prisma/migrations/`. Report only what you verified — never mark something done that isn't built and tested.

### 2. CLAUDE.md — only new rules

Add a line only when the work introduced a convention future code must follow (a new shared component, a new validation helper, a new security rule). Keep the existing section structure (Architecture / Rules / Validation / Security / UI / Done means). One or two lines per rule; no progress notes.

### 3. Memory — decisions and preferences

Follow the memory format (one fact per file, frontmatter `name` / `description` / `metadata.type`, **Why:** and **How to apply:** for project/feedback types, `[[links]]`). Update an existing file rather than creating a duplicate; add a one-line pointer to `MEMORY.md`. Convert relative dates to absolute dates.

### 4. docs/03-rebuild-plan.md

- Open decisions table (§11): mark decided ones `✅ Decided <date>: …`.
- Roadmap: update the status column / revised roadmap section.
- New interview decisions: add a numbered section (`## 17. …`) with a table *Topic | Decision | What it means for the build*.

### 5. Notion

1. **Fetch the page first** (`notion-fetch`). Edit against the exact current text.
2. Use `update_content` with the **smallest** `old_str` per change. Never `replace_content` on the project page — it holds the user's own history notes, sub-pages and an inline Tasks database.
3. Typical edits:
   - Status row in "🚦 Project Status" (`<td>…</td>` after `**Status**`) and the Target row.
   - Roadmap checkboxes under "## Roadmap": `- [ ]` → `- [x]`; split an item when only part is done (`- [x] done part` + `- [ ] remaining part`).
   - "❓ Open decisions" table cells → `✅ Decided (<date>): …`.
   - New decisions: a dated section before "## Requirements carried over from the v1 notes".
   - Technical changes: append a numbered section to "v2 Technical Design" with `insert_content` at the end.
4. Gotchas (learned the hard way):
   - A batch of `content_updates` is **atomic**: one non-matching `old_str` and **nothing** is applied. On error, re-fetch and retry all.
   - Notion **auto-links** text such as `wa.me` → match `[wa.me](http://wa.me)`.
   - Tables are stored one cell per line (`<td>…</td>`); match a single cell, not a whole row.
   - Emojis in content are fine in Notion, but keep them out of repo source (see the Unicode rule in CLAUDE.md).

### 6. Report back

End with a short list: what changed in each record, with the Notion page link `https://app.notion.com/p/287de7e66f4b803795abefc9ab35a319`. If a record needed no change, say so in one line.

## Don'ts

- Don't tick a Notion checkbox for work that isn't built and tested.
- Don't rewrite or delete the user's own Notion text (v1 history, notes, tasks).
- Don't put progress or dates into CLAUDE.md.
- Don't create a memory for something the repo already records.
