/**
 * Service Manager for Local Sandbox Environments
 * 
 * Manages databases, external services, and service discovery for local
 * Container Use environments. Provides health monitoring and persistence.
 */

import { spawn, ChildProcess } from 'child_process';
import type { Environment } from '../container-use/types';

export interface ServiceConfig {
  name: string;
  type: 'postgresql' | 'redis' | 'mysql' | 'mongodb' | 'elasticsearch' | 'custom';
  version?: string;
  port?: number;
  environment?: Record<string, string>;
  healthCheck?: {
    command: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  persistence?: {
    enabled: boolean;
    volumePath?: string;
  };
  dependencies?: string[];
}

export interface ServiceInstance {
  config: ServiceConfig;
  containerId?: string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'unhealthy';
  port?: number;
  connectionString?: string;
  healthStatus?: {
    lastCheck: Date;
    healthy: boolean;
    message?: string;
  };
  metrics?: {
    startTime: Date;
    restarts: number;
    uptime: number;
  };
}

export interface ServiceTemplate {
  name: string;
  type: ServiceConfig['type'];
  description: string;
  defaultConfig: Partial<ServiceConfig>;
  requiredPorts: number[];
  environmentVariables: Record<string, string>;
  setupCommands?: string[];
  healthCheckCommand: string;
}

/**
 * Service Manager for local environments
 */
export class LocalServiceManager {
  private services: Map<string, ServiceInstance> = new Map();
  private environmentServices: Map<string, string[]> = new Map(); // env name -> service names
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start a service in an environment
   */
  async startService(environment: Environment, config: ServiceConfig): Promise<ServiceInstance> {
    const serviceKey = this.getServiceKey(environment.name, config.name);
    
    // Check if service is already running
    const existing = this.services.get(serviceKey);
    if (existing && existing.status === 'running') {
      return existing;
    }

    const instance: ServiceInstance = {
      config,
      status: 'starting',
      metrics: {
        startTime: new Date(),
        restarts: existing?.metrics?.restarts || 0,
        uptime: 0,
      },
    };

    this.services.set(serviceKey, instance);

    try {
      // Start service using Container Use service management
      const serviceSpec = this.generateServiceSpec(config);
      
      const process = spawn('container-use', [
        'service', 'add',
        environment.name,
        '--name', config.name,
        '--image', serviceSpec.image,
        '--port', config.port?.toString() || serviceSpec.defaultPort,
        ...serviceSpec.args
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        process.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Service start failed with code: ${code}`));
          }
        });

        process.on('error', (error) => {
          reject(error);
        });
      });

      // Wait for service to be ready
      instance.status = 'running';
      instance.port = config.port || this.getDefaultPort(config.type);
      instance.connectionString = this.generateConnectionString(environment, instance);

      // Track environment services
      const envServices = this.environmentServices.get(environment.name) || [];
      envServices.push(config.name);
      this.environmentServices.set(environment.name, envServices);

      // Start health checking
      if (config.healthCheck) {
        this.startHealthCheck(environment, instance);
      }

      console.log(`Service ${config.name} started successfully on port ${instance.port}`);
      return instance;

    } catch (error) {
      instance.status = 'error';
      throw new Error(`Failed to start service ${config.name}: ${error}`);
    }
  }

  /**
   * Stop a service
   */
  async stopService(environment: Environment, serviceName: string): Promise<void> {
    const serviceKey = this.getServiceKey(environment.name, serviceName);
    const instance = this.services.get(serviceKey);
    
    if (!instance) {
      throw new Error(`Service ${serviceName} not found`);
    }

    try {
      // Stop service using Container Use
      const process = spawn('container-use', [
        'service', 'remove',
        environment.name,
        '--name', serviceName
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        process.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Service stop failed with code: ${code}`));
          }
        });

