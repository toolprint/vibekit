/**
 * Git Integration and Merging Workflow
 * 
 * Streamlined code review and merging workflow for local sandbox environments.
 * Provides branch visualization, merge conflict detection, and interactive resolution.
 */

import { spawn, ChildProcess } from 'child_process';
import type { Environment } from '../container-use/types';

export interface GitBranchInfo {
  name: string;
  environmentName?: string;
  isActive: boolean;
  ahead: number;
  behind: number;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
  hasUncommittedChanges: boolean;
  conflictsWithMain: boolean;
}

export interface MergeConflict {
  file: string;
  type: 'content' | 'delete' | 'add' | 'rename';
  conflictMarkers: {
    start: number;
    separator: number;
    end: number;
  }[];
  preview: string;
}

export interface MergeResult {
  success: boolean;
  conflicts: MergeConflict[];
  mergedFiles: string[];
  skippedFiles: string[];
  commitHash?: string;
  message?: string;
}

export interface ChangePreview {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  linesAdded: number;
  linesRemoved: number;
  diff: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

/**
 * Git Integration Manager for local environments
 */
export class LocalGitIntegration {
  private environmentBranches: Map<string, string> = new Map(); // env name -> branch name

  /**
   * Initialize Git repository in environment if needed
   */
  async initializeRepository(environment: Environment, remoteUrl?: string): Promise<void> {
    try {
      // Check if git is already initialized
      const isGitRepo = await this.executeGitCommand(environment, ['rev-parse', '--git-dir']);
      
      if (!isGitRepo.success) {
        // Initialize git repository
        await this.executeGitCommand(environment, ['init']);
        
        // Set up basic configuration
        await this.executeGitCommand(environment, [
          'config', 'user.name', 'Vibekit Agent'
        ]);
        await this.executeGitCommand(environment, [
          'config', 'user.email', 'agent@vibekit.local'
        ]);
        
        // Add remote if provided
        if (remoteUrl) {
          await this.executeGitCommand(environment, [
            'remote', 'add', 'origin', remoteUrl
          ]);
        }
        
        console.log(`Git repository initialized in environment ${environment.name}`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize Git repository: ${error}`);
    }
  }

  /**
   * Create and checkout branch for environment
   */
  async createEnvironmentBranch(environment: Environment, branchName?: string): Promise<string> {
    const envBranchName = branchName || `vibekit/${environment.name}`;
    
    try {
      // Create and checkout new branch
      await this.executeGitCommand(environment, [
        'checkout', '-b', envBranchName
      ]);
      
      this.environmentBranches.set(environment.name, envBranchName);
      
      console.log(`Created and checked out branch: ${envBranchName}`);
      return envBranchName;
      
    } catch (error) {
      // Branch might already exist, try to checkout
      try {
        await this.executeGitCommand(environment, [
          'checkout', envBranchName
        ]);
        
        this.environmentBranches.set(environment.name, envBranchName);
        console.log(`Checked out existing branch: ${envBranchName}`);
        return envBranchName;
        
      } catch (checkoutError) {
        throw new Error(`Failed to create/checkout branch ${envBranchName}: ${error}`);
      }
    }
  }

  /**
   * Get branch information for environment
   */
  async getBranchInfo(environment: Environment): Promise<GitBranchInfo | null> {
    try {
      // Get current branch
      const branchResult = await this.executeGitCommand(environment, [
        'branch', '--show-current'
      ]);
      
      if (!branchResult.success) {
        return null;
      }
      
      const branchName = branchResult.output.trim();
      
      // Get branch status compared to main/master
      const statusResult = await this.executeGitCommand(environment, [
        'rev-list', '--left-right', '--count', `${branchName}...main`
      ]);
      
      let ahead = 0;
      let behind = 0;
      
      if (statusResult.success) {
        const [aheadStr, behindStr] = statusResult.output.trim().split('\t');
        ahead = parseInt(aheadStr) || 0;
        behind = parseInt(behindStr) || 0;
      }
      
      // Get last commit info
      const logResult = await this.executeGitCommand(environment, [
        'log', '-1', '--format=%H|%s|%an|%ai'
      ]);
      
      let lastCommit = {
        hash: '',
        message: '',
        author: '',
        date: new Date(),
      };
      
      if (logResult.success && logResult.output.trim()) {
        const [hash, message, author, date] = logResult.output.trim().split('|');
        lastCommit = {
          hash,
          message,
          author,
          date: new Date(date),
        };
      }
      
      // Check for uncommitted changes
      const statusChanges = await this.executeGitCommand(environment, [
        'status', '--porcelain'
      ]);
      
      const hasUncommittedChanges = statusChanges.success && statusChanges.output.trim().length > 0;
      
      // Check for conflicts with main
      const conflictsResult = await this.checkMergeConflicts(environment, 'main');
      
      return {
        name: branchName,
        environmentName: environment.name,
        isActive: true,
        ahead,
        behind,
        lastCommit,
        hasUncommittedChanges,
        conflictsWithMain: conflictsResult.conflicts.length > 0,
      };
      
    } catch (error) {
      console.warn(`Failed to get branch info: ${error}`);
      return null;
    }
  }

  /**
   * Check for merge conflicts before merging
   */
  async checkMergeConflicts(environment: Environment, targetBranch: string = 'main'): Promise<MergeResult> {
    try {
      // Try a dry-run merge to detect conflicts
      const mergeResult = await this.executeGitCommand(environment, [
        'merge', '--no-commit', '--no-ff', targetBranch
      ]);
      
      const conflicts: MergeConflict[] = [];
      
      if (!mergeResult.success) {
        // Get list of conflicted files
        const conflictFiles = await this.executeGitCommand(environment, [
          'diff', '--name-only', '--diff-filter=U'
        ]);
        
        if (conflictFiles.success) {
          const files = conflictFiles.output.trim().split('\n').filter(f => f);
          
          for (const file of files) {
            const conflict = await this.parseConflictFile(environment, file);
            if (conflict) {
              conflicts.push(conflict);
            }
          }
        }
        
        // Abort the merge
        await this.executeGitCommand(environment, ['merge', '--abort']);
      }
      
      return {
        success: conflicts.length === 0,
        conflicts,
        mergedFiles: [],
        skippedFiles: [],
      };
      
    } catch (error) {
      throw new Error(`Failed to check merge conflicts: ${error}`);
    }
  }

  /**
   * Generate commit message based on changes
   */
  async generateCommitMessage(environment: Environment): Promise<string> {
    try {
      // Get list of changed files
      const statusResult = await this.executeGitCommand(environment, [
        'status', '--porcelain'
      ]);
      
      if (!statusResult.success) {
        return 'Update files';
      }
      
      const changes = statusResult.output.trim().split('\n').filter(line => line);
      
      if (changes.length === 0) {
        return 'No changes';
      }
      
      // Analyze changes
      const added: string[] = [];
      const modified: string[] = [];
      const deleted: string[] = [];
      
      for (const change of changes) {
        const status = change.substring(0, 2);
        const file = change.substring(3);
        
        if (status.includes('A')) {
          added.push(file);
        } else if (status.includes('M')) {
          modified.push(file);
        } else if (status.includes('D')) {
          deleted.push(file);
        }
      }
      
      // Generate descriptive message
      const parts: string[] = [];
      
      if (added.length > 0) {
        parts.push(`Add ${added.length} file${added.length > 1 ? 's' : ''}`);
      }
      
      if (modified.length > 0) {
        parts.push(`Update ${modified.length} file${modified.length > 1 ? 's' : ''}`);
      }
      
      if (deleted.length > 0) {
        parts.push(`Delete ${deleted.length} file${deleted.length > 1 ? 's' : ''}`);
      }
      
      let message = parts.join(', ');
      
      // Add environment context
      message += ` (vibekit/${environment.name})`;
      
      return message;
      
    } catch (error) {
      return `Update from environment ${environment.name}`;
    }
  }

  /**
   * Get change preview for environment
   */
  async getChangePreview(environment: Environment): Promise<ChangePreview[]> {
    try {
      // Get diff stats
      const diffResult = await this.executeGitCommand(environment, [
        'diff', '--stat', 'HEAD'
      ]);
      
      const changes: ChangePreview[] = [];
      
      if (!diffResult.success) {
        return changes;
      }
      
      // Get detailed diff for each file
      const statusResult = await this.executeGitCommand(environment, [
        'status', '--porcelain'
      ]);
      
      if (statusResult.success) {
        const statusLines = statusResult.output.trim().split('\n').filter(line => line);
        
        for (const line of statusLines) {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          
          let fileStatus: ChangePreview['status'] = 'modified';
          
          if (status.includes('A')) {
            fileStatus = 'added';
          } else if (status.includes('D')) {
            fileStatus = 'deleted';
          } else if (status.includes('R')) {
            fileStatus = 'renamed';
          }
          
          // Get file diff
          const fileDiff = await this.executeGitCommand(environment, [
            'diff', 'HEAD', '--', file
          ]);
          
          let linesAdded = 0;
          let linesRemoved = 0;
          
          if (fileDiff.success) {
            const diffLines = fileDiff.output.split('\n');
            linesAdded = diffLines.filter(line => line.startsWith('+')).length;
            linesRemoved = diffLines.filter(line => line.startsWith('-')).length;
          }
          
          changes.push({
            file,
            status: fileStatus,
            linesAdded,
            linesRemoved,
            diff: fileDiff.output || '',
          });
        }
      }
      
      return changes;
      
    } catch (error) {
      console.warn(`Failed to get change preview: ${error}`);
      return [];
    }
  }

  /**
   * Commit changes in environment
   */
  async commitChanges(environment: Environment, message?: string): Promise<CommitInfo | null> {
    try {
      // Generate commit message if not provided
      const commitMessage = message || await this.generateCommitMessage(environment);
      
      // Add all changes
      await this.executeGitCommand(environment, ['add', '.']);
      
      // Commit changes
      const commitResult = await this.executeGitCommand(environment, [
        'commit', '-m', commitMessage
      ]);
      
      if (!commitResult.success) {
        throw new Error(`Commit failed: ${commitResult.error}`);
      }
      
      // Get commit info
      const logResult = await this.executeGitCommand(environment, [
        'log', '-1', '--format=%H|%s|%an|%ae|%ai', '--name-only'
      ]);
      
      if (!logResult.success) {
        return null;
      }
      
      const lines = logResult.output.trim().split('\n');
      const [hash, commitMsg, author, email, date] = lines[0].split('|');
      const filesChanged = lines.slice(1).filter(f => f);
      
      // Get commit stats
      const statResult = await this.executeGitCommand(environment, [
        'show', '--stat', '--format=', hash
      ]);
      
      let insertions = 0;
      let deletions = 0;
      
      if (statResult.success) {
        const statLines = statResult.output.split('\n');
        const summaryLine = statLines.find(line => line.includes('insertion') || line.includes('deletion'));
        
        if (summaryLine) {
          const insertMatch = summaryLine.match(/(\d+) insertion/);
          const deleteMatch = summaryLine.match(/(\d+) deletion/);
          
          if (insertMatch) insertions = parseInt(insertMatch[1]);
          if (deleteMatch) deletions = parseInt(deleteMatch[1]);
        }
      }
      
      return {
        hash,
        message: commitMsg,
        author,
        email,
        date: new Date(date),
        filesChanged,
        insertions,
        deletions,
      };
      
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error}`);
    }
  }

  /**
   * Merge environment branch to main
   */
  async mergeToMain(environment: Environment, options: {
    squash?: boolean;
    message?: string;
    strategy?: 'ours' | 'theirs' | 'interactive';
  } = {}): Promise<MergeResult> {
    try {
      const branchName = this.environmentBranches.get(environment.name);
      
      if (!branchName) {
        throw new Error(`No branch found for environment ${environment.name}`);
      }
      
      // Switch to main branch
      await this.executeGitCommand(environment, ['checkout', 'main']);
      
      // Pull latest changes
      await this.executeGitCommand(environment, ['pull', 'origin', 'main']);
      
      // Prepare merge command
      const mergeArgs = ['merge'];
      
      if (options.squash) {
        mergeArgs.push('--squash');
      }
      
      if (options.message) {
        mergeArgs.push('-m', options.message);
      }
      
      mergeArgs.push(branchName);
      
      // Execute merge
      const mergeResult = await this.executeGitCommand(environment, mergeArgs);
      
      const result: MergeResult = {
        success: mergeResult.success,
        conflicts: [],
        mergedFiles: [],
        skippedFiles: [],
      };
      
      if (mergeResult.success) {
        // Get merged files
        const diffResult = await this.executeGitCommand(environment, [
          'diff', '--name-only', 'HEAD~1', 'HEAD'
        ]);
        
        if (diffResult.success) {
          result.mergedFiles = diffResult.output.trim().split('\n').filter(f => f);
        }
        
        // Get commit hash
        const hashResult = await this.executeGitCommand(environment, [
          'rev-parse', 'HEAD'
        ]);
        
        if (hashResult.success) {
          result.commitHash = hashResult.output.trim();
        }
        
        result.message = `Successfully merged ${branchName} to main`;
        
      } else {
        // Handle merge conflicts
        const conflicts = await this.checkMergeConflicts(environment, 'main');
        result.conflicts = conflicts.conflicts;
        result.message = `Merge conflicts detected in ${result.conflicts.length} file(s)`;
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to merge to main: ${error}`);
    }
  }

  /**
   * Clean up environment branch after merge
   */
  async cleanupEnvironmentBranch(environment: Environment): Promise<void> {
    try {
      const branchName = this.environmentBranches.get(environment.name);
      
      if (!branchName) {
        return;
      }
      
      // Switch to main if currently on environment branch
      const currentBranch = await this.executeGitCommand(environment, [
        'branch', '--show-current'
      ]);
      
      if (currentBranch.success && currentBranch.output.trim() === branchName) {
        await this.executeGitCommand(environment, ['checkout', 'main']);
      }
      
      // Delete environment branch
      await this.executeGitCommand(environment, [
        'branch', '-D', branchName
      ]);
      
      this.environmentBranches.delete(environment.name);
      
      console.log(`Cleaned up branch: ${branchName}`);
      
    } catch (error) {
      console.warn(`Failed to cleanup branch: ${error}`);
    }
  }

  /**
   * Execute git command in environment
   */
  private async executeGitCommand(environment: Environment, args: string[]): Promise<{
    success: boolean;
    output: string;
    error: string;
  }> {
    return new Promise((resolve) => {
      const process = spawn('container-use', [
        'terminal',
        environment.name,
        '--',
        'git',
        ...args
      ], {
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
   * Parse conflict markers in file
   */
  private async parseConflictFile(environment: Environment, file: string): Promise<MergeConflict | null> {
    try {
      const catResult = await this.executeGitCommand(environment, [
        'show', `:1:${file}` // Get file content
      ]);
      
      if (!catResult.success) {
        return null;
      }
      
      const content = catResult.output;
      const lines = content.split('\n');
      const conflictMarkers: MergeConflict['conflictMarkers'] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('<<<<<<<')) {
          // Find the separator and end
          let separator = -1;
          let end = -1;
          
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith('=======') && separator === -1) {
              separator = j;
            } else if (lines[j].startsWith('>>>>>>>') && separator !== -1) {
              end = j;
              break;
            }
          }
          
          if (separator !== -1 && end !== -1) {
            conflictMarkers.push({
              start: i,
              separator,
              end,
            });
          }
        }
      }
      
      return {
        file,
        type: 'content',
        conflictMarkers,
        preview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      };
      
    } catch (error) {
      console.warn(`Failed to parse conflict file ${file}: ${error}`);
      return null;
    }
  }
}

/**
 * Global Git integration instance
 */
export const globalGitIntegration = new LocalGitIntegration();

/**
 * Utility functions
 */

/**
 * Initialize Git integration for environment
 */
export async function initializeGitForEnvironment(
  environment: Environment,
  remoteUrl?: string
): Promise<void> {
  await globalGitIntegration.initializeRepository(environment, remoteUrl);
  await globalGitIntegration.createEnvironmentBranch(environment);
}

/**
 * One-command merge from sandbox to main
 */
export async function mergeEnvironmentToMain(
  environment: Environment,
  options: {
    commitMessage?: string;
    squash?: boolean;
    autoCommit?: boolean;
  } = {}
): Promise<MergeResult> {
  try {
    // Commit changes if auto-commit is enabled and there are uncommitted changes
    if (options.autoCommit) {
      const branchInfo = await globalGitIntegration.getBranchInfo(environment);
      
      if (branchInfo?.hasUncommittedChanges) {
        await globalGitIntegration.commitChanges(environment, options.commitMessage);
      }
    }
    
    // Check for conflicts first
    const conflictCheck = await globalGitIntegration.checkMergeConflicts(environment);
    
    if (!conflictCheck.success) {
      return conflictCheck;
    }
    
    // Perform the merge
    const mergeResult = await globalGitIntegration.mergeToMain(environment, {
      squash: options.squash,
      message: options.commitMessage,
    });
    
    // Clean up branch if merge was successful
    if (mergeResult.success) {
      await globalGitIntegration.cleanupEnvironmentBranch(environment);
    }
    
    return mergeResult;
    
  } catch (error) {
    return {
      success: false,
      conflicts: [],
      mergedFiles: [],
      skippedFiles: [],
      message: `Merge failed: ${error}`,
    };
  }
}

/**
 * Get Git status for environment
 */
export async function getGitStatus(environment: Environment): Promise<{
  branchInfo: GitBranchInfo | null;
  changePreview: ChangePreview[];
  conflicts: MergeConflict[];
}> {
  const branchInfo = await globalGitIntegration.getBranchInfo(environment);
  const changePreview = await globalGitIntegration.getChangePreview(environment);
  const conflictCheck = await globalGitIntegration.checkMergeConflicts(environment);
  
  return {
    branchInfo,
    changePreview,
    conflicts: conflictCheck.conflicts,
  };
} 