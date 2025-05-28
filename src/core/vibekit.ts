import { AgentConfig } from "../types/agent";
import {
  CodexAgent,
  CodexResponse,
  CodexStreamCallbacks,
} from "../agents/codex";
import { callClaude, ClaudeResponse } from "../agents/claude";

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
    if (this.setup.agent === "codex") {
      this.codexAgent = new CodexAgent(this.setup.config);
    }
  }

  async generateCode(
    prompt: string,
    mode?: "ask" | "code",
    callbacks?: VibeKitStreamCallbacks
  ): Promise<AgentResponse> {
    switch (this.setup.agent) {
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
            mode || "code",
            codexCallbacks
          );
        }
        return this.codexAgent.generateCode(prompt, mode || "code");
      case "claude":
        if (callbacks) {
          // Claude doesn't support streaming yet, fall back to regular generation
          // You can optionally call onProgress to indicate start/end
          callbacks.onUpdate?.("Starting Claude code generation...");
          const result = await callClaude(prompt, this.setup.config);
          callbacks.onUpdate?.("Claude code generation completed.");
          return result;
        }
        return callClaude(prompt, this.setup.config);
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
    if (this.setup.agent !== "codex") {
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
    if (this.setup.agent !== "codex") {
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
    if (this.setup.agent !== "codex") {
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
    if (this.setup.agent !== "codex") {
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
