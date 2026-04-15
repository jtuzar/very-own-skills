import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerObsidianTools } from "./tools/obsidian.ts";

const server = new McpServer({ name: "triage-tools", version: "1.0.0" });

registerObsidianTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("triage-tools MCP server running on stdio");
