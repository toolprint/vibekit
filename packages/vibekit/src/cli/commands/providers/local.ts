/**
 * Local Provider Installation
 * 
 * Handles installation and setup of the local provider using Dagger.
 * This includes dependency validation, Dagger CLI installation, and
 * basic configuration setup.
 */

import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import os from 'os';
import type { InstallConfig } from '../../utils/install.js';

export async function installLocal(config: InstallConfig, selectedTemplates?: string[]) {
  const spinner = ora('Setting up local provider with Dagger...').start();
  
  try {
    // Step 1: Validate system dependencies
    spinner.text = 'Validating system dependencies...';
    
    // Check Docker
    try {
      await execa('docker', ['--version']);
      await execa('docker', ['info']);
    } catch (error) {
      spinner.fail('Docker validation failed');
      console.log(chalk.red('\n❌ Docker is required but not available'));
      console.log(chalk.blue('\n💡 Install Docker:'));
      console.log(chalk.cyan('  Visit: https://docs.docker.com/get-docker/'));
      return false;
    }
    
    // Step 2: Install Dagger CLI if needed
    spinner.text = 'Checking Dagger CLI installation...';
    const isDaggerInstalled = await isDaggerCliInstalled();
    
    if (!isDaggerInstalled) {
      spinner.text = 'Installing Dagger CLI...';
      const installResult = await installDaggerCli();
      
      if (!installResult.success) {
        spinner.fail('Failed to install Dagger CLI');
        console.error(chalk.red(`\nError: ${installResult.message}`));
        
        console.log(chalk.blue('\n💡 Manual installation:'));
        console.log(chalk.cyan('  # On macOS:'));
        console.log(chalk.cyan('  brew install dagger/tap/dagger'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('  # On Linux:'));
        console.log(chalk.cyan('  curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('  # On Windows:'));
        console.log(chalk.cyan('  winget install Dagger.Cli'));
        
        return false;
      }
    } else {
      spinner.text = 'Dagger CLI already installed';
    }
    
    // Step 3: Verify Dagger installation
    spinner.text = 'Verifying Dagger installation...';
    try {
      const { stdout } = await execa('dagger', ['version']);
      console.log(chalk.green(`\n✅ Dagger CLI installed: ${stdout.trim()}`));
    } catch (error) {
      spinner.fail('Dagger CLI verification failed');
      console.error(chalk.red(`\nError verifying Dagger: ${error instanceof Error ? error.message : String(error)}`));
      return false;
    }
    
    // Step 4: Test Dagger connectivity
    spinner.text = 'Testing Dagger engine connectivity...';
    try {
      // Simple test to ensure Dagger engine can start
      await execa('dagger', ['query', '--help'], { timeout: 10000 });
      spinner.succeed('Dagger engine connectivity verified');
    } catch (error) {
      spinner.warn('Dagger engine test skipped (may start on first use)');
      console.log(chalk.yellow('\n⚠️  Dagger engine will start automatically on first use'));
    }
    
    spinner.succeed('Local provider with Dagger configured successfully');
    
    console.log(chalk.green('\n✅ Local provider is ready!'));
    console.log(chalk.blue('\n📋 What\'s available:'));
    console.log(`  • Create sandboxes: ${chalk.cyan('vibekit local create')}`);
    console.log(`  • List environments: ${chalk.cyan('vibekit local list')}`);
    console.log(`  • Watch logs: ${chalk.cyan('vibekit local watch <n>')}`);
    console.log(`  • Access terminal: ${chalk.cyan('vibekit local terminal <n>')}`);
    console.log(`  • Clean up: ${chalk.cyan('vibekit local delete <n>')}`);
    
    console.log(chalk.yellow('\n💡 Quick start:'));
    console.log(chalk.cyan('  vibekit local create --agent claude --name my-sandbox'));
    console.log(chalk.cyan('  vibekit local watch my-sandbox'));
    
    if (selectedTemplates && selectedTemplates.length > 0) {
      console.log(chalk.blue(`\n🎯 Agent templates available: ${selectedTemplates.join(', ')}`));
    }
    
    console.log(chalk.blue('\n🔧 Dagger Benefits:'));
    console.log(chalk.gray('  • Isolated containerized environments'));
    console.log(chalk.gray('  • Built-in git operations and PR creation'));
    console.log(chalk.gray('  • Cross-platform compatibility'));
    console.log(chalk.gray('  • Programmatic pipeline control'));
    
    return true;
    
  } catch (error) {
    spinner.fail('Local provider setup failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
    
    console.log(chalk.blue('\n📖 Documentation:'));
    console.log('  • Local Provider: https://docs.vibekit.dev/providers/local');
    console.log('  • Dagger: https://docs.dagger.io/');
    
    return false;
  }
}

/**
 * Check if Dagger CLI is installed and accessible
 */
export async function isDaggerCliInstalled(): Promise<boolean> {
  try {
    await execa('dagger', ['version']);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Install Dagger CLI based on the operating system
 */
async function installDaggerCli(): Promise<{ success: boolean; message: string }> {
  const platform = os.platform();
  
  try {
    switch (platform) {
      case 'darwin': // macOS
        console.log(chalk.blue('\n🍎 Installing Dagger CLI on macOS...'));
        try {
          // First try to install tap if not exists
          await execa('brew', ['tap', 'dagger/tap'], { timeout: 30000 });
        } catch (error) {
          // Tap might already exist, continue
        }
        await execa('brew', ['install', 'dagger/tap/dagger'], { timeout: 120000 });
        return { success: true, message: 'Dagger CLI installed successfully via Homebrew' };
        
      case 'linux':
        console.log(chalk.blue('\n🐧 Installing Dagger CLI on Linux...'));
        // Use curl to download and install
        await execa('sh', ['-c', 'curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh'], { timeout: 120000 });
        
        // Add to PATH if not already there
        const homeLocalBin = `${os.homedir()}/.local/bin`;
        const currentPath = process.env.PATH || '';
        if (!currentPath.includes(homeLocalBin)) {
          console.log(chalk.yellow(`\n⚠️  Please add ${homeLocalBin} to your PATH:`));
          console.log(chalk.cyan(`  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`));
          console.log(chalk.cyan(`  source ~/.bashrc`));
        }
        
        return { success: true, message: 'Dagger CLI installed successfully via install script' };
        
      case 'win32': // Windows
        console.log(chalk.blue('\n🪟 Installing Dagger CLI on Windows...'));
        await execa('winget', ['install', 'Dagger.Cli'], { timeout: 120000 });
        return { success: true, message: 'Dagger CLI installed successfully via winget' };
        
      default:
        return { 
          success: false, 
          message: `Unsupported platform: ${platform}. Please install Dagger CLI manually from https://docs.dagger.io/install/` 
        };
    }
    
  } catch (error) {
    return { 
      success: false, 
      message: `Installation failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Legacy function name for compatibility
 */
export const isContainerUseInstalled = isDaggerCliInstalled; 