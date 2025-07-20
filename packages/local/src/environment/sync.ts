/**
 * File Synchronization
 * 
 * Handles synchronization of local repository files to Container Use
 * environments, including Git integration and selective sync.
 */

import { ContainerUseWrapper } from '../container-use/wrapper';
import { Environment } from '../container-use/types';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface SyncOptions {
  excludePatterns?: string[];
  includePatterns?: string[];
  preservePermissions?: boolean;
  followSymlinks?: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  filesTransferred: number;
  bytesTransferred: number;
  errors: string[];
  duration: number;
}

export class FileSynchronizer {
  private readonly defaultExcludePatterns = [
    '.git',
    'node_modules',
    '.vibekit',
    'dist',
    'build',
    '.env',
    '.env.local',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
  ];

  constructor(private wrapper: ContainerUseWrapper) {}

  /**
   * Sync local directory to environment
   */
  async syncToEnvironment(
    environment: Environment,
    localPath: string,
    remotePath: string = '/workspace',
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      filesTransferred: 0,
      bytesTransferred: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Validate local path exists
      if (!await fs.pathExists(localPath)) {
        throw new Error(`Local path does not exist: ${localPath}`);
      }

      // Get exclude patterns
      const excludePatterns = [
        ...this.defaultExcludePatterns,
        ...(options.excludePatterns || []),
      ];

      // Create remote directory if it doesn't exist
      await this.ensureRemoteDirectory(environment, remotePath);

      // Get files to sync
      const filesToSync = await this.getFilesToSync(
        localPath,
        excludePatterns,
        options.includePatterns
      );

      if (options.dryRun) {
        result.filesTransferred = filesToSync.length;
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Sync files
      for (const file of filesToSync) {
        try {
          const relativePath = path.relative(localPath, file.path);
          const remoteFilePath = path.posix.join(remotePath, relativePath);
          
          await this.syncFile(
            environment,
            file.path,
            remoteFilePath,
            options
          );

          result.filesTransferred++;
          result.bytesTransferred += file.size;
        } catch (error) {
          const errorMsg = `Failed to sync ${file.path}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          result.errors.push(errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : String(error)
      );
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Sync environment files back to local directory
   */
  async syncFromEnvironment(
    environment: Environment,
    remotePath: string,
    localPath: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      filesTransferred: 0,
      bytesTransferred: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Ensure local directory exists
      await fs.ensureDir(localPath);

      // Get remote files
      const remoteFiles = await this.getRemoteFiles(environment, remotePath);

      if (options.dryRun) {
        result.filesTransferred = remoteFiles.length;
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Sync files from remote
      for (const remoteFile of remoteFiles) {
        try {
          const relativePath = path.relative(remotePath, remoteFile.path);
          const localFilePath = path.join(localPath, relativePath);
          
          await this.syncFileFromRemote(
            environment,
            remoteFile.path,
            localFilePath,
            options
          );

          result.filesTransferred++;
          result.bytesTransferred += remoteFile.size || 0;
        } catch (error) {
          const errorMsg = `Failed to sync ${remoteFile.path}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          result.errors.push(errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : String(error)
      );
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Watch for local file changes and sync automatically
   */
  async startWatchSync(
    environment: Environment,
    localPath: string,
    remotePath: string = '/workspace',
    options: SyncOptions = {}
  ): Promise<{ stop: () => void }> {
    // This would implement file watching using fs.watch or chokidar
    // For now, return a stub implementation
    console.log(`Starting watch sync from ${localPath} to ${environment.name}:${remotePath}`);
    
    return {
      stop: () => {
        console.log('Stopping watch sync');
      }
    };
  }

  // Private helper methods

  private async ensureRemoteDirectory(
    environment: Environment,
    remotePath: string
  ): Promise<void> {
    const command = [
      'terminal',
      environment.name,
      '--',
      'mkdir',
      '-p',
      remotePath
    ];

    const result = await this.wrapper.executeCommand(command);
    
    if (!result.success) {
      throw new Error(`Failed to create remote directory: ${result.stderr}`);
    }
  }

  private async getFilesToSync(
    localPath: string,
    excludePatterns: string[],
    includePatterns?: string[]
  ): Promise<Array<{ path: string; size: number }>> {
    const files: Array<{ path: string; size: number }> = [];

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(localPath, fullPath);

        // Check exclude patterns
        if (this.shouldExclude(relativePath, excludePatterns)) {
          continue;
        }

        // Check include patterns if specified
        if (includePatterns && !this.shouldInclude(relativePath, includePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            path: fullPath,
            size: stats.size,
          });
        }
      }
    };

    await walk(localPath);
    return files;
  }

  private async syncFile(
    environment: Environment,
    localFilePath: string,
    remoteFilePath: string,
    options: SyncOptions
  ): Promise<void> {
    // Read local file
    const fileContent = await fs.readFile(localFilePath);
    const base64Content = fileContent.toString('base64');

    // Create remote directory if needed
    const remoteDir = path.posix.dirname(remoteFilePath);
    await this.ensureRemoteDirectory(environment, remoteDir);

    // Write file to remote
    const writeCommand = [
      'terminal',
      environment.name,
      '--',
      'bash',
      '-c',
      `echo "${base64Content}" | base64 -d > "${remoteFilePath}"`
    ];

    const result = await this.wrapper.executeCommand(writeCommand);
    
    if (!result.success) {
      throw new Error(`Failed to write remote file: ${result.stderr}`);
    }

    // Set permissions if needed
    if (options.preservePermissions) {
      const stats = await fs.stat(localFilePath);
      const mode = stats.mode.toString(8).slice(-3);
      
      const chmodCommand = [
        'terminal',
        environment.name,
        '--',
        'chmod',
        mode,
        remoteFilePath
      ];

      await this.wrapper.executeCommand(chmodCommand);
    }
  }

  private async getRemoteFiles(
    environment: Environment,
    remotePath: string
  ): Promise<Array<{ path: string; size?: number }>> {
    const command = [
      'terminal',
      environment.name,
      '--',
      'find',
      remotePath,
      '-type',
      'f',
      '-printf',
      '%p\\t%s\\n'
    ];

    const result = await this.wrapper.executeCommand(command);
    
    if (!result.success) {
      throw new Error(`Failed to list remote files: ${result.stderr}`);
    }

    const files: Array<{ path: string; size?: number }> = [];
    const lines = result.stdout.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const [filePath, sizeStr] = line.split('\t');
      if (filePath) {
        files.push({
          path: filePath,
          size: sizeStr ? parseInt(sizeStr, 10) : undefined,
        });
      }
    }

    return files;
  }

  private async syncFileFromRemote(
    environment: Environment,
    remoteFilePath: string,
    localFilePath: string,
    options: SyncOptions
  ): Promise<void> {
    // Read remote file as base64
    const readCommand = [
      'terminal',
      environment.name,
      '--',
      'base64',
      remoteFilePath
    ];

    const result = await this.wrapper.executeCommand(readCommand);
    
    if (!result.success) {
      throw new Error(`Failed to read remote file: ${result.stderr}`);
    }

    // Decode and write to local file
    const fileContent = Buffer.from(result.stdout.trim(), 'base64');
    
    // Ensure local directory exists
    await fs.ensureDir(path.dirname(localFilePath));
    
    // Write file
    await fs.writeFile(localFilePath, fileContent);
  }

  private shouldExclude(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Simple pattern matching - could be enhanced with glob patterns
      if (pattern.includes('*')) {
        // Convert simple glob to regex
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  private shouldInclude(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }
} 