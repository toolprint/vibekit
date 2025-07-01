"use server";
import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";
import { inngest } from "@/lib/inngest";
import { auth } from "@/lib/auth";

export async function runAgentAction(
  sessionId: string,
  id: string,
  message: string
) {
  await inngest.send({
    name: "vibe0/run.agent",
    data: {
      sessionId,
      id,
      message,
    },
  });
}

export async function createSessionAction({
  sessionId,
  message,
  repository,
  template,
}: {
  sessionId: string;
  message?: string;
  repository?: string;
  template?: string;
}) {
  const session = await auth();
  await inngest.send({
    name: "vibe0/create.session",
    data: {
      sessionId,
      message,
      repository,
      token: session?.accessToken,
      template,
    },
  });
}

export async function deleteSessionAction(sessionId: string) {
  const config: VibeKitConfig = {
    agent: {
      type: "claude",
      model: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
    },
    environment: {
      northflank: {
        apiKey: process.env.NORTHFLANK_API_KEY!,
        projectId: process.env.NORTHFLANK_PROJECT_ID!,
      },
    },
    sessionId,
  };

  const vibekit = new VibeKit(config);

  await vibekit.setSession(sessionId);

  await vibekit.kill();
}
