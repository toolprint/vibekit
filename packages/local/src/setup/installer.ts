/**
 * Container Use Installation and Setup
 * 
 * Handles automated installation of Container Use and its dependencies,
 * with proper error handling and cross-platform support.
 */

import { execa } from 'execa';
import which from 'which';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface InstallationResult {
  success: boolean;
  message: string;
  installedComponents: string[];
  warnings?: string[];
}

export interface DependencyStatus {
  name: string;
  available: boolean;
  version?: string;
  required: boolean;
  installCommand?: string;
}

export class ContainerUseInstaller {
  private readonly platform: string;
  private readonly arch: string;

  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
  }

  /**
   * Check all dependencies and return their status
   */
  async checkDependencies(): Promise<DependencyStatus[]> {
    const dependencies: DependencyStatus[] = [
      {
        name: 'Docker',
        available: false,
        required: true,
        installCommand: this.getDockerInstallCommand(),
      },
      {
        name: 'Container Use',
        available: false,
        required: true,
        installCommand: this.getContainerUseInstallCommand(),
      },
      {
        name: 'Git',
        available: false,
        required: true,
        installCommand: this.getGitInstallCommand(),
      },
    ];

    // Check Docker
    try {
      const dockerPath = await which('docker');
      const dockerVersion = await this.getDockerVersion();
      dependencies[0].available = true;
      dependencies[0].version = dockerVersion;
    } catch {
      // Docker not available
    }

    // Check Container Use
    try {
      const cuPath = await which('container-use');
      const cuVersion = await this.getContainerUseVersion();
      dependencies[1].available = true;
      dependencies[1].version = cuVersion;
    } catch {
      // Container Use not available
    }

    // Check Git
    try {
      const gitPath = await which('git');
      const gitVersion = await this.getGitVersion();
      dependencies[2].available = true;
      dependencies[2].version = gitVersion;
    } catch {
      // Git not available
    }

    return dependencies;
  }

  /**
   * Install Container Use and verify installation
   */
  async installContainerUse(): Promise<InstallationResult> {
    try {
      // Check if already installed
      const existing = await this.getContainerUseVersion();
      if (existing) {
        return {
          success: true,
          message: `Container Use ${existing} is already installed`,
          installedComponents: [],
        };
      }
    } catch {
      // Not installed, proceed with installation
    }

    try {
      const result = await this.runContainerUseInstaller();
      
      // Verify installation
      const version = await this.getContainerUseVersion();
      if (!version) {
        throw new Error('Installation completed but container-use command not found');
      }

      return {
        success: true,
        message: `Successfully installed Container Use ${version}`,
        installedComponents: ['container-use'],
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to install Container Use: ${error instanceof Error ? error.message : 'Unknown error'}`,
        installedComponents: [],
      };
    }
  }

  /**
   * Setup Container Use configuration
   */
  async setupConfiguration(options: {
    baseImage?: string;
    workingDirectory?: string;
  } = {}): Promise<InstallationResult> {
    try {
      const configDir = this.getConfigDirectory();
      await fs.ensureDir(configDir);

      const config = {
        baseImage: options.baseImage || 'ubuntu:24.04',
        workingDirectory: options.workingDirectory || '/workspace',
        defaultPorts: [3000, 8000, 8080],
        resources: {
          memory: '2g',
          cpu: '1',
        },
      };

      const configPath = path.join(configDir, 'config.json');
      await fs.writeJson(configPath, config, { spaces: 2 });

      return {
        success: true,
        message: 'Container Use configuration created',
        installedComponents: ['config'],
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to setup configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        installedComponents: [],
      };
    }
  }

  /**
   * Perform complete setup (install and configure)
   */
  async performCompleteSetup(options: {
    baseImage?: string;
    workingDirectory?: string;
    skipDependencies?: boolean;
  } = {}): Promise<InstallationResult> {
    const results: InstallationResult[] = [];
    const installedComponents: string[] = [];
    const warnings: string[] = [];

    // Check dependencies first
    if (!options.skipDependencies) {
      const deps = await this.checkDependencies();
      const missingRequired = deps.filter(dep => dep.required && !dep.available);

      if (missingRequired.length > 0) {
        const missing = missingRequired.map(dep => dep.name).join(', ');
        return {
          success: false,
          message: `Missing required dependencies: ${missing}. Please install them first.`,
          installedComponents: [],
          warnings: missingRequired.map(dep => 
            `Install ${dep.name}: ${dep.installCommand || 'See documentation'}`
          ),
        };
      }
    }

    // Install Container Use
    const installResult = await this.installContainerUse();
    results.push(installResult);
    installedComponents.push(...installResult.installedComponents);

    if (!installResult.success) {
      return {
        success: false,
        message: installResult.message,
        installedComponents,
        warnings,
      };
    }

    // Setup configuration
    const configResult = await this.setupConfiguration(options);
    results.push(configResult);
    installedComponents.push(...configResult.installedComponents);

    if (configResult.warnings) {
      warnings.push(...configResult.warnings);
    }

    return {
      success: results.every(r => r.success),
      message: 'Container Use setup completed successfully',
      installedComponents,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Private helper methods

  private async runContainerUseInstaller(): Promise<void> {
    if (this.platform === 'darwin') {
      // Try Homebrew first on macOS
      try {
        await execa('brew', ['install', 'dagger/tap/container-use'], {
          stdio: 'inherit',
          timeout: 300000, // 5 minutes
        });
        return;
      } catch {
        // Fall back to curl installer
      }
    }

    // Use curl installer for all platforms
    const installScript = 'https://raw.githubusercontent.com/dagger/container-use/main/install.sh';
    await execa('curl', ['-fsSL', installScript], {
      stdio: ['pipe', 'pipe', 'inherit'],
      timeout: 300000, // 5 minutes
    }).then(result => {
      return execa('bash', [], {
        input: result.stdout,
        stdio: ['pipe', 'inherit', 'inherit'],
        timeout: 300000,
      });
    });
  }

  private async getDockerVersion(): Promise<string> {
    try {
      const result = await execa('docker', ['--version'], { timeout: 5000 });
      const match = result.stdout.match(/Docker version (\d+\.\d+\.\d+)/);
      return match ? match[1] : 'unknown';
    } catch {
      throw new Error('Docker not available');
    }
  }

  private async getContainerUseVersion(): Promise<string> {
    try {
      const result = await execa('container-use', ['--version'], { timeout: 5000 });
      const match = result.stdout.match(/v?(\d+\.\d+\.\d+)/);
      return match ? match[1] : result.stdout.trim();
    } catch {
      throw new Error('Container Use not available');
    }
  }

  private async getGitVersion(): Promise<string> {
    try {
      const result = await execa('git', ['--version'], { timeout: 5000 });
      const match = result.stdout.match(/git version (\d+\.\d+\.\d+)/);
      return match ? match[1] : 'unknown';
    } catch {
      throw new Error('Git not available');
    }
  }

  private getConfigDirectory(): string {
    const homeDir = os.homedir();
    
    switch (this.platform) {
      case 'darwin':
        return path.join(homeDir, '.config', 'container-use');
      case 'win32':
        return path.join(process.env.APPDATA || homeDir, 'container-use');
      default:
        return path.join(homeDir, '.config', 'container-use');
    }
  }

  private getDockerInstallCommand(): string {
    switch (this.platform) {
      case 'darwin':
        return 'brew install --cask docker';
      case 'win32':
        return 'Download Docker Desktop from https://docker.com/products/docker-desktop';
      default:
        return 'curl -fsSL https://get.docker.com | sh';
    }
  }

  private getContainerUseInstallCommand(): string {
    if (this.platform === 'darwin') {
      return 'brew install dagger/tap/container-use';
    }
    return 'curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh | bash';
  }

  private getGitInstallCommand(): string {
    switch (this.platform) {
      case 'darwin':
        return 'brew install git';
      case 'win32':
        return 'Download Git from https://git-scm.com/download/win';
      default:
        return 'sudo apt-get install git (Ubuntu/Debian) or sudo yum install git (RHEL/CentOS)';
    }
  }
} 