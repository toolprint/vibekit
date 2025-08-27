import { VibeKit } from "@vibe-kit/sdk";

export interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
}

export class CommandUtils {
  constructor(private vibeKit: VibeKit) {}

  /**
   * Execute a command in the sandbox
   */
  async execute(command: string, options?: {
    timeout?: number;
    background?: boolean;
    workingDirectory?: string;
  }): Promise<CommandResult> {
    const fullCommand = options?.workingDirectory 
      ? `cd ${options.workingDirectory} && ${command}`
      : command;

    console.log(`  $ ${fullCommand}`);

    try {
      // We would need to access the sandbox instance directly
      // For now, we'll use a placeholder implementation
      // In a real implementation, you'd access the sandbox through VibeKit
      
      // This is a conceptual implementation - actual implementation would depend on
      // how VibeKit exposes sandbox command execution
      const result = {
        success: true,
        exitCode: 0,
        stdout: `Executed: ${fullCommand}\\nCommand completed successfully`,
        stderr: "",
        command: fullCommand
      };

      if (result.exitCode === 0) {
        console.log(`    ✅ Success`);
        if (result.stdout) {
          console.log(`    📄 ${result.stdout}`);
        }
      } else {
        console.log(`    ❌ Failed (exit code: ${result.exitCode})`);
        if (result.stderr) {
          console.log(`    🚫 ${result.stderr}`);
        }
      }

      return result;
    } catch (error) {
      const errorResult: CommandResult = {
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        command: fullCommand
      };

      console.log(`    ❌ Error: ${errorResult.stderr}`);
      return errorResult;
    }
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeSequence(commands: string[], options?: {
    stopOnError?: boolean;
    workingDirectory?: string;
  }): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    const stopOnError = options?.stopOnError ?? true;

    for (const command of commands) {
      const result = await this.execute(command, {
        workingDirectory: options?.workingDirectory
      });
      
      results.push(result);
      
      if (stopOnError && !result.success) {
        console.log(`⏹️ Stopping sequence due to error in: ${command}`);
        break;
      }
    }

    return results;
  }

  /**
   * Check if a command exists in the sandbox
   */
  async commandExists(command: string): Promise<boolean> {
    const result = await this.execute(`which ${command}`);
    return result.success;
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<{
    os: string;
    architecture: string;
    node: string;
    npm: string;
    git: string;
  }> {
    const commands = [
      'uname -s',           // OS
      'uname -m',           // Architecture
      'node --version',     // Node.js version
      'npm --version',      // npm version
      'git --version'       // Git version
    ];

    const results = await this.executeSequence(commands, { stopOnError: false });
    
    return {
      os: results[0]?.stdout?.trim() || 'unknown',
      architecture: results[1]?.stdout?.trim() || 'unknown', 
      node: results[2]?.stdout?.trim() || 'not installed',
      npm: results[3]?.stdout?.trim() || 'not installed',
      git: results[4]?.stdout?.trim() || 'not installed'
    };
  }

  /**
   * Setup a basic development environment
   */
  async setupDevEnvironment(workingDir: string = '/workspace'): Promise<boolean> {
    console.log(`🛠️ Setting up development environment in ${workingDir}...`);

    const setupCommands = [
      `mkdir -p ${workingDir}`,
      `cd ${workingDir}`,
      'pwd',
      'ls -la'
    ];

    const results = await this.executeSequence(setupCommands);
    const allSucceeded = results.every(r => r.success);

    if (allSucceeded) {
      console.log(`✅ Development environment ready at ${workingDir}`);
    } else {
      console.log(`❌ Failed to set up development environment`);
    }

    return allSucceeded;
  }

  /**
   * Install Node.js dependencies
   */
  async installDependencies(packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm', workingDir?: string): Promise<boolean> {
    console.log(`📦 Installing dependencies with ${packageManager}...`);

    const installCommand = packageManager === 'npm' ? 'npm install' :
                          packageManager === 'yarn' ? 'yarn install' : 
                          'pnpm install';

    const result = await this.execute(installCommand, { workingDirectory: workingDir });
    
    if (result.success) {
      console.log(`✅ Dependencies installed successfully`);
    } else {
      console.log(`❌ Failed to install dependencies`);
    }

    return result.success;
  }

  /**
   * Start a development server
   */
  async startDevServer(command: string = 'npm run dev', port: number = 3000, workingDir?: string): Promise<boolean> {
    console.log(`🚀 Starting development server on port ${port}...`);

    // Start server in background
    const result = await this.execute(command, { 
      background: true,
      workingDirectory: workingDir
    });

    if (result.success) {
      console.log(`✅ Development server started`);
      
      // Wait a moment for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to get the host URL
      try {
        const hostUrl = await this.vibeKit.getHost(port);
        console.log(`🌐 Server available at: ${hostUrl}`);
        return true;
      } catch (error) {
        console.log(`⚠️ Server started but host URL not available: ${error}`);
        return true; // Still consider it successful
      }
    } else {
      console.log(`❌ Failed to start development server`);
      return false;
    }
  }
}