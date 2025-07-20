/**
 * Container Use Integration Types
 * 
 * Type definitions for Container Use CLI operations and data structures
 */

// Environment status from Container Use
export type EnvironmentStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

// Environment configuration
export interface EnvironmentConfig {
  name: string;
  baseImage?: string;
  setupCommands?: string[];
  workingDirectory?: string;
  ports?: number[];
  environment?: Record<string, string>;
  secrets?: Record<string, string>;
  services?: ServiceConfig[];
  resources?: ResourceLimits;
}

// Service configuration for databases, etc.
export interface ServiceConfig {
  name: string;
  image: string;
  ports?: number[];
  environment?: Record<string, string>;
  volumes?: string[];
}

// Resource limits for containers
export interface ResourceLimits {
  memory?: string; // e.g., "2g", "512m"
  cpu?: string;    // e.g., "1", "0.5"
  diskSpace?: string;
}

// Environment metadata from list/inspect commands
export interface Environment {
  name: string;
  status: EnvironmentStatus;
  branch: string;
  baseImage: string;
  createdAt: string;
  lastActivityAt?: string;
  ports?: PortMapping[];
  services?: RunningService[];
  resources?: ResourceUsage;
  gitCommit?: string;
  workingDirectory: string;
  environment?: Record<string, string>; // Environment variables
}

// Port mapping information
export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: 'tcp' | 'udp';
}

// Running service information
export interface RunningService {
  name: string;
  status: 'running' | 'stopped' | 'error';
  ports?: PortMapping[];
}

// Resource usage stats
export interface ResourceUsage {
  memory: {
    used: string;
    limit: string;
    percentage: number;
  };
  cpu: {
    percentage: number;
  };
  disk: {
    used: string;
    available: string;
  };
}

// Git branch information
export interface GitBranch {
  name: string;
  environment?: string;
  lastCommit: string;
  isDirty: boolean;
}

// Container Use CLI command options
export interface CommandOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  stdio?: 'pipe' | 'inherit' | 'ignore';
}

// Command execution result
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

// Streaming command result
export interface StreamingCommandResult {
  process: any; // Child process
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  stop: () => Promise<void>;
}

// Container Use configuration
export interface ContainerUseConfig {
  baseImage: string;
  defaultWorkingDirectory: string;
  defaultPorts: number[];
  resources: ResourceLimits;
  setupCommands: string[];
  environment: Record<string, string>;
}

// Error types
export class ContainerUseError extends Error {
  constructor(
    message: string,
    public command: string,
    public exitCode: number,
    public stderr: string
  ) {
    super(message);
    this.name = 'ContainerUseError';
  }
}

export class EnvironmentNotFoundError extends ContainerUseError {
  constructor(environmentName: string) {
    super(
      `Environment '${environmentName}' not found`,
      'list',
      1,
      `Environment '${environmentName}' does not exist`
    );
    this.name = 'EnvironmentNotFoundError';
  }
}

export class DockerNotAvailableError extends Error {
  constructor() {
    super('Docker is not available or not running');
    this.name = 'DockerNotAvailableError';
  }
}

export class ContainerUseNotInstalledError extends Error {
  constructor() {
    super('Container Use is not installed');
    this.name = 'ContainerUseNotInstalledError';
  }
}

// Log entry from watch/log commands
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'container' | 'system' | 'git' | 'service';
  message: string;
  data?: any;
}

// Merge operation result
export interface MergeResult {
  success: boolean;
  conflicts?: string[];
  mergedFiles: string[];
  branch: string;
  commit: string;
}

// Environment creation options
export interface CreateEnvironmentOptions {
  name?: string;
  baseImage?: string;
  branch?: string;
  copyFrom?: string;
  setupCommands?: string[];
  ports?: number[];
  services?: ServiceConfig[];
  resources?: ResourceLimits;
  environment?: Record<string, string>;
}

// Environment list options
export interface ListEnvironmentsOptions {
  status?: EnvironmentStatus;
  branch?: string;
  includeInactive?: boolean;
}

// Watch options
export interface WatchOptions {
  follow?: boolean;
  tail?: number;
  filter?: {
    level?: string;
    source?: string;
  };
}

// Terminal options
export interface TerminalOptions {
  shell?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

// Version information
export interface VersionInfo {
  version: string;
  gitCommit: string;
  buildDate: string;
  platform: string;
} 