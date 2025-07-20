/**
 * Local Sandbox Provider
 * 
 * Implements Vibekit's SandboxProvider interface using Container Use
 * for local containerized development environments.
 */

import { ContainerUseWrapper } from './container-use/wrapper';
import { 
  Environment, 
  CreateEnvironmentOptions,
  ContainerUseError,
  EnvironmentNotFoundError 
} from './container-use/types';
import { ContainerUseInstaller } from './setup/installer';
import { DependencyValidator } from './setup/validator';
import { EnvironmentManager } from './environment/manager';
import { LocalSandboxInstance } from './sandbox-instance';

// Vibekit types (these would normally be imported from @vibe-kit/sdk)
export interface SandboxProvider {
  create(
    envs?: Record<string, string>,
    agentType?: "codex" | "claude" | "opencode" | "gemini",
    workingDirectory?: string
  ): Promise<SandboxInstance>;
  resume(sandboxId: string): Promise<SandboxInstance>;
}

export interface SandboxInstance {
  sandboxId: string;
  commands: SandboxCommands;
  kill(): Promise<void>;
  pause(): Promise<void>;
  getHost(port: number): Promise<string>;
}

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

// Local provider configuration
export interface LocalProviderConfig {
  baseImage?: string;
  workingDirectory?: string;
  resources?: {
    memory?: string;
    cpu?: string;
  };
  setupCommands?: string[];
  autoInstall?: boolean;
  containerUseOptions?: {
    timeout?: number;
    retries?: number;
  };
}

export class LocalSandboxProvider implements SandboxProvider {
  private wrapper: ContainerUseWrapper;
  private installer: ContainerUseInstaller;
  private validator: DependencyValidator;
  private environmentManager: EnvironmentManager;
  private config: LocalProviderConfig;

  constructor(config: LocalProviderConfig = {}) {
    this.config = {
      baseImage: 'ubuntu:24.04',
      workingDirectory: '/workspace',
      autoInstall: true,
      ...config,
    };

    this.wrapper = new ContainerUseWrapper();
    this.installer = new ContainerUseInstaller();
    this.validator = new DependencyValidator();
    this.environmentManager = new EnvironmentManager(this.wrapper);
  }

  /**
   * Create a new local sandbox environment
   */
  async create(
    envs: Record<string, string> = {},
    agentType?: "codex" | "claude" | "opencode" | "gemini",
    workingDirectory?: string
  ): Promise<SandboxInstance> {
    // Ensure dependencies are installed and validated
    await this.ensureSetup();

    // Generate environment name
    const environmentName = this.generateEnvironmentName(agentType);

         // Prepare environment options
     const options: CreateEnvironmentOptions = {
       name: environmentName,
       baseImage: this.getBaseImageForAgent(agentType),
       environment: {
         ...envs,
         VIBEKIT_AGENT_TYPE: agentType || 'unknown',
         VIBEKIT_ENVIRONMENT: 'local',
         VIBEKIT_WORKING_DIRECTORY: workingDirectory || this.config.workingDirectory || '/workspace',
       },
       setupCommands: this.config.setupCommands,
       resources: this.config.resources,
     };

    try {
      // Create the environment
      const environment = await this.environmentManager.createEnvironment(options);

      // Create and return sandbox instance
      return new LocalSandboxInstance(
        environment,
        this.wrapper,
        this.environmentManager
      );
    } catch (error) {
      throw new Error(
        `Failed to create local sandbox: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Resume an existing sandbox environment
   */
  async resume(sandboxId: string): Promise<SandboxInstance> {
    // Ensure dependencies are available
    await this.ensureSetup();

    try {
      // Get the environment by ID/name
      const environment = await this.environmentManager.getEnvironment(sandboxId);
      
      if (!environment) {
        throw new EnvironmentNotFoundError(sandboxId);
      }

      // Ensure environment is running
      if (environment.status === 'stopped') {
        await this.environmentManager.startEnvironment(sandboxId);
        // Refresh environment state
        const updatedEnvironment = await this.environmentManager.getEnvironment(sandboxId);
        if (updatedEnvironment) {
          return new LocalSandboxInstance(
            updatedEnvironment,
            this.wrapper,
            this.environmentManager
          );
        }
      }

      return new LocalSandboxInstance(
        environment,
        this.wrapper,
        this.environmentManager
      );
    } catch (error) {
      if (error instanceof EnvironmentNotFoundError) {
        throw error;
      }
      throw new Error(
        `Failed to resume local sandbox '${sandboxId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * List all available environments
   */
  async listEnvironments(): Promise<Environment[]> {
    await this.ensureSetup();
    return this.environmentManager.listEnvironments();
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(sandboxId: string): Promise<void> {
    await this.ensureSetup();
    await this.environmentManager.deleteEnvironment(sandboxId);
  }

  /**
   * Get provider configuration
   */
  getConfig(): LocalProviderConfig {
    return { ...this.config };
  }

  /**
   * Update provider configuration
   */
  updateConfig(config: Partial<LocalProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private async ensureSetup(): Promise<void> {
    if (this.config.autoInstall) {
      // Validate system dependencies
      const validation = await this.validator.validateSystem();
      
      if (!validation.valid) {
        const errors = validation.issues.filter(issue => issue.severity === 'error');
        if (errors.length > 0) {
          const errorMessages = errors.map(error => 
            `${error.component}: ${error.message}. Solution: ${error.solution}`
          ).join('\n');
          
          throw new Error(
            `System dependencies not met:\n${errorMessages}`
          );
        }
      }

      // Install Container Use if needed
      const isAvailable = await this.wrapper.isAvailable();
      if (!isAvailable) {
        const result = await this.installer.installContainerUse();
        if (!result.success) {
          throw new Error(`Failed to install Container Use: ${result.message}`);
        }
      }
    }
  }

  private generateEnvironmentName(agentType?: string): string {
    const timestamp = Date.now().toString(36);
    const agentPrefix = agentType || 'vibekit';
    return `${agentPrefix}-${timestamp}`;
  }

  private getBaseImageForAgent(agentType?: string): string {
    if (this.config.baseImage && this.config.baseImage !== 'ubuntu:24.04') {
      return this.config.baseImage;
    }

    // Agent-specific base images (can be customized)
    const agentImages: Record<string, string> = {
      claude: 'ubuntu:24.04',
      codex: 'node:20-ubuntu',
      opencode: 'ubuntu:24.04',
      gemini: 'ubuntu:24.04',
    };

    return agentImages[agentType || ''] || this.config.baseImage || 'ubuntu:24.04';
  }
}

/**
 * Factory function to create a local sandbox provider
 */
export function createLocalProvider(config: LocalProviderConfig = {}): LocalSandboxProvider {
  return new LocalSandboxProvider(config);
} 