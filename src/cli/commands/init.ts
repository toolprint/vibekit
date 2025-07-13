import enquirer from 'enquirer';
import chalk from 'chalk';
import { installE2B } from './providers/e2b.js';
import { installDaytona } from './providers/daytona.js';
import { authenticate, checkAuth, isDaytonaInstalled } from '../utils/auth.js';

const { prompt } = enquirer;

export async function initCommand() {
  try {
    // Prompt for provider selection
    console.log(chalk.blue('\n✨ Welcome to VibeKit Setup! ✨\n'));
    console.log(chalk.gray('↑/↓: Navigate • Space: Select • Enter: Confirm\n'));
    
    const { providers } = await prompt<{ providers: string[] }>({
      type: 'multiselect',
      name: 'providers',
      message: 'Which providers would you like to set up?',
      choices: [
        { name: 'e2b', message: 'E2B (browser-based)' },
        { name: 'daytona', message: 'Daytona (cloud-based)' }
      ]
    });

    if (providers.length === 0) {
      console.log(chalk.yellow('\nNo providers selected. Exiting setup.'));
      return;
    }

    // Get resource allocation
    console.log(chalk.gray('\nConfigure resource allocation for your providers:'));
    const { cpu, memory, disk } = await prompt<{ cpu: string; memory: string; disk: string }>([
      {
        type: 'input',
        name: 'cpu',
        message: 'CPU cores per provider:',
        hint: chalk.gray('Recommended: 2-4 cores'),
        initial: '2',
        validate: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        }
      },
      {
        type: 'input',
        name: 'memory',
        message: 'Memory (MB) per provider:',
        hint: chalk.gray('Recommended: 1024-4096 MB'),
        initial: '1024',
        validate: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        }
      },
      {
        type: 'input',
        name: 'disk',
        message: 'Disk space (GB) for Daytona:',
        hint: chalk.gray('Recommended: 1-10 GB'),
        initial: '1',
        validate: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        },
        skip: () => !providers.includes('daytona')
      }
    ]);

    const config = {
      cpu: parseInt(cpu),
      memory: parseInt(memory),
      disk: parseInt(disk)
    };

    // Install selected providers
    for (const provider of providers) {
      const providerName = provider as 'e2b' | 'daytona';
      let isAuthenticated = false;
      
      // Check if we need to install the CLI first
      const needsInstall = !(await isDaytonaInstalled());
      if (needsInstall) {
        console.log(chalk.yellow(`\n🔧 ${providerName.toUpperCase()} CLI needs to be installed`));
        const installed = await authenticate(providerName);
        if (!installed) {
          console.log(chalk.yellow(`\nPlease install ${providerName.toUpperCase()} CLI and try again.`));
          continue; // Skip to next provider
        }
      }
      
      // Now check authentication
      console.log(chalk.blue(`\n🔐 Checking ${providerName.toUpperCase()} authentication...`));
      const authStatus = await checkAuth(providerName);
      
      if (!authStatus.isAuthenticated) {
        console.log(chalk.yellow(`🔑 Authentication required for ${providerName.toUpperCase()}`));
        const success = await authenticate(providerName);
        if (!success) {
          console.log(chalk.yellow(`\nPlease authenticate with ${providerName.toUpperCase()} and try again.`));
          continue; // Skip to next provider
        }
        
        // Verify authentication after login attempt
        const newAuthStatus = await checkAuth(providerName);
        if (!newAuthStatus.isAuthenticated) {
          console.log(chalk.red(`❌ Failed to authenticate with ${providerName.toUpperCase()}`));
          continue; // Skip to next provider
        }
        isAuthenticated = true;
      } else {
        console.log(chalk.green(`✅ Already authenticated with ${providerName.toUpperCase()}`));
        isAuthenticated = true;
      }
      
      if (!isAuthenticated) {
        continue; // Skip to next provider if not authenticated
      }

      // Proceed with installation
      if (provider === 'e2b') {
        await installE2B(config);
      } else if (provider === 'daytona') {
        await installDaytona({ ...config, memory: Math.floor(config.memory / 1024) });
      }
    }

    console.log(chalk.green('\n✅ Setup complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}