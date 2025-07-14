import { execa } from 'execa';
import ora from 'ora';
import chalk from 'chalk';
import { AGENT_TEMPLATES } from '../../../constants/enums.js';

import { isE2BInstalled } from '../../utils/auth.js';

import { installTemplates, InstallConfig } from '../../utils/install.js';

export async function installE2B(config: InstallConfig, selectedTemplates?: string[]) {
  return installTemplates({
    provider: 'E2B',
    cliCommand: 'e2b',
    isInstalled: isE2BInstalled,
    buildArgs: (template, config, tempDockerfile) => [
      'template', 'build',
      '--cpu-count', config.cpu.toString(),
      '--memory-mb', config.memory.toString(),
      '--name', template,
      '--dockerfile', tempDockerfile
    ],
    needsTempFile: false,
    dockerfilePathPrefix: 'images/Dockerfile.',
    config,
    selectedTemplates
  });
}

