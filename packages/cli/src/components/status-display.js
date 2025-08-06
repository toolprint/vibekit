import React from 'react';
import {Text, Box} from 'ink';

const StatusDisplay = ({agentName, sandboxType, options = {}, settings = {}}) => {
  
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
        🖖 VibeKit | Sandbox: <Text color={sandboxStatus === 'ON' ? 'green' : sandboxStatus === 'UNAVAILABLE' ? 'yellow' : 'red'}>{sandboxStatus}</Text> | Proxy: <Text color={options.proxy ? 'green' : 'red'}>{proxyStatus}</Text> | Dashboard: <Text color="cyan">http://localhost:3001</Text>
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
