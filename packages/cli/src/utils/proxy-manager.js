import { spawn } from 'child_process';

export class ProxyManager {
  constructor() {
    this.proxyProcess = null;
    this.port = null;
  }

  async start(port = 8080) {
    if (this.proxyProcess && !this.proxyProcess.killed) {
      console.log(`Proxy already running on port ${this.port}`);
      return this.port;
    }

    try {
      // Use npx to run the published @vibe-kit/proxy package
      this.proxyProcess = spawn('npx', ['@vibe-kit/proxy', 'start'], {
        env: { ...process.env, PORT: port.toString() },
        stdio: 'inherit'
      });

      // Wait a moment for the process to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.port = port;
      return port;
    } catch (error) {
      throw error;
    }
  }

  async stop() {
    if (this.proxyProcess && !this.proxyProcess.killed) {
      this.proxyProcess.kill();
      this.proxyProcess = null;
      this.port = null;
    }
  }

  isRunning() {
    return this.proxyProcess && !this.proxyProcess.killed;
  }

  getPort() {
    return this.port;
  }

  async detectExternalProxy(port = 8080) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async ensureProxy(port = 8080) {
    // First check if external proxy is running
    if (await this.detectExternalProxy(port)) {
      return port;
    }

    // If not, start our own
    return await this.start(port);
  }
}

// Singleton instance
export const proxyManager = new ProxyManager();