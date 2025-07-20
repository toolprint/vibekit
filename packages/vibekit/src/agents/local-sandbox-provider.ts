/**
 * Local Sandbox Provider for Agent Integration
 * 
 * Provides a specialized sandbox provider that integrates local Container Use
 * environments with Vibekit agents, including MCP server management.
 */

import { SandboxProvider, SandboxInstance, SandboxCommands, SandboxExecutionResult, SandboxCommandOptions } from '../types';
import { LocalSandboxProvider, createLocalProvider, Environment } from '@vibekit/local';
import { 
  initializeMCPForAgent, 
  cleanupMCPForEnvironment, 
  MCPServerInstance,
  ContainerUseMCPConfigurator 
} from './local-mcp';

export interface LocalAgentSandboxConfig {
  autoInstall?: boolean;
  workingDirectory?: string;
  enableMCP?: boolean;
  mcpServerType?: 'stdio' | 'transport';
}

/**
 * Local sandbox instance with MCP integration
 */
export class LocalAgentSandboxInstance implements SandboxInstance {
  public sandboxId: string;
  public commands: SandboxCommands;
  private environment: Environment;
  private localProvider: LocalSandboxProvider;
  private mcpServer?: MCPServerInstance;

  constructor(
    environment: Environment, 
    localProvider: LocalSandboxProvider,
    mcpServer?: MCPServerInstance
  ) {
    this.environment = environment;
    this.localProvider = localProvider;
    this.mcpServer = mcpServer;
    this.sandboxId = environment.name;
    
    // Create commands interface
    this.commands = {
      run: async (command: string, options?: SandboxCommandOptions): Promise<SandboxExecutionResult> => {
        try {
          // Use the local provider's execution capabilities
          const result = await this.executeCommand(command, options);
          return result;
        } catch (error) {
          return {
            exitCode: 1,
            stdout: '',
            stderr: error instanceof Error ? error.message : String(error),
          };
        }
      }
    };
  }

  private async executeCommand(command: string, options?: SandboxCommandOptions): Promise<SandboxExecutionResult> {
    // Implementation would depend on how LocalSandboxProvider executes commands
    // For now, we'll create a basic implementation
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const process = spawn('container-use', ['terminal', this.environment.name, '--', 'bash', '-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      if (process.stdout) {
        process.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          if (options?.onStdout) {
            options.onStdout(output);
          }
        });
      }

      if (process.stderr) {
        process.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          if (options?.onStderr) {
            options.onStderr(output);
          }
        });
      }

      const timeout = options?.timeoutMs || 30000;
      const timer = setTimeout(() => {
        process.kill('SIGTERM');
        resolve({
          exitCode: 124, // Timeout exit code
          stdout,
          stderr: stderr + '\nCommand timed out',
        });
      }, timeout);

      process.on('exit', (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
        });
      });

      process.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + '\n' + error.message,
        });
      });
    });
  }

  async kill(): Promise<void> {
    // Clean up MCP server
    if (this.mcpServer) {
      await cleanupMCPForEnvironment(this.environment);
    }
    
    // Delete the environment
    await this.localProvider.deleteEnvironment(this.environment.name);
  }

  async pause(): Promise<void> {
    // Container Use doesn't have pause/resume, so we'll implement this as stop/start
    // This is a placeholder - actual implementation would depend on Container Use capabilities
    console.log(`Pausing environment ${this.environment.name} (placeholder)`);
  }

  async resume(): Promise<void> {
    // Container Use doesn't have pause/resume, so we'll implement this as stop/start
    // This is a placeholder - actual implementation would depend on Container Use capabilities
    console.log(`Resuming environment ${this.environment.name} (placeholder)`);
  }

  getHost(port: number): Promise<string> {
    return Promise.resolve('localhost'); // Local environments run on localhost
  }

  /**
   * Get MCP server URL if available
   */
  getMCPServerURL(): string | undefined {
    return this.mcpServer?.serverUrl;
  }

  /**
   * Check if MCP server is running
   */
  isMCPEnabled(): boolean {
    return this.mcpServer?.isRunning || false;
  }
}

/**
 * Local sandbox provider for agents with MCP integration
 */
