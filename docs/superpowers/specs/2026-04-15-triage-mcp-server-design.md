# Triage MCP Server Design

Replace freeform Bash usage in the daily-note-triage subagents with a purpose-built MCP server that exposes typed tools for Obsidian vault operations and Todoist task creation.

## Problem

The triage subagents (gatherer, executor) currently use the Bash tool to construct `obsidian` and `td` CLI commands from their system prompts. This causes:

- **Incorrect commands** — agents hallucinate flags or get syntax wrong
- **Permission friction** — agents insert commands like `echo` that aren't auto-approved, interrupting the triage flow
- **Silent workarounds** — agents can use any Bash command to work around limitations, masking capability gaps

The official Todoist MCP was tried and rejected — it exposed ~70k tokens of tool definitions for dozens of operations when only `task add` is needed.

## Design: Single Triage MCP with Carve-Out Seam

One MCP server (`triage-tools`) exposes all tools needed by the triage workflow. Internally, tools are organized by backing CLI (`tools/obsidian.ts`, `tools/todoist.ts`) so they can be extracted into independent MCPs later if other consumers emerge.

### Tool Inventory

#### Obsidian tools (`tools/obsidian.ts`)

| Tool | Params | Used by |
|------|--------|---------|
| `obsidian_search` | `query: string`, `path?: string` | gatherer |
| `obsidian_read` | `path: string` | gatherer, executor |
| `obsidian_create` | `path: string`, `content: string` | executor |
| `obsidian_append` | `path: string`, `content: string` | executor |
| `obsidian_property_set` | `path: string`, `name: string`, `value: string`, `type: string` | executor |

#### Todoist tools (`tools/todoist.ts`)

| Tool | Params | Used by |
|------|--------|---------|
| `todoist_add_task` | `content: string`, `labels?: string[]`, `priority?: string`, `due?: string`, `description?: string` | executor |

### Implementation Details

- **Runtime:** Deno — runs TypeScript directly, no build step
- **Transport:** Stdio — Claude Code spawns the process, communicates over stdin/stdout
- **Dependencies:** `@modelcontextprotocol/sdk` (via `npm:` specifier), `zod` (via `npm:` specifier)
- **CLI execution:** `Deno.Command` to spawn `obsidian` and `td` processes
- **Error handling:** On success, return stdout as text content. On non-zero exit, return stderr as text content with `isError: true`. No error swallowing.
- **Output transformation:** None. The agent gets exactly what the CLI returns.

### File Structure

```
very-own-skills/
  .mcp.json                        # registers triage_tools server
  mcp/
    triage-tools/
      deno.json                    # dependencies, permissions
      server.ts                    # server entry point, tool registration
      tools/
        obsidian.ts                # obsidian CLI tool handlers
        todoist.ts                 # td CLI tool handler
```

### MCP Registration (`.mcp.json` at plugin root)

```json
{
  "mcpServers": {
    "triage_tools": {
      "command": "deno",
      "args": ["run", "--allow-run", "mcp/triage-tools/server.ts"]
    }
  }
}
```

## Agent Changes

### Tool Lists

Bash is removed from both agents. Each agent gets only the MCP tools it needs.

**vault-triage-gatherer:**
```yaml
tools: [
  "mcp__triage_tools__obsidian_search",
  "mcp__triage_tools__obsidian_read",
  "mcp__shortcut__epics-search"
]
```

**vault-triage-executor:**
```yaml
tools: [
  "mcp__triage_tools__obsidian_create",
  "mcp__triage_tools__obsidian_append",
  "mcp__triage_tools__obsidian_read",
  "mcp__triage_tools__obsidian_property_set",
  "mcp__triage_tools__todoist_add_task",
  "mcp__shortcut__stories-create",
  "mcp__shortcut__epics-create"
]
```

### System Prompt Changes

Remove from both agents:
- The "Obsidian CLI commands" reference sections
- The "td CLI via Bash" syntax/examples (executor only)
- The `CRITICAL: You MUST use the obsidian CLI via the Bash tool` instruction

The agents no longer need to know CLI syntax — the MCP tools handle that. The system prompts shrink to just the classification logic (gatherer) and execution rules (executor).

### No Bash Fallback

With Bash removed from the tool lists, agents cannot work around missing capabilities. If an agent needs something the MCP doesn't provide, the operation fails visibly instead of being papered over with an ad-hoc Bash command.

## GAPS Reporting

Both agents add a `GAPS` section to their structured report format to explicitly surface missing capabilities.

### Agent Instructions

Add to both agent system prompts:

> If you cannot complete an action because no available tool supports it, do not improvise. Record it in the GAPS section of your report and move on.

### Report Format

**Gatherer** (appended after `ITEMS:` block):
```
GAPS:
- NEEDED: [what it tried to do] | CONTEXT: [why it was needed]
```

**Executor** (appended after `EXECUTED: / SKIPPED: / TRIAGED:` block):
```
GAPS:
- NEEDED: [what it tried to do] | CONTEXT: [which item required it]
```

If no gaps, the section is omitted.

### Improvement Prompt (Skill Phase 4)

After presenting the triage summary, the main agent checks both subagent reports for a `GAPS` section. If found, it surfaces the gaps to the user:

```
MCP gap detected:
- Agent [name] needed [capability] but no tool was available
- Consider adding [tool_name] to triage-tools
```

This is advisory — the user decides whether to act on it. Over time, this feedback loop ensures the MCP grows to cover real usage patterns.

## Future Carve-Out Path

When a second consumer for obsidian or todoist tools appears:

1. Move `tools/obsidian.ts` into its own MCP server (`mcp/obsidian/`)
2. Register it separately in `.mcp.json`
3. Update agent tool lists to point at the new server name
4. The triage-tools server shrinks or is retired

The internal module split makes this a file move, not a rewrite.
