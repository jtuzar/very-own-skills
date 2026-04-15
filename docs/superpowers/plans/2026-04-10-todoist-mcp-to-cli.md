# Todoist MCP-to-CLI Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Todoist MCP tool (`mcp__todoist__add-tasks`) with the `td` CLI in the daily-note-triage skill, removing the MCP dependency for Todoist.

**Architecture:** The triage skill uses two subagents (gatherer + executor). Only the executor creates Todoist tasks via `mcp__todoist__add-tasks`. We replace that single MCP tool call with `td task add` run via the Bash tool, which the executor already has. The gatherer needs no changes (it has no Todoist interaction). The main skill file needs a minor wording update.

**Tech Stack:** `td` CLI (v1.40.0, `@doist/todoist-cli`), already installed globally and authenticated.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `agents/vault-triage-executor.md` | Modify | Remove MCP tool, rewrite Todoist task creation instructions to use `td task add` |
| `skills/daily-note-triage/SKILL.md` | Modify | Update line 144 comment about agent tools |

No new files. `agents/vault-triage-gatherer.md` is unchanged (no Todoist interaction).

---

### Task 1: Update executor agent — remove MCP tool and rewrite Todoist instructions

**Files:**
- Modify: `agents/vault-triage-executor.md:10` (tools frontmatter)
- Modify: `agents/vault-triage-executor.md:42-52` (Todoist execution rules)

- [ ] **Step 1: Remove `mcp__todoist__add-tasks` from tools list**

In `agents/vault-triage-executor.md`, line 10, change:

```yaml
tools: ["Bash", "mcp__shortcut__stories-create", "mcp__shortcut__epics-create", "mcp__todoist__add-tasks"]
```

to:

```yaml
tools: ["Bash", "mcp__shortcut__stories-create", "mcp__shortcut__epics-create"]
```

- [ ] **Step 2: Replace the "Work tasks with Todoist destination" section**

In `agents/vault-triage-executor.md`, replace lines 42-43:

```markdown
**Work tasks with Todoist destination → Todoist:**
Use mcp__todoist__add-tasks. Same fields as personal tasks below, but labels must include "work" plus any additional tags (e.g., ["work", "firefish"]).
```

with:

```markdown
**Work tasks with Todoist destination → Todoist:**
Use the `td` CLI via Bash. Same fields as personal tasks below, but labels must include "work" plus any additional tags.

Example:
```bash
td task add "Task description" \
  --labels "work,firefish" \
  --priority p2 \
  --description "From daily note YYYY-MM-DD"
```
```

- [ ] **Step 3: Replace the "Personal tasks" section**

In `agents/vault-triage-executor.md`, replace lines 45-52:

```markdown
**Personal tasks → Todoist:**
Use mcp__todoist__add-tasks. Map fields as follows:
- content: task description (concise, actionable)
- description: additional context if any (e.g., source daily note date)
- dueString: natural language date if mentioned in the note (e.g., "tomorrow", "next Friday")
- labels: always include "personal", plus any additional tags from classification (e.g., ["personal", "health"])
- priority: "p2" for normal, "p1" for urgent/time-sensitive
- projectId: "inbox" (unless user has specified a project)
```

with:

```markdown
**Personal tasks → Todoist:**
Use the `td` CLI via Bash. Map fields to flags:

| Field | Flag | Notes |
|-------|------|-------|
| content | positional arg | concise, actionable description |
| description | `--description` | additional context (e.g., source daily note date) |
| due date | `--due` | natural language if mentioned (e.g., "tomorrow", "next Friday") |
| labels | `--labels` | comma-separated; always include "personal" (e.g., "personal,health") |
| priority | `--priority` | `p2` for normal, `p1` for urgent/time-sensitive |

Omit `--due` if no date is mentioned. Do not set a project (defaults to inbox).

Example:
```bash
td task add "Buy groceries" \
  --labels "personal,health" \
  --priority p2 \
  --due "next Friday" \
  --description "From daily note 2026-04-10"
```

Verify each task was created by checking the CLI output for a success message. If the command fails, report the error in the execution report as ⚠️.
```

- [ ] **Step 4: Verify the full executor file reads correctly**

Read the file end-to-end and confirm:
- Tools list has exactly: `["Bash", "mcp__shortcut__stories-create", "mcp__shortcut__epics-create"]`
- No remaining references to `mcp__todoist`
- CLI examples are syntactically correct
- Shortcut sections (lines 28-40) are untouched
- Knowledge/Plans/References sections (lines 54+) are untouched

- [ ] **Step 5: Commit**

```bash
git add agents/vault-triage-executor.md
git commit -m "Migrate executor from Todoist MCP to td CLI

Replace mcp__todoist__add-tasks with td task add via Bash.
Remove MCP tool dependency, add CLI flag mapping and examples."
```

---

### Task 2: Update main skill file — fix tools description

**Files:**
- Modify: `skills/daily-note-triage/SKILL.md:144`

- [ ] **Step 1: Update the tools description on line 144**

In `skills/daily-note-triage/SKILL.md`, change line 144:

```markdown
- **Subagents are defined agents** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to Bash + MCP. This prevents them from using Grep/Read instead of the obsidian CLI.
```

to:

```markdown
- **Subagents are defined agents** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to Bash + Shortcut MCP. This prevents them from using Grep/Read instead of the obsidian CLI. Todoist tasks are created via the `td` CLI (run through Bash).
```

- [ ] **Step 2: Verify no other MCP/Todoist references need updating**

Grep the skill file for "mcp" and "todoist" (case-insensitive). The only Todoist references should be in routing descriptions (lines 45, 90, 128-129, 140) which describe the *destination* ("Todoist"), not the *tool* — these are correct as-is.

- [ ] **Step 3: Commit**

```bash
git add skills/daily-note-triage/SKILL.md
git commit -m "Update skill docs: note Todoist uses td CLI, not MCP"
```

---

### Task 3: Smoke test the full triage flow

- [ ] **Step 1: Dry-run a td task add to confirm CLI is working**

```bash
td task add "Smoke test from triage migration" \
  --labels "personal" \
  --priority p2 \
  --description "Testing CLI integration for triage skill" \
  --dry-run
```

Expected: output showing `[dry-run] Would add task:` with the correct fields.

- [ ] **Step 2: Run the triage skill**

Invoke the daily-note-triage skill (`/daily-note-triage`) and process at least one note through to Todoist task creation. Confirm:
- The executor subagent uses `td task add` (not `mcp__todoist__add-tasks`)
- The task appears in Todoist
- Labels, priority, and description are correct
- The execution report shows ✅ for Todoist items

- [ ] **Step 3: Verify no MCP references remain in changed files**

```bash
grep -ri "mcp__todoist" agents/ skills/
```

Expected: no output (zero matches).
