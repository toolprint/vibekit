"use server";
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

export async function createSessionAction(
  sessionId: string,
  message?: string,
  repository?: string
) {
  const session = await auth();

  await inngest.send({
    name: "vibe0/create.session",
    data: {
      sessionId,
      message,
      repository,
      token: session?.accessToken,
    },
  });
}
