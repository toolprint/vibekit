import { proxyToSandbox } from "@cloudflare/sandbox";
import { createCloudflareProvider } from "@vibe-kit/cloudflare";
import { VibeKit } from "@vibe-kit/sdk";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
export { Sandbox } from "@cloudflare/sandbox";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Create middleware using createMiddleware for proper TypeScript support
const sandboxProxyMiddleware = createMiddleware(async (c, next) => {
  // Check if this is a request to a sandbox preview URL
  const proxyResponse = await proxyToSandbox(c.req.raw, c.env)
  if (proxyResponse) {
    return proxyResponse
  }

  // Continue to next middleware/route
  await next()
})

// Apply the middleware
app.use('*', sandboxProxyMiddleware)

app.get("/", async (c) => {
  return c.text("Welcome to Vibekit + Cloudflare! Hit /message to generate a new project.");
})

app.get("/message", async (c) => {
  const cloudflareProvider = createCloudflareProvider({
    env: c.env,
    hostname: c.req.header("host")!,
  });
  const vibeKit = new VibeKit()
    .withSandbox(cloudflareProvider)
    .withAgent({
      type: "claude",
      provider: "anthropic",
      apiKey: c.env.ANTHROPIC_API_KEY,
      model: "claude-3-5-haiku-20241022",
    });

  // Set up event listeners
  // @ts-ignore
  vibeKit.on('update', (message) => {
    console.log('Update:', message);
  });

  // @ts-ignore
  vibeKit.on('error', (error) => {
    console.error('Error:', error);
  });

  await vibeKit.generateCode({
    prompt: `Run 'bun init -r' to create a new bun + react project. Then, set 'port: 3001' in the serve config within index.tsx. That's it.`,
    mode: "code",
  });
  await vibeKit.executeCommand("bun run dev", { background: true });
  const host = await vibeKit.getHost(3001);

  return c.text(host);
});

export default app;
