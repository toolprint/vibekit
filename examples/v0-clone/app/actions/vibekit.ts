"use server";
import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";

export async function createSession() {
  const config: VibeKitConfig = {
    agent: {
      type: "claude",
      model: {
        name: "claude-sonnet-4-20250514",
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
    },
    environment: {
      e2b: {
        apiKey: process.env.E2B_API_KEY!,
        templateId: "2a7ydfbc1fzhqtwaa6vu",
      },
    },
    github: {
      token: process.env.GITHUB_PERSONAL_TOKEN!,
      repository: "superagent-ai/vibekit-nextjs",
    },
  };

  const vibekit = new VibeKit(config);

  await vibekit.executeCommand(
    "git clone https://github.com/superagent-ai/vibekit-nextjs.git",
    {
      callbacks: {
        onUpdate: (data) => console.log("Clone update:", data),
        onError: (error) => console.log("Clone error:", error),
      },
    }
  );

  await vibekit.executeCommand("npm i", {
    useRepoContext: true,
    callbacks: {
      onUpdate: (data) => console.log("Install update:", data),
      onError: (error) => console.log("Install error:", error),
    },
  });

  await vibekit.executeCommand(
    `ngrok config add-authtoken ${process.env.NGROK_AUTH_TOKEN}`
  );

  await vibekit.executeCommand("npm run dev", {
    useRepoContext: true,
    background: true,
    callbacks: {
      onUpdate: (data) => console.log("Dev server update:", data),
      onError: (error) => console.log("Dev server error:", error),
    },
  });

  await vibekit.executeCommand("ngrok http 3000", {
    useRepoContext: true,
    background: true,
    callbacks: {
      onUpdate: (data) => console.log("Ngrok server update:", data),
      onError: (error) => console.log("Ngrok server error:", error),
    },
  });

  const tunnel = await vibekit.executeCommand(
    `ngrok api tunnels list --api-key ${process.env.NGROK_API_KEY}`,
    {
      callbacks: {
        onUpdate: (data) => console.log("Ngrok server update:", data),
        onError: (error) => console.log("Ngrok server error:", error),
      },
    }
  );

  return JSON.parse(tunnel.stdout);
}