        process.on('error', (error) => {
          reject(error);
        });
      });

      // Stop health checking
      const healthInterval = this.healthCheckIntervals.get(serviceKey);
      if (healthInterval) {
        clearInterval(healthInterval);
        this.healthCheckIntervals.delete(serviceKey);
      }

      // Update status
      instance.status = 'stopped';
      
      // Remove from environment services
      const envServices = this.environmentServices.get(environment.name) || [];
      const updatedServices = envServices.filter(name => name !== serviceName);
      this.environmentServices.set(environment.name, updatedServices);

      console.log(`Service ${serviceName} stopped successfully`);

    } catch (error) {
      instance.status = 'error';
      throw new Error(`Failed to stop service ${serviceName}: ${error}`);
    }
  }

  /**
   * Get service instance
   */
  getService(environment: Environment, serviceName: string): ServiceInstance | undefined {
    const serviceKey = this.getServiceKey(environment.name, serviceName);
    return this.services.get(serviceKey);
  }

  /**
   * List services for environment
   */
  listServices(environment: Environment): ServiceInstance[] {
    const serviceNames = this.environmentServices.get(environment.name) || [];
    return serviceNames
      .map(name => this.getService(environment, name))
      .filter((service): service is ServiceInstance => service !== undefined);
  }

  /**
   * Get service connection info
   */
  getServiceConnection(environment: Environment, serviceName: string): ServiceConnectionInfo | undefined {
    const instance = this.getService(environment, serviceName);
    if (!instance || instance.status !== 'running') {
      return undefined;
    }

    return {
      serviceName,
      type: instance.config.type,
      host: 'localhost',
      port: instance.port!,
      connectionString: instance.connectionString!,
      environment: instance.config.environment || {},
      healthy: instance.healthStatus?.healthy || false,
    };
  }

  /**
   * Check service health
   */
  async checkServiceHealth(environment: Environment, serviceName: string): Promise<boolean> {
    const instance = this.getService(environment, serviceName);
    if (!instance || !instance.config.healthCheck) {
      return instance?.status === 'running' || false;
    }

    try {
      const process = spawn('container-use', [
        'terminal',
        environment.name,
        '--',
        'bash', '-c',
        instance.config.healthCheck.command
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: instance.config.healthCheck.timeout || 5000,
      });

      const healthy = await new Promise<boolean>((resolve) => {
        process.on('exit', (code) => {
          resolve(code === 0);
        });

        process.on('error', () => {
          resolve(false);
        });
      });

      // Update health status
      instance.healthStatus = {
        lastCheck: new Date(),
        healthy,
        message: healthy ? 'Service is healthy' : 'Health check failed',
      };

      if (!healthy && instance.status === 'running') {
        instance.status = 'unhealthy';
      } else if (healthy && instance.status === 'unhealthy') {
        instance.status = 'running';
      }

      return healthy;

    } catch (error) {
      instance.healthStatus = {
        lastCheck: new Date(),
        healthy: false,
        message: `Health check error: ${error}`,
      };
      return false;
    }
  }

  /**
   * Get all services across environments
   */
  getAllServices(): { environment: string; services: ServiceInstance[] }[] {
    const result: { environment: string; services: ServiceInstance[] }[] = [];
    
    for (const [envName] of this.environmentServices) {
      const services = this.listServices({ name: envName } as Environment);
      result.push({ environment: envName, services });
    }
    
    return result;
  }

  /**
   * Cleanup services for environment
   */
  async cleanupEnvironmentServices(environment: Environment): Promise<void> {
    const services = this.listServices(environment);
    
    for (const service of services) {
      try {
        await this.stopService(environment, service.config.name);
      } catch (error) {
        console.warn(`Failed to stop service ${service.config.name}: ${error}`);
      }
    }
    
    this.environmentServices.delete(environment.name);
  }

  /**
   * Generate service specification for Container Use
   */
  private generateServiceSpec(config: ServiceConfig): { image: string; defaultPort: string; args: string[] } {
    switch (config.type) {
      case 'postgresql':
        return {
          image: `postgres:${config.version || '15'}`,
          defaultPort: '5432',
          args: [
            '--env', 'POSTGRES_DB=vibekit',
            '--env', 'POSTGRES_USER=vibekit',
            '--env', 'POSTGRES_PASSWORD=vibekit123',
            ...(config.environment ? Object.entries(config.environment).flatMap(([k, v]) => ['--env', `${k}=${v}`]) : []),
          ],
        };

      case 'redis':
        return {
          image: `redis:${config.version || '7-alpine'}`,
          defaultPort: '6379',
          args: config.environment ? Object.entries(config.environment).flatMap(([k, v]) => ['--env', `${k}=${v}`]) : [],
        };

      case 'mysql':
        return {
          image: `mysql:${config.version || '8'}`,
          defaultPort: '3306',
          args: [
            '--env', 'MYSQL_DATABASE=vibekit',
            '--env', 'MYSQL_USER=vibekit',
            '--env', 'MYSQL_PASSWORD=vibekit123',
            '--env', 'MYSQL_ROOT_PASSWORD=root123',
            ...(config.environment ? Object.entries(config.environment).flatMap(([k, v]) => ['--env', `${k}=${v}`]) : []),
          ],
        };

      case 'mongodb':
        return {
          image: `mongo:${config.version || '7'}`,
          defaultPort: '27017',
          args: [
            '--env', 'MONGO_INITDB_DATABASE=vibekit',
            '--env', 'MONGO_INITDB_ROOT_USERNAME=vibekit',
            '--env', 'MONGO_INITDB_ROOT_PASSWORD=vibekit123',
            ...(config.environment ? Object.entries(config.environment).flatMap(([k, v]) => ['--env', `${k}=${v}`]) : []),
          ],
        };

      case 'elasticsearch':
        return {
          image: `elasticsearch:${config.version || '8.11.0'}`,
          defaultPort: '9200',
          args: [
            '--env', 'discovery.type=single-node',
            '--env', 'xpack.security.enabled=false',
            ...(config.environment ? Object.entries(config.environment).flatMap(([k, v]) => ['--env', `${k}=${v}`]) : []),
          ],
        };

      case 'custom':
        return {
          image: config.environment?.IMAGE || 'alpine:latest',
          defaultPort: config.port?.toString() || '8080',
          args: config.environment ? Object.entries(config.environment).flatMap(([k, v]) => ['--env', `${k}=${v}`]) : [],
        };

      default:
        throw new Error(`Unsupported service type: ${config.type}`);
    }
  }

  /**
   * Generate connection string for service
   */
  private generateConnectionString(environment: Environment, instance: ServiceInstance): string {
    const host = 'localhost';
    const port = instance.port!;
    const { type, environment: env } = instance.config;

    switch (type) {
      case 'postgresql':
        const pgUser = env?.POSTGRES_USER || 'vibekit';
        const pgPassword = env?.POSTGRES_PASSWORD || 'vibekit123';
        const pgDatabase = env?.POSTGRES_DB || 'vibekit';
        return `postgresql://${pgUser}:${pgPassword}@${host}:${port}/${pgDatabase}`;

      case 'redis':
        return `redis://${host}:${port}`;

      case 'mysql':
        const mysqlUser = env?.MYSQL_USER || 'vibekit';
        const mysqlPassword = env?.MYSQL_PASSWORD || 'vibekit123';
        const mysqlDatabase = env?.MYSQL_DATABASE || 'vibekit';
        return `mysql://${mysqlUser}:${mysqlPassword}@${host}:${port}/${mysqlDatabase}`;

      case 'mongodb':
        const mongoUser = env?.MONGO_INITDB_ROOT_USERNAME || 'vibekit';
        const mongoPassword = env?.MONGO_INITDB_ROOT_PASSWORD || 'vibekit123';
        const mongoDatabase = env?.MONGO_INITDB_DATABASE || 'vibekit';
        return `mongodb://${mongoUser}:${mongoPassword}@${host}:${port}/${mongoDatabase}`;

      case 'elasticsearch':
        return `http://${host}:${port}`;

      default:
        return `http://${host}:${port}`;
    }
  }

  /**
   * Get default port for service type
   */
  private getDefaultPort(type: ServiceConfig['type']): number {
    switch (type) {
      case 'postgresql': return 5432;
      case 'redis': return 6379;
      case 'mysql': return 3306;
      case 'mongodb': return 27017;
      case 'elasticsearch': return 9200;
      default: return 8080;
    }
  }

  /**
   * Start health checking for service
   */
  private startHealthCheck(environment: Environment, instance: ServiceInstance): void {
    if (!instance.config.healthCheck) return;

    const serviceKey = this.getServiceKey(environment.name, instance.config.name);
    const interval = setInterval(async () => {
      try {
        await this.checkServiceHealth(environment, instance.config.name);
      } catch (error) {
        console.warn(`Health check failed for ${instance.config.name}: ${error}`);
      }
    }, instance.config.healthCheck.interval || 30000);

    this.healthCheckIntervals.set(serviceKey, interval);
  }

  /**
   * Generate unique service key
   */
  private getServiceKey(environmentName: string, serviceName: string): string {
    return `${environmentName}:${serviceName}`;
  }
}

