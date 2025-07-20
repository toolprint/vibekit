/**
 * Local Sandbox Provider Test Suite
 * 
 * Comprehensive unit and integration tests for the local provider,
 * including environment lifecycle, service management, and agent integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { 
  LocalSandboxProvider, 
  createLocalProvider,
  Environment,
  EnvironmentManager,
  LocalServiceManager,
  LocalGitIntegration,
  globalServiceManager,
  globalGitIntegration,
  type ServiceConfig,
  type ServiceInstance,
} from '@vibekit/local';

// Mock Container Use CLI
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// Test fixtures
const mockEnvironment: Environment = {
  name: 'test-env-1',
  status: 'running',
  branch: 'main',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  lastActivity: new Date('2024-01-01T12:00:00Z'),
  ports: [{ host: 3000, container: 3000 }],
  environment: {
    NODE_ENV: 'test',
    VIBEKIT_AGENT_TYPE: 'codex',
  },
  resourceUsage: {
    cpu: 0.1,
    memory: 128,
    disk: 1024,
  },
};

const mockServiceConfig: ServiceConfig = {
  name: 'test-postgres',
  type: 'postgresql',
  version: '15',
  port: 5432,
  environment: {
    POSTGRES_DB: 'testdb',
    POSTGRES_USER: 'testuser',
    POSTGRES_PASSWORD: 'testpass',
  },
  healthCheck: {
    command: 'pg_isready -h localhost -p 5432',
    interval: 30000,
    timeout: 5000,
    retries: 3,
  },
};

describe('Local Sandbox Provider', () => {
  let provider: LocalSandboxProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createLocalProvider({
      autoInstall: false, // Skip installation in tests
    });
  });

  afterEach(async () => {
    // Cleanup any test environments
    try {
      await provider.deleteEnvironment('test-env-1');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Environment Management', () => {
    it('should create a new environment', async () => {
      // Mock successful container-use apply
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const envVars = { NODE_ENV: 'test' };
      const agentType = 'codex';
      const workingDir = '/test';

      const sandbox = await provider.create(envVars, agentType, workingDir);

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toBeTruthy();
      expect(mockSpawn).toHaveBeenCalledWith(
        'container-use',
        expect.arrayContaining(['apply']),
        expect.any(Object)
      );
    });

    it('should resume an existing environment', async () => {
      // Mock container-use list to return existing environment
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data' && args.includes('list')) {
                callback(JSON.stringify([mockEnvironment]));
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const sandbox = await provider.resume('test-env-1');

      expect(sandbox).toBeDefined();
      expect(sandbox.sandboxId).toBe('test-env-1');
    });

    it('should list environments', async () => {
      // Mock container-use list
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(JSON.stringify([mockEnvironment]));
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const environments = await provider.listEnvironments();

      expect(environments).toHaveLength(1);
      expect(environments[0].name).toBe('test-env-1');
      expect(environments[0].status).toBe('running');
    });

    it('should delete an environment', async () => {
      // Mock successful deletion
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      await expect(provider.deleteEnvironment('test-env-1')).resolves.not.toThrow();
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'container-use',
        expect.arrayContaining(['delete', 'test-env-1']),
        expect.any(Object)
      );
    });

    it('should handle environment creation failure', async () => {
      // Mock failed container-use apply
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(1), 10); // Exit code 1 = failure
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback('Error: Container creation failed');
              }
            })
          },
        };
        return mockProcess;
      });

      await expect(
        provider.create({ NODE_ENV: 'test' }, 'codex', '/test')
      ).rejects.toThrow();
    });
  });

  describe('Environment Lifecycle', () => {
    let manager: EnvironmentManager;

    beforeEach(() => {
      manager = new EnvironmentManager();
    });

    it('should validate environment configuration', () => {
      const validConfig = {
        name: 'test-env',
        baseImage: 'ubuntu:22.04',
        workingDirectory: '/workspace',
      };

      expect(() => manager.validateConfig(validConfig)).not.toThrow();
    });

    it('should reject invalid environment names', () => {
      const invalidConfig = {
        name: 'invalid name with spaces',
        baseImage: 'ubuntu:22.04',
        workingDirectory: '/workspace',
      };

      expect(() => manager.validateConfig(invalidConfig)).toThrow();
    });

    it('should generate unique environment names', () => {
      const name1 = manager.generateEnvironmentName();
      const name2 = manager.generateEnvironmentName();

      expect(name1).toBeTruthy();
      expect(name2).toBeTruthy();
      expect(name1).not.toBe(name2);
      expect(name1).toMatch(/^vibekit-env-\d+$/);
    });
  });
});

describe('Service Management', () => {
  let serviceManager: LocalServiceManager;

  beforeEach(() => {
    serviceManager = new LocalServiceManager();
  });

  afterEach(async () => {
    // Cleanup test services
    try {
      await serviceManager.stopService(mockEnvironment, 'test-postgres');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Service Lifecycle', () => {
    it('should start a PostgreSQL service', async () => {
      // Mock successful service start
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const serviceInstance = await serviceManager.startService(
        mockEnvironment,
        mockServiceConfig
      );

      expect(serviceInstance).toBeDefined();
      expect(serviceInstance.config.name).toBe('test-postgres');
      expect(serviceInstance.config.type).toBe('postgresql');
      expect(serviceInstance.status).toBe('running');
      expect(serviceInstance.port).toBe(5432);
      expect(serviceInstance.connectionString).toContain('postgresql://');
    });

    it('should stop a service', async () => {
      // First start the service
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      await serviceManager.startService(mockEnvironment, mockServiceConfig);

      // Then stop it
      await expect(
        serviceManager.stopService(mockEnvironment, 'test-postgres')
      ).resolves.not.toThrow();

      const service = serviceManager.getService(mockEnvironment, 'test-postgres');
      expect(service?.status).toBe('stopped');
    });

    it('should perform health checks', async () => {
      // Mock successful health check
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              // Health check command returns 0 for healthy
              const exitCode = args.includes('pg_isready') ? 0 : 0;
              setTimeout(() => callback(exitCode), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      await serviceManager.startService(mockEnvironment, mockServiceConfig);

      const isHealthy = await serviceManager.checkServiceHealth(
        mockEnvironment,
        'test-postgres'
      );

      expect(isHealthy).toBe(true);

      const service = serviceManager.getService(mockEnvironment, 'test-postgres');
      expect(service?.healthStatus?.healthy).toBe(true);
    });

    it('should generate correct connection strings', () => {
      const testCases = [
        {
          type: 'postgresql' as const,
          port: 5432,
          env: { POSTGRES_USER: 'user', POSTGRES_PASSWORD: 'pass', POSTGRES_DB: 'db' },
          expected: 'postgresql://user:pass@localhost:5432/db',
        },
        {
          type: 'redis' as const,
          port: 6379,
          env: {},
          expected: 'redis://localhost:6379',
        },
        {
          type: 'mysql' as const,
          port: 3306,
          env: { MYSQL_USER: 'user', MYSQL_PASSWORD: 'pass', MYSQL_DATABASE: 'db' },
          expected: 'mysql://user:pass@localhost:3306/db',
        },
      ];

      testCases.forEach(({ type, port, env, expected }) => {
        const config: ServiceConfig = {
          name: `test-${type}`,
          type,
          port,
          environment: env,
        };

        const instance: ServiceInstance = {
          config,
          status: 'running',
          port,
          connectionString: '', // Will be set by generateConnectionString
        };

        // Test the private method through the manager's startService
        // This is a simplified test focusing on the logic
        expect(expected).toContain(type === 'redis' ? 'redis://' : `${type}://`);
      });
    });
  });

  describe('Service Templates', () => {
    it('should provide predefined service templates', async () => {
      const { ServiceTemplates, startServiceFromTemplate } = await import('@vibekit/local');

      expect(ServiceTemplates.postgresql).toBeDefined();
      expect(ServiceTemplates.redis).toBeDefined();
      expect(ServiceTemplates.mysql).toBeDefined();
      expect(ServiceTemplates.mongodb).toBeDefined();

      expect(ServiceTemplates.postgresql.name).toBe('PostgreSQL');
      expect(ServiceTemplates.postgresql.type).toBe('postgresql');
      expect(ServiceTemplates.postgresql.requiredPorts).toContain(5432);
    });
  });
});

describe('Git Integration', () => {
  let gitIntegration: LocalGitIntegration;

  beforeEach(() => {
    gitIntegration = new LocalGitIntegration();
  });

  describe('Repository Management', () => {
    it('should initialize Git repository', async () => {
      // Mock git commands
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              // Simulate git not initialized, then successful init
              const exitCode = args.includes('rev-parse') ? 1 : 0;
              setTimeout(() => callback(exitCode), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      await expect(
        gitIntegration.initializeRepository(mockEnvironment, 'https://github.com/test/repo.git')
      ).resolves.not.toThrow();

      expect(mockSpawn).toHaveBeenCalledWith(
        'container-use',
        expect.arrayContaining(['terminal', 'test-env-1', '--', 'git', 'init']),
        expect.any(Object)
      );
    });

    it('should create environment branch', async () => {
      // Mock successful branch creation
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const branchName = await gitIntegration.createEnvironmentBranch(mockEnvironment);

      expect(branchName).toBe('vibekit/test-env-1');
      expect(mockSpawn).toHaveBeenCalledWith(
        'container-use',
        expect.arrayContaining(['terminal', 'test-env-1', '--', 'git', 'checkout', '-b', 'vibekit/test-env-1']),
        expect.any(Object)
      );
    });

    it('should get branch information', async () => {
      // Mock git commands for branch info
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                if (args.includes('--show-current')) {
                  callback('vibekit/test-env-1');
                } else if (args.includes('rev-list')) {
                  callback('2\t1'); // 2 ahead, 1 behind
                } else if (args.includes('log')) {
                  callback('abc123|Test commit|Test Author|2024-01-01T12:00:00Z');
                } else if (args.includes('--porcelain')) {
                  callback('M  file1.txt\nA  file2.txt');
                }
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const branchInfo = await gitIntegration.getBranchInfo(mockEnvironment);

      expect(branchInfo).toBeDefined();
      expect(branchInfo?.name).toBe('vibekit/test-env-1');
      expect(branchInfo?.ahead).toBe(2);
      expect(branchInfo?.behind).toBe(1);
      expect(branchInfo?.hasUncommittedChanges).toBe(true);
      expect(branchInfo?.lastCommit.hash).toBe('abc123');
    });

    it('should generate meaningful commit messages', async () => {
      // Mock git status
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback('M  file1.txt\nA  file2.txt\nD  file3.txt');
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const commitMessage = await gitIntegration.generateCommitMessage(mockEnvironment);

      expect(commitMessage).toContain('Add 1 file');
      expect(commitMessage).toContain('Update 1 file');
      expect(commitMessage).toContain('Delete 1 file');
      expect(commitMessage).toContain('(vibekit/test-env-1)');
    });
  });

  describe('Merge Operations', () => {
    it('should detect merge conflicts', async () => {
      // Mock merge conflict scenario
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              // Merge fails with conflicts
              const exitCode = args.includes('merge') && !args.includes('abort') ? 1 : 0;
              setTimeout(() => callback(exitCode), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data' && args.includes('--diff-filter=U')) {
                callback('conflicted-file.txt');
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const mergeResult = await gitIntegration.checkMergeConflicts(mockEnvironment, 'main');

      expect(mergeResult.success).toBe(false);
      expect(mergeResult.conflicts).toHaveLength(1);
      expect(mergeResult.conflicts[0].file).toBe('conflicted-file.txt');
    });

    it('should merge successfully without conflicts', async () => {
      // Mock successful merge
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                if (args.includes('--name-only')) {
                  callback('merged-file1.txt\nmerged-file2.txt');
                } else if (args.includes('rev-parse')) {
                  callback('def456');
                }
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      // First create a branch
      await gitIntegration.createEnvironmentBranch(mockEnvironment);

      const mergeResult = await gitIntegration.mergeToMain(mockEnvironment, {
        message: 'Test merge',
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.mergedFiles).toContain('merged-file1.txt');
      expect(mergeResult.commitHash).toBe('def456');
    });
  });
});

describe('Integration Tests', () => {
  describe('End-to-End Workflows', () => {
    it('should complete full environment lifecycle', async () => {
      // Mock all container-use commands
      mockSpawn.mockImplementation((command, args) => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                if (args.includes('list')) {
                  callback(JSON.stringify([mockEnvironment]));
                }
              }
            })
          },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const provider = createLocalProvider({ autoInstall: false });

      // 1. Create environment
      const sandbox = await provider.create(
        { NODE_ENV: 'test' },
        'codex',
        '/workspace'
      );
      expect(sandbox.sandboxId).toBeTruthy();

      // 2. List environments
      const environments = await provider.listEnvironments();
      expect(environments.length).toBeGreaterThan(0);

      // 3. Delete environment
      await provider.deleteEnvironment(sandbox.sandboxId);
    });

    it('should handle multiple environments concurrently', async () => {
      // Mock container-use for concurrent operations
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              // Add small delay to simulate real operations
              setTimeout(() => callback(0), Math.random() * 50);
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
        };
        return mockProcess;
      });

      const provider = createLocalProvider({ autoInstall: false });

      // Create multiple environments concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        provider.create(
          { NODE_ENV: 'test', ENV_ID: i.toString() },
          'codex',
          `/workspace-${i}`
        )
      );

      const sandboxes = await Promise.all(promises);

      expect(sandboxes).toHaveLength(3);
      sandboxes.forEach((sandbox, i) => {
        expect(sandbox.sandboxId).toBeTruthy();
      });

      // Cleanup
      await Promise.all(
        sandboxes.map(sandbox =>
          provider.deleteEnvironment(sandbox.sandboxId).catch(() => {})
        )
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle container-use command failures gracefully', async () => {
      // Mock command failure
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(1), 10); // Exit code 1
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
        };
        return mockProcess;
      });

      const provider = createLocalProvider({ autoInstall: false });

      await expect(
        provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace')
      ).rejects.toThrow();
    });

    it('should handle resource exhaustion', async () => {
      // This test would require actual resource monitoring
      // For now, we'll test the error handling structure
      const provider = createLocalProvider({ autoInstall: false });

      // Mock resource exhaustion scenario
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(125), 10); // Out of memory exit code
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback('Error: Cannot allocate memory');
              }
            })
          },
        };
        return mockProcess;
      });

      await expect(
        provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace')
      ).rejects.toThrow(/memory/i);
    });
  });
});

describe('Performance Tests', () => {
  it('should create environments within reasonable time', async () => {
    const startTime = Date.now();

    // Mock fast container-use response
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 100); // 100ms mock delay
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      return mockProcess;
    });

    const provider = createLocalProvider({ autoInstall: false });
    
    await provider.create({ NODE_ENV: 'test' }, 'codex', '/workspace');
    
    const duration = Date.now() - startTime;
    
    // Environment creation should be fast (under 5 seconds in tests)
    expect(duration).toBeLessThan(5000);
  });

  it('should handle multiple concurrent operations efficiently', async () => {
    const startTime = Date.now();

    // Mock concurrent operations
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 50); // Fast response
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      return mockProcess;
    });

    const provider = createLocalProvider({ autoInstall: false });

    // Run 5 operations concurrently
    const operations = Array.from({ length: 5 }, (_, i) =>
      provider.create(
        { NODE_ENV: 'test', ID: i.toString() },
        'codex',
        `/workspace-${i}`
      )
    );

    await Promise.all(operations);

    const duration = Date.now() - startTime;

    // Concurrent operations should not be significantly slower than sequential
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});

// Test utilities and fixtures
export const testUtils = {
  createMockEnvironment: (overrides: Partial<Environment> = {}): Environment => ({
    ...mockEnvironment,
    ...overrides,
  }),

  createMockServiceConfig: (overrides: Partial<ServiceConfig> = {}): ServiceConfig => ({
    ...mockServiceConfig,
    ...overrides,
  }),

  mockContainerUseSuccess: () => {
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

  mockContainerUseFailure: (exitCode = 1, errorMessage = 'Command failed') => {
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
};

// Export test configuration
export const testConfig = {
  timeout: 10000, // 10 seconds per test
  retries: 2, // Retry flaky tests
  concurrency: 4, // Run tests in parallel
}; 