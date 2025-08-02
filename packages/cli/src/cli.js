#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import ClaudeAgent from './agents/claude.js';
import GeminiAgent from './agents/gemini.js';
import Logger from './logging/logger.js';
import DockerSandbox from './sandbox/docker-sandbox.js';
import AgentAnalytics from './analytics/agent-analytics.js';
import ProxyServer from './proxy/proxy-server.js';

const program = new Command();

program
  .name('vibekit')
  .description('CLI middleware for headless and TUI coding agents')
  .version('1.0.0')
  .option('--proxy <url>', 'HTTP/HTTPS proxy URL for all agents (e.g., http://proxy.example.com:8080)');

program
  .command('claude')
  .description('Run Claude Code CLI with secure sandbox')
  .option('--sandbox <type>', 'Sandbox type: local (default), docker, none', 'local')
  .option('--no-network', 'Disable network access (Docker only)')
  .option('--fresh-container', 'Use fresh Docker container instead of persistent one')
  .option('--analytics-mode <mode>', 'Analytics capture mode: basic (default), full', 'basic')
  .option('--no-pty', 'Disable PTY for interactive sessions (basic analytics only)')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (options, command) => {
    const logger = new Logger('claude');
    
    // Get proxy from global option or environment variable
    const proxy = command.parent.opts().proxy || process.env.HTTPS_PROXY;
    
    // Show proxy usage if specified
    if (proxy) {
      console.log(chalk.blue(`[vibekit] Using proxy for Claude: ${proxy}`));
    }
    
    const agentOptions = {
      sandbox: options.sandbox,
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
  .description('Run Gemini CLI with secure sandbox')
  .option('--sandbox <type>', 'Sandbox type: local (default), docker, none', 'local')
  .option('--network', 'Allow network access (less secure)')
  .option('--analytics-mode <mode>', 'Analytics capture mode: basic (default), full', 'basic')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (options, command) => {
    const logger = new Logger('gemini');
    
    // Get proxy from global option
    const proxy = command.parent.opts().proxy;
    
    // Show proxy usage if specified
    if (proxy) {
      console.log(chalk.blue(`[vibekit] Using proxy for Gemini: ${proxy}`));
    }
    
    const agentOptions = {
      sandbox: options.sandbox,
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
    const dockerSandbox = new DockerSandbox(process.cwd(), logger);
    
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
    const dockerSandbox = new DockerSandbox(process.cwd(), logger);
    
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
    const proxyServer = new ProxyServer(port);
    
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
      const proxyServer = new ProxyServer(port);
      
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
  .command('analytics')
  .description('View agent analytics and usage statistics')
  .option('-a, --agent <agent>', 'Filter analytics by agent (claude, gemini)')
  .option('-d, --days <number>', 'Number of days to include', '7')
  .option('--summary', 'Show summary statistics only')
  .option('--export <file>', 'Export analytics to JSON file')
  .action(async (options) => {
    try {
      const days = parseInt(options.days) || 7;
      const analytics = await AgentAnalytics.getAnalytics(options.agent, days);
      
      if (analytics.length === 0) {
        console.log(chalk.yellow('No analytics data found'));
        return;
      }
      
      if (options.export) {
        await fs.writeFile(options.export, JSON.stringify(analytics, null, 2));
        console.log(chalk.green(`✓ Analytics exported to ${options.export}`));
        return;
      }
      
      const summary = AgentAnalytics.generateSummary(analytics);
      
      console.log(chalk.blue('📊 Agent Analytics Summary'));
      console.log(chalk.gray('─'.repeat(50)));
      
      console.log(`Total Sessions: ${chalk.cyan(summary.totalSessions)}`);
      console.log(`Total Duration: ${chalk.cyan(Math.round(summary.totalDuration / 1000))}s`);
      console.log(`Average Duration: ${chalk.cyan(Math.round(summary.averageDuration / 1000))}s`);
      console.log(`Total Tokens: ${chalk.cyan(summary.totalTokens.toLocaleString())}`);
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
          console.log(`  Avg Tokens: ${Math.round(stats.averageTokens)}`);
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
          const tokens = (session.inputTokens || 0) + (session.outputTokens || 0);
          const status = session.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
          
          console.log(`${status} ${chalk.cyan(session.agentName)} ${chalk.gray(date)} ${duration}s ${tokens} tokens`);
          
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
  .description('Clean sandbox, logs, and Docker containers')
  .option('--logs', 'Clean logs only')
  .option('--sandbox', 'Clean sandbox only')
  .option('--docker', 'Clean Docker containers and images only')
  .option('--analytics', 'Clean analytics data only')
  .action(async (options) => {
    const logger = new Logger();
    
    if (options.logs || (!options.sandbox && !options.logs && !options.docker && !options.analytics)) {
      await logger.cleanLogs();
      console.log(chalk.green('✓ Logs cleaned'));
    }
    
    if (options.analytics || (!options.sandbox && !options.logs && !options.docker && !options.analytics)) {
      const os = await import('os');
      const analyticsDir = path.join(os.homedir(), '.vibekit', 'analytics');
      if (await fs.pathExists(analyticsDir)) {
        await fs.remove(analyticsDir);
        console.log(chalk.green('✓ Analytics cleaned'));
      }
    }
    
    if (options.sandbox || (!options.sandbox && !options.logs && !options.docker && !options.analytics)) {
      const sandboxPath = path.join(process.cwd(), '.vibekit', '.vibekit-sandbox');
      if (await fs.pathExists(sandboxPath)) {
        await fs.remove(sandboxPath);
        console.log(chalk.green('✓ Sandbox cleaned'));
      }
    }

    if (options.docker || (!options.sandbox && !options.logs && !options.docker && !options.analytics)) {
      try {
        // Stop and remove persistent container
        const dockerSandbox = new DockerSandbox(process.cwd(), logger);
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