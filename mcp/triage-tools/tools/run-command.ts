import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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
