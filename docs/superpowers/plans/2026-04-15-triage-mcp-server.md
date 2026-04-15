# Triage MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace freeform Bash usage in triage subagents with a typed MCP server that wraps the `obsidian` and `td` CLIs.

**Architecture:** Single Deno TypeScript MCP server with stdio transport. Tools organized into separate modules (`tools/obsidian.ts`, `tools/todoist.ts`) sharing a run-command helper. Registered via `.mcp.json` at plugin root. Agents updated to use MCP tools instead of Bash.

**Tech Stack:** Deno, `@modelcontextprotocol/server`, Zod v4

**Spec:** `docs/superpowers/specs/2026-04-15-triage-mcp-server-design.md`

---

### Task 1: Scaffold MCP server project

**Files:**
- Create: `mcp/triage-tools/deno.json`
- Create: `mcp/triage-tools/server.ts`

- [ ] **Step 1: Create `mcp/triage-tools/deno.json`**

```json
{
  "imports": {
    "@modelcontextprotocol/server": "npm:@modelcontextprotocol/server@latest",
    "zod/v4": "npm:zod@latest/v4"
  }
}
```

- [ ] **Step 2: Create `mcp/triage-tools/server.ts` with minimal server**

```typescript
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";

const server = new McpServer({ name: "triage-tools", version: "1.0.0" });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("triage-tools MCP server running on stdio");
```

- [ ] **Step 3: Verify the server starts**

Run: `cd mcp/triage-tools && deno run --allow-run server.ts`

Expected: The process starts without errors and prints `triage-tools MCP server running on stdio` to stderr. It blocks waiting for stdin (JSON-RPC). Kill with Ctrl+C.

If Deno compatibility issues arise with the npm package, try adding `"nodeModulesDir": "auto"` to `deno.json`.

- [ ] **Step 4: Commit**

```bash
git add mcp/triage-tools/deno.json mcp/triage-tools/server.ts
git commit -m "feat(mcp): scaffold triage-tools MCP server with Deno"
```

---

### Task 2: Implement run-command helper

**Files:**
- Create: `mcp/triage-tools/tools/run-command.ts`

- [ ] **Step 1: Create `mcp/triage-tools/tools/run-command.ts`**

Shared utility that runs a CLI command via `Deno.Command` and returns an MCP-compatible `CallToolResult`.

```typescript
import type { CallToolResult } from "@modelcontextprotocol/server";

const decoder = new TextDecoder();

export async function runCommand(
  command: string,
  args: string[],
): Promise<CallToolResult> {
  try {
    const cmd = new Deno.Command(command, { args });
    const { success, stdout, stderr } = await cmd.output();

    if (success) {
      return {
        content: [{ type: "text" as const, text: decoder.decode(stdout) }],
      };
    }

    const errText = decoder.decode(stderr) || decoder.decode(stdout);
    return {
      content: [{ type: "text" as const, text: errText }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to run ${command}: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}
```

Uses `Deno.Command` (not `child_process`) — each argument is passed directly to the process without shell interpolation, preventing injection. The outer try/catch handles cases where the CLI binary is not found on PATH.

- [ ] **Step 2: Commit**

```bash
git add mcp/triage-tools/tools/run-command.ts
git commit -m "feat(mcp): add run-command helper for safe CLI execution"
```

---

### Task 3: Implement obsidian tools

**Files:**
- Create: `mcp/triage-tools/tools/obsidian.ts`
- Modify: `mcp/triage-tools/server.ts`

