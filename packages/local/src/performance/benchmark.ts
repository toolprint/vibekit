/**
 * Performance Benchmark Suite
 * 
 * Benchmarks environment creation times, resource usage, and scalability
 * for local sandbox environments using Container Use.
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import type { Environment } from '../container-use/types';
import { LocalSandboxProvider, createLocalProvider } from '../provider';

export interface BenchmarkResult {
  operation: string;
  duration: number;
  success: boolean;
  memoryUsage: {
    before: number;
    after: number;
    delta: number;
  };
  resourceMetrics?: {
    cpu: number;
    memory: number;
    disk: number;
  };
  metadata?: Record<string, any>;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  results: BenchmarkResult[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalMemoryUsage: number;
  };
}

export interface PerformanceTargets {
  environmentCreation: number; // Max seconds
  environmentDeletion: number; // Max seconds
  maxMemoryPerEnvironment: number; // Max MB
  maxConcurrentEnvironments: number; // Max count
  operationsPerSecond: number; // Min ops/sec
}

/**
 * Default performance targets
 */
export const DEFAULT_PERFORMANCE_TARGETS: PerformanceTargets = {
  environmentCreation: 30, // 30 seconds
  environmentDeletion: 10, // 10 seconds
  maxMemoryPerEnvironment: 100, // 100 MB
  maxConcurrentEnvironments: 20, // 20 environments
  operationsPerSecond: 2, // 2 ops/sec minimum
};

/**
 * Performance Benchmark Runner
 */
export class PerformanceBenchmark {
  private provider: LocalSandboxProvider;
  private targets: PerformanceTargets;
  private results: BenchmarkSuite[] = [];

  constructor(targets: PerformanceTargets = DEFAULT_PERFORMANCE_TARGETS) {
    this.provider = createLocalProvider({ autoInstall: false });
    this.targets = targets;
  }

  /**
   * Run all performance benchmarks
   */
  async runAllBenchmarks(): Promise<BenchmarkSuite[]> {
    console.log('🚀 Starting Performance Benchmark Suite...\n');

    // Core operation benchmarks
    await this.benchmarkEnvironmentCreation();
    await this.benchmarkEnvironmentDeletion();
    await this.benchmarkConcurrentOperations();
    await this.benchmarkResourceUsage();
    await this.benchmarkScalability();

    // Generate summary report
    this.generateSummaryReport();

    return this.results;
  }

  /**
   * Benchmark environment creation performance
   */
  async benchmarkEnvironmentCreation(): Promise<BenchmarkSuite> {
    const suite: BenchmarkSuite = {
      name: 'Environment Creation',
      description: 'Measures time to create new sandbox environments',
      results: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalMemoryUsage: 0,
      },
    };

    console.log('📝 Benchmarking Environment Creation...');

    // Test environment creation with different configurations
    const testCases = [
      { name: 'Basic Environment', envVars: { NODE_ENV: 'test' } as Record<string, string>, agentType: 'codex' as const },
      { name: 'Environment with Secrets', envVars: { NODE_ENV: 'production', API_KEY: 'test' } as Record<string, string>, agentType: 'claude' as const },
      { name: 'Complex Environment', envVars: { NODE_ENV: 'development', DEBUG: 'true', PORT: '3000' } as Record<string, string>, agentType: 'gemini' as const },
    ];

    for (const testCase of testCases) {
      try {
        const result = await this.benchmarkOperation(
          `Create ${testCase.name}`,
          async () => {
            const sandbox = await this.provider.create(
              testCase.envVars,
              testCase.agentType,
              '/workspace'
            );
            return { sandboxId: sandbox.sandboxId };
          }
        );

        suite.results.push(result);

        // Cleanup
        if (result.success && result.metadata?.sandboxId) {
          await this.provider.deleteEnvironment(result.metadata.sandboxId);
        }

      } catch (error) {
        console.warn(`Failed to benchmark ${testCase.name}: ${error}`);
      }
    }

    this.calculateSuiteSummary(suite);
    this.results.push(suite);

    // Check against performance target
    if (suite.summary.averageDuration > this.targets.environmentCreation) {
      console.warn(`⚠️  Environment creation average (${suite.summary.averageDuration.toFixed(2)}s) exceeds target (${this.targets.environmentCreation}s)`);
    } else {
      console.log(`✅ Environment creation average (${suite.summary.averageDuration.toFixed(2)}s) meets target (${this.targets.environmentCreation}s)`);
    }

