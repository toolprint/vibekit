import { describe, it, expect, vi } from "vitest";
import dotenv from "dotenv";

import { VibeKit } from "../packages/vibekit/src/index.js";
import { createE2BProvider } from "../packages/e2b/dist/index.js";

dotenv.config();

describe("VibeKit SDK", () => {
  it("should create working directory", async () => {
    const dir = "/var/vibe0";

    const e2bProvider = createE2BProvider({
      apiKey: process.env.E2B_API_KEY!,
      templateId: "vibekit-claude",
    });

    const vibeKit = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(e2bProvider)
      .withWorkingDirectory(dir);

    const result = await vibeKit.executeCommand("pwd");

    const pwd = result.stdout.trim();

    await vibeKit.kill();

    expect(pwd).toBe(dir);
  }, 60000);

  it("should download reposity", async () => {
    const dir = "/var/vibe0";

    const e2bProvider = createE2BProvider({
      apiKey: process.env.E2B_API_KEY!,
      templateId: "vibekit-claude",
    });

    const vibeKit = new VibeKit()
      .withAgent({
        type: "claude",
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: "claude-sonnet-4-20250514",
      })
      .withSandbox(e2bProvider)
      .withGithub({
        token: process.env.GITHUB_TOKEN!,
        repository: process.env.GITHUB_REPOSITORY!,
      })
      .withWorkingDirectory(dir);

    let gitUpdateReceived = false;

    vibeKit.on("update", (data) => {
      try {
        const parsedData = JSON.parse(data);
        if (
          parsedData.type === "git" &&
          parsedData.output === "Cloning repository: superagent-ai/signals"
        ) {
          gitUpdateReceived = true;
        }
      } catch {}
    });

    await vibeKit.generateCode("Hi there");

    await vibeKit.kill();

    expect(gitUpdateReceived).toBe(true);
  }, 60000);
});