- [ ] **Step 1: Create `mcp/triage-tools/tools/obsidian.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { runCommand } from "./run-command.ts";

export function registerObsidianTools(server: McpServer) {
  server.registerTool(
    "obsidian_search",
    {
      description: "Search the Obsidian vault by text query",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        path: z.string().optional().describe(
          "Vault subfolder to search in (e.g., 'Dailies', 'Knowledge')",
        ),
      }),
    },
    async ({ query, path }) => {
      const args = ["search", `query=${query}`];
      if (path) args.push(`path=${path}`);
      return await runCommand("obsidian", args);
    },
  );

  server.registerTool(
    "obsidian_read",
    {
      description: "Read the full content of a note in the vault",
      inputSchema: z.object({
        path: z.string().describe(
          "Note path relative to vault root (e.g., 'Dailies/2026-04-10.md')",
        ),
      }),
    },
    async ({ path }) => {
      return await runCommand("obsidian", ["read", `path=${path}`]);
    },
  );

  server.registerTool(
    "obsidian_create",
    {
      description: "Create a new note in the vault",
      inputSchema: z.object({
        path: z.string().describe(
          "Note path relative to vault root (e.g., 'Knowledge/Topic.md')",
        ),
        content: z.string().describe("Full note content including frontmatter"),
      }),
    },
    async ({ path, content }) => {
      return await runCommand("obsidian", [
        "create",
        `path=${path}`,
        `content=${content}`,
      ]);
    },
  );

  server.registerTool(
    "obsidian_append",
    {
      description: "Append content to an existing note in the vault",
      inputSchema: z.object({
        path: z.string().describe("Note path relative to vault root"),
        content: z.string().describe("Content to append"),
      }),
    },
    async ({ path, content }) => {
      return await runCommand("obsidian", [
        "append",
        `path=${path}`,
        `content=${content}`,
      ]);
    },
  );

  server.registerTool(
    "obsidian_property_set",
    {
      description: "Set a frontmatter property on a note",
      inputSchema: z.object({
        path: z.string().describe("Note path relative to vault root"),
        name: z.string().describe("Property name"),
        value: z.string().describe("Property value"),
        type: z.string().describe(
          "Property type (e.g., 'checkbox', 'text', 'number')",
        ),
      }),
    },
    async ({ path, name, value, type }) => {
      return await runCommand("obsidian", [
        "property:set",
        `name=${name}`,
        `value=${value}`,
        `type=${type}`,
        `path=${path}`,
      ]);
    },
  );
}
```

- [ ] **Step 2: Wire obsidian tools into server.ts**

Replace the content of `mcp/triage-tools/server.ts` with:

```typescript
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { registerObsidianTools } from "./tools/obsidian.ts";

const server = new McpServer({ name: "triage-tools", version: "1.0.0" });

registerObsidianTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("triage-tools MCP server running on stdio");
```

- [ ] **Step 3: Verify the server still starts**

Run: `cd mcp/triage-tools && deno run --allow-run server.ts`

Expected: Starts without errors. Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add mcp/triage-tools/tools/obsidian.ts mcp/triage-tools/server.ts
git commit -m "feat(mcp): add obsidian vault tools (search, read, create, append, property_set)"
```

---

### Task 4: Implement todoist tool

**Files:**
- Create: `mcp/triage-tools/tools/todoist.ts`
- Modify: `mcp/triage-tools/server.ts`

- [ ] **Step 1: Create `mcp/triage-tools/tools/todoist.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { runCommand } from "./run-command.ts";

export function registerTodoistTools(server: McpServer) {
  server.registerTool(
    "todoist_add_task",
    {
      description: "Create a new task in Todoist",
      inputSchema: z.object({
        content: z.string().describe("Task description (concise, actionable)"),
        labels: z.array(z.string()).optional().describe(
          "Labels to apply (e.g., ['work', 'firefish'] or ['personal', 'health'])",
        ),
        priority: z.string().optional().describe(
          "Priority level: p1 (urgent) or p2 (normal)",
        ),
        due: z.string().optional().describe(
          "Due date in natural language (e.g., 'tomorrow', 'next Friday'). Omit if no date.",
        ),
        description: z.string().optional().describe(
          "Additional context (e.g., 'From daily note 2026-04-10')",
        ),
      }),
    },
    async ({ content, labels, priority, due, description }) => {
      const args = ["task", "add", content];
      if (labels?.length) args.push("--labels", labels.join(","));
      if (priority) args.push("--priority", priority);
      if (due) args.push("--due", due);
      if (description) args.push("--description", description);
      return await runCommand("td", args);
    },
  );
}
```

- [ ] **Step 2: Wire todoist tools into server.ts**

Replace the content of `mcp/triage-tools/server.ts` with:

```typescript
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { registerObsidianTools } from "./tools/obsidian.ts";
import { registerTodoistTools } from "./tools/todoist.ts";

const server = new McpServer({ name: "triage-tools", version: "1.0.0" });

registerObsidianTools(server);
registerTodoistTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("triage-tools MCP server running on stdio");
```

- [ ] **Step 3: Verify the server still starts**

Run: `cd mcp/triage-tools && deno run --allow-run server.ts`

Expected: Starts without errors. Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add mcp/triage-tools/tools/todoist.ts mcp/triage-tools/server.ts
git commit -m "feat(mcp): add todoist_add_task tool wrapping td CLI"
```

---

### Task 5: Register MCP server in plugin

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Create `.mcp.json` at plugin root**

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

- [ ] **Step 2: Commit**

