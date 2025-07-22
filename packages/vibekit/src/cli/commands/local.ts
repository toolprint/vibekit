/**
 * Local Sandbox CLI Commands (Dagger-based)
 * 
 * Simplified commands for managing dagger-based sandbox instances.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { 
  LocalDaggerSandboxProvider, 
  createLocalProvider,
  type LocalDaggerConfig,
  type AgentType,
} from '@vibekit/local';

let localProvider: LocalDaggerSandboxProvider | null = null;

/**
 * Get or create the local provider instance
 */
function getLocalProvider(): LocalDaggerSandboxProvider {
  if (!localProvider) {
    localProvider = createLocalProvider({});
  }
  return localProvider;
}

/**
 * Create a new local sandbox instance
 */
export async function createCommand(options: {
  agent?: string;
  workingDirectory?: string;
  env?: string;
}) {
  try {
    const spinner = ora('Creating sandbox instance...').start();
    
    const provider = getLocalProvider();
    
    // Parse environment variables if provided
    let envVars: Record<string, string> = {};
    if (options.env) {
      const envPairs = options.env.split(',');
      for (const pair of envPairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      }
    }

    const agentType = options.agent as AgentType || undefined;
    const workingDirectory = options.workingDirectory || '/workspace';

    const sandbox = await provider.create(envVars, agentType, workingDirectory);
    
    spinner.succeed(`Sandbox created with ID: ${sandbox.sandboxId}`);
    
    console.log(chalk.green('\n✅ Sandbox instance created successfully!'));
    console.log(chalk.cyan(`📦 Sandbox ID: ${sandbox.sandboxId}`));
    if (agentType) {
      console.log(chalk.cyan(`🤖 Agent Type: ${agentType}`));
    }
    console.log(chalk.cyan(`📁 Working Directory: ${workingDirectory}`));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to create sandbox: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Run a command in a sandbox (for testing/demo purposes)
 */
export async function runCommand(options: {
  sandbox?: string;
  command?: string;
  agent?: string;
}) {
  try {
    if (!options.command) {
      console.error(chalk.red('❌ Command is required'));
      process.exit(1);
    }

    const spinner = ora('Running command in sandbox...').start();
    
    const provider = getLocalProvider();
    
    // For demo purposes, create a new sandbox if none specified
    let sandbox;
    if (options.sandbox) {
      sandbox = await provider.resume(options.sandbox);
      spinner.text = `Running command in sandbox ${options.sandbox}...`;
    } else {
      const agentType = options.agent as AgentType || undefined;
      sandbox = await provider.create({}, agentType);
      spinner.text = `Running command in new sandbox ${sandbox.sandboxId}...`;
    }

    const result = await sandbox.commands.run(options.command);
    
    spinner.succeed('Command completed');
    
    console.log(chalk.green('\n✅ Command executed successfully!'));
    console.log(chalk.cyan(`📦 Sandbox ID: ${sandbox.sandboxId}`));
    console.log(chalk.cyan(`🔢 Exit Code: ${result.exitCode}`));
    
    if (result.stdout) {
      console.log(chalk.blue('\n📤 STDOUT:'));
      console.log(result.stdout);
    }
    
    if (result.stderr) {
      console.log(chalk.yellow('\n📤 STDERR:'));
      console.log(result.stderr);
    }
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to run command: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Display help and tips for using the local provider
 */
export async function helpCommand() {
  console.log(chalk.blue('\n🔧 VibeKit Local Provider (Dagger-based)\n'));
  console.log('The local provider uses Dagger to create isolated sandbox instances.');
  console.log('Each sandbox is ephemeral and designed for specific tasks.\n');
  
  console.log(chalk.green('Available Commands:'));
  console.log('  create     Create a new sandbox instance');
  console.log('  run        Run a command in a sandbox');
  console.log('  help       Show this help message\n');
  
  console.log(chalk.green('Agent Types:'));
  console.log('  claude     Claude-optimized environment');
  console.log('  codex      OpenAI Codex environment');
  console.log('  opencode   Open source model environment');
  console.log('  gemini     Google Gemini environment\n');
  
  console.log(chalk.green('Examples:'));
  console.log('  vibekit local create --agent claude');
  console.log('  vibekit local run --command "npm install" --agent codex');
  console.log('  vibekit local run --sandbox sandbox-id --command "ls -la"\n');
}

/**
 * Create the local command with all subcommands
 */
export function createLocalCommand(): Command {
  const localCmd = new Command('local');
  localCmd.description('Manage local Dagger-based sandbox instances');

  // Create subcommand
  localCmd
    .command('create')
    .description('Create a new sandbox instance')
    .option('--agent <type>', 'Agent type (claude, codex, opencode, gemini)')
    .option('--working-directory <path>', 'Working directory in sandbox', '/workspace')
    .option('--env <env>', 'Environment variables (key=value,key2=value2)')
    .action(createCommand);

  // Run subcommand
  localCmd
    .command('run')
    .description('Run a command in a sandbox')
    .option('--sandbox <id>', 'Existing sandbox ID (creates new if not specified)')
    .option('--command <cmd>', 'Command to execute')
    .option('--agent <type>', 'Agent type for new sandbox (claude, codex, opencode, gemini)')
    .action(runCommand);

  // Help subcommand
  localCmd
    .command('help')
    .description('Show detailed help and examples')
    .action(helpCommand);

  return localCmd;
} 