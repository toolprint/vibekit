import { describe, it, expect, vi } from "vitest";
import { VibeKit } from "../packages/vibekit/src/index.js";
import { createDaytonaProvider } from "../packages/daytona/dist/index.js";
import dotenv from "dotenv";

dotenv.config();

describe("Daytona Sandbox", () => {
  it("should generate code with daytona sandbox", async () => {
    const prompt = "Hi there";

    const daytonaProvider = createDaytonaProvider({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

    const vibeKit = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(daytonaProvider);

    const updateSpy = vi.fn();
    const errorSpy = vi.fn();

    vibeKit.on("update", updateSpy);
    vibeKit.on("error", errorSpy);

    const result = await vibeKit.generateCode(prompt, "ask");
    const host = await vibeKit.getHost(3000);

    await vibeKit.kill();

    expect(result).toBeDefined();
    expect(host).toBeDefined();
    expect(updateSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  }, 60000);

  it("should resume a sandbox using sandbox ID from result", async () => {
    const prompt = "Hi there";

    const daytonaProvider = createDaytonaProvider({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

    // First, create a sandbox and get the sandbox ID
    const vibeKit1 = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(daytonaProvider);

    const result1 = await vibeKit1.generateCode(prompt, "ask");
    const sandboxId = result1.sandboxId;

    expect(sandboxId).toBeDefined();
    expect(typeof sandboxId).toBe("string");

    // Now create a new VibeKit instance and resume the sandbox
    const vibeKit2 = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(daytonaProvider)
      .withSession(sandboxId);

    const updateSpy = vi.fn();
    const errorSpy = vi.fn();

    vibeKit2.on("update", updateSpy);
    vibeKit2.on("error", errorSpy);

    // Test that we can use the resumed sandbox
    const result2 = await vibeKit2.generateCode(
      "echo 'resumed sandbox'",
      "ask"
    );

    expect(result2).toBeDefined();
    expect(result2.sandboxId).toBe(sandboxId); // Should be the same sandbox ID
    expect(updateSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // Clean up both instances
    await vibeKit1.kill();
    await vibeKit2.kill();
  }, 90000);
});
