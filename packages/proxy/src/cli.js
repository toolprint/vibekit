#!/usr/bin/env node
import { Command } from 'commander';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import ProxyServer from './server.js';

const execAsync = promisify(exec);
const program = new Command();

program
  .name('vibekit-proxy')
  .description('VibeKit proxy server for secure API routing')
  .version('0.0.3')
  .option('-p, --port <number>', 'Port to run on', '8080');

program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <number>', 'Port to run on', '8080')
  .option('-d, --daemon', 'Run in background')
  .action(async (options) => {
    const port = parseInt(options.port) || 8080;
    
    if (options.daemon) {
      // For daemon mode, check if port is in use first
      if (await isPortInUse(port)) {
        console.log(`⚠️  Proxy already running on port ${port}`);
        process.exit(1);
      }
      
      console.log(`🚀 Starting proxy server on port ${port} in background...`);
      const child = spawn(process.argv[0], [process.argv[1], '--port', port.toString()], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log(`✅ Proxy server started with PID ${child.pid}`);
    } else {
      await startProxyWithCheck(port);
    }
  });

program
  .command('stop')
  .description('Stop the proxy server')
  .option('-p, --port <number>', 'Port to stop', '8080')
  .action(async (options) => {
    const port = parseInt(options.port) || 8080;
    
    try {
      console.log(`🔍 Looking for proxy server on port ${port}...`);
      
      // Find and kill process using the port
      const { stdout } = await execAsync(`lsof -ti :${port}`).catch(() => ({ stdout: '' }));
      
      if (!stdout.trim()) {
        console.log(`⚠️  No process found running on port ${port}`);
        return;
      }
      
      const pids = stdout.trim().split('\n').filter(Boolean);
      
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          console.log(`✅ Stopped proxy server (PID: ${pid})`);
        } catch (error) {
          if (error.code === 'ESRCH') {
            console.log(`⚠️  Process ${pid} already stopped`);
          } else {
            console.error(`❌ Failed to stop process ${pid}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to stop proxy server:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show proxy server status')
  .option('-p, --port <number>', 'Port to check', '8080')
  .action(async (options) => {
    const port = parseInt(options.port) || 8080;
    
    console.log('🌐 Proxy Server Status');
    console.log('─'.repeat(30));
    
    const running = await isPortInUse(port);
    console.log(`Port ${port}: ${running ? '✅ RUNNING' : '❌ NOT RUNNING'}`);
    
    if (running) {
      try {
        // Try to get health check
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          const data = await response.json();
          console.log(`Uptime: ${Math.round(data.uptime)}s`);
          console.log(`Requests: ${data.requestCount}`);
        }
      } catch {
        console.log('Health check: ❌ Failed');
      }
      
      // Show process info
      try {
        const { stdout } = await execAsync(`lsof -ti :${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        console.log(`PIDs: ${pids.join(', ')}`);
      } catch {
        // Ignore
      }
    }
  });

async function startProxyWithCheck(port) {
  const proxy = new ProxyServer(port);
  
  // Handle graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n⚠️  Received ${signal}. Shutting down proxy server...`);
    proxy.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  process.on('exit', () => proxy.stop());

  try {
    await proxy.start();
    console.log(`🌐 VibeKit proxy server running on port ${port}`);
    console.log(`📊 Ready to handle requests with data redaction`);
    console.log(`⌨️  Press Ctrl+C to stop`);
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${port} is already in use.`);
      console.log(`💡 Try:`);
      console.log(`   • vibekit-proxy status -p ${port}  (check what's running)`);
      console.log(`   • vibekit-proxy stop -p ${port}    (stop existing server)`);
      console.log(`   • vibekit-proxy -p ${port + 1}     (use different port)`);
    } else {
      console.error('❌ Failed to start proxy server:', error.message);
    }
    process.exit(1);
  }
}

async function startProxy(port) {
  return startProxyWithCheck(port);
}

async function isPortInUse(port) {
  try {
    const { stdout } = await execAsync(`lsof -ti :${port}`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

// Add a default command for when no subcommand is provided
program
  .command('*')
  .description('Start the proxy server (default)')
  .action(async () => {
    const options = program.opts();
    const port = parseInt(options.port) || 8080;
    await startProxyWithCheck(port);
  });

// Parse arguments
program.parse(process.argv);