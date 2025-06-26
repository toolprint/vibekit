"use server";
import { inngest } from "@/lib/inngest";

export async function runAgentAction(sessionId: string, message: string) {
  await inngest.send({
    name: "vibe0/run.agent",
    data: {
      sessionId,
      message,
    },
  });
}

export async function createSessionAction(sessionId: string, message?: string) {
  await inngest.send({
    name: "vibe0/create.session",
    data: {
      sessionId,
      message,
    },
  });
}
