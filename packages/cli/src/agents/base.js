import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import DockerSandbox from '../sandbox/docker-sandbox.js';

class BaseAgent {
  constructor(agentName, logger, options = {}) {
    this.agentName = agentName;
    this.logger = logger;
    this.sandboxPath = path.join(process.cwd(), '.vibekit-sandbox');
    
    // Sandbox options: 'local' (default), 'docker', or false
    this.sandboxType = options.sandbox || 'local';
    this.sandboxOptions = options.sandboxOptions || {};
  }

  async setupSandbox() {
    await fs.ensureDir(this.sandboxPath);
    
    const originalCwd = process.cwd();
    const sandboxCwd = path.join(this.sandboxPath, 'workspace');
    await fs.ensureDir(sandboxCwd);

    if (!await fs.pathExists(path.join(sandboxCwd, '.git'))) {
      const gitFiles = ['.git', '.gitignore', 'package.json', 'yarn.lock', 'package-lock.json'];
      
      for (const file of gitFiles) {
        const srcPath = path.join(originalCwd, file);
        const destPath = path.join(sandboxCwd, file);
        
        if (await fs.pathExists(srcPath)) {
          await fs.copy(srcPath, destPath);
        }
      }
    }

    return sandboxCwd;
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
        case 'local':
          return await this.runInLocalSandbox(args);
        case false:
        case 'none':
          return await this.runDirect(args);
        default:
          // Default to local sandbox (no dependencies required)
          return await this.runInLocalSandbox(args);
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
    const dockerSandbox = new DockerSandbox(process.cwd(), this.logger, this.sandboxOptions);
    
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
      }

      return { ...result, duration, changes };
    } finally {
      await dockerSandbox.cleanup();
    }
  }

  async runInLocalSandbox(args) {
    const sandboxCwd = await this.setupSandbox();
    const result = await this.executeAgent(args, sandboxCwd);
    
    await this.logger.log('info', `${this.agentName} agent completed in local sandbox`, { 
      exitCode: result.code,
      duration: result.duration 
    });

    return result;
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

  async executeAgent(args, cwd) {
    throw new Error('executeAgent must be implemented by subclass');
  }

  createChildProcess(command, args, options = {}) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      console.log(chalk.blue(`[vibekit] Executing: ${command} ${args.join(' ')}`));
      
      const child = spawn(command, args, {
        stdio: 'inherit',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        ...options
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        console.log(chalk.blue(`[vibekit] Process exited with code ${code} (${duration}ms)`));
        
        resolve({
          code,
          duration
        });
      });

      child.on('error', (error) => {
        console.error(chalk.red(`[vibekit] Process error: ${error.message}`));
        reject(error);
      });

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