```bash
git add .mcp.json
git commit -m "feat(mcp): register triage-tools server in plugin .mcp.json"
```

---

### Task 6: Update gatherer agent

**Files:**
- Modify: `agents/vault-triage-gatherer.md`

- [ ] **Step 1: Update frontmatter — replace tools list**

Change:
```yaml
tools: ["Bash", "mcp__shortcut__epics-search"]
```

To:
```yaml
tools: ["mcp__triage_tools__obsidian_search", "mcp__triage_tools__obsidian_read", "mcp__shortcut__epics-search"]
```

- [ ] **Step 2: Remove CLI documentation from system prompt**

Delete the block:
```
**CRITICAL: You MUST use the `obsidian` CLI via the Bash tool for ALL vault operations. Do NOT use Read, Grep, Glob, or any other tool to access vault files.**

## Obsidian CLI commands

- Search: `obsidian search query='...' path="Dailies"`
- Read: `obsidian read path="Dailies/YYYY-MM-DD.md"`
```

Replace with:
```
You have access to Obsidian vault tools (`obsidian_search`, `obsidian_read`) via the triage_tools MCP server. Use these tools for all vault operations.
```

- [ ] **Step 3: Update step instructions to reference tools instead of CLI commands**

In **Step 1**, change:
```
Run: `obsidian search query='"triaged: false"' path="Dailies"`
```
To:
```
Use `obsidian_search` with `query: "triaged: false"` and `path: "Dailies"`.
```

In **Step 2**, change:
```
Read it: `obsidian read path="Dailies/YYYY-MM-DD.md"`
```
To:
```
Use `obsidian_read` with `path: "Dailies/YYYY-MM-DD.md"`.
```

In **Step 3**, change:
```
Run: `obsidian search query="relevant keywords" path="Knowledge"`
Run: `obsidian search query="relevant keywords" path="Plans"`
```
To:
```
Use `obsidian_search` with relevant keywords and `path: "Knowledge"`.
Use `obsidian_search` with relevant keywords and `path: "Plans"`.
```

- [ ] **Step 4: Add GAPS reporting to the report format**

After the existing Step 5 report format block, add:

```
If you cannot complete an action because no available tool supports it, do not improvise. Record it in a GAPS section at the end of your report:

GAPS:
- NEEDED: [what you tried to do] | CONTEXT: [why it was needed]

Omit the GAPS section if there are no gaps.
```

- [ ] **Step 5: Commit**

```bash
git add agents/vault-triage-gatherer.md
git commit -m "refactor(agents): update gatherer to use MCP tools instead of Bash"
```

---

### Task 7: Update executor agent

**Files:**
- Modify: `agents/vault-triage-executor.md`

- [ ] **Step 1: Update frontmatter — replace tools list**

Change:
```yaml
tools: ["Bash", "mcp__shortcut__stories-create", "mcp__shortcut__epics-create"]
```

To:
```yaml
tools: ["mcp__triage_tools__obsidian_create", "mcp__triage_tools__obsidian_append", "mcp__triage_tools__obsidian_read", "mcp__triage_tools__obsidian_property_set", "mcp__triage_tools__todoist_add_task", "mcp__shortcut__stories-create", "mcp__shortcut__epics-create"]
```

- [ ] **Step 2: Remove CLI documentation from system prompt**

Delete the block:
```
**CRITICAL: You MUST use the `obsidian` CLI via the Bash tool for ALL vault operations. Do NOT use Read, Grep, Glob, or any other tool to access vault files.**

## Obsidian CLI commands

- Create note: `obsidian create path="[Folder]/[Title].md" content="..."`
- Append to note: `obsidian append path="[Folder]/[Existing Note].md" content="..."`
- Read note: `obsidian read path="[path]"`
- Set property: `obsidian property:set name="triaged" value="true" type="checkbox" path="Dailies/YYYY-MM-DD.md"`
```

Replace with:
```
You have access to Obsidian vault tools (`obsidian_create`, `obsidian_append`, `obsidian_read`, `obsidian_property_set`) and Todoist (`todoist_add_task`) via the triage_tools MCP server. Use these tools for all vault and task operations.
```

- [ ] **Step 3: Replace Todoist CLI docs with tool reference**

Delete the entire "Work tasks with Todoist destination" section (the one with the `td` CLI examples and the flag mapping table) and the "Personal tasks" section with its `td` CLI example. Replace both with:

