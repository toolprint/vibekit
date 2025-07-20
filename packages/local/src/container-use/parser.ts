/**
 * Container Use Output Parser
 * 
 * Utilities for parsing and transforming Container Use CLI output
 * into structured TypeScript objects.
 */

import { 
  Environment, 
  LogEntry, 
  GitBranch, 
  VersionInfo,
  PortMapping,
  ResourceUsage 
} from './types';

export class ContainerUseParser {
  /**
   * Parse environment list output (supports both JSON and table formats)
   */
  static parseEnvironmentList(output: string): Environment[] {
    if (!output || output.trim() === '') {
      return [];
    }

    // Try JSON format first
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed.map(this.normalizeEnvironment);
      }
      return [this.normalizeEnvironment(parsed)];
    } catch {
      // Fall back to table format parsing
      return this.parseTableFormat(output);
    }
  }

  /**
   * Parse single environment inspect output
   */
  static parseEnvironmentInspect(output: string): Environment {
    try {
      const parsed = JSON.parse(output);
      return this.normalizeEnvironment(parsed);
    } catch {
      throw new Error('Failed to parse environment inspect output');
    }
  }

  /**
   * Parse log entries from watch/log commands
   */
  static parseLogEntries(output: string): LogEntry[] {
    const lines = output.split('\n').filter(line => line.trim());
    const entries: LogEntry[] = [];

    for (const line of lines) {
      try {
        // Try structured JSON log format
        const entry = JSON.parse(line);
        entries.push(this.normalizeLogEntry(entry));
      } catch {
        // Parse plain text format
        const entry = this.parseTextLogLine(line);
        if (entry) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  /**
   * Parse git branch information
   */
  static parseGitBranches(output: string): GitBranch[] {
    const lines = output.split('\n').filter(line => line.trim());
    const branches: GitBranch[] = [];

    for (const line of lines) {
      try {
        const branch = JSON.parse(line);
        branches.push(this.normalizeGitBranch(branch));
      } catch {
        // Parse git branch format: "* branch-name commit-hash"
        const match = line.match(/^(\*?\s*)([^\s]+)\s+([a-f0-9]+)/);
        if (match) {
          branches.push({
            name: match[2],
            lastCommit: match[3],
            isDirty: false,
          });
        }
      }
    }

    return branches;
  }

  /**
   * Parse version information
   */
  static parseVersion(output: string): VersionInfo {
    try {
      return JSON.parse(output);
    } catch {
      // Parse plain text version output
      const lines = output.split('\n');
      const version = lines[0]?.match(/v?(\d+\.\d+\.\d+)/)?.[1] || 'unknown';
      
      return {
        version,
        gitCommit: 'unknown',
        buildDate: 'unknown',
        platform: process.platform,
      };
    }
  }

  /**
   * Parse port mapping information
   */
  static parsePortMappings(output: string): PortMapping[] {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed.map(this.normalizePortMapping);
      }
      return [this.normalizePortMapping(parsed)];
    } catch {
      // Parse docker ps style format: "0.0.0.0:3000->3000/tcp"
      const ports: PortMapping[] = [];
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)->(\d+)\/(tcp|udp)/);
        if (match) {
          ports.push({
            hostPort: parseInt(match[2]),
            containerPort: parseInt(match[3]),
            protocol: match[4] as 'tcp' | 'udp',
          });
        }
      }
      
      return ports;
    }
  }

  /**
   * Parse resource usage statistics
   */
  static parseResourceUsage(output: string): ResourceUsage {
    try {
      const parsed = JSON.parse(output);
      return this.normalizeResourceUsage(parsed);
    } catch {
      // Parse docker stats style format
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

  // Private helper methods

  private static parseTableFormat(output: string): Environment[] {
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Extract headers (first line)
    const headerLine = lines[0];
    const headers = headerLine.split(/\s+/).map(h => h.toLowerCase());

    const environments: Environment[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/\s+/);
      const env: any = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          env[header] = values[index];
        }
      });

      // Convert to standard Environment format
      environments.push(this.normalizeEnvironment(env));
    }

    return environments;
  }

  private static normalizeEnvironment(raw: any): Environment {
    return {
      name: raw.name || raw.Name || 'unknown',
      status: this.normalizeStatus(raw.status || raw.Status),
      branch: raw.branch || raw.Branch || 'main',
      baseImage: raw.baseImage || raw['base-image'] || raw.BaseImage || 'ubuntu:24.04',
      createdAt: raw.createdAt || raw.CreatedAt || new Date().toISOString(),
      lastActivityAt: raw.lastActivityAt || raw.LastActivityAt,
      workingDirectory: raw.workingDirectory || raw.WorkingDirectory || '/workspace',
      ports: raw.ports ? raw.ports.map(this.normalizePortMapping) : [],
      services: raw.services || [],
      gitCommit: raw.gitCommit || raw.GitCommit,
      resources: raw.resources ? this.normalizeResourceUsage(raw.resources) : undefined,
    };
  }

  private static normalizeStatus(status: string): any {
    const statusMap: Record<string, any> = {
      'running': 'running',
      'stopped': 'stopped',
      'starting': 'starting',
      'stopping': 'stopping',
      'up': 'running',
      'down': 'stopped',
      'exited': 'stopped',
    };

    return statusMap[status?.toLowerCase()] || 'error';
  }

  private static normalizeLogEntry(raw: any): LogEntry {
    return {
      timestamp: raw.timestamp || raw.time || new Date().toISOString(),
      level: raw.level || raw.severity || 'info',
      source: raw.source || raw.component || 'container',
      message: raw.message || raw.msg || String(raw),
      data: raw.data || raw.context,
    };
  }

  private static parseTextLogLine(line: string): LogEntry | null {
    if (!line.trim()) return null;

    // Try to extract timestamp from common formats
    const timestampPatterns = [
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/,
      /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,
      /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/,
    ];

    let timestamp = new Date().toISOString();
    let message = line;

    for (const pattern of timestampPatterns) {
      const match = line.match(pattern);
      if (match) {
        timestamp = new Date(match[1]).toISOString();
        message = line.substring(match[0].length).trim();
        break;
      }
    }

    // Extract log level if present
    let level: LogEntry['level'] = 'info';
    const levelMatch = message.match(/^\[?(ERROR|WARN|INFO|DEBUG)\]?\s*/i);
    if (levelMatch) {
      level = levelMatch[1].toLowerCase() as LogEntry['level'];
      message = message.substring(levelMatch[0].length);
    }

    return {
      timestamp,
      level,
      source: 'container',
      message,
    };
  }

  private static normalizeGitBranch(raw: any): GitBranch {
    return {
      name: raw.name || raw.branch || 'unknown',
      environment: raw.environment,
      lastCommit: raw.lastCommit || raw.commit || 'unknown',
      isDirty: Boolean(raw.isDirty || raw.dirty),
    };
  }

  private static normalizePortMapping(raw: any): PortMapping {
    return {
      containerPort: parseInt(raw.containerPort || raw.container_port || raw.internal),
      hostPort: parseInt(raw.hostPort || raw.host_port || raw.external),
      protocol: (raw.protocol || 'tcp') as 'tcp' | 'udp',
    };
  }

  private static normalizeResourceUsage(raw: any): ResourceUsage {
    return {
      memory: {
        used: raw.memory?.used || raw.mem_used || '0MB',
        limit: raw.memory?.limit || raw.mem_limit || '0MB',
        percentage: parseFloat(raw.memory?.percentage || raw.mem_percent || '0'),
      },
      cpu: {
        percentage: parseFloat(raw.cpu?.percentage || raw.cpu_percent || '0'),
      },
      disk: {
        used: raw.disk?.used || raw.disk_used || '0MB',
        available: raw.disk?.available || raw.disk_available || '0MB',
      },
    };
  }
} 