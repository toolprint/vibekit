#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import ClaudeAgent from './agents/claude.js';
import GeminiAgent from './agents/gemini.js';
import Logger from './logging/logger.js';
import Docker from './sandbox/docker.js';
import Analytics from './analytics/analytics.js';
import ProxyServer from './proxy/server.js';
import proxyManager from './proxy/manager.js';
import React from 'react';
import { render } from 'ink';
import Settings from './components/settings.js';
import { setupAliases } from './utils/aliases.js';

const program = new Command();

// Function to read user settings
async function readSettings() {
  const settingsPath = path.join(os.homedir(), '.vibekit', 'settings.json');
  const defaultSettings = {
    sandbox: { enabled: false },
    proxy: { enabled: true, redactionEnabled: true },
    analytics: { enabled: true },
    aliases: { enabled: false }
  };
  
  try {
    if (await fs.pathExists(settingsPath)) {
      const userSettings = await fs.readJson(settingsPath);
      return { ...defaultSettings, ...userSettings };
    }
  } catch (error) {
    // Use default settings if reading fails
  }
  
  return defaultSettings;
}

program
  .name('vibekit')
  .description('CLI middleware for headless and TUI coding agents')
  .version('1.0.0')
  .option('--proxy <url>', 'HTTP/HTTPS proxy URL for all agents (e.g., http://proxy.example.com:8080)');

program
  .command('claude')
  .description('Run Claude Code CLI (sandbox configurable in settings)')
  .option('--sandbox <type>', 'Sandbox type: none (default), docker', 'none')
  .option('--no-network', 'Disable network access (Docker only)')
  .option('--fresh-container', 'Use fresh Docker container instead of persistent one')
  .option('--analytics-mode <mode>', 'Analytics capture mode: basic (default), full', 'basic')
  .option('--no-pty', 'Disable PTY for interactive sessions (basic analytics only)')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (options, command) => {
    const logger = new Logger('claude');
    const settings = await readSettings();
    
    // Get proxy from global option, environment variable, or default if proxy enabled in settings
    let proxy = command.parent.opts().proxy || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    
    // Use default proxy if enabled in settings but no explicit proxy provided
    if (!proxy && settings.proxy.enabled) {
      proxy = 'http://localhost:8080';
    }
    
    // Set ANTHROPIC_BASE_URL to route Claude requests through proxy
    if (proxy) {
      process.env.ANTHROPIC_BASE_URL = proxy;
    }
    
    // Determine sandbox type based on settings and options
    let sandboxType = options.sandbox;
    if (sandboxType === 'docker' && !settings.sandbox.enabled) {
      // If user explicitly selected docker but settings have sandbox disabled, use none
      sandboxType = 'none';
    } else if (!options.sandbox || options.sandbox === 'docker') {
      // If no explicit option or default docker, use settings preference
      sandboxType = settings.sandbox.enabled ? 'docker' : 'none';
      if (!settings.sandbox.enabled) {
        }
    }
    
    const agentOptions = {
      sandbox: sandboxType,
      analyticsMode: options.analyticsMode,
      disablePty: options.noPty,
      proxy: proxy,
      sandboxOptions: {
        networkMode: options.noNetwork ? 'none' : 'bridge',
        usePersistent: !options.freshContainer // Use persistent unless explicitly disabled
      }
    };
    const agent = new ClaudeAgent(logger, agentOptions);
    
    const args = command.args || [];
    await agent.run(args);
  });

