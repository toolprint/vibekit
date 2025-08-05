import React from 'react';
import {Text, Box} from 'ink';

const StatusDisplay = ({agentName, sandboxType, options = {}, settings = {}}) => {
  const dashboardPort = options.dashboardPort || Math.floor(Math.random() * 1000) + 3000;
  const dashboardUrl = `http://localhost:${dashboardPort}`;
  
  // Use settings to determine display status, not processed sandboxType
  const sandboxStatus = settings.sandbox?.enabled ? 'ON' : 'OFF';
  const proxyStatus = options.proxy ? 'ON' : 'OFF';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>
        🖖 VibeKit | Sandbox: <Text color={settings.sandbox?.enabled ? 'green' : 'red'}>{sandboxStatus}</Text> | Proxy: <Text color={options.proxy ? 'green' : 'red'}>{proxyStatus}</Text> | Dashboard: <Text color="blue">{dashboardUrl}</Text>
      </Text>
      <Text> </Text>
    </Box>
  );
};

export default StatusDisplay;