/**
 * Container Use CLI Wrapper
 * 
 * Provides a type-safe wrapper around the Container Use CLI with proper
 * error handling, output parsing, and streaming support.
 */

import { execa, ExecaError } from 'execa';
import { 
  CommandOptions, 
  CommandResult, 
  StreamingCommandResult,
  ContainerUseError,
  ContainerUseNotInstalledError,
  DockerNotAvailableError 
} from './types';

export class ContainerUseWrapper {
  private readonly cliPath: string;
  private readonly defaultTimeout: number = 30000; // 30 seconds

  constructor(cliPath: string = 'container-use') {
    this.cliPath = cliPath;
  }

  /**
   * Execute a Container Use command with proper error handling
   */
  async executeCommand<T = any>(
    command: string[],
    options: CommandOptions = {}
  ): Promise<CommandResult<T>> {
    const startTime = Date.now();
    
    try {
             const result = await execa(this.cliPath, command, {
         cwd: options.cwd,
         timeout: options.timeout || this.defaultTimeout,
         env: { ...process.env, ...options.env },
         stdio: options.stdio || 'pipe',
         encoding: 'utf8' as const,
       });

             return {
         success: true,
         data: this.parseOutput<T>(result.stdout || ''),
         stdout: result.stdout || '',
         stderr: result.stderr || '',
         exitCode: result.exitCode || 0,
         duration: Date.now() - startTime,
       };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof ExecaError) {
        // Handle specific error types
        if (error.exitCode === 127 || error.code === 'ENOENT') {
          throw new ContainerUseNotInstalledError();
        }

                 // Check for Docker-related errors
         if (this.isDockerError(error.stderr || '')) {
           throw new DockerNotAvailableError();
         }

         throw new ContainerUseError(
           error.message,
           command.join(' '),
           error.exitCode || 1,
           error.stderr || ''
         );
      }

      // Re-throw unexpected errors
      throw error;
    }
  }

  /**
   * Execute a streaming command (for watch, logs, etc.)
   */
     executeStreamingCommand(
     command: string[],
     options: CommandOptions = {}
   ): StreamingCommandResult {
     const childProcess = execa(this.cliPath, command, {
       cwd: options.cwd,
       env: { ...process.env, ...options.env },
       stdio: 'pipe',
       encoding: 'utf8' as const,
     });

     return {
       process: childProcess,
       stdout: childProcess.stdout!,
       stderr: childProcess.stderr!,
       stop: async () => {
         childProcess.kill('SIGTERM');
         try {
           await childProcess;
         } catch {
           // Ignore errors from killed process
         }
       },
     };
   }

  /**
   * Execute a command with JSON output parsing
   */
  async executeJsonCommand<T>(
    command: string[],
    options: CommandOptions = {}
  ): Promise<T> {
    // Add --json flag if not already present
    const jsonCommand = command.includes('--json') ? command : [...command, '--json'];
    
    const result = await this.executeCommand<T>(jsonCommand, options);
    
    if (!result.success) {
      throw new ContainerUseError(
        'Command failed',
        jsonCommand.join(' '),
        result.exitCode,
        result.stderr
      );
    }

    return result.data!;
  }

  /**
   * Check if Container Use CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.executeCommand(['--version'], { timeout: 5000 });
      return true;
    } catch (error) {
      if (error instanceof ContainerUseNotInstalledError) {
        return false;
      }
      // Other errors might indicate CLI is present but broken
      return true;
    }
  }

  /**
   * Get Container Use version information
   */
  async getVersion(): Promise<string> {
    const result = await this.executeCommand(['--version']);
    return result.stdout.trim();
  }

  /**
   * Check if Docker is available and running
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await execa('docker', ['ps'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse command output based on content type
   */
  private parseOutput<T>(output: string): T | undefined {
    if (!output || output.trim() === '') {
      return undefined;
    }

    // Try to parse as JSON first
    try {
      return JSON.parse(output) as T;
    } catch {
      // If not JSON, return as string
      return output.trim() as T;
    }
  }

  /**
   * Check if error is Docker-related
   */
  private isDockerError(stderr: string): boolean {
    const dockerErrorPatterns = [
      'cannot connect to the docker daemon',
      'docker daemon is not running',
      'docker: command not found',
      'permission denied while trying to connect to the docker daemon',
      'is the docker daemon running',
    ];

    const lowerStderr = stderr.toLowerCase();
    return dockerErrorPatterns.some(pattern => lowerStderr.includes(pattern));
  }

  /**
   * Build command arguments with proper escaping
   */
  buildCommand(baseCommand: string, args: Record<string, any> = {}): string[] {
    const command = [baseCommand];

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'boolean') {
        if (value) {
          command.push(`--${key}`);
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          command.push(`--${key}`, String(item));
        }
      } else {
        command.push(`--${key}`, String(value));
      }
    }

    return command;
  }

  /**
   * Parse environment list output into structured data
   */
  parseEnvironmentList(output: string): any[] {
    // Handle both JSON and table output formats
    try {
      return JSON.parse(output);
    } catch {
      // Parse table format if JSON parsing fails
      const lines = output.split('\n').filter(line => line.trim());
      if (lines.length < 2) return [];

      const headers = lines[0].split(/\s+/);
      const environments = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/\s+/);
        const env: any = {};
        
        headers.forEach((header, index) => {
          if (values[index]) {
            env[header.toLowerCase()] = values[index];
          }
        });

        environments.push(env);
      }

      return environments;
    }
  }

  /**
   * Parse log output into structured log entries
   */
  parseLogOutput(output: string): any[] {
    const lines = output.split('\n').filter(line => line.trim());
    const entries = [];

    for (const line of lines) {
      try {
        // Try JSON format first
        const entry = JSON.parse(line);
        entries.push(entry);
      } catch {
        // Parse plain text format
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
        
        entries.push({
          timestamp,
          level: 'info',
          source: 'container',
          message: line,
        });
      }
    }

    return entries;
  }
} 