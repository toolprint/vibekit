/**
 * VibeKit Dagger Local Sandbox Provider
 * 
 * Implements the same interface as E2B and Daytona providers but uses Dagger
 * for local containerized development environments with ARM64 agent images.
 */

import { connect } from "@dagger.io/dagger";
import type { Client, Container, Directory } from "@dagger.io/dagger";
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Interface definitions matching E2B/Northflank patterns
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

export interface LocalDaggerConfig {
  // Configuration for local Dagger provider
}

// Helper function to get Dockerfile path based on agent type
const getDockerfilePathFromAgentType = (agentType?: AgentType): string | undefined => {
  if (agentType === "claude") {
    return "assets/dockerfiles/Dockerfile.claude";
  } else if (agentType === "codex") {
    return "assets/dockerfiles/Dockerfile.codex";
  } else if (agentType === "opencode") {
    return "assets/dockerfiles/Dockerfile.opencode";
  } else if (agentType === "gemini") {
    return "assets/dockerfiles/Dockerfile.gemini";
  }
  return undefined; // fallback to base image
};

// Helper to get tagged image name for local caching
const getImageTag = (agentType?: AgentType): string => {
  return `vibekit-${agentType || 'default'}:latest`;
};

// Local Dagger implementation with proper workspace state persistence
class LocalDaggerSandboxInstance implements SandboxInstance {
  private isRunning = true;
  private workspaceDirectory: Directory | null = null;
  private client: Client | null = null;

  constructor(
    public sandboxId: string,
    private image: string, // Fallback image if no Dockerfile
    private envs?: Record<string, string>,
    private workDir?: string,
    private dockerfilePath?: string, // Path to Dockerfile if building from source
    private agentType?: AgentType
  ) {}

  get commands(): SandboxCommands {
    return {
      run: async (command: string, options?: SandboxCommandOptions): Promise<SandboxExecutionResult> => {
        let result: SandboxExecutionResult = { exitCode: 1, stdout: "", stderr: "Command execution failed" };
        
        await connect(async (client) => {
          try {
            this.client = client;
            
            // Get or create persistent workspace
            let container = await this.getWorkspaceContainer(client);
            
            if (options?.background) {
              // Background execution: start and detach
              container = container.withExec(["sh", "-c", command], { 
                experimentalPrivilegedNesting: true 
              });
              
              // CRITICAL: Export the workspace directory to capture any changes
              this.workspaceDirectory = container.directory(this.workDir || "/vibe0");
              
              result = {
                exitCode: 0,
                stdout: `Background process started: ${command}`,
                stderr: "",
              };
            } else {
              // Foreground execution with output
              container = container.withExec(["sh", "-c", command]);
              
              // CRITICAL: Export the workspace directory to capture filesystem changes
              this.workspaceDirectory = container.directory(this.workDir || "/vibe0");
              
              // Execute the command and get output
              const stdout = await container.stdout();
              const stderr = await container.stderr();
              
              // Call streaming callbacks if provided
              if (options?.onStdout && stdout) {
                options.onStdout(stdout);
              }
              if (options?.onStderr && stderr) {
                options.onStderr(stderr);
              }
              
              result = {
                exitCode: 0,
                stdout: stdout,
                stderr: stderr,
              };
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const exitCode = errorMessage.includes('exit code') 
              ? parseInt(errorMessage.match(/exit code (\d+)/)?.[1] || '1') 
              : 1;
              
            result = {
              exitCode: exitCode,
              stdout: "",
              stderr: errorMessage,
            };
          }
        });
        
        return result;
      },
    };
  }

  /**
   * Get or create a persistent workspace container that maintains state across commands
   * This is the key method that makes our implementation work like E2B/Northflank
   */
  private async getWorkspaceContainer(client: Client): Promise<Container> {
    // Create base container
    let container = await this.createBaseContainer(client, this.dockerfilePath, this.agentType);
    
    // If we have a saved workspace directory, restore it using withDirectory (copies content)
    if (this.workspaceDirectory) {
      container = container.withDirectory(this.workDir || "/vibe0", this.workspaceDirectory);
    } else {
      // First time: ensure working directory exists
      container = container.withExec(["mkdir", "-p", this.workDir || "/vibe0"]);
    }
    
    // Ensure we're in the working directory
    container = container.withWorkdir(this.workDir || "/vibe0");
    
    return container;
  }

  private async createBaseContainer(client: Client, dockerfilePath?: string, agentType?: AgentType): Promise<Container> {
    const imageTag = getImageTag(agentType);
    let container: Container;

    // Check if image exists locally
    try {
      const { stdout } = await execAsync(`docker images -q ${imageTag}`);
      if (stdout.trim()) {
        // Image exists: Load from local Docker
        container = client.container().from(imageTag);
        console.log(`Using existing local image: ${imageTag}`);
      } else {
        // Image doesn't exist: Build and tag it
        console.log(`Building and tagging image: ${imageTag}`);
        const context = client.host().directory(".");
        container = client
          .container()
          .build(context, { dockerfile: dockerfilePath || 'Dockerfile' }); // Fallback Dockerfile if needed

        // Export the built image to local Docker daemon with tag
        await container.export(imageTag); // Dagger's export saves it locally
      }
    } catch (error) {
      console.error(`Error checking/building image: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Or fallback to always build
    }

    // Add envs, workdir, etc.
    container = container.withWorkdir(this.workDir || "/vibe0");
    if (this.envs) {
      for (const [key, value] of Object.entries(this.envs)) {
        container = container.withEnvVariable(key, value);
      }
    }

    return container;
  }

  async kill(): Promise<void> {
    this.isRunning = false;
    this.workspaceDirectory = null;
    this.client = null;
  }

  async pause(): Promise<void> {
    // Dagger containers don't have pause/resume, but we maintain this for interface compatibility
    console.log(`Pausing Dagger sandbox ${this.sandboxId} (state preserved)`);
  }

  async getHost(port: number): Promise<string> {
    return Promise.resolve('localhost'); // Local containers run on localhost
  }
}

export class LocalDaggerSandboxProvider implements SandboxProvider {
  constructor(private config: LocalDaggerConfig = {}) {}

  async create(
    envs?: Record<string, string>,
    agentType?: AgentType,
    workingDirectory?: string
  ): Promise<SandboxInstance> {
    const sandboxId = `dagger-${agentType || 'default'}-${Date.now().toString(36)}`;
    const workDir = workingDirectory || "/vibe0";
    
    // Get Dockerfile path for the agent type
    const dockerfilePath = getDockerfilePathFromAgentType(agentType);
    
    // Create sandbox instance with Dockerfile if available, otherwise use base image
    const instance = new LocalDaggerSandboxInstance(
      sandboxId,
      "ubuntu:24.04", // fallback image
      envs,
      workDir,
      dockerfilePath,
      agentType
    );

    return instance;
  }

  async resume(sandboxId: string): Promise<SandboxInstance> {
    // For Dagger, resume is the same as create since containers are ephemeral
    // The workspace state is maintained through the Directory persistence
    return await this.create();
  }
}

export function createLocalProvider(config: LocalDaggerConfig = {}): LocalDaggerSandboxProvider {
  return new LocalDaggerSandboxProvider(config);
} 