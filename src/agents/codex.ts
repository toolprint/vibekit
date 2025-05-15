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
}

/**
 * Interface for the response returned by the Codex agent
 */
export interface CodexResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
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
    const sbx = await Sandbox.create(config.e2bTemplateId, {
      envs: {
        OPENAI_API_KEY: config.openaiApiKey,
      },
      apiKey: config.e2bApiKey,
    });

    await sbx.commands.run(
      `git clone https://x-access-token:${config.githubToken}@github.com/${config.repoUrl}.git`,
      { timeoutMs: 300000 } // 5 minute timeout for git clone
    );

    const result = await sbx.commands.run(
      `cd workspace && codex -a auto-edit -m ${
        config.model || "gpt-4.1"
      } --quiet "${prompt}"`,
      { timeoutMs: 0 } // Disable timeout for codex command
    );

    await sbx.kill();

    return result;
  } catch (error) {
    console.error("Error calling Codex:", error);
    throw new Error(
      `Failed to generate code: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
