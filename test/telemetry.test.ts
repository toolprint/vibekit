import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelemetryService } from "../src/services/telemetry";
import { VibeKit, VibeKitConfig } from "../src/index";
import { CodexAgent } from "../src/agents/codex";
import { ClaudeAgent } from "../src/agents/claude";

// Mock dependencies
vi.mock("../src/agents/codex");
vi.mock("../src/agents/claude");

const MockedCodexAgent = vi.mocked(CodexAgent);
const MockedClaudeAgent = vi.mocked(ClaudeAgent);

describe("TelemetryService", () => {
  let telemetryConfig: any;
  let telemetryService: TelemetryService;

  beforeEach(() => {
    telemetryConfig = {
      isEnabled: true,
      endpoint: "https://test-otel-endpoint.com/v1/traces",
      serviceName: "test-vibekit",
      serviceVersion: "1.0.0",
      headers: {
        Authorization: "Bearer test-token",
      },
      timeout: 5000,
      samplingRatio: 1.0,
      resourceAttributes: {
        environment: "test",
      },
    };

    telemetryService = new TelemetryService(
      telemetryConfig,
      "test-session-123"
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config and session ID", () => {
      expect(telemetryService).toBeInstanceOf(TelemetryService);
    });

    it("should generate session ID if not provided", () => {
      const service = new TelemetryService(telemetryConfig);
      expect(service).toBeInstanceOf(TelemetryService);
    });
  });

  describe("trackStart", () => {
    it("should not throw when tracking start event", async () => {
      await expect(
        telemetryService.trackStart("codex", "code", "test prompt", {
          repoUrl: "test/repo",
        })
      ).resolves.not.toThrow();
    });

    it("should not track data when telemetry is disabled", async () => {
      const disabledConfig = { ...telemetryConfig, isEnabled: false };
      const disabledService = new TelemetryService(disabledConfig);

      await expect(
        disabledService.trackStart("codex", "code", "test prompt")
      ).resolves.not.toThrow();
    });

    it("should not track data when endpoint is missing", async () => {
      const noEndpointConfig = { ...telemetryConfig, endpoint: undefined };
      const noEndpointService = new TelemetryService(noEndpointConfig);

      await expect(
        noEndpointService.trackStart("codex", "code", "test prompt")
      ).resolves.not.toThrow();
    });
  });

  describe("trackStream", () => {
    it("should not throw when tracking stream event", async () => {
      const streamData = '{"type": "stdout", "data": "test output"}';

      await expect(
        telemetryService.trackStream(
          "codex",
          "code",
          "test prompt",
          streamData,
          "sandbox-123",
          "test/repo",
          { streamType: "stdout" }
        )
      ).resolves.not.toThrow();
    });
  });

  describe("trackEnd", () => {
    it("should not throw when tracking end event", async () => {
      await expect(
        telemetryService.trackEnd(
          "codex",
          "code",
          "test prompt",
          "sandbox-123",
          "test/repo",
          { exitCode: 0, stdoutLength: 100 }
        )
      ).resolves.not.toThrow();
    });
  });

  describe("trackError", () => {
    it("should not throw when tracking error event", async () => {
      const errorMessage = "Test error occurred";

      await expect(
        telemetryService.trackError(
          "codex",
          "code",
          "test prompt",
          errorMessage,
          { errorType: "TestError" }
        )
      ).resolves.not.toThrow();
    });
  });

  describe("sampling", () => {
    it("should respect sampling ratio", async () => {
      // Mock Math.random to always return 0.5 (which should be > 0.0 sampling ratio)
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      const samplingConfig = { ...telemetryConfig, samplingRatio: 0.0 };
      const samplingService = new TelemetryService(samplingConfig);

      await expect(
        samplingService.trackStart("codex", "code", "test prompt")
      ).resolves.not.toThrow();

      randomSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should handle initialization errors gracefully", () => {
      const invalidConfig = {
        ...telemetryConfig,
        endpoint: "not-a-valid-url",
      };

      expect(() => new TelemetryService(invalidConfig)).not.toThrow();
    });
  });

  describe("shutdown", () => {
    it("should shutdown gracefully", async () => {
      await expect(telemetryService.shutdown()).resolves.not.toThrow();
    });
  });
});

