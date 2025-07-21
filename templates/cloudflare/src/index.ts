import { createCloudflareProvider } from "@vibe-kit/cloudflare";
import { VibeKit } from "@vibe-kit/sdk";
import { env } from "cloudflare:workers";
import { Hono } from "hono";
export { Sandbox } from "@cloudflare/sandbox";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const vibeKit = new VibeKit()
  .withAgent({
    type: "claude",
    provider: "anthropic",
    apiKey: env.ANTHROPIC_API_KEY,
    model: "claude-sonnet-4-20250514",
  });

app.get("/message", async (c) => {
  const cloudflareProvider = createCloudflareProvider({
    env: c.env,
  });
  const vk = vibeKit.withSandbox(cloudflareProvider);

  const result = await vk.generateCode({
    prompt: "Say hello back!",
    mode: "ask",
  })
  return c.text(result.stdout);
});

export default app;
