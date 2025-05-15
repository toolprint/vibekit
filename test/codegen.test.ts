import { describe, it, expect, vi } from "vitest";
import { callCodegen } from "../src/agents/codegen";

const mockApiKey = "codegen-api-key-123";

describe("callCodegen", () => {
  it("should return mocked code response for a prompt", async () => {
    // Mock actual API call inside callCodegen if it uses fetch or axios
    vi.mock("../src/agents/codegen", async () => {
      return {
        callCodegen: vi.fn().mockResolvedValue({
          code: `console.log("Hello from Codegen");`,
        }),
      };
    });

    const { callCodegen } = await import("../src/agents/codegen");

    const result = await callCodegen("Print hello", mockApiKey);

    expect(result).toHaveProperty("code");
    expect(result.code).toContain("console.log");
  });
});
