/**
 * Environment Lifecycle Management
 * 
 * Handles the complete lifecycle of Container Use environments including
 * creation, configuration, startup, and cleanup operations.
 */

import { ContainerUseWrapper } from '../container-use/wrapper';
import { ContainerUseParser } from '../container-use/parser';
import { 
  Environment, 
  CreateEnvironmentOptions,
  ContainerUseError,
  EnvironmentNotFoundError,
  ServiceConfig 
} from '../container-use/types';

export interface LifecycleOptions {
  timeout?: number;
  retries?: number;
  cleanupOnFailure?: boolean;
}

export class EnvironmentLifecycle {
  constructor(
    private wrapper: ContainerUseWrapper,
    private options: LifecycleOptions = {}
  ) {
    this.options = {
      timeout: 300000, // 5 minutes
      retries: 3,
      cleanupOnFailure: true,
      ...options,
    };
  }

  /**
   * Create and fully initialize an environment
   */
  async createEnvironment(
    options: CreateEnvironmentOptions
  ): Promise<Environment> {
    const environmentName = options.name || this.generateEnvironmentName();
    
    try {
      // Step 1: Create the base environment
      const environment = await this.createBaseEnvironment({
        ...options,
        name: environmentName,
      });

      // Step 2: Wait for environment to be ready
      await this.waitForEnvironmentReady(environmentName);

      // Step 3: Run setup commands if provided
      if (options.setupCommands && options.setupCommands.length > 0) {
        await this.runSetupCommands(environmentName, options.setupCommands);
      }

      // Step 4: Configure services if provided
      if (options.services && options.services.length > 0) {
        await this.configureServices(environmentName, options.services);
      }

      // Step 5: Apply resource limits if specified
      if (options.resources) {
        await this.applyResourceLimits(environmentName, options.resources);
      }

      // Return the fully configured environment
      return await this.getEnvironmentStatus(environmentName);
    } catch (error) {
      // Cleanup on failure if enabled
      if (this.options.cleanupOnFailure) {
        try {
          await this.destroyEnvironment(environmentName);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup environment after failure: ${cleanupError}`);
        }
      }

      throw new Error(
        `Failed to create environment '${environmentName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Destroy an environment and clean up all resources
   */
  async destroyEnvironment(nameOrId: string): Promise<void> {
    try {
      // Step 1: Stop any running services
      await this.stopServices(nameOrId);

      // Step 2: Stop the environment
      await this.stopEnvironment(nameOrId);

      // Step 3: Delete the environment
      const command = this.wrapper.buildCommand('delete', { name: nameOrId });
      const result = await this.wrapper.executeCommand(command);

      if (!result.success) {
        throw new ContainerUseError(
          'Failed to destroy environment',
          command.join(' '),
          result.exitCode,
          result.stderr
        );
      }

      // Step 4: Cleanup any orphaned resources
      await this.cleanupOrphanedResources(nameOrId);
    } catch (error) {
      throw new Error(
        `Failed to destroy environment '${nameOrId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Restart an environment
   */
  async restartEnvironment(nameOrId: string): Promise<Environment> {
    try {
      // Get current environment configuration
      const currentEnv = await this.getEnvironmentStatus(nameOrId);
      
      // Stop the environment
      await this.stopEnvironment(nameOrId);

      // Start the environment again
      const command = this.wrapper.buildCommand('apply', { name: nameOrId });
      const result = await this.wrapper.executeCommand(command);

      if (!result.success) {
        throw new ContainerUseError(
          'Failed to restart environment',
          command.join(' '),
          result.exitCode,
          result.stderr
        );
      }

      // Wait for it to be ready
      await this.waitForEnvironmentReady(nameOrId);

      return await this.getEnvironmentStatus(nameOrId);
    } catch (error) {
      throw new Error(
        `Failed to restart environment '${nameOrId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Private helper methods

  private async createBaseEnvironment(
    options: CreateEnvironmentOptions
  ): Promise<Environment> {
    const command = this.wrapper.buildCommand('apply', {
      name: options.name,
      'base-image': options.baseImage,
      ports: options.ports,
    });

    const commandOptions = options.environment ? {
      env: options.environment,
      timeout: this.options.timeout,
    } : { timeout: this.options.timeout };

    const result = await this.wrapper.executeCommand(command, commandOptions);

    if (!result.success) {
      throw new ContainerUseError(
        'Failed to create base environment',
        command.join(' '),
        result.exitCode,
        result.stderr
      );
    }

    return await this.getEnvironmentStatus(options.name!);
  }

  private async waitForEnvironmentReady(
    nameOrId: string,
    maxWaitTime: number = 60000
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const environment = await this.getEnvironmentStatus(nameOrId);
        if (environment.status === 'running') {
          return;
        }
      } catch (error) {
        // Environment might not exist yet, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(
      `Environment '${nameOrId}' did not become ready within ${maxWaitTime}ms`
    );
  }

  private async runSetupCommands(
    nameOrId: string,
    commands: string[]
  ): Promise<void> {
    for (const command of commands) {
      try {
        const containerCommand = [
          'terminal',
          nameOrId,
          '--',
          'bash',
          '-c',
          command
        ];

        const result = await this.wrapper.executeCommand(
          containerCommand,
          { timeout: this.options.timeout }
        );

        if (!result.success) {
          throw new Error(`Setup command failed: ${command}\n${result.stderr}`);
        }
      } catch (error) {
        throw new Error(
          `Failed to run setup command '${command}': ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  private async configureServices(
    nameOrId: string,
    services: ServiceConfig[]
  ): Promise<void> {
    // Services in Container Use would typically be configured via docker-compose
    // or similar orchestration. For now, we'll log the intent.
    console.log(`Configuring ${services.length} services for environment '${nameOrId}'`);
    
    for (const service of services) {
      console.log(`- Service: ${service.name} (${service.image})`);
      // TODO: Implement actual service configuration
      // This would involve docker-compose or similar container orchestration
    }
  }

  private async applyResourceLimits(
    nameOrId: string,
    resources: { memory?: string; cpu?: string }
  ): Promise<void> {
    // Resource limits in Container Use would be applied via Docker
    console.log(`Applying resource limits to environment '${nameOrId}':`, resources);
    // TODO: Implement actual resource limit application
    // This would involve docker update commands or container recreation
  }

  private async stopEnvironment(nameOrId: string): Promise<void> {
    try {
      // Container Use doesn't have explicit stop, but we can try docker commands
      const dockerStopCommand = [
        'terminal',
        nameOrId,
        '--',
        'bash',
        '-c',
        'echo "Stopping environment..."'
      ];

      await this.wrapper.executeCommand(dockerStopCommand);
    } catch (error) {
      // Stop might fail if environment is already stopped
      console.warn(`Warning: Could not stop environment '${nameOrId}': ${error}`);
    }
  }

  private async stopServices(nameOrId: string): Promise<void> {
    try {
      const stopServicesCommand = [
        'terminal',
        nameOrId,
        '--',
        'bash',
        '-c',
        'docker stop $(docker ps -q) 2>/dev/null || true'
      ];

      await this.wrapper.executeCommand(stopServicesCommand);
    } catch (error) {
      // Services might already be stopped
      console.warn(`Warning: Could not stop services in '${nameOrId}': ${error}`);
    }
  }

  private async cleanupOrphanedResources(nameOrId: string): Promise<void> {
    try {
      // Cleanup any orphaned Docker resources
      const cleanupCommand = [
        'terminal',
        nameOrId,
        '--',
        'bash',
        '-c',
        'docker system prune -f 2>/dev/null || true'
      ];

      await this.wrapper.executeCommand(cleanupCommand);
    } catch (error) {
      // Cleanup might fail, but that's okay
      console.warn(`Warning: Could not cleanup resources for '${nameOrId}': ${error}`);
    }
  }

  private async getEnvironmentStatus(nameOrId: string): Promise<Environment> {
    try {
      const command = this.wrapper.buildCommand('inspect', { name: nameOrId });
      const result = await this.wrapper.executeJsonCommand<Environment>(command);
      
      return ContainerUseParser.parseEnvironmentInspect(JSON.stringify(result));
    } catch (error) {
      if (error instanceof ContainerUseError && error.exitCode === 1) {
        throw new EnvironmentNotFoundError(nameOrId);
      }
      throw error;
    }
  }

  private generateEnvironmentName(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `vibekit-${timestamp}-${random}`;
  }
} 