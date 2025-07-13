import { execa } from 'execa';
import ora from 'ora';
import chalk from 'chalk';
import { AGENT_TEMPLATES } from '../../../constants/enums.js';

type InstallConfig = {
  cpu: number;
  memory: number;
  disk: number;
};

export async function installDaytona(config: InstallConfig, selectedTemplates?: string[]) {
  console.log(chalk.blue('\n🔧 Setting up Daytona...'));
  let spinner: ReturnType<typeof ora> | null = null;
  const results = { successful: 0, failed: 0, errors: [] as string[] };
  
  // Check if Daytona CLI is installed
  const isInstalled = await isDaytonaInstalled();
  
  if (!isInstalled) {
    const installCmd = process.platform === 'win32' 
      ? 'powershell -Command "irm https://get.daytona.io/windows | iex"'
      : 'brew install daytonaio/cli/daytona';
    console.log(chalk.yellow(
      '❌ Daytona CLI not found.\n' +
      `Please install it with: ${installCmd} and try again.`
    ));
    return false;
  }



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
      
      // Run Daytona setup with provided configuration
      // Daytona expects the Dockerfile to be in the current directory
      // So we'll copy it to the current directory temporarily
      const tempDockerfile = `Dockerfile.${template.name}.tmp`;
      let tempFileCreated = false;
      
      try {
        await fs.copyFile(dockerfilePath, tempDockerfile);
        tempFileCreated = true;
        
        await execa('daytona', [
          'snapshots', 'create',
          template.name,  // This will create names like 'claude', 'codex', etc.
          '--cpu', config.cpu.toString(),
          '--memory', config.memory.toString(),
          '--disk', config.disk.toString(),
          '--dockerfile', tempDockerfile
        ]);

        spinner.succeed(chalk.green(`✅ ${template.display} template installed successfully`));
        results.successful++;
      } finally {
        // Clean up the temporary Dockerfile
        if (tempFileCreated) {
          try {
            await fs.unlink(tempDockerfile);
          } catch (cleanupError) {
            // Ignore cleanup errors, just log them
            console.warn(chalk.gray(`Warning: Failed to clean up temporary file: ${tempDockerfile}`));
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle specific error cases with user-friendly messages
      let friendlyMessage = `Failed to install ${template.display} template`;
      
      if (errorMessage.includes('already exists')) {
        friendlyMessage = `${template.display} template already exists - skipping`;
        spinner.info(chalk.yellow(`⚠️  ${friendlyMessage}`));
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
}

async function isDaytonaInstalled(): Promise<boolean> {
  try {
    await execa('daytona', ['--version']);
    return true;
  } catch {
    return false;
  }
}

