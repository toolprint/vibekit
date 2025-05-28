import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, LanguageModel } from "ai";
import { z } from "zod";

export async function generatePRMetadata(
  patch: string,
  agent: "codex" | "claude",
  apiKey: string,
  prompt: string
) {
  const _prompt = `You are tasked to create title and body for a pull request based on the following task:\n${prompt}\n\npatch:\n\n${patch}`;
  const model =
    agent === "codex" ? createOpenAI({ apiKey }) : createAnthropic({ apiKey });

  const { object } = await generateObject({
    model:
      agent === "codex"
        ? model("gpt-4o-mini")
        : model("claude-3-5-sonnet-20240620"),
    prompt: _prompt,
    schema: z.object({
      title: z.string().describe("Suggested title for the pull request"),
      body: z.string().describe("Suggested body for the pull request"),
      branchName: z
        .string()
        .describe(
          "Suggested branch name, should start with `codex/` and be unique"
        ),
      commitMessage: z
        .string()
        .describe("Suggested commit message for the pull request"),
    }),
  });

  return object;
}
