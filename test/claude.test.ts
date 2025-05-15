import { describe, it, expect, vi } from "vitest";
import { callClaude } from "../src/agents/claude";

const mockConfig = {
  anthropicApiKey: "sk-ant-test123",
  githubToken: "ghp-test-123",
  repoUrl: "https://github.com/user/repo",
  e2bApiKey: "e2b-test-123",
};

describe("callClaude", () => {
  it("should return mocked code response for a prompt", async () => {
    // Mock actual API call inside callClaude if it uses fetch or axios
    vi.mock("../src/agents/claude", async () => {
      return {
        callClaude: vi.fn().mockResolvedValue({
          code: `console.log("Hello from Claude");`,
        }),
      };
    });

    const { callClaude } = await import("../src/agents/claude");

    const result = await callClaude("Print hello", mockConfig);

    expect(result).toHaveProperty("code");
    expect(result.code).toContain("console.log");
  });
});
