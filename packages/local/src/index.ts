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