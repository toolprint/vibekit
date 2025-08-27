import { SandboxInstance as BlaxelNativeSandbox } from "@blaxel/core";

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
    agentType?: "codex" | "claude" | "opencode" | "gemini" | "grok",
    workingDirectory?: string
  ): Promise<SandboxInstance>;
  resume(sandboxId: string): Promise<SandboxInstance>;
}

export type AgentType = "codex" | "claude" | "opencode" | "gemini" | "grok";

export interface BlaxelConfig {
  apiKey?: string;           // Optional - Blaxel supports multiple auth methods
  workspace?: string;        // BL_WORKSPACE environment variable
  defaultImage?: string;     // Default: "blaxel/prod-base:latest"
}

// Blaxel implementation
export class BlaxelSandboxInstance implements SandboxInstance {
  private blaxelSandbox: BlaxelNativeSandbox;
  private sandboxName: string;
  private envVars: Record<string, string>;
  
  constructor(sandbox: BlaxelNativeSandbox, name: string, envVars: Record<string, string> = {}) {
    this.blaxelSandbox = sandbox;
    this.sandboxName = name;
    this.envVars = envVars;
  }
  
  get sandboxId(): string {
    // Return the sandbox name as ID
    return this.sandboxName;
  }
  
  get commands(): SandboxCommands {
    return {
      run: async (command: string, options?: SandboxCommandOptions) => {
        // Generate a unique process name for tracking
        const processName = `vibekit-process-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Start streaming logs if callbacks are provided
        let logStream: { close: () => void } | null = null;
        
        try {
          if (options?.onStdout || options?.onStderr) {
            logStream = this.blaxelSandbox.process.streamLogs(processName, {
              onStdout: options.onStdout,
              onStderr: options.onStderr
            });
          }
          
          // Execute command using Blaxel's process API
          const result = await this.blaxelSandbox.process.exec({
            command,
            name: processName,
            env: this.envVars,
            waitForCompletion: !options?.background,
            timeout: options?.timeoutMs ? Math.min(options.timeoutMs / 1000, 100) : 60
          });
          
          // Handle background processes
          if (options?.background) {
            // For background processes, logs may be available immediately or later
            if (options.onStdout && result.logs) {
              // Split logs by lines and call stdout callback
              options.onStdout(result.logs);
            }
            
            // Note: Don't close stream for background processes as they may continue logging
            return {
              exitCode: 0,
              stdout: "Process started in background",
              stderr: ""
            };
          }
          
          // Close the log stream after process completion
          if (logStream) {
            logStream.close();
          }
          
          // Map Blaxel response to expected format
          // Blaxel has 'logs' field instead of separate stdout/stderr
          return {
            exitCode: result.exitCode || 0,
            stdout: result.logs || "",
            stderr: "" // Blaxel combines stdout/stderr in logs field
          };
        } catch (error) {
          // Close the log stream on error
          try {
            if (logStream) {
              logStream.close();
            }
          } catch (streamError) {
            // Ignore stream cleanup errors
          }
          
          // Handle errors
          return {
            exitCode: 1,
            stdout: "",
            stderr: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }
  
  async kill(): Promise<void> {
    // Use the static delete method with the sandbox name
    try {
      await BlaxelNativeSandbox.delete(this.sandboxName);
    } catch (error) {
      // Ignore errors if sandbox is already deleted
      console.warn("Error deleting sandbox:", error);
    }
  }
  
  async pause(): Promise<void> {
    // Blaxel doesn't have pause, but we can stop the sandbox
    // which puts it in a stopped state (no charges)
    console.warn("Pause not directly supported by Blaxel, sandbox will remain active");
    // Note: This may need adjustment based on Blaxel's actual API
    // await this.blaxelSandbox.stop(); // If available in future
  }
  
  async getHost(port: number): Promise<string> {
    // Get the sandbox URL with port
    // Blaxel sandboxes have URLs like: https://sandbox-name.blaxel.app:port
    const baseUrl = `https://${this.sandboxName}.blaxel.app`;
    return port === 443 ? baseUrl : `${baseUrl}:${port}`;
  }
}

export class BlaxelSandboxProvider implements SandboxProvider {
  private config: BlaxelConfig;
  
  constructor(config: BlaxelConfig) {
    this.config = config;
    // Set up authentication if provided
    if (config.apiKey) {
      process.env.BL_API_KEY = config.apiKey;
    }
    if (config.workspace) {
      process.env.BL_WORKSPACE = config.workspace;
    }
  }
  
  async create(
    envs?: Record<string, string>,
    agentType?: AgentType,
    workingDirectory?: string
  ): Promise<SandboxInstance> {
    // Generate unique sandbox name
    const sandboxName = `vibekit-${agentType || 'sandbox'}-${Date.now()}`;
    
    // Determine image based on agent type
    const image = this.getImageForAgent(agentType);
    
    // Create Blaxel sandbox with TTL
    const sandbox = await BlaxelNativeSandbox.create({
      name: sandboxName,
      image,
      memory: this.getMemoryForAgent(agentType),
      ttl: "10m", // Keep sandbox alive for 10 minutes
      ports: [
        { target: 3000, protocol: "HTTP" },
        { target: 5000, protocol: "HTTP" },
        { target: 8000, protocol: "HTTP" }
      ]
    });
    
    // Wait for sandbox to be ready
    await sandbox.wait();
    
    // Environment variables will be passed per command execution
    
    // Set up working directory if specified
    if (workingDirectory) {
      await sandbox.process.exec({
        command: `mkdir -p ${workingDirectory} && cd ${workingDirectory}`,
        waitForCompletion: true
      });
    }
    
    return new BlaxelSandboxInstance(sandbox, sandboxName, envs || {});
  }
  
  async resume(sandboxId: string): Promise<SandboxInstance> {
    // Get existing sandbox by name
    const sandbox = await BlaxelNativeSandbox.get(sandboxId);
    
    // Ensure sandbox is active
    await sandbox.wait();
    
    return new BlaxelSandboxInstance(sandbox, sandboxId, {});
  }
  
  private getImageForAgent(agentType?: AgentType): string {
    // Use defaultImage if explicitly configured, otherwise fall back to agent-specific images
    if (this.config.defaultImage) {
      return this.config.defaultImage;
    }
    
    const imageMap: Record<AgentType, string> = {
      claude: "blaxel/prod-base:latest",
      codex: "blaxel/prod-base:latest",
      opencode: "blaxel/prod-base:latest",
      gemini: "blaxel/prod-base:latest",
      grok: "blaxel/prod-base:latest"
    };
    
    return agentType ? imageMap[agentType] : "blaxel/prod-base:latest";
  }
  
  private getMemoryForAgent(agentType?: AgentType): number {
    // Memory in MB based on agent complexity
    const memoryMap: Record<AgentType, number> = {
      claude: 8192,
      codex: 4096,
      opencode: 4096,
      gemini: 6144,
      grok: 4096
    };
    
    return agentType ? memoryMap[agentType] : 4096;
  }
}

// Main factory function for Blaxel
export function createBlaxelProvider(config: BlaxelConfig): BlaxelSandboxProvider {
  return new BlaxelSandboxProvider(config);
}

// Backward compatibility exports
export function createE2BProvider(config: BlaxelConfig): BlaxelSandboxProvider {
  console.warn('createE2BProvider is deprecated, use createBlaxelProvider instead');
  return new BlaxelSandboxProvider(config);
}

// Export legacy types for backward compatibility
export type E2BConfig = BlaxelConfig;
export const E2BSandboxInstance = BlaxelSandboxInstance;
export const E2BSandboxProvider = BlaxelSandboxProvider;
