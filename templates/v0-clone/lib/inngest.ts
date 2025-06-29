import { Inngest } from "inngest";
import { realtimeMiddleware, channel, topic } from "@inngest/realtime";
import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";
import { fetchMutation } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { runAgentAction } from "@/app/actions/vibekit";

let app: Inngest | undefined;
// Create a client to send and receive events
export const inngest = new Inngest({
  id: "vibe0",
  middleware: [realtimeMiddleware()],
});

export const sessionChannel = channel("sessions")
  .addTopic(
    topic("status").type<{
      status:
        | "IN_PROGRESS"
        | "CLONING_REPO"
        | "INSTALLING_DEPENDENCIES"
        | "STARTING_DEV_SERVER"
        | "CREATING_TUNNEL"
        | "RUNNING";
      sessionId: string;
      id: string;
    }>()
  )
  .addTopic(
    topic("update").type<{
      sessionId: string;
      message: Record<string, unknown>;
    }>()
  );

export const getInngestApp = () => {
  return (app ??= new Inngest({
    id: typeof window !== "undefined" ? "client" : "server",
    middleware: [realtimeMiddleware()],
  }));
};

export const runAgent = inngest.createFunction(
  { id: "run-agent", retries: 0, concurrency: 100 },
  { event: "vibe0/run.agent" },
  async ({ event, step }) => {
    const { sessionId, id, message } = event.data;

    const config: VibeKitConfig = {
      agent: {
        type: "claude",
        model: {
          apiKey: process.env.ANTHROPIC_API_KEY!,
        },
      },
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY!,
        },
      },
    };

    const result = await step.run("generate code", async () => {
      const vibekit = new VibeKit(config);

      if (sessionId) {
        await vibekit.setSession(sessionId);
      }

      await fetchMutation(api.sessions.update, {
        id,
        status: "CUSTOM",
        statusMessage: "Working on task...",
      });

      const prompt =
        "# GOAL\nYou are an helpful assistant that is tasked with helping the user build a NextJS app.\n" +
        "The NextJS dev server is running on port 3000.\n" +
        "ShadCN UI is installed, togehter with all the ShadCN components.\n" +
        "Do not run tests or restart the dev server.\n" +
        `Follow the users intructions:\n\n# INSTRUCTIONS\n${message}`;

      const response = await vibekit.generateCode({
        prompt: prompt,
        mode: "code",
        callbacks: {
          async onUpdate(message) {
            console.log(message);
            const data = JSON.parse(message);

            if (data.type !== "assistant") return;

            switch (data.message.content[0].type) {
              case "text":
                await fetchMutation(api.messages.add, {
                  sessionId: id,
                  content: data.message.content[0].text,
                  role: "assistant",
                });
                break;
              case "tool_use":
                const toolName = data.message.content[0].name;

                switch (toolName) {
                  case "TodoWrite":
                    await fetchMutation(api.messages.add, {
                      sessionId: id,
                      role: "assistant",
                      content: "",
                      todos: data.message.content[0].input.todos,
                    });
                    break;
                  case "Write":
                    await fetchMutation(api.messages.add, {
                      sessionId: id,
                      role: "assistant",
                      content: "",
                      edits: {
                        filePath: data.message.content[0].input.file_path,
                        oldString: "",
                        newString: data.message.content[0].input.content,
                      },
                    });
                    break;
                  case "Edit":
                    await fetchMutation(api.messages.add, {
                      sessionId: id,
                      role: "assistant",
                      content: "",
                      edits: {
                        filePath: data.message.content[0].input.file_path,
                        oldString: data.message.content[0].input.old_string,
                        newString: data.message.content[0].input.new_string,
                      },
                    });
                    break;
                  case "Read":
                    await fetchMutation(api.messages.add, {
                      sessionId: id,
                      role: "assistant",
                      content: "",
                      read: {
                        filePath: data.message.content[0].input.file_path,
                      },
                    });
                    break;
                  case "Write":
                    await fetchMutation(api.messages.add, {
                      sessionId: id,
                      role: "assistant",
                      content: "",
                      read: {
                        filePath: data.message.content[0].input.file_path,
                      },
                    });
                  default:
                    break;
                }
                break;
              default:
                break;
            }
          },
        },
      });

      return response;
    });

    await step.run("update session", async () => {
      await fetchMutation(api.sessions.update, {
        id,
        status: "RUNNING",
      });
    });

    return result;
  }
);

export const createSession = inngest.createFunction(
  { id: "create-session", retries: 0, concurrency: 100 },
  { event: "vibe0/create.session" },

  async ({ event, step }) => {
    const { sessionId: id, message } = event.data;

    const config: VibeKitConfig = {
      agent: {
        type: "claude",
        model: {
          apiKey: process.env.ANTHROPIC_API_KEY!,
        },
      },
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY!,
          templateId: process.env.E2B_TEMPLATE_ID!,
        },
      },
      github: {
        token: process.env.GITHB_PERSONAL_TOKEN!,
        repository: "superagent-ai/vibekit-nextjs",
      },
    };

    const vibekit = new VibeKit(config);

    const data = await step.run("get tunnel url", async () => {
      await fetchMutation(api.sessions.update, {
        id,
        status: "CLONING_REPO",
      });

      const clone = await vibekit.executeCommand(
        "git clone https://github.com/superagent-ai/vibekit-nextjs.git"
      );

      await fetchMutation(api.sessions.update, {
        id,
        status: "INSTALLING_DEPENDENCIES",
        sessionId: clone.sandboxId,
      });

      await vibekit.executeCommand("npm i", {
        useRepoContext: true,
      });

      await fetchMutation(api.sessions.update, {
        id,
        status: "STARTING_DEV_SERVER",
      });

      await vibekit.executeCommand("npm run dev", {
        useRepoContext: true,
        background: true,
      });

      // E2B sandboxes have built-in public URLs - no tunneling needed
      const host = await vibekit.getHost(3000);

      return {
        sandboxId: clone.sandboxId,
        tunnelUrl: `https://${host}`,
      };
    });

    await step.run("update session", async () => {
      await fetchMutation(api.sessions.update, {
        id,
        status: "RUNNING",
        tunnelUrl: data.tunnelUrl,
      });
    });

    if (message) {
      await step.run("run agent", async () => {
        await runAgentAction(data.sandboxId, id, message);
      });
    }

    return data;
  }
);
