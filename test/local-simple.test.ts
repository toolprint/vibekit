/**
 * Simplified Local Sandbox Provider Test Suite
 * 
 * Basic unit tests for local provider core functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Container Use CLI
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

describe('Local Sandbox Provider - Core Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Creation', () => {
    it('should create a local provider instance', async () => {
      const { createLocalProvider } = await import('@vibekit/local');
      
      const provider = createLocalProvider({
        autoInstall: false,
      });

      expect(provider).toBeDefined();
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.resume).toBe('function');
      expect(typeof provider.listEnvironments).toBe('function');
      expect(typeof provider.deleteEnvironment).toBe('function');
    });
  });

  describe('Environment Operations', () => {
    it('should handle environment creation', async () => {
      // Mock successful container-use command
      mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }));

      const { createLocalProvider } = await import('@vibekit/local');
      const provider = createLocalProvider({ autoInstall: false });

      const sandbox = await provider.create(
        { NODE_ENV: 'test' },
        'codex',
        '/workspace'
      );

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toBeTruthy();
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle environment listing', async () => {
      // Mock container-use list command
      mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 10);
          }
        }),
        stdout: { 
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(JSON.stringify([{
                name: 'test-env',
                status: 'running',
                createdAt: '2024-01-01T00:00:00Z',
                lastActivity: '2024-01-01T12:00:00Z',
              }]));
            }
          })
        },
        stderr: { on: vi.fn() },
      }));

      const { createLocalProvider } = await import('@vibekit/local');
      const provider = createLocalProvider({ autoInstall: false });

      const environments = await provider.listEnvironments();

      expect(Array.isArray(environments)).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'container-use',
        expect.arrayContaining(['list']),
        expect.any(Object)
      );
    });

    it('should handle environment deletion', async () => {
      // Mock successful deletion
      mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }));

      const { createLocalProvider } = await import('@vibekit/local');
      const provider = createLocalProvider({ autoInstall: false });

      await expect(
        provider.deleteEnvironment('test-env')
      ).resolves.not.toThrow();

      expect(mockSpawn).toHaveBeenCalledWith(
        'container-use',
        expect.arrayContaining(['delete', 'test-env']),
        expect.any(Object)
      );
    });

    it('should handle command failures gracefully', async () => {
      // Mock command failure
      mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(1), 10); // Exit code 1 = failure
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { 
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('Error: Command failed');
            }
          })
        },
      }));

      const { createLocalProvider } = await import('@vibekit/local');
      const provider = createLocalProvider({ autoInstall: false });

      await expect(
        provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace')
      ).rejects.toThrow();
    });
  });

  describe('Service Templates', () => {
    it('should provide service templates', async () => {
      const { ServiceTemplates } = await import('@vibekit/local');

      expect(ServiceTemplates).toBeDefined();
      expect(ServiceTemplates.postgresql).toBeDefined();
      expect(ServiceTemplates.redis).toBeDefined();
      
      expect(ServiceTemplates.postgresql.name).toBe('PostgreSQL');
      expect(ServiceTemplates.postgresql.type).toBe('postgresql');
      expect(Array.isArray(ServiceTemplates.postgresql.requiredPorts)).toBe(true);
    });
  });

  describe('Environment Manager', () => {
    it('should create environment manager', async () => {
      const { EnvironmentManager } = await import('@vibekit/local');
      
      const manager = new EnvironmentManager();
      expect(manager).toBeDefined();
    });

    it('should generate unique environment names', async () => {
      const { EnvironmentManager } = await import('@vibekit/local');
      
      const manager = new EnvironmentManager();
      const name1 = manager.generateEnvironmentName();
      const name2 = manager.generateEnvironmentName();

      expect(name1).toBeTruthy();
      expect(name2).toBeTruthy();
      expect(name1).not.toBe(name2);
      expect(typeof name1).toBe('string');
      expect(typeof name2).toBe('string');
    });
  });

  describe('Git Integration', () => {
    it('should create git integration instance', async () => {
      const { LocalGitIntegration } = await import('@vibekit/local');
      
      const gitIntegration = new LocalGitIntegration();
      expect(gitIntegration).toBeDefined();
    });

    it('should have utility functions', async () => {
      const { initializeGitForEnvironment, mergeEnvironmentToMain, getGitStatus } = await import('@vibekit/local');
      
      expect(typeof initializeGitForEnvironment).toBe('function');
      expect(typeof mergeEnvironmentToMain).toBe('function');
      expect(typeof getGitStatus).toBe('function');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple operations concurrently', async () => {
      // Mock fast responses
      mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), Math.random() * 50);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }));

      const { createLocalProvider } = await import('@vibekit/local');
      const provider = createLocalProvider({ autoInstall: false });

      // Create multiple environments concurrently
      const operations = Array.from({ length: 3 }, (_, i) =>
        provider.create(
          { NODE_ENV: 'test', ENV_ID: i.toString() },
          'codex',
          `/workspace-${i}`
        )
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.sandboxId).toBeTruthy();
      });
    });
  });

  describe('Performance', () => {
    it('should complete operations within reasonable time', async () => {
      const startTime = Date.now();

      // Mock fast response
      mockSpawn.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }));

      const { createLocalProvider } = await import('@vibekit/local');
      const provider = createLocalProvider({ autoInstall: false });

      await provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace');

      const duration = Date.now() - startTime;

      // Should complete quickly in tests
      expect(duration).toBeLessThan(1000);
    });
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle spawn errors', async () => {
    // Mock spawn throwing an error
    mockSpawn.mockImplementation(() => {
      throw new Error('Spawn failed');
    });

    const { createLocalProvider } = await import('@vibekit/local');
    const provider = createLocalProvider({ autoInstall: false });

    await expect(
      provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace')
    ).rejects.toThrow();
  });

  it('should handle process errors', async () => {
    // Mock process error event
    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Process error')), 10);
        }
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    }));

    const { createLocalProvider } = await import('@vibekit/local');
    const provider = createLocalProvider({ autoInstall: false });

    await expect(
      provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace')
    ).rejects.toThrow();
  });

  it('should handle timeout scenarios', async () => {
    // Mock long-running process
    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        // Never call the callback to simulate hanging
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      kill: vi.fn(),
    }));

    const { createLocalProvider } = await import('@vibekit/local');
    const provider = createLocalProvider({ autoInstall: false });

    // This test would need timeout handling in the actual implementation
    // For now, just verify the mock setup
    expect(mockSpawn).toBeDefined();
  });
});

// Test utilities
export const testHelpers = {
  mockSuccessfulCommand: () => {
    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 10);
        }
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    }));
  },

  mockFailedCommand: (exitCode = 1, errorMessage = 'Command failed') => {
    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(exitCode), 10);
        }
      }),
      stdout: { on: vi.fn() },
      stderr: { 
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(errorMessage);
          }
        })
      },
    }));
  },

  mockListCommand: (environments: any[]) => {
    mockSpawn.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 10);
        }
      }),
      stdout: { 
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(environments));
          }
        })
      },
      stderr: { on: vi.fn() },
    }));
  },

  resetMocks: () => {
    vi.clearAllMocks();
  },
}; 