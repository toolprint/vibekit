import {
  AgentConfig,
  CodexConfig,
  CodexResponse,
  CodexStreamCallbacks,
  Conversation,
} from "../types";
import { CodexAgent } from "../agents/codex";
import { callClaude, ClaudeConfig, ClaudeResponse } from "../agents/claude";

export type AgentResponse = CodexResponse | ClaudeResponse | { code: string };

// Unified streaming callback interface
export interface VibeKitStreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}

// Pull request response interface
export interface PullRequestResponse {
  html_url: string;
  number: number;
  branchName: string;
  commitSha?: string;
}

export class VibeKit {
  private codexAgent?: CodexAgent;

  constructor(private setup: AgentConfig) {
    // Initialize CodexAgent if the agent type is codex
    if (this.setup.agent.type === "codex") {
      const codexConfig: CodexConfig = {
        openaiApiKey: this.setup.agent.model.apiKey,
        githubToken: this.setup.github.token,
        repoUrl: this.setup.github.repository,
        e2bApiKey: this.setup.environment.e2bApiKey,
        e2bTemplateId: this.setup.environment.e2bTemplateId,
        model: this.setup.agent.model.name,
        sandboxId: this.setup.sessionId,
      };
      this.codexAgent = new CodexAgent(codexConfig);
    }
  }

  async generateCode(
    prompt: string,
    mode?: "ask" | "code",
    history?: Conversation[],
    callbacks?: VibeKitStreamCallbacks
  ): Promise<AgentResponse> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }

        if (callbacks) {
          const codexCallbacks: CodexStreamCallbacks = {
            onUpdate: callbacks.onUpdate,
            onError: callbacks.onError,
          };
          return this.codexAgent.generateCode(
            prompt,
            mode || this.setup.agent.mode,
            history,
            codexCallbacks
          );
        }

        return this.codexAgent.generateCode(
          prompt,
          mode || this.setup.agent.mode,
          history
        );
      case "claude":
        if (callbacks) {
          // Claude doesn't support streaming yet, fall back to regular generation
          // You can optionally call onProgress to indicate start/end
          callbacks.onUpdate?.("Starting Claude code generation...");
          const claudeConfig: ClaudeConfig = {
            anthropicApiKey: this.setup.agent.model.apiKey,
            githubToken: this.setup.github.token,
            repoUrl: this.setup.github.repository,
            e2bApiKey: this.setup.environment.e2bApiKey,
          };
          const result = await callClaude(prompt, claudeConfig);
          callbacks.onUpdate?.("Claude code generation completed.");
          return result;
        }
        const claudeConfig: ClaudeConfig = {
          anthropicApiKey: this.setup.agent.model.apiKey,
          githubToken: this.setup.github.token,
          repoUrl: this.setup.github.repository,
          e2bApiKey: this.setup.environment.e2bApiKey,
        };
        return callClaude(prompt, claudeConfig);
      default:
        throw new Error("Unsupported agent");
    }
  }

  /**
   * Create a Pull Request after generating code changes.
   * This method is only available for the Codex agent and automatically labels
   * the pull request with the agent name ('codex').
   *
   * @returns Promise<PullRequestResponse> - Contains the PR URL, number, branch name, and commit SHA
   * @throws Error if the agent is not Codex or if PR creation fails
   */
  async createPullRequest(): Promise<PullRequestResponse> {
    if (this.setup.agent.type !== "codex") {
      throw new Error(
        "Pull request creation is only supported for the Codex agent"
      );
    }

    if (!this.codexAgent) {
      throw new Error("CodexAgent not initialized");
    }

    return this.codexAgent.createPullRequest();
  }

  /**
   * Kill the active sandbox.
   * This method is only available for the Codex agent.
   *
   * @throws Error if the agent is not Codex
   */
  async kill(): Promise<void> {
    if (this.setup.agent.type !== "codex") {
      throw new Error(
        "Sandbox management is only supported for the Codex agent"
      );
    }

    if (!this.codexAgent) {
      throw new Error("CodexAgent not initialized");
    }

    return this.codexAgent.killSandbox();
  }

  /**
   * Pause the active sandbox.
   * This method is only available for the Codex agent.
   *
   * @throws Error if the agent is not Codex
   */
  async pause(): Promise<void> {
    if (this.setup.agent.type !== "codex") {
      throw new Error(
        "Sandbox management is only supported for the Codex agent"
      );
    }

    if (!this.codexAgent) {
      throw new Error("CodexAgent not initialized");
    }

    return this.codexAgent.pauseSandbox();
  }

  /**
   * Resume the paused sandbox.
   * This method is only available for the Codex agent.
   *
   * @throws Error if the agent is not Codex
   */
  async resume(): Promise<void> {
    if (this.setup.agent.type !== "codex") {
      throw new Error(
        "Sandbox management is only supported for the Codex agent"
      );
    }

    if (!this.codexAgent) {
      throw new Error("CodexAgent not initialized");
    }

    return this.codexAgent.resumeSandbox();
  }
}
