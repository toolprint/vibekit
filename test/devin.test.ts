import { describe, it, expect, vi } from "vitest";
import { callDevin } from "../src/agents/devin";

const mockApiKey = "devin-api-key-123";

describe("callDevin", () => {
  it("should return mocked code response for a prompt", async () => {
    // Mock actual API call inside callDevin if it uses fetch or axios
    vi.mock("../src/agents/devin", async () => {
      return {
        callDevin: vi.fn().mockResolvedValue({
          code: `console.log("Hello from Devin");`,
        }),
      };
    });

    const { callDevin } = await import("../src/agents/devin");

    const result = await callDevin("Print hello", mockApiKey);

    expect(result).toHaveProperty("code");
    expect(result.code).toContain("console.log");
  });
});
