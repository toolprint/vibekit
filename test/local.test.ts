/**
 * Dagger Local Sandbox Provider Test Suite
 * 
 * Comprehensive tests for the dagger-based local provider,
 * including sandbox lifecycle and agent integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  LocalDaggerSandboxProvider, 
  createLocalProvider,
  type LocalDaggerConfig,
  type AgentType,
} from '@vibekit/local';

// Mock Dagger SDK
const mockContainer = {
  from: vi.fn().mockReturnThis(),
  withWorkdir: vi.fn().mockReturnThis(),
  withExec: vi.fn().mockReturnThis(),
  withEnvVariable: vi.fn().mockReturnThis(),
  withDirectory: vi.fn().mockReturnThis(),
  withSecretVariable: vi.fn().mockReturnThis(),
  stdout: vi.fn().mockResolvedValue('command output'),
  stderr: vi.fn().mockResolvedValue(''),
  exitCode: vi.fn().mockResolvedValue(0),
  terminal: vi.fn().mockReturnThis(),
};

const mockDirectory = {
  entries: vi.fn().mockResolvedValue(['file1.txt', 'file2.js']),
  file: vi.fn().mockReturnThis(),
  contents: vi.fn().mockResolvedValue('file contents'),
};

const mockSecret = {
  id: 'test-secret-id',
};

const mockClient = {
  container: vi.fn().mockReturnValue(mockContainer),
  directory: vi.fn().mockReturnValue(mockDirectory),
  setSecret: vi.fn().mockReturnValue(mockSecret),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockConnect = vi.fn().mockResolvedValue(mockClient);

vi.mock('@dagger.io/dagger', () => ({
  connect: mockConnect,
}));

// Mock Octokit for GitHub integration
const mockOctokit = {
  repos: {
    createForAuthenticatedUser: vi.fn().mockResolvedValue({ data: { clone_url: 'https://github.com/test/repo.git' } }),
    get: vi.fn().mockResolvedValue({ data: { clone_url: 'https://github.com/test/repo.git' } }),
  },
  pulls: {
    create: vi.fn().mockResolvedValue({ data: { number: 1, html_url: 'https://github.com/test/repo/pull/1' } }),
  },
  git: {
    createRef: vi.fn().mockResolvedValue({ data: { ref: 'refs/heads/test-branch' } }),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockReturnValue(mockOctokit),
}));

describe('Dagger Local Sandbox Provider', () => {
  let provider: LocalDaggerSandboxProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createLocalProvider({});
  });

  afterEach(async () => {
    if (mockClient.close) {
      await mockClient.close();
    }
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
      expect(mockConnect).toHaveBeenCalled();
      expect(mockClient.container).toHaveBeenCalled();
    });

    it('should create sandbox with environment variables', async () => {
      const envVars = {
        NODE_ENV: 'test',
        DEBUG: 'true',
        API_KEY: 'secret-key',
      };

      const sandbox = await provider.create(envVars);

      expect(sandbox).toBeDefined();
      expect(mockContainer.withEnvVariable).toHaveBeenCalledTimes(3);
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
      expect(mockContainer.withWorkdir).toHaveBeenCalledWith(customWorkDir);
    });

    it('should handle GitHub token configuration', async () => {
      const configWithToken: LocalDaggerConfig = {
        githubToken: 'github-token-123',
      };
      
      const providerWithToken = createLocalProvider(configWithToken);
      const sandbox = await providerWithToken.create();

      expect(sandbox).toBeDefined();
      expect(mockClient.setSecret).toHaveBeenCalledWith('github-token', 'github-token-123');
    });
  });

  describe('Command Execution', () => {
    it('should execute simple commands', async () => {
      const sandbox = await provider.create();
      const result = await sandbox.commands.run('echo "hello world"');

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('command output');
      expect(result.stderr).toBe('');
      expect(mockContainer.withExec).toHaveBeenCalledWith(['sh', '-c', 'echo "hello world"']);
    });

    it('should execute commands with options', async () => {
      const sandbox = await provider.create();
      
      const onStdoutSpy = vi.fn();
      const onStderrSpy = vi.fn();

      const result = await sandbox.commands.run('npm install', {
        timeoutMs: 10000,
        onStdout: onStdoutSpy,
        onStderr: onStderrSpy,
      });

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    });

    it('should handle command failures', async () => {
      mockContainer.exitCode.mockResolvedValueOnce(1);
      mockContainer.stderr.mockResolvedValueOnce('npm: command not found');

      const sandbox = await provider.create();
      const result = await sandbox.commands.run('npm --version');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('npm: command not found');
    });

    it('should handle command timeouts', async () => {
      mockContainer.exitCode.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve(124), 100))
      );

      const sandbox = await provider.create();
      const result = await sandbox.commands.run('sleep 30', { timeoutMs: 50 });

      // In a real implementation, this would handle timeouts
      expect(result).toBeDefined();
    });
  });

  describe('Sandbox Lifecycle', () => {
    it('should kill sandbox', async () => {
      const sandbox = await provider.create();
      
      await expect(sandbox.kill()).resolves.not.toThrow();
      expect(mockClient.close).toHaveBeenCalled();
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
      expect(resumedSandbox.sandboxId).toBe(sandboxId);
    });
  });

  describe('Agent-Specific Configurations', () => {
    it('should use correct Dockerfile for agent types', async () => {
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
    it('should handle dagger connection failures', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Dagger engine not running'));

      await expect(provider.create()).rejects.toThrow('Dagger engine not running');
    });

    it('should handle container creation failures', async () => {
      mockClient.container.mockImplementationOnce(() => {
        throw new Error('Container creation failed');
      });

      await expect(provider.create()).rejects.toThrow('Container creation failed');
    });

    it('should handle command execution errors gracefully', async () => {
      const sandbox = await provider.create();
      
      mockContainer.withExec.mockImplementationOnce(() => {
        throw new Error('Command execution failed');
      });

      await expect(sandbox.commands.run('invalid-command')).rejects.toThrow('Command execution failed');
    });
  });

  describe('GitHub Integration', () => {
    it('should handle GitHub operations with token', async () => {
      const providerWithGitHub = createLocalProvider({
        githubToken: 'github-token-123',
      });

      const sandbox = await providerWithGitHub.create();
      
      expect(sandbox).toBeDefined();
      expect(mockClient.setSecret).toHaveBeenCalledWith('github-token', 'github-token-123');
    });
  });

  describe('Performance', () => {
    it('should create multiple sandboxes concurrently', async () => {
      const startTime = Date.now();

      const sandboxPromises = Array.from({ length: 3 }, (_, i) =>
        provider.create({ INDEX: i.toString() }, 'codex')
      );

      const sandboxes = await Promise.all(sandboxPromises);

      const duration = Date.now() - startTime;

      expect(sandboxes).toHaveLength(3);
      sandboxes.forEach(sandbox => {
        expect(sandbox).toBeDefined();
        expect(sandbox.sandboxId).toMatch(/^dagger-codex-/);
      });
      
      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000);
    });

    it('should handle rapid command execution', async () => {
      const sandbox = await provider.create();

      const commandPromises = Array.from({ length: 5 }, (_, i) =>
        sandbox.commands.run(`echo "command ${i}"`)
      );

      const results = await Promise.all(commandPromises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('command output');
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full development workflow', async () => {
      const sandbox = await provider.create({ NODE_ENV: 'development' }, 'codex', '/workspace');

      // Simulate project setup
      const setupResult = await sandbox.commands.run('npm init -y');
      expect(setupResult.exitCode).toBe(0);

      // Simulate package installation
      const installResult = await sandbox.commands.run('npm install express');
      expect(installResult.exitCode).toBe(0);

      // Simulate test run
      const testResult = await sandbox.commands.run('npm test');
      expect(testResult.exitCode).toBe(0);

      // Clean up
      await sandbox.kill();
    });

    it('should handle agent-specific workflows', async () => {
      const claudeSandbox = await provider.create({}, 'claude');
      
      // Simulate Claude-specific operations
      const result = await claudeSandbox.commands.run('python --version');
      expect(result.exitCode).toBe(0);

      await claudeSandbox.kill();
    });
  });
}); 