program
  .command('gemini')
  .description('Run Gemini CLI (sandbox configurable in settings)')
  .option('--sandbox <type>', 'Sandbox type: none (default), docker', 'none')
  .option('--network', 'Allow network access (less secure)')
  .option('--analytics-mode <mode>', 'Analytics capture mode: basic (default), full', 'basic')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (options, command) => {
    const logger = new Logger('gemini');
    const settings = await readSettings();
    
    // Get proxy from global option, environment variable, or default if proxy enabled in settings
    let proxy = command.parent.opts().proxy || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    
    // Use default proxy if enabled in settings but no explicit proxy provided
    if (!proxy && settings.proxy.enabled) {
      proxy = 'http://localhost:8080';
    }
    
    // Determine sandbox type based on settings and options
    let sandboxType = options.sandbox;
    if (sandboxType === 'docker' && !settings.sandbox.enabled) {
      // If user explicitly selected docker but settings have sandbox disabled, use none
      sandboxType = 'none';
    } else if (!options.sandbox || options.sandbox === 'docker') {
      // If no explicit option or default docker, use settings preference
      sandboxType = settings.sandbox.enabled ? 'docker' : 'none';
      if (!settings.sandbox.enabled) {
        }
    }
    
    const agentOptions = {
      sandbox: sandboxType,
      analyticsMode: options.analyticsMode,
      proxy: proxy,
      sandboxOptions: {
        networkAccess: options.network === true
      }
    };
    const agent = new GeminiAgent(logger, agentOptions);
    
    const args = command.args || [];
    await agent.run(args);
  });

program
  .command('logs')
  .description('View vibekit logs')
  .option('-a, --agent <agent>', 'Filter logs by agent (claude, gemini)')
  .option('-n, --lines <number>', 'Number of recent lines to show', '50')
  .action(async (options) => {
    const logger = new Logger();
    await logger.viewLogs(options);
  });

