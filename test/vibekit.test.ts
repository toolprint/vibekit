import { describe, it, expect, vi, beforeEach } from "vitest";
import { VibeKit, VibeKitConfig, PullRequestResponse } from "../src/index";
import { CodexAgent } from "../src/agents/codex";
import { ClaudeAgent } from "../src/agents/claude";

// Mock dependencies
vi.mock("../src/agents/codex");
vi.mock("../src/agents/claude");

const MockedCodexAgent = vi.mocked(CodexAgent);
const MockedClaudeAgent = vi.mocked(ClaudeAgent);

describe("VibeKit", () => {
  let codexConfig: VibeKitConfig;
  let claudeConfig: VibeKitConfig;
  let mockCodexAgent: any;
  let mockClaudeAgent: any;

  beforeEach(() => {
    codexConfig = {
      agent: {
        type: "codex",
        model: {
          name: "gpt-4",
          apiKey: "test-openai-key",
        },
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

    claudeConfig = {
      agent: {
        type: "claude",
        model: {
          name: "claude-3-5-sonnet-20241022",
          apiKey: "test-anthropic-key",
        },
      },
      environment: {
        e2b: {
          apiKey: "test-e2b-key",
          templateId: "test-template",
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

  describe("constructor", () => {
    it("should throw error when daytona environment is configured", () => {
      const daytonaConfig: VibeKitConfig = {
        agent: {
          type: "codex",
          model: {
            name: "gpt-4",
            apiKey: "test-openai-key",
          },
        },
        environment: {
          daytona: {
            apiKey: "test-daytona-key",
            image: "test-image",
            serverUrl: "https://test-daytona-server.com",
          },
        },
        github: {
          token: "test-github-token",
          repository: "octocat/hello-world",
        },
      };

      expect(() => {
        new VibeKit(daytonaConfig);
      }).toThrow("Daytona environment support is not yet implemented");
    });
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

      const result = await vibeKit.generateCode("test prompt", "code", []);

      expect(MockedCodexAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerApiKey: "test-openai-key",
          githubToken: "test-github-token",
          repoUrl: "octocat/hello-world",
          e2bApiKey: "test-e2b-key",
          model: "gpt-4",
        })
      );
      expect(mockCodexAgent.generateCode).toHaveBeenCalledWith(
        "test prompt",
        "code",
        []
      );
      expect(result).toBe(mockResponse);
    });

    it("should work with Codex agent when GitHub config is not provided", async () => {
      const configWithoutGithub: VibeKitConfig = {
        agent: {
          type: "codex",
          model: {
            name: "gpt-4",
            apiKey: "test-openai-key",
          },
        },
        environment: {
          e2b: {
            apiKey: "test-e2b-key",
          },
        },
      };

      const vibeKit = new VibeKit(configWithoutGithub);
      const mockResponse = {
        exitCode: 0,
        stdout: "test",
        stderr: "",
        sandboxId: "test",
      };

      mockCodexAgent.generateCode.mockResolvedValue(mockResponse);

      const result = await vibeKit.generateCode("test prompt", "code", []);

      expect(MockedCodexAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerApiKey: "test-openai-key",
          githubToken: undefined,
          repoUrl: undefined,
          e2bApiKey: "test-e2b-key",
          model: "gpt-4",
        })
      );
      expect(mockCodexAgent.generateCode).toHaveBeenCalledWith(
        "test prompt",
        "code",
        []
      );
      expect(result).toBe(mockResponse);
    });

    it("should use Claude agent when configured", async () => {
      const vibeKit = new VibeKit(claudeConfig);
      const mockResponse = {
        exitCode: 0,
        stdout: "test code",
        stderr: "",
        sandboxId: "test-sandbox-id",
      };

      mockClaudeAgent.generateCode.mockResolvedValue(mockResponse);

      const result = await vibeKit.generateCode("test prompt", "code", []);

      expect(MockedClaudeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerApiKey: "test-anthropic-key",
          githubToken: "test-github-token",
          repoUrl: "octocat/hello-world",
          e2bApiKey: "test-e2b-key",
        })
      );
      expect(mockClaudeAgent.generateCode).toHaveBeenCalledWith(
        "test prompt",
        "code",
        []
      );
      expect(result).toBe(mockResponse);
    });

    it("should work with Claude agent when GitHub config is not provided", async () => {
      const configWithoutGithub: VibeKitConfig = {
        agent: {
          type: "claude",
          model: {
            name: "claude-3-5-sonnet-20241022",
            apiKey: "test-anthropic-key",
          },
        },
        environment: {
          e2b: {
            apiKey: "test-e2b-key",
            templateId: "test-template",
          },
        },
      };

      const vibeKit = new VibeKit(configWithoutGithub);
      const mockResponse = {
        exitCode: 0,
        stdout: "test code",
        stderr: "",
        sandboxId: "test-sandbox-id",
      };

      mockClaudeAgent.generateCode.mockResolvedValue(mockResponse);

      const result = await vibeKit.generateCode("test prompt", "code", []);

      expect(MockedClaudeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerApiKey: "test-anthropic-key",
          githubToken: undefined,
          repoUrl: undefined,
          e2bApiKey: "test-e2b-key",
        })
      );
      expect(mockClaudeAgent.generateCode).toHaveBeenCalledWith(
        "test prompt",
        "code",
        []
      );
      expect(result).toBe(mockResponse);
    });

    it("should pass callbacks to Codex agent", async () => {
      const vibeKit = new VibeKit(codexConfig);
      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await vibeKit.generateCode("test prompt", "code", [], callbacks);

      // Verify that generateCode was called with the correct parameters
      // The callbacks will be wrapped functions, so we check that they exist
      expect(mockCodexAgent.generateCode).toHaveBeenCalledWith(
        "test prompt",
        "code",
        [],
        expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    it("should handle callbacks for Claude agent", async () => {
      const vibeKit = new VibeKit(claudeConfig);
      const callbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };
      const mockResponse = {
        exitCode: 0,
        stdout: "test code",
        stderr: "",
        sandboxId: "test-sandbox-id",
      };

      mockClaudeAgent.generateCode.mockResolvedValue(mockResponse);

      await vibeKit.generateCode("test prompt", "code", [], callbacks);

      expect(mockClaudeAgent.generateCode).toHaveBeenCalledWith(
        "test prompt",
        "code",
        [],
        expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    it("should throw error for unsupported agent", async () => {
      const unsupportedConfig = {
        agent: {
          type: "devin" as any,
          model: {
            apiKey: "test-key",
          },
        },
        environment: {
          e2b: {
            apiKey: "test-e2b-key",
          },
        },
        github: {
          token: "test-github-token",
          repository: "test/repo",
        },
      };

      expect(() => {
        new VibeKit(unsupportedConfig);
      }).toThrow("Unsupported agent type: devin");
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

      expect(MockedCodexAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerApiKey: "test-openai-key",
          githubToken: "test-github-token",
          repoUrl: "octocat/hello-world",
          e2bApiKey: "test-e2b-key",
          model: "gpt-4",
        })
      );
      expect(mockCodexAgent.createPullRequest).toHaveBeenCalled();
      expect(result).toBe(mockPRResponse);
    });

    it("should create PR using Claude agent", async () => {
      const vibeKit = new VibeKit(claudeConfig);
      const mockPRResponse: PullRequestResponse = {
        html_url: "https://github.com/octocat/hello-world/pull/2",
        number: 2,
        branchName: "claude/test-branch",
        commitSha: "def456",
      };

      mockClaudeAgent.createPullRequest.mockResolvedValue(mockPRResponse);

      const result = await vibeKit.createPullRequest();

      expect(MockedClaudeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerApiKey: "test-anthropic-key",
          githubToken: "test-github-token",
          repoUrl: "octocat/hello-world",
          e2bApiKey: "test-e2b-key",
        })
      );
      expect(mockClaudeAgent.createPullRequest).toHaveBeenCalled();
      expect(result).toBe(mockPRResponse);
    });

    it("should throw error when GitHub config is missing for Codex agent", async () => {
      const configWithoutGithub: VibeKitConfig = {
        agent: {
          type: "codex",
          model: {
            name: "gpt-4",
            apiKey: "test-openai-key",
          },
        },
        environment: {
          e2b: {
            apiKey: "test-e2b-key",
          },
        },
      };

      const vibeKit = new VibeKit(configWithoutGithub);

      // Mock the agent to throw the expected error
      mockCodexAgent.createPullRequest.mockRejectedValue(
        new Error(
          "GitHub configuration is required for creating pull requests. Please provide githubToken and repoUrl in your configuration."
        )
      );

      await expect(vibeKit.createPullRequest()).rejects.toThrow(
        "GitHub configuration is required for creating pull requests. Please provide githubToken and repoUrl in your configuration."
      );
    });

    it("should throw error when GitHub config is missing for Claude agent", async () => {
      const configWithoutGithub: VibeKitConfig = {
        agent: {
          type: "claude",
          model: {
            name: "claude-3-5-sonnet-20241022",
            apiKey: "test-anthropic-key",
          },
        },
        environment: {
          e2b: {
            apiKey: "test-e2b-key",
            templateId: "test-template",
          },
        },
      };

      const vibeKit = new VibeKit(configWithoutGithub);

      // Mock the agent to throw the expected error
      mockClaudeAgent.createPullRequest.mockRejectedValue(
        new Error(
          "GitHub configuration is required for creating pull requests. Please provide githubToken and repoUrl in your configuration."
        )
      );

      await expect(vibeKit.createPullRequest()).rejects.toThrow(
        "GitHub configuration is required for creating pull requests. Please provide githubToken and repoUrl in your configuration."
      );
    });
  });

  describe("sandbox management", () => {
    describe("kill", () => {
      it("should kill sandbox using Codex agent", async () => {
        const vibeKit = new VibeKit(codexConfig);

        await vibeKit.kill();

        expect(MockedCodexAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            providerApiKey: "test-openai-key",
            githubToken: "test-github-token",
            repoUrl: "octocat/hello-world",
            e2bApiKey: "test-e2b-key",
            model: "gpt-4",
          })
        );
        expect(mockCodexAgent.killSandbox).toHaveBeenCalled();
      });

      it("should kill sandbox using Claude agent", async () => {
        const vibeKit = new VibeKit(claudeConfig);

        await vibeKit.kill();

        expect(MockedClaudeAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            providerApiKey: "test-anthropic-key",
            githubToken: "test-github-token",
            repoUrl: "octocat/hello-world",
            e2bApiKey: "test-e2b-key",
          })
        );
        expect(mockClaudeAgent.killSandbox).toHaveBeenCalled();
      });
    });

    describe("pause", () => {
      it("should pause sandbox using Codex agent", async () => {
        const vibeKit = new VibeKit(codexConfig);

        await vibeKit.pause();

        expect(MockedCodexAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            providerApiKey: "test-openai-key",
            githubToken: "test-github-token",
            repoUrl: "octocat/hello-world",
            e2bApiKey: "test-e2b-key",
            model: "gpt-4",
          })
        );
        expect(mockCodexAgent.pauseSandbox).toHaveBeenCalled();
      });

      it("should pause sandbox using Claude agent", async () => {
        const vibeKit = new VibeKit(claudeConfig);

        await vibeKit.pause();

        expect(MockedClaudeAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            providerApiKey: "test-anthropic-key",
            githubToken: "test-github-token",
            repoUrl: "octocat/hello-world",
            e2bApiKey: "test-e2b-key",
          })
        );
        expect(mockClaudeAgent.pauseSandbox).toHaveBeenCalled();
      });
    });

    describe("resume", () => {
      it("should resume sandbox using Codex agent", async () => {
        const vibeKit = new VibeKit(codexConfig);

        await vibeKit.resume();

        expect(MockedCodexAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            providerApiKey: "test-openai-key",
            githubToken: "test-github-token",
            repoUrl: "octocat/hello-world",
            e2bApiKey: "test-e2b-key",
            model: "gpt-4",
          })
        );
        expect(mockCodexAgent.resumeSandbox).toHaveBeenCalled();
      });

      it("should resume sandbox using Claude agent", async () => {
        const vibeKit = new VibeKit(claudeConfig);

        await vibeKit.resume();

        expect(MockedClaudeAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            providerApiKey: "test-anthropic-key",
            githubToken: "test-github-token",
            repoUrl: "octocat/hello-world",
            e2bApiKey: "test-e2b-key",
          })
        );
        expect(mockClaudeAgent.resumeSandbox).toHaveBeenCalled();
      });
    });
  });
});