describe("VibeKit Telemetry Integration", () => {
  let configWithTelemetry: VibeKitConfig;
  let configWithoutTelemetry: VibeKitConfig;
  let mockCodexAgent: any;
  let mockClaudeAgent: any;

  beforeEach(() => {
    configWithTelemetry = {
      agent: {
        type: "codex",
        model: {
          name: "gpt-4",
          apiKey: "test-openai-key",
        },
        mode: "code",
      },
      environment: {
        e2b: {
          apiKey: "test-e2b-key",
        },
      },
      github: {
        token: "test-github-token",
        repository: "octocat/hello-world",
      },
      telemetry: {
        isEnabled: true,
        endpoint: "https://test-otel-endpoint.com/v1/traces",
        serviceName: "test-vibekit",
      },
      sessionId: "test-session-123",
    };

    configWithoutTelemetry = {
      agent: {
        type: "codex",
        model: {
          name: "gpt-4",
          apiKey: "test-openai-key",
        },
        mode: "code",
      },
      environment: {
        e2b: {
          apiKey: "test-e2b-key",
        },
      },
      github: {
        token: "test-github-token",
        repository: "octocat/hello-world",
      },
    };

    mockCodexAgent = {
      generateCode: vi.fn(),
      createPullRequest: vi.fn(),
      killSandbox: vi.fn(),
      pauseSandbox: vi.fn(),
      resumeSandbox: vi.fn(),
    };

    mockClaudeAgent = {
      generateCode: vi.fn(),
      createPullRequest: vi.fn(),
      killSandbox: vi.fn(),
      pauseSandbox: vi.fn(),
      resumeSandbox: vi.fn(),
    };

    MockedCodexAgent.mockImplementation(() => mockCodexAgent);
    MockedClaudeAgent.mockImplementation(() => mockClaudeAgent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Codex agent with telemetry", () => {
    it("should initialize and track telemetry for streaming Codex generation", async () => {
      const vibeKit = new VibeKit(configWithTelemetry);
      const mockResponse = {
        exitCode: 0,
        stdout: "Generation complete",
        stderr: "",
        sandboxId: "sandbox-123",
      };

      mockCodexAgent.generateCode.mockImplementation(
        async (prompt, mode, history, callbacks) => {
          if (callbacks) {
            callbacks.onUpdate(
              '{"type": "start", "sandbox_id": "sandbox-123"}'
            );
            callbacks.onUpdate(
              '{"type": "git", "output": "Cloning repository"}'
            );
            callbacks.onUpdate("Code generation output");
            callbacks.onUpdate('{"type": "end", "sandbox_id": "sandbox-123"}');
          }
          return mockResponse;
        }
      );

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await expect(
        vibeKit.generateCode("test prompt", "code", [], callbacks)
      ).resolves.not.toThrow();
    });

    it("should track errors in Codex generation", async () => {
      const vibeKit = new VibeKit(configWithTelemetry);

      mockCodexAgent.generateCode.mockRejectedValue(new Error("Codex failed"));

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await expect(
        vibeKit.generateCode("test prompt", "code", [], callbacks)
      ).rejects.toThrow("Codex failed");
    });

    it("should track telemetry for non-streaming Codex generation", async () => {
      const vibeKit = new VibeKit(configWithTelemetry);
      const mockResponse = {
        exitCode: 0,
        stdout: "Generation complete",
        stderr: "",
        sandboxId: "sandbox-123",
      };

      mockCodexAgent.generateCode.mockResolvedValue(mockResponse);

      await expect(
        vibeKit.generateCode("test prompt", "code", [])
      ).resolves.not.toThrow();
    });
  });

  describe("Claude agent with telemetry", () => {
    it("should track telemetry for Claude generation with callbacks", async () => {
      const claudeConfig = {
        ...configWithTelemetry,
        agent: {
          type: "claude" as const,
          model: {
            name: "claude-3-5-sonnet",
            apiKey: "test-anthropic-key",
          },
          mode: "code" as const,
        },
      };

      const vibeKit = new VibeKit(claudeConfig);
      const mockResponse = { code: "test code generated" };

      mockClaudeAgent.generateCode.mockResolvedValue(mockResponse);

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await expect(
        vibeKit.generateCode("test prompt", "code", [], callbacks)
      ).resolves.not.toThrow();
    });

    it("should track errors in Claude generation", async () => {
      const claudeConfig = {
        ...configWithTelemetry,
        agent: {
          type: "claude" as const,
          model: {
            name: "claude-3-5-sonnet",
            apiKey: "test-anthropic-key",
          },
          mode: "code" as const,
        },
      };

      const vibeKit = new VibeKit(claudeConfig);

      mockClaudeAgent.generateCode.mockRejectedValue(
        new Error("Claude API error")
      );

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await expect(
        vibeKit.generateCode("test prompt", "code", [], callbacks)
      ).rejects.toThrow("Claude API error");
    });
  });

  describe("without telemetry", () => {
    it("should work normally when telemetry is not configured", async () => {
      const vibeKit = new VibeKit(configWithoutTelemetry);
      const mockResponse = {
        exitCode: 0,
        stdout: "Generation complete",
        stderr: "",
        sandboxId: "sandbox-123",
      };

      mockCodexAgent.generateCode.mockResolvedValue(mockResponse);

      await expect(
        vibeKit.generateCode("test prompt", "code", [])
      ).resolves.not.toThrow();
    });
  });
});
