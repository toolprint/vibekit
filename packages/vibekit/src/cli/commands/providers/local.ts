/**
 * Local Provider Installation
 * 
 * Handles installation and setup of the local provider using Container Use.
 * This includes dependency validation, Container Use installation, and
 * basic configuration setup.
 */

import chalk from 'chalk';
import ora from 'ora';
import { createLocalProvider, DependencyValidator, ContainerUseInstaller } from '@vibekit/local';
import type { InstallConfig } from '../../utils/install.js';

export async function installLocal(config: InstallConfig, selectedTemplates?: string[]) {
  const spinner = ora('Setting up local provider...').start();
  
  try {
    // Step 1: Validate system dependencies
    spinner.text = 'Validating system dependencies...';
    const validator = new DependencyValidator();
    const validation = await validator.validateSystem();
    
    if (!validation.valid) {
      const errors = validation.issues.filter(issue => issue.severity === 'error');
      
      if (errors.length > 0) {
        spinner.fail('System dependencies not met');
        
        console.log(chalk.red('\n❌ Missing required dependencies:'));
        for (const error of errors) {
          console.log(`  • ${chalk.yellow(error.component)}: ${error.message}`);
          console.log(`    ${chalk.gray('Solution:')} ${error.solution}`);
        }
        
        console.log(chalk.blue('\n💡 After installing dependencies, run:'));
        console.log(chalk.cyan('  vibekit init --providers Local'));
        
        return false;
      }
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      for (const warning of validation.warnings) {
        console.log(`  • ${chalk.yellow(warning.component)}: ${warning.message}`);
        console.log(`    ${chalk.gray('Recommendation:')} ${warning.recommendation}`);
      }
    }
    
    // Step 2: Install Container Use if needed
    spinner.text = 'Installing Container Use...';
    const installer = new ContainerUseInstaller();
    const installResult = await installer.installContainerUse();
    
    if (!installResult.success) {
      spinner.fail('Failed to install Container Use');
      console.error(chalk.red(`\nError: ${installResult.message}`));
      
      console.log(chalk.blue('\n💡 Manual installation:'));
      console.log(chalk.cyan('  # On macOS with Homebrew:'));
      console.log(chalk.cyan('  brew install dagger/tap/container-use'));
      console.log(chalk.cyan('  '));
      console.log(chalk.cyan('  # On other systems:'));
      console.log(chalk.cyan('  curl -fsSL https://raw.githubusercontent.com/dagger/container-use/main/install.sh | bash'));
      
      return false;
    }
    
    // Step 3: Initialize local provider
    spinner.text = 'Initializing local provider...';
    const localProvider = createLocalProvider({
      autoInstall: false, // Already installed above
    });
    
    // Step 4: Basic configuration
    spinner.text = 'Configuring environments...';
    
    // Create a test environment to validate everything works
    try {
      const testSandbox = await localProvider.create(
        { VIBEKIT_TEST: 'true' },
        'claude',
        '/workspace'
      );
      
      // Clean up test environment
      await localProvider.deleteEnvironment(testSandbox.sandboxId);
      
      spinner.succeed('Local provider configured successfully');
      
      console.log(chalk.green('\n✅ Local provider is ready!'));
      console.log(chalk.blue('\n📋 What\'s available:'));
      console.log(`  • Create sandboxes: ${chalk.cyan('vibekit local create')}`);
      console.log(`  • List environments: ${chalk.cyan('vibekit local list')}`);
      console.log(`  • Watch logs: ${chalk.cyan('vibekit local watch <name>')}`);
      console.log(`  • Access terminal: ${chalk.cyan('vibekit local terminal <name>')}`);
      console.log(`  • Clean up: ${chalk.cyan('vibekit local delete <name>')}`);
      
      console.log(chalk.yellow('\n💡 Quick start:'));
      console.log(chalk.cyan('  vibekit local create --agent claude --name my-sandbox'));
      console.log(chalk.cyan('  vibekit local watch my-sandbox'));
      
      if (selectedTemplates && selectedTemplates.length > 0) {
        console.log(chalk.blue(`\n🎯 Agent templates available: ${selectedTemplates.join(', ')}`));
      }
      
      return true;
      
    } catch (error) {
      spinner.fail('Failed to validate local provider setup');
      console.error(chalk.red(`\nValidation error: ${error instanceof Error ? error.message : String(error)}`));
      
      console.log(chalk.yellow('\n🔧 Troubleshooting:'));
      console.log('  1. Ensure Docker is running');
      console.log('  2. Check Container Use installation: container-use --version');
      console.log('  3. Verify Container Use works: container-use list');
      
      return false;
    }
    
  } catch (error) {
    spinner.fail('Local provider setup failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
    
    console.log(chalk.blue('\n📖 Documentation:'));
    console.log('  • Local Provider: https://docs.vibekit.dev/providers/local');
    console.log('  • Container Use: https://github.com/dagger/container-use');
    
    return false;
  }
}

/**
 * Check if Container Use is installed and accessible
 */
export async function isContainerUseInstalled(): Promise<boolean> {
  try {
    const installer = new ContainerUseInstaller();
    const { execa } = await import('execa');
    
    // Try to run container-use --version
    await execa('container-use', ['--version']);
    return true;
  } catch (error) {
    return false;
  }
} 