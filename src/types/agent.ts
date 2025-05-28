export type AgentName = "codex" | "devin" | "claude" | "openhands" | "codegen";

export type AgentConfig =
  | {
      agent: "codex";
      config: {
        openaiApiKey: string;
        githubToken: string;
        repoUrl: string;
        e2bApiKey: string;
        e2bTemplateId?: string;
        model?: string;
        sandboxId?: string;
        /** Set to 'ask' to research the repository without modifying any files, or 'code' to generate code changes */
        mode?: 'ask' | 'code';
      };
    }
  | {
      agent: "claude";
      config: {
        anthropicApiKey: string;
        githubToken: string;
        repoUrl: string;
        e2bApiKey: string;
        e2bTemplateId: string;
      };
    }
  | {
      agent: "devin" | "codegen" | "openhands";
      config: {
        apiKey: string;
      };
    };
