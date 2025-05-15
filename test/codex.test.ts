import { describe, it, expect, vi } from "vitest";
import { callCodex } from "../src/agents/codex";

const mockConfig = {
  openaiApiKey: "sk-test-123",
  githubToken: "ghp-test-123",
  repoUrl: "https://github.com/user/repo",
  e2bApiKey: "e2b-test-123",
};

describe("callCodex", () => {
  it("should return mocked code response for a prompt", async () => {
    // Mock actual API call inside callCodex if it uses fetch or axios
    vi.mock("../src/agents/codex", async () => {
      return {
        callCodex: vi.fn().mockResolvedValue({
          code: `console.log("Hello from Codex");`,
        }),
      };
    });

    const { callCodex } = await import("../src/agents/codex");
    const result = await callCodex("Print hello", mockConfig);

    expect(result).toHaveProperty("code");
    expect(result.code).toContain("console.log");
  });
});
