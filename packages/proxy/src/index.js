#!/usr/bin/env node
import ProxyServer from './server.js';

const port = process.env.PORT || process.env.VIBEKIT_PROXY_PORT || 8080;
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

// Keep process alive
process.on('exit', () => {
  proxy.stop();
});

proxy.start().then(() => {
  console.log(`🌐 VibeKit proxy server running on port ${port}`);
  console.log(`📊 Ready to handle requests with data redaction`);
  console.log(`⌨️  Press Ctrl+C to stop`);
}).catch((error) => {
  console.error('❌ Failed to start proxy server:', error.message);
  process.exit(1);
});