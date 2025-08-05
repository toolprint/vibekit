import {Text, Box, useInput} from 'ink';

const StatusDisplay = ({agentName, sandboxType, options = {}, settings = {}}) => {
  const openDashboard = async () => {
    try {
      console.log('\n📊 Starting analytics dashboard server...');
      
      const { default: dashboardManager } = await import('../dashboard/manager.js');
      const dashboardServer = dashboardManager.getDashboardServer(3001);
      await dashboardServer.start();
      const status = dashboardServer.getStatus();
      
      if (status.running && status.url) {
        console.log(`Dashboard available at: ${status.url}`);
        
        // Open browser
        const { exec } = await import('child_process');
        const openCmd = process.platform === 'darwin' ? 'open' : 
                       process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${openCmd} ${status.url}`);
      }
    } catch (error) {
      console.error('❌ Failed to start dashboard server:', error.message);
    }
  };

  useInput((input, key) => {
    if (input === 'd' || input === 'D') {
      openDashboard();
    }
  });
  
  // Use actual sandboxType to show real status, not just settings
  const getSandboxStatus = () => {
    if (!settings.sandbox?.enabled) return 'OFF';
    if (sandboxType === 'docker') return 'ON';
    if (sandboxType === 'none' && settings.sandbox?.enabled) return 'UNAVAILABLE';
    return 'OFF';
  };
  const sandboxStatus = getSandboxStatus();
  const proxyStatus = options.proxy ? 'ON' : 'OFF';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>
        🖖 VibeKit | Sandbox: <Text color={sandboxStatus === 'ON' ? 'green' : sandboxStatus === 'UNAVAILABLE' ? 'yellow' : 'red'}>{sandboxStatus}</Text> | Proxy: <Text color={options.proxy ? 'green' : 'red'}>{proxyStatus}</Text> | Dashboard: <Text color="cyan">Press 'd' to open</Text>
      </Text>
      {sandboxStatus === 'UNAVAILABLE' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">⚠️  Sandbox enabled but Docker daemon not running!</Text>
          <Text color="yellow">   Commands will run directly on your system without isolation.</Text>
          <Text color="gray">   Start Docker Desktop or run: open -a Docker</Text>
        </Box>
      )}
      <Text> </Text>
    </Box>
  );
};

export default StatusDisplay;
