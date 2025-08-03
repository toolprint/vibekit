import React from 'react';
import {Text, Box} from 'ink';

const StatusDisplay = ({agentName, sandboxType, options = {}}) => {
  const dashboardPort = options.dashboardPort || Math.floor(Math.random() * 1000) + 3000;
  const dashboardUrl = `http://localhost:${dashboardPort}`;
  
  const sandboxStatus = sandboxType === 'docker' ? 'ON' : 'OFF';
  const proxyStatus = options.proxy ? 'ON' : 'OFF';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>
        🖖 VibeKit | Sandbox: <Text color={sandboxType === 'docker' ? 'green' : 'red'}>{sandboxStatus}</Text> | Proxy: <Text color={options.proxy ? 'green' : 'red'}>{proxyStatus}</Text> | Dashboard: <Text color="blue">{dashboardUrl}</Text>
      </Text>
      <Text> </Text>
    </Box>
  );
};

export default StatusDisplay;