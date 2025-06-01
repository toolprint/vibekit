// AGENTS
export type AgentType = "codex" | "claude";

export type AgentMode = "ask" | "code";

export type AgentModel = {
  name?: string;
  apiKey: string;
};

export type E2BConfig = {
  apiKey: string;
  templateId?: string;
};

export type DaytonaConfig = {
  apiKey: string;
  image?: string;
  serverUrl?: string;
};

export type EnvironmentConfig = {
  e2b?: E2BConfig;
  daytona?: DaytonaConfig;
};

export type GithubConfig = {
  token: string;
  repository: string;
};

// TELEMETRY
export type TelemetryConfig = {
  /** Enable or disable telemetry */
  isEnabled: boolean;
  /** OTLP HTTP endpoint for traces (e.g., "https://api.honeycomb.io/v1/traces") */
  endpoint?: string;
  /** Service name for resource attributes (defaults to "vibekit") */
  serviceName?: string;
  /** Service version for resource attributes (defaults to "1.0.0") */
  serviceVersion?: string;
  /** Additional headers for OTLP HTTP requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (defaults to 5000) */
  timeout?: number;
  /** Sampling ratio from 0.0 to 1.0 (defaults to 1.0 for 100% sampling) */
  samplingRatio?: number;
  /** Additional resource attributes to include in telemetry data */
  resourceAttributes?: Record<string, string>;
};

export type AgentConfig = {
  agent: {
    type: AgentType;
    model: AgentModel;
    mode: AgentMode;
  };
  environment: EnvironmentConfig;
  github: GithubConfig;
  telemetry?: TelemetryConfig;
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
  telemetry?: TelemetryConfig;
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
