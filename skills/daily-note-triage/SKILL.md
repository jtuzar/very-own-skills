---
name: daily-note-triage
description: >-
  Morning triage of Obsidian daily notes. Reads un-triaged notes from the
  think_vault, classifies content into tasks, knowledge, plans, references,
  and journal entries, then files them to their proper destinations with
  user approval. Use when the user wants to process their daily brain dump
  notes. Triggers on: "triage my notes", "process yesterday's notes",
  "morning triage", "review daily notes".
---

# Daily Note Triage

Process un-triaged daily notes, classify content, and file it to the right destinations with user approval.

**Use emojis consistently throughout all output** — they help the user quickly scan separated concerns.

## Config

| Key | Value |
|-----|-------|
| Vault path | `/home/jakub/Documents/think_vault/` |
| Employer tag | `#firefish` |
| Work tags | `#work` + employer tag |
| CLI tool | `obsidian` (bash CLI, run via Bash tool) |

| Folder | Purpose |
|--------|---------|
| `Dailies/` | Raw daily brain dumps (input) |
| `Knowledge/` | Distilled insights and learnings |
| `Plans/` | Strategic docs, decisions, evolving threads |
| `References/` | Links and resources to check out |

## Daily Note Structure

Notes use this template. The `triaged` property is a boolean — `false` when created, set to `true` after processing.

```yaml
---
date: YYYY-MM-DD
tags: daily
triaged: false
---
```

| Section | Content type |
|---------|-------------|
| `## 🧠 Brain Dump` | Mixed — tasks, thoughts, links, meeting notes. Triage classification happens here. |
| `## 📓 Journal -- Work` | Work reflections → pre-classified as journal, no action needed |
| `## 🌿 Journal -- Personal` | Personal reflections → pre-classified as journal, no action needed |

## Workflow

The workflow uses **subagents** to keep the main conversation clean. The main agent only handles presenting summaries and collecting user decisions.

### Phase 1: Gather context (subagent)

Dispatch a subagent with the Agent tool using `subagent_type: "very-own-skills:vault-triage-gatherer"` and a prompt containing today's date (so it knows which note to exclude):

```
Today's date is YYYY-MM-DD. Find and classify all un-triaged daily notes.
```

### Phase 2: Present and get user approval (main agent)

Parse the subagent's report and present ONE note at a time:

```
📅 Daily note: YYYY-MM-DD (Note N of M)

📋 Tasks:
  1. "Task description" → destination (tags)

💡 Knowledge:
  2. "Insight title" → create new / append to "Existing Note" (tags)

📐 Plans:
  3. "Decision or direction" → create new / append to "Existing Plan" (tags)

🔗 References:
  4. URL or resource → Reading List

📓 Journal:
  Work: summary (or "empty")
  Personal: summary (or "empty")

---
✅ Approve  ⏭️ Skip  ✏️ Edit
Which items to approve? (e.g., "all", "1,3", "skip 2", "edit 4")
```

Wait for the user's response before proceeding.

### Phase 3: Execute approved actions (subagent)

After collecting approvals for a note, dispatch a subagent with `subagent_type: "very-own-skills:vault-triage-executor"` and a prompt containing the daily note path and the approved items:

```
DAILY NOTE: Dailies/YYYY-MM-DD.md
APPROVED ITEMS:
[paste the approved items here with their destinations and tags]
```

### Phase 4: Report (main agent)

After the execute subagent returns, present a clean summary:

```
✅ Triaged Dailies/YYYY-MM-DD.md

Filed:
  - 📋 "Task X" → Shortcut story created / Todoist task created
  - 💡 "Knowledge Y" → appended to Knowledge/Existing Note.md
  - 🔗 URL → Reading List

Skipped: 2 items (journal)
```

Then proceed to the next note, or if all done:

> 🎉 All daily notes triaged!

## Gotchas

- **`obsidian frontmatter` command does NOT exist.** Use `property:read`, `property:set`, and `property:remove` for frontmatter changes.
- **Tags are inline in Brain Dump content** (`#firefish` in bullet text), but use YAML `tags:` arrays when creating Knowledge/Plan notes.
- **Journal sections are pre-classified.** Don't re-triage content under `## 📓 Journal -- Work` or `## 🌿 Journal -- Personal`.
- **Prefer appending over creating.** Always search before proposing a new Knowledge or Plan note.
- **Meeting notes are multi-type.** Extract tasks + knowledge separately, keep full meeting as knowledge item.
- **Subagents are defined agents** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to Bash + MCP. This prevents them from using Grep/Read instead of the obsidian CLI.
