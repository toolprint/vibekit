import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VibeKit } from "../src";
import { callCodex } from "../src/agents/codex";
import { callClaude } from "../src/agents/claude";
import { callDevin } from "../src/agents/devin";
import { callCodegen } from "../src/agents/codegen";
import { callOpenHands } from "../src/agents/openhands";

// Mock modules before tests
vi.mock("../src/agents/codex");
vi.mock("../src/agents/claude");
vi.mock("../src/agents/devin");
vi.mock("../src/agents/codegen");
vi.mock("../src/agents/openhands");

describe("VibeKit usage", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Setup mock implementations
    vi.mocked(callCodex).mockResolvedValue({ code: "// Codex generated code" });
    vi.mocked(callClaude).mockResolvedValue({
      code: "// Claude generated code",
    });
    vi.mocked(callDevin).mockResolvedValue({ code: "// Devin generated code" });
    vi.mocked(callCodegen).mockResolvedValue({
      code: "// Codegen generated code",
    });
    vi.mocked(callOpenHands).mockResolvedValue({
      code: "// OpenHands generated code",
    });
  });

  it("should generate code using Codex agent", async () => {
    // Setup VibeKit with Codex agent
    const vk = new VibeKit({
      agent: "codex",
      config: {
        openaiApiKey: "test-openai-key",
        githubToken: "test-github-token",
        repoUrl: "https://github.com/test/repo",
        e2bApiKey: "test-e2b-key",
      },
    });

    // Send a prompt
    const result = await vk.sendPrompt("Create a login form");

    // Verify the result
    expect(result).toHaveProperty("code");
    expect(result.code).toContain("Codex generated code");
    expect(callCodex).toHaveBeenCalledWith(
      "Create a login form",
      expect.any(Object)
    );
  });

  it("should generate code using Claude agent", async () => {
    // Setup VibeKit with Claude agent
    const vk = new VibeKit({
      agent: "claude",
      config: {
        anthropicApiKey: "test-anthropic-key",
        githubToken: "test-github-token",
        repoUrl: "https://github.com/test/repo",
        e2bApiKey: "test-e2b-key",
      },
    });

    // Send a prompt
    const result = await vk.sendPrompt("Create a user profile page");

    // Verify the result
    expect(result).toHaveProperty("code");
    expect(result.code).toContain("Claude generated code");
    expect(callClaude).toHaveBeenCalledWith(
      "Create a user profile page",
      expect.any(Object)
    );
  });

  it("should generate code using Devin agent", async () => {
    // Setup VibeKit with Devin agent
    const vk = new VibeKit({
      agent: "devin",
      config: {
        apiKey: "test-devin-key",
      },
    });

    // Send a prompt
    const result = await vk.sendPrompt("Create a todo app");

    // Verify the result
    expect(result).toHaveProperty("code");
    expect(result.code).toContain("Devin generated code");
    expect(callDevin).toHaveBeenCalledWith(
      "Create a todo app",
      "test-devin-key"
    );
  });

  it("should generate code using Codegen agent", async () => {
    // Setup VibeKit with Codegen agent
    const vk = new VibeKit({
      agent: "codegen",
      config: {
        apiKey: "test-codegen-key",
      },
    });

    // Send a prompt
    const result = await vk.sendPrompt("Create a navigation bar");

    // Verify the result
    expect(result).toHaveProperty("code");
    expect(result.code).toContain("Codegen generated code");
    expect(callCodegen).toHaveBeenCalledWith(
      "Create a navigation bar",
      "test-codegen-key"
    );
  });

  it("should generate code using OpenHands agent", async () => {
    // Setup VibeKit with OpenHands agent
    const vk = new VibeKit({
      agent: "openhands",
      config: {
        apiKey: "test-openhands-key",
      },
    });

    // Send a prompt
    const result = await vk.sendPrompt("Create a pricing table");

    // Verify the result
    expect(result).toHaveProperty("code");
    expect(result.code).toContain("OpenHands generated code");
    expect(callOpenHands).toHaveBeenCalledWith(
      "Create a pricing table",
      "test-openhands-key"
    );
  });

  it("should throw an error for unsupported agent", async () => {
    // Create a VibeKit instance with an agent property we'll override
    const vk = new VibeKit({
      agent: "codex",
      config: {
        openaiApiKey: "test-key",
        githubToken: "test-github-token",
        repoUrl: "https://github.com/test/repo",
        e2bApiKey: "test-e2b-key",
      },
    });

    // Override the private setup property to test error handling
    // @ts-ignore - Accessing private property for testing
    vk["setup"].agent = "invalid-agent" as any;

    // Expect promise rejection when sending prompt
    await expect(vk.sendPrompt("Create something")).rejects.toThrow(
      "Unsupported agent"
    );
  });
});
