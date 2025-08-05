import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import Docker from '../sandbox/docker.js';
import StatusDisplay from '../components/status-display.js';
import React from 'react';
import { render, Static } from 'ink';
import Analytics from '../analytics/analytics.js';
import fs from 'fs-extra';
import crypto from 'crypto';

class BaseAgent {
  constructor(agentName, logger, options = {}) {
    this.agentName = agentName;
    this.logger = logger;
    this.sandboxPath = path.join(process.cwd(), '.vibekit', '.vibekit-sandbox');
    
    // Sandbox options: 'docker' or false
    this.sandboxType = options.sandbox || 'none';
    this.sandboxOptions = options.sandboxOptions || {};
    
    // Analytics options
    this.analyticsMode = options.analyticsMode || 'basic'; // 'basic' or 'full'
    this.disablePty = options.disablePty || false;
    
    // Proxy options
    this.proxy = options.proxy;
    
    // Settings for display
    this.settings = options.settings || {};
  }


  async run(args) {
    await this.logger.log('info', `Starting ${this.agentName} agent`, { 
      args, 
      sandboxType: this.sandboxType 
    });

    try {
      switch (this.sandboxType) {
        case 'docker':
          return await this.runInDocker(args);
        case false:
        case 'none':
          return await this.runDirect(args);
        default:
          // Default to no sandbox
          return await this.runDirect(args);
      }
    } catch (error) {
      await this.logger.log('error', `${this.agentName} agent failed`, { 
        error: error.message,
        args,
        sandboxType: this.sandboxType
      });
      throw error;
    }
  }



  async runInDocker(args) {
    const dockerSandbox = new Docker(process.cwd(), this.logger, this.sandboxOptions);
    
    try {
      const startTime = Date.now();
      // Run vibekit wrapper inside container to show status display
      const command = 'vibekit';
      const vibekitArgs = [this.agentName, '--sandbox', 'none', ...args];
      const result = await dockerSandbox.runCommand(command, vibekitArgs);
      const duration = Date.now() - startTime;

      await this.logger.log('info', `${this.agentName} agent completed in Docker`, { 
        exitCode: result.code,
        duration 
      });

      const changes = await dockerSandbox.getWorkspaceChanges();
      if (changes.length > 0) {
        console.log(chalk.yellow(`\n📝 ${changes.length} files changed in sandbox:`));
        changes.slice(0, 10).forEach(file => console.log(chalk.gray(`  - ${file}`)));
        if (changes.length > 10) {
          console.log(chalk.gray(`  ... and ${changes.length - 10} more`));
        }
        
        console.log(chalk.blue('\n💡 Run "vibekit sync" to apply changes to your project'));
        
        // Capture file changes in analytics if available
        if (result.analytics) {
          result.analytics.filesChanged = changes;
        }
      }

      return { ...result, duration, changes };
    } finally {
      await dockerSandbox.cleanup();
    }
  }


  async runDirect(args) {
    const startTime = Date.now();
    const result = await this.createChildProcess(this.getAgentCommand(), args);
    const duration = Date.now() - startTime;

    await this.logger.log('info', `${this.agentName} agent completed without sandbox`, { 
      exitCode: result.code,
      duration 
    });

    return { ...result, duration };
  }

  getAgentCommand() {
    // Override in subclasses
    return this.agentName;
  }

  async executeAgent(args) {
    throw new Error('executeAgent must be implemented by subclass');
  }