    return suite;
  }

  /**
   * Benchmark environment deletion performance
   */
  async benchmarkEnvironmentDeletion(): Promise<BenchmarkSuite> {
    const suite: BenchmarkSuite = {
      name: 'Environment Deletion',
      description: 'Measures time to delete sandbox environments',
      results: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalMemoryUsage: 0,
      },
    };

    console.log('🗑️  Benchmarking Environment Deletion...');

    // Create environments to delete
    const environmentsToDelete: string[] = [];

    for (let i = 0; i < 3; i++) {
      try {
        const sandbox = await this.provider.create(
          { NODE_ENV: 'test', TEST_ID: i.toString() },
          'codex',
          '/workspace'
        );
        environmentsToDelete.push(sandbox.sandboxId);
      } catch (error) {
        console.warn(`Failed to create test environment ${i}: ${error}`);
      }
    }

    // Benchmark deletion
    for (const envId of environmentsToDelete) {
      try {
        const result = await this.benchmarkOperation(
          `Delete Environment ${envId}`,
          async () => {
            await this.provider.deleteEnvironment(envId);
            return { deleted: true };
          }
        );

        suite.results.push(result);

      } catch (error) {
        console.warn(`Failed to benchmark deletion of ${envId}: ${error}`);
      }
    }

    this.calculateSuiteSummary(suite);
    this.results.push(suite);

    // Check against performance target
    if (suite.summary.averageDuration > this.targets.environmentDeletion) {
      console.warn(`⚠️  Environment deletion average (${suite.summary.averageDuration.toFixed(2)}s) exceeds target (${this.targets.environmentDeletion}s)`);
    } else {
      console.log(`✅ Environment deletion average (${suite.summary.averageDuration.toFixed(2)}s) meets target (${this.targets.environmentDeletion}s)`);
    }

    return suite;
  }

  /**
   * Benchmark concurrent operations
   */
  async benchmarkConcurrentOperations(): Promise<BenchmarkSuite> {
    const suite: BenchmarkSuite = {
      name: 'Concurrent Operations',
      description: 'Measures performance of parallel environment operations',
      results: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalMemoryUsage: 0,
      },
    };

    console.log('⚡ Benchmarking Concurrent Operations...');

    // Test different levels of concurrency
    const concurrencyLevels = [2, 5, 10];

    for (const concurrency of concurrencyLevels) {
      try {
        const result = await this.benchmarkOperation(
          `${concurrency} Concurrent Creates`,
          async () => {
            const operations = Array.from({ length: concurrency }, (_, i) =>
              this.provider.create(
                { NODE_ENV: 'test', CONCURRENT_ID: i.toString() },
                'codex',
                `/workspace-${i}`
              )
            );

            const sandboxes = await Promise.all(operations);
            
            // Cleanup
            await Promise.all(
              sandboxes.map(sandbox =>
                this.provider.deleteEnvironment(sandbox.sandboxId).catch(() => {})
              )
            );

            return { created: sandboxes.length };
          }
        );

        result.metadata = { ...result.metadata, concurrency };
        suite.results.push(result);

      } catch (error) {
        console.warn(`Failed to benchmark ${concurrency} concurrent operations: ${error}`);
      }
    }

    this.calculateSuiteSummary(suite);
    this.results.push(suite);

    return suite;
  }

  /**
   * Benchmark resource usage
   */
  async benchmarkResourceUsage(): Promise<BenchmarkSuite> {
    const suite: BenchmarkSuite = {
      name: 'Resource Usage',
      description: 'Measures memory and CPU usage during operations',
      results: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalMemoryUsage: 0,
      },
    };

    console.log('📊 Benchmarking Resource Usage...');

    // Create environments and measure resource usage
    const environments: string[] = [];

    try {
      // Create multiple environments to measure baseline resource usage
      for (let i = 0; i < 5; i++) {
        const result = await this.benchmarkOperation(
          `Create Environment ${i + 1} (Resource Monitoring)`,
          async () => {
            const sandbox = await this.provider.create(
              { NODE_ENV: 'test', RESOURCE_TEST: i.toString() },
              'codex',
              '/workspace'
            );

            // Get resource metrics
            const resourceMetrics = await this.getResourceMetrics();
            
            return { 
              sandboxId: sandbox.sandboxId,
              resourceMetrics 
            };
          }
        );

        if (result.success && result.metadata?.sandboxId) {
          environments.push(result.metadata.sandboxId);
        }

        suite.results.push(result);
      }

      // Measure idle resource usage
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const idleResult = await this.benchmarkOperation(
        'Idle Resource Usage',
        async () => {
          const resourceMetrics = await this.getResourceMetrics();
          return { resourceMetrics };
        }
      );

      suite.results.push(idleResult);

    } finally {
      // Cleanup environments
      await Promise.all(
        environments.map(envId =>
          this.provider.deleteEnvironment(envId).catch(() => {})
        )
      );
    }

    this.calculateSuiteSummary(suite);
    this.results.push(suite);

    return suite;
  }

  /**
   * Benchmark scalability with many environments
   */
  async benchmarkScalability(): Promise<BenchmarkSuite> {
    const suite: BenchmarkSuite = {
      name: 'Scalability',
      description: 'Tests performance with many parallel environments',
      results: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalMemoryUsage: 0,
      },
    };

    console.log('📈 Benchmarking Scalability...');

    const maxEnvironments = Math.min(this.targets.maxConcurrentEnvironments, 10); // Limit for testing
    const environments: string[] = [];

    try {
      // Gradually increase number of environments
      for (let count = 1; count <= maxEnvironments; count += Math.ceil(maxEnvironments / 5)) {
        const result = await this.benchmarkOperation(
          `Scale to ${count} Environments`,
          async () => {
            // Create environments up to the target count
            const neededEnvironments = count - environments.length;
            
            if (neededEnvironments > 0) {
              const createOperations = Array.from({ length: neededEnvironments }, (_, i) =>
                this.provider.create(
                  { NODE_ENV: 'test', SCALE_ID: (environments.length + i).toString() },
                  'codex',
                  `/workspace-scale-${environments.length + i}`
                )
              );

              const newSandboxes = await Promise.all(createOperations);
              environments.push(...newSandboxes.map(s => s.sandboxId));
            }

            // List all environments to test management overhead
            const allEnvironments = await this.provider.listEnvironments();
            
            return { 
              totalEnvironments: environments.length,
              listedEnvironments: allEnvironments.length 
            };
          }
        );

        result.metadata = { ...result.metadata, environmentCount: count };
        suite.results.push(result);

        // Check if we're hitting performance limits
        if (result.duration > this.targets.environmentCreation * 2) {
          console.warn(`⚠️  Performance degradation detected at ${count} environments`);
          break;
        }
      }

    } finally {
      // Cleanup all environments
      console.log(`🧹 Cleaning up ${environments.length} test environments...`);
      await Promise.all(
        environments.map(envId =>
          this.provider.deleteEnvironment(envId).catch(() => {})
        )
      );
    }

    this.calculateSuiteSummary(suite);
    this.results.push(suite);

    return suite;
  }

  /**
   * Benchmark a single operation
   */
  private async benchmarkOperation(
    name: string,
    operation: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    try {
      const result = await operation();
      const endTime = performance.now();
      const memoryAfter = this.getMemoryUsage();

      return {
        operation: name,
        duration: (endTime - startTime) / 1000, // Convert to seconds
        success: true,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          delta: memoryAfter - memoryBefore,
        },
        metadata: result,
      };

    } catch (error) {
      const endTime = performance.now();
      const memoryAfter = this.getMemoryUsage();

      return {
        operation: name,
        duration: (endTime - startTime) / 1000,
        success: false,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          delta: memoryAfter - memoryBefore,
        },
        metadata: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100; // MB with 2 decimal places
  }

  /**
   * Get system resource metrics
   */
  private async getResourceMetrics(): Promise<{ cpu: number; memory: number; disk: number }> {
    // This would ideally use system monitoring tools
    // For now, return mock data based on Node.js process
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memory: Math.round(usage.heapUsed / 1024 / 1024), // MB
      disk: 0, // Would need platform-specific implementation
    };
  }

  /**
   * Calculate summary statistics for a benchmark suite
   */
  private calculateSuiteSummary(suite: BenchmarkSuite): void {
    const successfulResults = suite.results.filter(r => r.success);
    
    suite.summary.totalOperations = suite.results.length;
    suite.summary.successfulOperations = successfulResults.length;
    
    if (successfulResults.length > 0) {
      const durations = successfulResults.map(r => r.duration);
      suite.summary.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      suite.summary.minDuration = Math.min(...durations);
      suite.summary.maxDuration = Math.max(...durations);
      suite.summary.totalMemoryUsage = successfulResults.reduce((total, r) => total + r.memoryUsage.delta, 0);
    }
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateSummaryReport(): void {
    console.log('\n📋 Performance Benchmark Summary Report');
    console.log('==========================================\n');

    for (const suite of this.results) {
      console.log(`📊 ${suite.name}`);
      console.log(`   Description: ${suite.description}`);
      console.log(`   Operations: ${suite.summary.successfulOperations}/${suite.summary.totalOperations} successful`);
      console.log(`   Average Duration: ${suite.summary.averageDuration.toFixed(2)}s`);
      console.log(`   Duration Range: ${suite.summary.minDuration.toFixed(2)}s - ${suite.summary.maxDuration.toFixed(2)}s`);
      console.log(`   Memory Usage: ${suite.summary.totalMemoryUsage.toFixed(2)} MB\n`);
    }

    // Overall assessment
    console.log('🎯 Performance Target Assessment');
    console.log('=================================');

    const creationSuite = this.results.find(s => s.name === 'Environment Creation');
    if (creationSuite) {
      const meetsTarget = creationSuite.summary.averageDuration <= this.targets.environmentCreation;
      console.log(`Environment Creation: ${meetsTarget ? '✅' : '❌'} ${creationSuite.summary.averageDuration.toFixed(2)}s (target: ${this.targets.environmentCreation}s)`);
    }

    const deletionSuite = this.results.find(s => s.name === 'Environment Deletion');
    if (deletionSuite) {
      const meetsTarget = deletionSuite.summary.averageDuration <= this.targets.environmentDeletion;
      console.log(`Environment Deletion: ${meetsTarget ? '✅' : '❌'} ${deletionSuite.summary.averageDuration.toFixed(2)}s (target: ${this.targets.environmentDeletion}s)`);
    }

    console.log('\n');
  }

  /**
   * Export benchmark results to JSON
   */
  exportResults(filePath?: string): string {
    const report = {
      timestamp: new Date().toISOString(),
      targets: this.targets,
      suites: this.results,
      summary: {
        totalSuites: this.results.length,
        totalOperations: this.results.reduce((total, suite) => total + suite.summary.totalOperations, 0),
        successfulOperations: this.results.reduce((total, suite) => total + suite.summary.successfulOperations, 0),
        overallDuration: this.results.reduce((total, suite) => total + suite.summary.averageDuration, 0),
      },
    };

    const json = JSON.stringify(report, null, 2);

    if (filePath) {
      const fs = require('fs');
      fs.writeFileSync(filePath, json);
      console.log(`📄 Benchmark results exported to: ${filePath}`);
    }

    return json;
  }
}

