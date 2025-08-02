import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import Docker from '../sandbox/docker.js';
import displayStartupStatus from '../components/status-display.js';
import Analytics from '../analytics/analytics.js';

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
      const command = this.getAgentCommand();
      const result = await dockerSandbox.runCommand(command, args);
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
    console.log(chalk.red('⚠ WARNING: Running without sandbox - agent has full system access!'));
    
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

  createChildProcess(command, args, options = {}) {
    const startTime = Date.now();
    const analytics = new Analytics(this.agentName, this.logger);
    
    // Capture the command being executed
    analytics.captureCommand(command, args);
    
    // Determine if this is likely an interactive session
    const isInteractive = args.length === 0 && process.stdin.isTTY;
    
    // Use PTY for interactive sessions to capture full analytics
    // Interactive sessions always use PTY for better analytics unless explicitly disabled
    if (isInteractive && !this.disablePty) {
      return this.createPtyProcess(command, args, options, analytics, startTime);
    }
    
    return new Promise((resolve, reject) => {
      // Show startup status
      displayStartupStatus(this.agentName, this.sandboxType);
      
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
          console.log(chalk.blue(`[vibekit] Process exited with code ${code} (${duration}ms)`));
          
          // Finalize analytics
          const analyticsData = await analytics.finalize(code, duration);
          
          resolve({
            code,
            duration,
            analytics: analyticsData
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
        // For interactive mode, try to capture some output for token analysis
        // by briefly intercepting stderr for Claude's final usage statistics
        let finalOutput = '';
        
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            const output = data.toString();
            finalOutput += output;
            // Look for token usage patterns that Claude might output to stderr
            if (output.includes('token') || output.includes('usage') || output.includes('cost')) {
              analytics.parseOutputForMetrics(output);
            }
          });
        }
        
        child.on('close', async (code) => {
          const duration = Date.now() - startTime;
          console.log(chalk.blue(`[vibekit] Process exited with code ${code} (${duration}ms)`));
          
          // For interactive sessions, estimate tokens based on duration
          // This is a rough heuristic: longer sessions likely used more tokens
          if (duration > 10000) { // If session was longer than 10 seconds
            analytics.metrics.inputTokens = Math.max(analytics.metrics.inputTokens, Math.floor(duration / 1000));
            analytics.metrics.outputTokens = Math.max(analytics.metrics.outputTokens, Math.floor(duration / 500));
          }
          
          // Finalize analytics
          const analyticsData = await analytics.finalize(code, duration);
          
          resolve({
            code,
            duration,
            analytics: analyticsData
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

  async createPtyProcess(command, args, options, analytics, startTime) {
    let pty;
    
    try {
      // Dynamic import to handle environments where node-pty might not be available
      pty = (await import('node-pty')).default;
    } catch (error) {
      console.log(chalk.yellow('⚠ node-pty not available, falling back to basic analytics'));
      // Fall back to basic mode
      this.analyticsMode = 'basic';
      return this.createChildProcess(command, args, options);
    }

    return new Promise((resolve, reject) => {
      // Show startup status
      displayStartupStatus(this.agentName, this.sandboxType);
      
      // Get terminal size
      const cols = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;
      
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
      
      // Spawn with PTY for full interactivity + analytics
      const child = pty.spawn(command, args, {
        name: 'xterm-color',
        cols: cols,
        rows: rows,
        cwd: options.cwd || process.cwd(),
        env
      });

      // Set up raw mode for proper TTY behavior
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
      }

      // Forward data from PTY to stdout and capture for analytics
      child.onData((data) => {
        analytics.captureOutput(data);
        process.stdout.write(data);
        
        // Capture for analytics (debug logs removed to avoid interference)
      });

      // Forward stdin to PTY and capture for analytics
      const stdinHandler = (data) => {
        analytics.captureInput(data);
        child.write(data);
        
        // Capture for analytics (debug logs removed to avoid interference)
      };

      process.stdin.on('data', stdinHandler);

      // Handle terminal resize
      const resizeHandler = () => {
        if (process.stdout.columns && process.stdout.rows) {
          child.resize(process.stdout.columns, process.stdout.rows);
        }
      };
      process.stdout.on('resize', resizeHandler);

      // Handle process exit
      child.onExit(async ({ exitCode, signal }) => {
        // Cleanup
        process.stdin.removeListener('data', stdinHandler);
        process.stdout.removeListener('resize', resizeHandler);
        
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
        }

        const duration = Date.now() - startTime;
        const code = exitCode !== undefined ? exitCode : (signal ? -1 : 0);
        
        console.log(chalk.blue(`[vibekit] Process exited with code ${code} (${duration}ms)`));
        
        // Finalize analytics with full data
        const analyticsData = await analytics.finalize(code, duration);
        
        resolve({
          code,
          duration,
          analytics: analyticsData
        });
      });

      // Handle PTY errors
      child.onData((data) => {
        // Check for error patterns in the data
        const output = data.toString();
        if (output.includes('command not found') || output.includes('error')) {
          console.error(chalk.red(`[vibekit] Possible error detected: ${output.trim()}`));
        }
      });

      // Handle signals
      const signalHandler = (signal) => {
        console.log(chalk.yellow(`\n[vibekit] Received ${signal}, terminating...`));
        child.kill(signal);
      };

      process.on('SIGINT', signalHandler);
      process.on('SIGTERM', signalHandler);
    });
  }
}

export default BaseAgent;