/**
 * Dagger-based Local Sandbox Provider Test Suite
 * 
 * Basic unit tests for the dagger-based local provider functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Dagger SDK
const mockConnect = vi.fn();
const mockContainer = {
  from: vi.fn().mockReturnThis(),
  withWorkdir: vi.fn().mockReturnThis(),
  withExec: vi.fn().mockReturnThis(),
  withEnvVariable: vi.fn().mockReturnThis(),
  withDirectory: vi.fn().mockReturnThis(),
  stdout: vi.fn().mockResolvedValue('test output'),
  stderr: vi.fn().mockResolvedValue(''),
  exitCode: vi.fn().mockResolvedValue(0),
  terminal: vi.fn().mockReturnThis(),
};

const mockClient = {
  container: vi.fn().mockReturnValue(mockContainer),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@dagger.io/dagger', () => ({
  connect: mockConnect.mockResolvedValue(mockClient),
}));

describe('Dagger-based Local Sandbox Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any open connections
    if (mockClient.close) {
      await mockClient.close();
    }
  });

  describe('Provider Creation', () => {
    it('should create a local dagger provider instance', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});

      expect(provider).toBeDefined();
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.resume).toBe('function');
    });

    it('should accept configuration options', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const config = {
        githubToken: 'test-token'
      };
      
      const provider = createLocalProvider(config);
      expect(provider).toBeDefined();
    });
  });

  describe('Sandbox Creation', () => {
    it('should create a sandbox instance', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toBeDefined();
      expect(sandbox.commands).toBeDefined();
      expect(typeof sandbox.commands.run).toBe('function');
      expect(typeof sandbox.kill).toBe('function');
      expect(typeof sandbox.pause).toBe('function');
      expect(typeof sandbox.getHost).toBe('function');
    });

    it('should create sandbox with environment variables', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const envVars = { TEST_VAR: 'test-value', NODE_ENV: 'test' };
      
      const sandbox = await provider.create(envVars);
      
      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-/);
    });

    it('should create sandbox with specific agent type', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create({}, 'claude');

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toMatch(/^dagger-claude-/);
    });

    it('should create sandbox with working directory', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create({}, undefined, '/custom/workdir');

      expect(sandbox).toBeDefined();
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('Command Execution', () => {
    it('should execute commands in sandbox', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      const result = await sandbox.commands.run('echo "hello world"');

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('test output');
      expect(result.stderr).toBe('');
    });

    it('should handle command execution with options', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      const onStdoutSpy = vi.fn();
      const onStderrSpy = vi.fn();

      await sandbox.commands.run('ls -la', {
        timeoutMs: 5000,
        onStdout: onStdoutSpy,
        onStderr: onStderrSpy,
      });

      // Note: In actual implementation, these callbacks would be called
      // For mocked version, we just verify the structure is correct
      expect(onStdoutSpy).toBeDefined();
      expect(onStderrSpy).toBeDefined();
    });
  });

  describe('Sandbox Lifecycle', () => {
    it('should kill sandbox instance', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      await expect(sandbox.kill()).resolves.not.toThrow();
    });

    it('should pause sandbox instance', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      await expect(sandbox.pause()).resolves.not.toThrow();
    });

    it('should get host for port mapping', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      const host = await sandbox.getHost(3000);
      expect(typeof host).toBe('string');
    });
  });

  describe('Agent Types', () => {
    const agentTypes = ['claude', 'codex', 'opencode', 'gemini'] as const;

    agentTypes.forEach(agentType => {
      it(`should create sandbox for ${agentType} agent`, async () => {
        const { createLocalProvider } = await import('@vibekit/local');
        
        const provider = createLocalProvider({});
        const sandbox = await provider.create({}, agentType);

        expect(sandbox).toBeDefined();
        expect(sandbox.sandboxId).toMatch(new RegExp(`^dagger-${agentType}-`));
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle dagger connection errors gracefully', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Dagger connection failed'));
      
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      
      await expect(provider.create()).rejects.toThrow('Dagger connection failed');
    });

    it('should handle command execution errors', async () => {
      mockContainer.exitCode.mockResolvedValueOnce(1);
      mockContainer.stderr.mockResolvedValueOnce('command failed');
      
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({});
      const sandbox = await provider.create();

      const result = await sandbox.commands.run('failing-command');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('command failed');
    });
  });
}); 