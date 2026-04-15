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
| `## 🔥🐟️ Work` | Work tasks, meeting notes, ideas, links. Items here are implicitly work-scoped. |
| `## ⚔️ Personal` | Personal tasks, thoughts, links, errands. Items here are implicitly personal-scoped. |

## Workflow

The workflow uses **subagents** to keep the main conversation clean. The main agent only handles presenting summaries and collecting user decisions.

### Phase 1: Gather context (subagent)

Dispatch a subagent with the Agent tool using `subagent_type: "very-own-skills:vault-triage-gatherer"` and a prompt containing today's date (so it knows which note to exclude):

```
Today's date is YYYY-MM-DD. Find and classify all un-triaged daily notes.
```

### Phase 2: Triage items one by one (main agent)

Parse the subagent's report. Process ONE note at a time. For each note:

**Step 1 — Print a summary header** (text only, no questions):

```
📅 Daily note: YYYY-MM-DD (Note N of M) — X items found
```

**Step 2 — Loop through each item using `AskUserQuestion`.**

**CRITICAL: You MUST use `AskUserQuestion` for EVERY item. Do NOT present items as text and ask for approval in conversation. The `AskUserQuestion` tool is the ONLY way to interact with the user during triage.**

#### Non-Shortcut items (Todoist tasks, Knowledge, Plans, References)

Call `AskUserQuestion` with **1 question**:

- question: `📋 "Task description" → Todoist (work)` (include the emoji, description, and proposed destination)
- header: `"Action"`
- options: `Approve (Recommended)`, `Skip`
- multiSelect: `false`

The auto-provided "Other" option lets the user reroute or edit the item.

#### Shortcut items

Call `AskUserQuestion` with **3 questions in a single call**:

- **Q1** (header `"Action"`): options `Approve (Recommended)`, `Skip`
- **Q2** (header `"Type"`): recommended type first with "(Recommended)" suffix, plus the other two types. Always include all three: feature, bug, chore. multiSelect: false
- **Q3** (header `"Epic"`): 3 epic suggestions from the gatherer's `EPIC_SUGGESTIONS` + `None (no epic)`. The auto-provided "Other" option lets the user type a new epic name or request the full list. multiSelect: false

If user picks "Skip" for Q1, ignore Q2/Q3 answers.
If user picks "Other" for the epic and provides a new name → pass `create:Epic Name` to the executor.

**Step 3 — After all items from a note are resolved**, collect the approved items and proceed to Phase 3.

### Phase 3: Execute approved actions (subagent)

Dispatch a subagent with `subagent_type: "very-own-skills:vault-triage-executor"` and a prompt containing the daily note path and all approved items with their full context:

```
DAILY NOTE: Dailies/YYYY-MM-DD.md
APPROVED ITEMS:
[paste each approved item with its destination, tags, and for Shortcut items: type (feature/bug/chore), epic ID (or "none" or "create:Epic Name")]
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

### Phase 4b: Surface MCP gaps

After presenting the triage summary, check both subagent reports for a `GAPS` section. If either report contains gaps, append to the summary:

> 🔧 MCP gap detected:
> - [agent name] needed [capability] but no tool was available
> - Consider adding [tool_name] to triage-tools MCP server

## Gotchas

- **`obsidian frontmatter` command does NOT exist.** Use `property:read`, `property:set`, and `property:remove` for frontmatter changes.
- **Section determines scope, `#shortcut` tag determines destination.** Work tasks default to Todoist (with `work` label). Only work tasks explicitly tagged `#shortcut` inline go to Shortcut. Personal tasks always go to Todoist (with `personal` label). The `#shortcut` tag is a routing signal only — don't include it as a label on the created item. Ignore `#shortcut` if it appears in the Personal section.
- **Use YAML `tags:` arrays** when creating Knowledge/Plan notes.
- **Prefer appending over creating.** Always search before proposing a new Knowledge or Plan note.
- **Meeting notes are multi-type.** Extract tasks + knowledge separately, keep full meeting as knowledge item.
- **Subagents use typed MCP tools** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to `triage_tools` MCP + Shortcut MCP. No Bash access — all vault and Todoist operations go through the triage-tools MCP server. If a subagent reports GAPS, consider adding the missing tool to the MCP server.
