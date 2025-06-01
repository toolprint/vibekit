import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelemetryService, TelemetryData } from "../src/services/telemetry.js";
import { VibeKit, AgentConfig } from "../src/index.js";
import { CodexAgent } from "../src/agents/codex.js";
import { callClaude } from "../src/agents/claude.js";

// Mock dependencies
vi.mock("../src/agents/codex.js");
vi.mock("../src/agents/claude.js");

const MockedCodexAgent = vi.mocked(CodexAgent);
const mockedCallClaude = vi.mocked(callClaude);

// Mock fetch
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

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
    mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));
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
    it("should send telemetry data for start event", async () => {
      await telemetryService.trackStart("codex", "code", "test prompt", {
        repoUrl: "test/repo",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-otel-endpoint.com/v1/traces",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: expect.stringContaining('"vibekit.start"'),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.spans[0].name).toBe("vibekit.start");
      expect(body.spans[0].attributes["vibekit.session_id"]).toBe(
        "test-session-123"
      );
      expect(body.spans[0].attributes["vibekit.agent_type"]).toBe("codex");
      expect(body.spans[0].attributes["vibekit.mode"]).toBe("code");
    });

    it("should not send data when telemetry is disabled", async () => {
      const disabledConfig = { ...telemetryConfig, isEnabled: false };
      const disabledService = new TelemetryService(disabledConfig);

      await disabledService.trackStart("codex", "code", "test prompt");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not send data when endpoint is missing", async () => {
      const noEndpointConfig = { ...telemetryConfig, endpoint: undefined };
      const noEndpointService = new TelemetryService(noEndpointConfig);

      await noEndpointService.trackStart("codex", "code", "test prompt");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("trackStream", () => {
    it("should send telemetry data for stream event", async () => {
      const streamData = '{"type": "stdout", "data": "test output"}';

      await telemetryService.trackStream(
        "codex",
        "code",
        "test prompt",
        streamData,
        "sandbox-123",
        "test/repo",
        { streamType: "stdout" }
      );

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.spans[0].name).toBe("vibekit.stream");
      expect(body.spans[0].attributes["vibekit.sandbox_id"]).toBe(
        "sandbox-123"
      );
      expect(body.spans[0].attributes["vibekit.repo_url"]).toBe("test/repo");
      expect(body.spans[0].events[0].attributes["stream.data"]).toBe(
        streamData
      );
    });
  });

  describe("trackEnd", () => {
    it("should send telemetry data for end event", async () => {
      await telemetryService.trackEnd(
        "codex",
        "code",
        "test prompt",
        "sandbox-123",
        "test/repo",
        { exitCode: 0, stdoutLength: 100 }
      );

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.spans[0].name).toBe("vibekit.end");
      expect(body.spans[0].attributes.exitCode).toBe(0);
      expect(body.spans[0].attributes.stdoutLength).toBe(100);
    });
  });

  describe("trackError", () => {
    it("should send telemetry data for error event", async () => {
      const errorMessage = "Test error occurred";

      await telemetryService.trackError(
        "codex",
        "code",
        "test prompt",
        errorMessage,
        { errorType: "TestError" }
      );

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.spans[0].name).toBe("vibekit.error");
      expect(body.spans[0].attributes.errorType).toBe("TestError");
      expect(body.spans[0].events[0].attributes["stream.data"]).toBe(
        errorMessage
      );
    });
  });

  describe("sampling", () => {
    it("should respect sampling ratio", async () => {
      // Mock Math.random to always return 0.5 (which should be > 0.0 sampling ratio)
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      const samplingConfig = { ...telemetryConfig, samplingRatio: 0.0 };
      const samplingService = new TelemetryService(samplingConfig);

      await samplingService.trackStart("codex", "code", "test prompt");

      expect(mockFetch).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should handle fetch errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(
        telemetryService.trackStart("codex", "code", "test prompt")
      ).resolves.not.toThrow();
    });

    it("should handle HTTP errors gracefully", async () => {
      mockFetch.mockResolvedValue(new Response("Bad Request", { status: 400 }));

      // Should not throw
      await expect(
        telemetryService.trackStart("codex", "code", "test prompt")
      ).resolves.not.toThrow();
    });
  });
});