```
**Work tasks with Todoist destination -> Todoist:**
Use `todoist_add_task`. Set `labels` to include "work" plus any additional tags from the approved item.

**Personal tasks -> Todoist:**
Use `todoist_add_task`. Set `labels` to include "personal" plus any additional tags. Set `priority` to "p1" for urgent/time-sensitive, "p2" for normal. Set `due` only if a date was mentioned. Set `description` to "From daily note YYYY-MM-DD".
```

- [ ] **Step 4: Replace obsidian CLI examples with tool references**

In the "Knowledge / Plans" section, change:
```
- New note: `obsidian create path="[Folder]/[Title].md" content="..."`
- Append: `obsidian append path="[Folder]/[Existing Note].md" content="..."`
```
To:
```
- New note: Use `obsidian_create` with the full note path and content (include frontmatter with tags).
- Append: Use `obsidian_append` with the existing note path and new content section.
```

In the "References" section, change:
```
`obsidian append path="References/Reading List.md" content="..."`
```
To:
```
Use `obsidian_append` with `path: "References/Reading List.md"` and the formatted reference line as content.
```

In the "verify by reading" instruction, change:
```
`obsidian read path="[path]"`
```
To:
```
Use `obsidian_read` with the path you just wrote to.
```

In the "mark as triaged" instruction, change:
```
`obsidian property:set name="triaged" value="true" type="checkbox" path="Dailies/YYYY-MM-DD.md"`
```
To:
```
Use `obsidian_property_set` with `name: "triaged"`, `value: "true"`, `type: "checkbox"`, and the daily note path.
```

- [ ] **Step 5: Add GAPS reporting to the report format**

After the existing report format block, add:

```
If you cannot complete an action because no available tool supports it, do not improvise. Record it in a GAPS section at the end of your report:

GAPS:
- NEEDED: [what you tried to do] | CONTEXT: [which item required it]

Omit the GAPS section if there are no gaps.
```

- [ ] **Step 6: Commit**

```bash
git add agents/vault-triage-executor.md
git commit -m "refactor(agents): update executor to use MCP tools instead of Bash"
```

---

### Task 8: Update triage skill Phase 4 with improvement prompt

**Files:**
- Modify: `skills/daily-note-triage/SKILL.md`

- [ ] **Step 1: Add GAPS detection to Phase 4**

In the "Phase 4: Report" section of `skills/daily-note-triage/SKILL.md`, after the existing report format, add:

```markdown
### Phase 4b: Surface MCP gaps

After presenting the triage summary, check both subagent reports for a `GAPS` section. If either report contains gaps, append to the summary:

> 🔧 MCP gap detected:
> - [agent name] needed [capability] but no tool was available
> - Consider adding [tool_name] to triage-tools MCP server
```

- [ ] **Step 2: Update the Gotchas section**

In the "Gotchas" section, replace:
```
- **Subagents are defined agents** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to Bash + Shortcut MCP. This prevents them from using Grep/Read instead of the obsidian CLI. Todoist tasks are created via the `td` CLI (run through Bash).
```
With:
```
- **Subagents use typed MCP tools** (`vault-triage-gatherer`, `vault-triage-executor`) with tools restricted to `triage_tools` MCP + Shortcut MCP. No Bash access — all vault and Todoist operations go through the triage-tools MCP server. If a subagent reports GAPS, consider adding the missing tool to the MCP server.
```

- [ ] **Step 3: Commit**

```bash
git add skills/daily-note-triage/SKILL.md
git commit -m "feat(skill): add MCP gap detection to triage Phase 4"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Verify the MCP server starts and lists tools**

Start a new Claude Code session in the `very-own-skills` directory. The `.mcp.json` should cause Claude Code to spawn the triage-tools server automatically. Verify:

1. No startup errors in the Claude Code output
2. The tools `mcp__triage_tools__obsidian_search`, `mcp__triage_tools__obsidian_read`, etc. appear as available tools

- [ ] **Step 2: Test a single tool call**

Ask Claude to call `obsidian_search` with a simple query to verify the MCP server correctly shells out to the `obsidian` CLI and returns output.

- [ ] **Step 3: Run a triage session**

Invoke the triage skill ("triage my notes") and verify:

1. The gatherer subagent uses MCP tools (not Bash)
2. The executor subagent uses MCP tools (not Bash)
3. No permission prompts for CLI commands
4. The workflow completes without errors

- [ ] **Step 4: Final commit — bump version**

Update `.claude-plugin/plugin.json` version from `0.5.1` to `0.6.0` (new feature: MCP server).

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: bump version to 0.6.0"
```
