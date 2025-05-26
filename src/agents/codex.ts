import { Sandbox } from "@e2b/code-interpreter";

/**
 * Interface for configuration required by the Codex agent
 */
export interface CodexConfig {
  openaiApiKey: string;
  githubToken: string;
  repoUrl: string;
  e2bApiKey: string;
  e2bTemplateId: string;
  model: string;
  sandboxId?: string;
}

/**
 * Interface for the response returned by the Codex agent
 */
export interface CodexResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxId: string;
}

/**
 * Calls the Codex agent to generate code based on a prompt
 * @param prompt - The text prompt describing the code to generate
 * @param config - Configuration containing API keys and other settings
 * @returns A promise that resolves to the generated code response
 */
export async function callCodex(
  prompt: string,
  config: CodexConfig
): Promise<CodexResponse> {
  try {
    // In a real implementation, this would make an API call to OpenAI
    // This is a simple example implementation
    let sbx: Sandbox;

    if (config.sandboxId) {
      sbx = await Sandbox.resume(config.sandboxId, {
        apiKey: config.e2bApiKey,
      });
    } else {
      sbx = await Sandbox.create(config.e2bTemplateId, {
        envs: {
          OPENAI_API_KEY: config.openaiApiKey,
        },
        apiKey: config.e2bApiKey,
      });

      // Create ~/.vibekit/memory.jsonl if it doesn't exist
      await sbx.commands.run(
        `mkdir -p ~/.vibekit && [ ! -f ~/.vibekit/memory.jsonl ] && touch ~/.vibekit/memory.jsonl || true`
      );

      // Check if AGENTS.md exists, create it if not and add to .gitignore
      await sbx.commands.run(
        `[ ! -f AGENTS.md ] && echo "ALWAYS check ~/.vibekit/memory.jsonl for conversation history" > AGENTS.md || true`
      );
      await sbx.commands.run(
        `[ ! -f AGENTS.md ] || (grep -q "AGENTS.md" .gitignore 2>/dev/null || echo "AGENTS.md" >> .gitignore)`
      );

      await sbx.commands.run(
        `git clone https://x-access-token:${config.githubToken}@github.com/${config.repoUrl}.git`,
        { timeoutMs: 3600000 } // 5 minute timeout for git clone
      );
    }

    await sbx.commands.run("cd workspace");

    const result = await sbx.commands.run(
      `codex -a auto-edit -m ${config.model || "gpt-4.1"} --quiet "${prompt}"`,
      { timeoutMs: 3600000 } // Set timeout to 1 hour for codex command
    );

    const list = await sbx.commands.run("cd ~/.vibekit/ && ls -la");
    console.log("list:\n", list.stdout);
    // Hack for memory in headless codex
    await sbx.commands.run(
      `cat <<EOF >> ~/.vibekit/memory.jsonl
  Timestamp: ${new Date().toLocaleString()}
  ${result.stdout}`
    );

    await sbx.pause();

    return { sandboxId: sbx.sandboxId, ...result };
  } catch (error) {
    console.error("Error calling Codex:", error);
    throw new Error(
      `Failed to generate code: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
