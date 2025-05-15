export type AgentName = "codex" | "devin" | "claude" | "openhands" | "codegen";

export type AgentConfig =
  | {
      agent: "codex";
      config: {
        openaiApiKey: string;
        githubToken: string;
        repoUrl: string;
        e2bApiKey: string;
      };
    }
  | {
      agent: "claude";
      config: {
        anthropicApiKey: string;
        githubToken: string;
        repoUrl: string;
        e2bApiKey: string;
      };
    }
  | {
      agent: "devin" | "codegen" | "openhands";
      config: {
        apiKey: string;
      };
    };
