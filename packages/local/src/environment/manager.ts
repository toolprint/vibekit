/**
 * Environment Manager
 * 
 * Manages Container Use environments including creation, lifecycle,
 * and multi-environment orchestration.
 */

import { ContainerUseWrapper } from '../container-use/wrapper';
import { ContainerUseParser } from '../container-use/parser';
import { 
  Environment, 
  CreateEnvironmentOptions,
  ListEnvironmentsOptions,
  ContainerUseError,
  EnvironmentNotFoundError 
} from '../container-use/types';

export class EnvironmentManager {
  constructor(private wrapper: ContainerUseWrapper) {}

  /**
   * Create a new environment
   */
  async createEnvironment(options: CreateEnvironmentOptions): Promise<Environment> {
    try {
             // Build create command
       const command = this.wrapper.buildCommand('apply', {
         name: options.name,
         'base-image': options.baseImage,
         ports: options.ports,
       });

      // Set environment variables if provided
      const commandOptions = options.environment ? {
        env: options.environment,
      } : undefined;

      // Execute create command
      const result = await this.wrapper.executeCommand(command, commandOptions);

      if (!result.success) {
        throw new ContainerUseError(
          'Failed to create environment',
          command.join(' '),
          result.exitCode,
          result.stderr
        );
      }

      // Get the created environment
      const environment = await this.getEnvironment(options.name || '');
      if (!environment) {
        throw new Error('Environment was created but could not be retrieved');
      }

      return environment;
    } catch (error) {
      if (error instanceof ContainerUseError) {
        throw error;
      }
      throw new Error(
        `Failed to create environment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get environment by name/ID
   */
  async getEnvironment(nameOrId: string): Promise<Environment | null> {
    try {
      const command = this.wrapper.buildCommand('inspect', { name: nameOrId });
      const result = await this.wrapper.executeJsonCommand<Environment>(command);
      
      return ContainerUseParser.parseEnvironmentInspect(JSON.stringify(result));
    } catch (error) {
      if (error instanceof ContainerUseError && error.exitCode === 1) {
        // Environment not found
        return null;
      }
      throw error;
    }
  }

  /**
   * List all environments
   */
  async listEnvironments(options: ListEnvironmentsOptions = {}): Promise<Environment[]> {
    try {
      const command = this.wrapper.buildCommand('list', {
        status: options.status,
        branch: options.branch,
      });

      const result = await this.wrapper.executeCommand<string>(command);
      
      if (!result.success) {
        throw new ContainerUseError(
          'Failed to list environments',
          command.join(' '),
          result.exitCode,
          result.stderr
        );
      }

      return ContainerUseParser.parseEnvironmentList(result.stdout || '');
    } catch (error) {
      if (error instanceof ContainerUseError) {
        throw error;
      }
      throw new Error(
        `Failed to list environments: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Start an environment
   */
  async startEnvironment(nameOrId: string): Promise<void> {
    try {
      // Container Use doesn't have explicit start command, environments are started when created
      // Check if environment exists and is stopped
      const environment = await this.getEnvironment(nameOrId);
      if (!environment) {
        throw new EnvironmentNotFoundError(nameOrId);
      }

      if (environment.status === 'stopped') {
        // Restart by applying again (Container Use pattern)
        const command = this.wrapper.buildCommand('apply', { name: nameOrId });
        const result = await this.wrapper.executeCommand(command);

        if (!result.success) {
          throw new ContainerUseError(
            'Failed to start environment',
            command.join(' '),
            result.exitCode,
            result.stderr
          );
        }
      }
    } catch (error) {
      if (error instanceof ContainerUseError || error instanceof EnvironmentNotFoundError) {
        throw error;
      }
      throw new Error(
        `Failed to start environment '${nameOrId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Stop an environment
   */
  async stopEnvironment(nameOrId: string): Promise<void> {
    try {
      // Container Use environments are stopped by deleting them
      // For "pause" functionality, we could implement a different approach
      const environment = await this.getEnvironment(nameOrId);
      if (!environment) {
        throw new EnvironmentNotFoundError(nameOrId);
      }

      // For now, we'll use the delete command but mark it as stopped
      // In a real implementation, this might involve docker stop commands
      console.warn(`Stopping environment '${nameOrId}' - this will delete the environment`);
      await this.deleteEnvironment(nameOrId);
    } catch (error) {
      if (error instanceof ContainerUseError || error instanceof EnvironmentNotFoundError) {
        throw error;
      }
      throw new Error(
        `Failed to stop environment '${nameOrId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(nameOrId: string): Promise<void> {
    try {
      const command = this.wrapper.buildCommand('delete', { name: nameOrId });
      const result = await this.wrapper.executeCommand(command);

      if (!result.success) {
        throw new ContainerUseError(
          'Failed to delete environment',
          command.join(' '),
          result.exitCode,
          result.stderr
        );
      }
    } catch (error) {
      if (error instanceof ContainerUseError) {
        throw error;
      }
      throw new Error(
        `Failed to delete environment '${nameOrId}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get environment status
   */
  async getEnvironmentStatus(nameOrId: string): Promise<string> {
    const environment = await this.getEnvironment(nameOrId);
    return environment?.status || 'unknown';
  }

  /**
   * Check if environment exists
   */
  async environmentExists(nameOrId: string): Promise<boolean> {
    const environment = await this.getEnvironment(nameOrId);
    return environment !== null;
  }

  /**
   * Get running environments
   */
  async getRunningEnvironments(): Promise<Environment[]> {
    return this.listEnvironments({ status: 'running' });
  }

  /**
   * Get environments by status
   */
  async getEnvironmentsByStatus(status: string): Promise<Environment[]> {
    return this.listEnvironments({ status: status as any });
  }

  /**
   * Find environment by criteria
   */
  async findEnvironment(criteria: {
    name?: string;
    branch?: string;
    status?: string;
  }): Promise<Environment | null> {
    const environments = await this.listEnvironments();
    
    return environments.find(env => {
      if (criteria.name && env.name !== criteria.name) return false;
      if (criteria.branch && env.branch !== criteria.branch) return false;
      if (criteria.status && env.status !== criteria.status) return false;
      return true;
    }) || null;
  }
} 