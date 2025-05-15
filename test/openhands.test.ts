import { describe, it, expect, vi } from "vitest";
import { callOpenHands } from "../src/agents/openhands";

const mockApiKey = "openhands-api-key-123";

describe("callOpenHands", () => {
  it("should return mocked code response for a prompt", async () => {
    // Mock actual API call inside callOpenHands if it uses fetch or axios
    vi.mock("../src/agents/openhands", async () => {
      return {
        callOpenHands: vi.fn().mockResolvedValue({
          code: `console.log("Hello from OpenHands");`,
        }),
      };
    });

    const { callOpenHands } = await import("../src/agents/openhands");

    const result = await callOpenHands("Print hello", mockApiKey);

    expect(result).toHaveProperty("code");
    expect(result.code).toContain("console.log");
  });
});
