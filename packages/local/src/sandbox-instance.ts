/**
 * Local Sandbox Instance
 * 
 * Implements the SandboxInstance interface for Container Use environments,
 * providing command execution and lifecycle management.
 */

import { ContainerUseWrapper } from './container-use/wrapper';
import { Environment, CommandOptions, StreamingCommandResult } from './container-use/types';
import { EnvironmentManager } from './environment/manager';

// Re-export types from provider for consistency
export interface SandboxCommands {
  run(
    command: string,
    options?: SandboxCommandOptions
  ): Promise<SandboxExecutionResult>;
}

export interface SandboxCommandOptions {
  timeout?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface SandboxInstance {
  sandboxId: string;
  commands: SandboxCommands;
  kill(): Promise<void>;
  pause(): Promise<void>;
  getHost(port: number): Promise<string>;
}

export class LocalSandboxInstance implements SandboxInstance {
  public readonly sandboxId: string;
  public readonly commands: SandboxCommands;

  constructor(
    private environment: Environment,
    private wrapper: ContainerUseWrapper,
    private environmentManager: EnvironmentManager
  ) {
    this.sandboxId = environment.name;
    this.commands = new LocalSandboxCommands(environment, wrapper);
  }

  /**
   * Kill the sandbox environment
   */
  async kill(): Promise<void> {
    try {
      await this.environmentManager.deleteEnvironment(this.sandboxId);
    } catch (error) {
      throw new Error(
        `Failed to kill sandbox '${this.sandboxId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Pause the sandbox environment (stop without destroying)
   */
  async pause(): Promise<void> {
    try {
      await this.environmentManager.stopEnvironment(this.sandboxId);
    } catch (error) {
      throw new Error(
        `Failed to pause sandbox '${this.sandboxId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get the host URL for a specific port
   */
  async getHost(port: number): Promise<string> {
    try {
      // Get port mappings for the environment
      const environment = await this.environmentManager.getEnvironment(this.sandboxId);
      if (!environment) {
        throw new Error(`Environment '${this.sandboxId}' not found`);
      }

             // Find the host port mapping for the requested container port
       const portMapping = environment.ports?.find((p) => p.containerPort === port);
      if (portMapping) {
        return `http://localhost:${portMapping.hostPort}`;
      }

      // If no specific mapping found, assume same port on localhost
      return `http://localhost:${port}`;
    } catch (error) {
      throw new Error(
        `Failed to get host for port ${port} in sandbox '${this.sandboxId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get environment information
   */
  getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Refresh environment state
   */
  async refreshEnvironment(): Promise<void> {
    const updated = await this.environmentManager.getEnvironment(this.sandboxId);
    if (updated) {
      this.environment = updated;
    }
  }
}

class LocalSandboxCommands implements SandboxCommands {
  constructor(
    private environment: Environment,
    private wrapper: ContainerUseWrapper
  ) {}

  /**
   * Run a command in the sandbox environment
   */
  async run(
    command: string,
    options: SandboxCommandOptions = {}
  ): Promise<SandboxExecutionResult> {
    try {
      // Prepare Container Use command
      const containerUseCommand = [
        'terminal',
        this.environment.name,
        '--',
        'bash',
        '-c',
        command
      ];

      const commandOptions: CommandOptions = {
        timeout: options.timeout || 30000,
        stdio: 'pipe',
      };

      // Execute command
      const result = await this.wrapper.executeCommand(
        containerUseCommand,
        commandOptions
      );

      // Handle streaming output if callbacks provided
      if (options.onStdout && result.stdout) {
        options.onStdout(result.stdout);
      }
      if (options.onStderr && result.stderr) {
        options.onStderr(result.stderr);
      }

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode,
        success: result.success,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        success: false,
      };
    }
  }

  /**
   * Run a command with streaming output
   */
  async runStreaming(
    command: string,
    options: SandboxCommandOptions = {}
  ): Promise<StreamingCommandResult> {
    try {
      // Prepare Container Use command for streaming
      const containerUseCommand = [
        'terminal',
        this.environment.name,
        '--',
        'bash',
        '-c',
        command
      ];

      const commandOptions: CommandOptions = {
        timeout: options.timeout || 300000, // 5 minutes for streaming
        stdio: 'pipe',
      };

      // Execute streaming command
      const streamResult = this.wrapper.executeStreamingCommand(
        containerUseCommand,
        commandOptions
      );

      // Set up streaming handlers
      if (options.onStdout) {
        streamResult.stdout.on('data', (data: Buffer) => {
          options.onStdout!(data.toString());
        });
      }

      if (options.onStderr) {
        streamResult.stderr.on('data', (data: Buffer) => {
          options.onStderr!(data.toString());
        });
      }

      return streamResult;
    } catch (error) {
      throw new Error(
        `Failed to start streaming command in sandbox '${this.environment.name}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
} 