/**
 * Service connection information
 */
export interface ServiceConnectionInfo {
  serviceName: string;
  type: ServiceConfig['type'];
  host: string;
  port: number;
  connectionString: string;
  environment: Record<string, string>;
  healthy: boolean;
}

/**
 * Predefined service templates
 */
export const ServiceTemplates: Record<string, ServiceTemplate> = {
  postgresql: {
    name: 'PostgreSQL',
    type: 'postgresql',
    description: 'PostgreSQL database server',
    defaultConfig: {
      type: 'postgresql',
      version: '15',
      port: 5432,
      environment: {
        POSTGRES_DB: 'vibekit',
        POSTGRES_USER: 'vibekit',
        POSTGRES_PASSWORD: 'vibekit123',
      },
      healthCheck: {
        command: 'pg_isready -h localhost -p 5432',
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      persistence: {
        enabled: true,
      },
    },
    requiredPorts: [5432],
    environmentVariables: {
      DATABASE_URL: 'postgresql://vibekit:vibekit123@localhost:5432/vibekit',
    },
    healthCheckCommand: 'pg_isready -h localhost -p 5432',
  },

  redis: {
    name: 'Redis',
    type: 'redis',
    description: 'Redis in-memory data store',
    defaultConfig: {
      type: 'redis',
      version: '7-alpine',
      port: 6379,
      healthCheck: {
        command: 'redis-cli ping',
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
    },
    requiredPorts: [6379],
    environmentVariables: {
      REDIS_URL: 'redis://localhost:6379',
    },
    healthCheckCommand: 'redis-cli ping',
  },

  mysql: {
    name: 'MySQL',
    type: 'mysql',
    description: 'MySQL database server',
    defaultConfig: {
      type: 'mysql',
      version: '8',
      port: 3306,
      environment: {
        MYSQL_DATABASE: 'vibekit',
        MYSQL_USER: 'vibekit',
        MYSQL_PASSWORD: 'vibekit123',
        MYSQL_ROOT_PASSWORD: 'root123',
      },
      healthCheck: {
        command: 'mysqladmin ping -h localhost -P 3306 -u vibekit -pvibekit123',
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      persistence: {
        enabled: true,
      },
    },
    requiredPorts: [3306],
    environmentVariables: {
      DATABASE_URL: 'mysql://vibekit:vibekit123@localhost:3306/vibekit',
    },
    healthCheckCommand: 'mysqladmin ping -h localhost -P 3306 -u vibekit -pvibekit123',
  },

  mongodb: {
    name: 'MongoDB',
    type: 'mongodb',
    description: 'MongoDB document database',
    defaultConfig: {
      type: 'mongodb',
      version: '7',
      port: 27017,
      environment: {
        MONGO_INITDB_DATABASE: 'vibekit',
        MONGO_INITDB_ROOT_USERNAME: 'vibekit',
        MONGO_INITDB_ROOT_PASSWORD: 'vibekit123',
      },
      healthCheck: {
        command: 'mongosh --eval "db.adminCommand(\'ping\')" --quiet',
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      persistence: {
        enabled: true,
      },
    },
    requiredPorts: [27017],
    environmentVariables: {
      MONGODB_URL: 'mongodb://vibekit:vibekit123@localhost:27017/vibekit',
    },
    healthCheckCommand: 'mongosh --eval "db.adminCommand(\'ping\')" --quiet',
  },
};

/**
 * Global service manager instance
 */
export const globalServiceManager = new LocalServiceManager();

/**
 * Utility functions
 */

/**
 * Start service from template
 */
export async function startServiceFromTemplate(
  environment: Environment,
  templateName: string,
  overrides?: Partial<ServiceConfig>
): Promise<ServiceInstance> {
  const template = ServiceTemplates[templateName];
  if (!template) {
    throw new Error(`Service template '${templateName}' not found`);
  }

  const config: ServiceConfig = {
    name: templateName,
    type: template.type,
    ...template.defaultConfig,
    ...overrides,
  };

  return await globalServiceManager.startService(environment, config);
}

/**
 * Get service connection for environment variable injection
 */
export function getServiceEnvironmentVariables(environment: Environment): Record<string, string> {
  const services = globalServiceManager.listServices(environment);
  const envVars: Record<string, string> = {};

  for (const service of services) {
    const connection = globalServiceManager.getServiceConnection(environment, service.config.name);
    if (connection) {
      const template = ServiceTemplates[service.config.name];
      if (template) {
        Object.assign(envVars, template.environmentVariables);
      }
      
      // Add service-specific variables
      const prefix = service.config.name.toUpperCase();
      envVars[`${prefix}_HOST`] = connection.host;
      envVars[`${prefix}_PORT`] = connection.port.toString();
      envVars[`${prefix}_URL`] = connection.connectionString;
    }
  }

  return envVars;
} 