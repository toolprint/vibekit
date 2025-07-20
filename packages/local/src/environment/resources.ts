/**
 * Resource Management
 * 
 * Handles resource monitoring, limits, and optimization for Container Use
 * environments including CPU, memory, disk, and network resources.
 */

import { ContainerUseWrapper } from '../container-use/wrapper';
import { Environment, ResourceUsage } from '../container-use/types';

export interface ResourceLimits {
  memory?: string;      // e.g., "2g", "512m"
  cpu?: string;         // e.g., "1", "0.5"
  diskSpace?: string;   // e.g., "10g", "1t"
  networkBandwidth?: string; // e.g., "100m", "1g"
}

export interface ResourceAlert {
  type: 'memory' | 'cpu' | 'disk' | 'network';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface ResourceMonitoringOptions {
  interval?: number;    // Monitoring interval in ms
  alertThresholds?: {
    memory?: number;    // Percentage
    cpu?: number;       // Percentage
    disk?: number;      // Percentage
  };
  enableAlerts?: boolean;
  logMetrics?: boolean;
}

export class ResourceManager {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private wrapper: ContainerUseWrapper) {}

  /**
   * Apply resource limits to an environment
   */
  async applyResourceLimits(
    environment: Environment,
    limits: ResourceLimits
  ): Promise<void> {
    try {
      const commands: string[] = [];

      // Apply memory limit
      if (limits.memory) {
        commands.push(`docker update --memory=${limits.memory} \$(docker ps -q --filter name=${environment.name})`);
      }

      // Apply CPU limit
      if (limits.cpu) {
        commands.push(`docker update --cpus=${limits.cpu} \$(docker ps -q --filter name=${environment.name})`);
      }

      // Apply disk space limit (requires additional setup)
      if (limits.diskSpace) {
        commands.push(`echo "Disk limit: ${limits.diskSpace}" > /tmp/disk_limit`);
      }

      // Execute all resource limit commands
      for (const cmd of commands) {
        const result = await this.wrapper.executeCommand([
          'terminal',
          environment.name,
          '--',
          'bash',
          '-c',
          cmd
        ]);

        if (!result.success) {
          console.warn(`Failed to apply resource limit: ${cmd}\n${result.stderr}`);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to apply resource limits to environment '${environment.name}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get current resource usage for an environment
   */
  async getResourceUsage(environment: Environment): Promise<ResourceUsage> {
    try {
      // Get container stats
      const statsCommand = [
        'terminal',
        environment.name,
        '--',
        'bash',
        '-c',
        'docker stats --no-stream --format "table {{.Container}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}" $(docker ps -q)'
      ];

      const result = await this.wrapper.executeCommand(statsCommand);

      if (!result.success) {
        throw new Error(`Failed to get resource usage: ${result.stderr}`);
      }

      return this.parseResourceStats(result.stdout);
    } catch (error) {
      // Return default values if stats collection fails
      return {
        memory: {
          used: '0MB',
          limit: '0MB',
          percentage: 0,
        },
        cpu: {
          percentage: 0,
        },
        disk: {
          used: '0MB',
          available: '0MB',
        },
      };
    }
  }

  /**
   * Start monitoring resources for an environment
   */
  async startResourceMonitoring(
    environment: Environment,
    options: ResourceMonitoringOptions = {},
    onAlert?: (alert: ResourceAlert) => void
  ): Promise<void> {
    const monitoringOptions = {
      interval: 30000, // 30 seconds
      alertThresholds: {
        memory: 80,
        cpu: 80,
        disk: 90,
      },
      enableAlerts: true,
      logMetrics: false,
      ...options,
    };

    // Clear existing monitoring if any
    this.stopResourceMonitoring(environment.name);

    const interval = setInterval(async () => {
      try {
        const usage = await this.getResourceUsage(environment);

        if (monitoringOptions.logMetrics) {
          console.log(`Resource usage for ${environment.name}:`, usage);
        }

        // Check for alerts
        if (monitoringOptions.enableAlerts && onAlert) {
          const alerts = this.checkResourceAlerts(usage, monitoringOptions.alertThresholds!);
          alerts.forEach(onAlert);
        }
      } catch (error) {
        console.warn(`Resource monitoring error for ${environment.name}:`, error);
      }
    }, monitoringOptions.interval);

    this.monitoringIntervals.set(environment.name, interval);
  }

  /**
   * Stop monitoring resources for an environment
   */
  stopResourceMonitoring(environmentName: string): void {
    const interval = this.monitoringIntervals.get(environmentName);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(environmentName);
    }
  }

  /**
   * Optimize resource usage for an environment
   */
  async optimizeResources(environment: Environment): Promise<void> {
    try {
      const optimizationCommands = [
        // Clean package caches
        'apt-get clean || true',
        'npm cache clean --force || true',
        'yarn cache clean || true',
        
        // Clean temporary files
        'rm -rf /tmp/* || true',
        'rm -rf /var/tmp/* || true',
        
        // Clean logs
        'find /var/log -type f -name "*.log" -delete || true',
        
        // Docker cleanup
        'docker system prune -f || true',
      ];

      for (const cmd of optimizationCommands) {
        const result = await this.wrapper.executeCommand([
          'terminal',
          environment.name,
          '--',
          'bash',
          '-c',
          cmd
        ]);

        // Don't fail on individual cleanup commands
        if (!result.success) {
          console.debug(`Optimization command failed (non-critical): ${cmd}`);
        }
      }
    } catch (error) {
      console.warn(`Resource optimization failed for ${environment.name}:`, error);
    }
  }

  /**
   * Get system resource availability
   */
  async getSystemResources(): Promise<{
    totalMemory: string;
    availableMemory: string;
    cpuCores: number;
    diskSpace: string;
  }> {
    try {
      // Get system information
      const memoryResult = await this.wrapper.executeCommand([
        'bash',
        '-c',
        'free -h | grep Mem:'
      ]);

      const cpuResult = await this.wrapper.executeCommand([
        'bash',
        '-c',
        'nproc'
      ]);

      const diskResult = await this.wrapper.executeCommand([
        'bash',
        '-c',
        'df -h / | tail -1'
      ]);

      return {
        totalMemory: this.parseMemoryInfo(memoryResult.stdout).total,
        availableMemory: this.parseMemoryInfo(memoryResult.stdout).available,
        cpuCores: parseInt(cpuResult.stdout.trim()) || 1,
        diskSpace: this.parseDiskInfo(diskResult.stdout).available,
      };
    } catch (error) {
      // Return default values if system info collection fails
      return {
        totalMemory: 'Unknown',
        availableMemory: 'Unknown',
        cpuCores: 1,
        diskSpace: 'Unknown',
      };
    }
  }

  /**
   * Clean up all monitoring intervals
   */
  cleanup(): void {
    for (const [envName, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
  }

  // Private helper methods

  private parseResourceStats(output: string): ResourceUsage {
    const lines = output.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      // No stats available
      return {
        memory: { used: '0MB', limit: '0MB', percentage: 0 },
        cpu: { percentage: 0 },
        disk: { used: '0MB', available: '0MB' },
      };
    }

    // Parse the stats line (skip header)
    const statsLine = lines[1];
    const parts = statsLine.split(/\s+/);

    if (parts.length >= 4) {
      const cpuPerc = parseFloat(parts[1].replace('%', '')) || 0;
      const memUsage = parts[2] || '0MB / 0MB';
      const memPerc = parseFloat(parts[3].replace('%', '')) || 0;

      const [memUsed, memLimit] = memUsage.split(' / ');

      return {
        memory: {
          used: memUsed || '0MB',
          limit: memLimit || '0MB',
          percentage: memPerc,
        },
        cpu: {
          percentage: cpuPerc,
        },
        disk: {
          used: '0MB', // Would need separate disk stats
          available: '0MB',
        },
      };
    }

    // Fallback
    return {
      memory: { used: '0MB', limit: '0MB', percentage: 0 },
      cpu: { percentage: 0 },
      disk: { used: '0MB', available: '0MB' },
    };
  }

  private checkResourceAlerts(
    usage: ResourceUsage,
    thresholds: { memory?: number; cpu?: number; disk?: number }
  ): ResourceAlert[] {
    const alerts: ResourceAlert[] = [];
    const timestamp = new Date().toISOString();

    // Check memory
    if (thresholds.memory && usage.memory.percentage > thresholds.memory) {
      alerts.push({
        type: 'memory',
        severity: usage.memory.percentage > 90 ? 'critical' : 'warning',
        message: `Memory usage is ${usage.memory.percentage.toFixed(1)}%`,
        value: usage.memory.percentage,
        threshold: thresholds.memory,
        timestamp,
      });
    }

    // Check CPU
    if (thresholds.cpu && usage.cpu.percentage > thresholds.cpu) {
      alerts.push({
        type: 'cpu',
        severity: usage.cpu.percentage > 90 ? 'critical' : 'warning',
        message: `CPU usage is ${usage.cpu.percentage.toFixed(1)}%`,
        value: usage.cpu.percentage,
        threshold: thresholds.cpu,
        timestamp,
      });
    }

    return alerts;
  }

  private parseMemoryInfo(output: string): { total: string; available: string } {
    // Parse free command output
    const match = output.match(/Mem:\s+(\S+)\s+\S+\s+(\S+)/);
    if (match) {
      return {
        total: match[1],
        available: match[2],
      };
    }
    return { total: 'Unknown', available: 'Unknown' };
  }

  private parseDiskInfo(output: string): { total: string; available: string } {
    // Parse df command output
    const parts = output.split(/\s+/);
    if (parts.length >= 4) {
      return {
        total: parts[1],
        available: parts[3],
      };
    }
    return { total: 'Unknown', available: 'Unknown' };
  }
} 