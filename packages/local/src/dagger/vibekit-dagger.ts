/**
 * VibeKit Dagger Local Sandbox Provider
 * 
 * Implements the same interface as E2B and Daytona providers but uses Dagger
 * for local containerized development environments with ARM64 agent images.
 */

import { connect } from "@dagger.io/dagger";
import type { Client, Container, Directory } from "@dagger.io/dagger";
import { Octokit } from "@octokit/rest";

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
  githubToken?: string;
}

export interface GitConfig {
  repoUrl: string;
  branch?: string;
  commitMessage?: string;
}

export interface PRConfig {
  title: string;
  body: string;
  headBranch: string;
  baseBranch?: string;
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

// Local Dagger implementation with proper workspace state persistence
class LocalDaggerSandboxInstance implements SandboxInstance {
  private isRunning = true;
  private octokit?: Octokit;
  private workspaceDirectory: Directory | null = null;
  private client: Client | null = null;

  constructor(
    public sandboxId: string,
    private image: string, // Fallback image if no Dockerfile
    private envs?: Record<string, string>,
    private workDir?: string,
    private githubToken?: string,
    private dockerfilePath?: string // Path to Dockerfile if building from source
  ) {
    if (githubToken) {
      this.octokit = new Octokit({ auth: githubToken });
    }
  }

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
    let container = this.createBaseContainer(client, this.dockerfilePath);
    
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

  private createBaseContainer(client: Client, dockerfilePath?: string): Container {
    let container: Container;

    if (dockerfilePath) {
      // Build from Dockerfile
      const context = client.host().directory(".");
      container = client
        .container()
        .build(context, { dockerfile: dockerfilePath })
        .withWorkdir(this.workDir || "/vibe0");
    } else {
      // Use the provided image
      container = client
        .container()
        .from(this.image)
        .withWorkdir(this.workDir || "/vibe0");
    }

    // Add environment variables
    if (this.envs) {
      for (const [key, value] of Object.entries(this.envs)) {
        container = container.withEnvVariable(key, value);
      }
    }

    // Add GitHub token for git operations
    if (this.githubToken) {
      container = container.withEnvVariable("GITHUB_TOKEN", this.githubToken);
    }

    return container;
  }

  // File operations for git workflow
  async readFile(path: string): Promise<string> {
    let content = "";
    await connect(async (client) => {
      const container = await this.getWorkspaceContainer(client);
      content = await container.file(path).contents();
    });
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await connect(async (client) => {
      let container = await this.getWorkspaceContainer(client);
      container = container.withNewFile(path, content);
      // CRITICAL: Export the workspace directory to persist the file write
      this.workspaceDirectory = container.directory(this.workDir || "/vibe0");
    });
  }

  async getChangedFiles(): Promise<string[]> {
    const result = await this.commands.run('git diff --name-only');
    return result.stdout.split('\n').filter(line => line.trim());
  }

  async createBranch(branchName: string): Promise<SandboxExecutionResult> {
    return await this.commands.run(`git checkout -b ${branchName}`);
  }

  async commitChanges(message: string): Promise<SandboxExecutionResult> {
    await this.commands.run('git add .');
    return await this.commands.run(`git commit -m "${message}"`);
  }

  async pushChanges(branchName: string): Promise<SandboxExecutionResult> {
    return await this.commands.run(`git push origin ${branchName}`);
  }

  // GitHub API integration for PR creation
  async createPullRequest(prConfig: PRConfig): Promise<{ success: boolean; prUrl?: string; error?: string }> {
    if (!this.octokit || !this.githubToken) {
      return { success: false, error: "GitHub token not configured" };
    }

    try {
      // Extract owner/repo from current git remote
      const remoteResult = await this.commands.run('git remote get-url origin');
      const repoMatch = remoteResult.stdout.match(/github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/);
      
      if (!repoMatch) {
        return { success: false, error: "Could not determine GitHub repository from git remote" };
      }

      const [, owner, repo] = repoMatch;

      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title: prConfig.title,
        body: prConfig.body,
        head: prConfig.headBranch,
        base: prConfig.baseBranch || 'main',
      });

