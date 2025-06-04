import { Sandbox } from "@e2b/code-interpreter";
import { generateCommitMessage, generatePRMetadata } from "./utils";
import { Conversation } from "../types";

export interface BaseAgentConfig {
  githubToken?: string;
  repoUrl?: string;
  e2bApiKey: string;
  e2bTemplateId?: string;
  sandboxId?: string;
  telemetry?: any;
}

export interface StreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}

export interface AgentResponse {
  sandboxId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PullRequestResult {
  html_url: string;
  number: number;
  branchName: string;
  commitSha?: string;
}

export interface AgentCommandConfig {
  command: string;
  errorPrefix: string;
  labelName: string;
  labelColor: string;
  labelDescription: string;
}

export abstract class BaseAgent {
  protected config: BaseAgentConfig;
  protected sbx?: Sandbox;
  protected lastPrompt?: string;
  protected currentBranch?: string;

  constructor(config: BaseAgentConfig) {
    this.config = config;
  }

  protected abstract getCommandConfig(
    prompt: string,
    mode?: "ask" | "code"
  ): AgentCommandConfig;
  protected abstract getDefaultTemplate(): string;

  private async getSandbox(): Promise<Sandbox> {
    if (this.sbx) return this.sbx;
    if (this.config.sandboxId) {
      this.sbx = await Sandbox.resume(this.config.sandboxId, {
        apiKey: this.config.e2bApiKey,
      });
    } else {
      this.sbx = await Sandbox.create(
        this.config.e2bTemplateId || this.getDefaultTemplate(),
        {
          envs: this.getEnvironmentVariables(),
          apiKey: this.config.e2bApiKey,
        }
      );
    }
    return this.sbx;
  }

  protected abstract getEnvironmentVariables(): Record<string, string>;

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

  public async getSession() {
    if (this.sbx) {
      return this.sbx.sandboxId;
    }
    return this.config.sandboxId || null;
  }

  public async setSession(sessionId: string) {
    this.config.sandboxId = sessionId;
  }

  public getCurrentBranch(): string | undefined {
    return this.currentBranch;
  }

