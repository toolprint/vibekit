/**
 * Local MCP Server Integration
 * 
 * Provides MCP (Model Context Protocol) server configuration for local sandboxes
 * using Container Use as the MCP server implementation.
 */

import { spawn, ChildProcess } from 'child_process';
import { Environment } from '@vibekit/local';

export interface MCPServerConfig {
  environment: Environment;
  serverType: 'stdio' | 'transport';
  port?: number;
  host?: string;
}

export interface MCPServerInstance {
  config: MCPServerConfig;
  process?: ChildProcess;
  serverUrl?: string;
  isRunning: boolean;
}

export interface AgentMCPConfig {
  agentType: 'claude' | 'codex' | 'opencode' | 'gemini' | 'cursor';
  environment: Environment;
  serverConfig?: MCPServerConfig;
}

/**
 * MCP Server Manager for local sandboxes
 */
export class LocalMCPServerManager {
  private servers: Map<string, MCPServerInstance> = new Map();
  private agentAssignments: Map<string, string> = new Map();

  /**
   * Start MCP server for a local environment
   */
  async startMCPServer(config: MCPServerConfig): Promise<MCPServerInstance> {
    const serverId = this.getServerId(config.environment);
    
    // Check if server is already running
    if (this.servers.has(serverId)) {
      const existing = this.servers.get(serverId)!;
      if (existing.isRunning) {
        return existing;
      }
    }

    const instance: MCPServerInstance = {
      config,
      isRunning: false,
    };

    try {
      if (config.serverType === 'stdio') {
        // Start container-use stdio server
        const process = spawn('container-use', ['stdio', config.environment.name], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        process.on('error', (error) => {
          console.error(`MCP server error for ${config.environment.name}: ${error}`);
          instance.isRunning = false;
        });

        process.on('exit', (code) => {
          console.log(`MCP server for ${config.environment.name} exited with code: ${code}`);
          instance.isRunning = false;
        });

        instance.process = process;
        instance.isRunning = true;
        instance.serverUrl = `stdio://${config.environment.name}`;

      } else if (config.serverType === 'transport') {
        // Start container-use with transport server (if supported in future)
        const port = config.port || 8000;
        const host = config.host || 'localhost';
        
        const process = spawn('container-use', [
          'serve', 
          '--port', port.toString(),
          '--host', host,
          config.environment.name
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        process.on('error', (error) => {
          console.error(`MCP transport server error for ${config.environment.name}: ${error}`);
          instance.isRunning = false;
        });

        process.on('exit', (code) => {
          console.log(`MCP transport server for ${config.environment.name} exited with code: ${code}`);
          instance.isRunning = false;
        });

        instance.process = process;
        instance.isRunning = true;
        instance.serverUrl = `http://${host}:${port}`;
      }

      this.servers.set(serverId, instance);
      return instance;

    } catch (error) {
      instance.isRunning = false;
      throw new Error(`Failed to start MCP server for ${config.environment.name}: ${error}`);
    }
  }

  /**
   * Stop MCP server for an environment
   */
  async stopMCPServer(environment: Environment): Promise<void> {
    const serverId = this.getServerId(environment);
    const instance = this.servers.get(serverId);
    
    if (instance && instance.process) {
      instance.process.kill('SIGTERM');
      instance.isRunning = false;
      
      // Give it time to gracefully shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (instance.process && !instance.process.killed) {
        instance.process.kill('SIGKILL');
      }
    }
    
    this.servers.delete(serverId);
  }

  /**
   * Get MCP server for environment
   */
  getMCPServer(environment: Environment): MCPServerInstance | undefined {
    const serverId = this.getServerId(environment);
    return this.servers.get(serverId);
  }

  /**
   * Assign agent to environment
   */
  assignAgentToEnvironment(agentId: string, environment: Environment): void {
    this.agentAssignments.set(agentId, environment.name);
  }

  /**
   * Get environment for agent
   */
  getAgentEnvironment(agentId: string): string | undefined {
    return this.agentAssignments.get(agentId);
  }

  /**
   * Remove agent assignment
   */
  removeAgentAssignment(agentId: string): void {
    this.agentAssignments.delete(agentId);
  }

  /**
   * Get all active servers
   */
  getActiveServers(): MCPServerInstance[] {
    return Array.from(this.servers.values()).filter(server => server.isRunning);
  }

  /**
   * Stop all MCP servers
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(async (serverId) => {
      const instance = this.servers.get(serverId);
      if (instance && instance.config.environment) {
        await this.stopMCPServer(instance.config.environment);
      }
    });

    await Promise.all(stopPromises);
  }

  /**
   * Generate unique server ID for environment
   */
  private getServerId(environment: Environment): string {
    return `mcp-${environment.name}`;
  }
}

/**
 * Global MCP server manager instance
 */
export const mcpServerManager = new LocalMCPServerManager();

/**
 * Container Use MCP Server configurator
 */
export class ContainerUseMCPConfigurator {
  
  /**
   * Configure agent for Container Use MCP server
   */
  static async configureAgent(config: AgentMCPConfig): Promise<MCPServerInstance> {
    const serverConfig: MCPServerConfig = {
      environment: config.environment,
      serverType: 'stdio', // Default to stdio for MCP
      ...config.serverConfig,
    };

    // Start MCP server for the environment
    const server = await mcpServerManager.startMCPServer(serverConfig);
    
    // Assign agent to environment
    const agentId = `${config.agentType}-${Date.now()}`;
    mcpServerManager.assignAgentToEnvironment(agentId, config.environment);

    return server;
  }

  /**
   * Get MCP server URL for agent configuration
   */
  static getMCPServerURL(environment: Environment): string | undefined {
    const server = mcpServerManager.getMCPServer(environment);
    return server?.serverUrl;
  }

  /**
   * Apply agent-specific rules from Container Use
   */
  static async applyAgentRules(agentType: string, environment: Environment): Promise<void> {
    try {
      // Configure agent using container-use agent command
      const process = spawn('container-use', [
        'agent', 'configure', agentType, 
        '--environment', environment.name
      ], {
        stdio: ['inherit', 'inherit', 'inherit'],
      });

      await new Promise<void>((resolve, reject) => {
        process.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Agent configuration failed with code: ${code}`));
          }
        });

        process.on('error', (error) => {
          reject(new Error(`Agent configuration error: ${error}`));
        });
      });

    } catch (error) {
      console.warn(`Failed to apply agent rules for ${agentType}: ${error}`);
      // Don't throw - this is optional configuration
    }
  }

  /**
   * Validate MCP server availability
   */
  static async validateMCPServer(environment: Environment): Promise<boolean> {
    try {
      const server = mcpServerManager.getMCPServer(environment);
      
      if (!server || !server.isRunning) {
        return false;
      }

      if (server.config.serverType === 'stdio') {
        // For stdio servers, check if process is alive
        return server.process ? !server.process.killed : false;
      } else if (server.config.serverType === 'transport' && server.serverUrl) {
        // For transport servers, try a health check
        try {
          const response = await fetch(`${server.serverUrl}/health`);
          return response.ok;
        } catch {
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error(`MCP server validation failed: ${error}`);
      return false;
    }
  }
}

/**
 * Agent-specific MCP configurations
 */
export const AgentMCPConfigs = {
  claude: {
    mcpServerType: 'stdio' as const,
    requiredTools: ['edit', 'write', 'read', 'bash'],
    configCommand: 'claude',
  },
  
  codex: {
    mcpServerType: 'stdio' as const,
    requiredTools: ['edit', 'write', 'read', 'bash'],
    configCommand: 'codex',
  },
  
  cursor: {
    mcpServerType: 'stdio' as const,
    requiredTools: ['edit', 'write', 'read', 'bash'],
    configCommand: 'cursor',
  },
  
  gemini: {
    mcpServerType: 'stdio' as const,
    requiredTools: ['edit', 'write', 'read', 'bash'],
    configCommand: 'gemini',
  },
  
  opencode: {
    mcpServerType: 'stdio' as const,
    requiredTools: ['edit', 'write', 'read', 'bash'],
    configCommand: 'opencode',
  },
};

/**
 * Utility functions for MCP integration
 */

/**
 * Create MCP server configuration for agent
 */
export function createAgentMCPConfig(
  agentType: 'claude' | 'codex' | 'opencode' | 'gemini' | 'cursor',
  environment: Environment,
  overrides?: Partial<MCPServerConfig>
): AgentMCPConfig {
  const agentConfig = AgentMCPConfigs[agentType];
  
  return {
    agentType,
    environment,
    serverConfig: {
      environment,
      serverType: agentConfig.mcpServerType,
      ...overrides,
    },
  };
}

/**
 * Initialize MCP server for agent type
 */
export async function initializeMCPForAgent(
  agentType: 'claude' | 'codex' | 'opencode' | 'gemini' | 'cursor',
  environment: Environment
): Promise<MCPServerInstance> {
  const config = createAgentMCPConfig(agentType, environment);
  
  // Apply agent-specific rules
  await ContainerUseMCPConfigurator.applyAgentRules(agentType, environment);
  
  // Configure and start MCP server
  return await ContainerUseMCPConfigurator.configureAgent(config);
}

/**
 * Cleanup MCP resources for environment
 */
export async function cleanupMCPForEnvironment(environment: Environment): Promise<void> {
  await mcpServerManager.stopMCPServer(environment);
} 