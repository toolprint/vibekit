/**
 * @vibekit/local - Local Sandbox Provider
 * 
 * Main entry point for the local provider package.
 * Exports all public APIs for Dagger integration.
 */

// Dagger integration
export { LocalDaggerSandboxProvider, createLocalProvider } from './dagger/vibekit-dagger';
export type {
  LocalDaggerConfig,
  SandboxExecutionResult,
  SandboxCommandOptions,
  SandboxCommands,
  SandboxInstance,
  SandboxProvider,
  AgentType,
} from './dagger/vibekit-dagger'; 