  public async generateCode(
    prompt: string,
    mode?: "ask" | "code",
    branch?: string,
    _history?: Conversation[],
    callbacks?: StreamCallbacks
  ): Promise<AgentResponse> {
    const commandConfig = this.getCommandConfig(prompt, mode);

    try {
      const sbx = await this.getSandbox();
      const repoDir = this.config.repoUrl?.split("/")[1] || "";

      if (!this.config.sandboxId && sbx.sandboxId) {
        callbacks?.onUpdate?.(
          `{"type": "start", "sandbox_id": "${sbx.sandboxId}"}`
        );

        // Only clone repository if GitHub config is provided
        if (this.config.githubToken && this.config.repoUrl) {
          callbacks?.onUpdate?.(
            `{"type": "git", "output": "Cloning repository: ${this.config.repoUrl}"}`
          );
          await sbx.commands.run(
            `git clone https://x-access-token:${this.config.githubToken}@github.com/${this.config.repoUrl}.git`,
            { timeoutMs: 3600000 }
          );
          await sbx.commands.run(
            `cd ${repoDir} && git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com"`,
            { timeoutMs: 60000 }
          );
        } else {
          callbacks?.onUpdate?.(
            `{"type": "info", "output": "No GitHub configuration provided - running in sandbox-only mode"}`
          );
        }
      } else if (this.config.sandboxId) {
        callbacks?.onUpdate?.(
          `{"type": "start", "sandbox_id": "${this.config.sandboxId}"}`
        );
      }

      // Switch to specified branch if provided and repository is available
      if (branch && this.config.repoUrl) {
        // Store the branch for later use
        this.currentBranch = branch;

        callbacks?.onUpdate?.(
          `{"type": "git", "output": "Switching to branch: ${branch}"}`
        );
        try {
          // Try to checkout existing branch first
          await sbx.commands.run(`cd ${repoDir} && git checkout ${branch}`, {
            timeoutMs: 60000,
          });
          // Pull latest changes from the remote branch
          callbacks?.onUpdate?.(
            `{"type": "git", "output": "Pulling latest changes from ${branch}"}`
          );
          await sbx.commands.run(`cd ${repoDir} && git pull origin ${branch}`, {
            timeoutMs: 60000,
          });
        } catch (error) {
          // If branch doesn't exist, create it
          callbacks?.onUpdate?.(
            `{"type": "git", "output": "Branch ${branch} not found, creating new branch"}`
          );
          await sbx.commands.run(`cd ${repoDir} && git checkout -b ${branch}`, {
            timeoutMs: 60000,
          });
        }
      }

      // Adjust command execution based on whether we have a repository
      const executeCommand = this.config.repoUrl
        ? `cd ${repoDir} && ${commandConfig.command}`
        : commandConfig.command;

      const result = await sbx.commands.run(executeCommand, {
        timeoutMs: 3600000,
        onStdout: (data) => callbacks?.onUpdate?.(data),
        onStderr: (data) => callbacks?.onUpdate?.(data),
      });

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
      console.error(`Error calling ${commandConfig.errorPrefix}:`, error);
      const errorMessage = `Failed to generate code: ${
        error instanceof Error ? error.message : String(error)
      }`;
      callbacks?.onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  }

  public async pushToBranch(branch?: string): Promise<void> {
    const targetBranch = branch || this.currentBranch;

    if (!targetBranch) {
      throw new Error(
        "No branch specified. Either pass a branch name or call generateCode with a branch first."
      );
    }

    // Validate GitHub configuration is provided
    if (!this.config.githubToken || !this.config.repoUrl) {
      throw new Error(
        "GitHub configuration is required for pushing to branches. Please provide githubToken and repoUrl in your configuration."
      );
    }

    const { repoUrl } = this.config;
    const repoDir = repoUrl?.split("/")[1] || "";

    // Check git status for changes
    const gitStatus = await this.sbx?.commands.run(
      `cd ${repoDir} && git status --porcelain`,
      { timeoutMs: 3600000 }
    );

    // Check for untracked files
    const untrackedFiles = await this.sbx?.commands.run(
      `cd ${repoDir} && git ls-files --others --exclude-standard`,
      { timeoutMs: 3600000 }
    );

    // Check if there are any changes to commit
    if (!gitStatus?.stdout && !untrackedFiles?.stdout) {
      throw new Error("No changes found to commit and push");
    }

    // Switch to the specified branch (create if it doesn't exist)
    try {
      await this.sbx?.commands.run(
        `cd ${repoDir} && git checkout ${targetBranch}`,
        {
          timeoutMs: 60000,
        }
      );
    } catch (error) {
      // If branch doesn't exist, create it
      await this.sbx?.commands.run(
        `cd ${repoDir} && git checkout -b ${targetBranch}`,
        {
          timeoutMs: 60000,
        }
      );
    }

    const diffHead = await this.sbx?.commands.run(
      `cd ${repoDir} && git diff HEAD`,
      { timeoutMs: 3600000 }
    );

    const patch = await this.sbx?.commands.run(
      `cd ${repoDir} && git diff --diff-filter=ACMR`,
      { timeoutMs: 3600000 }
    );

    let patchContent = patch?.stdout || diffHead?.stdout || "";

    // Add all changes and commit
    const { commitMessage } = await generateCommitMessage(
      patchContent,
      this.getAgentType(),
      this.getApiKey(),
      this.lastPrompt || ""
    );

    await this.sbx?.commands.run(
      `cd ${repoDir} && git add -A && git commit -m "${commitMessage}"`,
      { timeoutMs: 3600000 }
    );

    // Push the branch to GitHub
    await this.sbx?.commands.run(
      `cd ${repoDir} && git push origin ${targetBranch}`,
      {
        timeoutMs: 3600000,
      }
    );
  }

  public async createPullRequest(): Promise<PullRequestResult> {
    // Validate GitHub configuration is provided
    if (!this.config.githubToken || !this.config.repoUrl) {
      throw new Error(
        "GitHub configuration is required for creating pull requests. Please provide githubToken and repoUrl in your configuration."
      );
    }

    const { githubToken, repoUrl } = this.config;
    const repoDir = repoUrl?.split("/")[1] || "";
    const commandConfig = this.getCommandConfig("", "code");

    // Get the current branch (base branch) BEFORE creating a new branch
    const baseBranch = await this.sbx?.commands.run(
      `cd ${repoDir} && git rev-parse --abbrev-ref HEAD`,
      { timeoutMs: 3600000 }
    );

    // Debug: Check git status first
    const gitStatus = await this.sbx?.commands.run(
      `cd ${repoDir} && git status --porcelain`,
      { timeoutMs: 3600000 }
    );
    console.log("Git status:", gitStatus);

    // Debug: Check for untracked files
    const untrackedFiles = await this.sbx?.commands.run(
      `cd ${repoDir} && git ls-files --others --exclude-standard`,
      { timeoutMs: 3600000 }
    );
    console.log("Untracked files:", untrackedFiles);

    // Debug: Try different diff commands
    const diffWorking = await this.sbx?.commands.run(
      `cd ${repoDir} && git diff`,
      { timeoutMs: 3600000 }
    );
    console.log("Git diff (working vs index):", diffWorking);

    const diffHead = await this.sbx?.commands.run(
      `cd ${repoDir} && git diff HEAD`,
      { timeoutMs: 3600000 }
    );
    console.log("Git diff HEAD (working vs last commit):", diffHead);

    const patch = await this.sbx?.commands.run(
      `cd ${repoDir} && git diff --diff-filter=ACMR`,
      { timeoutMs: 3600000 }
    );

    console.log("patch", patch);

    if (
      !patch ||
      (!patch.stdout && !diffHead?.stdout && !untrackedFiles?.stdout)
    ) {
      throw new Error(
        `No changes found - check if ${commandConfig.labelName} actually modified any files`
      );
    }

    // Use the diff that has content, preferring the original patch format
    let patchContent = patch?.stdout || diffHead?.stdout || "";

    // If no diff but there are untracked files, we need to add them first
    if (!patchContent && untrackedFiles?.stdout) {
      await this.sbx?.commands.run(`cd ${repoDir} && git add .`, {
        timeoutMs: 3600000,
      });

      const patchAfterAdd = await this.sbx?.commands.run(
        `cd ${repoDir} && git diff --cached`,
        { timeoutMs: 3600000 }
      );
      patchContent = patchAfterAdd?.stdout || "";
    }

    if (!patchContent) {
      throw new Error("No patch content found after checking all diff methods");
    }

    const { title, body, branchName, commitMessage } = await generatePRMetadata(
      patchContent,
      this.getAgentType(),
      this.getApiKey(),
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
    const [owner, repo] = repoUrl?.split("/") || [];
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

    // Handle label creation and assignment
    await this.handlePRLabeling(owner, repo, prData.number, commandConfig);

    return {
      html_url: prData.html_url,
      number: prData.number,
      branchName,
      commitSha,
    };
  }

  protected abstract getApiKey(): string;
  protected abstract getAgentType(): "codex" | "claude";

  private async handlePRLabeling(
    owner: string,
    repo: string,
    prNumber: number,
    commandConfig: AgentCommandConfig
  ) {
    const { githubToken } = this.config;
    const { labelName, labelColor, labelDescription } = commandConfig;

    // Check if label exists first
    const labelCheckResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/labels/${labelName}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    // Only create label if it doesn't exist (404 status)
    if (!labelCheckResponse.ok && labelCheckResponse.status === 404) {
      const labelResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/labels`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: labelName,
            color: labelColor,
            description: labelDescription,
          }),
        }
      );

      if (!labelResponse.ok) {
        const errorText = await labelResponse.text();
        console.error(
          `Failed to create label '${labelName}': ${labelResponse.status} ${errorText}`
        );
      }
    } else if (!labelCheckResponse.ok) {
      // Handle other errors (not 404)
      const errorText = await labelCheckResponse.text();
      console.error(
        `Failed to check if label '${labelName}' exists: ${labelCheckResponse.status} ${errorText}`
      );
    }

    // Add label to PR
    const addLabelResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/labels`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify([labelName]),
      }
    );

    if (!addLabelResponse.ok) {
      const errorText = await addLabelResponse.text();
      console.error(
        `Failed to add label '${labelName}' to PR #${prNumber}: ${addLabelResponse.status} ${errorText}`
      );
    }
  }
}
