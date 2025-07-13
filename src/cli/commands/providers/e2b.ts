import { execa } from 'execa';
import ora from 'ora';
import chalk from 'chalk';
import { AGENT_TEMPLATES } from '../../../constants/enums.js';

type InstallConfig = {
  cpu: number;
  memory: number;
};

export async function installE2B(config: InstallConfig, selectedTemplates?: string[]) {
  console.log(chalk.blue('\n🔧 Setting up E2B...'));
  let spinner: ReturnType<typeof ora> | null = null;
  
  try {
    // Check if E2B CLI is installed
    const isInstalled = await isE2BInstalled();
    
    if (!isInstalled) {
      spinner = ora(chalk.yellow(
        '❌ E2B CLI not found.\n' +
        'Please install it with: npm install -g @e2b/cli and try again.'
      )).fail();
      return false;
    }

    // Check if Docker is installed and running
    const dockerStatus = await checkDockerStatus();
    if (!dockerStatus.isInstalled) {
      console.log(chalk.red(
        '❌ Docker not found.\n' +
        'Please install Docker from: https://docker.com/get-started and try again.'
      ));
      return false;
    }
    
    if (!dockerStatus.isRunning) {
      console.log(chalk.red(
        '❌ Docker is not running.\n' +
        'Please start Docker and try again.'
      ));
      return false;
    }
    
    console.log(chalk.green('✅ Docker is installed and running'));

    const results = { successful: 0, failed: 0, errors: [] as string[] };
    
    // Filter templates based on selection (default to all if none specified)
    const templatesToInstall = selectedTemplates 
      ? AGENT_TEMPLATES.filter(template => selectedTemplates.includes(template.name))
      : AGENT_TEMPLATES;
    
    // Install each selected template
    for (let i = 0; i < templatesToInstall.length; i++) {
      const template = templatesToInstall[i];
      console.log(chalk.blue(`\n🔨 [${i + 1}/${templatesToInstall.length}] Installing ${template.display} template...`));
      
      spinner = ora({
        text: '  Working...',
        color: 'blue',
        spinner: 'dots',
        indent: 2
      }).start();

      try {
        // Check if Dockerfile exists
        const dockerfilePath = `images/Dockerfile.${template.name}`;
        const fs = await import('fs/promises');
        try {
          await fs.access(dockerfilePath);
        } catch (error) {
          throw new Error(`Dockerfile not found at: ${dockerfilePath}`);
        }
        
        // Run E2B setup with provided configuration
        await execa('e2b', [
          'template', 'build',
          '--cpu-count', config.cpu.toString(),
          '--memory-mb', config.memory.toString(),
          '--name', template.name,  // This will create names like 'claude', 'codex', etc.
          '--dockerfile', `images/Dockerfile.${template.name}`
        ]);

        spinner.succeed(chalk.green(`✅ ${template.display} template installed successfully`));
        results.successful++;
        
        // Clean up the e2b.toml file that gets created after each template build
        try {
          await fs.unlink('e2b.toml');
        } catch (cleanupError) {
          // Ignore cleanup errors - file might not exist or already be deleted
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle specific error cases with user-friendly messages
        let friendlyMessage = `Failed to install ${template.display} template`;
        
        if (errorMessage.includes('already exists') || errorMessage.includes('already used')) {
          friendlyMessage = `${template.display} template already exists - skipping`;
          spinner.info(chalk.yellow(`⚠️  ${friendlyMessage}`));
          // Don't count this as a failure since it's expected behavior
        } else if (errorMessage.includes('Dockerfile not found')) {
          friendlyMessage = `${template.display} template files missing - skipping`;
          spinner.fail(chalk.red(`❌ ${friendlyMessage}`));
          results.errors.push(`${template.display}: Template files not found`);
          results.failed++;
        } else {
          spinner.fail(chalk.red(`❌ ${friendlyMessage}`));
          results.errors.push(`${template.display}: ${errorMessage}`);
          results.failed++;
        }
        
        // Continue with next template instead of throwing
        console.log(chalk.gray('   Continuing with next template...'));
      } finally {
        spinner = null;
      }
    }

    // Print summary
    console.log(chalk.blue('\n📊 Installation Summary:'));
    console.log(chalk.green(`✅ Successfully installed: ${results.successful} templates`));
    
    if (results.failed > 0) {
      console.log(chalk.red(`❌ Failed to install: ${results.failed} templates`));
      if (results.errors.length > 0) {
        console.log(chalk.gray('\nError details:'));
        results.errors.forEach(error => {
          console.log(chalk.gray(`  • ${error}`));
        });
      }
    }
    
    if (results.successful > 0) {
      return true;
    } else {
      console.log(chalk.yellow('\n⚠️  No templates were successfully installed.'));
      return false;
    }
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Failed to set up E2B'));
    } else {
      console.error(chalk.red('\n❌ Failed to set up E2B:', error instanceof Error ? error.message : 'Unknown error'));
    }
    throw error;
  }
}

async function isE2BInstalled(): Promise<boolean> {
  try {
    await execa('e2b', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function checkDockerStatus(): Promise<{ isInstalled: boolean; isRunning: boolean }> {
  try {
    // Check if Docker is installed
    await execa('docker', ['--version']);
    
    try {
      // Check if Docker daemon is running
      await execa('docker', ['info']);
      return { isInstalled: true, isRunning: true };
    } catch {
      return { isInstalled: true, isRunning: false };
    }
  } catch {
    return { isInstalled: false, isRunning: false };
  }
}