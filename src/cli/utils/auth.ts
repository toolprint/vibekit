import { execa, execaSync } from 'execa';
import enquirer from 'enquirer';
import ora from 'ora';
import chalk from 'chalk';
import open from 'open';

export interface AuthStatus {
  isAuthenticated: boolean;
  username?: string;
  provider: 'e2b' | 'daytona';
  needsInstall?: boolean;
}

export async function isDaytonaInstalled(): Promise<boolean> {
  return isCliInstalled('daytona');
}

async function isCliInstalled(command: string): Promise<boolean> {
  try {
    await execa(command, ['--version']);
    return true;
  } catch (error) {
    return false;
  }
}

export async function checkAuth(provider: 'e2b' | 'daytona'): Promise<AuthStatus> {
  const cliCommand = provider === 'e2b' ? 'e2b' : 'daytona';
  const isInstalled = await isCliInstalled(cliCommand);
  
  if (!isInstalled) {
    return { isAuthenticated: false, provider, needsInstall: true };
  }

  try {
    if (provider === 'e2b') {
      const { stdout } = await execa('e2b', ['auth', 'info']);
      return { isAuthenticated: true, username: 'E2B User', provider };
    } else {
      // Daytona - check if we can list organizations (a command that requires authentication)
      const { stdout, stderr } = await execa('daytona', ['organization', 'list'], { 
        reject: false, // Don't throw on non-zero exit codes
        timeout: 15000 // 15 second timeout
      });
      
      // If the command succeeded or returned a non-auth error, consider it authenticated
      // We check for common auth-related error messages in stderr
      const isAuthError = stderr && (
        stderr.toLowerCase().includes('authentication') ||
        stderr.toLowerCase().includes('login') ||
        stderr.toLowerCase().includes('unauthorized') ||
        stderr.toLowerCase().includes('not logged in')
      );
      
      if (!isAuthError) {
        // Try to extract username from the output if possible
        let username = 'Daytona User';
        if (stdout) {
          // Look for email patterns in the output
          const emailMatch = stdout.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            username = emailMatch[0];
          }
        }
        
        return { 
          isAuthenticated: true, 
          username,
          provider 
        };
      }
      
      // If we got here, authentication failed
      if (stderr) {
        console.error(chalk.gray(`Daytona auth check error: ${stderr}`));
      }
      
      return { isAuthenticated: false, provider };
    }
  } catch (error) {
    console.error(chalk.gray(`Error checking ${provider} auth: ${error instanceof Error ? error.message : String(error)}`));
    return { isAuthenticated: false, provider };
  }
}

async function installDaytonaCli(): Promise<boolean> {
  const spinner = ora('Installing Daytona CLI...').start();
  try {
    // Check if Homebrew is installed
    try {
      execaSync('brew', ['--version']);
    } catch (error) {
      spinner.fail('Homebrew is required to install Daytona CLI. Please install it first: https://brew.sh');
      return false;
    }

    // Install Daytona CLI via Homebrew
    await execa('brew', ['install', 'daytonaio/cli/daytona']);
    spinner.succeed('Daytona CLI installed successfully');
    return true;
  } catch (error) {
    spinner.fail('Failed to install Daytona CLI');
    console.error(chalk.red('Please install it manually: https://www.daytona.io/docs/installation'));
    return false;
  }
}

export async function authenticate(provider: 'e2b' | 'daytona'): Promise<boolean> {
  const spinner = ora(`Authenticating with ${provider.toUpperCase()}...`).start();
  
  try {
    // Check if CLI is installed
    const cliCommand = provider === 'e2b' ? 'e2b' : 'daytona';
    const isInstalled = await isCliInstalled(cliCommand);
    
    if (!isInstalled) {
      if (provider === 'daytona') {
        spinner.info('Daytona CLI not found');
        const { confirm } = await enquirer.prompt<{ confirm: boolean }>({
          type: 'confirm',
          name: 'confirm',
          message: 'Would you like to install Daytona CLI now? (requires Homebrew)',
          initial: true
        });
        
        if (confirm) {
          const installed = await installDaytonaCli();
          if (!installed) return false;
        } else {
          console.log(chalk.yellow('\nPlease install Daytona CLI manually: https://www.daytona.io/docs/installation'));
          return false;
        }
      } else {
        spinner.fail(`${provider.toUpperCase()} CLI not found. Please install it first.`);
        return false;
      }
    }

    if (provider === 'e2b') {
      // E2B handles browser opening automatically
      await execa('e2b', ['auth', 'login'], { stdio: 'inherit' });
    } else {
      // Daytona login - we'll run this in a child process and wait for it to complete
      spinner.text = 'Opening Daytona authentication in your browser...';
      const { execa: execaAsync } = await import('execa');
      
      try {
        // Run the login command in a separate process
        await execaAsync('daytona', ['login'], { 
          stdio: 'inherit',
          // Don't reject on non-zero exit code since Daytona CLI exits after auth
          reject: false 
        });
      } catch (error) {
        // Ignore errors from the Daytona CLI as it may exit after auth
      }
      
      // Give a moment for any cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Verify authentication with retries
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const verifiedAuth = await checkAuth(provider);
      
      if (verifiedAuth.isAuthenticated) {
        spinner.succeed(`Successfully authenticated with ${provider} as ${verifiedAuth.username}`);
        return true;
      }
      
      if (attempt < maxRetries) {
        spinner.text = `Waiting for ${provider} authentication to complete (${attempt}/${maxRetries})...`;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    spinner.fail(`Failed to verify ${provider} authentication. Please try again.`);
    return false;
  } catch (error) {
    spinner.fail(chalk.red(`Failed to authenticate with ${provider.toUpperCase()}`));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
}
