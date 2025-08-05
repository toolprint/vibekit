import DashboardServer from './server.js';

interface DashboardStatus {
  running: boolean;
  port: number;
  url: string | null;
}

class DashboardManager {
  private dashboardServers: Map<number, DashboardServer>;

  constructor() {
    this.dashboardServers = new Map();
  }

  getDashboardServer(port: number = 3001): DashboardServer {
    if (!this.dashboardServers.has(port)) {
      this.dashboardServers.set(port, new DashboardServer(port));
    }
    return this.dashboardServers.get(port)!;
  }

  isRunning(port: number = 3001): boolean {
    const server = this.dashboardServers.get(port);
    return server ? server.getStatus().running : false;
  }

  stop(port: number = 3001): void {
    const server = this.dashboardServers.get(port);
    if (server) {
      server.stop();
      this.dashboardServers.delete(port);
    }
  }

  stopAll(): void {
    for (const [port, server] of this.dashboardServers) {
      server.stop();
    }
    this.dashboardServers.clear();
  }

  getStatus(port: number = 3001): DashboardStatus {
    const server = this.dashboardServers.get(port);
    return server ? server.getStatus() : { running: false, port, url: null };
  }

  getAllStatuses(): Record<number, DashboardStatus> {
    const statuses: Record<number, DashboardStatus> = {};
    for (const [port, server] of this.dashboardServers) {
      statuses[port] = server.getStatus();
    }
    return statuses;
  }
}

// Export singleton instance
const dashboardManager = new DashboardManager();

// Cleanup on process exit
process.on('exit', () => {
  dashboardManager.stopAll();
});

process.on('SIGINT', () => {
  dashboardManager.stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  dashboardManager.stopAll();
  process.exit(0);
});

export default dashboardManager;