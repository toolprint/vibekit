/**
 * Local Sandbox CLI Commands
 * 
 * Implements all local sandbox management commands including create, list,
 * watch, terminal, delete, and configuration management.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { 
  LocalSandboxProvider, 
  createLocalProvider,
  EnvironmentSelector,
  EnvironmentManager,
  ContainerUseWrapper,
  type LocalProviderConfig,
  type Environment,
  type SelectionResult,
} from '@vibekit/local';
import {
  selectEnvironmentPrompt,
  multiSelectEnvironmentPrompt,
  confirmPrompt,
  textInputPrompt,
  formatEnvironmentTable,
  ProgressIndicator,
  displayTips,
} from '../utils/interactive';
import { installCompletion } from '../utils/completion';
import {
  watchEnvironmentLogs,
  watchMultipleEnvironments,
  createInteractiveViewer,
} from '../utils/streaming';

let localProvider: LocalSandboxProvider | null = null;
let environmentSelector: EnvironmentSelector | null = null;

/**
 * Get or create the local provider instance
 */
function getLocalProvider(): LocalSandboxProvider {
  if (!localProvider) {
    localProvider = createLocalProvider({
      autoInstall: true,
    });
  }
  return localProvider;
}

/**
 * Get or create the environment selector
 */
function getEnvironmentSelector(): EnvironmentSelector {
  if (!environmentSelector) {
    const wrapper = new ContainerUseWrapper();
    const manager = new EnvironmentManager(wrapper);
    environmentSelector = new EnvironmentSelector(manager);
  }
  return environmentSelector;
}

/**
 * Create a new local sandbox environment
 */