program
  .command('sync')
  .description('Sync changes from sandbox back to project')
  .action(async () => {
    const logger = new Logger();
    const dockerSandbox = new Docker(process.cwd(), logger);
    
    try {
      const changes = await dockerSandbox.syncChangesBack();
      if (changes.length > 0) {
        console.log(chalk.green(`✓ Synced ${changes.length} files from sandbox`));
        changes.forEach(file => console.log(chalk.gray(`  - ${file}`)));
      } else {
        console.log(chalk.yellow('No changes to sync'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to sync changes:'), error.message);
    }
  });

program
  .command('docker')
  .description('Manage Docker containers')
  .option('--stop', 'Stop persistent container')
  .option('--restart', 'Restart persistent container')
  .option('--status', 'Show container status')
  .action(async (options) => {
    const logger = new Logger();
    const dockerSandbox = new Docker(process.cwd(), logger);
    
    if (options.status) {
      const isRunning = await dockerSandbox.isPersistentContainerRunning();
      const exists = await dockerSandbox.checkPersistentContainer();
      
      if (isRunning) {
        console.log(chalk.green('✓ Persistent container is running'));
      } else if (exists) {
        console.log(chalk.yellow('⚠ Persistent container exists but is stopped'));
      } else {
        console.log(chalk.red('✗ No persistent container found'));
      }
    }
    
    if (options.stop) {
      await dockerSandbox.stopPersistentContainer();
      console.log(chalk.green('✓ Persistent container stopped'));
    }
    
    if (options.restart) {
      await dockerSandbox.stopPersistentContainer();
      await dockerSandbox.startPersistentContainer();
      console.log(chalk.green('✓ Persistent container restarted'));
    }
    
    if (!options.status && !options.stop && !options.restart) {
      console.log(chalk.blue('Use --status, --stop, or --restart'));
    }
  });

const proxyCommand = program
  .command('proxy')
  .description('Manage proxy server');

proxyCommand
  .command('start')
  .description('Start proxy server with request/response logging')
  .option('-p, --port <number>', 'Port to run proxy server on', '8080')
  .action(async (options) => {
    const port = parseInt(options.port) || 8080;
    const proxyServer = proxyManager.getProxyServer(port);
    
    try {
      await proxyServer.start();
    } catch (error) {
      console.error(chalk.red('Failed to start proxy server:'), error.message);
      process.exit(1);
    }
  });

// Default action for 'proxy' without subcommand - start the server
proxyCommand
  .option('-p, --port <number>', 'Port to run proxy server on', '8080')
  .action(async (options, command) => {
    // If no subcommand was provided, start the proxy
    if (command.args.length === 0) {
      const port = parseInt(options.port) || 8080;
      const proxyServer = proxyManager.getProxyServer(port);
      
      try {
        await proxyServer.start();
      } catch (error) {
        console.error(chalk.red('Failed to start proxy server:'), error.message);
        process.exit(1);
      }
    }
  });

proxyCommand
  .command('kill')
  .description('Kill proxy server running on specified port')
  .option('-p, --port <number>', 'Port to kill proxy server on', '8080')
  .action(async (options) => {
    const port = parseInt(options.port) || 8080;
    
    try {
      const { spawn } = await import('child_process');
      
      console.log(chalk.blue(`🔍 Looking for processes on port ${port}...`));
      
      // Use lsof to find processes using the port
      const lsof = spawn('lsof', ['-ti', `:${port}`]);
      let pids = '';
      
      lsof.stdout.on('data', (data) => {
        pids += data.toString();
      });
      
      lsof.on('close', (code) => {
        if (code === 0 && pids.trim()) {
          const pidList = pids.trim().split('\n').filter(pid => pid.trim());
          
          console.log(chalk.yellow(`📋 Found ${pidList.length} process(es) on port ${port}`));
          
          pidList.forEach(pid => {
            try {
              process.kill(parseInt(pid), 'SIGTERM');
              console.log(chalk.green(`✅ Killed process ${pid}`));
            } catch (error) {
              if (error.code === 'ESRCH') {
                console.log(chalk.gray(`⚠️ Process ${pid} already dead`));
              } else {
                console.log(chalk.red(`❌ Failed to kill process ${pid}: ${error.message}`));
              }
            }
          });
          
          // Wait a moment then check again
          setTimeout(() => {
            const checkLsof = spawn('lsof', ['-ti', `:${port}`]);
            let stillRunning = '';
            
            checkLsof.stdout.on('data', (data) => {
              stillRunning += data.toString();
            });
            
            checkLsof.on('close', (checkCode) => {
              if (checkCode === 0 && stillRunning.trim()) {
                console.log(chalk.red(`⚠️ Some processes still running, trying SIGKILL...`));
                stillRunning.trim().split('\n').forEach(pid => {
                  try {
                    process.kill(parseInt(pid), 'SIGKILL');
                    console.log(chalk.green(`💀 Force killed process ${pid}`));
                  } catch (error) {
                    console.log(chalk.red(`❌ Failed to force kill ${pid}: ${error.message}`));
                  }
                });
              } else {
                console.log(chalk.green(`🎉 Port ${port} is now free`));
              }
            });
          }, 1000);
          
        } else {
          console.log(chalk.yellow(`🔍 No processes found running on port ${port}`));
        }
      });
      
      lsof.on('error', (error) => {
        console.error(chalk.red(`❌ Error finding processes: ${error.message}`));
        console.log(chalk.yellow(`💡 Trying alternative method...`));
        
        // Alternative: kill vibekit proxy processes
        const pkill = spawn('pkill', ['-f', 'vibekit.*proxy']);
        
        pkill.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green(`✅ Killed vibekit proxy processes`));
          } else {
            console.log(chalk.yellow(`⚠️ No vibekit proxy processes found to kill`));
          }
        });
      });
      
    } catch (error) {
      console.error(chalk.red('Failed to kill proxy server:'), error.message);
      process.exit(1);
    }
  });

program
  .command('settings')
  .description('Manage vibekit settings and configurations')
  .action(async () => {
    render(React.createElement(Settings));
  });

program
  .command('setup-aliases')
  .description('Install or remove global aliases based on settings')
  .action(async () => {
    const settings = await readSettings();
    await setupAliases(settings.aliases.enabled);
  });

