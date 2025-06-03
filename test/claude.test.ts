import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClaudeAgent } from "../src/agents/claude";
import { ClaudeConfig, ClaudeStreamCallbacks } from "../src/types";
import { Sandbox } from "@e2b/code-interpreter";

// Mock dependencies
vi.mock("@e2b/code-interpreter");
vi.mock("../src/agents/utils.js");

const MockedSandbox = vi.mocked(Sandbox);

describe("ClaudeAgent", () => {
  let config: ClaudeConfig;
  let mockSandbox: any;
  let claudeAgent: ClaudeAgent;

  beforeEach(() => {
    config = {
      anthropicApiKey: "test-anthropic-key",
      githubToken: "test-github-token",
      repoUrl: "octocat/hello-world",
      e2bApiKey: "test-e2b-key",
      e2bTemplateId: "vibekit-claude",
      model: "claude-3-sonnet",
    };

    mockSandbox = {
      sandboxId: "test-sandbox-id",
      commands: {
        run: vi.fn(),
      },
      kill: vi.fn(),
      pause: vi.fn(),
    };

    MockedSandbox.create = vi.fn().mockResolvedValue(mockSandbox);
    MockedSandbox.resume = vi.fn().mockResolvedValue(mockSandbox);

    claudeAgent = new ClaudeAgent(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      expect(claudeAgent).toBeInstanceOf(ClaudeAgent);
    });
  });

  describe("getSandbox", () => {
    it("should create a new sandbox when no sandboxId is provided", async () => {
      await claudeAgent.generateCode("test prompt");

      expect(MockedSandbox.create).toHaveBeenCalledWith("vibekit-claude", {
        envs: {
          ANTHROPIC_API_KEY: "test-anthropic-key",
        },
        apiKey: "test-e2b-key",
      });
    });

    it("should resume existing sandbox when sandboxId is provided", async () => {
      const configWithSandboxId = {
        ...config,
        sandboxId: "existing-sandbox-id",
      };
      const agentWithExistingSandbox = new ClaudeAgent(configWithSandboxId);

      await agentWithExistingSandbox.generateCode("test prompt");

      expect(MockedSandbox.resume).toHaveBeenCalledWith("existing-sandbox-id", {
        apiKey: "test-e2b-key",
      });
    });

    it("should reuse existing sandbox instance", async () => {
      await claudeAgent.generateCode("test prompt 1");
      await claudeAgent.generateCode("test prompt 2");

      expect(MockedSandbox.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("killSandbox", () => {
    it("should kill the sandbox if it exists", async () => {
      await claudeAgent.generateCode("test prompt");
      await claudeAgent.killSandbox();

      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(claudeAgent.killSandbox()).resolves.not.toThrow();
    });
  });

  describe("pauseSandbox", () => {
    it("should pause the sandbox if it exists", async () => {
      await claudeAgent.generateCode("test prompt");
      await claudeAgent.pauseSandbox();

      expect(mockSandbox.pause).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(claudeAgent.pauseSandbox()).resolves.not.toThrow();
    });
  });

  describe("resumeSandbox", () => {
    it("should resume the sandbox if it exists", async () => {
      await claudeAgent.generateCode("test prompt");
      await claudeAgent.resumeSandbox();

      expect(MockedSandbox.resume).toHaveBeenCalledWith("test-sandbox-id", {
        apiKey: "test-e2b-key",
      });
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(claudeAgent.resumeSandbox()).resolves.not.toThrow();
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
      const result = await claudeAgent.generateCode(
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
      await claudeAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "git clone https://x-access-token:test-github-token@github.com/octocat/hello-world.git",
        { timeoutMs: 3600000 }
      );
    });

    it("should configure git user for new sandbox", async () => {
      await claudeAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        'cd hello-world && git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com"',
        { timeoutMs: 60000 }
      );
    });

    it("should run claude command with correct parameters for code mode", async () => {
      await claudeAgent.generateCode("test prompt", "code");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && echo "test prompt" | claude -p --append-system-prompt "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions." --output-format stream-json --verbose --dangerously-skip-permissions',
        expect.objectContaining({
          timeoutMs: 3600000,
        })
      );
    });

    it("should run claude command with ask mode restrictions", async () => {
      await claudeAgent.generateCode("test prompt", "ask");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        3,
        'cd hello-world && echo "test prompt" | claude -p --append-system-prompt "Research the repository and answer the user\'s questions. Do NOT make any changes to any files in the repository." --disallowedTools "Edit" "Replace" "Write" --output-format stream-json --verbose --dangerously-skip-permissions',
        expect.objectContaining({
          timeoutMs: 3600000,
        })
      );
    });

    it("should call callbacks when provided", async () => {
      const callbacks: ClaudeStreamCallbacks = {
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

      await claudeAgent.generateCode("test prompt", "code", [], callbacks);

      expect(callbacks.onUpdate).toHaveBeenCalledWith("test stdout data");
      expect(callbacks.onUpdate).toHaveBeenCalledWith("test stderr data");
    });

    it("should include conversation history in system prompt", async () => {
      const history = [
        { role: "user" as const, content: "Previous question" },
        { role: "assistant" as const, content: "Previous answer" },
      ];

      await claudeAgent.generateCode("test prompt", "code", history);

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining(
          "Conversation history: user\n Previous question\n\nassistant\n Previous answer"
        ),
        expect.objectContaining({
          timeoutMs: 3600000,
        })
      );
    });

    it("should handle errors and call error callback", async () => {
      const callbacks: ClaudeStreamCallbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      const error = new Error("Test error");
      mockSandbox.commands.run.mockRejectedValue(error);

      await expect(
        claudeAgent.generateCode("test prompt", "code", [], callbacks)
      ).rejects.toThrow("Failed to generate code: Test error");

      expect(callbacks.onError).toHaveBeenCalledWith(
        "Failed to generate code: Test error"
      );
    });
  });

  describe("session management", () => {
    it("should return sandbox ID when session exists", async () => {
      await claudeAgent.generateCode("test prompt");
      const sessionId = await claudeAgent.getSession();
      expect(sessionId).toBe("test-sandbox-id");
    });

    it("should return null when no session exists", async () => {
      const sessionId = await claudeAgent.getSession();
      expect(sessionId).toBeNull();
    });

    it("should set session ID", async () => {
      await claudeAgent.setSession("new-session-id");
      // The setSession method should update the internal config
      const sessionId = await claudeAgent.getSession();
      expect(sessionId).toBe("new-session-id");
    });
  });
});
