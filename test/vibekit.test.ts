import { describe, it, expect, vi, beforeEach } from "vitest";
import { VibeKit, AgentConfig, PullRequestResponse } from "../src/index.js";
import { CodexAgent } from "../src/agents/codex.js";
import { callClaude } from "../src/agents/claude.js";

// Mock dependencies
vi.mock("../src/agents/codex.js");
vi.mock("../src/agents/claude.js");

const MockedCodexAgent = vi.mocked(CodexAgent);
const mockedCallClaude = vi.mocked(callClaude);

describe("VibeKit", () => {
  let codexConfig: AgentConfig;
  let claudeConfig: AgentConfig;
  let mockCodexAgent: any;

  beforeEach(() => {
    codexConfig = {
      agent: "codex",
      config: {
        openaiApiKey: "test-openai-key",
        githubToken: "test-github-token",
        repoUrl: "octocat/hello-world",
        e2bApiKey: "test-e2b-key",
      },
    };

    claudeConfig = {
      agent: "claude",
      config: {
        anthropicApiKey: "test-anthropic-key",
        githubToken: "test-github-token",
        repoUrl: "octocat/hello-world",
        e2bApiKey: "test-e2b-key",
        e2bTemplateId: "test-template",
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
  });

  describe("generateCode", () => {
    it("should use Codex agent when configured", async () => {
      const vibeKit = new VibeKit(codexConfig);
      const mockResponse = {
        exitCode: 0,
        stdout: "test",
        stderr: "",
        sandboxId: "test",
      };

      mockCodexAgent.generateCode.mockResolvedValue(mockResponse);

      const result = await vibeKit.generateCode("test prompt");

      expect(MockedCodexAgent).toHaveBeenCalledWith(codexConfig.config);
      expect(mockCodexAgent.generateCode).toHaveBeenCalledWith("test prompt");
      expect(result).toBe(mockResponse);
    });

    it("should use Claude agent when configured", async () => {
      const vibeKit = new VibeKit(claudeConfig);
      const mockResponse = { code: "test code" };

      mockedCallClaude.mockResolvedValue(mockResponse);

      const result = await vibeKit.generateCode("test prompt");

      expect(mockedCallClaude).toHaveBeenCalledWith(
        "test prompt",
        claudeConfig.config
      );
      expect(result).toBe(mockResponse);
    });

    it("should pass callbacks to Codex agent", async () => {
      const vibeKit = new VibeKit(codexConfig);
      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await vibeKit.generateCode("test prompt", callbacks);

      expect(mockCodexAgent.generateCode).toHaveBeenCalledWith("test prompt", {
        onUpdate: callbacks.onUpdate,
        onError: callbacks.onError,
      });
    });

    it("should handle callbacks for Claude agent", async () => {
      const vibeKit = new VibeKit(claudeConfig);
      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };
      const mockResponse = { code: "test code" };

      mockedCallClaude.mockResolvedValue(mockResponse);

      await vibeKit.generateCode("test prompt", callbacks);

      expect(callbacks.onUpdate).toHaveBeenCalledWith(
        "Starting Claude code generation..."
      );
      expect(callbacks.onUpdate).toHaveBeenCalledWith(
        "Claude code generation completed."
      );
    });

    it("should throw error for unsupported agent", async () => {
      const unsupportedConfig = {
        agent: "devin" as any,
        config: { apiKey: "test-key" },
      };
      const vibeKit = new VibeKit(unsupportedConfig);

      await expect(vibeKit.generateCode("test prompt")).rejects.toThrow(
        "Unsupported agent"
      );
    });
  });

  describe("createPullRequest", () => {
    it("should create PR using Codex agent", async () => {
      const vibeKit = new VibeKit(codexConfig);
      const mockPRResponse: PullRequestResponse = {
        html_url: "https://github.com/octocat/hello-world/pull/1",
        number: 1,
        branchName: "codex/test-branch",
        commitSha: "abc123",
      };

      mockCodexAgent.createPullRequest.mockResolvedValue(mockPRResponse);

      const result = await vibeKit.createPullRequest();

      expect(MockedCodexAgent).toHaveBeenCalledWith(codexConfig.config);
      expect(mockCodexAgent.createPullRequest).toHaveBeenCalled();
      expect(result).toBe(mockPRResponse);
    });

    it("should throw error for non-Codex agents", async () => {
      const vibeKit = new VibeKit(claudeConfig);

      await expect(vibeKit.createPullRequest()).rejects.toThrow(
        "Pull request creation is only supported for the Codex agent"
      );
    });
  });

  describe("sandbox management", () => {
    describe("kill", () => {
      it("should kill sandbox using Codex agent", async () => {
        const vibeKit = new VibeKit(codexConfig);

        await vibeKit.kill();

        expect(MockedCodexAgent).toHaveBeenCalledWith(codexConfig.config);
        expect(mockCodexAgent.killSandbox).toHaveBeenCalled();
      });

      it("should throw error for non-Codex agents", async () => {
        const vibeKit = new VibeKit(claudeConfig);

        await expect(vibeKit.kill()).rejects.toThrow(
          "Sandbox management is only supported for the Codex agent"
        );
      });
    });

    describe("pause", () => {
      it("should pause sandbox using Codex agent", async () => {
        const vibeKit = new VibeKit(codexConfig);

        await vibeKit.pause();

        expect(MockedCodexAgent).toHaveBeenCalledWith(codexConfig.config);
        expect(mockCodexAgent.pauseSandbox).toHaveBeenCalled();
      });

      it("should throw error for non-Codex agents", async () => {
        const vibeKit = new VibeKit(claudeConfig);

        await expect(vibeKit.pause()).rejects.toThrow(
          "Sandbox management is only supported for the Codex agent"
        );
      });
    });

    describe("resume", () => {
      it("should resume sandbox using Codex agent", async () => {
        const vibeKit = new VibeKit(codexConfig);

        await vibeKit.resume();

        expect(MockedCodexAgent).toHaveBeenCalledWith(codexConfig.config);
        expect(mockCodexAgent.resumeSandbox).toHaveBeenCalled();
      });

      it("should throw error for non-Codex agents", async () => {
        const vibeKit = new VibeKit(claudeConfig);

        await expect(vibeKit.resume()).rejects.toThrow(
          "Sandbox management is only supported for the Codex agent"
        );
      });
    });
  });
});
