---
name: daily-note-triage
description: >-
  Morning triage of Obsidian daily notes. Reads un-triaged notes from the
  think_vault, classifies content into tasks, knowledge, plans, and
  references, then files them to their proper destinations with user
  approval. Use when the user wants to process their daily brain dump
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

### Shortcut config

| Key | Value |
|-----|-------|
| Team | Firefish Dev All Team (`ffall` / `63528d87-df9d-43f8-a129-d3add01a5fac`) |
| Workflow | Product Development (`500000005`) |
| Initial state | Pre-refine (`500000006`) |
| Owner | unassigned (assigned during sprint planning) |

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
| `## 💼 Work` | Work tasks, meeting notes, ideas, links. Items here are implicitly work-scoped. |
| `## 🌿 Personal` | Personal tasks, thoughts, links, errands. Items here are implicitly personal-scoped. |

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
  1. "Prepare points for tech debt talk" → Todoist (work)
  2. "Add rate limiting to disbursement API" → Shortcut (details next)
  3. "Book dentist appointment" → Todoist (personal)

💡 Knowledge:
  4. "Insight title" → create new / append to "Existing Note" (tags)

📐 Plans:
  5. "Decision or direction" → create new / append to "Existing Plan" (tags)

🔗 References:
  6. URL or resource → Reading List

---
✅ Approve  ⏭️ Skip  ✏️ Edit
Which items to approve? (e.g., "all", "1,3", "skip 2", "edit 4")
```

Wait for the user's response before proceeding.

#### Shortcut context gathering

After the user approves items, use `AskUserQuestion` for each approved Shortcut-bound task. Ask both questions in a single call:

**Question 1 — Story type** (header: "Type"):
- Options built from the gatherer's `SUGGESTED_TYPE` recommendation. Put the recommended type first with "(Recommended)" suffix. Always include all three: feature, bug, chore.

**Question 2 — Epic** (header: "Epic"):
- Build options from the gatherer's `EPIC_SUGGESTIONS` (3 best matches), plus a "None (no epic)" option. The user can pick "Other" (auto-provided) to type a new epic name or request the full list.

If the user picks "Other" for the epic and provides a new name, that signals epic creation — pass `create:Epic Name` to the executor.

### Phase 3: Execute approved actions (subagent)

After collecting approvals for a note, dispatch a subagent with `subagent_type: "very-own-skills:vault-triage-executor"` and a prompt containing the daily note path and the approved items:

```
DAILY NOTE: Dailies/YYYY-MM-DD.md
APPROVED ITEMS:
[paste the approved items here with their destinations and tags]
For Shortcut items, include: type (feature/bug/chore), epic ID (or "none" or "create:Epic Name")
```

### Phase 4: Report (main agent)

After the execute subagent returns, present a clean summary:

```
✅ Triaged Dailies/YYYY-MM-DD.md

Filed:
  - 📋 "Task X" → Shortcut story created / Todoist task created
  - 💡 "Knowledge Y" → appended to Knowledge/Existing Note.md
  - 🔗 URL → Reading List
```

Then proceed to the next note, or if all done:

> 🎉 All daily notes triaged!

## Gotchas

- **`obsidian frontmatter` command does NOT exist.** Use `property:read`, `property:set`, and `property:remove` for frontmatter changes.
- **Section determines scope, `#shortcut` tag determines destination.** Work tasks default to Todoist (with `work` label). Only work tasks explicitly tagged `#shortcut` inline go to Shortcut. Personal tasks always go to Todoist (with `personal` label). The `#shortcut` tag is a routing signal only — don't include it as a label on the created item. Ignore `#shortcut` if it appears in the Personal section.
- **Use YAML `tags:` arrays** when creating Knowledge/Plan notes.
- **Prefer appending over creating.** Always search before proposing a new Knowledge or Plan note.
- **Meeting notes are multi-type.** Extract tasks + knowledge separately, keep full meeting as knowledge item.
- **Subagents are defined agents** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to Bash + MCP. This prevents them from using Grep/Read instead of the obsidian CLI.
