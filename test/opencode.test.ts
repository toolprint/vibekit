import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenCodeAgent } from "../src/agents/opencode";
import { OpenCodeConfig, OpenCodeStreamCallbacks } from "../src/types";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandboxProvider } from "../src/services/sandbox.js";

// Mock dependencies
vi.mock("e2b");
vi.mock("../src/agents/utils.js");
vi.mock("../src/services/sandbox.js");

const MockedSandbox = vi.mocked(Sandbox);
const MockedCreateSandboxProvider = vi.mocked(createSandboxProvider);

describe("OpenCodeAgent", () => {
  let config: OpenCodeConfig;
  let mockSandbox: any;
  let openCodeAgent: OpenCodeAgent;

  beforeEach(() => {
    config = {
      providerApiKey: "test-openai-key",
      provider: "openai",
      model: "gpt-4",
      githubToken: "test-github-token",
      repoUrl: "octocat/hello-world",
      e2bApiKey: "test-e2b-key",
      sandboxConfig: {
        type: "e2b" as const,
        apiKey: "test-e2b-key",
        templateId: "vibekit-opencode",
      },
    };

    mockSandbox = {
      sandboxId: "test-sandbox-id",
      commands: {
        run: vi.fn(),
      },
      kill: vi.fn(),
      pause: vi.fn(),
    };

    const mockProvider = {
      create: vi.fn().mockResolvedValue(mockSandbox),
      resume: vi.fn().mockResolvedValue(mockSandbox),
    };
    MockedCreateSandboxProvider.mockReturnValue(mockProvider);

    openCodeAgent = new OpenCodeAgent(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      expect(openCodeAgent).toBeInstanceOf(OpenCodeAgent);
    });

    it("should initialize with custom model", () => {
      const customConfig = { ...config, model: "gpt-3.5-turbo" };
      const customAgent = new OpenCodeAgent(customConfig);
      expect(customAgent).toBeInstanceOf(OpenCodeAgent);
    });

    it("should initialize without model (uses default)", () => {
      const configWithoutModel = { ...config };
      delete configWithoutModel.model;
      const agentWithoutModel = new OpenCodeAgent(configWithoutModel);
      expect(agentWithoutModel).toBeInstanceOf(OpenCodeAgent);
    });

    it("should accept openai provider", () => {
      const configWithOpenAiProvider = {
        ...config,
        provider: "openai" as const,
      };
      const agent = new OpenCodeAgent(configWithOpenAiProvider);
      expect(agent).toBeInstanceOf(OpenCodeAgent);
    });

    it("should accept anthropic provider", () => {
      const configWithAnthropicProvider = {
        ...config,
        provider: "anthropic" as const,
        providerApiKey: "test-anthropic-key",
      };
      const agent = new OpenCodeAgent(configWithAnthropicProvider);
      expect(agent).toBeInstanceOf(OpenCodeAgent);
    });

    it("should default to openai provider when not specified", () => {
      const configWithoutProvider = { ...config };
      delete configWithoutProvider.provider;
      const agent = new OpenCodeAgent(configWithoutProvider);
      expect(agent).toBeInstanceOf(OpenCodeAgent);
    });

    it("should throw error when providerApiKey is missing", () => {
      const configWithoutApiKey = { ...config };
      delete configWithoutApiKey.providerApiKey;
      expect(() => new OpenCodeAgent(configWithoutApiKey)).toThrow(
        "Provider API key is required. Please provide providerApiKey."
      );
    });

    it("should throw error when sandboxConfig is missing", () => {
      const configWithoutSandbox = { ...config };
      delete configWithoutSandbox.sandboxConfig;
      expect(() => new OpenCodeAgent(configWithoutSandbox)).toThrow(
        "sandboxConfig is required"
      );
    });
  });

  describe("getSandbox", () => {
    it("should create a new sandbox when no sandboxId is provided", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await openCodeAgent.generateCode("test prompt");

      expect(mockProvider.create).toHaveBeenCalledWith(
        {
          type: "e2b",
          apiKey: "test-e2b-key",
          templateId: "vibekit-opencode",
        },
        {
          OPENAI_API_KEY: "test-openai-key",
        },
        "opencode"
      );
    });

    it("should resume existing sandbox when sandboxId is provided", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      const configWithSandboxId = {
        ...config,
        sandboxId: "existing-sandbox-id",
      };
      const agentWithExistingSandbox = new OpenCodeAgent(configWithSandboxId);

      await agentWithExistingSandbox.generateCode("test prompt");

      expect(mockProvider.resume).toHaveBeenCalledWith("existing-sandbox-id", {
        type: "e2b",
        apiKey: "test-e2b-key",
        templateId: "vibekit-opencode",
      });
    });

    it("should reuse existing sandbox instance", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await openCodeAgent.generateCode("test prompt 1");
      await openCodeAgent.generateCode("test prompt 2");

      expect(mockProvider.create).toHaveBeenCalledTimes(1);
    });

    it("should set correct environment variable for anthropic provider", async () => {
      const anthropicConfig = {
        ...config,
        provider: "anthropic" as const,
        providerApiKey: "test-anthropic-key",
      };
      const anthropicAgent = new OpenCodeAgent(anthropicConfig);

      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await anthropicAgent.generateCode("test prompt");

      expect(mockProvider.create).toHaveBeenCalledWith(
        {
          type: "e2b",
          apiKey: "test-e2b-key",
          templateId: "vibekit-opencode",
        },
        {
          ANTHROPIC_API_KEY: "test-anthropic-key",
        },
        "opencode"
      );
    });
  });

  describe("killSandbox", () => {
    it("should kill the sandbox if it exists", async () => {
      await openCodeAgent.generateCode("test prompt");
      await openCodeAgent.killSandbox();

      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(openCodeAgent.killSandbox()).resolves.not.toThrow();
    });
  });

  describe("pauseSandbox", () => {
    it("should pause the sandbox if it exists", async () => {
      await openCodeAgent.generateCode("test prompt");
      await openCodeAgent.pauseSandbox();

      expect(mockSandbox.pause).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(openCodeAgent.pauseSandbox()).resolves.not.toThrow();
    });
  });

  describe("resumeSandbox", () => {
    it("should resume the sandbox if it exists", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await openCodeAgent.generateCode("test prompt");
      await openCodeAgent.resumeSandbox();

      expect(mockProvider.resume).toHaveBeenCalledWith("test-sandbox-id", {
        type: "e2b",
        apiKey: "test-e2b-key",
        templateId: "vibekit-opencode",
      });
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(openCodeAgent.resumeSandbox()).resolves.not.toThrow();
    });
  });

  describe("prompt escaping", () => {
    it("should escape special characters in prompts", () => {
      const agent = new OpenCodeAgent(config);
      // Access the private method for testing
      const escapePrompt = (agent as any).escapePrompt.bind(agent);

      expect(escapePrompt("test `code` here")).toBe("test \\`code\\` here");
      expect(escapePrompt('test "quotes" here')).toBe('test \\"quotes\\" here');
      expect(escapePrompt("test $variable here")).toBe("test \\$variable here");
      expect(escapePrompt("test \\ backslash here")).toBe(
        "test \\\\ backslash here"
      );
    });

    it("should handle multiple special characters", () => {
      const agent = new OpenCodeAgent(config);
      const escapePrompt = (agent as any).escapePrompt.bind(agent);

      const input = 'echo "Hello `world` $USER"';
      const expected = 'echo \\"Hello \\`world\\` \\$USER\\"';
      expect(escapePrompt(input)).toBe(expected);
    });
  });

  describe("generateCode", () => {
    beforeEach(() => {
      mockSandbox.commands.run.mockResolvedValue({
        exitCode: 0,
        stdout: "Code generated successfully",
        stderr: "",
      });
    });

    it("should generate code successfully with new sandbox", async () => {
      const result = await openCodeAgent.generateCode(
        "Create a hello world function"
      );

      expect(result).toEqual({
        sandboxId: "test-sandbox-id",
        exitCode: 0,
        stdout: "Code generated successfully",
        stderr: "",
      });
    });

    it("should clone repository for new sandbox", async () => {
      await openCodeAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "git clone https://x-access-token:test-github-token@github.com/octocat/hello-world.git",
        { timeoutMs: 3600000, background: false }
      );
    });

    it("should configure git user for new sandbox", async () => {
      await openCodeAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        'cd hello-world && git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com"',
        { timeoutMs: 60000, background: false }
      );
    });

    it("should run opencode command with correct parameters for code mode", async () => {
      await openCodeAgent.generateCode("test prompt", "code");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && opencode run --model openai/gpt-4 --print-logs "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should run opencode command with ask mode restrictions", async () => {
      await openCodeAgent.generateCode("test prompt", "ask");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && opencode run --model openai/gpt-4 --print-logs "Research the repository and answer the user\'s questions. Do NOT make any changes to any files in the repository.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
        })
      );
    });

    it("should run without model parameter when model is not specified", async () => {
      const configWithoutModel = { ...config };
      delete configWithoutModel.model;
      const agentWithoutModel = new OpenCodeAgent(configWithoutModel);

      await agentWithoutModel.generateCode("test prompt", "code");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && opencode run "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should use custom model when specified", async () => {
      const customConfig = { ...config, model: "gpt-3.5-turbo" };
      const customAgent = new OpenCodeAgent(customConfig);

      await customAgent.generateCode("test prompt", "code");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && opencode run --model openai/gpt-3.5-turbo --print-logs "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should use correct provider in model parameter", async () => {
      const anthropicConfig = {
        ...config,
        provider: "anthropic" as const,
        model: "claude-3-sonnet",
        providerApiKey: "test-anthropic-key",
      };
      const anthropicAgent = new OpenCodeAgent(anthropicConfig);

      await anthropicAgent.generateCode("test prompt", "code");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && opencode run --model anthropic/claude-3-sonnet --print-logs "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should escape special characters in prompt", async () => {
      const promptWithSpecialChars =
        'Create a function that prints "Hello `World` $USER"';

      await openCodeAgent.generateCode(promptWithSpecialChars, "code");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && opencode run --model openai/gpt-4 --print-logs "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: Create a function that prints \\"Hello \\`World\\` \\$USER\\""',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should call callbacks when provided", async () => {
      const callbacks: OpenCodeStreamCallbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      mockSandbox.commands.run.mockImplementation((cmd, options) => {
        // Simulate stdout callback
        options.onStdout?.("test stdout data");
        options.onStderr?.("test stderr data");
        return Promise.resolve({
          exitCode: 0,
          stdout: "success",
          stderr: "",
        });
      });

      await openCodeAgent.generateCode(
        "test prompt",
        "code",
        undefined,
        [],
        callbacks
      );

      expect(callbacks.onUpdate).toHaveBeenCalledWith("test stdout data");
      expect(callbacks.onUpdate).toHaveBeenCalledWith("test stderr data");
    });

    it("should include conversation history in prompt", async () => {
      const history = [
        { role: "user" as const, content: "Previous question" },
        { role: "assistant" as const, content: "Previous answer" },
      ];

      await openCodeAgent.generateCode(
        "test prompt",
        "code",
        undefined,
        history
      );

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining(
          "Conversation history: user\n Previous question\n\nassistant\n Previous answer"
        ),
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should include conversation history and use correct model", async () => {
      const history = [
        { role: "user" as const, content: "Previous question" },
        { role: "assistant" as const, content: "Previous answer" },
      ];

      await openCodeAgent.generateCode(
        "test prompt",
        "code",
        undefined,
        history
      );

      // Verify both history inclusion and model parameter
      const expectedCall = mockSandbox.commands.run.mock.calls.find(
        (call) =>
          call[0].includes("Conversation history") &&
          call[0].includes("--model openai/gpt-4")
      );
      expect(expectedCall).toBeDefined();
    });

    it("should handle errors and call error callback", async () => {
      const callbacks: OpenCodeStreamCallbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      const error = new Error("Test error");
      mockSandbox.commands.run.mockRejectedValue(error);

      await expect(
        openCodeAgent.generateCode(
          "test prompt",
          "code",
          undefined,
          [],
          callbacks
        )
      ).rejects.toThrow("Failed to generate code: Test error");

      expect(callbacks.onError).toHaveBeenCalledWith(
        "Failed to generate code: Test error"
      );
    });

    it("should handle branch parameter when provided", async () => {
      await openCodeAgent.generateCode("test prompt", "code", "feature-branch");

      // Check that the sandbox commands were called (git clone, git config, opencode run)
      expect(mockSandbox.commands.run).toHaveBeenCalled();
      expect(mockSandbox.commands.run.mock.calls.length).toBeGreaterThanOrEqual(
        3
      );
    });
  });

  describe("session management", () => {
    it("should return sandbox ID when session exists", async () => {
      await openCodeAgent.generateCode("test prompt");
      const sessionId = await openCodeAgent.getSession();
      expect(sessionId).toBe("test-sandbox-id");
    });

    it("should return null when no session exists", async () => {
      const sessionId = await openCodeAgent.getSession();
      expect(sessionId).toBeNull();
    });

    it("should set session ID", async () => {
      await openCodeAgent.setSession("new-session-id");
      // The setSession method should update the internal config
      const sessionId = await openCodeAgent.getSession();
      expect(sessionId).toBe("new-session-id");
    });
  });

  describe("configuration methods", () => {
    it("should return correct agent type", () => {
      const agentType = (openCodeAgent as any).getAgentType();
      expect(agentType).toBe("opencode");
    });

    it("should return correct default template", () => {
      const template = (openCodeAgent as any).getDefaultTemplate();
      expect(template).toBe("vibekit-opencode");
    });

    it("should return correct model config", () => {
      const modelConfig = (openCodeAgent as any).getModelConfig();
      expect(modelConfig).toEqual({
        provider: "openai",
        apiKey: "test-openai-key",
        model: "gpt-4",
      });
    });

    it("should return correct environment variables for openai", () => {
      const envVars = (openCodeAgent as any).getEnvironmentVariables();
      expect(envVars).toEqual({
        OPENAI_API_KEY: "test-openai-key",
      });
    });

    it("should return correct environment variables for anthropic", () => {
      const anthropicConfig = {
        ...config,
        provider: "anthropic" as const,
        providerApiKey: "test-anthropic-key",
      };
      const anthropicAgent = new OpenCodeAgent(anthropicConfig);
      const envVars = (anthropicAgent as any).getEnvironmentVariables();
      expect(envVars).toEqual({
        ANTHROPIC_API_KEY: "test-anthropic-key",
      });
    });

    it("should return correct API key", () => {
      const apiKey = (openCodeAgent as any).getApiKey();
      expect(apiKey).toBe("test-openai-key");
    });
  });
});
