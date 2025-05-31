// AGENTS
export type AgentType = "codex" | "claude";

export type AgentMode = "ask" | "code";

export type AgentModel = {
  name?: string;
  apiKey: string;
};

export type EnvironmentConfig = {
  e2bApiKey: string;
  e2bTemplateId?: string;
};

export type GithubConfig = {
  token: string;
  repository: string;
};

export type AgentConfig = {
  agent: {
    type: AgentType;
    model: AgentModel;
    mode: AgentMode;
  };
  environment: EnvironmentConfig;
  github: GithubConfig;
  sessionId?: string;
};

// CONVERSATION HISTORY
export type Conversation = {
  role: "user" | "assistant";
  content: string;
};

// STREAMING CALLBACKS
export interface CodexStreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}

// CODEX CONFIG
export interface CodexConfig {
  openaiApiKey: string;
  githubToken: string;
  repoUrl: string; // org/repo, e.g. "octocat/hello-world"
  e2bApiKey: string;
  e2bTemplateId?: string;
  model?: string;
  sandboxId?: string;
}

export interface CodexResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxId: string;
  patch?: string;
  patchApplyScript?: string;
  branchName?: string;
  commitSha?: string;
}
