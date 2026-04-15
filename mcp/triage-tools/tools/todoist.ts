import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
