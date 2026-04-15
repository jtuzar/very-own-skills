import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
