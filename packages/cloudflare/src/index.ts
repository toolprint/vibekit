import { getSandbox, type Sandbox, type SandboxEnv } from "@cloudflare/sandbox";

// Define the interfaces we need from the SDK
export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SandboxCommandOptions {
  timeoutMs?: number;
  background?: boolean;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface SandboxCommands {
  run(
    command: string,
    options?: SandboxCommandOptions
  ): Promise<SandboxExecutionResult>;
}

export interface SandboxInstance {
  sandboxId: string;
  commands: SandboxCommands;
  kill(): Promise<void>;
  pause(): Promise<void>;
  getHost(port: number): Promise<string>;
}

export interface SandboxProvider {
  create(
    envs?: Record<string, string>,
    agentType?: "codex" | "claude" | "opencode" | "gemini",
    workingDirectory?: string
  ): Promise<SandboxInstance>;
  resume(sandboxId: string): Promise<SandboxInstance>;
}

export type AgentType = "codex" | "claude" | "opencode" | "gemini";

export interface CloudflareConfig {
  env: SandboxEnv;
}

const defaultErrorResponse: SandboxExecutionResult = {
  exitCode: 1,
  stdout: "",
  stderr: "Failed to execute command in Cloudflare sandbox"
};

// Cloudflare implementation
export class CloudflareSandboxInstance implements SandboxInstance {
  constructor(
    private sandbox: Sandbox,
    public sandboxId: string
  ) { }

  get commands(): SandboxCommands {
    return {
      run: async (command: string, options?: SandboxCommandOptions) => {
        const { background } = options || {};
        if (background) {
          const response = await this.sandbox.exec(command, [], { background: true });
          return response ? {
            exitCode: 0,
            stdout: "Background command started successfully",
            stderr: ""
          } : defaultErrorResponse;
        }

        const response = await this.sandbox.exec(command, []);
        return response ?? defaultErrorResponse;
      },
    };
  }

  async kill(): Promise<void> {
    await this.sandbox.destroy();
  }

  async pause(): Promise<void> {
    await this.sandbox.stop();
  }

  async getHost(port: number): Promise<string> {
    const response = await this.sandbox.exposePort(port);
    return response.url;
  }
}

export class CloudflareSandboxProvider implements SandboxProvider {
  constructor(private config: CloudflareConfig) { }

  async create(
    envs?: Record<string, string>,
    agentType?: AgentType,
    workingDirectory?: string
  ): Promise<SandboxInstance> {
    if (!this.config.env || !this.config.env.Sandbox) {
      throw new Error(
        `Cloudflare Durable Object binding "Sandbox" not found. ` +
        `Make sure you're running within a Cloudflare Worker and the binding is configured in wrangler.json/toml`
      );
    }

    // Generate a unique sandbox ID
    const sandboxId = `vibekit-${agentType || 'default'}-${Date.now()}`;

    // Get or create a sandbox instance using the SDK
    const sandbox = getSandbox(this.config.env.Sandbox, sandboxId) as Sandbox;
    sandbox.setEnvVars(envs || {});
    await sandbox.exec(`sudo mkdir -p ${workingDirectory} && sudo chown $USER:$USER ${workingDirectory}`, []);

    return new CloudflareSandboxInstance(sandbox, sandboxId);
  }

  async resume(sandboxId: string): Promise<SandboxInstance> {
    const sandbox = getSandbox(this.config.env.Sandbox, sandboxId) as Sandbox;
    return new CloudflareSandboxInstance(sandbox, sandboxId);
  }
}

export function createCloudflareProvider(
  config: CloudflareConfig
): CloudflareSandboxProvider {
  return new CloudflareSandboxProvider(config);
}
