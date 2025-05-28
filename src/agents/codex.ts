import { Sandbox } from "@e2b/code-interpreter";

import { generatePRMetadata } from "./utils.js";

export interface CodexConfig {
  openaiApiKey: string;
  githubToken: string;
  repoUrl: string; // org/repo, e.g. "octocat/hello-world"
  e2bApiKey: string;
  e2bTemplateId?: string;
  model?: string;
  sandboxId?: string;
}

export interface CodexResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxId: string;
  patch?: string;
  patchApplyScript?: string;
  branchName?: string;
  commitSha?: string;
}

export interface CodexStreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}

export class CodexAgent {
  private config: CodexConfig;
  private sbx?: Sandbox;
  private lastPrompt?: string;

  constructor(config: CodexConfig) {
    this.config = config;
  }

  private async getSandbox(): Promise<Sandbox> {
    if (this.sbx) return this.sbx;
    if (this.config.sandboxId) {
      this.sbx = await Sandbox.resume(this.config.sandboxId, {
        apiKey: this.config.e2bApiKey,
      });
    } else {
      this.sbx = await Sandbox.create(
        this.config.e2bTemplateId || "super-codex",
        {
          envs: {
            OPENAI_API_KEY: this.config.openaiApiKey,
          },
          apiKey: this.config.e2bApiKey,
        }
      );
    }
    return this.sbx;
  }

  public async killSandbox() {
    if (this.sbx) {
      await this.sbx.kill();
      this.sbx = undefined;
    }
  }

  public async pauseSandbox() {
    if (this.sbx) {
      await this.sbx.pause();
    }
  }

  public async resumeSandbox() {
    if (this.sbx) {
      this.sbx = await Sandbox.resume(this.sbx.sandboxId, {
        apiKey: this.config.e2bApiKey,
      });
    }
  }

  /**
   * Call Codex to generate/apply code, return patch and helper script.
   */
  public async generateCode(
    prompt: string,
    callbacks?: CodexStreamCallbacks
  ): Promise<CodexResponse> {
    const config = this.config;
    const _prompt =
      "Do the necessary changes to the codebase based on the users input.\n" +
      "Don't ask any follow up questions.\n\n" +
      `User: ${prompt}`;
    try {
      const sbx = await this.getSandbox();
      const repoDir = config.repoUrl.split("/")[1];
      if (!config.sandboxId && sbx.sandboxId) {
        callbacks?.onUpdate?.(
          `{"type": "start", "sandbox_id": "${sbx.sandboxId}"}`
        );
        callbacks?.onUpdate?.(
          `{"type": "git", "output": "Cloning repository: ${config.repoUrl}"}`
        );
        await sbx.commands.run(
          `git clone https://x-access-token:${config.githubToken}@github.com/${config.repoUrl}.git`,
          { timeoutMs: 3600000 }
        );
        // Set generic bot identity for git
        await sbx.commands.run(
          `cd ${repoDir} && git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com"`,
          { timeoutMs: 60000 }
        );
      } else if (config.sandboxId) {
        callbacks?.onUpdate?.(
          `{"type": "start", "sandbox_id": "${config.sandboxId}"}`
        );
      }

      const result = await sbx.commands.run(
        `cd ${repoDir} && codex --approval-mode auto-edit${
          config.model ? ` -m ${config.model}` : ""
        } --quiet "${_prompt}"`,
        {
          timeoutMs: 3600000,
          onStdout: (data) => callbacks?.onUpdate?.(data),
          onStderr: (data) => callbacks?.onUpdate?.(data),
        }
      );

      callbacks?.onUpdate?.(
        `{"type": "end", "sandbox_id": "${
          sbx.sandboxId
        }", "output": "${JSON.stringify(result)}"}`
      );

      this.lastPrompt = prompt;

      return {
        sandboxId: sbx.sandboxId,
        ...result,
      };
    } catch (error) {
      console.error("Error calling Codex:", error);
      const errorMessage = `Failed to generate code: ${
        error instanceof Error ? error.message : String(error)
      }`;
      callbacks?.onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Create a Pull Request using the GitHub REST API.
   * This method handles the complete workflow:
   * 1. Creates a new branch
   * 2. Applies the patch via GitHub API
   * 3. Creates the PR
   */
  public async createPullRequest(): Promise<{
    html_url: string;
    number: number;
    branchName: string;
    commitSha?: string;
  }> {
    const { githubToken, repoUrl } = this.config;
    const repoDir = repoUrl.split("/")[1];

    // Get the current branch (base branch) BEFORE creating a new branch
    const baseBranch = await this.sbx?.commands.run(
      `cd ${repoDir} && git rev-parse --abbrev-ref HEAD`,
      { timeoutMs: 3600000 }
    );

    const patch = await this.sbx?.commands.run(
      `cd ${repoDir} && git diff --diff-filter=ACMR`,
      { timeoutMs: 3600000 }
    );

    if (!patch) {
      throw new Error("No patch found");
    }

    const { title, body, branchName, commitMessage } = await generatePRMetadata(
      patch?.stdout || "",
      "codex",
      this.config.openaiApiKey,
      this.lastPrompt || ""
    );

    const checkout = await this.sbx?.commands.run(
      `cd ${repoDir} && git checkout -b ${branchName} && git add -A && git commit -m "${commitMessage}"`,
      { timeoutMs: 3600000 }
    );

    // Push the branch to GitHub
    await this.sbx?.commands.run(
      `cd ${repoDir} && git push origin ${branchName}`,
      {
        timeoutMs: 3600000,
      }
    );

    // Extract commit SHA from checkout output
    const commitMatch = checkout?.stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    const commitSha = commitMatch ? commitMatch[1] : undefined;

    // Create Pull Request using GitHub API
    const [owner, repo] = repoUrl.split("/");
    const prResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          head: branchName,
          base: baseBranch?.stdout.trim() || "main",
        }),
      }
    );

    if (!prResponse.ok) {
      const errorText = await prResponse.text();
      throw new Error(`Failed to create PR: ${prResponse.status} ${errorText}`);
    }

    const prData = await prResponse.json();

    await this.sbx?.pause();

    return {
      html_url: prData.html_url,
      number: prData.number,
      branchName,
      commitSha,
    };
  }
}
