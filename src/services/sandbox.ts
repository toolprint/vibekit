import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";
import { Daytona, DaytonaConfig } from "@daytonaio/sdk";

import {
  SandboxInstance,
  SandboxConfig,
  SandboxProvider,
  SandboxCommands,
  SandboxCommandOptions,
  SandboxExecutionResult,
} from "../types";

// E2B implementation
export class E2BSandboxInstance implements SandboxInstance {
  constructor(private sandbox: E2BSandbox) {}

  get sandboxId(): string {
    return this.sandbox.sandboxId;
  }

  get commands(): SandboxCommands {
    return {
      run: async (command: string, options?: SandboxCommandOptions) => {
        return await this.sandbox.commands.run(command, options);
      },
    };
  }

  async kill(): Promise<void> {
    await this.sandbox.kill();
  }

  async pause(): Promise<void> {
    await this.sandbox.pause();
  }
}

export class E2BSandboxProvider implements SandboxProvider {
  async create(
    config: SandboxConfig,
    envs?: Record<string, string>
  ): Promise<SandboxInstance> {
    const sandbox = await E2BSandbox.create(
      config.templateId || "vibekit-codex",
      {
        envs,
        apiKey: config.apiKey,
      }
    );
    return new E2BSandboxInstance(sandbox);
  }

  async resume(
    sandboxId: string,
    config: SandboxConfig
  ): Promise<SandboxInstance> {
    const sandbox = await E2BSandbox.resume(sandboxId, {
      apiKey: config.apiKey,
    });
    return new E2BSandboxInstance(sandbox);
  }
}

// Daytona implementation
class DaytonaSandboxInstance implements SandboxInstance {
  constructor(
    private workspace: any, // Daytona workspace object
    private daytona: any, // Daytona client
    public sandboxId: string,
    private envs?: Record<string, string> // Store environment variables
  ) {}

  get commands(): SandboxCommands {
    return {
      run: async (command: string, options?: SandboxCommandOptions) => {
        try {
          // Execute command using Daytona's process execution API
          // Format: executeCommand(command, cwd?, env?, timeout?)
          const response = await this.workspace.process.executeCommand(
            command,
            undefined, // cwd - use default working directory
            this.envs, // env - use instance environment variables
            (options?.timeoutMs || 360000) / 1000 // timeout in seconds, default 6 minutes
          );

          // Handle streaming callbacks if provided
          if (options?.onStdout && response.result) {
            options.onStdout(response.result);
          }
          if (options?.onStderr && response.stderr) {
            options.onStderr(response.stderr);
          }

          // Daytona returns: { exitCode, result, stderr, artifacts }
          return {
            exitCode: response.exitCode || 0,
            stdout: response.result || "",
            stderr: response.stderr || "",
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (options?.onStderr) {
            options.onStderr(errorMessage);
          }
          return {
            exitCode: 1,
            stdout: "",
            stderr: errorMessage,
          };
        }
      },
    };
  }

  async kill(): Promise<void> {
    if (this.daytona && this.workspace) {
      await this.daytona.remove(this.workspace);
    }
  }

  async pause(): Promise<void> {
    // Daytona doesn't have a direct pause equivalent
    console.log(
      "Pause not directly supported for Daytona sandboxes - workspace remains active"
    );
  }
}

export class DaytonaSandboxProvider implements SandboxProvider {
  async create(
    config: SandboxConfig,
    envs?: Record<string, string>
  ): Promise<SandboxInstance> {
    try {
      // Dynamic import to avoid dependency issues if daytona-sdk is not installed
      const daytonaConfig: DaytonaConfig = {
        apiKey: config.apiKey,
        apiUrl: config.serverUrl || "https://app.daytona.io",
      };

      const daytona = new Daytona(daytonaConfig);

      // Create workspace with specified image or default
      const workspace = await daytona.create({
        image: config.image || "ubuntu:22.04",
      });

      // Set up environment variables if provided
      if (envs && Object.keys(envs).length > 0) {
        for (const [key, value] of Object.entries(envs)) {
          await workspace.process.executeCommand(`export ${key}="${value}"`);
        }
      }

      return new DaytonaSandboxInstance(workspace, daytona, workspace.id, envs);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot resolve module")
      ) {
        throw new Error(
          "Daytona SDK not found. Please install daytona-sdk: npm install daytona-sdk"
        );
      }
      throw new Error(
        `Failed to create Daytona sandbox: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async resume(
    sandboxId: string,
    config: SandboxConfig
  ): Promise<SandboxInstance> {
    try {
      const daytonaConfig: DaytonaConfig = {
        apiKey: config.apiKey,
        apiUrl: config.serverUrl || "https://app.daytona.io",
      };

      const daytona = new Daytona(daytonaConfig);

      // Resume workspace by ID
      const workspace = await daytona.get(sandboxId);

      return new DaytonaSandboxInstance(
        workspace,
        daytona,
        sandboxId,
        undefined
      );
    } catch (error) {
      throw new Error(
        `Failed to resume Daytona sandbox: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

// Factory function to create appropriate sandbox provider
export function createSandboxProvider(
  type: "e2b" | "daytona"
): SandboxProvider {
  switch (type) {
    case "e2b":
      return new E2BSandboxProvider();
    case "daytona":
      return new DaytonaSandboxProvider();
    default:
      throw new Error(`Unsupported sandbox type: ${type}`);
  }
}

// Helper function to create SandboxConfig from VibeKitConfig environment
export function createSandboxConfigFromEnvironment(
  environment: any
): SandboxConfig {
  // Try Daytona first if configured
  if (environment.daytona) {
    return {
      type: "daytona",
      apiKey: environment.daytona.apiKey,
      image: environment.daytona.image,
      serverUrl: environment.daytona.serverUrl,
    };
  }

  // Fall back to E2B if configured
  if (environment.e2b) {
    return {
      type: "e2b",
      apiKey: environment.e2b.apiKey,
      templateId: environment.e2b.templateId,
    };
  }

  throw new Error("No sandbox configuration found in environment config");
}