      return {
        success: true,
        prUrl: response.data.html_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async cloneRepository(gitConfig: GitConfig): Promise<SandboxExecutionResult> {
    // Set basic global git config
    await this.commands.run('git config --global init.defaultBranch main');
    
    // If we have a GitHub token, modify the URL to include authentication
    let cloneUrl = gitConfig.repoUrl;
    if (this.githubToken && gitConfig.repoUrl.includes('github.com')) {
      // Convert github.com URLs to include token authentication
      if (gitConfig.repoUrl.startsWith('https://github.com/')) {
        // Handle HTTPS URLs
        cloneUrl = gitConfig.repoUrl.replace('https://github.com/', `https://x-access-token:${this.githubToken}@github.com/`);
      } else if (gitConfig.repoUrl.startsWith('git@github.com:')) {
        // Handle SSH URLs by converting to HTTPS with token
        cloneUrl = gitConfig.repoUrl
          .replace('git@github.com:', `https://x-access-token:${this.githubToken}@github.com/`);
      } else if (gitConfig.repoUrl.includes('github.com/') && !gitConfig.repoUrl.includes('@')) {
        // Handle plain github.com URLs (add https and token)
        cloneUrl = gitConfig.repoUrl.replace('github.com/', `x-access-token:${this.githubToken}@github.com/`);
        if (!cloneUrl.startsWith('https://')) {
          cloneUrl = 'https://' + cloneUrl;
        }
      }
      
      // Ensure it has .git extension for push operations
      if (!cloneUrl.endsWith('.git')) {
        cloneUrl += '.git';
      }
    }
    
    // Clone the repository with authentication
    const cloneCommand = gitConfig.branch 
      ? `git clone --branch ${gitConfig.branch} ${cloneUrl} .`
      : `git clone ${cloneUrl} .`;
    
    const cloneResult = await this.commands.run(cloneCommand);
    
    // IMPORTANT: Set user config in repository context after cloning
    if (cloneResult.exitCode === 0) {
      await this.commands.run('git config user.name "VibeKit Agent"');
      await this.commands.run('git config user.email "agent@vibekit.ai"');
    }
    
    return cloneResult;
  }

  async executeWorkflow(
    gitConfig: GitConfig,
    agentCommand: string,
    prConfig: PRConfig
  ): Promise<{ success: boolean; prUrl?: string; error?: string; logs: string[] }> {
    const logs: string[] = [];
    
    try {
      // Step 1: Clone repository
      logs.push("🔄 Cloning repository...");
      const cloneResult = await this.cloneRepository(gitConfig);
      if (cloneResult.exitCode !== 0) {
        return { success: false, error: `Clone failed: ${cloneResult.stderr}`, logs };
      }
      logs.push("✅ Repository cloned successfully");

      // Step 2: Create feature branch
      logs.push("🔄 Creating feature branch...");
      const branchResult = await this.createBranch(prConfig.headBranch);
      if (branchResult.exitCode !== 0) {
        return { success: false, error: `Branch creation failed: ${branchResult.stderr}`, logs };
      }
      logs.push(`✅ Branch '${prConfig.headBranch}' created`);

      // Step 3: Execute agent command
      logs.push("🔄 Executing agent command...");
      const execResult = await this.commands.run(agentCommand);
      if (execResult.exitCode !== 0) {
        return { success: false, error: `Agent execution failed: ${execResult.stderr}`, logs };
      }
      logs.push("✅ Agent command executed successfully");

      // Step 4: Check for changes
      logs.push("🔄 Checking for changes...");
      const statusResult = await this.commands.run('git status --porcelain');
      if (!statusResult.stdout.trim()) {
        logs.push("ℹ️ No changes detected, skipping commit and PR creation");
        return { success: true, logs };
      }
      logs.push(`📝 Found ${statusResult.stdout.trim().split('\n').length} changed files`);

      // Step 5: Commit changes
      logs.push("🔄 Committing changes...");
      const commitResult = await this.commitChanges(gitConfig.commitMessage || 'VibeKit agent changes');
      if (commitResult.exitCode !== 0) {
        return { success: false, error: `Commit failed: ${commitResult.stderr}`, logs };
      }
      logs.push("✅ Changes committed");

      // Step 6: Push changes
      logs.push("🔄 Pushing changes...");
      const pushResult = await this.pushChanges(prConfig.headBranch);
      if (pushResult.exitCode !== 0) {
        return { success: false, error: `Push failed: ${pushResult.stderr}`, logs };
      }
      logs.push("✅ Changes pushed to remote");

      // Step 7: Create Pull Request
      logs.push("🔄 Creating Pull Request...");
      const prResult = await this.createPullRequest(prConfig);
      if (!prResult.success) {
        return { success: false, error: `PR creation failed: ${prResult.error}`, logs };
      }
      logs.push(`✅ Pull Request created: ${prResult.prUrl}`);

      return {
        success: true,
        prUrl: prResult.prUrl,
        logs
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
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
      this.config.githubToken,
      dockerfilePath
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