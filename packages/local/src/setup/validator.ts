/**
 * Container Use Dependency Validator
 * 
 * Validates system dependencies and provides helpful error messages
 * and installation guidance.
 */

import { execa } from 'execa';
import * as os from 'os';

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
}

export interface ValidationIssue {
  component: string;
  severity: 'error' | 'warning';
  message: string;
  solution: string;
}

export interface ValidationWarning {
  component: string;
  message: string;
  recommendation: string;
}

export class DependencyValidator {
  private readonly platform: string;
  private readonly arch: string;

  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
  }

  /**
   * Validate all system dependencies
   */
  async validateSystem(): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate Docker
    const dockerValidation = await this.validateDocker();
    issues.push(...dockerValidation.issues);
    warnings.push(...dockerValidation.warnings);

    // Validate Container Use
    const containerUseValidation = await this.validateContainerUse();
    issues.push(...containerUseValidation.issues);
    warnings.push(...containerUseValidation.warnings);

    // Validate Git
    const gitValidation = await this.validateGit();
    issues.push(...gitValidation.issues);
    warnings.push(...gitValidation.warnings);

    // Validate system resources
    const resourceValidation = this.validateSystemResources();
    warnings.push(...resourceValidation.warnings);

    return {
      valid: issues.filter(issue => issue.severity === 'error').length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Validate Docker installation and runtime
   */
  async validateDocker(): Promise<{ issues: ValidationIssue[]; warnings: ValidationWarning[] }> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check if Docker command exists
      await execa('docker', ['--version'], { timeout: 5000 });

      // Check if Docker daemon is running
      try {
        await execa('docker', ['ps'], { timeout: 10000 });
      } catch (error) {
        issues.push({
          component: 'Docker',
          severity: 'error',
          message: 'Docker is installed but daemon is not running',
          solution: this.getDockerStartSolution(),
        });
        return { issues, warnings };
      }

      // Check Docker version
      try {
        const result = await execa('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 5000 });
        const version = result.stdout.trim();
        
        if (this.compareVersions(version, '20.0.0') < 0) {
          warnings.push({
            component: 'Docker',
            message: `Docker version ${version} detected`,
            recommendation: 'Consider upgrading to Docker 20.0.0 or later for better compatibility',
          });
        }
      } catch {
        warnings.push({
          component: 'Docker',
          message: 'Could not determine Docker version',
          recommendation: 'Ensure Docker is properly installed and accessible',
        });
      }

    } catch (error) {
      issues.push({
        component: 'Docker',
        severity: 'error',
        message: 'Docker is not installed or not accessible',
        solution: this.getDockerInstallSolution(),
      });
    }

    return { issues, warnings };
  }

  /**
   * Validate Container Use installation
   */
  async validateContainerUse(): Promise<{ issues: ValidationIssue[]; warnings: ValidationWarning[] }> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      await execa('container-use', ['--version'], { timeout: 5000 });
    } catch (error) {
      issues.push({
        component: 'Container Use',
        severity: 'error',
        message: 'Container Use is not installed or not accessible',
        solution: this.getContainerUseInstallSolution(),
      });
    }

    return { issues, warnings };
  }

  /**
   * Validate Git installation
   */
  async validateGit(): Promise<{ issues: ValidationIssue[]; warnings: ValidationWarning[] }> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      await execa('git', ['--version'], { timeout: 5000 });
    } catch (error) {
      issues.push({
        component: 'Git',
        severity: 'error',
        message: 'Git is not installed or not accessible',
        solution: this.getGitInstallSolution(),
      });
    }

    return { issues, warnings };
  }

  /**
   * Validate system resources (RAM, disk space, etc.)
   */
  validateSystemResources(): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = [];

    // Check available memory
    const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
    const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);

    if (totalMemoryGB < 8) {
      warnings.push({
        component: 'System Memory',
        message: `Total system memory: ${totalMemoryGB.toFixed(1)}GB`,
        recommendation: 'At least 8GB RAM recommended for running multiple containers',
      });
    }

    if (freeMemoryGB < 2) {
      warnings.push({
        component: 'Available Memory',
        message: `Available memory: ${freeMemoryGB.toFixed(1)}GB`,
        recommendation: 'Ensure at least 2GB free memory for container operations',
      });
    }

    // Check CPU cores
    const cpuCores = os.cpus().length;
    if (cpuCores < 2) {
      warnings.push({
        component: 'CPU',
        message: `CPU cores: ${cpuCores}`,
        recommendation: 'At least 2 CPU cores recommended for optimal performance',
      });
    }

    return { warnings };
  }

  /**
   * Check if virtualization is enabled (where possible)
   */
  async validateVirtualization(): Promise<{ issues: ValidationIssue[]; warnings: ValidationWarning[] }> {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    if (this.platform === 'linux') {
      try {
        // Check for KVM support
        const kvmCheck = await execa('lscpu', [], { timeout: 5000 });
        if (!kvmCheck.stdout.includes('Virtualization')) {
          warnings.push({
            component: 'Virtualization',
            message: 'Hardware virtualization may not be enabled',
            recommendation: 'Enable VT-x/AMD-V in BIOS for better Docker performance',
          });
        }
      } catch {
        // lscpu not available, skip check
      }
    }

    return { issues, warnings };
  }

  // Private helper methods

  private getDockerInstallSolution(): string {
    switch (this.platform) {
      case 'darwin':
        return 'Install Docker Desktop: brew install --cask docker';
      case 'win32':
        return 'Download Docker Desktop from https://docker.com/products/docker-desktop';
      default:
        return 'Install Docker: curl -fsSL https://get.docker.com | sh';
    }
  }

  private getDockerStartSolution(): string {
    switch (this.platform) {
      case 'darwin':
        return 'Start Docker Desktop application';
      case 'win32':
        return 'Start Docker Desktop application';
      default:
        return 'Start Docker daemon: sudo systemctl start docker';
    }
  }

  private getContainerUseInstallSolution(): string {
    if (this.platform === 'darwin') {
      return 'Install Container Use: brew install dagger/tap/container-use';
    }
    return 'Install Container Use: curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh | bash';
  }

  private getGitInstallSolution(): string {
    switch (this.platform) {
      case 'darwin':
        return 'Install Git: brew install git';
      case 'win32':
        return 'Download Git from https://git-scm.com/download/win';
      default:
        return 'Install Git: sudo apt-get install git (Ubuntu/Debian)';
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(n => parseInt(n, 10));
    const v2Parts = version2.split('.').map(n => parseInt(n, 10));

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }
} 