export class LocalAgentSandboxProvider implements SandboxProvider {
  private localProvider: LocalSandboxProvider;
  private config: LocalAgentSandboxConfig;

  constructor(config: LocalAgentSandboxConfig = {}) {
    this.config = config;
    this.localProvider = createLocalProvider({
      autoInstall: config.autoInstall,
    });
  }

  async create(
    envVars: Record<string, string>,
    agentType: 'codex' | 'claude' | 'opencode' | 'gemini',
    workingDirectory?: string
  ): Promise<SandboxInstance> {
    // Create local environment
    const sandbox = await this.localProvider.create(envVars, agentType, workingDirectory);
    
    // Find the environment that was created
    const environments = await this.localProvider.listEnvironments();
    const environment = environments.find(env => env.name === sandbox.sandboxId);
    
    if (!environment) {
      throw new Error(`Failed to find created environment: ${sandbox.sandboxId}`);
    }

    let mcpServer: MCPServerInstance | undefined;

    // Initialize MCP server if enabled
    if (this.config.enableMCP) {
      try {
        mcpServer = await initializeMCPForAgent(agentType, environment);
        console.log(`MCP server started for agent ${agentType} in environment ${environment.name}`);
      } catch (error) {
        console.warn(`Failed to start MCP server for ${agentType}: ${error}`);
        // Continue without MCP - it's optional
      }
    }

    return new LocalAgentSandboxInstance(environment, this.localProvider, mcpServer);
  }

  async resume(sandboxId: string): Promise<SandboxInstance> {
    // Resume existing environment
    const sandbox = await this.localProvider.resume(sandboxId);
    
    // Find the environment
    const environments = await this.localProvider.listEnvironments();
    const environment = environments.find(env => env.name === sandboxId);
    
    if (!environment) {
      throw new Error(`Failed to find environment: ${sandboxId}`);
    }

    let mcpServer: MCPServerInstance | undefined;

    // Check if MCP server is already running for this environment
    if (this.config.enableMCP) {
      try {
        const { mcpServerManager } = await import('./local-mcp');
        mcpServer = mcpServerManager.getMCPServer(environment);
        
        if (!mcpServer || !mcpServer.isRunning) {
          // Restart MCP server if needed
          const agentType = environment.environment?.VIBEKIT_AGENT_TYPE || 'codex';
          mcpServer = await initializeMCPForAgent(agentType as any, environment);
        }
      } catch (error) {
        console.warn(`Failed to resume MCP server: ${error}`);
      }
    }

    return new LocalAgentSandboxInstance(environment, this.localProvider, mcpServer);
  }

  /**
   * List all local environments
   */
  async listEnvironments(): Promise<Environment[]> {
    return await this.localProvider.listEnvironments();
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(sandboxId: string): Promise<void> {
    await this.localProvider.deleteEnvironment(sandboxId);
  }

  /**
   * Get environment by ID
   */
  async getEnvironment(sandboxId: string): Promise<Environment | undefined> {
    const environments = await this.listEnvironments();
    return environments.find(env => env.name === sandboxId);
  }
}

/**
 * Create local agent sandbox provider
 */
export function createLocalAgentSandboxProvider(config?: LocalAgentSandboxConfig): LocalAgentSandboxProvider {
  return new LocalAgentSandboxProvider({
    enableMCP: true,
    autoInstall: true,
    ...config,
  });
}

/**
 * Agent configuration helpers
 */
export interface AgentLocalConfig {
  agentType: 'codex' | 'claude' | 'opencode' | 'gemini';
  environment?: Environment;
  enableMCP?: boolean;
  workingDirectory?: string;
  secrets?: Record<string, string>;
}

/**
 * Create agent configuration with local MCP support
 */
export function createAgentLocalConfig(config: AgentLocalConfig) {
  return {
    sandboxProvider: createLocalAgentSandboxProvider({
      enableMCP: config.enableMCP,
      workingDirectory: config.workingDirectory,
    }),
    localMCP: config.enableMCP ? {
      enabled: true,
      environment: config.environment,
      serverType: 'stdio' as const,
      autoStart: true,
    } : undefined,
    secrets: config.secrets,
    workingDirectory: config.workingDirectory,
  };
} 