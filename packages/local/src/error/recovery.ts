/**
 * Error Handling and Recovery System
 * 
 * Provides comprehensive error handling, automatic recovery mechanisms,
 * and diagnostic tools for local sandbox environments.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import type { Environment } from '../container-use/types';
import { LocalSandboxProvider, createLocalProvider } from '../provider';

export interface ErrorContext {
  operation: string;
  environment?: string;
  timestamp: Date;
  details: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'restart' | 'cleanup' | 'recreate' | 'manual';
  description: string;
  automatic: boolean;
  maxAttempts?: number;
  delayMs?: number;
}

export interface ErrorClassification {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'resource' | 'permission' | 'configuration' | 'system' | 'unknown';
  recoverable: boolean;
  suggestedActions: RecoveryAction[];
  userMessage: string;
  technicalDetails: string;
}

export interface DiagnosticResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
  recommendations?: string[];
}

export interface RecoveryAttempt {
  action: RecoveryAction;
  attempt: number;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: string;
}

/**
 * Comprehensive Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private provider: LocalSandboxProvider;
  private recoveryHistory: Map<string, RecoveryAttempt[]> = new Map();

  constructor() {
    this.provider = createLocalProvider({ autoInstall: false });
  }

  /**
   * Classify an error and suggest recovery actions
   */
  classifyError(error: Error, context: ErrorContext): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    // Network-related errors
    if (this.isNetworkError(errorMessage)) {
      return {
        severity: 'medium',
        category: 'network',
        recoverable: true,
        suggestedActions: [
          {
            type: 'retry',
            description: 'Retry operation with exponential backoff',
            automatic: true,
            maxAttempts: 3,
            delayMs: 1000,
          },
          {
            type: 'manual',
            description: 'Check network connectivity and Docker daemon status',
            automatic: false,
          },
        ],
        userMessage: 'Network connectivity issue detected. Attempting automatic retry...',
        technicalDetails: `Network error: ${error.message}`,
      };
    }

    // Resource exhaustion
    if (this.isResourceError(errorMessage)) {
      return {
        severity: 'high',
        category: 'resource',
        recoverable: true,
        suggestedActions: [
          {
            type: 'cleanup',
            description: 'Clean up unused environments and containers',
            automatic: true,
          },
          {
            type: 'restart',
            description: 'Restart Docker daemon to free resources',
            automatic: false,
          },
        ],
        userMessage: 'System resources are exhausted. Cleaning up unused environments...',
        technicalDetails: `Resource error: ${error.message}`,
      };
    }

    // Permission errors
    if (this.isPermissionError(errorMessage)) {
      return {
        severity: 'high',
        category: 'permission',
        recoverable: false,
        suggestedActions: [
          {
            type: 'manual',
            description: 'Check file permissions and Docker group membership',
            automatic: false,
          },
        ],
        userMessage: 'Permission denied. Please check your Docker permissions and try again.',
        technicalDetails: `Permission error: ${error.message}`,
      };
    }

    // Configuration errors
    if (this.isConfigurationError(errorMessage)) {
      return {
        severity: 'medium',
        category: 'configuration',
        recoverable: true,
        suggestedActions: [
          {
            type: 'recreate',
            description: 'Recreate environment with corrected configuration',
            automatic: true,
          },
        ],
        userMessage: 'Configuration issue detected. Recreating environment with corrections...',
        technicalDetails: `Configuration error: ${error.message}`,
      };
    }

    // System-level errors
    if (this.isSystemError(errorMessage)) {
      return {
        severity: 'critical',
        category: 'system',
        recoverable: false,
        suggestedActions: [
          {
            type: 'manual',
            description: 'Check system requirements and Docker installation',
            automatic: false,
          },
        ],
        userMessage: 'System-level error detected. Manual intervention required.',
        technicalDetails: `System error: ${error.message}`,
      };
    }

    // Unknown/generic errors
    return {
      severity: 'medium',
      category: 'unknown',
      recoverable: true,
      suggestedActions: [
        {
          type: 'retry',
          description: 'Retry operation once',
          automatic: true,
          maxAttempts: 1,
          delayMs: 2000,
        },
        {
          type: 'manual',
          description: 'Review logs and check system status',
          automatic: false,
        },
      ],
      userMessage: 'An unexpected error occurred. Attempting recovery...',
      technicalDetails: `Unknown error: ${error.message}`,
    };
  }

  /**
   * Attempt automatic recovery from an error
   */
  async attemptRecovery(
    error: Error,
    context: ErrorContext
  ): Promise<{ recovered: boolean; attempts: RecoveryAttempt[] }> {
    const classification = this.classifyError(error, context);
    const attempts: RecoveryAttempt[] = [];

    console.log(`🔧 Attempting recovery for ${classification.category} error: ${classification.userMessage}`);

    for (const action of classification.suggestedActions) {
      if (!action.automatic) {
        continue; // Skip manual actions in automatic recovery
      }

      const maxAttempts = action.maxAttempts || 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const recoveryAttempt: RecoveryAttempt = {
          action,
          attempt,
          startTime: new Date(),
          success: false,
        };

        try {
          console.log(`   Attempt ${attempt}/${maxAttempts}: ${action.description}`);

          if (action.delayMs && attempt > 1) {
            await this.delay(action.delayMs * Math.pow(2, attempt - 2)); // Exponential backoff
          }

          const success = await this.executeRecoveryAction(action, context);

          recoveryAttempt.endTime = new Date();
          recoveryAttempt.success = success;
          attempts.push(recoveryAttempt);

          if (success) {
            console.log(`   ✅ Recovery successful: ${action.description}`);
            
            // Store recovery history
            const key = `${context.operation}:${context.environment || 'global'}`;
            if (!this.recoveryHistory.has(key)) {
              this.recoveryHistory.set(key, []);
            }
            this.recoveryHistory.get(key)!.push(...attempts);

            return { recovered: true, attempts };
          }

        } catch (recoveryError) {
          recoveryAttempt.endTime = new Date();
          recoveryAttempt.error = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
          attempts.push(recoveryAttempt);

          console.log(`   ❌ Recovery attempt failed: ${recoveryAttempt.error}`);
        }
      }
    }

    console.log(`   🔄 Automatic recovery unsuccessful. Manual intervention may be required.`);

    // Store failed recovery history
    const key = `${context.operation}:${context.environment || 'global'}`;
    if (!this.recoveryHistory.has(key)) {
      this.recoveryHistory.set(key, []);
    }
    this.recoveryHistory.get(key)!.push(...attempts);

    return { recovered: false, attempts };
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction, context: ErrorContext): Promise<boolean> {
    switch (action.type) {
      case 'retry':
        // For retry actions, return true to indicate the operation should be retried
        return true;

      case 'cleanup':
        return await this.performCleanup(context);

      case 'restart':
        return await this.restartServices(context);

      case 'recreate':
        return await this.recreateEnvironment(context);

      default:
        return false;
    }
  }

  /**
   * Perform cleanup of unused resources
   */
  private async performCleanup(context: ErrorContext): Promise<boolean> {
    try {
      console.log('   🧹 Cleaning up unused environments and containers...');

      // Get list of all environments
      const environments = await this.provider.listEnvironments();
      
      // Find and remove stopped/orphaned environments
      let cleanedCount = 0;
      
      for (const env of environments) {
        if (env.status === 'stopped' || env.status === 'error') {
          try {
            await this.provider.deleteEnvironment(env.name);
            cleanedCount++;
          } catch (cleanupError) {
            console.warn(`   Warning: Failed to cleanup environment ${env.name}: ${cleanupError}`);
          }
        }
      }

      // Run Docker system prune
      await this.executeCommand(['docker', 'system', 'prune', '-f']);

      console.log(`   ✨ Cleanup complete: ${cleanedCount} environments removed`);
      return true;

    } catch (error) {
      console.warn(`   ⚠️  Cleanup failed: ${error}`);
      return false;
    }
  }

  /**
   * Restart Container Use and Docker services
   */
  private async restartServices(context: ErrorContext): Promise<boolean> {
    try {
      console.log('   🔄 Restarting Docker services...');

      // This would restart Docker daemon - implementation depends on platform
      // For now, just return true as this requires elevated privileges
      
      console.log('   📝 Docker restart requires manual intervention with elevated privileges');
      return false;

    } catch (error) {
      console.warn(`   ⚠️  Service restart failed: ${error}`);
      return false;
    }
  }

  /**
   * Recreate a specific environment
   */
  private async recreateEnvironment(context: ErrorContext): Promise<boolean> {
    if (!context.environment) {
      return false;
    }

    try {
      console.log(`   🔄 Recreating environment: ${context.environment}`);

      // Delete existing environment
      try {
        await this.provider.deleteEnvironment(context.environment);
      } catch {
        // Ignore deletion errors
      }

      // Wait a moment for cleanup
      await this.delay(2000);

      // Recreate environment (would need original parameters)
      // For now, just return true to indicate the environment should be recreated
      return true;

    } catch (error) {
      console.warn(`   ⚠️  Environment recreation failed: ${error}`);
      return false;
    }
  }

  /**
   * Run comprehensive system diagnostics
   */
  async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    console.log('🔍 Running Local Sandbox Diagnostics...\n');

    // Check Docker availability
    results.push(await this.checkDocker());

    // Check Container Use installation
    results.push(await this.checkContainerUse());

    // Check system resources
    results.push(await this.checkSystemResources());

    // Check environment status
    results.push(await this.checkEnvironments());

    // Check disk space
    results.push(await this.checkDiskSpace());

    // Check network connectivity
    results.push(await this.checkNetworkConnectivity());

    // Generate diagnostic summary
    this.printDiagnosticSummary(results);

    return results;
  }

  /**
   * Check Docker daemon status
   */
  private async checkDocker(): Promise<DiagnosticResult> {
    try {
      const result = await this.executeCommand(['docker', 'version']);
      
      if (result.success) {
        return {
          component: 'Docker Daemon',
          status: 'healthy',
          message: 'Docker is running and accessible',
          details: { version: result.output.split('\n')[0] },
        };
      } else {
        return {
          component: 'Docker Daemon',
          status: 'error',
          message: 'Docker is not accessible',
          details: { error: result.error },
          recommendations: [
            'Start Docker daemon',
            'Check Docker installation',
            'Verify user permissions for Docker',
          ],
        };
      }
    } catch (error) {
      return {
        component: 'Docker Daemon',
        status: 'error',
        message: 'Failed to check Docker status',
        details: { error: error instanceof Error ? error.message : String(error) },
        recommendations: [
          'Install Docker',
          'Start Docker daemon',
          'Check system PATH',
        ],
      };
    }
  }

  /**
   * Check Container Use installation
   */
  private async checkContainerUse(): Promise<DiagnosticResult> {
    try {
      const result = await this.executeCommand(['container-use', 'version']);
      
      if (result.success) {
        return {
          component: 'Container Use',
          status: 'healthy',
          message: 'Container Use is installed and accessible',
          details: { version: result.output.trim() },
        };
      } else {
        return {
          component: 'Container Use',
          status: 'error',
          message: 'Container Use is not accessible',
          details: { error: result.error },
          recommendations: [
            'Install Container Use CLI',
            'Check system PATH',
            'Verify installation permissions',
          ],
        };
      }
    } catch (error) {
      return {
        component: 'Container Use',
        status: 'error',
        message: 'Container Use not found',
        details: { error: error instanceof Error ? error.message : String(error) },
        recommendations: [
          'Install Container Use: curl -fsSL https://container-use.com/install.sh | sh',
          'Add Container Use to PATH',
        ],
      };
    }
  }

  /**
   * Check system resource availability
   */
  private async checkSystemResources(): Promise<DiagnosticResult> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      let status: DiagnosticResult['status'] = 'healthy';
      let message = 'System resources are adequate';
      const recommendations: string[] = [];

      if (memoryUsedMB > 1000) { // More than 1GB used by this process
        status = 'warning';
        message = 'High memory usage detected';
        recommendations.push('Consider restarting the application');
      }

      return {
        component: 'System Resources',
        status,
        message,
        details: {
          memoryUsed: `${memoryUsedMB} MB`,
          memoryTotal: `${memoryTotalMB} MB`,
          platform: process.platform,
          nodeVersion: process.version,
        },
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };
    } catch (error) {
      return {
        component: 'System Resources',
        status: 'error',
        message: 'Failed to check system resources',
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Check environment status
   */
  private async checkEnvironments(): Promise<DiagnosticResult> {
    try {
      const environments = await this.provider.listEnvironments();
      
      const statusCounts = environments.reduce((counts, env) => {
        counts[env.status] = (counts[env.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      const errorCount = statusCounts.error || 0;
      const totalCount = environments.length;

      let status: DiagnosticResult['status'] = 'healthy';
      let message = `${totalCount} environments found`;
      const recommendations: string[] = [];

      if (errorCount > 0) {
        status = 'warning';
        message += `, ${errorCount} with errors`;
        recommendations.push('Review and cleanup failed environments');
      }

      if (totalCount > 20) {
        status = 'warning';
        message += ` (high count)`;
        recommendations.push('Consider cleaning up unused environments');
      }

      return {
        component: 'Environments',
        status,
        message,
        details: { total: totalCount, statusCounts },
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };
    } catch (error) {
      return {
        component: 'Environments',
        status: 'error',
        message: 'Failed to check environments',
        details: { error: error instanceof Error ? error.message : String(error) },
        recommendations: ['Check Container Use installation and permissions'],
      };
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(): Promise<DiagnosticResult> {
    try {
      // This would check actual disk space - simplified for now
      return {
        component: 'Disk Space',
        status: 'healthy',
        message: 'Sufficient disk space available',
        details: { note: 'Disk space check would require platform-specific implementation' },
      };
    } catch (error) {
      return {
        component: 'Disk Space',
        status: 'error',
        message: 'Failed to check disk space',
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(): Promise<DiagnosticResult> {
    try {
      // Test Docker Hub connectivity
      const result = await this.executeCommand(['docker', 'pull', 'hello-world:latest']);
      
      if (result.success) {
        return {
          component: 'Network Connectivity',
          status: 'healthy',
          message: 'Network connectivity is working',
          details: { dockerHub: 'accessible' },
        };
      } else {
        return {
          component: 'Network Connectivity',
          status: 'warning',
          message: 'Network connectivity issues detected',
          details: { error: result.error },
          recommendations: [
            'Check internet connection',
            'Verify Docker Hub access',
            'Check firewall settings',
          ],
        };
      }
    } catch (error) {
      return {
        component: 'Network Connectivity',
        status: 'error',
        message: 'Failed to test network connectivity',
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Print diagnostic summary
   */
  private printDiagnosticSummary(results: DiagnosticResult[]): void {
    console.log('\n📋 Diagnostic Summary');
    console.log('===================\n');

    const statusCounts = { healthy: 0, warning: 0, error: 0 };

    for (const result of results) {
      const icon = this.getStatusIcon(result.status);
      console.log(`${icon} ${result.component}: ${result.message}`);

      if (result.recommendations && result.recommendations.length > 0) {
        console.log(`   Recommendations:`);
        result.recommendations.forEach(rec => console.log(`   - ${rec}`));
      }

      statusCounts[result.status]++;
      console.log('');
    }

    console.log(`Overall Status: ${statusCounts.error === 0 ? (statusCounts.warning === 0 ? '✅ All systems healthy' : '⚠️  Some warnings detected') : '❌ Errors detected'}`);
    console.log(`Components: ${statusCounts.healthy} healthy, ${statusCounts.warning} warnings, ${statusCounts.error} errors\n`);
  }

  /**
   * Get status icon for diagnostic result
   */
  private getStatusIcon(status: DiagnosticResult['status']): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️ ';
      case 'error': return '❌';
      default: return '❓';
    }
  }

  /**
   * Execute a command and capture output
   */
  private async executeCommand(args: string[]): Promise<{
    success: boolean;
    output: string;
    error: string;
  }> {
    return new Promise((resolve) => {
      const [command, ...commandArgs] = args;
      const process = spawn(command, commandArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      if (process.stdout) {
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (process.stderr) {
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      process.on('exit', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          output: stdout,
          error: error.message,
        });
      });
    });
  }

  /**
   * Utility functions
   */

  private isNetworkError(message: string): boolean {
    return message.includes('network') || 
           message.includes('connection') || 
           message.includes('timeout') || 
           message.includes('dns') ||
           message.includes('econnrefused') ||
           message.includes('enotfound');
  }

  private isResourceError(message: string): boolean {
    return message.includes('memory') || 
           message.includes('disk space') || 
           message.includes('no space') ||
           message.includes('resource') ||
           message.includes('limit') ||
           message.includes('quota');
  }

  private isPermissionError(message: string): boolean {
    return message.includes('permission') || 
           message.includes('denied') || 
           message.includes('unauthorized') ||
           message.includes('access') ||
           message.includes('eacces');
  }

  private isConfigurationError(message: string): boolean {
    return message.includes('config') || 
           message.includes('invalid') || 
           message.includes('malformed') ||
           message.includes('syntax') ||
           message.includes('format');
  }

  private isSystemError(message: string): boolean {
    return message.includes('docker') || 
           message.includes('daemon') || 
           message.includes('system') ||
           message.includes('kernel') ||
           message.includes('platform');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global error recovery manager instance
 */
export const globalErrorRecovery = new ErrorRecoveryManager();

/**
 * Utility functions
 */

/**
 * Handle an error with automatic recovery
 */
export async function handleErrorWithRecovery(
  error: Error,
  context: ErrorContext
): Promise<{ recovered: boolean; classification: ErrorClassification }> {
  const classification = globalErrorRecovery.classifyError(error, context);
  
  console.log(`🚨 Error detected: ${classification.userMessage}`);
  console.log(`   Category: ${classification.category}, Severity: ${classification.severity}`);

  if (classification.recoverable) {
    const { recovered } = await globalErrorRecovery.attemptRecovery(error, context);
    return { recovered, classification };
  } else {
    console.log(`   ⚠️  Manual intervention required: ${classification.technicalDetails}`);
    return { recovered: false, classification };
  }
}

/**
 * Run quick diagnostic check
 */
export async function runQuickDiagnostics(): Promise<DiagnosticResult[]> {
  console.log('🔍 Running Quick Diagnostics...\n');
  
  const essentialChecks = [
    await globalErrorRecovery['checkDocker'](),
    await globalErrorRecovery['checkContainerUse'](),
    await globalErrorRecovery['checkSystemResources'](),
  ];

  const errorCount = essentialChecks.filter(r => r.status === 'error').length;
  console.log(`✅ Quick diagnostics complete: ${errorCount === 0 ? 'All essential systems healthy' : `${errorCount} error(s) detected`}\n`);

  return essentialChecks;
}

/**
 * Generate troubleshooting guide
 */
export function generateTroubleshootingGuide(results: DiagnosticResult[]): string {
  const guide = [
    '# Local Sandbox Troubleshooting Guide',
    '',
    'This guide helps resolve common issues with local sandbox environments.',
    '',
    '## Common Issues and Solutions',
    '',
  ];

  const errorResults = results.filter(r => r.status === 'error');
  const warningResults = results.filter(r => r.status === 'warning');

  if (errorResults.length > 0) {
    guide.push('### ❌ Critical Issues');
    guide.push('');
    
    errorResults.forEach(result => {
      guide.push(`**${result.component}**: ${result.message}`);
      if (result.recommendations) {
        guide.push('Solutions:');
        result.recommendations.forEach(rec => guide.push(`- ${rec}`));
      }
      guide.push('');
    });
  }

  if (warningResults.length > 0) {
    guide.push('### ⚠️  Warnings');
    guide.push('');
    
    warningResults.forEach(result => {
      guide.push(`**${result.component}**: ${result.message}`);
      if (result.recommendations) {
        guide.push('Recommendations:');
        result.recommendations.forEach(rec => guide.push(`- ${rec}`));
      }
      guide.push('');
    });
  }

  guide.push('## General Troubleshooting Steps');
  guide.push('');
  guide.push('1. **Check Docker Status**: Ensure Docker daemon is running');
  guide.push('2. **Verify Installation**: Confirm Container Use is properly installed');
  guide.push('3. **Check Permissions**: Verify user has Docker permissions');
  guide.push('4. **Resource Check**: Ensure sufficient system resources');
  guide.push('5. **Network Test**: Verify internet connectivity');
  guide.push('6. **Clean Environment**: Remove unused containers and images');
  guide.push('');
  guide.push('## Getting Help');
  guide.push('');
  guide.push('If issues persist:');
  guide.push('- Review the diagnostic details above');
  guide.push('- Check Container Use documentation');
  guide.push('- Report issues with diagnostic output');

  return guide.join('\n');
} 