import enquirer from 'enquirer';
import chalk from 'chalk';
import { installE2B } from './providers/e2b.js';
import { installDaytona } from './providers/daytona.js';
import { authenticate, checkAuth, isDaytonaInstalled, isE2BInstalled } from '../utils/auth.js';
import { AGENT_TEMPLATES, SANDBOX_PROVIDERS } from '../../constants/enums.js';

const { prompt } = enquirer;

export async function initCommand() {
  try {
    // Prompt for provider selection
    console.log(chalk.blue('\n🖖 Welcome to VibeKit Setup! 🖖\n'));
    console.log(chalk.gray('↑/↓: Navigate • Space: Select • Enter: Confirm\n'));
    
    const { providers } = await prompt<{ providers: SANDBOX_PROVIDERS[] }>({
      type: 'multiselect',
      name: 'providers',
      message: 'Which providers would you like to set up?',
      choices: Object.entries(SANDBOX_PROVIDERS).map(([key, value]) => ({
        name: value,
        message: value
      }))
    });

    if (providers.length === 0) {
      console.log(chalk.yellow('No providers selected. Exiting.'));
      process.exit(0);
    }

    // Prompt for template selection
    const { templates } = await prompt<{ templates: string[] }>({
      type: 'multiselect',
      name: 'templates',
      message: 'Which agent templates would you like to install?',
      choices: AGENT_TEMPLATES.map(template => ({
        name: template.name,
        message: template.display
      }))
    });

    if (templates.length === 0) {
      console.log(chalk.yellow('\nNo templates selected. Exiting setup.'));
      return;
    }

    // Get resource allocation
    console.log(chalk.gray('\nConfigure resource allocation for your providers:'));
    const { cpu, memory, disk } = await prompt<{ cpu: string; memory: string; disk: string }>([
      {
        type: 'input',
        name: 'cpu',
        message: 'CPU cores per provider (Recommended: 2-4 cores):',
        initial: '2',
        validate: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        }
      },
      {
        type: 'input',
        name: 'memory',
        message: 'Memory (MB) per provider (Recommended: 1024-4096 MB):',
        initial: '1024',
        validate: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        }
      },
      {
        type: 'input',
        name: 'disk',
        message: 'Disk space (GB) for Daytona (Recommended: 1-10 GB):',
        initial: '1',
        validate: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        },
        skip: () => !providers.includes(SANDBOX_PROVIDERS.DAYTONA)
      }
    ]);

    const config = {
      cpu: parseInt(cpu),
      memory: parseInt(memory),
      disk: parseInt(disk)
    };

    // Install selected providers
    for (const provider of providers) {
      let isAuthenticated = false;
      
      // Check if we need to install the CLI first
      const needsInstall = provider === SANDBOX_PROVIDERS.E2B 
        ? !(await isE2BInstalled()) 
        : !(await isDaytonaInstalled());
      if (needsInstall) {
        console.log(chalk.yellow(`\n🔧 ${provider} CLI needs to be installed`));
        const installed = await authenticate(provider);
        if (!installed) {
          console.log(chalk.yellow(`\nPlease install ${provider} CLI and try again.`));
          continue; // Skip to next provider
        }
      }
      
      // Now check authentication
      console.log(chalk.blue(`\n🔐 Checking ${provider} authentication...`));
      const authStatus = await checkAuth(provider);
      
      if (!authStatus.isAuthenticated) {
        console.log(chalk.yellow(`🔑 Authentication required for ${provider}`));
        const success = await authenticate(provider);
        if (!success) {
          console.log(chalk.yellow(`\nPlease authenticate with ${provider} and try again.`));
          continue; // Skip to next provider
        }
        
        // Verify authentication after login attempt
        const newAuthStatus = await checkAuth(provider);
        if (!newAuthStatus.isAuthenticated) {
          console.log(chalk.red(`❌ Failed to authenticate with ${provider}`));
          continue; // Skip to next provider
        }
        isAuthenticated = true;
      } else {
        console.log(chalk.green(`✅ Already authenticated with ${provider}`));
        isAuthenticated = true;
      }
      
      if (!isAuthenticated) {
        continue; // Skip to next provider if not authenticated
      }

      // Proceed with installation
      if (provider === SANDBOX_PROVIDERS.E2B) {
        await installE2B(config, templates);
      } else if (provider === SANDBOX_PROVIDERS.DAYTONA) {
        await installDaytona({ ...config, memory: Math.floor(config.memory / 1024) }, templates);
      }
    }

    console.log(chalk.green('\n✅ Setup complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}