import {
  VibeKitConfig,
  CodexConfig,
  CodexResponse,
  CodexStreamCallbacks,
  ClaudeConfig,
  ClaudeResponse,
  ClaudeStreamCallbacks,
  Conversation,
} from "../types";
import { CodexAgent } from "../agents/codex";
import { ClaudeAgent } from "../agents/claude";
import { TelemetryService } from "../services/telemetry";

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
  private claudeAgent?: ClaudeAgent;
  private setup: VibeKitConfig;
  private telemetryService?: TelemetryService;

  constructor(setup: VibeKitConfig) {
    this.setup = setup;

    // Initialize telemetry service if enabled
    if (setup.telemetry?.isEnabled) {
      this.telemetryService = new TelemetryService(
        setup.telemetry,
        setup.sessionId
      );
    }

    // Check for unsupported environment configurations
    if (this.setup.environment.daytona) {
      throw new Error("Daytona environment support is not yet implemented");
    }

    // Initialize CodexAgent if the agent type is codex
    if (this.setup.agent.type === "codex") {
      const codexConfig: CodexConfig = {
        openaiApiKey: this.setup.agent.model.apiKey,
        githubToken: this.setup.github.token,
        repoUrl: this.setup.github.repository,
        e2bApiKey: this.setup.environment.e2b?.apiKey || "",
        e2bTemplateId: this.setup.environment.e2b?.templateId,
        model: this.setup.agent.model.name,
        sandboxId: this.setup.sessionId,
        telemetry: this.setup.telemetry,
      };
      this.codexAgent = new CodexAgent(codexConfig);
    }

    // Initialize ClaudeAgent if the agent type is claude
    if (this.setup.agent.type === "claude") {
      const claudeConfig: ClaudeConfig = {
        anthropicApiKey: this.setup.agent.model.apiKey,
        githubToken: this.setup.github.token,
        repoUrl: this.setup.github.repository,
        e2bApiKey: this.setup.environment.e2b?.apiKey || "",
        e2bTemplateId: this.setup.environment.e2b?.templateId,
        model: this.setup.agent.model.name,
        sandboxId: this.setup.sessionId,
        telemetry: this.setup.telemetry,
      };
      this.claudeAgent = new ClaudeAgent(claudeConfig);
    }
  }

  private getDataType(data: string): string {
    try {
      const parsed = JSON.parse(data);
      return parsed.type || "unknown";
    } catch {
      return "stream_output";
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

        const codexMode = mode || this.setup.agent.mode;

        // Track telemetry start for Codex
        await this.telemetryService?.trackStart("codex", codexMode, prompt, {
          repoUrl: this.setup.github.repository,
          model: this.setup.agent.model.name,
          hasHistory: !!history?.length,
        });

        if (callbacks) {
          // Wrap callbacks with telemetry tracking
          const codexCallbacks: CodexStreamCallbacks = {
            onUpdate: async (data) => {
              callbacks.onUpdate?.(data);
              // Track telemetry for stream data
              await this.telemetryService?.trackStream(
                "codex",
                codexMode,
                prompt,
                data,
                undefined,
                this.setup.github.repository,
                {
                  dataType: this.getDataType(data),
                }
              );
            },
            onError: async (error) => {
              callbacks.onError?.(error);
              // Track telemetry for error
              await this.telemetryService?.trackError(
                "codex",
                codexMode,
                prompt,
                error,
                {
                  source: "codex_agent",
                }
              );
            },
          };

          try {
            const result = await this.codexAgent.generateCode(
              prompt,
              codexMode,
              history,
              codexCallbacks
            );

            // Track telemetry for end
            await this.telemetryService?.trackEnd(
              "codex",
              codexMode,
              prompt,
              result.sandboxId,
              this.setup.github.repository,
              {
                exitCode: result.exitCode,
                stdoutLength: result.stdout?.length || 0,
                stderrLength: result.stderr?.length || 0,
              }
            );

            return result;
          } catch (error) {
            const errorMessage = `Codex generation failed: ${
              error instanceof Error ? error.message : String(error)
            }`;

            // Track telemetry for top-level error
            await this.telemetryService?.trackError(
              "codex",
              codexMode,
              prompt,
              errorMessage,
              {
                errorType:
                  error instanceof Error
                    ? error.constructor.name
                    : "UnknownError",
                source: "vibekit",
              }
            );

            throw error;
          }
        }

        try {
          const result = await this.codexAgent.generateCode(
            prompt,
            codexMode,
            history
          );

          // Track telemetry for end (non-streaming)
          await this.telemetryService?.trackEnd(
            "codex",
            codexMode,
            prompt,
            result.sandboxId,
            this.setup.github.repository,
            {
              exitCode: result.exitCode,
              stdoutLength: result.stdout?.length || 0,
              stderrLength: result.stderr?.length || 0,
            }
          );

          return result;
        } catch (error) {
          const errorMessage = `Codex generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`;

          // Track telemetry for error (non-streaming)
          await this.telemetryService?.trackError(
            "codex",
            codexMode,
            prompt,
            errorMessage,
            {
              errorType:
                error instanceof Error
                  ? error.constructor.name
                  : "UnknownError",
              source: "vibekit",
            }
          );

          throw error;
        }
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }

        const claudeMode = mode || this.setup.agent.mode;

        // Track telemetry start for Claude
        await this.telemetryService?.trackStart("claude", claudeMode, prompt, {
          repoUrl: this.setup.github.repository,
          model: this.setup.agent.model.name,
          hasHistory: !!history?.length,
        });

        if (callbacks) {
          // Wrap callbacks with telemetry tracking
          const claudeCallbacks: ClaudeStreamCallbacks = {
            onUpdate: async (data) => {
              callbacks.onUpdate?.(data);
              // Track telemetry for stream data
              await this.telemetryService?.trackStream(
                "claude",
                claudeMode,
                prompt,
                data,
                undefined,
                this.setup.github.repository,
                {
                  dataType: this.getDataType(data),
                }
              );
            },
            onError: async (error) => {
              callbacks.onError?.(error);
              // Track telemetry for error
              await this.telemetryService?.trackError(
                "claude",
                claudeMode,
                prompt,
                error,
                {
                  source: "claude_agent",
                }
              );
            },
          };

          try {
            const result = await this.claudeAgent.generateCode(
              prompt,
              claudeMode,
              history,
              claudeCallbacks
            );

            // Track telemetry for end
            await this.telemetryService?.trackEnd(
              "claude",
              claudeMode,
              prompt,
              result.sandboxId,
              this.setup.github.repository,
              {
                exitCode: result.exitCode,
                stdoutLength: result.stdout?.length || 0,
                stderrLength: result.stderr?.length || 0,
              }
            );

            return result;
          } catch (error) {
            const errorMessage = `Claude generation failed: ${
              error instanceof Error ? error.message : String(error)
            }`;

            // Track telemetry for top-level error
            await this.telemetryService?.trackError(
              "claude",
              claudeMode,
              prompt,
              errorMessage,
              {
                errorType:
                  error instanceof Error
                    ? error.constructor.name
                    : "UnknownError",
                source: "vibekit",
              }
            );

            throw error;
          }
        }

        try {
          const result = await this.claudeAgent.generateCode(
            prompt,
            claudeMode,
            history
          );

          // Track telemetry for end (non-streaming)
          await this.telemetryService?.trackEnd(
            "claude",
            claudeMode,
            prompt,
            result.sandboxId,
            this.setup.github.repository,
            {
              exitCode: result.exitCode,
              stdoutLength: result.stdout?.length || 0,
              stderrLength: result.stderr?.length || 0,
            }
          );

          return result;
        } catch (error) {
          const errorMessage = `Claude generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`;

          // Track telemetry for error (non-streaming)
          await this.telemetryService?.trackError(
            "claude",
            claudeMode,
            prompt,
            errorMessage,
            {
              errorType:
                error instanceof Error
                  ? error.constructor.name
                  : "UnknownError",
              source: "vibekit",
            }
          );

          throw error;
        }
      default:
        throw new Error("Unsupported agent");
    }
  }

  /**
   * Create a Pull Request after generating code changes.
   * This method is available for both Codex and Claude agents and automatically labels
   * the pull request with the agent name ('codex' or 'claude').
   *
   * @returns Promise<PullRequestResponse> - Contains the PR URL, number, branch name, and commit SHA
   * @throws Error if the agent is not supported or if PR creation fails
   */
  async createPullRequest(): Promise<PullRequestResponse> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }
        return this.codexAgent.createPullRequest();
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }
        return this.claudeAgent.createPullRequest();
      default:
        throw new Error(
          `Pull request creation is not supported for agent type: ${this.setup.agent.type}`
        );
    }
  }

  /**
   * Kill the active sandbox.
   * This method is available for both Codex and Claude agents.
   *
   * @throws Error if the agent is not supported
   */
  async kill(): Promise<void> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }
        return this.codexAgent.killSandbox();
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }
        return this.claudeAgent.killSandbox();
      default:
        throw new Error(
          `Sandbox management is not supported for agent type: ${this.setup.agent.type}`
        );
    }
  }

  /**
   * Pause the active sandbox.
   * This method is available for both Codex and Claude agents.
   *
   * @throws Error if the agent is not supported
   */
  async pause(): Promise<void> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }
        return this.codexAgent.pauseSandbox();
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }
        return this.claudeAgent.pauseSandbox();
      default:
        throw new Error(
          `Sandbox management is not supported for agent type: ${this.setup.agent.type}`
        );
    }
  }

  /**
   * Resume the paused sandbox.
   * This method is available for both Codex and Claude agents.
   *
   * @throws Error if the agent is not supported
   */
  async resume(): Promise<void> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }
        return this.codexAgent.resumeSandbox();
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }
        return this.claudeAgent.resumeSandbox();
      default:
        throw new Error(
          `Sandbox management is not supported for agent type: ${this.setup.agent.type}`
        );
    }
  }

  /**
   * Get the current session ID from the sandbox.
   * This method is available for both Codex and Claude agents.
   *
   * @returns Promise<string | null> - The sandbox session ID or null if not available
   * @throws Error if the agent is not supported
   */
  async getSession(): Promise<string | null> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }
        return this.codexAgent.getSession();
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }
        return this.claudeAgent.getSession();
      default:
        throw new Error(
          `Session management is not supported for agent type: ${this.setup.agent.type}`
        );
    }
  }

  /**
   * Set the session ID for the sandbox.
   * This method is available for both Codex and Claude agents.
   *
   * @param sessionId - The session ID to set
   * @throws Error if the agent is not supported
   */
  async setSession(sessionId: string): Promise<void> {
    switch (this.setup.agent.type) {
      case "codex":
        if (!this.codexAgent) {
          throw new Error("CodexAgent not initialized");
        }
        return this.codexAgent.setSession(sessionId);
      case "claude":
        if (!this.claudeAgent) {
          throw new Error("ClaudeAgent not initialized");
        }
        return this.claudeAgent.setSession(sessionId);
      default:
        throw new Error(
          `Session management is not supported for agent type: ${this.setup.agent.type}`
        );
    }
  }
}
