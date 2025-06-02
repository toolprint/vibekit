import {
  AgentConfig,
  CodexConfig,
  CodexResponse,
  CodexStreamCallbacks,
  Conversation,
} from "../types";
import { CodexAgent } from "../agents/codex";
import { callClaude, ClaudeConfig, ClaudeResponse } from "../agents/claude";
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
  private setup: AgentConfig;
  private telemetryService?: TelemetryService;

  constructor(setup: AgentConfig) {
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
        const claudeMode = mode || this.setup.agent.mode;

        // Track telemetry start for Claude
        await this.telemetryService?.trackStart("claude", claudeMode, prompt, {
          repoUrl: this.setup.github.repository,
          hasHistory: !!history?.length,
        });

        if (callbacks) {
          // Claude doesn't support streaming yet, fall back to regular generation
          // You can optionally call onProgress to indicate start/end
          const startMessage = "Starting Claude code generation...";
          callbacks.onUpdate?.(startMessage);

          // Track telemetry for start message
          await this.telemetryService?.trackStream(
            "claude",
            claudeMode,
            prompt,
            startMessage,
            undefined,
            this.setup.github.repository
          );

          try {
            const claudeConfig: ClaudeConfig = {
              anthropicApiKey: this.setup.agent.model.apiKey,
              githubToken: this.setup.github.token,
              repoUrl: this.setup.github.repository,
              e2bApiKey: this.setup.environment.e2b?.apiKey || "",
            };
            const result = await callClaude(prompt, claudeConfig);

            const endMessage = "Claude code generation completed.";
            callbacks.onUpdate?.(endMessage);

            // Track telemetry for end
            await this.telemetryService?.trackEnd(
              "claude",
              claudeMode,
              prompt,
              undefined,
              this.setup.github.repository,
              {
                codeLength: result.code?.length || 0,
              }
            );

            return result;
          } catch (error) {
            const errorMessage = `Claude generation failed: ${
              error instanceof Error ? error.message : String(error)
            }`;

            // Track telemetry for error
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
              }
            );

            callbacks.onError?.(errorMessage);
            throw error;
          }
        }

        try {
          const claudeConfig: ClaudeConfig = {
            anthropicApiKey: this.setup.agent.model.apiKey,
            githubToken: this.setup.github.token,
            repoUrl: this.setup.github.repository,
            e2bApiKey: this.setup.environment.e2b?.apiKey || "",
          };
          const result = await callClaude(prompt, claudeConfig);

          // Track telemetry for end (non-streaming)
          await this.telemetryService?.trackEnd(
            "claude",
            claudeMode,
            prompt,
            undefined,
            this.setup.github.repository,
            {
              codeLength: result.code?.length || 0,
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

  /**
   * Get the current session ID from the sandbox.
   * This method is only available for the Codex agent.
   *
   * @returns Promise<string | null> - The sandbox session ID or null if not available
   * @throws Error if the agent is not Codex
   */
  async getSession(): Promise<string | null> {
    if (this.setup.agent.type !== "codex") {
      throw new Error(
        "Session management is only supported for the Codex agent"
      );
    }

    if (!this.codexAgent) {
      throw new Error("CodexAgent not initialized");
    }

    return this.codexAgent.getSession();
  }

  /**
   * Set the session ID for the sandbox.
   * This method is only available for the Codex agent.
   *
   * @param sessionId - The session ID to set
   * @throws Error if the agent is not Codex
   */
  async setSession(sessionId: string): Promise<void> {
    if (this.setup.agent.type !== "codex") {
      throw new Error(
        "Session management is only supported for the Codex agent"
      );
    }

    if (!this.codexAgent) {
      throw new Error("CodexAgent not initialized");
    }

    return this.codexAgent.setSession(sessionId);
  }
}