export async function createCommand(options: {
  name?: string;
  agent?: string;
  baseImage?: string;
  workingDirectory?: string;
  env?: string;
  interactive?: boolean;
}) {
  try {
    const provider = getLocalProvider();
    
    // Interactive mode for enhanced UX
    if (options.interactive) {
      console.log(chalk.blue('🚀 Interactive Sandbox Creation\n'));
      
      // Prompt for missing options
      if (!options.name) {
        options.name = await textInputPrompt(
          'Environment name (leave empty for auto-generated):'
        ) || undefined;
      }
      
      if (!options.agent) {
        const agentChoices = ['cursor', 'claude', 'codex', 'gemini'];
        const result = await selectEnvironmentPrompt(
          agentChoices.map(agent => ({
            name: agent,
            status: 'stopped' as const,
            environment: { VIBEKIT_AGENT_TYPE: agent },
            branch: 'main',
            baseImage: 'ubuntu:24.04',
            createdAt: new Date().toISOString(),
            workingDirectory: '/workspace',
          })),
          'Select agent type:'
        );
        options.agent = result || 'cursor';
      }
      
      if (!options.baseImage) {
        const imageChoices = ['ubuntu:24.04', 'node:20', 'python:3.11', 'alpine:latest'];
        const result = await selectEnvironmentPrompt(
          imageChoices.map(image => ({
            name: image,
            status: 'stopped' as const,
            environment: {},
            branch: 'main',
            baseImage: image,
            createdAt: new Date().toISOString(),
            workingDirectory: '/workspace',
          })),
          'Select base image:'
        );
        options.baseImage = result || 'ubuntu:24.04';
      }
    }

    const progress = new ProgressIndicator(4);
    progress.addStep('Validating configuration');
    progress.addStep('Setting up environment');
    progress.addStep('Starting container');
    progress.addStep('Finalizing setup');
    
    progress.start('Creating local sandbox environment...');
    
    // Parse environment variables if provided
    const envVars: Record<string, string> = {};
    if (options.env) {
      const pairs = options.env.split(',');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      }
    }

    progress.nextStep('Setting up environment configuration');

    // Create the sandbox
    const sandbox = await provider.create(
      envVars,
      options.agent as any,
      options.workingDirectory
    );

    progress.nextStep('Container started successfully');
    progress.succeed(`Local sandbox created: ${chalk.green(sandbox.sandboxId)}`);
    
    console.log(chalk.blue('\n📋 Sandbox Details:'));
    console.log(`  ID: ${sandbox.sandboxId}`);
    console.log(`  Agent: ${options.agent || 'default'}`);
    console.log(`  Base Image: ${options.baseImage || 'ubuntu:24.04'}`);
    console.log(`  Working Directory: ${options.workingDirectory || '/workspace'}`);
    
    if (Object.keys(envVars).length > 0) {
      console.log(`  Environment Variables: ${Object.keys(envVars).join(', ')}`);
    }

    displayTips([
      `Watch logs: vibekit local watch ${sandbox.sandboxId}`,
      `Open terminal: vibekit local terminal ${sandbox.sandboxId}`,
      'List all environments: vibekit local list',
    ]);

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * List local sandbox environments
 */
export async function listCommand(options: {
  status?: string;
  agent?: string;
  branch?: string;
  json?: boolean;
}) {
  const progress = new ProgressIndicator(2);
  progress.addStep('Loading environments');
  progress.addStep('Applying filters');
  progress.start('Loading local sandboxes...');
  
  try {
    const provider = getLocalProvider();
    const environments = await provider.listEnvironments();
    
    progress.nextStep('Applying filters and formatting');

    // Apply filters
    let filtered = environments;
    
    if (options.status) {
      filtered = filtered.filter(env => env.status === options.status);
    }
    
    if (options.agent) {
      filtered = filtered.filter(env => {
        const agentType = env.environment?.VIBEKIT_AGENT_TYPE || env.environment?.AGENT_TYPE;
        return agentType === options.agent;
      });
    }
    
    if (options.branch) {
      filtered = filtered.filter(env => env.branch === options.branch);
    }

    progress.succeed(`Found ${filtered.length} local sandbox(es)`);

    // Display results
    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    formatEnvironmentTable(filtered);

    if (filtered.length !== environments.length) {
      console.log(chalk.gray(`Showing ${filtered.length} of ${environments.length} total environments`));
    }

    if (filtered.length === 0) {
      displayTips([
        'Create environment: vibekit local create',
        'Interactive creation: vibekit local create --interactive',
      ]);
    } else {
      displayTips([
        'Watch environment: vibekit local watch <name>',
        'Open terminal: vibekit local terminal <name>',
        'Delete environment: vibekit local delete <name>',
      ]);
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Watch logs from a local sandbox environment
 */
export async function watchCommand(
  environmentName?: string,
  options: {
    all?: boolean;
    follow?: boolean;
    interactive?: boolean;
    level?: string;
    tail?: number;
  } = {}
) {
  try {
    const provider = getLocalProvider();
    let environments: Environment[] = [];

    if (options.all) {
      // Watch all running environments
      environments = await provider.listEnvironments();
      environments = environments.filter(env => env.status === 'running');
      
      if (environments.length === 0) {
        console.log(chalk.yellow('No running environments to watch'));
        displayTips(['Start environment: vibekit local create']);
        return;
      }
      
      console.log(chalk.blue(`🔍 Watching ${environments.length} environment(s)...`));
      
      if (options.interactive) {
        // Interactive multi-environment viewer
        await createInteractiveViewer(environments, {
          follow: options.follow,
          prefix: true,
          colors: true,
          filter: options.level ? { level: [options.level] } : undefined,
          tail: options.tail,
        });
      } else {
        // Simple multi-environment watching
        const stream = await watchMultipleEnvironments(environments, {
          follow: options.follow,
          prefix: true,
          colors: true,
          filter: options.level ? { level: [options.level] } : undefined,
          tail: options.tail,
        });

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          stream.stop();
          console.log(chalk.gray('\nStopped watching'));
          process.exit(0);
        });
      }
      
    } else if (environmentName) {
      // Watch specific environment by name
      const allEnvs = await provider.listEnvironments();
      const env = allEnvs.find(e => e.name === environmentName);
      
      if (!env) {
        console.error(chalk.red(`Environment '${environmentName}' not found`));
        console.log(chalk.gray('Available environments:'));
        formatEnvironmentTable(allEnvs);
        process.exit(1);
      }
      
      environments = [env];
      
    } else {
      // No environment specified - use interactive selection
      const allEnvs = await provider.listEnvironments();
      
      if (allEnvs.length === 0) {
        console.log(chalk.yellow('No environments available to watch'));
        displayTips(['Create environment: vibekit local create']);
        return;
      }

      if (allEnvs.length === 1) {
        environments = allEnvs;
      } else {
        const selectedName = await selectEnvironmentPrompt(
          allEnvs,
          'Select environment to watch:'
        );
        
        if (!selectedName) {
          console.log(chalk.gray('Watch cancelled'));
          return;
        }
        
        const selectedEnv = allEnvs.find(e => e.name === selectedName);
        if (selectedEnv) {
          environments = [selectedEnv];
        }
      }
    }

    // Watch the selected environment(s)
    if (environments.length === 1) {
      const env = environments[0];
      console.log(chalk.blue(`🔍 Watching environment: ${chalk.bold(env.name)}`));
      console.log(chalk.gray('Press Ctrl+C to stop watching\n'));

      // Single environment watching
      const stream = await watchEnvironmentLogs(env, {
        follow: options.follow,
        filter: options.level ? { level: [options.level] } : undefined,
        tail: options.tail,
      });

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        stream.stop();
        console.log(chalk.gray('\nStopped watching'));
        process.exit(0);
      });
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Open terminal in a local sandbox environment
 */
export async function terminalCommand(environmentName?: string) {
  try {
    const provider = getLocalProvider();
    let environment: Environment;

    if (environmentName) {
      const progress = new ProgressIndicator(1);
      progress.start('Finding environment...');
      
      const environments = await provider.listEnvironments();
      const env = environments.find(e => e.name === environmentName);
      
      if (!env) {
        progress.fail(`Environment '${environmentName}' not found`);
        console.log(chalk.gray('Available environments:'));
        formatEnvironmentTable(environments);
        process.exit(1);
      }
      
      progress.succeed(`Environment found: ${env.name}`);
      environment = env;
    } else {
      const environments = await provider.listEnvironments();
      
      if (environments.length === 0) {
        console.log(chalk.yellow('No environments available'));
        displayTips(['Create environment: vibekit local create']);
        return;
      }

      if (environments.length === 1) {
        environment = environments[0];
      } else {
        // Interactive selection
        const selectedName = await selectEnvironmentPrompt(
          environments,
          'Select environment for terminal access:'
        );
        
        if (!selectedName) {
          console.log(chalk.gray('Terminal access cancelled'));
          return;
        }
        
        environment = environments.find(e => e.name === selectedName)!;
      }
    }

    // Ensure environment is running
    if (environment.status !== 'running') {
      const shouldStart = await confirmPrompt(
        `Environment '${environment.name}' is ${environment.status}. Start it?`,
        true
      );
      
      if (!shouldStart) {
        console.log(chalk.gray('Terminal access cancelled'));
        return;
      }
      
      const progress = new ProgressIndicator(1);
      progress.start('Starting environment...');
      
      // TODO: Implement environment start
      console.log(chalk.yellow('Environment start not yet implemented'));
      progress.fail('Cannot start environment');
      return;
    }

    console.log(chalk.blue(`Opening terminal for: ${chalk.bold(environment.name)}`));
    
    // TODO: Implement actual terminal opening
    console.log(chalk.yellow('Terminal access not yet implemented'));
    console.log(chalk.gray(`Would open terminal for: ${environment.name}`));
    
    displayTips([
      'Watch logs: vibekit local watch ' + environment.name,
      'Check status: vibekit local list',
    ]);

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Delete a local sandbox environment
 */
export async function deleteCommand(
  environmentName?: string,
  options: {
    force?: boolean;
    all?: boolean;
    interactive?: boolean;
  } = {}
) {
  try {
    const provider = getLocalProvider();
    
    if (options.all) {
      // Delete all environments
      const environments = await provider.listEnvironments();
      
      if (environments.length === 0) {
        console.log(chalk.yellow('No environments to delete'));
        return;
      }
      
      if (!options.force) {
        console.log(chalk.red(`This will delete ${environments.length} environment(s):`));
        formatEnvironmentTable(environments);
        
        const confirmed = await confirmPrompt(
          `Are you sure you want to delete all ${environments.length} environment(s)?`,
          false
        );
        
        if (!confirmed) {
          console.log(chalk.gray('Deletion cancelled'));
          return;
        }
      }
      
      const progress = new ProgressIndicator(environments.length);
      progress.start('Deleting environments...');
      
      let deleted = 0;
      for (const env of environments) {
        try {
          progress.nextStep(`Deleting ${env.name}...`);
          await provider.deleteEnvironment(env.name);
          deleted++;
        } catch (error) {
          console.warn(`Failed to delete ${env.name}: ${error}`);
        }
      }
      
      progress.succeed(`Deleted ${deleted} of ${environments.length} environment(s)`);
      return;
    }

    let targetEnvironment: Environment | null = null;

    if (!environmentName) {
      if (options.interactive) {
        // Interactive selection for deletion
        const environments = await provider.listEnvironments();
        
        if (environments.length === 0) {
          console.log(chalk.yellow('No environments to delete'));
          return;
        }
        
        const selectedNames = await multiSelectEnvironmentPrompt(
          environments,
          'Select environment(s) to delete:'
        );
        
        if (selectedNames.length === 0) {
          console.log(chalk.gray('Deletion cancelled'));
          return;
        }
        
        // Confirm deletion
        console.log(chalk.red(`This will delete ${selectedNames.length} environment(s):`));
        selectedNames.forEach(name => console.log(`  • ${name}`));
        
        const confirmed = await confirmPrompt(
          'Are you sure you want to delete these environment(s)?',
          false
        );
        
        if (!confirmed) {
          console.log(chalk.gray('Deletion cancelled'));
          return;
        }
        
        // Delete selected environments
        const progress = new ProgressIndicator(selectedNames.length);
        progress.start('Deleting environments...');
        
        let deleted = 0;
        for (const name of selectedNames) {
          try {
            progress.nextStep(`Deleting ${name}...`);
            await provider.deleteEnvironment(name);
            deleted++;
          } catch (error) {
            console.warn(`Failed to delete ${name}: ${error}`);
          }
        }
        
        progress.succeed(`Deleted ${deleted} of ${selectedNames.length} environment(s)`);
        return;
        
      } else {
        console.error(chalk.red('Environment name is required'));
        console.log(chalk.gray('Usage: vibekit local delete <environment-name>'));
        console.log(chalk.gray('   or: vibekit local delete --interactive'));
        process.exit(1);
      }
    }

    // Single environment deletion
    const environments = await provider.listEnvironments();
    targetEnvironment = environments.find(e => e.name === environmentName) || null;
    
    if (!targetEnvironment) {
      console.error(chalk.red(`Environment '${environmentName}' not found`));
      console.log(chalk.gray('Available environments:'));
      formatEnvironmentTable(environments);
      process.exit(1);
    }
    
    // Confirm deletion unless forced
    if (!options.force) {
      const confirmed = await confirmPrompt(
        `Delete environment '${environmentName}'?`,
        false
      );
      
      if (!confirmed) {
        console.log(chalk.gray('Deletion cancelled'));
        return;
      }
    }

    const progress = new ProgressIndicator(1);
    progress.start(`Deleting environment: ${environmentName}...`);
    
    await provider.deleteEnvironment(environmentName);
    
    progress.succeed(`Environment deleted: ${chalk.green(environmentName)}`);

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Install shell completion
 */
export async function completionCommand(options: {
  shell?: string;
}) {
  try {
    const progress = new ProgressIndicator(1);
    progress.start('Installing shell completion...');
    
    await installCompletion(options.shell || 'auto');
    
    progress.succeed('Shell completion installed successfully');
    
    displayTips([
      'Restart your shell or source your shell config file',
      'Try typing: vibekit local <TAB>',
    ]);
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Main local command setup
 */
export function createLocalCommand(): Command {
  const localCmd = new Command('local');
  
  localCmd
    .description('Manage local sandbox environments using Container Use')
    .addHelpText('after', `
Examples:
  vibekit local create --name my-sandbox --agent claude
  vibekit local list --status running
  vibekit local watch my-sandbox
  vibekit local terminal my-sandbox
  vibekit local delete my-sandbox
`);

  // Create subcommand
  localCmd
    .command('create')
    .description('Create a new local sandbox environment')
    .option('-n, --name <name>', 'Environment name (auto-generated if not specified)')
    .option('-a, --agent <type>', 'Agent type (claude, codex, opencode, gemini)')
    .option('-i, --base-image <image>', 'Base Docker image (default: ubuntu:24.04)')
    .option('-w, --working-directory <path>', 'Working directory (default: /workspace)')
    .option('-e, --env <vars>', 'Environment variables (comma-separated key=value pairs)')
    .option('--interactive', 'Interactive mode with prompts for missing options')
    .action(createCommand);

  // List subcommand
  localCmd
    .command('list')
    .alias('ls')
    .description('List local sandbox environments')
    .option('-s, --status <status>', 'Filter by status (running, stopped, error)')
    .option('-a, --agent <type>', 'Filter by agent type')
    .option('-b, --branch <branch>', 'Filter by Git branch')
    .option('--json', 'Output in JSON format')
    .action(listCommand);

  // Watch subcommand
  localCmd
    .command('watch [environment]')
    .description('Watch logs from a local sandbox environment')
    .option('-a, --all', 'Watch all running environments')
    .option('-f, --follow', 'Follow log output (default: true)')
    .option('-i, --interactive', 'Interactive viewer with controls')
    .option('-l, --level <level>', 'Filter by log level (info, warn, error, debug)')
    .option('-t, --tail <n>', 'Number of recent log lines to show', parseInt)
    .action(watchCommand);

  // Terminal subcommand
  localCmd
    .command('terminal [environment]')
    .alias('shell')
    .description('Open terminal in a local sandbox environment')
    .action(terminalCommand);

  // Delete subcommand
  localCmd
    .command('delete [environment]')
    .alias('rm')
    .description('Delete a local sandbox environment')
    .option('-f, --force', 'Force deletion without confirmation')
    .option('-a, --all', 'Delete all environments')
    .option('--interactive', 'Interactive mode for selecting environments to delete')
    .action(deleteCommand);

  // Completion subcommand
  localCmd
    .command('completion')
    .description('Install shell completion for vibekit local commands')
    .option('--shell <shell>', 'Target shell (bash, zsh, auto)', 'auto')
    .action(completionCommand);

  return localCmd;
} 