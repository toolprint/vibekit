/**
 * @vibekit/local - Local Sandbox Provider
 * 
 * Main entry point for the local provider package.
 * Exports all public APIs for Container Use integration.
 */

// Container Use wrapper and types
export { ContainerUseWrapper } from './container-use/wrapper';
export { ContainerUseParser } from './container-use/parser';
export * from './container-use/types';

// Installation and setup
export { ContainerUseInstaller } from './setup/installer';
export { DependencyValidator } from './setup/validator';
export type { 
  InstallationResult, 
  DependencyStatus 
} from './setup/installer';
export type { 
  ValidationResult, 
  ValidationIssue, 
  ValidationWarning 
} from './setup/validator';

// Provider and sandbox instances
export { LocalSandboxProvider, createLocalProvider } from './provider';
export { LocalSandboxInstance } from './sandbox-instance';
export type {
  LocalProviderConfig,
  SandboxProvider,
  SandboxInstance,
  SandboxCommands,
  SandboxCommandOptions,
  SandboxExecutionResult,
} from './provider';

// Environment management
export { EnvironmentManager } from './environment/manager';
export { EnvironmentLifecycle } from './environment/lifecycle';
export { EnvironmentSelector } from './environment/selector';
export { FileSynchronizer } from './environment/sync';
export { ResourceManager } from './environment/resources';

// Environment management types
export type { LifecycleOptions } from './environment/lifecycle';
export type { 
  SelectionCriteria,
  SelectionOptions,
  SelectionResult 
} from './environment/selector';
export type { 
  SyncOptions,
  SyncResult 
} from './environment/sync';
export type { 
  ResourceLimits,
  ResourceAlert,
  ResourceMonitoringOptions 
} from './environment/resources';

// Service management
export { 
  LocalServiceManager,
  ServiceTemplates,
  globalServiceManager,
  startServiceFromTemplate,
  getServiceEnvironmentVariables
} from './services/manager';
export type {
  ServiceConfig,
  ServiceInstance,
  ServiceTemplate,
  ServiceConnectionInfo
} from './services/manager';

// Re-export key types for convenience
export type {
  Environment,
  EnvironmentConfig,
  EnvironmentStatus,
  CreateEnvironmentOptions,
  ListEnvironmentsOptions,
  WatchOptions,
  TerminalOptions,
  LogEntry,
  PortMapping,
  ResourceUsage,
  MergeResult,
} from './container-use/types'; 