program
  .command('diagnose-aliases')
  .description('Diagnose alias setup and conflicts')
  .action(async () => {
    const { checkAliasesInCurrentShell } = await import('./utils/aliases.js');
    const settings = await readSettings();
    
    console.log(chalk.blue('🔍 VibeKit Alias Diagnosis'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(`Settings enabled: ${settings.aliases.enabled ? chalk.green('✓ YES') : chalk.red('✗ NO')}`);
    
    // Check if vibekit command exists
    try {
      const { spawn } = await import('child_process');
      const vibekitCheck = spawn('which', ['vibekit'], { stdio: 'pipe' });
      let vibekitPath = '';
      
      vibekitCheck.stdout.on('data', (data) => {
        vibekitPath += data.toString().trim();
      });
      
      await new Promise((resolve) => {
        vibekitCheck.on('close', (code) => {
          if (code === 0 && vibekitPath) {
            console.log(`VibeKit command: ${chalk.green('✓ FOUND')} at ${vibekitPath}`);
          } else {
            console.log(`VibeKit command: ${chalk.red('✗ NOT FOUND')}`);
            console.log(chalk.yellow('  Try: npm install -g @vibe-kit/cli'));
          }
          resolve();
        });
      });
    } catch (error) {
      console.log(`VibeKit command: ${chalk.red('✗ ERROR')} - ${error.message}`);
    }
    
    // Check current shell aliases
    const shellWorking = await checkAliasesInCurrentShell();
    console.log(`Shell aliases: ${shellWorking ? chalk.green('✓ WORKING') : chalk.red('✗ NOT WORKING')}`);
    
    if (!shellWorking) {
      console.log(chalk.yellow('\n💡 To fix alias issues:'));
      console.log(chalk.yellow('   1. Run: vibekit settings (enable aliases)'));
      console.log(chalk.yellow('   2. Restart terminal or run: source ~/.zshrc'));
      console.log(chalk.yellow('   3. Test with: claude --help'));
    }
    
    // Show current aliases
    try {
      const { spawn } = await import('child_process');
      const aliasCheck = spawn('bash', ['-c', 'alias | grep -E "(claude|gemini)"'], { stdio: 'pipe' });
      let aliasOutput = '';
      
      aliasCheck.stdout.on('data', (data) => {
        aliasOutput += data.toString();
      });
      
      await new Promise((resolve) => {
        aliasCheck.on('close', () => {
          if (aliasOutput.trim()) {
            console.log(chalk.blue('\n📋 Current aliases:'));
            console.log(aliasOutput.trim());
          }
          resolve();
        });
      });
    } catch (error) {
      // Ignore alias check errors
    }
  });

program
  .command('analytics')
  .description('View agent analytics and usage statistics')
  .option('-a, --agent <agent>', 'Filter analytics by agent (claude, gemini)')
  .option('-d, --days <number>', 'Number of days to include', '7')
  .option('--summary', 'Show summary statistics only')
  .option('--export <file>', 'Export analytics to JSON file')
  .action(async (options) => {
    try {
      const days = parseInt(options.days) || 7;
      const analytics = await Analytics.getAnalytics(options.agent, days);
      
      if (analytics.length === 0) {
        console.log(chalk.yellow('No analytics data found'));
        return;
      }
      
      if (options.export) {
        await fs.writeFile(options.export, JSON.stringify(analytics, null, 2));
        console.log(chalk.green(`✓ Analytics exported to ${options.export}`));
        return;
      }
      
      const summary = Analytics.generateSummary(analytics);
      
      console.log(chalk.blue('📊 Agent Analytics Summary'));
      console.log(chalk.gray('─'.repeat(50)));
      
      console.log(`Total Sessions: ${chalk.cyan(summary.totalSessions)}`);
      console.log(`Total Duration: ${chalk.cyan(Math.round(summary.totalDuration / 1000))}s`);
      console.log(`Average Duration: ${chalk.cyan(Math.round(summary.averageDuration / 1000))}s`);
      console.log(`Success Rate: ${chalk.cyan(summary.successRate.toFixed(1))}%`);
      console.log(`Files Changed: ${chalk.cyan(summary.totalFilesChanged)}`);
      console.log(`Total Errors: ${chalk.cyan(summary.totalErrors)}`);
      console.log(`Total Warnings: ${chalk.cyan(summary.totalWarnings)}`);
      
      if (Object.keys(summary.agentBreakdown).length > 1) {
        console.log(chalk.blue('\n🤖 Agent Breakdown'));
        console.log(chalk.gray('─'.repeat(50)));
        
        Object.entries(summary.agentBreakdown).forEach(([agentName, stats]) => {
          console.log(chalk.yellow(`${agentName}:`));
          console.log(`  Sessions: ${stats.sessions}`);
          console.log(`  Avg Duration: ${Math.round(stats.averageDuration / 1000)}s`);
          console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
        });
      }
      
      if (summary.topErrors.length > 0) {
        console.log(chalk.blue('\n❌ Top Errors'));
        console.log(chalk.gray('─'.repeat(50)));
        
        summary.topErrors.forEach(({ error, count }) => {
          console.log(`${chalk.red(count)}x ${error.substring(0, 80)}${error.length > 80 ? '...' : ''}`);
        });
      }
      
      if (!options.summary) {
        console.log(chalk.blue('\n📋 Recent Sessions'));
        console.log(chalk.gray('─'.repeat(50)));
        
        analytics.slice(0, 10).forEach(session => {
          const date = new Date(session.startTime).toLocaleString();
          const duration = Math.round((session.duration || 0) / 1000);
          const status = session.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
          
          console.log(`${status} ${chalk.cyan(session.agentName)} ${chalk.gray(date)} ${duration}s`);
          
          if (session.filesChanged && session.filesChanged.length > 0) {
            console.log(chalk.gray(`   Files: ${session.filesChanged.slice(0, 3).join(', ')}${session.filesChanged.length > 3 ? '...' : ''}`));
          }
          
          if (session.errors && session.errors.length > 0) {
            console.log(chalk.red(`   Errors: ${session.errors.length}`));
          }
        });
      }
      
    } catch (error) {
      console.error(chalk.red('Failed to retrieve analytics:'), error.message);
    }
  });

program
  .command('clean')
  .description('Clean logs, analytics, and Docker containers')
  .option('--logs', 'Clean logs only')
  .option('--docker', 'Clean Docker containers and images only')
  .option('--analytics', 'Clean analytics data only')
  .action(async (options) => {
    const logger = new Logger();
    
    if (options.logs || (!options.logs && !options.docker && !options.analytics)) {
      await logger.cleanLogs();
      console.log(chalk.green('✓ Logs cleaned'));
    }
    
    if (options.analytics || (!options.logs && !options.docker && !options.analytics)) {
      const os = await import('os');
      const analyticsDir = path.join(os.homedir(), '.vibekit', 'analytics');
      if (await fs.pathExists(analyticsDir)) {
        await fs.remove(analyticsDir);
        console.log(chalk.green('✓ Analytics cleaned'));
      }
    }
    

    if (options.docker || (!options.logs && !options.docker && !options.analytics)) {
      try {
        // Stop and remove persistent container
        const dockerSandbox = new Docker(process.cwd(), logger);
        await dockerSandbox.stopPersistentContainer();
        
        // Clean up Docker containers and images
        const { spawn } = await import('child_process');
        
        // Remove persistent container
        spawn('docker', ['rm', '-f', 'vibekit-persistent'], { stdio: 'ignore' });
        
        // Remove vibekit image
        spawn('docker', ['image', 'rm', '-f', 'vibekit-sandbox'], { stdio: 'ignore' });
        
        console.log(chalk.green('✓ Docker containers and images cleaned'));
      } catch (error) {
        console.log(chalk.yellow('⚠ Could not clean Docker resources (Docker may not be installed)'));
      }
    }
  });

if (process.argv.length === 2) {
  program.help();
}

program.parseAsync(process.argv).catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});