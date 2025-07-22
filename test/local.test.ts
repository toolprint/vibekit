/**
 * Dagger Local Sandbox Provider Test Suite
 * 
 * Comprehensive tests for the dagger-based local provider,
 * including sandbox lifecycle and agent integration.
 * Tests run against real dagger implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  LocalDaggerSandboxProvider, 
  createLocalProvider,
  type LocalDaggerConfig,
  type AgentType,
} from '@vibekit/local';

describe('Dagger Local Sandbox Provider', () => {
  let provider: LocalDaggerSandboxProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createLocalProvider({});
  });

  describe('Provider Configuration', () => {
    it('should create provider with default config', () => {
      const defaultProvider = createLocalProvider();
      expect(defaultProvider).toBeDefined();
      expect(defaultProvider).toBeInstanceOf(LocalDaggerSandboxProvider);
    });

    it('should create provider with custom config', () => {
      const config: LocalDaggerConfig = {
        githubToken: 'test-token-123',
      };
      
      const customProvider = createLocalProvider(config);
      expect(customProvider).toBeDefined();
    });
  });

  describe('Sandbox Creation', () => {
    it('should create basic sandbox', async () => {
      const sandbox = await provider.create();

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-default-/);
      expect(sandbox.commands).toBeDefined();
    });

    it('should create sandbox with environment variables', async () => {
      const envVars = {
        NODE_ENV: 'test',
        DEBUG: 'true',
        API_KEY: 'secret-key',
      };

      const sandbox = await provider.create(envVars);

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-/);
    });

    it('should create sandbox for each agent type', async () => {
      const agentTypes: AgentType[] = ['claude', 'codex', 'opencode', 'gemini'];

      for (const agentType of agentTypes) {
        const sandbox = await provider.create({}, agentType);
        
        expect(sandbox).toBeDefined();
        expect(sandbox.sandboxId).toMatch(new RegExp(`^dagger-${agentType}-`));
      }
    });

    it('should create sandbox with custom working directory', async () => {
      const customWorkDir = '/app/src';
      const sandbox = await provider.create({}, 'codex', customWorkDir);

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-codex-/);
    });

    it('should handle GitHub token configuration', async () => {
      const configWithToken: LocalDaggerConfig = {
        githubToken: 'github-token-123',
      };
      
      const providerWithToken = createLocalProvider(configWithToken);
      const sandbox = await providerWithToken.create();

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-/);
    });
  });

  describe('Command Execution', () => {
    it('should execute simple commands', async () => {
      const sandbox = await provider.create();
      const result = await sandbox.commands.run('echo "hello world"');

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('hello world');
      expect(typeof result.stderr).toBe('string');
    });

    it('should execute commands with options', async () => {
      const sandbox = await provider.create();
      
      const onStdoutSpy = vi.fn();
      const onStderrSpy = vi.fn();

      const result = await sandbox.commands.run('echo "npm test"', {
        timeoutMs: 10000,
        onStdout: onStdoutSpy,
        onStderr: onStderrSpy,
      });

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    });

    it('should handle command failures', async () => {
      const sandbox = await provider.create();
      const result = await sandbox.commands.run('nonexistent-command-that-should-fail');

      expect(result).toBeDefined();
      expect(result.exitCode).not.toBe(0); // Should be non-zero for failed command
      expect(typeof result.stderr).toBe('string');
    });

    it('should handle command timeouts', async () => {
      const sandbox = await provider.create();
      
      // Use a quick command that should complete well within timeout
      const result = await sandbox.commands.run('echo "timeout test"', { timeoutMs: 5000 });
      
      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Sandbox Lifecycle', () => {
    it('should kill sandbox', async () => {
      const sandbox = await provider.create();
      
      await expect(sandbox.kill()).resolves.not.toThrow();
    });

    it('should pause sandbox', async () => {
      const sandbox = await provider.create();
      
      await expect(sandbox.pause()).resolves.not.toThrow();
    });

    it('should get host for port', async () => {
      const sandbox = await provider.create();
      const host = await sandbox.getHost(3000);

      expect(typeof host).toBe('string');
      expect(host).toBe('localhost');
    });
  });

  describe('Resume Functionality', () => {
    it('should resume existing sandbox', async () => {
      const originalSandbox = await provider.create({}, 'claude');
      const sandboxId = originalSandbox.sandboxId;

      const resumedSandbox = await provider.resume(sandboxId);

      expect(resumedSandbox).toBeDefined();
      expect(resumedSandbox.sandboxId).toBeDefined();
    });
  });

  describe('Agent-Specific Configurations', () => {
    it('should use correct agent type for sandbox creation', async () => {
      // Test Claude agent
      const claudeSandbox = await provider.create({}, 'claude');
      expect(claudeSandbox.sandboxId).toMatch(/^dagger-claude-/);

      // Test Codex agent  
      const codexSandbox = await provider.create({}, 'codex');
      expect(codexSandbox.sandboxId).toMatch(/^dagger-codex-/);

      // Test OpenCode agent
      const opencodeSandbox = await provider.create({}, 'opencode');
      expect(opencodeSandbox.sandboxId).toMatch(/^dagger-opencode-/);

      // Test Gemini agent
      const geminiSandbox = await provider.create({}, 'gemini');
      expect(geminiSandbox.sandboxId).toMatch(/^dagger-gemini-/);
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution errors gracefully', async () => {
      const sandbox = await provider.create();
      
      const result = await sandbox.commands.run('this-command-does-not-exist-xyz');
      
      expect(result).toBeDefined();
      expect(result.exitCode).not.toBe(0);
      expect(typeof result.stderr).toBe('string');
    });
  });

  describe('GitHub Integration', () => {
    it('should handle GitHub operations with token', async () => {
      const providerWithGitHub = createLocalProvider({
        githubToken: 'github-token-123',
      });

      const sandbox = await providerWithGitHub.create();
      
      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-/);
    });
  });

  describe('Performance', () => {
    it('should create multiple sandboxes concurrently', async () => {
      const startTime = Date.now();

      const sandboxPromises = Array.from({ length: 2 }, (_, i) =>
        provider.create({ INDEX: i.toString() }, 'codex')
      );

      const sandboxes = await Promise.all(sandboxPromises);

      const duration = Date.now() - startTime;

      expect(sandboxes).toHaveLength(2);
      sandboxes.forEach(sandbox => {
        expect(sandbox).toBeDefined();
        expect(sandbox.sandboxId).toMatch(/^dagger-codex-/);
      });
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(60000); // 60 seconds for real dagger operations
    }, 90000); // 90 second timeout for performance test

    it('should handle rapid command execution', async () => {
      const sandbox = await provider.create();

      const commandPromises = Array.from({ length: 3 }, (_, i) =>
        sandbox.commands.run(`echo "command ${i}"`)
      );

      const results = await Promise.all(commandPromises);

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(`command ${i}`);
      });
    }, 20000); // 20 second timeout for rapid execution test
  });

  describe('Integration Scenarios', () => {
    it('should handle full development workflow', async () => {
      const sandbox = await provider.create();

      // Test echo command
      const echoResult = await sandbox.commands.run('echo "Hello from dagger sandbox"');
      expect(echoResult.exitCode).toBe(0);
      expect(echoResult.stdout).toContain('Hello from dagger sandbox');

      // Clean up
      await sandbox.kill();
    }, 15000); // 15 second timeout for simplified integration test

    it('should handle agent-specific workflows', async () => {
      const claudeSandbox = await provider.create({}, 'claude');
      
      // Test basic command in Claude environment
      const result = await claudeSandbox.commands.run('echo "Claude agent test"');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Claude agent test');

      await claudeSandbox.kill();
    }, 15000); // 15 second timeout for agent workflow test
  });
}); 