/**
 * Utility functions for performance testing
 */

/**
 * Run quick performance check
 */
export async function runQuickPerformanceCheck(): Promise<BenchmarkSuite[]> {
  const benchmark = new PerformanceBenchmark();
  
  console.log('🚀 Running Quick Performance Check...\n');
  
  // Run subset of benchmarks
  const results = [
    await benchmark.benchmarkEnvironmentCreation(),
    await benchmark.benchmarkConcurrentOperations(),
  ];

  console.log('✅ Quick Performance Check Complete\n');
  
  return results;
}

/**
 * Run full performance benchmark suite
 */
export async function runFullPerformanceBenchmark(
  targets?: Partial<PerformanceTargets>
): Promise<BenchmarkSuite[]> {
  const customTargets = { ...DEFAULT_PERFORMANCE_TARGETS, ...targets };
  const benchmark = new PerformanceBenchmark(customTargets);
  
  return await benchmark.runAllBenchmarks();
}

/**
 * Validate performance against targets
 */
export function validatePerformance(
  results: BenchmarkSuite[],
  targets: PerformanceTargets = DEFAULT_PERFORMANCE_TARGETS
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  const creationSuite = results.find(s => s.name === 'Environment Creation');
  if (creationSuite && creationSuite.summary.averageDuration > targets.environmentCreation) {
    failures.push(`Environment creation (${creationSuite.summary.averageDuration.toFixed(2)}s) exceeds target (${targets.environmentCreation}s)`);
  }

  const deletionSuite = results.find(s => s.name === 'Environment Deletion');
  if (deletionSuite && deletionSuite.summary.averageDuration > targets.environmentDeletion) {
    failures.push(`Environment deletion (${deletionSuite.summary.averageDuration.toFixed(2)}s) exceeds target (${targets.environmentDeletion}s)`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
} 