describe("VibeKit Telemetry Integration", () => {
  let configWithTelemetry: AgentConfig;
  let configWithoutTelemetry: AgentConfig;
  let mockCodexAgent: any;

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

    MockedCodexAgent.mockImplementation(() => mockCodexAgent);
    mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Codex agent with telemetry", () => {
    it("should track telemetry for streaming Codex generation", async () => {
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

      await vibeKit.generateCode("test prompt", "code", [], callbacks);

      // Should track start, multiple streams, and end
      expect(mockFetch).toHaveBeenCalledTimes(6); // start + 4 stream events + end

      const calls = mockFetch.mock.calls;

      // Check start event
      const startBody = JSON.parse(calls[0][1]?.body as string);
      expect(startBody.spans[0].name).toBe("vibekit.start");

      // Check stream events
      const streamBody1 = JSON.parse(calls[1][1]?.body as string);
      expect(streamBody1.spans[0].name).toBe("vibekit.stream");

      // Check end event
      const endBody = JSON.parse(calls[5][1]?.body as string);
      expect(endBody.spans[0].name).toBe("vibekit.end");
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

      // Should track start and error
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const errorBody = JSON.parse(mockFetch.mock.calls[1][1]?.body as string);
      expect(errorBody.spans[0].name).toBe("vibekit.error");
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

      await vibeKit.generateCode("test prompt", "code", []);

      // Should track start and end
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const startBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(startBody.spans[0].name).toBe("vibekit.start");

      const endBody = JSON.parse(mockFetch.mock.calls[1][1]?.body as string);
      expect(endBody.spans[0].name).toBe("vibekit.end");
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

      mockedCallClaude.mockResolvedValue(mockResponse);

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await vibeKit.generateCode("test prompt", "code", [], callbacks);

      // Should track start, stream (start message), and end
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const startBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(startBody.spans[0].name).toBe("vibekit.start");
      expect(startBody.spans[0].attributes["vibekit.agent_type"]).toBe(
        "claude"
      );

      const streamBody = JSON.parse(mockFetch.mock.calls[1][1]?.body as string);
      expect(streamBody.spans[0].name).toBe("vibekit.stream");

      const endBody = JSON.parse(mockFetch.mock.calls[2][1]?.body as string);
      expect(endBody.spans[0].name).toBe("vibekit.end");
      expect(endBody.spans[0].attributes.codeLength).toBe(19); // "test code generated".length
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

      mockedCallClaude.mockRejectedValue(new Error("Claude API error"));

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await expect(
        vibeKit.generateCode("test prompt", "code", [], callbacks)
      ).rejects.toThrow("Claude API error");

      // Should track start, stream (start message), and error
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const errorBody = JSON.parse(mockFetch.mock.calls[2][1]?.body as string);
      expect(errorBody.spans[0].name).toBe("vibekit.error");
    });
  });

  describe("without telemetry", () => {
    it("should not send telemetry when disabled", async () => {
      const vibeKit = new VibeKit(configWithoutTelemetry);
      const mockResponse = {
        exitCode: 0,
        stdout: "Generation complete",
        stderr: "",
        sandboxId: "sandbox-123",
      };

      mockCodexAgent.generateCode.mockResolvedValue(mockResponse);

      await vibeKit.generateCode("test prompt", "code", []);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getDataType helper", () => {
    it("should identify JSON data types correctly", async () => {
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
            callbacks.onUpdate('{"type": "git", "output": "Cloning"}');
            callbacks.onUpdate("raw output without JSON");
          }
          return mockResponse;
        }
      );

      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await vibeKit.generateCode("test prompt", "code", [], callbacks);

      const calls = mockFetch.mock.calls;

      // First stream call should identify "start" type
      const startStreamBody = JSON.parse(calls[1][1]?.body as string);
      expect(startStreamBody.spans[0].attributes.dataType).toBe("start");

      // Second stream call should identify "git" type
      const gitStreamBody = JSON.parse(calls[2][1]?.body as string);
      expect(gitStreamBody.spans[0].attributes.dataType).toBe("git");

      // Third stream call should be "stream_output" for non-JSON
      const rawStreamBody = JSON.parse(calls[3][1]?.body as string);
      expect(rawStreamBody.spans[0].attributes.dataType).toBe("stream_output");
    });
  });
});
