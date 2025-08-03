import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const Settings = () => {
  const [settings, setSettings] = useState({
    proxy: {
      enabled: true,
      redactionEnabled: true
    },
    analytics: {
      enabled: true
    },
    sandbox: {
      enabled: false
    }
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentMenu, setCurrentMenu] = useState('main'); // 'main', 'analytics', 'settings'
  const { exit } = useApp();

  const settingsPath = path.join(os.homedir(), '.vibekit', 'settings.json');

  const getMenuItems = () => {
    switch (currentMenu) {
      case 'main':
        return [
          {
            label: 'Analytics',
            description: 'View and configure analytics settings',
            action: 'open-analytics'
          },
          {
            label: 'Settings',
            description: 'Configure proxy and system settings',
            action: 'open-settings'
          },
          {
            label: 'Exit',
            description: 'Exit settings menu',
            action: 'exit'
          }
        ];
      case 'analytics':
        return [
          {
            label: `Analytics: ${settings.analytics.enabled ? '✓ ON' : '✗ OFF'}`,
            description: 'Enable or disable analytics collection and logging',
            action: 'toggle-analytics'
          },
          {
            label: 'View Dashboard',
            description: 'Open analytics dashboard and usage statistics',
            action: 'view-dashboard'
          },
          {
            label: 'Back to Main Menu',
            description: 'Return to main settings menu',
            action: 'back-to-main'
          }
        ];
      case 'settings':
        return [
          {
            label: `Sandbox Isolation: ${settings.sandbox.enabled ? '✓ ON' : '✗ OFF'}`,
            description: 'Enable or disable sandbox isolation for secure execution',
            action: 'toggle-sandbox'
          },
          {
            label: `Proxy Server: ${settings.proxy.enabled ? '✓ ON' : '✗ OFF'}`,
            description: 'Enable or disable the proxy server functionality',
            action: 'toggle-proxy'
          },
          {
            label: `Proxy Redaction: ${settings.proxy.redactionEnabled ? '✓ ON' : '✗ OFF'}`,
            description: 'Toggle redaction of sensitive data in proxy logs',
            action: 'toggle-redaction'
          },
          {
            label: 'Back to Main Menu',
            description: 'Return to main settings menu',
            action: 'back-to-main'
          }
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await fs.ensureDir(path.dirname(settingsPath));
        
        if (await fs.pathExists(settingsPath)) {
          const loadedSettings = await fs.readJson(settingsPath);
          setSettings(prevSettings => ({...prevSettings, ...loadedSettings}));
        }
      } catch (error) {
        // Use default settings if loading fails
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [settingsPath]);

  const saveSettings = async (newSettings) => {
    try {
      await fs.writeJson(settingsPath, newSettings, { spaces: 2 });
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error.message);
    }
  };

  useInput((input, key) => {
    if (loading) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : menuItems.length - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => (prev < menuItems.length - 1 ? prev + 1 : 0));
    } else if (key.leftArrow) {
      if (currentMenu !== 'main') {
        setCurrentMenu('main');
        setSelectedIndex(0);
      }
    } else if (key.return || input === ' ') {
      const selectedItem = menuItems[selectedIndex];
      
      switch (selectedItem.action) {
        case 'open-analytics':
          setCurrentMenu('analytics');
          setSelectedIndex(0);
          break;
        case 'open-settings':
          setCurrentMenu('settings');
          setSelectedIndex(0);
          break;
        case 'back-to-main':
          setCurrentMenu('main');
          setSelectedIndex(0);
          break;
        case 'view-dashboard':
          // Exit settings and start analytics dashboard server
          exit();
          console.log('\n📊 Starting analytics dashboard server...');
          console.log('Opening http://localhost:3000 in your browser...');
          
          // Start dashboard server and open browser
          import('child_process').then(({ spawn, exec }) => {
            // Open browser
            const openCmd = process.platform === 'darwin' ? 'open' : 
                           process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${openCmd} http://localhost:3000`);
            
            // Start dashboard server (placeholder for now)
            console.log('Dashboard server would start here on port 3000');
          });
          break;
        case 'toggle-proxy':
          const newProxySettings = {
            ...settings,
            proxy: {
              ...settings.proxy,
              enabled: !settings.proxy.enabled
            }
          };
          saveSettings(newProxySettings);
          break;
        case 'toggle-redaction':
          const newRedactionSettings = {
            ...settings,
            proxy: {
              ...settings.proxy,
              redactionEnabled: !settings.proxy.redactionEnabled
            }
          };
          saveSettings(newRedactionSettings);
          break;
        case 'toggle-analytics':
          const newAnalyticsSettings = {
            ...settings,
            analytics: {
              ...settings.analytics,
              enabled: !settings.analytics.enabled
            }
          };
          saveSettings(newAnalyticsSettings);
          break;
        case 'toggle-sandbox':
          const newSandboxSettings = {
            ...settings,
            sandbox: {
              ...settings.sandbox,
              enabled: !settings.sandbox.enabled
            }
          };
          saveSettings(newSandboxSettings);
          break;
        case 'exit':
          exit();
          break;
      }
    } else if (key.escape || input === 'q') {
      if (currentMenu !== 'main') {
        setCurrentMenu('main');
        setSelectedIndex(0);
      } else {
        exit();
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue">⚙️  Loading settings...</Text>
      </Box>
    );
  }

  const getMenuTitle = () => {
    switch (currentMenu) {
      case 'main':
        return '🖖 VibeKit Settings';
      case 'analytics':
        return '📊 Analytics Settings';
      case 'settings':
        return '⚙️  System Settings';
      default:
        return '🖖 VibeKit Settings';
    }
  };

  const getNavigationText = () => {
    if (currentMenu === 'main') {
      return 'Use ↑/↓/←/→ to navigate, Enter/Space to select, q/Esc to exit';
    } else {
      return 'Use ↑/↓/←/→ to navigate, ← or q/Esc to go back, Enter/Space to select';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="blue" bold>{getMenuTitle()}</Text>
      <Text> </Text>
      
      {menuItems.map((item, index) => (
        <Box key={index} marginY={0}>
          <Text color={index === selectedIndex ? 'cyan' : 'white'}>
            {index === selectedIndex ? '❯ ' : '  '}
            {item.label.includes('✓ ON') ? (
              <>
                {item.label.replace('✓ ON', '')}
                <Text color="green">✓ ON</Text>
              </>
            ) : item.label.includes('✗ OFF') ? (
              <>
                {item.label.replace('✗ OFF', '')}
                <Text color="red">✗ OFF</Text>
              </>
            ) : (
              item.label
            )}
          </Text>
        </Box>
      ))}

      <Text> </Text>
      <Text color="gray">{getNavigationText()}</Text>
    </Box>
  );
};

export default Settings;