  async captureFileSnapshot(dir = process.cwd()) {
    const snapshot = new Map();
    
    const walkDir = async (dirPath, relativePath = '') => {
      try {
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
          if (item.startsWith('.') && item !== '.gitignore') continue;
          
          const itemPath = path.join(dirPath, item);
          const relativeItemPath = path.join(relativePath, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            await walkDir(itemPath, relativeItemPath);
          } else {
            try {
              const content = await fs.readFile(itemPath, 'utf8');
              const hash = crypto.createHash('md5').update(content).digest('hex');
              snapshot.set(relativeItemPath, hash);
            } catch (error) {
              // Skip files that can't be read (binary, permissions, etc.)
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await walkDir(dir);
    return snapshot;
  }

  async detectFileChanges(beforeSnapshot, afterSnapshot) {
    const changes = [];
    const created = [];
    const deleted = [];

    // Check for new and modified files
    for (const [filePath, hash] of afterSnapshot) {
      if (!beforeSnapshot.has(filePath)) {
        created.push(filePath);
        changes.push(filePath);
      } else if (beforeSnapshot.get(filePath) !== hash) {
        changes.push(filePath);
      }
    }

    // Check for deleted files
    for (const [filePath] of beforeSnapshot) {
      if (!afterSnapshot.has(filePath)) {
        deleted.push(filePath);
      }
    }

    return { changes, created, deleted };
  }

  createChildProcess(command, args, options = {}) {
    const startTime = Date.now();
    const analytics = new Analytics(this.agentName, this.logger);
    
    // Capture the command being executed
    analytics.captureCommand(command, args);
    
    // Capture file snapshot before execution for change tracking
    let beforeSnapshot;
    const captureSnapshot = async () => {
      try {
        beforeSnapshot = await this.captureFileSnapshot();
      } catch (error) {
        console.warn('Failed to capture file snapshot:', error.message);
      }
    };
    
    // Determine if this is likely an interactive session
    const isInteractive = args.length === 0 && process.stdin.isTTY;
    
    // PTY functionality removed - using standard child process for all sessions
    
    return new Promise(async (resolve, reject) => {
      // Capture initial file snapshot
      await captureSnapshot();
      
      // Show startup status using Static component to avoid conflicts
      const { rerender, unmount } = render(React.createElement(Static, { items: [{ 
        key: 'status-display',
        agentName: this.agentName,
        sandboxType: this.sandboxType,
        options: { proxy: this.proxy },
        settings: this.settings
      }] }, (item) => React.createElement(StatusDisplay, item)));
      
      // Unmount after a brief delay to prevent conflicts with child process
      setTimeout(() => {
        try {
          unmount();
        } catch (error) {
          // Ignore unmount errors
        }
      }, 100);
      
      let spawnOptions;
      
      // Prepare environment variables with proxy settings
      const env = { 
        ...process.env, 
        ...options.env 
      };
      
      // Add proxy settings to environment if specified
      if (this.proxy) {
        env.HTTP_PROXY = this.proxy;
        env.HTTPS_PROXY = this.proxy;
        env.http_proxy = this.proxy;
        env.https_proxy = this.proxy;
      }
      
      if (isInteractive) {
        // For interactive mode, use inherit stdio but still capture analytics
        spawnOptions = {
          stdio: 'inherit',
          cwd: options.cwd || process.cwd(),
          env,
          ...options
        };
      } else {
        // For non-interactive mode, capture streams for detailed analytics
        spawnOptions = {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.cwd || process.cwd(),
          env,
          ...options
        };
      }
      
      const child = spawn(command, args, spawnOptions);

      if (!isInteractive) {
        // Only set up stream interception for non-interactive mode
        
        // Intercept and forward stdout
        child.stdout.on('data', (data) => {
          analytics.captureOutput(data);
          process.stdout.write(data);
        });

        // Intercept and forward stderr
        child.stderr.on('data', (data) => {
          analytics.captureOutput(data);
          process.stderr.write(data);
        });

        // Forward stdin to child process
        const stdinHandler = (data) => {
          analytics.captureInput(data);
          if (child.stdin && !child.stdin.destroyed) {
            child.stdin.write(data);
          }
        };

        process.stdin.on('data', stdinHandler);

        // Handle process end
        process.stdin.on('end', () => {
          if (child.stdin && !child.stdin.destroyed) {
            child.stdin.end();
          }
        });

        // Cleanup function for non-interactive mode
        const cleanup = () => {
          process.stdin.removeListener('data', stdinHandler);
        };

        child.on('close', async (code) => {
          cleanup();
          
          const duration = Date.now() - startTime;
          
          // Detect file changes
          let fileChanges = { changes: [], created: [], deleted: [] };
          if (beforeSnapshot) {
            try {
              const afterSnapshot = await this.captureFileSnapshot();
              fileChanges = await this.detectFileChanges(beforeSnapshot, afterSnapshot);
              
              // Capture file operations in analytics
              analytics.captureFileChanges(fileChanges.changes);
              analytics.captureFileOperations(fileChanges.created, fileChanges.deleted);
            } catch (error) {
              console.warn('Failed to detect file changes:', error.message);
            }
          }
          
          // Finalize analytics
          const analyticsData = await analytics.finalize(code, duration);
          
          resolve({
            code,
            duration,
            analytics: analyticsData,
            changes: fileChanges.changes
          });
        });

        child.on('error', async (error) => {
          cleanup();
          
          console.error(chalk.red(`[vibekit] Process error: ${error.message}`));
          
          // Finalize analytics with error
          await analytics.finalize(-1, Date.now() - startTime);
          
          reject(error);
        });
      } else {
        // For interactive mode, capture stderr for error analysis
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            const output = data.toString();
            analytics.parseOutputForMetrics(output);
          });
        }
        
        child.on('close', async (code) => {
          const duration = Date.now() - startTime;
          
          // Detect file changes
          let fileChanges = { changes: [], created: [], deleted: [] };
          if (beforeSnapshot) {
            try {
              const afterSnapshot = await this.captureFileSnapshot();
              fileChanges = await this.detectFileChanges(beforeSnapshot, afterSnapshot);
              
              // Capture file operations in analytics
              analytics.captureFileChanges(fileChanges.changes);
              analytics.captureFileOperations(fileChanges.created, fileChanges.deleted);
            } catch (error) {
              console.warn('Failed to detect file changes:', error.message);
            }
          }
          
          // Finalize analytics
          const analyticsData = await analytics.finalize(code, duration);
          
          resolve({
            code,
            duration,
            analytics: analyticsData,
            changes: fileChanges.changes
          });
        });

        child.on('error', async (error) => {
          console.error(chalk.red(`[vibekit] Process error: ${error.message}`));
          
          // Finalize analytics with error
          await analytics.finalize(-1, Date.now() - startTime);
          
          reject(error);
        });
      }

      // Handle signals
      process.on('SIGINT', () => {
        child.kill('SIGINT');
      });

      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
      });
    });
  }

}

export default BaseAgent;